# bc-feedback: BrAIn Club LT end-of-lesson feedback loop (v3)

**One link: https://krisvas333.github.io/bc-feedback/skambutis.html** · two calls: 📞 Mentorius (mentor talks 2 to 3 min with Kraist, Kris's cloned voice) and 📞 Vaikų ratas (Kraist asks the class aloud, the mentor holds a button and relays the group's answers; kids never talk to the phone). Kids (3–6 kl.) can also tap 7 answers, no voice, no names. All agents: `eleven_v4`. Both land in Supabase and in Slack **#bc-feedback** (`C0C54R7U4SV`, Kris + Gabrielius). Architecture, data table and retention: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Questions: [docs/QUESTIONS-v2.md](docs/QUESTIONS-v2.md).

## Integrate in 1 minute

| Who | Link | What happens |
|---|---|---|
| 🧑‍🏫 Mentor sets up the lesson | https://krisvas333.github.io/bc-feedback/qr.html | Pick program, lesson, vieta, date (today by default). Tick „bandymas" for tests. Print or show the 2 QR codes. |
| 📞 Call page (mentor only) | https://krisvas333.github.io/bc-feedback/skambutis.html?p=vr&l=1&vieta=%C5%A0iaur%C4%97s%20lic%C4%97jus&k=12 | Two big buttons. „Mentorius" = open mic. „Vaikų ratas" = mic muted, hold the big button (or spacebar) only while relaying; Kraist speaks each kid question to the class. `k` = vaikų sk. Missing params get small inputs. Agent ids: mentor `agent_9001m3hecdmbf7d9njsf8933pe97`, Vaikų ratas `agent_6501m3p8yeamedq9err079bkgdcx`. |
| 🎙️ Mentor (old talk-to link, still works) | https://elevenlabs.io/app/talk-to?agent_id=agent_9001m3hecdmbf7d9njsf8933pe97 | Voice chat, max 5 min. From the QR it also carries `var_pamoka`, `var_vieta`, `var_data`, `var_bandymas`, `var_pradzia`, so Kraist confirms the lesson instead of asking. |
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

- `agents/build.py` pushes all three agents (VR mentor = v2 questions, Jr = v1 questions, `ratas` = Vaikų ratas; all Kraist voice, `TTS_MODEL = "eleven_v4"`, origin allowlist `krisvas333.github.io` + `elevenlabs.io`). `agents/prompt-ratas.md` = Vaikų ratas prompt. Key from `~/.config/elevenlabs/key`, webhook id from `~/.config/elevenlabs/bc-feedback-webhook.json`, never committed. `python3 agents/build.py vr`.
- `agents/prompt-vr.md` VR v2 prompt · `agents/prompt.md` Jr prompt · `agents/backup-v1-*.json` v1 configs for rollback.
- `supabase/functions/` `feedback-mentor-webhook` (HMAC, 21 fields, Slack post) · `feedback-vaikai` (v2 enum-only + v1 Jr) · `feedback-digest` (token: rows, `?new=1`, `mark`, kids-only `slack` aggregate) · `_shared/slack.ts` (LT Slack text).
- `supabase/migrations/20260928_bc_feedback_v2.sql` additive schema change · `20260929_vaikai_ratas.sql` new table `feedback_vaikai_ratas` (RLS deny-all).
- Lithuanian one-pager for Gabrielius: [docs/ARCHITEKTURA-LT.md](docs/ARCHITEKTURA-LT.md).
- `docs/` GitHub Pages: `index.html` kids page, `qr.html`, `lessons.json`, `audio/vr/*.mp3` (Kraist TTS, regenerate with `python3 tools/tts.py`, which checks every clip with speech-to-text).
- `tests/run_ratas.py` 4 Vaikų ratas simulations (normal · name relayed · child interrupts · child only) → signed webhook → row → Slack text (dry) · `tests/ui-call.cjs` Playwright: call page at 390/820/1280 with the real SDK + mocked hold-to-talk.
- `tests/run.py` 4 LT simulations → signed webhook → rows → Slack text (dry) + negatives · `tests/ui.cjs` Playwright, 7-screen flow at 390 / 1280×720 / 820 (`python3 -m http.server 8766 -d docs` first).

## Rollback

VR agent: `curl -X PATCH` the saved `agents/backup-v1-vr.json` config (conversation_config + platform_settings) to the same agent id. DB change is additive; v1 rows and the Jr page still work.
