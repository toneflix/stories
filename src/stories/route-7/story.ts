import { defineStory, publicUrl } from '../../engine/types';
import { Scene } from './Scene';
import { CUES, DURATION } from './script';
import { music, effects } from './sound';

export default defineStory({
  id: 'route-7',
  title: 'Route 7, Still Running',
  subtitle: 'A Toneflix Story',
  duration: DURATION,
  aspect: 9 / 16,
  cues: CUES,
  card: { from: 99.5, to: 109.5, title: 'Route 7, Still Running', byline: 'A Toneflix Story' },
  narration: publicUrl('stories/route-7/narration'),
  camera: { fov: 46 },
  Scene,
  sounds: async () => ({ music: await music(), sfx: await effects() }),
});
