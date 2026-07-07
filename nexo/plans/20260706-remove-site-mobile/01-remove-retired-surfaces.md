---
id: 01-remove-retired-surfaces
milestone: null
status: done
depends_on: []
files_modified:
  - pnpm-workspace.yaml
  - pnpm-lock.yaml
  - README.md
  - CLAUDE.md
  - Makefile
  - scripts/setup.sh
  - packages/shared-types/src/env.ts
  - packages/shared-utils/src/theme.ts
  - packages/shared-utils/src/hmac.ts
  - apps/api/.env.dev.example
  - apps/api/.env.example
  - apps/api/src/env.ts
  - apps/api/src/domains/links/routes.ts
  - apps/api/src/domains/referrals
  - apps/api/src/server.ts
  - apps/web/.env.dev.example
  - apps/web/src/components/auth/RoleGuard.tsx
  - apps/site
  - apps/mobile
acceptance: "given the repository is inspected, when setup metadata and docs are read, then retired site and Expo mobile surfaces are absent, public referral redirects are API-owned, and root verification stays green"
---

# Slice 01 - Remove Retired Surfaces

## Intent

Remove the public site and Expo mobile app from this repository.
Leave the repo as an API plus web monorepo with shared packages.

## Implementation Plan

1. Delete `apps/site` and `apps/mobile`.
2. Remove site and mobile workspace entries, scripts, Make targets, setup options, and docs.
3. Move the public referral redirect handler into the API at `/r/:code`.
4. Update comments in shared packages so they describe only active API and web consumers.
5. Regenerate the root lockfile so Next.js, site-only dependencies, and removed workspace metadata disappear.
6. Scan tracked files for retired surface references and clean any remaining active docs or config references.

## Tests

- Red: run a shell oracle that asserts retired directories are absent and observe failure before deletion.
- Red: add API referral handler tests and observe failure before the API modules exist.
- Green: rerun that shell oracle after deletion.
- Green: rerun API referral handler tests after moving the handler.
- Integration: run root lint, type-check, test, and build.

## Out Of Scope

- No API behavior changes.
- No web UI behavior changes.
- No release promotion or version tag.
