/**
 * Small date helpers. For anything non-trivial, use date-fns in the consuming app.
 */

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function fromISODate(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

export function formatPtBR(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR').format(d);
}
