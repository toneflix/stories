import { defineStory, publicUrl } from '../../engine/types';
import { Scene } from './Scene';
import { CUES, DURATION } from './script';
import { music, effects } from './music';

export default defineStory({
  id: 'lantern-keeper',
  title: 'The Lantern Keeper',
  subtitle: 'A Toneflix Story',
  duration: DURATION,
  aspect: 9 / 16,
  cues: CUES,
  card: { from: 37, to: 44, title: 'The Lantern Keeper', byline: 'A Toneflix Story' },
  narration: publicUrl('stories/lantern-keeper/narration'),
  camera: { fov: 50 },
  Scene,
  sounds: async () => ({ music: await music(), sfx: await effects() }),
});
