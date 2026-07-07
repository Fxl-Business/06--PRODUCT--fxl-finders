# Remove Retired Site And Mobile Surfaces

## Frame

FXL Sales will keep only the API, web app, and shared packages in this repository.
The public site and Expo mobile app are retired and should be fully removed so dependency installation, scripts, setup, and docs no longer imply those surfaces are maintained.

## Acceptance

- Given a fresh checkout, when repository files are inspected, then `apps/site` and `apps/mobile` are absent.
- Given dependency metadata is inspected, when workspace packages and lockfiles are read, then retired site, Next.js, mobile, Expo, EAS, and React Native package entries are gone.
- Given operator docs and helper commands are read, when setup or development commands are followed, then only API and web app workflows are described.
- Given a generated referral link is followed, when `/r/:code` is requested, then the API handles the public redirect without a separate app.
- Given verification runs, when root quality commands execute, then lint, type-check, test, and build pass without the removed surfaces.

## Scope Limits

- Keep `apps/api`, `apps/web`, `packages/shared-types`, and `packages/shared-utils`.
- Keep deployment config that serves `@fxl-sales/web`.
- Do not change product behavior outside removing the retired site and mobile surfaces.
- Do not edit changelog files or generated files.

## Slices

| Slice | Acceptance | Wave |
| --- | --- | --- |
| `01-remove-retired-surfaces` | Removed folders, metadata, docs, setup references, and relocated referral redirects leave only API and web workflows. | 1 |

## Verification Contract

- Red oracle before implementation: repository-structure assertion fails while `apps/site` and `apps/mobile` still exist.
- Green oracle after implementation: the same assertion passes and root quality commands pass.
- Full verification: referral handler tests, `pnpm install --lockfile-only`, `pnpm run lint`, `pnpm run type-check`, `pnpm test`, and `pnpm run build`.
