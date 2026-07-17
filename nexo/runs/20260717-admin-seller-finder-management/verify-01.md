# Gate 2 verification - Slice 01

Status: **FAIL**

Verified HEAD `36105bb0a97b5c05b0b0eade91ffaa284061f32a` against base `b7d85c0`.

## Command evidence

- Web focused oracles: PASS, 2 files and 21 tests, warning-free output.
- API focused oracle: PASS, 1 file and 10 tests, warning-free output.
- Focused ESLint: PASS for all six changed TS and TSX source and test files when run in their web and API package contexts, with no warnings.
- Web type-check: PASS.
- API type-check: PASS.
- `git diff --check b7d85c0..36105bb`: PASS.

The initial root-level ESLint attempt did not reach source linting because the monorepo parser found multiple candidate `tsconfigRootDir` values.
The required focused lint was then run from each package context and passed cleanly.

## Acceptance inspection

PASS:

- Tatico contains only `dashboard`, and Cadastros owns administrator seller and finder routes and controls.
- Meus dados renders people cards as non-interactive articles without create or edit controls.
- `POST /people` and `PATCH /people/:id` use the shared `requireAdmin`, while `GET /people` remains reachable.
- People services continue to receive only `c.get('orgId')`; request body tenant fields are not forwarded.
- The diff contains no legacy route-tree, schema, Hub, raw customer-facing id, or unrelated scope change.

FAIL:

- Person dialog state is cleared only by the local `go` and `setWorkspace` click handlers.
- A browser history or other URL-driven route transition can leave the `modal` person state intact while `canManagePeople` merely hides the dialog.
- Returning to `/cadastros/vendedores` or `/cadastros/finders` can therefore reopen the stale dialog, so the dialog can survive route changes.

Gate 2 cannot pass until person modal state is dismissed for every route transition away from the active Cadastros people-management location and the oracle covers URL or history-driven navigation.
