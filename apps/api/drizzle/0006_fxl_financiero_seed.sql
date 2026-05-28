-- Phase 06 T01 — seed the canonical sibling app `fxl-financiero` (D-A — …ciero, SPEC spelling).
-- Journaled migration (D-F): registered in meta/_journal.json so `drizzle-kit migrate` runs it.
-- Idempotent: every INSERT uses ON CONFLICT DO NOTHING (safe to re-run).
--
-- The app slug `fxl-financiero` is used BYTE-IDENTICALLY as the inbound webhook `source`
-- and the conversions.source resolution key. Do NOT alter the spelling.
--
-- pgcrypto provides gen_random_bytes()/digest() used below (gen_random_uuid is core PG13+,
-- but the byte/hash helpers need the extension).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── apps row — supplies EVERY NOT NULL column (the seed would crash otherwise) ──
INSERT INTO apps (
  id, slug, name,
  publishable_key, secret_key_hash, secret_key_prefix,
  webhook_signing_secret,
  allowed_redirect_hosts,
  attribution_window_days, commission_hold_days,
  status, created_by_user_id,
  created_at
)
VALUES (
  gen_random_uuid(),
  'fxl-financiero',                                          -- D-A canonical slug (…ciero) — byte-identical webhook source
  'FXL Financeiro',
  'pk_fxlfin_seed_placeholder',                              -- PLACEHOLDER publishable key (real key minted via apps admin UI)
  -- secret_key_hash: sha256 of a known-discarded seed secret (rotate via admin UI before go-live).
  encode(digest('sk_fxlfin_seed_placeholder', 'sha256'), 'hex'),
  'sk_fxlfin',                                               -- secret_key_prefix (first chars of the sk_ key)
  -- webhook_signing_secret: a REAL generated 32-byte hex secret (NOT a literal placeholder string).
  -- Generated at migration time; rotate post-migration via admin UI and inject via Infisical
  -- before go-live. For local UAT, rotate it to the value of FXL_FINDERS_WEBHOOK_SECRET.
  encode(gen_random_bytes(32), 'hex'),
  ARRAY['fxlfinanceiro.com.br'],                             -- PLACEHOLDER (D3): confirm real hostname with fxl-financiero team
  30,                                                        -- attribution_window_days (Wave 0)
  30,                                                        -- commission_hold_days (Wave 0)
  'active',                                                  -- status MUST be 'active' (conversions resolve WHERE status='active')
  'system',                                                  -- created_by_user_id
  now()
)
ON CONFLICT (slug) DO NOTHING;
--> statement-breakpoint

-- ── products row — status MUST be 'active' ──
INSERT INTO products (id, app_id, name, slug, status, created_at)
SELECT gen_random_uuid(), a.id, 'FXL Financeiro Core', 'fxl-financiero-core', 'active', now()
FROM apps a WHERE a.slug = 'fxl-financiero'
ON CONFLICT (app_id, slug) DO NOTHING;
--> statement-breakpoint

-- ── price_bands — columns are min_brl / list_brl / max_brl (Phase 01 schema) ──
-- PLACEHOLDER (D2): all amounts in cents BRL — confirm with stakeholders before go-live.
-- Setup component: min=R$800,00 / list=R$1.000,00 / max=R$1.500,00
INSERT INTO price_bands (id, product_id, component, min_brl, list_brl, max_brl, created_at)
SELECT gen_random_uuid(), p.id, 'setup', 80000, 100000, 150000, now()
FROM products p JOIN apps a ON p.app_id = a.id
WHERE a.slug = 'fxl-financiero' AND p.slug = 'fxl-financiero-core'
ON CONFLICT (product_id, component) DO NOTHING;
--> statement-breakpoint

-- Monthly component: min=R$80,00 / list=R$107,00 / max=R$200,00
INSERT INTO price_bands (id, product_id, component, min_brl, list_brl, max_brl, created_at)
SELECT gen_random_uuid(), p.id, 'monthly', 8000, 10700, 20000, now()
FROM products p JOIN apps a ON p.app_id = a.id
WHERE a.slug = 'fxl-financiero' AND p.slug = 'fxl-financiero-core'
ON CONFLICT (product_id, component) DO NOTHING;
--> statement-breakpoint

-- ── commission_rules — setup 30% (one-time), recurring 20% × 12 months ──
-- PLACEHOLDER (D2): rates are sane defaults — confirm with stakeholders before go-live.
INSERT INTO commission_rules (id, product_id, setup_rate_pct, recurring_rate_pct, recurring_months, created_at)
SELECT gen_random_uuid(), p.id, 30.00, 20.00, 12, now()
FROM products p JOIN apps a ON p.app_id = a.id
WHERE a.slug = 'fxl-financiero' AND p.slug = 'fxl-financiero-core'
ON CONFLICT (product_id) DO NOTHING;
