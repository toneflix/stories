// One mixer for both worlds: a live AudioContext in the browser, or an
// OfflineAudioContext that renders the export soundtrack sample-exactly.
// Narration and music are separate buses, so either can be replaced later
// (recorded voice, a composed score) without touching the story.

export type Bus = 'music' | 'voice' | 'sfx';

export class Mixer {
  ctx: BaseAudioContext;
  master: GainNode;
  buses: Record<Bus, GainNode>;
  duckAmount = 0.45;

  constructor(ctx: BaseAudioContext, levels: Partial<Record<Bus, number>> = {}) {
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 3;
    this.master = ctx.createGain();
    this.master.connect(comp).connect(ctx.destination);
    const lv = { music: 0.55, voice: 1.0, sfx: 0.8, ...levels };
    this.buses = {} as Record<Bus, GainNode>;
    (Object.keys(lv) as Bus[]).forEach((b) => {
      const g = ctx.createGain();
      g.gain.value = lv[b];
      g.connect(this.master);
      this.buses[b] = g;
    });
  }

  /** Play a buffer at context time `when`, optionally skipping `offset` seconds into it. */
  play(buffer: AudioBuffer, when: number, bus: Bus, { loop = false, offset = 0, gain = 1 } = {}) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(this.buses[bus]);
    src.start(when, offset);
    if (bus === 'voice') this.duck(when, buffer.duration - offset);
    return src;
  }

  /** Lower the music under narration. */
  duck(when: number, duration: number) {
    const p = this.buses.music.gain, base = p.value, low = base * this.duckAmount;
    p.setTargetAtTime(low, when, 0.25);
    p.setTargetAtTime(base, when + duration + 0.2, 0.6);
  }
}

export async function loadBuffer(ctx: BaseAudioContext, url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`audio ${url}: ${res.status}`);
  return ctx.decodeAudioData(await res.arrayBuffer());
}

/**
 * Decodes recorded sounds by name. Loops (`loop: true` names) lose the silent padding MP3
 * encoders add at either end, so they repeat without a gap.
 */
export async function loadSounds(urls: Record<string, string>, loops: string[] = []) {
  const ctx = new OfflineAudioContext(2, 1, 48000);
  const out: Record<string, AudioBuffer> = {};
  await Promise.all(Object.entries(urls).map(async ([name, url]) => {
    const b = await loadBuffer(ctx, url);
    out[name] = loops.includes(name) ? trimSilence(ctx, b) : b;
  }));
  return out;
}

function trimSilence(ctx: BaseAudioContext, b: AudioBuffer, floor = 1e-4) {
  const chans = Array.from({ length: b.numberOfChannels }, (_, i) => b.getChannelData(i));
  const loud = (i: number) => chans.some((c) => Math.abs(c[i]) > floor);
  let a = 0, z = b.length - 1;
  while (a < z && !loud(a)) a++;
  while (z > a && !loud(z)) z--;
  const out = ctx.createBuffer(b.numberOfChannels, z - a + 1, b.sampleRate);
  chans.forEach((c, i) => out.copyToChannel(c.subarray(a, z + 1), i));
  return out;
}

export interface NarrationClip { file: string; duration: number; text: string }
export type NarrationManifest = Record<string, NarrationClip>;

export async function loadNarration(ctx: BaseAudioContext, base: string) {
  const manifest: NarrationManifest = await (await fetch(`${base}/manifest.json`)).json();
  const buffers: Record<string, AudioBuffer> = {};
  await Promise.all(Object.entries(manifest).map(async ([id, c]) => {
    buffers[id] = await loadBuffer(ctx, `${base}/${c.file}`);
  }));
  return { manifest, buffers };
}

/** Render procedural audio (music beds, sound effects) into a buffer. */
export async function synth(seconds: number, build: (ctx: OfflineAudioContext) => void, sampleRate = 48000) {
  const ctx = new OfflineAudioContext(2, Math.ceil(seconds * sampleRate), sampleRate);
  build(ctx);
  return ctx.startRendering();
}

/**
 * Render a loop that wraps seamlessly: synthesise `seconds + tail`, then fold the
 * tail (reverb, release) back onto the start.
 */
export async function synthLoop(seconds: number, tail: number, build: (ctx: OfflineAudioContext) => void) {
  const raw = await synth(seconds + tail, build);
  const n = Math.ceil(seconds * raw.sampleRate);
  const out = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate: raw.sampleRate });
  for (let c = 0; c < 2; c++) {
    const src = raw.getChannelData(c), dst = out.getChannelData(c);
    dst.set(src.subarray(0, n));
    for (let i = n; i < src.length; i++) dst[i - n] += src[i];
  }
  return out;
}

/** 16-bit PCM WAV, for handing the export soundtrack to ffmpeg. */
export function encodeWav(buf: AudioBuffer) {
  const ch = buf.numberOfChannels, n = buf.length, sr = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const str = (o: number, s: string) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  str(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const s = Math.max(-1, Math.min(1, data[c][i]));
    out.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    o += 2;
  }
  return new Uint8Array(out.buffer);
}
