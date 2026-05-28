# Project: fxl-finders

**What:** Standalone B2B affiliate SaaS for the FXL product portfolio. Independent partners ("Finders") refer customers to any FXL product (fxl-financiero, gps-comercial, aluga-flow, etc.); in-house Sellers close some of those leads. Co-attribution, configurable per-product price bands, and signed referral links with click→conversion telemetry. Built on top of the FXL canonical template (fxl-template v1.0.0).

**Why:** fxl-financiero today carries a finders program inside its admin panel, but (1) Finders are admin records rather than first-class users, (2) attribution is single-product, (3) the checkout setup fee is hard-coded. FXL Finders extracts the Finders program into a standalone, multi-product platform that any FXL SaaS can plug into via the fxl-support dual-key + signed-webhook pattern.

**Stack:** pnpm workspaces (template-inherited). apps/api: Hono + Drizzle + Postgres (Clerk JWT auth, FORCE RLS). apps/web: React 18 + Vite + Clerk + shadcn/ui (finder portal + admin). apps/site: Next.js 15 + Tailwind v4 (public landing + `/signup` + `/r/:code` redirect). apps/mobile: Expo scaffold present but deferred from v1.0.

**Spec:** `docs/superpowers/specs/2026-05-28-fxl-finders-v1-design.md` (canonical for v1.0 scope, data model, security checklist, phase plan preview, accepted gaps).

**Integration model:** Sibling FXL apps register in an `apps` table (fxl-support pattern: `pk_*` publishable + `sk_*` SHA256-hashed secret + separate `webhook_signing_secret`). Inbound sale-close webhook is HMAC-SHA256+timestamp signed, idempotent on `(source, external_order_id, event_type)`. Outbound referral URLs are signed with the per-app webhook secret so the customer cannot tamper with the quoted price.

**Commission lifecycle:** `pending → approved → locked → paid → reversed`. 30-day default hold per app (configurable). Append-only hash-chained `audit_log` on every money-mutating action.

**Non-goals (v1.0):**
- Mobile app work
- Asaas auto-PIX payouts (manual CSV export in v1.0)
- Finder-specific commission rate overrides (per-product flat in v1.0)
- gps-comercial, aluga-flow, dm-logistica, universal-laudos, apice-laudos integrations (separate milestones after v1.0 contract proves out via fxl-financiero)
- Cookieless attribution fallback (HttpOnly cookie + click_id in URL covers v1.0)
- Two-person approval CHECK constraint on high-value adjustments (schema supports it; UI deferred)
- DSAR self-service UI (admin handles requests manually in v1.0)
- Multi-currency (BRL int-cents throughout)
