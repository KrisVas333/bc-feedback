// Kids' taps -> public.feedback_vaikai. Anonymous: no names, no device id, IP never read or stored.
// v1 (BC Jr): {p:"jr", l, t, a:[{q,v 1-4}]}  -> 4 rows per child (unchanged)
// v2 (BC VR 3-6 kl.): {v:2, p:"vr", l, t, vieta, data, r:{ivertinimas 1-10, smagiausia, nepatiko, ismoko, panaudos, daugiau, rekomenduotu, kodel}}
//    -> ONE row per child. Every answer is an enum code; any unknown key or value -> 400. Zero free text.
import { createClient } from "npm:@supabase/supabase-js@2";
import { KIDS, KODEL_BY } from "../_shared/slack.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};
const Q = new Set(["patiko", "sunku", "jausmas", "dar"]);
const bad = () => new Response("bad", { status: 400, headers: CORS });
const TOP = new Set(["v", "p", "l", "t", "vieta", "data", "r"]);
const R = new Set(["ivertinimas", "smagiausia", "nepatiko", "ismoko", "panaudos", "daugiau", "rekomenduotu", "kodel"]);
// vieta is chosen by the adult mentor on qr.html (select + optional "kita" text): letters, digits, spaces, . - " only
const VIETA = /^[\p{L}\p{N} .,"„“\-]{1,60}$/u;

function v2row(b: any) {
  if (Object.keys(b).some((k) => !TOP.has(k))) return null;
  const r = b.r;
  if (!r || typeof r !== "object" || Object.keys(r).some((k) => !R.has(k))) return null;
  const pamoka = typeof b.l === "string" && /^[0-9A-Za-z-]{1,6}$/.test(b.l) ? b.l : b.l == null ? null : undefined;
  const vieta = b.vieta == null || b.vieta === "" ? null : typeof b.vieta === "string" && VIETA.test(b.vieta) ? b.vieta : undefined;
  const data = b.data == null || b.data === "" ? null : typeof b.data === "string" && /^20\d\d-[01]\d-[0-3]\d$/.test(b.data) ? b.data : undefined;
  if (pamoka === undefined || vieta === undefined || data === undefined) return null;
  const iv = r.ivertinimas;
  if (!Number.isInteger(iv) || iv < 1 || iv > 10) return null;
  const en = (k: keyof typeof KIDS, x: unknown) => (x == null ? null : typeof x === "string" && x in KIDS[k] ? x : undefined);
  const row: Record<string, unknown> = {
    program: "vr", versija: 2, pamoka, vieta, data, is_test: b.t === 1, ivertinimas: iv,
    smagiausia: en("smagiausia", r.smagiausia), nepatiko: en("nepatiko", r.nepatiko), panaudos: en("panaudos", r.panaudos),
    daugiau: en("daugiau", r.daugiau), rekomenduotu: en("rekomenduotu", r.rekomenduotu),
    ismoko: r.ismoko == null ? null : typeof r.ismoko === "string" && /^[a-z0-9_]{1,24}$/.test(r.ismoko) ? r.ismoko : undefined,
    kodel: r.kodel == null ? null : typeof r.kodel === "string" && r.rekomenduotu && (KODEL_BY as any)[r.rekomenduotu]?.includes(r.kodel) ? r.kodel : undefined,
  };
  if (Object.values(row).some((x) => x === undefined)) return null;
  return row;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("method", { status: 405, headers: CORS });
  const raw = await req.text();
  if (raw.length > 1000) return new Response("too big", { status: 413, headers: CORS });
  let b: any;
  try { b = JSON.parse(raw); } catch { return new Response("json", { status: 400, headers: CORS }); }
  if (!b || typeof b !== "object" || Array.isArray(b)) return bad();

  if (b.v === 2) {
    if (b.p !== "vr") return bad();
    const row = v2row(b);
    if (!row) return bad();
    const { error } = await sb.from("feedback_vaikai").insert(row);
    if (error) return new Response("db", { status: 500, headers: CORS });
    return new Response(JSON.stringify({ ok: 1 }), { headers: { ...CORS, "content-type": "application/json" } });
  }

  // v1 (BC Jr 4 faces, and old cached VR pages)
  const program = b?.p === "vr" || b?.p === "jr" ? b.p : null;
  const pamoka = typeof b?.l === "string" && /^[0-9A-Za-z-]{1,6}$/.test(b.l) ? b.l : null;
  const ans = Array.isArray(b?.a) ? b.a.slice(0, 4) : [];
  if (!program || ans.length === 0) return bad();
  const rows = [];
  for (const x of ans) {
    const n = Number(x?.v);
    if (!Q.has(x?.q) || !(n >= 1 && n <= 4) || !Number.isInteger(n)) return bad();
    rows.push({ program, pamoka, klausimas: x.q, atsakymas: n, is_test: b?.t === 1 });
  }
  const { error } = await sb.from("feedback_vaikai").insert(rows);
  if (error) return new Response("db", { status: 500, headers: CORS });
  return new Response(JSON.stringify({ ok: rows.length }), { headers: { ...CORS, "content-type": "application/json" } });
});
