// Token-protected digest + Slack helper for BC feedback (Bearer = private.app_secrets.bc_feedback_digest_token).
// GET  ?hours=24&test=0|1          -> {since, mentor:[...], vaikai:[...], ratas:[...]} rows since now-hours (bin/feedback-digest.py)
// GET  ?new=1                      -> {messages:[{kind, text, is_test, mentor_ids, vaikai_ids}]} not yet on Slack (v2 only, test rows included, prefixed 🧪 TESTAS)
// POST {action:"mark", mentor:[ids], vaikai:[ids]}          -> sets slack_posted_at (after a manual paste)
// POST {action:"slack", p:"vr", l:"3", data:"YYYY-MM-DD", t:0|1, dry:true|false}
//                                  -> kids-only aggregate for one lesson; posts to Slack unless dry or no secret; marks posted rows
import { createClient } from "npm:@supabase/supabase-js@2";
import { kidsMessage, kidsRows, mentorMessage, postSlack, secret } from "../_shared/slack.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const ids = (x: unknown) => (Array.isArray(x) ? x.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 1000) : []);

async function newMessages() {
  const out: any[] = [];
  const { data: ms } = await sb.from("feedback_mentor").select("*").eq("versija", 2).eq("program", "vr").is("slack_posted_at", null).order("ts").limit(50);
  const covered = new Set<number>();
  for (const m of ms ?? []) {
    const kids = await kidsRows(sb, "vr", m.pamoka, m.data, m.is_test);
    const kidIds = kids.filter((k) => !k.slack_posted_at).map((k) => k.id);
    kidIds.forEach((i) => covered.add(i));
    out.push({ kind: "mentor", text: await mentorMessage(m, kids), is_test: m.is_test, mentor_ids: [m.id], vaikai_ids: kidIds });
  }
  const { data: ks } = await sb.from("feedback_vaikai").select("id,pamoka,data,is_test").eq("versija", 2).is("slack_posted_at", null).order("ts").limit(2000);
  const groups = new Map<string, { pamoka: string | null; data: string | null; is_test: boolean; ids: number[] }>();
  for (const k of ks ?? []) {
    if (covered.has(k.id)) continue;
    const key = `${k.pamoka}|${k.data}|${k.is_test}`;
    if (!groups.has(key)) groups.set(key, { pamoka: k.pamoka, data: k.data, is_test: k.is_test, ids: [] });
    groups.get(key)!.ids.push(k.id);
  }
  for (const g of groups.values()) {
    const rows = await kidsRows(sb, "vr", g.pamoka, g.data, g.is_test);
    out.push({ kind: "vaikai", text: await kidsMessage("vr", g.pamoka, g.data, g.is_test, rows), is_test: g.is_test, mentor_ids: [], vaikai_ids: g.ids });
  }
  return out;
}

Deno.serve(async (req) => {
  const tok = await secret(sb, "bc_feedback_digest_token");
  if (!tok || req.headers.get("authorization") !== `Bearer ${tok}`) return new Response("no", { status: 401 });
  const u = new URL(req.url);

  if (req.method === "POST") {
    let b: any;
    try { b = await req.json(); } catch { return new Response("json", { status: 400 }); }
    const now = new Date().toISOString();
    if (b?.action === "mark") {
      const m = ids(b.mentor), k = ids(b.vaikai);
      if (m.length) await sb.from("feedback_mentor").update({ slack_posted_at: now, slack: "manual" }).in("id", m).is("slack_posted_at", null);
      if (k.length) await sb.from("feedback_vaikai").update({ slack_posted_at: now }).in("id", k).is("slack_posted_at", null);
      return J({ ok: true, mentor: m.length, vaikai: k.length });
    }
    if (b?.action === "slack") {
      if (b.p !== "vr") return new Response("bad", { status: 400 });
      const l = typeof b.l === "string" && /^[0-9A-Za-z-]{1,6}$/.test(b.l) ? b.l : null;
      const d = typeof b.data === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.data) ? b.data : null;
      const isTest = b.t === 1;
      const rows = await kidsRows(sb, "vr", l, d, isTest);
      const text = await kidsMessage("vr", l, d, isTest, rows);
      if (b.dry === true || !rows.length) return J({ slack: "dry", n: rows.length, text });
      const slack = await postSlack(sb, text);
      if (slack === "sent") {
        const k = rows.filter((r) => !r.slack_posted_at).map((r) => r.id);
        if (k.length) await sb.from("feedback_vaikai").update({ slack_posted_at: now }).in("id", k);
      }
      return J({ slack, n: rows.length, text });
    }
    return new Response("bad", { status: 400 });
  }

  if (u.searchParams.get("new") === "1") return J({ messages: await newMessages() });

  const hours = Math.min(Math.max(Number(u.searchParams.get("hours")) || 24, 1), 24 * 60);
  const withTest = u.searchParams.get("test") === "1";
  const since = new Date(Date.now() - hours * 3600e3).toISOString();
  let m = sb.from("feedback_mentor").select("*").gte("ts", since).order("ts");
  let k = sb.from("feedback_vaikai").select("*").gte("ts", since).order("ts");
  let rt = sb.from("feedback_vaikai_ratas").select("*").gte("ts", since).order("ts");
  if (!withTest) { m = m.eq("is_test", false); k = k.eq("is_test", false); rt = rt.eq("is_test", false); }
  const [mr, kr, rr] = await Promise.all([m, k, rt]);
  if (mr.error || kr.error || rr.error) return new Response("db", { status: 500 });
  // conversation_id/agent_id are internal: drop before returning
  const mentor = (mr.data ?? []).map(({ conversation_id: _c, agent_id: _a, ...r }) => r);
  const ratas = (rr.data ?? []).map(({ conversation_id: _c, agent_id: _a, ...r }) => r);
  return J({ since, mentor, vaikai: kr.data, ratas });
});
