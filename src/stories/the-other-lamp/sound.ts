import { loadSounds } from '../../engine/audio';
import { publicUrl } from '../../engine/types';

// Recorded sound (CC0 field recordings from FSD50K, see assets/CREDITS.md): a night of
// crickets with a generator far off, a wall switch, a lamp's switch, a clock, the street
// door and an old door.

const sound = (name: string) => publicUrl(`assets/sounds/${name}.mp3`);

export async function sounds() {
  const s = await loadSounds({
    night: sound('night-crickets'), switch: sound('light-switch'), click: sound('lamp-switch'),
    tick: sound('clock-tick'), gate: sound('street-door'), creak: sound('door-creak'),
  }, ['night']);
  const { night, ...sfx } = s;
  return { music: night, sfx };
}
