#!/usr/bin/env node
// perf-audit.mjs — FXL performance budget gate (template stub)
//
// This stub exits 0 unconditionally. Real audit rules ship in client projects
// after they fill in domain-specific code paths (see docs/perf-methodology.md
// in the source project 1-fxl-financeiro for the full rule catalogue).
//
// To bypass in emergency (after rules are wired), the commit message MUST include:
//   Perf-Audit-Bypass: <reason>

const args = process.argv.slice(2);
const isChangedOnly = args.includes('--changed');

if (process.env.FXL_TEMPLATE === '1') {
  console.log('perf-audit: template stub (FXL_TEMPLATE=1) — skipping');
  process.exit(0);
}

console.log(`perf-audit: stub (${isChangedOnly ? '--changed' : 'full'}) — no rules wired yet`);
console.log('perf-audit: ok');
process.exit(0);
