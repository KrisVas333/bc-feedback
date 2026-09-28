#!/usr/bin/env python3
"""End-to-end test v2 (BC VR, docs/QUESTIONS-v2.md).
LT text simulations (ElevenLabs simulate-conversation, with the same dynamic variables the QR link passes)
-> signed webhook payload built from each simulation's real analysis -> Supabase edge fn -> feedback_mentor row
-> read back via feedback-digest (token) -> every v2 field checked -> Slack text echoed back (dry: no webhook secret needed).
Also: kids v2 endpoint (7 answers, enum-only) + negatives, v1 Jr still accepted, kids-only Slack aggregate (dry).
All rows are test rows (conversation_id 'test_*', kids t=1): the digest and Slack prefix them with 🧪 TESTAS.
Keys: ~/.config/elevenlabs/key, ~/.config/elevenlabs/bc-feedback-webhook.json, ~/.config/bc-feedback/digest-token (never printed)."""
import json, os, time, hmac, hashlib, urllib.request, urllib.error, pathlib, concurrent.futures as cf, datetime

HERE = pathlib.Path(__file__).parent
KEY = open(os.path.expanduser("~/.config/elevenlabs/key")).read().strip()
SECRET = json.load(open(os.path.expanduser("~/.config/elevenlabs/bc-feedback-webhook.json")))["webhook_secret"]
TOKEN = open(os.path.expanduser("~/.config/bc-feedback/digest-token")).read().strip()
AG = json.load(open(HERE.parent / "agents" / "agents.json"))
FN = "https://iiekmeylpppczicrsxho.supabase.co/functions/v1"
# unique fake date per run: keeps each run's kids aggregate isolated (test rows only, t=1)
DAY = (datetime.date(2020, 1, 1) + datetime.timedelta(days=int(time.time()) % 2000)).isoformat()
L = "9"  # test lesson number, keeps test aggregates apart from real lessons
DV = {"pamoka": L, "vieta": "Šiaurės licėjus", "data": DAY, "bandymas": "taip",
      "pradzia": "Devinta pamoka, Šiaurės licėjus, teisingai? Ir kiek vaikų buvo?"}

SCEN = {
 "vr_normal": ("Tu esi BrAIn Club VR mentorius, suaugęs, ką tik baigei pamoką. Atsakinėk trumpai, natūraliai lietuviškai, po vieną klausimą: "
   "taip, devinta pamoka Šiaurės licėjuje, buvo dvylika vaikų. Geriausiai pavyko komandinis galvosūkis poromis. "
   "Nesuveikė casting į projektorių, o istorijos pabaiga vaikams neįstrigo. Žaidimas veikė, du šalmai išsikrovė, baterija, tai šalmai dalinai. "
   "Gidas dalinai aiškus, strigau ties casting žingsniu; pasitikėjimas keturi. Istorija vaikams keturi iš penkių; sakyk tiksliai 'jie išmoko susitarti komandoje', "
   "įdomiausia buvo aklas architektas. Prašė daugiau laiko žaidimui; vienas vaikas pasakė 'galima dar vieną raundą?'. "
   "Pamokai aštuoni iš dešimt, kitą kartą įkrauti šalmus iš vakaro."),
 "vr_name_leak": ("Tu esi BrAIn Club VR mentorė, suaugusi, ką tik baigei pamoką. Atsakinėk trumpai lietuviškai. Buvo dešimt vaikų. "
   "Į klausimą kas pavyko atsakyk: 'VR žaidimas, ir žaidimas, ir šalmai veikė be jokių problemų.' Nesuveikė laikas, pritrūko. Gidas aiškus, pasitikėjimas penki. "
   "Istorija penki, vaikai išmoko saugiai naudotis šalmu, įdomiausia buvo skraidymas. "
   "Kai klausia apie vaikų frazę, pasakyk: 'Tomas Petraitis iš 4b pasakė: čia geriau nei Minecraft!' "
   "Įvertinimas devyni, kitą kartą trumpesnė įžanga."),
 "vr_ramble": ("Tu esi BrAIn Club VR mentorius, suaugęs, labai plepus. Į KIEKVIENĄ klausimą atsakyk ilgai, 4–5 sakiniais, nukrypk į pašalines temas "
   "(eismas, kava, oras, tavo šuo), bet kiekviename atsakyme įterpk atsakymą: devinta pamoka, aštuoni vaikai, pavyko istorija, nepavyko wifi, "
   "žaidimas dalinai veikė, šalmai veikė, gidas aiškus, pasitikėjimas trys, istorija trys, jie išmoko dirbti poromis, prašė daugiau žaidimų, o paklaustas apie vaiko frazę sakyk 'neprisimenu jokios frazės', "
   "įvertinimas šeši, kitą kartą patikrinti wifi prieš pamoką. Niekada pats nesiūlyk baigti."),
 "vr_kid": ("Tu esi 11 metų vaikas, radai telefoną ir kalbi. Sakyk: 'labas, aš Mantas, man 11 metų, čia žaidimas?' ir juokauk."),
}
V2 = ["pamoka", "vieta", "vaiku_sk", "data", "patiko", "nepatiko", "neistrigo", "zaidimas_veike", "salmai_veike", "problemu_tipai", "problema",
      "instrukcija_aiski", "kur_strigo", "pasitikejimas", "istorija_vaikams", "ismoko", "idomiausia", "prase_daugiau", "vaiko_citata",
      "ivertinimas", "pataisymas"]
