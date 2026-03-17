export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

export function max(values: number[]): number {
  if (values.length === 0) return 0;
  let m = -Infinity;
  for (const v of values) if (v > m) m = v;
  return Number.isFinite(m) ? m : 0;
}

export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  let sumSq = 0;
  for (const v of values) {
    const d = v - m;
    sumSq += d * d;
  }
  return Math.sqrt(sumSq / (values.length - 1));
}

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

