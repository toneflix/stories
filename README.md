# Toneflix Stories

Short interactive films built with React Three Fiber. Every story ships two ways:

1. **Live**: a web page you play in real time. Drag to look around; some beats wait for you to act.
2. **Video**: a 9:16 MP4 rendered frame by frame from the narrator's camera, with narration, music and effects mixed in.

Both come from the same code. The scene is a pure function of story time, so the exporter can step through it one frame at a time and get exactly what a viewer sees.

## Quick start

```bash
npm install
npm run dev                       # open http://localhost:5173/stories/lantern-keeper/
npm run export -- lantern-keeper  # → out/lantern-keeper.mp4 (720x1280); add --hd for 1080x1920
npm run build                     # static site in dist/ (deploy anywhere)
```

The exporter needs `ffmpeg` on your PATH and Chromium for Playwright (`npx playwright install chromium`). On a machine with a GPU, add `--gpu` to render much faster.

## House rules

- **9:16** vertical frame.
- **Under 3:33.** `defineStory` refuses a longer story, and so does the exporter.
- **Flat cel-shaded cartoon look**: toon shading with a few hard light bands, ink outlines, soft bloom. Not low-poly.
- **Narrator is voice only**, and optional. Leave `narration` out for a story without one.
- **Free assets only**, CC0 or similarly permissive, credited in [`assets/CREDITS.md`](assets/CREDITS.md).

## How a story is put together

```
stories/<id>/index.html         the page
src/stories/<id>/story.ts       title, duration, cues (narration, sound, interactive beats)
src/stories/<id>/script.ts      the timeline: beats, animation clips, narrator camera keys
src/stories/<id>/Scene.tsx      the world, in React Three Fiber
src/stories/<id>/narration.json narration lines (voice + text)
public/stories/<id>/narration/  generated voice clips + manifest.json (durations for subtitles)
```

Engine pieces in `src/engine/`:

| File | What it does |
| --- | --- |
| `Player.tsx` | Mounts a story. Live mode (audio, drag-to-look, interactive beats) or capture mode (`?capture`, driven by the exporter). |
| `clock.ts` | Story time. `useStoryFrame` replaces `useFrame`: pose everything from `t` (story time) and `idle` (never stops, for loops). |
| `beats.ts` | GSAP timeline that never plays by itself; seeked to story time each frame. |
| `camera.tsx` | `NarratorCamera`: smooth spline through keyed positions and look targets. |
| `character.ts` | Loads a modular glTF character (body + outfit + hair), cel-shades and outlines it, blends clips deterministically. |
| `clips.ts` | `ClipTrack`: animation clips placed on the timeline with cross-fades. |
| `toon.ts` | Toon materials and inverted-hull ink outlines (works on skinned meshes). |
| `audio.ts` | One mixer for live (`AudioContext`) and export (`OfflineAudioContext`), narration ducking, WAV encoding. |
| `types.ts` | `defineStory`, cue types, the 3:33 limit. |
| `ik.ts` | Two-bone IK (arms, legs) for poses the clip library doesn't have, e.g. reaching for an object. |
| `random.ts` | Seeded randomness and noise. Never use `Math.random()` in a story. |

### Interactive beats

A `wait` cue holds story time until the viewer clicks a target (`useHitTarget('lantern', mesh)`) or presses Space. Loops keep running on `idle` time while it waits, so characters stay alive. The export plays straight through, so write the script as if the viewer acted at once.

### Narration

Lines live in `src/stories/<id>/narration.json`. Generate the voice locally with [Chatterbox](https://github.com/resemble-ai/chatterbox) (MIT). It imitates a short reference recording from `assets/voices/`: `narrator` (default) or `narrator-alt`. Set `"voice"` per file or per line.

```bash
pip install chatterbox-tts "setuptools<80"   # Python 3.11
npm run narrate -- lantern-keeper            # add --only l2,l4 to redo single lines
```

To use a recorded voice instead, drop the clips in `public/stories/<id>/narration/` and update `manifest.json` (file and duration per line).

### Characters and animation

Characters are Quaternius' CC0 modular humans (base body + outfit + hair) driven by clips from the Universal Animation Library. `tools/fetch-sources.sh` downloads the source packs and `tools/prepare-assets.mjs` turns them into small web-ready `.glb` files (`tools/assets.config.json` lists what goes in). The prepared files are committed, so you only need those tools to add new characters or clips.
