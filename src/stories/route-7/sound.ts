import { synth, synthLoop } from '../../engine/audio';
import { rng } from '../../engine/random';

// All sound is made in code: a slow highlife guitar over a warm pad for the bed,
// plus the bus's horn, door, brakes and the coin. Swap in recordings any time.

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function noiseBuffer(ctx: BaseAudioContext, seconds: number, seed = 1) {
  const r = rng(seed), b = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
  return b;
}

/** Feedback delay used as a small room. */
function room(ctx: BaseAudioContext, out: AudioNode, wetLevel = 0.35) {
  const input = ctx.createGain();
  const l = ctx.createDelay(1), r = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
  l.delayTime.value = 0.23; r.delayTime.value = 0.37; fb.gain.value = 0.35; lp.type = 'lowpass'; lp.frequency.value = 2200;
  const merger = ctx.createChannelMerger(2), wet = ctx.createGain(); wet.gain.value = wetLevel;
  input.connect(out);
  input.connect(l); l.connect(lp); lp.connect(r); r.connect(fb); fb.connect(l);
  l.connect(merger, 0, 0); r.connect(merger, 0, 1); merger.connect(wet).connect(out);
  return input;
}

/** A plucked string (Karplus-Strong), rendered into a buffer once per note. */
function pluck(ctx: BaseAudioContext, out: AudioNode, midi: number, at: number, gain: number, seed: number) {
  const sr = ctx.sampleRate, n = Math.ceil(sr * 1.6), period = Math.round(sr / hz(midi));
  const buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0), r = rng(seed);
  const ring = new Float32Array(period);
  for (let i = 0; i < period; i++) ring[i] = r() * 2 - 1;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const j = i % period, v = 0.5 * (ring[j] + ring[(j + 1) % period]) * 0.996;
    ring[j] = v;
    d[i] = (v + prev) * 0.5;
    prev = v;
  }
  const src = ctx.createBufferSource(), g = ctx.createGain(), tone = ctx.createBiquadFilter();
  src.buffer = buf; g.gain.value = gain; tone.type = 'lowpass'; tone.frequency.value = 2600;
  src.connect(tone).connect(g).connect(out);
  src.start(at);
}

function pad(ctx: BaseAudioContext, out: AudioNode, notes: number[], start: number, len: number, gain = 0.03) {
  for (const n of notes) for (const det of [-5, 4]) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = hz(n); o.detune.value = det;
    f.type = 'lowpass'; f.frequency.value = 900;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 1.5);
    g.gain.setValueAtTime(gain, start + len - 0.4);
    g.gain.linearRampToValueAtTime(0, start + len + 1.5);
    o.connect(f).connect(g).connect(out);
    o.start(start); o.stop(start + len + 1.6);
  }
}

/**
 * 32-second loop in G major at 84 bpm: G – C – D – G with a lilting two-guitar
 * highlife pattern, a soft bass and shaker.
 */
