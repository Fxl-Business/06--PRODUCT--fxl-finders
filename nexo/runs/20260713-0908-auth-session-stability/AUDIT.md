# Autopilot audit - run 20260713-0908-auth-session-stability

## Parked slice - durable BFF session store

- [ ] DECIDE: revise the SDK BFF integration contract so callback persistence can await only the newly created session instead of every session in the process.
- [ ] TEST: hold a persistence write for session A, complete callback B's own write, and prove callback B settles independently without inheriting session A's failure.
- PARKED: `fix/durable-bff-session-store` at `9e9d26603aad1c672c9e1351029e8d6d25f3048b` after the third bounded verification failure.
- WHY: refresh, workspace switch, and logout are correctly serialized per session, but callback still uses a process-wide persistence barrier because the SDK creates the session id during route handling.
- SAFETY: the server slice is not merged into `master`.
