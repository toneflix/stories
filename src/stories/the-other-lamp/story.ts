import { defineStory, publicUrl } from '../../engine/types';
import { Scene } from './Scene';
import { CUES, DURATION } from './script';
import { ambience, effects } from './sound';

export default defineStory({
  id: 'the-other-lamp',
  title: 'The Other Lamp',
  subtitle: 'A Toneflix Story',
  duration: DURATION,
  aspect: 9 / 16,
  cues: CUES,
  narration: publicUrl('stories/the-other-lamp/narration'),
  card: { from: 103.5, to: 108, title: 'The Other Lamp', byline: 'A Toneflix Story' },
  camera: { fov: 40, near: 0.05 },
  Scene,
  sounds: async () => ({ music: await ambience(), sfx: await effects() }),
});
