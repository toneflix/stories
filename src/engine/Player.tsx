import * as THREE from 'three';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, advance, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, ToneMapping, SMAA } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { REAL } from './look';
import { SketchEffect } from './sketch';

const SKETCH = REAL ? new SketchEffect() : null;
import { ClockContext, StoryClock, useClock } from './clock';
import { Mixer, loadNarration, encodeWav, type NarrationManifest } from './audio';
import { clamp, smoothstep } from './timeline';
import { defineStory, type Cue, type StoryDefinition } from './types';
import './player.css';

type Wait = Extract<Cue, { type: 'wait' }>;
const params = new URLSearchParams(location.search);
const CAPTURE = params.has('capture');
/** Phones and tablets: render lighter so the browser doesn't run out of GPU memory. */
export const MOBILE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;

/** Mount a story into the page. Live by default; `?capture` switches to frame export mode. */
export function mountStory(def: StoryDefinition, el: HTMLElement = document.getElementById('app')!) {
  const root = createRoot(el);
  try {
    root.render(<Crash><Player def={defineStory(def)} /></Crash>);
  } catch (e) {
    showError(e);
  }
}

interface Audio {
  ctx: AudioContext;
  mixer: Mixer;
  voice: Record<string, AudioBuffer>;
  sfx: Record<string, AudioBuffer>;
  music?: AudioBuffer;
  playing: AudioBufferSourceNode[];
}

/**
 * Plays a story. Live and capture share every line of story code:
 *  - live:    real time, audio, drag-to-look, interactive beats.
 *  - capture: nothing advances on its own. The exporter calls window.__story.renderAt(t)
 *             for each frame and window.__story.soundtrackWav() for the mixed audio.
 */
