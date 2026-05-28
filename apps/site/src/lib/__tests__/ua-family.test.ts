import { describe, expect, it } from 'vitest';
import { classifyUa } from '../ua-family';

describe('classifyUa — every branch (plan-brief WARN)', () => {
  it('classifies bots/crawlers', () => {
    expect(classifyUa('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toBe(
      'bot',
    );
    expect(classifyUa('facebookexternalhit/1.1')).toBe('bot');
  });

  it('classifies Edge BEFORE chrome (Edge UA also contains Chrome)', () => {
    const edge =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 Edg/120.0';
    expect(classifyUa(edge)).toBe('edge');
  });

  it('classifies Opera BEFORE chrome', () => {
    const opera =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36 OPR/106.0';
    expect(classifyUa(opera)).toBe('opera');
  });

  it('classifies Firefox', () => {
    expect(classifyUa('Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0')).toBe(
      'firefox',
    );
  });

  it('classifies Safari that does NOT contain chrome', () => {
    const safari =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
    expect(classifyUa(safari)).toBe('safari');
  });

  it('classifies Chrome', () => {
    const chrome =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
    expect(classifyUa(chrome)).toBe('chrome');
  });

  it('returns unknown for null and empty', () => {
    expect(classifyUa(null)).toBe('unknown');
    expect(classifyUa('')).toBe('unknown');
  });

  it('returns unknown for an unrecognized UA', () => {
    expect(classifyUa('SomeRandomClient/1.0')).toBe('unknown');
  });
});
