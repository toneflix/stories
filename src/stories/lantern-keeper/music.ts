import { synth, synthLoop } from '../../engine/audio';
import { rng } from '../../engine/random';

// All sound is synthesised in code: a warm pad + music-box bells for the bed, and
// small effects. Replace with recorded audio any time; the engine only needs buffers.

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function noiseBuffer(ctx: BaseAudioContext, seconds: number, seed = 1) {
  const r = rng(seed), b = ctx.createBuffer(1, Math.ceil(seconds * ctx.sampleRate), ctx.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1;
  return b;
}

/** Feedback delay used as a cheap, lush reverb. */
function space(ctx: BaseAudioContext, out: AudioNode) {
  const input = ctx.createGain();
  const l = ctx.createDelay(1), r = ctx.createDelay(1), fb = ctx.createGain(), lp = ctx.createBiquadFilter();
  l.delayTime.value = 0.31; r.delayTime.value = 0.47; fb.gain.value = 0.42; lp.type = 'lowpass'; lp.frequency.value = 2600;
  const merger = ctx.createChannelMerger(2), wet = ctx.createGain(); wet.gain.value = 0.5;
  input.connect(out);
  input.connect(l); l.connect(lp); lp.connect(r); r.connect(fb); fb.connect(l);
  l.connect(merger, 0, 0); r.connect(merger, 0, 1); merger.connect(wet).connect(out);
  return input;
}

function pad(ctx: BaseAudioContext, out: AudioNode, notes: number[], start: number, len: number, gain = 0.045) {
  for (const n of notes) for (const det of [-6, 5]) {
    const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = det;
    f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 0.3;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 2.2);
    g.gain.setValueAtTime(gain, start + len - 0.5);
    g.gain.linearRampToValueAtTime(0, start + len + 2.5);
    o.connect(f).connect(g).connect(out);
    o.start(start); o.stop(start + len + 2.6);
  }
}

function bell(ctx: BaseAudioContext, out: AudioNode, midi: number, at: number, gain = 0.08, decay = 2.2) {
  for (const [mult, g0] of [[1, 1], [2.01, 0.35], [3.98, 0.12]]) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = hz(midi) * mult;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain * g0, at + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay / mult);
    o.connect(g).connect(out);
    o.start(at); o.stop(at + decay + 0.1);
  }
}

/** 32-second seamless loop in D major: Dmaj9 – Bm7 – Gmaj7 – Asus. */
export function music() {
  return synthLoop(32, 6, (ctx) => {
    const bus = space(ctx, ctx.destination);
    const chords = [[50, 57, 61, 64, 66], [47, 54, 57, 62], [43, 50, 54, 59], [45, 52, 57, 59, 64]];
    chords.forEach((c, i) => pad(ctx, bus, c, i * 8, 8));
    const r = rng(42);
    for (let beat = 0; beat < 32; beat += 0.5) {
      if (r() < 0.45) continue;
      const chord = chords[Math.floor(beat / 8)];
      const n = chord[Math.floor(r() * chord.length)] + 24;
      bell(ctx, bus, n, beat + 0.02, 0.05 + r() * 0.03);
    }
    // crickets
    for (let k = 0; k < 10; k++) {
      const at = r() * 30, o = ctx.createOscillator(), am = ctx.createOscillator(), g = ctx.createGain(), amg = ctx.createGain();
      o.frequency.value = 4300 + r() * 600; am.frequency.value = 28; amg.gain.value = 0.004;
      g.gain.value = 0;
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(0.004, at + 0.05); g.gain.linearRampToValueAtTime(0, at + 0.5);
      am.connect(amg).connect(g.gain);
      o.connect(g).connect(ctx.destination);
      o.start(at); am.start(at); o.stop(at + 0.6); am.stop(at + 0.6);
    }
  });
}

export async function effects() {
  const spark = await synth(0.5, (ctx) => {
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 0.5, 7);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3500; bp.Q.value = 1.2;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.6, 0); g.gain.exponentialRampToValueAtTime(0.001, 0.35);
    n.connect(bp).connect(g).connect(ctx.destination); n.start(0);
  });
  const fizzle = await synth(1.2, (ctx) => {
    const n = ctx.createBufferSource(); n.buffer = noiseBuffer(ctx, 1.2, 9);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(5000, 0); lp.frequency.exponentialRampToValueAtTime(300, 1);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.25, 0); g.gain.exponentialRampToValueAtTime(0.001, 1.1);
    n.connect(lp).connect(g).connect(ctx.destination); n.start(0);
  });
  const gather = await synth(6, (ctx) => {
    const bus = space(ctx, ctx.destination), r = rng(77);
    for (let i = 0; i < 26; i++) bell(ctx, bus, 81 + Math.floor(r() * 4) * 2 + Math.floor(i / 6) * 2, (i / 26) * 4.5 + r() * 0.1, 0.035, 1.2);
  });
  const bloom = await synth(6, (ctx) => {
    const bus = space(ctx, ctx.destination);
    pad(ctx, bus, [62, 66, 69, 74, 78], 0, 2.5, 0.06);
    [74, 78, 81, 86].forEach((n, i) => bell(ctx, bus, n, 0.05 + i * 0.09, 0.09, 3));
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(110, 0); o.frequency.exponentialRampToValueAtTime(45, 1.2);
    g.gain.setValueAtTime(0.4, 0); g.gain.exponentialRampToValueAtTime(0.001, 1.4);
    o.connect(g).connect(ctx.destination); o.start(0); o.stop(1.5);
  });
  const windows = await synth(4, (ctx) => {
    const bus = space(ctx, ctx.destination);
    [86, 90, 93, 98, 93, 90].forEach((n, i) => bell(ctx, bus, n, i * 0.45, 0.04, 1.5));
  });
  return { spark, fizzle, gather, bloom, windows };
}
