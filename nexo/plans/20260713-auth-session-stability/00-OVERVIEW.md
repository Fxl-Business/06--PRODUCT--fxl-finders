---
id: 20260713-auth-session-stability
milestone: null
status: parked
mode: autopilot
---

# Stable Hub sessions during creates and tab resume

## Frame

Authenticated users are unexpectedly sent through OAuth navigation when they create data or return to a stale browser tab.
The visible trigger is a failed `POST /auth/refresh`, followed by a page navigation, while a later refresh succeeds after login recreates the session.

## Root-cause evidence

The Hub SDK client performs a network refresh on every `getToken()` call and does not cache or coalesce access-token requests.
The application calls `getToken()` from every query and mutation, so ordinary query bursts and focus refetches rotate the same server-side refresh token repeatedly.
When a refresh returns `null`, the React adapter immediately marks the user signed out and `Protected` invokes OAuth login through `window.location.assign`, which looks like an automatic reload.
The API also uses the SDK's default in-memory BFF session store, so a production process restart forgets sessions while browsers retain their opaque session cookies, making the next refresh return `401 no_session`.

## Acceptance criteria

1. Given multiple protected operations request a token concurrently, when no fresh cached access token exists, then they share one `/auth/refresh` request and all receive the same fresh token.
2. Given a cached access token whose JWT expiry remains outside the safety skew, when another query, mutation, or focus refetch requests a token, then no new refresh request is made.
3. Given an authenticated BFF session, when the API process restarts and receives the same session cookie, then `/auth/refresh` can recover the persisted refresh token instead of returning `no_session`.
4. Given Hub rotates a refresh token, when the BFF persists the updated session and later restarts, then the rotated token is the one restored.
5. Given logout or an unrecoverable session response, when authentication is cleared, then cached browser and persisted server session state are both removed.

## Scope limits

This feature does not change Hub OAuth semantics, access-token lifetime, product authorization, or refresh-token storage in the browser.
It does not modify the sibling Hub SDK repository.
It keeps the current production deployment model and does not add multi-replica coordination infrastructure.

## Slice index

| Slice | Intent | Dependency |
| --- | --- | --- |
| `01-browser-token-cache` | Cache by JWT expiry and coalesce browser refresh requests. | None |
| `02-durable-bff-session-store` | Persist and hydrate Hub BFF sessions across API restarts. | None |
