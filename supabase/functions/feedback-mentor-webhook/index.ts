// ElevenLabs post-call webhook -> public.feedback_mentor
// Verifies HMAC (ElevenLabs-Signature: t=..,v0=..), accepts only allow-listed agent ids,
// stores ONLY the 8 structured fields (no transcript, no summary: the auto-summary leaked a child name in testing, no audio).
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

async function secret(name: string): Promise<string | null> {
  const { data } = await sb.rpc("bc_feedback_secret", { p_name: name });
  return (data as string) ?? null;
}

async function hmacHex(key: string, msg: string): Promise<string> {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const str = (v: unknown, max = 600) => (v === null || v === undefined || v === "" ? null : String(v).slice(0, max));

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method", { status: 405 });
  const body = await req.text();
  if (body.length > 400_000) return new Response("too big", { status: 413 });

  const hdr = req.headers.get("elevenlabs-signature") ?? "";
  const parts = Object.fromEntries(hdr.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts["t"]);
  const key = await secret("elevenlabs_webhook_secret");
  if (!key || !t || !parts["v0"]) return new Response("unsigned", { status: 401 });
  if (Math.abs(Date.now() / 1000 - t) > 30 * 60) return new Response("stale", { status: 401 });
  const expect = await hmacHex(key, `${t}.${body}`);
  if (expect !== parts["v0"]) return new Response("bad sig", { status: 401 });

  let ev: any;
  try { ev = JSON.parse(body); } catch { return new Response("json", { status: 400 }); }
  if (ev?.type !== "post_call_transcription") return new Response("ignored", { status: 200 });
  const d = ev.data ?? {};

  const map = JSON.parse((await secret("bc_feedback_agents")) ?? "{}") as Record<string, string>;
  const program = map[d.agent_id];
  if (!program) return new Response("not ours", { status: 200 }); // other agents on the workspace webhook: drop, store nothing

  const dc = d.analysis?.data_collection_results ?? {};
  const v = (k: string) => dc[k]?.value ?? null;
  let energija = Number(v("energija"));
  if (!(energija >= 1 && energija <= 5)) energija = NaN;

  const FIELDS = ["pamoka","data","kas_veike","kas_luzo","luzo_tipas","energija","citata","pataisymas"];
  if (FIELDS.every((k) => v(k) === null || v(k) === "")) return new Response("empty: nothing stored", { status: 200 }); // e.g. a child spoke and the agent ended the call

  const row = {
    program,
    conversation_id: str(d.conversation_id, 80),
    agent_id: str(d.agent_id, 80),
    pamoka: str(v("pamoka"), 40),
    data_text: str(v("data"), 40),
    kas_veike: str(v("kas_veike")),
    kas_luzo: str(v("kas_luzo")),
    luzo_tipas: str(v("luzo_tipas"), 40),
    energija: Number.isNaN(energija) ? null : Math.round(energija),
    citata: str(v("citata"), 300),
    pataisymas: str(v("pataisymas")),
    trukme_s: Number(d.metadata?.call_duration_secs) || null,
    eval: d.analysis?.evaluation_criteria_results
      ? Object.fromEntries(Object.entries(d.analysis.evaluation_criteria_results).map(([k, r]: any) => [k, r?.result]))
      : null,
    is_test: String(d.conversation_id ?? "").startsWith("test_") ||
      d.conversation_initiation_client_data?.dynamic_variables?.bandymas === "taip",
  };
  const { error } = await sb.from("feedback_mentor").upsert(row, { onConflict: "conversation_id" });
  if (error) return new Response("db: " + error.message, { status: 500 });
  return new Response("ok", { status: 200 });
});
