import { createContext, useContext } from 'react';
import { useFrame, type RootState } from '@react-three/fiber';
import type * as THREE from 'three';

/** What a story sees each frame. Everything visible must be a pure function of this. */
export interface FrameState {
  /** Story time in seconds. Holds at an interactive beat until the viewer acts. */
  t: number;
  /** Time that never stops (loops, breathing, drifting fireflies). Equals `t` in export. */
  idle: number;
  /** True in the browser, false while rendering frames for export. */
  live: boolean;
}

export class StoryClock implements FrameState {
  t = 0;
  idle = 0;
  live = true;
  private listeners = new Set<(s: FrameState) => void>();
  /** DOM overlays subscribe here so they update in the same tick as the canvas. */
  subscribe(fn: (s: FrameState) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  emit() { this.listeners.forEach((fn) => fn(this)); }
  /** Work the scene must finish before the film can start (e.g. a light bake). */
  pending: Promise<unknown>[] = [];
  waitFor(p: Promise<unknown>) { this.pending.push(p); }
  /** Named objects the viewer can click during a `wait` cue. */
  targets = new Map<string, THREE.Object3D>();
}

export const ClockContext = createContext<StoryClock | null>(null);
export function useClock() {
  const c = useContext(ClockContext);
  if (!c) throw new Error('useClock must be used inside <Player>');
  return c;
}

/**
 * Per-frame story hook. Use this instead of useFrame and never read real time or
 * frame deltas: pose everything from `s.t` / `s.idle` so export frames are exact.
 */
export function useStoryFrame(cb: (s: FrameState, three: RootState) => void, priority = 0) {
  const clock = useClock();
  useFrame((three) => cb(clock, three), priority);
}

/** Register an object the viewer can click during a `wait` cue with this target name. */
export function useHitTarget(name: string, obj: THREE.Object3D | null | undefined) {
  const clock = useClock();
  if (obj) clock.targets.set(name, obj);
}
