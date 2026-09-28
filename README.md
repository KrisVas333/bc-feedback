# bc-feedback: BrAIn Club LT end-of-lesson feedback loop (v2)

Mentor talks 2 to 3 min with a Lithuanian voice agent in Kris's cloned voice (Kraist). Kids (3–6 kl.) tap 7 answers, no voice, no names. Both land in Supabase and in Slack **#bc-feedback** (`C0C54R7U4SV`, Kris + Gabrielius). Architecture, data table and retention: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Questions: [docs/QUESTIONS-v2.md](docs/QUESTIONS-v2.md).

## Integrate in 1 minute

| Who | Link | What happens |
|---|---|---|
| 🧑‍🏫 Mentor sets up the lesson | https://krisvas333.github.io/bc-feedback/qr.html | Pick program, lesson, vieta, date (today by default). Tick „bandymas" for tests. Print or show the 2 QR codes. |
| 🎙️ Mentor (adults only) | https://elevenlabs.io/app/talk-to?agent_id=agent_9001m3hecdmbf7d9njsf8933pe97 | Voice chat, max 5 min. From the QR it also carries `var_pamoka`, `var_vieta`, `var_data`, `var_bandymas`, `var_pradzia`, so Kraist confirms the lesson instead of asking. |
| 👧 Kids (3–6 kl.) | https://krisvas333.github.io/bc-feedback/?p=vr&l=1&vieta=%C5%A0iaur%C4%97s%20lic%C4%97jus | 7 tap screens, auto-resets for the next child, works offline (queues answers). Jr (1–2 kl.): `?p=jr&l=1` keeps the 4 faces. |

Lesson learning goals for screen 4 live in [docs/lessons.json](docs/lessons.json). Lessons marked `"todo": true` show generic goals to kids until Gabrielius fills them in.

## Slack: create the incoming webhook (Kris, 2 minutes)

1. Open https://api.slack.com/apps → **Create New App** → **From scratch** → name `BC feedback`, workspace = the BrAIn Club workspace → **Create App**.
2. Left menu **Incoming Webhooks** → switch **Activate Incoming Webhooks** to **On**.
3. Bottom: **Add New Webhook to Workspace** → choose the private channel **#bc-feedback** → **Allow**.
4. Copy the URL (`https://hooks.slack.com/services/...`). Do not paste it anywhere public.
5. Supabase → project `kris-life-os` → SQL editor → run (paste your URL):
   ```sql
   insert into private.app_secrets(name, value) values ('slack_webhook_bc_feedback', 'https://hooks.slack.com/services/XXX')
   on conflict (name) do update set value = excluded.value;
   ```
6. Done. The next mentor call posts automatically. Backlog: `python3 bin/feedback-digest.py --new` (in the Kris BrAIn repo) prints what was not posted yet.

Until step 5 is done nothing breaks: rows are saved, Slack is skipped and logged (`slack = 'no_secret'`).

## Files

- `agents/build.py` pushes both agents (VR = v2 questions, Jr = v1 questions; both in the Kraist voice). Key from `~/.config/elevenlabs/key`, webhook id from `~/.config/elevenlabs/bc-feedback-webhook.json`, never committed. `python3 agents/build.py vr`.
- `agents/prompt-vr.md` VR v2 prompt · `agents/prompt.md` Jr prompt · `agents/backup-v1-*.json` v1 configs for rollback.
- `supabase/functions/` `feedback-mentor-webhook` (HMAC, 21 fields, Slack post) · `feedback-vaikai` (v2 enum-only + v1 Jr) · `feedback-digest` (token: rows, `?new=1`, `mark`, kids-only `slack` aggregate) · `_shared/slack.ts` (LT Slack text).
- `supabase/migrations/20260928_bc_feedback_v2.sql` additive schema change.
- `docs/` GitHub Pages: `index.html` kids page, `qr.html`, `lessons.json`, `audio/vr/*.mp3` (Kraist TTS, regenerate with `python3 tools/tts.py`, which checks every clip with speech-to-text).
- `tests/run.py` 4 LT simulations → signed webhook → rows → Slack text (dry) + negatives · `tests/ui.cjs` Playwright, 7-screen flow at 390 / 1280×720 / 820 (`python3 -m http.server 8766 -d docs` first).

## Rollback

VR agent: `curl -X PATCH` the saved `agents/backup-v1-vr.json` config (conversation_config + platform_settings) to the same agent id. DB change is additive; v1 rows and the Jr page still work.