function Player({ def }: { def: StoryDefinition }) {
  // ?t=24 starts the live player part-way in (handy while writing a scene)
  const startAt = CAPTURE ? 0 : Number(params.get('t')) || 0;
  const clock = useMemo(() => Object.assign(new StoryClock(), { live: !CAPTURE, t: startAt, idle: startAt }), [startAt]);
  const aspect = def.aspect!;
  const capW = Number(params.get('w')) || 720, capH = Number(params.get('h')) || Math.round(capW / aspect);
  const [frame, setFrame] = useState(() => fit(aspect, capW, capH));
  const [manifest, setManifest] = useState<NarrationManifest>({});
  const [phase, setPhase] = useState<'loading' | 'ready' | 'playing' | 'ended'>('loading');
  const [waiting, setWaiting] = useState<Wait | null>(null);
  const [glGeneration, setGlGeneration] = useState(0);
  const lost = useRef(0);
  const audio = useRef<Audio | null>(null);
  const sceneReady = useRef(false);

  useEffect(() => {
    if (CAPTURE) return;
    const onResize = () => setFrame(fit(aspect));
    addEventListener('resize', onResize);
    return () => removeEventListener('resize', onResize);
  }, [aspect]);

  // narration manifest (for subtitles) + live audio
  useEffect(() => {
    let off = false;
    (async () => {
      if (CAPTURE) {
        if (def.narration) setManifest(await (await fetch(`${def.narration}/manifest.json`)).json());
        return;
      }
      const ctx = new AudioContext();
      const [narr, snd] = await Promise.all([
        def.narration ? loadNarration(ctx, def.narration) : Promise.resolve({ manifest: {}, buffers: {} }),
        def.sounds ? def.sounds() : Promise.resolve({} as { music?: AudioBuffer; sfx?: Record<string, AudioBuffer> }),
      ]);
      if (off) return;
      audio.current = { ctx, mixer: new Mixer(ctx), voice: narr.buffers, sfx: snd.sfx ?? {}, music: snd.music, playing: [] };
      setManifest(narr.manifest);
      document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); else if (clock.idle > 0) ctx.resume(); });
    })();
    return () => { off = true; };
  }, [def, clock]);

  const onSceneReady = () => {
    sceneReady.current = true;
    if (CAPTURE) exposeCapture(def, clock);
    else setPhase((p) => (p === 'loading' ? 'ready' : p));
  };

  const begin = () => {
    setPhase('playing');
    const a = audio.current;
    if (!a) return;
    // some in-app browsers never settle resume(); don't let sound hold up the picture
    a.ctx.resume().catch((e) => console.warn('audio', e));
    try { if (a.music) a.mixer.play(a.music, a.ctx.currentTime, 'music', { loop: true }); } catch (e) { console.warn('audio', e); }
  };
  const fire = (c: Cue) => {
    const a = audio.current;
    if (c.type === 'wait') { setWaiting(c); return; }
    if (!a) return;
    const buf = c.type === 'voice' ? a.voice[c.id] : a.sfx[c.id];
    if (buf) a.playing.push(a.mixer.play(buf, a.ctx.currentTime, c.type === 'voice' ? 'voice' : 'sfx'));
  };
  const restart = () => {
    audio.current?.playing.forEach((s) => { try { s.stop(); } catch { /* ended */ } });
    if (audio.current) audio.current.playing = [];
    clock.t = 0;
    setWaiting(null);
    setPhase('playing');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (waiting && (e.code === 'Space' || e.code === 'Enter')) setWaiting(null); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [waiting]);

  return (
    <div className={`tf-root ${CAPTURE ? 'tf-capture' : ''}`}>
      <div className="tf-stage">
        <div className="tf-frame" style={{ width: frame.w, height: frame.h, ['--frame-h' as string]: `${frame.h}px` }}>
          <Canvas
            frameloop={CAPTURE ? 'never' : 'always'}
            dpr={CAPTURE ? 1 : [1, MOBILE ? 1.5 : 2]}
            key={glGeneration}
            onCreated={({ gl }) => gl.domElement.addEventListener('webglcontextlost', (e) => {
              // The GPU dropped us (driver reset, GPU switch, memory pressure). Rebuild the
              // canvas and carry on from the same story time; give up after a few tries.
              e.preventDefault();
              lost.current += 1;
              if (lost.current > 3) showError(new Error('The device keeps stopping the 3D graphics (WebGL context lost). Try another browser or reload.'));
              else setTimeout(() => setGlGeneration((g) => g + 1), 300);
            })}
            shadows
            gl={{ antialias: false, preserveDrawingBuffer: CAPTURE, powerPreference: 'default' }}
            camera={{ fov: def.camera?.fov ?? 45, near: def.camera?.near ?? 0.1, far: def.camera?.far ?? 1200, position: [0, 2, 10] }}
          >
            <ClockContext.Provider value={clock}>
              <Suspense fallback={null}>
                <def.Scene />
                <Ready onReady={onSceneReady} />
              </Suspense>
              {!CAPTURE && (
                <Director def={def} running={phase === 'playing'} waiting={waiting} onCue={fire}
                  onEnd={() => setPhase('ended')} />
              )}
              {!CAPTURE && <LookAround waiting={waiting} onHit={() => setWaiting(null)} />}
              <Emit />
              <EffectComposer multisampling={0}>
                <SMAA />
                {REAL
                  ? <Bloom mipmapBlur intensity={0.35} luminanceThreshold={1.1} luminanceSmoothing={0.3} radius={0.6} />
                  : <Bloom mipmapBlur intensity={0.9} luminanceThreshold={0.85} luminanceSmoothing={0.2} radius={0.7} />}
                <ToneMapping mode={ToneMappingMode.NEUTRAL} />
                {SKETCH ? <primitive object={SKETCH} /> : <></>}
              </EffectComposer>
            </ClockContext.Provider>
          </Canvas>
          <Overlays def={def} clock={clock} manifest={manifest} subtitles={params.get('subs') !== '0'} />
          {!CAPTURE && <div className={`tf-prompt ${waiting ? 'on' : ''}`}>{waiting?.prompt}</div>}
        </div>
        {!CAPTURE && (
          <div className={`tf-start ${phase === 'playing' || phase === 'ended' ? 'gone' : ''}`}>
            <h1>{def.title}</h1>
            {def.subtitle && <p>{def.subtitle}</p>}
            <button disabled={phase === 'loading'} onClick={begin}>{phase === 'loading' ? 'Loading…' : 'Begin'}</button>
            <small>{def.narration ? 'Sound on · ' : ''}drag to look around</small>
          </div>
        )}
        {!CAPTURE && <button className={`tf-again ${phase === 'ended' ? 'on' : ''}`} onClick={restart}>Watch again</button>}
      </div>
    </div>
  );
}

