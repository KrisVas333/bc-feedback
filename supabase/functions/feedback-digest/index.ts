// Read-only digest feed for bin/feedback-digest.py. Bearer token (private.app_secrets.bc_feedback_digest_token).
// GET ?hours=24&test=0|1 -> {mentor:[...], vaikai:[...]} rows since now-hours.
import { createClient } from "npm:@supabase/supabase-js@2";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  const { data: tok } = await sb.rpc("bc_feedback_secret", { p_name: "bc_feedback_digest_token" });
  if (!tok || req.headers.get("authorization") !== `Bearer ${tok}`) return new Response("no", { status: 401 });
  const u = new URL(req.url);
  const hours = Math.min(Math.max(Number(u.searchParams.get("hours")) || 24, 1), 24 * 60);
  const withTest = u.searchParams.get("test") === "1";
  const since = new Date(Date.now() - hours * 3600e3).toISOString();
  let m = sb.from("feedback_mentor").select("ts,program,pamoka,data_text,kas_veike,kas_luzo,luzo_tipas,energija,citata,pataisymas,trukme_s,eval,is_test").gte("ts", since).order("ts");
  let k = sb.from("feedback_vaikai").select("ts,program,pamoka,klausimas,atsakymas,is_test").gte("ts", since).order("ts");
  if (!withTest) { m = m.eq("is_test", false); k = k.eq("is_test", false); }
  const [mr, kr] = await Promise.all([m, k]);
  if (mr.error || kr.error) return new Response("db", { status: 500 });
  return new Response(JSON.stringify({ since, mentor: mr.data, vaikai: kr.data }), { headers: { "content-type": "application/json" } });
});
