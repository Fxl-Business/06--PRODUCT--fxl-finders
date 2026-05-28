/**
 * Finder domain types (Phase 04). Mirror the API response shapes from
 * apps/api/src/domains/links/service.ts + apps/api/src/domains/finder/routes.ts.
 */

export type ReferralLinkStatus = 'active' | 'revoked';

export interface ReferralLink {
  id: string;
  orgId: string;
  code: string;
  finderId: string;
  appId: string;
  productId: string;
  quotedSetupBrl: number;
  quotedMonthlyBrl: number;
  signature: string;
  destinationUrl: string;
  status: ReferralLinkStatus;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateLinkBody {
  appId: string;
  productId: string;
  quotedSetupBrl: number;
  quotedMonthlyBrl: number;
}

export interface FinderApp {
  id: string;
  name: string;
  slug: string;
}

export interface PriceBandSummary {
  minBrl: number;
  listBrl: number;
  maxBrl: number;
}

export interface FinderProduct {
  id: string;
  name: string;
  slug: string;
  setupBand: PriceBandSummary | null;
  monthlyBand: PriceBandSummary | null;
}

export interface ClickRow {
  id: string;
  clickId: string;
  orgId: string;
  linkId: string;
  finderId: string;
  appId: string;
  productId: string;
  ipHash: string | null;
  uaFamily: string | null;
  referer: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  country: string | null;
  createdAt: string;
}

export interface ClickStats {
  total: number;
  unique: number;
}
