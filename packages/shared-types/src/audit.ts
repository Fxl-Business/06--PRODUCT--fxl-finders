/**
 * Audit action registry. Every action that writes to the audit log MUST be
 * registered here first. The audit() writer rejects unregistered actions
 * at compile-time and runtime.
 *
 * Add actions under their domain namespace:
 *   org.*               — per-org actions
 *   admin.*             — admin (cross-org) actions
 *   user.*              — user-level actions
 */
export const AUDIT_ACTIONS = [
  // Placeholder — extend per project
  'org.placeholder.created',
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export function isAuditAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}
