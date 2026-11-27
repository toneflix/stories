import { synth, synthLoop } from '../../engine/audio';
import { rng } from '../../engine/random';

// All sound is made in code: a night bed of crickets, a far-off generator and a low
// drone, plus the switch, the lamp's click, a clock's tick, the street door and a door creak.

function noiseBuffer(ctx: BaseAudioContext, seconds: number, seed = 1) {
  const r = rng(seed), b = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
  return b;
}

/** 24-second night loop. */
export function ambience() {
  const len = 24;
  return synthLoop(len, 3, (ctx) => {
    const r = rng(9);
    // crickets: bursts of a high tone, in a few voices
    for (const [f, rate, gain] of [[4300, 0.42, 0.012], [4720, 0.57, 0.009], [3900, 0.83, 0.007]]) {
      for (let t = r() * rate; t < len; t += rate * (0.9 + r() * 0.2)) {
        for (let k = 0; k < 3; k++) {
          const at = t + k * 0.045, o = ctx.createOscillator(), g = ctx.createGain();
          o.frequency.value = f;
          g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(gain, at + 0.006); g.gain.linearRampToValueAtTime(0, at + 0.03);
          o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + 0.035);
        }
      }
    }
    // a neighbourhood generator, far off: low hum through a wall
    const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = 50; lp.type = 'lowpass'; lp.frequency.value = 160; g.gain.value = 0.05;
    o.connect(lp).connect(g).connect(ctx.destination); o.start(0); o.stop(len);
    // wind and city hush
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, len, 4);
    const bp = ctx.createBiquadFilter(), ng = ctx.createGain(); bp.type = 'lowpass'; bp.frequency.value = 400; ng.gain.value = 0.05;
    n.connect(bp).connect(ng).connect(ctx.destination); n.start(0);
    // an uneasy drone: two close tones
    for (const fq of [110, 110.7, 164.8]) {
      const d = ctx.createOscillator(), dg = ctx.createGain();
      d.type = 'sine'; d.frequency.value = fq; dg.gain.value = 0.018;
      d.connect(dg).connect(ctx.destination); d.start(0); d.stop(len);
    }
  });
}

export async function effects() {
  const tap = (ctx: BaseAudioContext, at: number, f: number, gain: number, len = 0.03) => {
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, len + 0.02, Math.round(f));
    const bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 3;
    g.gain.setValueAtTime(gain, at); g.gain.exponentialRampToValueAtTime(0.001, at + len);
    n.connect(bp).connect(g).connect(ctx.destination); n.start(at);
  };
  const switch_ = await synth(0.3, (ctx) => { tap(ctx, 0, 2500, 0.6); tap(ctx, 0.02, 900, 0.4, 0.05); });
  const click = await synth(0.3, (ctx) => { tap(ctx, 0, 1800, 0.35); tap(ctx, 0.03, 600, 0.2, 0.06); });
  const tick = await synth(0.2, (ctx) => tap(ctx, 0, 3200, 0.3, 0.02));
  // the street door: a steel latch and a rattle
  const gate = await synth(1.2, (ctx) => {
    tap(ctx, 0, 1400, 0.5, 0.08);
    for (let i = 0; i < 6; i++) tap(ctx, 0.1 + i * 0.05, 800 + i * 90, 0.2 * (1 - i / 6), 0.05);
  });
  // a hinge that hasn't moved in months
  const creak = await synth(1.8, (ctx) => {
    const o = ctx.createOscillator(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, 0);
    for (let i = 1; i < 14; i++) o.frequency.linearRampToValueAtTime(170 + Math.sin(i * 1.7) * 60 + i * 6, i * 0.12);
    bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 4;
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.18, 0.15); g.gain.setValueAtTime(0.18, 1.3); g.gain.linearRampToValueAtTime(0, 1.7);
    o.connect(bp).connect(g).connect(ctx.destination); o.start(0); o.stop(1.75);
  });
  return { switch: switch_, click, tick, gate, creak };
}
