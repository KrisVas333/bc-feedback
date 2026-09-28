// Shared LT Slack formatter for BC feedback (used by feedback-mentor-webhook + feedback-digest).
// Target: private channel #bc-feedback (C0C54R7U4SV, Kris + Gabrielius) via an incoming webhook URL
// stored in private.app_secrets as `slack_webhook_bc_feedback`. No names ever reach here (kids: enum codes only).
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export const KIDS = {
  smagiausia: { istorija: "istorija", vr_zaidimas: "VR žaidimas", komanda: "komandos darbas", uzduotis: "užduotis / galvosūkis", mentorius: "mentorius", kita: "kita" },
  nepatiko: { nieko: "nieko", laukti: "per ilgai laukti", per_sunku: "per sunku", per_lengva: "per lengva", salmas: "šalmas nepatogus", nesupratau: "nesupratau", kita: "kita" },
  panaudos: { seimai: "papasakosiu šeimai", namie: "išbandysiu namie", draugui: "padėsiu draugui", mokykloje: "mokykloje", nezinau: "dar nežinau" },
  daugiau: { vr: "daugiau VR", zaidimu: "daugiau žaidimų", istorijos: "daugiau istorijos", sunkesniu: "sunkesnių užduočių", laiko: "daugiau laiko" },
  rekomenduotu: { taip: "taip", gal: "gal", ne: "ne" },
  kodel: {
    smagu: "buvo smagu", ismokau: "daug išmokau", kartu: "smagu kartu", vr: "VR yra kieta",
    priklauso: "priklauso nuo draugo", nezinau: "dar nežinau", nuobodoka: "kartais nuobodu",
    nuobodu: "buvo nuobodu", per_sunku: "per sunku", salmas: "nepatogus šalmas", kita: "kita",
  },
} as const;
export const KODEL_BY = { taip: ["smagu", "ismokau", "kartu", "vr"], gal: ["priklauso", "nezinau", "nuobodoka"], ne: ["nuobodu", "per_sunku", "salmas", "kita"] } as const;
export const PROBLEMOS = ["šalmas", "baterija", "žaidimas", "casting", "wifi", "instrukcija", "laikas", "elgesys", "kita"];

const PROG: Record<string, string> = { vr: "BC VR", jr: "BC Jr" };
const TRI: Record<string, string> = { taip: "✅", dalinai: "⚠️", ne: "❌" };
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const has = (s: unknown) => s !== null && s !== undefined && String(s).trim() !== "" && String(s).trim().toLowerCase() !== "null";

export async function secret(sb: SupabaseClient, name: string): Promise<string | null> {
  const { data } = await sb.rpc("bc_feedback_secret", { p_name: name });
  return (data as string) ?? null;
}

let goalCache: Record<string, string> | null = null;
async function goalLabels(): Promise<Record<string, string>> {
  if (goalCache) return goalCache;
  // generic goals = what docs/index.html shows when a lesson in lessons.json is still TODO
  const m: Record<string, string> = { kita: "kažką kita", naujo_apie_vr: "kažką naujo apie VR", dirbti_komandoje: "dirbti komandoje", spresti_uzduotis: "spręsti užduotis" };
  try {
    const r = await fetch("https://krisvas333.github.io/bc-feedback/lessons.json", { signal: AbortSignal.timeout(3000) });
    const j = await r.json();
    for (const l of Object.values(j.vr ?? {}) as any[]) for (const g of l.goals ?? []) m[g.id] = g.t;
  } catch { /* labels fall back to codes */ }
  return (goalCache = m);
}

type Row = Record<string, any>;
function top(rows: Row[], key: string, labels: Record<string, string>): string {
  const c: Record<string, number> = {};
  for (const r of rows) if (r[key]) c[r[key]] = (c[r[key]] ?? 0) + 1;
  const e = Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 2);
  return e.length ? e.map(([k, n]) => `${labels[k] ?? k} (${n})`).join(", ") : "–";
}

/** Kids v2 rows for one lesson (program + pamoka + data), same is_test flag. */
export async function kidsRows(sb: SupabaseClient, program: string, pamoka: string | null, data: string | null, isTest: boolean) {
  let q = sb.from("feedback_vaikai").select("id,ivertinimas,smagiausia,nepatiko,ismoko,panaudos,daugiau,rekomenduotu,kodel,slack_posted_at,vieta")
    .eq("versija", 2).eq("program", program).eq("is_test", isTest);
  q = pamoka ? q.eq("pamoka", pamoka) : q.is("pamoka", null);
  q = data ? q.eq("data", data) : q.is("data", null);
  const { data: rows } = await q.limit(500);
  return (rows ?? []) as Row[];
}

