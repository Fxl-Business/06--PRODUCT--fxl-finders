# Audit Notes

## Gate 2 retry

- Initial separate verifier passed structure, scan, targeted referral tests, lint, type-check, test, and build.
- Initial separate verifier failed `pnpm audit --prod` because production dependencies had known vulnerabilities.
- Root cause was stale vulnerable production dependency resolution in direct and transitive packages.
- Remediation updated patched direct packages, moved `tailwindcss-animate` to dev dependencies, forced patched OpenTelemetry trace packages through pnpm overrides, and pinned Hono to patched `4.12.25`.
- Fresh separate verifier passed all Gate 2 commands.
