import type { NextRequest } from 'next/server';
import { handleReferralClick } from '../../../lib/click-handler';
import { checkRateLimit } from '../../../lib/rate-limit';

// Node.js runtime (NOT Edge) — needs Node crypto (HMAC/sha256) + postgres-js (D13).
export const runtime = 'nodejs';
// Always evaluate per-request (telemetry write + redirect).
export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> },
): Promise<Response> {
  const { code } = await params;

  // Per-IP + per-code rate limit (T07). Degrades gracefully (no-op) when Upstash
  // is not configured locally — never crashes the redirect.
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('cf-connecting-ip') ??
    '127.0.0.1';
  const rate = await checkRateLimit(ip, code);
  if (!rate.allowed) {
    return new Response('Too Many Requests', {
      status: 429,
      headers: {
        'Retry-After': String(rate.retryAfter ?? 60),
        'Content-Type': 'text/plain',
      },
    });
  }

  return handleReferralClick(code, request);
}
