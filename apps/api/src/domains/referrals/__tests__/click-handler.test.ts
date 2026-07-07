import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let selectResult: unknown[] = [];
const insertValues = vi.fn().mockResolvedValue(undefined);
let consoleError: ReturnType<typeof vi.spyOn>;

vi.mock('../../../db/client.js', () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            limit: () => Promise.resolve(selectResult),
          }),
        }),
      }),
    }),
    insert: () => ({ values: insertValues }),
  }),
}));

vi.mock('../../../db/schema.js', () => ({
  apps: {},
  clicks: {},
  referralLinks: {
    appId: 'appId',
    id: 'id',
    orgId: 'orgId',
    finderId: 'finderId',
    productId: 'productId',
    signature: 'signature',
    destinationUrl: 'destinationUrl',
    status: 'status',
    expiresAt: 'expiresAt',
    revokedAt: 'revokedAt',
    code: 'code',
  },
}));

vi.mock('@fxl-sales/shared-utils', () => ({
  signReferralUrl: () => 'fxlsig_mocked',
  hashIp: () => 'iphash_mocked',
  dailySalt: () => 'salt_mocked',
}));

vi.mock('drizzle-orm', () => ({
  eq: () => 'eq',
}));

vi.mock('ulidx', () => ({ ulid: () => '01HXTESTCLICKID0000000000' }));

const { handleReferralClick } = await import('../click-handler.js');

const ACTIVE_LINK = {
  id: 'link-uuid',
  orgId: 'org_a',
  finderId: 'finder-uuid',
  appId: 'app-uuid',
  productId: 'product-uuid',
  signature: 'linksig',
  destinationUrl: 'https://checkout.example.com/precos',
  status: 'active',
  expiresAt: null as Date | null,
  revokedAt: null as Date | null,
  webhookSigningSecret: 'whs_secret',
  allowedRedirectHosts: ['checkout.example.com'],
};

function req(): Request {
  return new Request('https://finders.example.com/r/abc123', {
    headers: { 'user-agent': 'Mozilla/5.0 Chrome/120.0' },
  });
}

beforeEach(() => {
  insertValues.mockClear();
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  selectResult = [];
});

afterEach(() => {
  consoleError.mockRestore();
  vi.clearAllMocks();
});

describe('handleReferralClick', () => {
  it('returns 410 when the code is not found', async () => {
    const res = await handleReferralClick('nope', req());
    expect(res.status).toBe(410);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('returns 410 for revoked links', async () => {
    selectResult = [{ ...ACTIVE_LINK, status: 'revoked', revokedAt: new Date() }];
    const res = await handleReferralClick('abc123', req());
    expect(res.status).toBe(410);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('returns 410 for expired links', async () => {
    selectResult = [{ ...ACTIVE_LINK, expiresAt: new Date(Date.now() - 1000) }];
    const res = await handleReferralClick('abc123', req());
    expect(res.status).toBe(410);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('returns 500 for destination hosts outside the allowlist', async () => {
    selectResult = [{ ...ACTIVE_LINK, allowedRedirectHosts: ['other.example.com'] }];
    const res = await handleReferralClick('abc123', req());
    expect(res.status).toBe(500);
    expect(insertValues).not.toHaveBeenCalled();
  });

  it('returns 500 for unparseable destination URLs', async () => {
    selectResult = [{ ...ACTIVE_LINK, destinationUrl: 'not-a-url' }];
    const res = await handleReferralClick('abc123', req());
    expect(res.status).toBe(500);
  });

  it('redirects valid active links and inserts the click before redirecting', async () => {
    selectResult = [{ ...ACTIVE_LINK }];
    const res = await handleReferralClick('abc123', req());

    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toContain('https://checkout.example.com/precos');
    expect(res.headers.get('Location')).toContain('ref=01HXTESTCLICKID0000000000');
    expect(res.headers.get('Location')).toContain('fxl_sig=fxlsig_mocked');
    expect(res.headers.get('Set-Cookie')).toContain('fxl_ref=01HXTESTCLICKID0000000000');
    expect(res.headers.get('Set-Cookie')).toContain('HttpOnly');
    expect(res.headers.get('Set-Cookie')).toContain('Secure');
    expect(res.headers.get('Set-Cookie')).toContain('SameSite=Lax');
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=7776000');

    expect(insertValues).toHaveBeenCalledTimes(1);
    const inserted = insertValues.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(inserted.clickId).toBe('01HXTESTCLICKID0000000000');
    expect(inserted.orgId).toBe('org_a');
    expect(inserted.uaFamily).toBe('chrome');
  });
});
