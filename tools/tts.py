#!/usr/bin/env python3
"""Kids-page question audio in the Kraist v2 voice (Kris's clone, eleven_v3, LT) -> docs/audio/vr/*.mp3.
eleven_v3 is non-deterministic and sometimes garbles short LT phrases, so every clip is checked with
ElevenLabs STT (scribe_v1) and regenerated until the transcript matches (max 6 tries).
Key: ~/.config/elevenlabs/key (never printed). Usage: python3 tools/tts.py [clip ...]"""
import json, os, sys, time, difflib, unicodedata, urllib.request, uuid, pathlib
K = open(os.path.expanduser("~/.config/elevenlabs/key")).read().strip()
V = "UobNtYFTcCUxlYZA6j6J"
OUT = pathlib.Path(__file__).resolve().parent.parent / "docs" / "audio" / "vr"
T = {"start": "Labas! Septyni greiti klausimai apie šiandienos pamoką. Tiesiog spausk paveiksliuką.",
     "q1": "Kiek balų duotum šiandienos pamokai?", "q2": "Kas buvo smagiausia?", "q3": "Kas nepatiko?",
     "q4": "Ką šiandien išmokai?", "q5": "Kur tai panaudosi?", "q6": "Ko norėtum daugiau?",
     "q7": "Ar pakviestum draugą?", "kodel": "Kodėl?", "aciu": "Ačiū! Kitas draugas, tavo eilė."}

def norm(s):
    s = unicodedata.normalize("NFKD", s.lower())
    return "".join(c for c in s if c.isalnum() or c == " ").strip()

def tts(text):
    body = {"text": text, "model_id": "eleven_v3", "language_code": "lt", "voice_settings": {"stability": float(os.environ.get("STAB", "0.5")), "similarity_boost": 0.8, **({"speed": float(os.environ["SPEED"])} if os.environ.get("SPEED") else {})}}
    r = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{V}?output_format=mp3_44100_64",
                               data=json.dumps(body).encode(), headers={"xi-api-key": K, "content-type": "application/json"})
    return urllib.request.urlopen(r, timeout=120).read()

def stt(mp3):
    b = "----" + uuid.uuid4().hex
    parts = [f'--{b}\r\nContent-Disposition: form-data; name="model_id"\r\n\r\nscribe_v1\r\n',
             f'--{b}\r\nContent-Disposition: form-data; name="language_code"\r\n\r\nlit\r\n',
             f'--{b}\r\nContent-Disposition: form-data; name="file"; filename="a.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n']
    data = "".join(parts).encode() + mp3 + f"\r\n--{b}--\r\n".encode()
    r = urllib.request.Request("https://api.elevenlabs.io/v1/speech-to-text", data=data,
                               headers={"xi-api-key": K, "content-type": f"multipart/form-data; boundary={b}"})
    return json.loads(urllib.request.urlopen(r, timeout=120).read()).get("text", "")

for k in (sys.argv[1:] or T):
    best = (0, None, "")
    for i in range(6):
        mp3 = tts(T[k]); heard = stt(mp3)
        score = difflib.SequenceMatcher(None, norm(T[k]), norm(heard)).ratio()
        if score > best[0]: best = (score, mp3, heard)
        if score >= float(os.environ.get("MIN", "0.9")): break
    (OUT / f"{k}.mp3").write_bytes(best[1])
    print(f"{k}: {best[0]:.2f} tries={i+1} heard={best[2]!r}")
