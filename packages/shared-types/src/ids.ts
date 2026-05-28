/**
 * Branded ID types — prevents accidental cross-domain ID mixups at compile time.
 *
 * Usage:
 *   const userId: UserId = 'user_123' as UserId;
 *   function fetchOrg(id: OrgId) { ... }
 */
export type Brand<T, B> = T & { readonly __brand: B };

export type UserId = Brand<string, 'UserId'>;
export type OrgId = Brand<string, 'OrgId'>;

export const asUserId = (s: string): UserId => s as UserId;
export const asOrgId = (s: string): OrgId => s as OrgId;
