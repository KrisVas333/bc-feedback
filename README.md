# bc-feedback — BrAIn Club LT end-of-lesson feedback loop

- `docs/` — kids' anonymous 4-emoji page (`?p=vr|jr&l=<lesson>`), mentor QR page `qr.html`. GitHub Pages.
- `agents/` — 2 ElevenLabs LT mentor voice agents (adults only). `python3 agents/build.py --webhook <id>` (key from ~/.config/elevenlabs/key, never committed).
- `supabase/functions/` — `feedback-mentor-webhook` (HMAC-verified ElevenLabs post-call → `feedback_mentor`) · `feedback-vaikai` (taps → `feedback_vaikai`).
- `tests/` — `run.py` (3 LT simulations → signed webhook → rows + negative tests) · `ui.cjs` (headless UI, 22 checks).
Architecture: Kris BrAIn `wiki/projects/bc-feedback-loop-2026-09.md`.
