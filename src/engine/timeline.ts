// Keyframes as data. Everything here is a pure function of time, which is what
// makes a story render identically live and in the frame-by-frame export.

export const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const smoothstep = (a: number, b: number, x: number) => {
  const k = clamp((x - a) / (b - a));
  return k * k * (3 - 2 * k);
};
/** 0 before a, 1 after b, eased in between. */
export const progress = (t: number, a: number, b: number, ease: (k: number) => number = easing.inOutSine) => ease(clamp((t - a) / (b - a)));
/** Rises over [a, a+fade], holds, falls over [b-fade, b]. */
export const pulse = (t: number, a: number, b: number, fade = 0.5) =>
  Math.min(smoothstep(a, a + fade, t), 1 - smoothstep(b - fade, b, t));

export type Ease = keyof typeof easing;
export const easing: Record<string, (k: number) => number> = {
  linear: (k) => k,
  inOutSine: (k) => -(Math.cos(Math.PI * k) - 1) / 2,
  inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
  outCubic: (k) => 1 - Math.pow(1 - k, 3),
  inCubic: (k) => k * k * k,
  outBack: (k) => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2),
};

/**
 * Scalar or vector keyframe track: [{ t, v, ease? }]. `ease` names the curve used
 * to arrive at that key. Values may be numbers or arrays of numbers.
 */
export type Key<V> = { t: number; v: V; ease?: string; hold?: boolean };

export class Track<V extends number | number[]> {
  keys: Key<V>[];
  constructor(keys: Key<V>[]) {
    this.keys = [...keys].sort((a, b) => a.t - b.t);
  }
  sample(t: number): V {
    const k = this.keys;
    if (t <= k[0].t) return k[0].v;
    if (t >= k[k.length - 1].t) return k[k.length - 1].v;
    let i = 0;
    while (t > k[i + 1].t) i++;
    const a = k[i], b = k[i + 1];
    const e = easing[b.ease || 'inOutSine'](clamp((t - a.t) / (b.t - a.t)));
    if (typeof a.v === 'number') return lerp(a.v, b.v as number, e) as V;
    return (a.v as number[]).map((x, j) => lerp(x, (b.v as number[])[j], e)) as V;
  }
}

/**
 * Smooth vector track for cameras: cubic Hermite through every key with
 * Catmull-Rom tangents scaled for uneven key spacing, so velocity is continuous
 * (no stop-start at keys). First and last keys ease in and out.
 */
export class SplineTrack {
  keys: Key<number[]>[];
  constructor(keys: Key<number[]>[]) {
    this.keys = [...keys].sort((a, b) => a.t - b.t);
  }
  sample(t: number): number[] {
    const k = this.keys, n = k.length;
    if (t <= k[0].t) return k[0].v.slice();
    if (t >= k[n - 1].t) return k[n - 1].v.slice();
    let i = 0;
    while (t > k[i + 1].t) i++;
    const p0 = k[i], p1 = k[i + 1];
    const dt = p1.t - p0.t;
    const tangent = (j: number): number[] => {
      if (j === 0 || j === n - 1 || k[j].hold) return k[j].v.map(() => 0);
      const a = k[j - 1], b = k[j + 1];
      return k[j].v.map((_, d) => (b.v[d] - a.v[d]) / (b.t - a.t));
    };
    const m0 = tangent(i), m1 = tangent(i + 1);
    const u = (t - p0.t) / dt, u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    return p0.v.map((x, d) => h00 * x + h10 * dt * m0[d] + h01 * p1.v[d] + h11 * dt * m1[d]);
  }
}
