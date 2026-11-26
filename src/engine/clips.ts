// Animation clips placed on the story timeline, blended deterministically.

export interface ClipSegment {
  clip: string;
  /** Story time the clip starts. It plays until the next segment takes over. */
  at: number;
  /** Cross-fade length into this clip (seconds). */
  fade?: number;
  /** Loops repeat; one-shots hold their last frame. Defaults to true for names ending in _Loop. */
  loop?: boolean;
  speed?: number;
}

export interface ClipSample { clip: string; time: number; weight: number; loop: boolean }

/**
 * Turns a list of segments into clip times + weights for any moment.
 * Loops run on idle time (so a character keeps breathing while the story waits for
 * the viewer); one-shots run on story time.
 */
export class ClipTrack {
  segs: Required<ClipSegment>[];
  constructor(segments: ClipSegment[]) {
    this.segs = [...segments].sort((a, b) => a.at - b.at).map((s) => ({
      fade: 0.35, speed: 1, loop: s.clip.endsWith('_Loop'), ...s,
    }));
  }
  sample(t: number, idle: number): ClipSample[] {
    const out: ClipSample[] = [];
    const ramp = (x: number, a: number, f: number) => (f <= 0 ? (x >= a ? 1 : 0) : Math.min(1, Math.max(0, (x - a) / f)));
    for (let i = 0; i < this.segs.length; i++) {
      const s = this.segs[i], next = this.segs[i + 1];
      if (t < s.at && i > 0) break;
      const wIn = i === 0 ? 1 : ramp(t, s.at, s.fade);
      const wOut = next ? 1 - ramp(t, next.at, next.fade) : 1;
      const w = wIn * wOut;
      if (w <= 0) continue;
      const local = s.loop ? (idle - s.at) * s.speed : Math.max(0, t - s.at) * s.speed;
      out.push({ clip: s.clip, time: local, weight: w, loop: s.loop });
    }
    const total = out.reduce((a, b) => a + b.weight, 0) || 1;
    out.forEach((o) => (o.weight /= total));
    return out;
  }
}