function fit(aspect: number, w?: number, h?: number) {
  if (w && h && CAPTURE) return { w, h };
  const W = innerWidth, H = innerHeight;
  const fw = Math.min(W, H * aspect);
  return { w: Math.round(fw), h: Math.round(fw / aspect) };
}

/** Rendered inside Suspense after the scene: fires once every asset has loaded. */
function Ready({ onReady }: { onReady: () => void }) {
  useEffect(() => { onReady(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Live clock: advances story time, fires cues, holds at interactive beats. Runs before the scene. */
function Director({ def, running, waiting, onCue, onEnd }: {
  def: StoryDefinition; running: boolean; waiting: Wait | null; onCue: (c: Cue) => void; onEnd: () => void;
}) {
  const clock = useClock();
  const cues = useMemo(() => [...def.cues].sort((a, b) => a.at - b.at), [def]);
  const fired = useRef(new Set<Cue>());
  const ended = useRef(false);
  useEffect(() => {
    if (!running) return;
    fired.current = new Set(cues.filter((c) => c.at < clock.t));
    ended.current = false;
  }, [running, clock, cues]);
  useFrame((_, delta) => {
    if (!running) return;
    const dt = clamp(delta, 0, 0.1);
    clock.idle += dt;
    if (waiting || clock.t >= def.duration) return;
    const next = Math.min(def.duration, clock.t + dt);
    for (const c of cues) {
      if (fired.current.has(c) || c.at > next) continue;
      fired.current.add(c);
      onCue(c);
      if (c.type === 'wait') { clock.t = c.at; return; }
    }
    clock.t = next;
    if (clock.t >= def.duration && !ended.current) { ended.current = true; onEnd(); }
  }, -10);
  return null;
}

/** Pushes the frame's time to DOM overlays, after the scene has updated. */
function Emit() {
  const clock = useClock();
  useFrame(() => clock.emit(), 0.9);
  return null;
}

/** Live only: drag to glance around (springs back), click targets during a wait cue. */
function LookAround({ waiting, onHit }: { waiting: Wait | null; onHit: () => void }) {
  const { camera, gl } = useThree();
  const clock = useClock();
  const st = useRef({ yaw: 0, pitch: 0, down: false, dragged: false, x: 0, y: 0 });
  const waitRef = useRef(waiting) as RefObject<Wait | null>;
  waitRef.current = waiting;
  useEffect(() => {
    const el = gl.domElement, s = st.current, ray = new THREE.Raycaster();
    const ndc = (e: PointerEvent | MouseEvent) => {
      const r = el.getBoundingClientRect();
      return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    const hits = (e: PointerEvent | MouseEvent) => {
      const w = waitRef.current; if (!w) return false;
      const obj = clock.targets.get(w.target); if (!obj) return false;
      ray.setFromCamera(ndc(e), camera);
      return ray.intersectObject(obj, true).length > 0;
    };
    const down = (e: PointerEvent) => { s.down = true; s.dragged = false; s.x = e.clientX; s.y = e.clientY; el.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!s.down) { el.style.cursor = waitRef.current ? (hits(e) ? 'pointer' : 'grab') : 'grab'; return; }
      const dx = e.clientX - s.x, dy = e.clientY - s.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) s.dragged = true;
      s.x = e.clientX; s.y = e.clientY;
      s.yaw = clamp(s.yaw - dx * 0.004, -0.8, 0.8);
      s.pitch = clamp(s.pitch - dy * 0.004, -0.5, 0.5);
    };
    const up = (e: PointerEvent) => { s.down = false; if (!s.dragged && hits(e)) onHit(); };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); };
  }, [gl, camera, clock, onHit]);
  useFrame((_, delta) => {
    const s = st.current;
    if (!s.down) { const k = 1 - Math.exp(-delta * 2.5); s.yaw -= s.yaw * k; s.pitch -= s.pitch * k; }
    if (Math.abs(s.yaw) + Math.abs(s.pitch) < 1e-4) return;
    camera.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), s.yaw);
    camera.rotateX(s.pitch);
  }, 0.5);
  return null;
}

