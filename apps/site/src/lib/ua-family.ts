/**
 * Inline UA-family classifier (Phase 04, D6). No dependency.
 *
 * Ordered checks so browsers whose UA also contains 'Chrome' (Edge, Opera) are
 * NOT misclassified as Chrome: bot → edge → opera → firefox → safari-not-chrome
 * → chrome → unknown. Defaults to 'unknown' for null/empty/unrecognized.
 */
export function classifyUa(userAgent: string | null): string {
  if (!userAgent) {
    return 'unknown';
  }
  const ua = userAgent.toLowerCase();

  if (/bot|crawler|spider|slurp|facebookexternalhit/.test(ua)) {
    return 'bot';
  }
  if (ua.includes('edg')) {
    return 'edge';
  }
  if (ua.includes('opr') || ua.includes('opera')) {
    return 'opera';
  }
  if (ua.includes('firefox')) {
    return 'firefox';
  }
  if (ua.includes('safari') && !ua.includes('chrome')) {
    return 'safari';
  }
  if (ua.includes('chrome')) {
    return 'chrome';
  }
  return 'unknown';
}
