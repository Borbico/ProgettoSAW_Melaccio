export function clampNumber(value: unknown, min: number, max: number): number {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(numericValue)));
}

export function normalizeIsoDate(value: unknown): string {
  const date = String(value ?? '').trim();

  return Number.isNaN(Date.parse(date)) ? '' : date;
}

export function updatedAtTime(value: { updatedAt?: string } | string): number {
  const date = typeof value === 'string' ? value : value.updatedAt;
  const time = Date.parse(date ?? '');

  return Number.isNaN(time) ? 0 : time;
}