export function music() {
  const beat = 60 / 84, bar = beat * 4, bars = 8, len = bars * bar;
  return synthLoop(len, 4, (ctx) => {
    const bus = room(ctx, ctx.destination);
    const prog = [[55, 59, 62], [60, 64, 67], [62, 66, 69], [55, 59, 62], [52, 55, 59], [60, 64, 67], [62, 66, 69], [55, 59, 62]];
    const r = rng(5);
    prog.forEach((ch, b) => {
      const t0 = b * bar;
      pad(ctx, bus, ch.map((n) => n - 12), t0, bar, 0.022);
      // lead guitar: rolling eighths, accents off the beat
      const lead = [ch[0] + 12, ch[1] + 12, ch[2] + 12, ch[1] + 12, ch[2] + 12, ch[0] + 24, ch[2] + 12, ch[1] + 12];
      lead.forEach((n, i) => {
        if (b % 2 === 1 && i === 7) return;
        const swing = i % 2 ? 0.06 : 0;
        pluck(ctx, bus, n, t0 + i * beat / 2 + swing, i % 2 ? 0.16 : 0.1, b * 16 + i);
      });
      // rhythm guitar: chord stabs on the off-beats
      for (const off of [0.5, 1.5, 2.5, 3.5]) for (const n of ch) pluck(ctx, bus, n, t0 + off * beat + 0.01 * (n % 3), 0.06, b * 64 + off * 8 + n);
      // bass
      const root = ch[0] - 24;
      [[0, root], [1.5, root + 7], [2, root + 12], [3, root + 7]].forEach(([at, n]) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = hz(n);
        const s = t0 + at * beat;
        g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.16, s + 0.02); g.gain.exponentialRampToValueAtTime(0.001, s + beat * 0.9);
        o.connect(g).connect(ctx.destination); o.start(s); o.stop(s + beat);
      });
      // shaker
      for (let k = 0; k < 8; k++) {
        const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 0.08, b * 8 + k);
        const hp = ctx.createBiquadFilter(), g = ctx.createGain(); hp.type = 'highpass'; hp.frequency.value = 6000;
        const s = t0 + k * beat / 2 + (k % 2 ? 0.06 : 0);
        g.gain.value = (k % 2 ? 0.05 : 0.025) * (0.8 + r() * 0.4);
        n.connect(hp).connect(g).connect(ctx.destination); n.start(s);
      }
    });
  });
}

export async function effects() {
  // two short taps on an old horn
  const horn = await synth(1.0, (ctx) => {
    for (const at of [0, 0.36]) for (const f of [415, 523]) {
      const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
      o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 1800;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.12, at + 0.02); g.gain.setValueAtTime(0.12, at + 0.2); g.gain.linearRampToValueAtTime(0, at + 0.26);
      o.connect(lp).connect(g).connect(ctx.destination); o.start(at); o.stop(at + 0.3);
    }
  });
  // the sliding door: a rumble along its rail, then a clunk
  const door = await synth(1.2, (ctx) => {
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 1.2, 3);
    const bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.8;
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.35, 0.1); g.gain.setValueAtTime(0.35, 0.65); g.gain.linearRampToValueAtTime(0, 0.75);
    n.connect(bp).connect(g).connect(ctx.destination); n.start(0);
    const o = ctx.createOscillator(), cg = ctx.createGain();
    o.frequency.setValueAtTime(140, 0.76); o.frequency.exponentialRampToValueAtTime(60, 0.95);
    cg.gain.setValueAtTime(0, 0.75); cg.gain.linearRampToValueAtTime(0.5, 0.76); cg.gain.exponentialRampToValueAtTime(0.001, 1.0);
    o.connect(cg).connect(ctx.destination); o.start(0.75); o.stop(1.05);
  });
  // brakes: a short squeal and the water pushing back
  const brake = await synth(1.4, (ctx) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(1900, 0); o.frequency.linearRampToValueAtTime(1700, 0.6);
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(0.05, 0.05); g.gain.linearRampToValueAtTime(0, 0.65);
    o.connect(g).connect(ctx.destination); o.start(0); o.stop(0.7);
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 1.4, 11);
    const lp = ctx.createBiquadFilter(), ng = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 700;
    ng.gain.setValueAtTime(0, 0); ng.gain.linearRampToValueAtTime(0.3, 0.2); ng.gain.linearRampToValueAtTime(0, 1.3);
    n.connect(lp).connect(ng).connect(ctx.destination); n.start(0);
  });
  // a coin dropping into a tin
  const coin = await synth(1.2, (ctx) => {
    for (const [at, gain] of [[0, 1], [0.09, 0.5], [0.15, 0.25]] as const) for (const [f, k] of [[2650, 1], [4120, 0.6], [6310, 0.3]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.08 * gain * k, at + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      o.connect(g).connect(ctx.destination); o.start(at); o.stop(at + 0.55);
    }
  });
  return { horn, door, brake, coin };
}
