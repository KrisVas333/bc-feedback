// ElevenLabs post-call webhook -> public.feedback_mentor (+ Slack #bc-feedback for BC VR v2)
// Verifies HMAC (ElevenLabs-Signature: t=..,v0=..), accepts only allow-listed agent ids,
// stores ONLY data-collection fields (no transcript, no summary: the auto-summary leaked a child name in v1 testing, no audio).
// BC VR = v2 fields (docs/QUESTIONS-v2.md) · BC Jr = v1 fields (unchanged).
import { createClient } from "npm:@supabase/supabase-js@2";
import { kidsRows, mentorMessage, postSlack, PROBLEMOS, secret } from "../_shared/slack.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function hmacHex(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const str = (v: unknown, max = 600) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" || s.toLowerCase() === "null" ? null : s.slice(0, max);
};
const int = (v: unknown, lo: number, hi: number) => {
  const n = Math.round(Number(v));
  return v !== null && v !== "" && Number.isFinite(n) && n >= lo && n <= hi ? n : null;
};
const oneOf = (v: unknown, allowed: string[]) => {
  const s = str(v, 20)?.toLowerCase() ?? null;
  return s && allowed.includes(s) ? s : null;
};
const ORD: Record<string, string> = { pirma: "1", antra: "2", trečia: "3", ketvirta: "4", penkta: "5", šešta: "6", septinta: "7", aštunta: "8", devinta: "9", dešimta: "10" };
function lesson(v: unknown): string | null {
  const s = str(v, 40)?.toLowerCase() ?? "";
  const d = s.match(/\d{1,3}/)?.[0];
  if (d) return d;
  for (const [w, n] of Object.entries(ORD)) if (s.includes(w)) return n;
  return null;
}
const FOLD: Record<string, string> = { salmas: "šalmas", zaidimas: "žaidimas", "wi-fi": "wifi", internetas: "wifi" };
function problems(v: unknown): string[] | null {
  const s = str(v, 300);
  if (!s) return null;
  const out = [...new Set(s.toLowerCase().split(/[,;]+/).map((x) => x.trim()).map((x) => FOLD[x] ?? x).filter((x) => PROBLEMOS.includes(x)))];
  return out.length ? out : null;
}
function isoDate(dv: unknown, startSecs: unknown): string {
  const s = str(dv, 20);
  if (s && /^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Number(startSecs) > 0 ? new Date(Number(startSecs) * 1000) : new Date();
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Vilnius" }).format(t); // YYYY-MM-DD
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const body = await req.text();
  if (body.length > 400_000) return new Response("too big", { status: 413 });

  const hdr = req.headers.get("elevenlabs-signature") ?? "";
  const parts = Object.fromEntries(hdr.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts["t"]);
  const key = await secret(sb, "elevenlabs_webhook_secret");
  if (!key || !t || !parts["v0"]) return new Response("unsigned", { status: 401 });
  if (Math.abs(Date.now() / 1000 - t) > 30 * 60) return new Response("stale", { status: 401 });
  const expect = await hmacHex(key, `${t}.${body}`);
  if (expect !== parts["v0"]) return new Response("bad sig", { status: 401 });

  let ev: any;
  try { ev = JSON.parse(body); } catch { return new Response("json", { status: 400 }); }
  if (ev?.type !== "post_call_transcription") return new Response("ignored", { status: 200 });
  const d = ev.data ?? {};

  const map = JSON.parse((await secret(sb, "bc_feedback_agents")) ?? "{}") as Record<string, string>;
  const program = map[d.agent_id];
  if (!program) return new Response("not ours", { status: 200 }); // other agents on the workspace webhook: drop, store nothing

  const dc = d.analysis?.data_collection_results ?? {};
  const dv = d.conversation_initiation_client_data?.dynamic_variables ?? {};
  const v = (k: string) => dc[k]?.value ?? null;
  const isTest = String(d.conversation_id ?? "").startsWith("test_") || String(dv.bandymas ?? "").toLowerCase() === "taip";
  const base = {
    program,
    conversation_id: str(d.conversation_id, 80),
    agent_id: str(d.agent_id, 80),
    trukme_s: Number(d.metadata?.call_duration_secs) || null,
    eval: d.analysis?.evaluation_criteria_results
      ? Object.fromEntries(Object.entries(d.analysis.evaluation_criteria_results).map(([k, r]: any) => [k, r?.result]))
      : null,
    is_test: isTest,
  };

  let row: Record<string, unknown>;
  if (program === "vr") {
    const TRI = ["taip", "dalinai", "ne"];
    const fields = {
      pamoka: lesson(v("pamoka")) ?? lesson(dv.pamoka),
      vieta: str(v("vieta"), 60) ?? str(dv.vieta, 60),
      vaiku_sk: int(v("vaiku_sk"), 0, 60),
      patiko: str(v("patiko")), nepatiko: str(v("nepatiko")), neistrigo: str(v("neistrigo")),
      zaidimas_veike: oneOf(v("zaidimas_veike"), TRI), salmai_veike: oneOf(v("salmai_veike"), TRI),
      problemu_tipai: problems(v("problemu_tipai")), problema: str(v("problema")),
      instrukcija_aiski: oneOf(v("instrukcija_aiski"), TRI), kur_strigo: str(v("kur_strigo")),
      pasitikejimas: int(v("pasitikejimas"), 1, 5), istorija_vaikams: int(v("istorija_vaikams"), 1, 5),
      ismoko: str(v("ismoko")), idomiausia: str(v("idomiausia")), prase_daugiau: str(v("prase_daugiau")),
      vaiko_citata: str(v("vaiko_citata"), 300), ivertinimas: int(v("ivertinimas"), 1, 10), pataisymas: str(v("pataisymas")),
    };
    // a child spoke / nothing answered -> the agent ended early: store nothing (pamoka/vieta may come from the QR, so ignore them here)
    const { pamoka: _p, vieta: _v, ...answers } = fields;
    if (Object.values(answers).every((x) => x === null)) return new Response("empty: nothing stored", { status: 200 });
    row = { ...base, ...fields, versija: 2, data: isoDate(dv.data, d.metadata?.start_time_unix_secs), data_text: str(dv.data, 40) };
  } else {
    let energija = Number(v("energija"));
    if (!(energija >= 1 && energija <= 5)) energija = NaN;
    const FIELDS = ["pamoka", "data", "kas_veike", "kas_luzo", "luzo_tipas", "energija", "citata", "pataisymas"];
    if (FIELDS.every((k) => v(k) === null || v(k) === "")) return new Response("empty: nothing stored", { status: 200 });
    row = {
      ...base, versija: 1,
      pamoka: str(v("pamoka"), 40), data_text: str(v("data"), 40), kas_veike: str(v("kas_veike")), kas_luzo: str(v("kas_luzo")),
      luzo_tipas: str(v("luzo_tipas"), 40), energija: Number.isNaN(energija) ? null : Math.round(energija),
      citata: str(v("citata"), 300), pataisymas: str(v("pataisymas")),
    };
  }
  const { data: saved, error } = await sb.from("feedback_mentor").upsert(row, { onConflict: "conversation_id" }).select("*").single();
  if (error) return new Response("db: " + error.message, { status: 500 });
  if (program !== "vr") return new Response("ok", { status: 200 });

  // Slack: never fails the insert. Missing secret -> skipped + logged; `bin/feedback-digest.py --new` picks it up later.
  let slack = "error", text = "";
  try {
    const kids = await kidsRows(sb, "vr", saved.pamoka, saved.data, saved.is_test);
    text = await mentorMessage(saved, kids);
    slack = await postSlack(sb, text);
    if (slack === "sent") {
      const now = new Date().toISOString();
      await sb.from("feedback_mentor").update({ slack: "sent", slack_posted_at: now }).eq("id", saved.id);
      const kidIds = kids.filter((k) => !k.slack_posted_at).map((k) => k.id);
      if (kidIds.length) await sb.from("feedback_vaikai").update({ slack_posted_at: now }).in("id", kidIds);
    } else {
      await sb.from("feedback_mentor").update({ slack }).eq("id", saved.id);
    }
  } catch (e) { console.log("slack build failed", String(e)); }
  // test rows echo the Slack text back (dry-run check in tests/run.py); real rows answer just "ok"
  return new Response(saved.is_test ? JSON.stringify({ ok: true, id: saved.id, slack, text }) : "ok", { status: 200 });
});
