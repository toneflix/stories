import { FLOORS, level, PLINTH, STAIR, STAIR_STEPS, STOREY } from './block';
import { FRONT, ROAD } from './street';

// The height of the walkable surface anywhere in the set, for feet and for anything that
// walks: the road, kerbs and pavements, the plinth step, and the stairwells of both blocks.

const RISE = STOREY / 2 / STAIR_STEPS, RUN = (STAIR.front - STAIR.back) / STAIR_STEPS;

/** Surface height at world (x, z); `near` picks the storey when surfaces stack (stairs, floors). */
export function groundAt(x: number, z: number, near = 0): number {
  const az = Math.abs(z);
  if (az < ROAD) return 0;
  if (az < FRONT - PLINTH) return az < ROAD + 0.85 ? 0.18 : 0.15;
  if (az < FRONT) return PLINTH;
  // inside a block, in its own frame (B is turned to face A)
  const lx = z < 0 ? x : -x, lz = z < 0 ? z + FRONT : FRONT - z;
  const S = STAIR;
  const inStair = lx > S.x0 && lx < S.x1 && lz > S.z0 && lz < S.z1;
  const f = Math.min(FLOORS - 1, Math.max(0, Math.round((near - PLINTH) / STOREY - 0.25)));
  if (!inStair) return level(Math.max(0, Math.round((near - PLINTH) / STOREY)));
  let best = -Infinity;
  for (const g of [f - 1, f, f + 1]) {
    if (g < 0 || g >= FLOORS) continue;
    const y = level(g);
    const surfaces = [lz > S.front ? y : -Infinity, lz < S.back && g < FLOORS - 1 ? y + STOREY / 2 : -Infinity];
    if (g < FLOORS - 1 && lz >= S.back && lz <= S.front) {
      const i = Math.min(STAIR_STEPS - 1, Math.floor((S.front - lz) / RUN));
      const j = Math.min(STAIR_STEPS - 1, Math.floor((lz - S.back) / RUN));
      // up towards the back on the left of the rail, on up towards the front on the right
      surfaces.push(lx < S.split ? y + RISE * (i + 1) : y + STOREY / 2 + RISE * (j + 1));
    }
    for (const h of surfaces) if (h <= near + 0.6 && h > best) best = h;
  }
  return best === -Infinity ? level(f) : best;
}
