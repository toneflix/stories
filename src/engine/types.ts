import type { ComponentType } from 'react';

/** Obi's rule: every story runs under 3:33. */
export const MAX_DURATION = 3 * 60 + 33;

export type Cue =
  /** Play narration line `id` from the story's narration manifest. Subtitles follow. */
  | { at: number; type: 'voice'; id: string }
  /** Play a sound effect returned by `StoryDefinition.sounds()`. */
  | { at: number; type: 'sfx'; id: string }
  /**
   * Interactive beat. Live: story time holds here until the viewer clicks the object
   * registered as `target` (see useHitTarget) or presses Space. Export: plays straight
   * through, so write the script as if the viewer acted at once.
   */
  | { at: number; type: 'wait'; target: string; prompt: string };

export interface StoryDefinition {
  id: string;
  title: string;
  subtitle?: string;
  /** Seconds. Must be under MAX_DURATION (3:33). */
  duration: number;
  /** Width / height. Default 9/16 (vertical). */
  aspect?: number;
  cues: Cue[];
  /** Title card shown over the picture. */
  card?: { from: number; to: number; title: string; byline?: string };
  fadeIn?: number;
  fadeOut?: number;
  /**
   * URL folder holding a narration manifest.json and clips (voice-only narrator).
   * Leave out for stories without narration.
   */
  narration?: string;
  camera?: { fov?: number; near?: number; far?: number };
  /** The 3D world. Pose everything with useStoryFrame. */
  Scene: ComponentType;
  /** Music bed (looped) and named sound effects, usually synthesised in code. */
  sounds?: () => Promise<{ music?: AudioBuffer; sfx?: Record<string, AudioBuffer> }>;
}

export function defineStory(def: StoryDefinition): StoryDefinition {
  if (def.duration > MAX_DURATION)
    throw new Error(`${def.id}: ${def.duration}s is over the ${MAX_DURATION}s (3:33) limit`);
  const late = def.cues.find((c) => c.at > def.duration);
  if (late) throw new Error(`${def.id}: cue at ${late.at}s is after the end (${def.duration}s)`);
  return { aspect: 9 / 16, fadeIn: 1.5, fadeOut: 2, ...def };
}

/**
 * URL of a file in public/, from a story page at stories/<id>/. Works in dev, in the
 * built site and under a sub-path (GitHub Pages). A page hosted elsewhere can point at
 * the site root with <meta name="tf-root" content="...">.
 */
export const publicUrl = (path: string) => {
  const root = document.querySelector('meta[name="tf-root"]')?.getAttribute('content') ?? '../../';
  return new URL(`${root}${path}`, location.href).href;
};
