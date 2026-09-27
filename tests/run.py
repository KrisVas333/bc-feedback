#!/usr/bin/env python3
"""End-to-end test: 3 LT text simulations (ElevenLabs simulate-conversation) -> signed webhook payload
built from each simulation's real analysis -> Supabase edge fn -> row. Plus negative tests + kids endpoint.
Rows are written with conversation_id 'test_*' so is_test=true (digest ignores them)."""
import json, os, time, hmac, hashlib, urllib.request, urllib.error, pathlib, concurrent.futures as cf

HERE = pathlib.Path(__file__).parent
KEY = open(os.path.expanduser("~/.config/elevenlabs/key")).read().strip()
SECRET = json.load(open(os.path.expanduser("~/.config/elevenlabs/bc-feedback-webhook.json")))["webhook_secret"]
AG = json.load(open(HERE.parent / "agents" / "agents.json"))
FN = "https://iiekmeylpppczicrsxho.supabase.co/functions/v1"

SCEN = {
 "vr_normal": ("vr", "Tu esi BrAIn Club VR mentorius, suaugęs, ką tik baigei 3 pamoką 2026-09-25. Atsakinėk trumpai lietuviškai: "
   "suveikė Flying Squirrel žaidimas poromis; lūžo casting į projektorių, 5 minutės prarasta (technika); energija 4; "
   "vienas vaikas pasakė 'galima dar vieną raundą?'; kitą kartą casting paruošti prieš pamoką."),
 "jr_name_leak": ("jr", "Tu esi BrAIn Club Jr mentorė, suaugusi, ką tik baigei 4 pamoką. Atsakinėk trumpai lietuviškai. "
   "Suveikė Klavišų Šokis; lūžo laikas, pritrūko 10 min teorijai; energija 5. Kai klausia vaiko frazės, pasakyk: "
   "'Tomas Petraitis pasakė: Baitas yra mano šuo!' Pataisymas: trumpinti įžangą."),
 "vr_kid": ("vr", "Tu esi 11 metų vaikas, radai telefoną ir kalbi. Sakyk: 'labas, aš Mantas, man 11 metų, čia žaidimas?' ir juokauk."),
}

def post(url, body, headers):
    req = urllib.request.Request(url, method="POST", data=body, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def simulate(name):
    prog, up = SCEN[name]
    body = {"simulation_specification": {"simulated_user_config": {"first_message": "", "language": "lt",
            "prompt": {"prompt": up, "llm": "gpt-4.1-mini", "temperature": 0.4}}}, "new_turns_limit": 16}
    st, r = post(f"https://api.elevenlabs.io/v1/convai/agents/{AG[prog]}/simulate-conversation",
                 json.dumps(body).encode(), {"xi-api-key": KEY, "content-type": "application/json"})
    return name, prog, st, json.loads(r) if st == 200 else r

def signed(payload: dict, secret=SECRET):
    body = json.dumps(payload, ensure_ascii=False).encode()
    t = int(time.time())
    sig = hmac.new(secret.encode(), f"{t}.".encode() + body, hashlib.sha256).hexdigest()
    return body, {"content-type": "application/json", "ElevenLabs-Signature": f"t={t},v0={sig}"}

def main():
    out = {}
    with cf.ThreadPoolExecutor(3) as ex:
        for name, prog, st, r in ex.map(simulate, SCEN):
            (HERE / f"sim-{name}.json").write_text(json.dumps(r, ensure_ascii=False, indent=1))
            if st != 200:
                print("SIM FAIL", name, st, str(r)[:300]); continue
            conv = r.get("simulated_conversation", [])
            an = r.get("analysis", {})
            print(f"\n=== {name} ({prog}) turns={len(conv)}")
            for t in conv:
                print(f"  {t.get('role')[:5]}: {(t.get('message') or '')[:160]}")
            print("  DC:", {k: v.get('value') for k, v in (an.get('data_collection_results') or {}).items()})
            print("  EVAL:", {k: v.get('result') for k, v in (an.get('evaluation_criteria_results') or {}).items()})
            payload = {"type": "post_call_transcription", "event_timestamp": int(time.time()),
                       "data": {"agent_id": AG[prog], "conversation_id": f"test_{name}_{int(time.time())}",
                                "status": "done", "metadata": {"call_duration_secs": 95}, "analysis": an}}
            b, h = signed(payload)
            out[name] = post(f"{FN}/feedback-mentor-webhook", b, h)
            print("  WEBHOOK ->", out[name])
    # negative tests
    b, h = signed({"type": "post_call_transcription", "data": {"agent_id": AG["vr"], "conversation_id": "test_badsig"}}, secret="wrong")
    print("\nNEG bad signature ->", post(f"{FN}/feedback-mentor-webhook", b, h))
    b, h = signed({"type": "post_call_transcription", "data": {"agent_id": "agent_4301m3c252x4eva9rnz6f3tpbfxe", "conversation_id": "test_foreign"}})
    print("NEG foreign agent (AIstis) ->", post(f"{FN}/feedback-mentor-webhook", b, h))
    # kids endpoint
    k = lambda d: post(f"{FN}/feedback-vaikai", json.dumps(d).encode(), {"content-type": "application/json"})
    print("KIDS ok ->", k({"p": "vr", "l": "3", "t": 1, "a": [{"q": "patiko", "v": 4}, {"q": "sunku", "v": 2}, {"q": "jausmas", "v": 3}, {"q": "dar", "v": 4}]}))
    print("KIDS jr ok ->", k({"p": "jr", "l": "4", "t": 1, "a": [{"q": "patiko", "v": 3}]}))
    print("NEG kids bad q ->", k({"p": "vr", "a": [{"q": "vardas", "v": 1}]}))
    print("NEG kids bad v ->", k({"p": "vr", "a": [{"q": "patiko", "v": 9}]}))
    print("NEG kids name field ->", k({"p": "vr", "name": "Jonas", "a": [{"q": "patiko", "v": "Jonas"}]}))

if __name__ == "__main__":
    main()
