# Mutation check: browser token cache

- Agent: mutation
- Slice: `01-browser-token-cache`
- Verdict: PASS
- Started: `2026-07-13T13:36:25Z`
- Ended: `2026-07-13T13:37:15Z`

## Mutation

The disposable detached worktree was `/Users/cauetpinciara/Documents/fxl/projects/06--PRODUCT--fxl-sales/.worktrees/mutation-browser-token-cache`.
Only `apps/web/src/auth/token.ts` was mutated.
The fresh-token predicate was changed from `Date.now() < expiresAt - ACCESS_TOKEN_EXPIRY_SKEW_MS` to `Date.now() < expiresAt`.
No tests were changed.

## Verification

Command:

```text
pnpm --filter @fxl-sales/web test -- src/auth/__tests__/token.test.ts
```

The command exited with status 1.
The locked token-cache suite reported 3 failures and 4 passes.
The primary expiry-boundary test, `serves a fresh JWT from memory until the expiry skew boundary`, failed because the mutated cache returned the original token at the 30-second safety boundary instead of refreshing to the second token.
Two additional locked tests failed for the same missing-skew behavior: `clears cached state when the client resolves null` returned the cached token rather than refreshing to `null`, and `seed uses the earlier JWT or server expiry and rejects immortal fallback lifetimes` returned the seeded JWT rather than refreshing at the skew boundary.

## Conclusion

PASS: the locked expiry-boundary tests killed the mutation for the expected reason, proving that removal of the 30-second expiry safety skew is detected.