/** Fade, title card and subtitles: pure functions of story time, updated imperatively. */
function Overlays({ def, clock, manifest, subtitles }: { def: StoryDefinition; clock: StoryClock; manifest: NarrationManifest; subtitles: boolean }) {
  const fade = useRef<HTMLDivElement>(null), card = useRef<HTMLDivElement>(null), subs = useRef<HTMLDivElement>(null);
  const voice = useMemo(() => def.cues.filter((c): c is Extract<Cue, { type: 'voice' }> => c.type === 'voice'), [def]);
  useEffect(() => clock.subscribe(({ t }) => {
    const fi = def.fadeIn!, fo = def.fadeOut!;
    fade.current!.style.opacity = String(Math.max(1 - smoothstep(0, fi, t), smoothstep(def.duration - fo, def.duration, t)));
    if (def.card) card.current!.style.opacity = String(Math.min(smoothstep(def.card.from, def.card.from + 1.2, t), 1 - smoothstep(def.card.to - 1.2, def.card.to, t)));
    let text = '', alpha = 0;
    if (subtitles) for (const c of voice) {
      const clip = manifest[c.id];
      if (clip && t >= c.at - 0.2 && t <= c.at + clip.duration + 0.6) {
        text = clip.text;
        alpha = Math.min(smoothstep(c.at - 0.2, c.at + 0.1, t), 1 - smoothstep(c.at + clip.duration + 0.2, c.at + clip.duration + 0.6, t));
      }
    }
    if (subs.current!.textContent !== text) subs.current!.textContent = text;
    subs.current!.style.opacity = String(alpha);
  }), [clock, def, manifest, voice, subtitles]);
  return (
    <>
      <div ref={fade} className="tf-fade" />
      {def.card && <div ref={card} className="tf-card"><h1>{def.card.title}</h1>{def.card.byline && <p>{def.card.byline}</p>}</div>}
      <div ref={subs} className="tf-subs" />
    </>
  );
}

/** Capture-mode API used by tools/export.mjs. */
function exposeCapture(def: StoryDefinition, clock: StoryClock) {
  Object.assign(window, {
    __story: {
      id: def.id, title: def.title, duration: def.duration,
      renderAt(t: number) {
        clock.t = t; clock.idle = t;
        advance(performance.now());
      },
      async soundtrackWav() {
        const sr = 48000, ctx = new OfflineAudioContext(2, Math.ceil(def.duration * sr), sr);
        const [narr, snd] = await Promise.all([
          def.narration ? loadNarration(ctx, def.narration) : Promise.resolve({ buffers: {} as Record<string, AudioBuffer> }),
          def.sounds ? def.sounds() : Promise.resolve({} as { music?: AudioBuffer; sfx?: Record<string, AudioBuffer> }),
        ]);
        const mix = new Mixer(ctx);
        if (snd.music) mix.play(snd.music, 0, 'music', { loop: true });
        for (const c of def.cues) {
          if (c.type === 'voice' && narr.buffers[c.id]) mix.play(narr.buffers[c.id], c.at, 'voice');
          if (c.type === 'sfx' && snd.sfx?.[c.id]) mix.play(snd.sfx[c.id], c.at, 'sfx');
        }
        const wav = encodeWav(await ctx.startRendering());
        let s = '';
        for (let i = 0; i < wav.length; i += 0x8000) s += String.fromCharCode(...wav.subarray(i, i + 0x8000));
        return btoa(s);
      },
    },
  });
  clock.t = 0; clock.idle = 0;
  advance(performance.now());
  document.documentElement.dataset.ready = '1';
}

/** Show a failure on screen instead of leaving a blank page. */
function showError(e: unknown) {
  console.error(e);
  if (CAPTURE) return;
  let box = document.querySelector<HTMLDivElement>('.tf-error');
  if (!box) { box = document.createElement('div'); box.className = 'tf-error'; document.body.appendChild(box); }
  const msg = e instanceof Error ? e.message : String(e);
  box.innerHTML = `<strong>Something went wrong</strong><p></p><small></small>`;
  box.querySelector('p')!.textContent = msg;
  box.querySelector('small')!.textContent = `${navigator.userAgent}`;
}
if (typeof window !== 'undefined') {
  addEventListener('error', (e) => showError(e.error ?? e.message));
  addEventListener('unhandledrejection', (e) => showError(e.reason));
}

class Crash extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { showError(e); }
  render() { return this.state.failed ? null : this.props.children; }
}
