#!/usr/bin/env python3
"""Generate narration clips for a story with Kokoro TTS (Apache-2.0, runs locally).

Usage: python3 tools/narrate.py <story-id> [--models DIR]

Reads  src/stories/<id>/narration.json
Writes public/stories/<id>/narration/<line>.mp3 and manifest.json (durations in seconds).

Model files (download once from github.com/thewh1teagle/kokoro-onnx releases, tag model-files-v1.0):
  kokoro-v1.0.int8.onnx  -> <models>/kokoro.onnx
  voices-v1.0.bin        -> <models>/voices.bin
Swap these clips for recorded voice acting at any time: the engine only reads manifest.json.
"""
import argparse, json, os, subprocess, tempfile
import soundfile as sf
from kokoro_onnx import Kokoro

ap = argparse.ArgumentParser()
ap.add_argument("story")
ap.add_argument("--models", default=os.environ.get("KOKORO_MODELS", ".models/kokoro"))
args = ap.parse_args()

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = json.load(open(os.path.join(root, "src/stories", args.story, "narration.json")))
out_dir = os.path.join(root, "public/stories", args.story, "narration")
os.makedirs(out_dir, exist_ok=True)

k = Kokoro(os.path.join(args.models, "kokoro.onnx"), os.path.join(args.models, "voices.bin"))
manifest = {}
for line in spec["lines"]:
    samples, sr = k.create(line["text"], voice=line.get("voice", spec["voice"]),
                           speed=line.get("speed", spec["speed"]), lang=spec["lang"])
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        sf.write(tmp.name, samples, sr)
        mp3 = os.path.join(out_dir, line["id"] + ".mp3")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name,
                        "-ar", "48000", "-b:a", "128k", mp3], check=True)
    manifest[line["id"]] = {"file": line["id"] + ".mp3", "duration": round(len(samples) / sr, 3), "text": line["text"]}
    print(f'{line["id"]}: {manifest[line["id"]]["duration"]}s')

json.dump(manifest, open(os.path.join(out_dir, "manifest.json"), "w"), indent=2)
