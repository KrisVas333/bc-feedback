// Kids' emoji taps -> public.feedback_vaikai. Anonymous: no names, no device id, IP never read or stored.
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};
const Q = new Set(["patiko", "sunku", "jausmas", "dar"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("method", { status: 405, headers: CORS });
  const raw = await req.text();
  if (raw.length > 1000) return new Response("too big", { status: 413, headers: CORS });
  let b: any;
  try { b = JSON.parse(raw); } catch { return new Response("json", { status: 400, headers: CORS }); }

  const program = b?.p === "vr" || b?.p === "jr" ? b.p : null;
  const pamoka = typeof b?.l === "string" && /^[0-9A-Za-z-]{1,6}$/.test(b.l) ? b.l : null;
  const ans = Array.isArray(b?.a) ? b.a.slice(0, 4) : [];
  if (!program || ans.length === 0) return new Response("bad", { status: 400, headers: CORS });

  const rows = [];
  for (const x of ans) {
    const n = Number(x?.v);
    if (!Q.has(x?.q) || !(n >= 1 && n <= 4) || !Number.isInteger(n)) return new Response("bad", { status: 400, headers: CORS });
    rows.push({ program, pamoka, klausimas: x.q, atsakymas: n, is_test: b?.t === 1 });
  }
  const { error } = await sb.from("feedback_vaikai").insert(rows);
  if (error) return new Response("db", { status: 500, headers: CORS });
  return new Response(JSON.stringify({ ok: rows.length }), { headers: { ...CORS, "content-type": "application/json" } });
});
