import { gsap } from 'gsap';

/**
 * Story beats on a GSAP timeline that never plays by itself: the player seeks it
 * to story time every frame, so the same tweens drive live playback and export.
 *
 *   const b = beats({ reach: 0, glow: 0 }, (tl, s) => {
 *     tl.fromTo(s, { reach: 0 }, { reach: 1, duration: 1.2, ease: 'sine.inOut' }, 20);
 *   });
 *   const s = b.at(t);   // s.reach, s.glow
 *
 * Use fromTo (not to) so every tween's start value is explicit and seeking to any
 * time, in any order, gives the same answer.
 */
export function beats<T extends Record<string, number>>(initial: T, build: (tl: gsap.core.Timeline, s: T) => void) {
  const state = { ...initial };
  const tl = gsap.timeline({ paused: true, defaults: { immediateRender: false } });
  build(tl, state);
  // play the whole timeline through once so every tween has recorded its values
  tl.seek(tl.duration(), true);
  tl.seek(0, true);
  return {
    state,
    timeline: tl,
    at(t: number): Readonly<T> {
      tl.seek(t, true);
      return state;
    },
  };
}