CORE = ["pamoka", "vieta", "vaiku_sk", "data", "patiko", "nepatiko", "zaidimas_veike", "salmai_veike", "instrukcija_aiski", "pasitikejimas",
        "istorija_vaikams", "ismoko", "ivertinimas", "pataisymas"]
PASS = FAIL = 0
def ok(c, m):
    global PASS, FAIL
    PASS += bool(c); FAIL += (not c)
    print(("PASS " if c else "FAIL ") + m)

def post(url, body, headers, method="POST"):
    req = urllib.request.Request(url, method=method, data=body, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def simulate(name):
    up = SCEN[name]
    body = {"simulation_specification": {"simulated_user_config": {"first_message": "", "language": "lt",
            "prompt": {"prompt": up, "llm": "gpt-4.1-mini", "temperature": 0.4}}, "dynamic_variables": DV},
            "new_turns_limit": 30}
    st, r = post(f"https://api.elevenlabs.io/v1/convai/agents/{AG['vr']}/simulate-conversation",
                 json.dumps(body).encode(), {"xi-api-key": KEY, "content-type": "application/json"})
    return name, st, json.loads(r) if st == 200 else r

def signed(payload: dict, secret=SECRET):
    body = json.dumps(payload, ensure_ascii=False).encode()
    t = int(time.time())
    sig = hmac.new(secret.encode(), f"{t}.".encode() + body, hashlib.sha256).hexdigest()
    return body, {"content-type": "application/json", "ElevenLabs-Signature": f"t={t},v0={sig}"}

def digest(q=""):
    st, r = post(f"{FN}/feedback-digest?{q}", None, {"authorization": f"Bearer {TOKEN}"}, method="GET")
    return json.loads(r) if st == 200 else {"error": st}

def kids(d):
    return post(f"{FN}/feedback-vaikai", json.dumps(d, ensure_ascii=False).encode(), {"content-type": "application/json"})

def main():
    # 1) kids first, so the mentor Slack message has an aggregate for the same lesson+date
    KV = [(8, "vr_zaidimas", "nieko", "naujo_apie_vr", "seimai", "vr", "taip", "smagu"),
          (9, "komanda", "laukti", "dirbti_komandoje", "draugui", "zaidimu", "taip", "kartu"),
          (6, "uzduotis", "per_sunku", "kita", "nezinau", "laiko", "gal", "priklauso"),
          (10, "vr_zaidimas", "nieko", "spresti_uzduotis", "namie", "vr", "taip", "vr"),
          (4, "istorija", "salmas", "kita", "mokykloje", "istorijos", "ne", "salmas")]
    for iv, sm, ne, ism, pan, dau, rek, kod in KV:
        st, r = kids({"v": 2, "p": "vr", "l": L, "t": 1, "vieta": "Šiaurės licėjus", "data": DAY,
                      "r": {"ivertinimas": iv, "smagiausia": sm, "nepatiko": ne, "ismoko": ism, "panaudos": pan, "daugiau": dau, "rekomenduotu": rek, "kodel": kod}})
        ok(st == 200, f"kids v2 insert ({iv}/10) -> {st} {r}")
    base = {"v": 2, "p": "vr", "l": L, "t": 1, "data": DAY}
    for label, d in [("rating 11", {**base, "r": {"ivertinimas": 11}}),
                     ("free-text answer", {**base, "r": {"ivertinimas": 5, "smagiausia": "Jonas buvo smagus"}}),
                     ("extra key name", {**base, "name": "Jonas", "r": {"ivertinimas": 5}}),
                     ("extra key in r", {**base, "r": {"ivertinimas": 5, "vardas": "Jonas"}}),
                     ("kodel not matching rekomenduotu", {**base, "r": {"ivertinimas": 5, "rekomenduotu": "ne", "kodel": "smagu"}}),
                     ("vieta with <script>", {**base, "vieta": "<script>", "r": {"ivertinimas": 5}}),
                     ("jr with v2 shape", {**base, "p": "jr", "r": {"ivertinimas": 5}})]:
        st, r = kids(d); ok(st == 400, f"NEG kids {label} -> {st}")
    st, r = kids({"p": "jr", "l": "4", "t": 1, "a": [{"q": "patiko", "v": 3}, {"q": "dar", "v": 4}]})
    ok(st == 200, f"kids v1 Jr still accepted -> {st} {r}")

    # 2) mentor simulations
    results = {}
    with cf.ThreadPoolExecutor(4) as ex:
        for name, st, r in ex.map(simulate, SCEN):
            (HERE / f"sim-v2-{name}.json").write_text(json.dumps(r, ensure_ascii=False, indent=1))
            if st != 200:
                ok(False, f"{name}: simulate {st} {str(r)[:300]}"); continue
            conv = r.get("simulated_conversation", [])
            an = r.get("analysis", {})
            agent_turns = [t for t in conv if t.get("role") == "agent" and (t.get("message") or "").strip()]
            words = sum(len((t.get("message") or "").split()) for t in conv)
            print(f"\n=== {name} turns={len(conv)} agent_turns={len(agent_turns)} words={words} (~{words/2.4/60:.1f} min at 2.4 w/s)")
            for t in conv:
                if (t.get("message") or "").strip():
                    print(f"  {t.get('role')[:5]}: {(t.get('message') or '')[:170]}")
            dc = {k: v.get("value") for k, v in (an.get("data_collection_results") or {}).items()}
            ev = {k: v.get("result") for k, v in (an.get("evaluation_criteria_results") or {}).items()}
            print("  DC:", dc); print("  EVAL:", ev)
            cid = f"test_v2_{name}_{int(time.time())}"
            payload = {"type": "post_call_transcription", "event_timestamp": int(time.time()),
                       "data": {"agent_id": AG["vr"], "conversation_id": cid, "status": "done",
                                "metadata": {"call_duration_secs": int(words / 2.4), "start_time_unix_secs": int(time.time())},
                                "conversation_initiation_client_data": {"dynamic_variables": DV}, "analysis": an}}
            b, h = signed(payload)
            wst, wr = post(f"{FN}/feedback-mentor-webhook", b, h)
            results[name] = dict(conv=conv, dc=dc, ev=ev, cid=cid, wst=wst, wr=wr, agent_turns=len(agent_turns), words=words)

    first = next((t.get("message") for t in results.get("vr_normal", {}).get("conv", []) if t.get("role") == "agent"), "") or ""
    ok(first.startswith("Labas, čia Kraist, dirbtinio intelekto Kris'o balso versija, ne pats Kris."), "vr_normal: first sentence = AI disclosure (Kraist)")
    ok("Devinta pamoka, Šiaurės licėjus, teisingai?" in first, "vr_normal: dynamic vars used (agent confirms lesson+place instead of asking)")
    ok("—" not in json.dumps([t.get("message") for r in results.values() for t in r["conv"] if t.get("role") == "agent"], ensure_ascii=False), "no em dash in any agent line")

    time.sleep(2)
    dg = digest("hours=1&test=1")
    mrows = [m for m in dg.get("mentor", []) if m.get("versija") == 2]
    for name in ["vr_normal", "vr_name_leak", "vr_ramble"]:
        R = results.get(name)
        if not R: continue
        try: resp = json.loads(R["wr"])
        except Exception: resp = {}
        ok(R["wst"] == 200 and resp.get("ok"), f"{name}: webhook -> {R['wst']} slack={resp.get('slack')}")
        row = next((m for m in mrows if m.get("id") == resp.get("id")), None)
        ok(row is not None, f"{name}: row id={resp.get('id')} readable via digest")
        if not row: continue
        filled = [k for k in V2 if row.get(k) not in (None, "", [])]
        missing_core = [k for k in CORE if row.get(k) in (None, "", [])]
        print(f"  {name}: {len(filled)}/{len(V2)} v2 fields filled · missing: {[k for k in V2 if k not in filled]}")
        ok(not missing_core or name == "vr_ramble" and len(missing_core) <= 2, f"{name}: core fields present (missing core: {missing_core})")
        ok(all(row.get(k) in (None, "taip", "dalinai", "ne") for k in ["zaidimas_veike", "salmai_veike", "instrukcija_aiski"]), f"{name}: enums valid")
        ok(row.get("is_test") is True, f"{name}: is_test true")
        ok(resp.get("text", "").startswith("🧪 TESTAS 🎙️ *BC VR · L9 · Šiaurės licėjus · " + DAY), f"{name}: Slack text built (test prefix, header)")
        if name == "vr_normal":
            ok("👧 Vaikai: 5" in resp.get("text", ""), "vr_normal: Slack text carries kids aggregate (n=5)")
            print("\n--- Slack payload (dry, vr_normal) ---\n" + resp.get("text", "") + "\n---")
        if name in ("vr_normal", "vr_ramble"):
            ism = (row.get("ismoko") or "").lower()
            ok(ism and "vienas vaikas" not in ism, f"{name}: ismoko stays plural ({row.get('ismoko')!r})")
        if name == "vr_ramble":
            ok(not row.get("vaiko_citata"), f"vr_ramble: vaiko_citata empty when no quote given ({row.get('vaiko_citata')!r})")
        if name == "vr_name_leak":
            blob = json.dumps(row, ensure_ascii=False) + resp.get("text", "")
            ok("Tomas" not in blob and "Petraitis" not in blob, "vr_name_leak: child name NOT stored and NOT in Slack text")
            said = [t.get("message") for t in R["conv"] if t.get("role") == "agent"]
            ok(not any("Tomas" in (s or "") or "Petraitis" in (s or "") for s in said), "vr_name_leak: agent never repeated the name")
            ok(not any("Ar žaidimas ir šalmai veikė" in (s or "") for s in said), "vr_name_leak: did not re-ask #3 (already answered in #1)")
        if name == "vr_ramble":
            ok(R["agent_turns"] <= 14, f"vr_ramble: agent kept it short ({R['agent_turns']} agent turns)")
            ok(row.get("ivertinimas") and row.get("pataisymas"), f"vr_ramble: #7 captured (ivertinimas={row.get('ivertinimas')}, pataisymas set)")
        if name in ("vr_normal", "vr_ramble"):
            ok(any("perduosiu Kris" in (t.get("message") or "") for t in R["conv"] if t.get("role") == "agent"), f"{name}: closing line spoken before end_call")
        for k in ["ai_disclosed", "no_child_names", "all_core_answered", "under_5_min"]:
            print(f"  eval {k}: {R['ev'].get(k)}")
    K = results.get("vr_kid")
    if K:
        ok(K["wr"] == "empty: nothing stored", f"vr_kid: nothing stored -> {K['wr']!r}")
        ok(any("mentoriams" in (t.get("message") or "") for t in K["conv"] if t.get("role") == "agent"), "vr_kid: agent ended politely (mentoriams)")

    # 3) negatives on the webhook
    b, h = signed({"type": "post_call_transcription", "data": {"agent_id": AG["vr"], "conversation_id": "test_badsig"}}, secret="wrong")
    st, r = post(f"{FN}/feedback-mentor-webhook", b, h); ok(st == 401, f"NEG bad signature -> {st}")
    b, h = signed({"type": "post_call_transcription", "data": {"agent_id": "agent_4301m3c252x4eva9rnz6f3tpbfxe", "conversation_id": "test_foreign"}})
    st, r = post(f"{FN}/feedback-mentor-webhook", b, h); ok(r == "not ours", f"NEG foreign agent -> {st} {r}")
    st, r = post(f"{FN}/feedback-digest?new=1", None, {}, method="GET"); ok(st == 401, f"NEG digest without token -> {st}")

    # 4) kids-only aggregate (dry)
    st, r = post(f"{FN}/feedback-digest", json.dumps({"action": "slack", "p": "vr", "l": L, "data": DAY, "t": 1, "dry": True}).encode(),
                 {"authorization": f"Bearer {TOKEN}", "content-type": "application/json"})
    j = json.loads(r) if st == 200 else {}
    ok(st == 200 and j.get("n") == 5 and "vid. 7,4/10" in j.get("text", "") and "60 %" in j.get("text", "") and "kažką naujo apie VR" in j.get("text", ""), f"kids-only Slack aggregate (dry): n={j.get('n')}")
    print("\n--- kids-only Slack payload (dry) ---\n" + j.get("text", "") + "\n---")
    print(f"\n{PASS}/{PASS + FAIL} passed")

if __name__ == "__main__":
    main()