export async function kidsLine(rows: Row[]): Promise<string> {
  if (!rows.length) return "👧 Vaikai: dar nėra atsakymų";
  const n = rows.length;
  const avg = rows.reduce((s, r) => s + (r.ivertinimas ?? 0), 0) / n;
  const pct = (v: string) => Math.round((rows.filter((r) => r.rekomenduotu === v).length / n) * 100);
  const g = await goalLabels();
  return [
    `👧 Vaikai: ${n} · ⭐ vid. ${avg.toFixed(1).replace(".", ",")}/10 · 🤝 pakviestų draugą ${pct("taip")} % (gal ${pct("gal")} %, ne ${pct("ne")} %)`,
    `   😄 smagiausia: ${top(rows, "smagiausia", KIDS.smagiausia)} · 😕 nepatiko: ${top(rows, "nepatiko", KIDS.nepatiko)}`,
    `   💡 išmoko: ${top(rows, "ismoko", g)} · ➕ norėtų: ${top(rows, "daugiau", KIDS.daugiau)}`,
  ].join("\n");
}

function head(emoji: string, r: Row, extra: string[] = []): string {
  const parts = [PROG[r.program] ?? r.program, r.pamoka ? `L${r.pamoka}` : "L?", r.vieta || "vieta ?", r.data || "data ?", ...extra];
  return `${r.is_test ? "🧪 TESTAS " : ""}${emoji} *${esc(parts.join(" · "))}*`;
}

/** Mentor row (v2) + kids aggregate for the same lesson → LT mrkdwn text. */
export async function mentorMessage(r: Row, kids: Row[]): Promise<string> {
  const extra: string[] = [];
  if (r.vaiku_sk !== null && r.vaiku_sk !== undefined) extra.push(`${r.vaiku_sk} vaikų`);
  if (r.ivertinimas) extra.push(`⭐ ${r.ivertinimas}/10`);
  const L = [head("🎙️", r, extra)];
  if (has(r.patiko)) L.push(`✅ Patiko: ${esc(r.patiko)}`);
  const nep = [has(r.nepatiko) ? esc(r.nepatiko) : null, has(r.neistrigo) ? `neįstrigo: ${esc(r.neistrigo)}` : null].filter(Boolean);
  if (nep.length) L.push(`❌ Nesuveikė: ${nep.join(" · ")}`);
  const pt: string[] = r.problemu_tipai ?? [];
  const hw = pt.filter((x) => x === "šalmas" || x === "baterija"), other = pt.filter((x) => x !== "šalmas" && x !== "baterija");
  const tech = [`Žaidimas ${TRI[r.zaidimas_veike] ?? "?"}`, `Šalmai ${TRI[r.salmai_veike] ?? "?"}${hw.length ? ` (${esc(hw.join(", "))})` : ""}`];
  if (other.length) tech.push(`kita: ${esc(other.join(", "))}`);
  L.push(`🔧 ${tech.join(" · ")}${has(r.problema) ? ` · ${esc(r.problema)}` : ""}`);
  const gid = [`Gidas: ${esc(r.instrukcija_aiski ?? "?")}`, r.pasitikejimas ? `pasitikėjimas ${r.pasitikejimas}/5` : null, has(r.kur_strigo) ? `strigo: ${esc(r.kur_strigo)}` : null].filter(Boolean);
  L.push(`🧭 ${gid.join(" · ")}`);
  const ist = [r.istorija_vaikams ? `Istorija ${r.istorija_vaikams}/5` : null, has(r.ismoko) ? `išmoko: ${esc(r.ismoko)}` : null,
    has(r.idomiausia) ? `įdomiausia: ${esc(r.idomiausia)}` : null, has(r.prase_daugiau) ? `prašė: ${esc(r.prase_daugiau)}` : null].filter(Boolean);
  if (ist.length) L.push(`🧒 ${ist.join(" · ")}`);
  if (has(r.vaiko_citata)) L.push(`💬 „${esc(r.vaiko_citata)}"`);
  if (has(r.pataisymas)) L.push(`▶ Kitą kartą: ${esc(r.pataisymas)}`);
  L.push(await kidsLine(kids));
  return L.join("\n");
}

/** Kids-only aggregate for one lesson (no mentor call). */
export async function kidsMessage(program: string, pamoka: string | null, data: string | null, isTest: boolean, rows: Row[]): Promise<string> {
  const vieta = rows.find((x) => x.vieta)?.vieta ?? null;
  return `${head("👧", { program, pamoka, data, vieta, is_test: isTest }, ["vaikų atsakymai"])}\n${await kidsLine(rows)}`;
}

/** POST to the incoming webhook. Returns status string; never throws. */
export async function postSlack(sb: SupabaseClient, text: string): Promise<"sent" | "no_secret" | "error"> {
  const url = await secret(sb, "slack_webhook_bc_feedback");
  if (!url) { console.log("slack: secret slack_webhook_bc_feedback missing, skipped"); return "no_secret"; }
  try {
    const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, unfurl_links: false }), signal: AbortSignal.timeout(5000) });
    if (!r.ok) { console.log("slack: http", r.status); return "error"; }
    return "sent";
  } catch (e) { console.log("slack: fetch failed", String(e)); return "error"; }
}
