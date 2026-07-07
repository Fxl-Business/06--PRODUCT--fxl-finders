import { eq } from 'drizzle-orm';
import { ulid } from 'ulidx';
import { dailySalt, hashIp, signReferralUrl } from '@fxl-sales/shared-utils';
import { getDb } from '../../db/client.js';
import { apps, clicks, referralLinks } from '../../db/schema.js';
import { classifyUa } from './ua-family.js';

const COOKIE_MAX_AGE = 7776000;

function htmlResponse(status: number, title: string, message: string): Response {
  return new Response(
    `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title}</title></head>` +
      `<body style="font-family:system-ui;text-align:center;padding:4rem"><h1>${title}</h1><p>${message}</p></body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

function hostAllowed(destinationUrl: string, allowedHosts: string[]): boolean {
  const host = new URL(destinationUrl).host;
  return allowedHosts.some((entry) => host === entry);
}

export async function handleReferralClick(code: string, request: Request): Promise<Response> {
  const db = getDb();

  const rows = await db
    .select({
      id: referralLinks.id,
      orgId: referralLinks.orgId,
      finderId: referralLinks.finderId,
      appId: referralLinks.appId,
      productId: referralLinks.productId,
      signature: referralLinks.signature,
      destinationUrl: referralLinks.destinationUrl,
      status: referralLinks.status,
      expiresAt: referralLinks.expiresAt,
      revokedAt: referralLinks.revokedAt,
      webhookSigningSecret: apps.webhookSigningSecret,
      allowedRedirectHosts: apps.allowedRedirectHosts,
    })
    .from(referralLinks)
    .innerJoin(apps, eq(referralLinks.appId, apps.id))
    .where(eq(referralLinks.code, code))
    .limit(1);

  const link = rows[0];

  if (!link) {
    return htmlResponse(410, 'Link invalido', 'Este link de indicacao nao existe.');
  }

  if (link.revokedAt !== null || link.status === 'revoked') {
    return htmlResponse(410, 'Link invalido', 'Este link de indicacao foi revogado.');
  }

  if (link.expiresAt !== null && link.expiresAt < new Date()) {
    return htmlResponse(410, 'Link expirado', 'Este link de indicacao expirou.');
  }

  let destinationIsAllowed: boolean;
  try {
    destinationIsAllowed = hostAllowed(link.destinationUrl, link.allowedRedirectHosts);
  } catch {
    destinationIsAllowed = false;
  }

  if (!destinationIsAllowed) {
    console.error(`[r/${code}] destination host not allowed or unparseable: ${link.destinationUrl}`);
    return htmlResponse(500, 'Erro de configuracao', 'Nao foi possivel processar este link.');
  }

  const clickId = ulid();
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('cf-connecting-ip') ??
    'unknown';
  const salt = dailySalt(new Date(), process.env.HASH_SALT_SECRET ?? 'dev_salt');
  const ipHash = hashIp(ip, salt);
  const url = new URL(request.url);

  await db.insert(clicks).values({
    clickId,
    orgId: link.orgId,
    linkId: link.id,
    finderId: link.finderId,
    appId: link.appId,
    productId: link.productId,
    ipHash,
    uaFamily: classifyUa(request.headers.get('user-agent')),
    referer: request.headers.get('referer') ?? null,
    utmSource: url.searchParams.get('utm_source'),
    utmMedium: url.searchParams.get('utm_medium'),
    utmCampaign: url.searchParams.get('utm_campaign'),
    country: request.headers.get('cf-ipcountry') ?? null,
  });

  const fxlSig = signReferralUrl(link.webhookSigningSecret, clickId, link.signature);
  const redirectUrl =
    link.destinationUrl +
    '?ref=' +
    encodeURIComponent(clickId) +
    '&fxl_sig=' +
    encodeURIComponent(fxlSig);

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectUrl,
      'Set-Cookie': `fxl_ref=${clickId}; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}; Path=/`,
    },
  });
}
