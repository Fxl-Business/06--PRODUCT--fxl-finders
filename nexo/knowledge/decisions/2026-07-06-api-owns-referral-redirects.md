# API Owns Referral Redirects

## Context

The retired public site app previously handled `/r/:code` referral redirects.
The site app has been removed from the repository.
Generated referral links still need a public redirect endpoint that records clicks and forwards users to the destination.

## Decision

The API owns public referral redirects at `/r/:code`.
Generated link URLs use `PUBLIC_LINK_BASE_URL`, which should point to the API public origin.

## Consequences

- Referral links no longer depend on a separate site app.
- Click recording and link generation live in the same deployable API surface.
- Operators must configure `PUBLIC_LINK_BASE_URL` for each environment.
