#!/usr/bin/env python3
"""Generate narration clips for a story with Chatterbox TTS (MIT, runs locally).

Usage: python3 tools/narrate.py <story-id> [--only l1,l3]

Reads  src/stories/<id>/narration.json
Writes public/stories/<id>/narration/<line>.mp3 and manifest.json (durations in seconds).

Setup (Python 3.11): pip install chatterbox-tts "setuptools<80"
The model downloads from Hugging Face on first run.

A voice is a short reference recording in assets/voices/<voice>.wav that Chatterbox imitates.
  narrator      default narrator
  narrator-alt  alternative narrator
Per-file or per-line settings:
  "voice"         name of a clip in assets/voices/
  "exaggeration"  0.25 calm .. 0.7 dramatic (default 0.35)
  "cfg"           lower is slower and more deliberate (default 0.3)
  "seed"          change it to re-roll a line that comes out wrong
  "pitch"         lowers (or raises) pitch without changing pace
  "warm"          true adds low-end warmth, softens highs and a light room
Swap these clips for recorded voice acting at any time: the engine only reads manifest.json.
"""
import argparse, json, os, subprocess, tempfile
import torch, torchaudio
from chatterbox.tts import ChatterboxTTS

ap = argparse.ArgumentParser()
ap.add_argument("story")
ap.add_argument("--only", help="comma-separated line ids to regenerate; others keep their clips")
args = ap.parse_args()

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
spec = json.load(open(os.path.join(root, "src/stories", args.story, "narration.json")))
out_dir = os.path.join(root, "public/stories", args.story, "narration")
os.makedirs(out_dir, exist_ok=True)
manifest_path = os.path.join(out_dir, "manifest.json")
manifest = json.load(open(manifest_path)) if args.only and os.path.exists(manifest_path) else {}
only = set(args.only.split(",")) if args.only else None

device = "cuda" if torch.cuda.is_available() else "cpu"
model = ChatterboxTTS.from_pretrained(device=device)

def setting(line, key, default):
    return line.get(key, spec.get(key, default))

def filters(line, sr):
    pitch = setting(line, "pitch", 1)
    af = [f"asetrate={round(sr * pitch)}", f"aresample={sr}", f"atempo={1 / pitch:.5f}"] if pitch != 1 else []
    if setting(line, "warm", False):
        af += ["bass=g=3:f=120", "treble=g=-2:f=6000", "aecho=0.8:0.5:40|70:0.12|0.07"]
    return af + ["loudnorm=I=-16"]

def duration(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                         capture_output=True, text=True, check=True).stdout
    return round(float(out), 3)

for line in spec["lines"]:
    if only and line["id"] not in only:
        continue
    voice = setting(line, "voice", "narrator")
    exaggeration = setting(line, "exaggeration", 0.35)
    torch.manual_seed(setting(line, "seed", 7))
    model.prepare_conditionals(os.path.join(root, "assets/voices", voice + ".wav"), exaggeration=exaggeration)
    wav = model.generate(line["text"], exaggeration=exaggeration, cfg_weight=setting(line, "cfg", 0.3))
    with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
        torchaudio.save(tmp.name, wav, model.sr)
        mp3 = os.path.join(out_dir, line["id"] + ".mp3")
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp.name, "-af", ",".join(filters(line, model.sr)),
                        "-ar", "48000", "-b:a", "128k", mp3], check=True)
    manifest[line["id"]] = {"file": line["id"] + ".mp3", "duration": duration(mp3), "text": line["text"]}
    print(f'{line["id"]}: {manifest[line["id"]]["duration"]}s')

json.dump(manifest, open(manifest_path, "w"), indent=2)
