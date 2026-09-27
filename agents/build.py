#!/usr/bin/env python3
"""Create/update the 2 LT mentor feedback agents on ElevenLabs. Idempotent: ids live in agents.json.
Key: ~/.config/elevenlabs/key (never printed). Usage: python3 build.py [--webhook WEBHOOK_ID]"""
import json, os, sys, urllib.request, pathlib

HERE = pathlib.Path(__file__).parent
KEY = open(os.path.expanduser("~/.config/elevenlabs/key")).read().strip()
API = "https://api.elevenlabs.io/v1/convai"
VOICE = "If6gt8kmFRfS5SzLE1Lx"  # "AIstė A2 — šilta, rami, aiški (LT, Voice Design)" — neutral LT, NOT Kris's clone
PROMPT = (HERE / "prompt.md").read_text()

PROGRAMS = {
    "vr": {"name": "BC VR LT — mentorių grįžtamasis ryšys", "PROGRAM_NAME": "BrAIn Club VR",
           "PROGRAM_CONTEXT": "10–14 metų vaikai, Quest akiniai, casting, socialinės ir kognityvinės užduotys",
           "keywords": ["BrAIn Club", "VR", "Quest", "casting", "Flying Squirrel", "headsetas", "akiniai"]},
    "jr": {"name": "BC Jr LT — mentorių grįžtamasis ryšys", "PROGRAM_NAME": "BrAIn Club Jr (Info Gynėjai)",
           "PROGRAM_CONTEXT": "6–8 metų vaikai, 1–2 klasė, kompiuterio pagrindai, Klaidas, Mistė, Baitas, Neuronas",
           "keywords": ["Info Gynėjai", "Klaidas", "Mistė", "Baitas", "Neuronas", "Lekta", "Klavišų Šokis"]},
}

FIRST = ("Labas! Čia {PROGRAM_NAME} AI asistentas, dirbtinis intelektas, ne žmogus. "
         "Pokalbį užrašau tekstu grįžtamajam ryšiui, garsas nesaugomas, užtruksim iki trijų minučių. "
         "Kelinta šiandien buvo pamoka ir kokia data?")

DATA = {
    "pamoka": ("string", "Pamokos numeris, kurį pasakė mentorius, tik skaičius arba trumpas kodas (pvz. 3). Tuščia, jei nepasakė."),
    "data": ("string", "Pamokos data formatu YYYY-MM-DD, jei mentorius ją pasakė; jei sakė 'šiandien' arba nežino, tuščia."),
    "kas_veike": ("string", "Kas suveikė geriausiai, iki 25 žodžių lietuviškai. Be jokių vaikų vardų."),
    "kas_luzo": ("string", "Kas lūžo ar strigo, iki 25 žodžių lietuviškai; 'nieko', jei niekas. Be vaikų vardų."),
    "luzo_tipas": ("string", "Vienas žodis: technika, turinys, laikas, elgesys, kita arba nieko."),
    "energija": ("integer", "Vaikų energija 1–5, kaip pasakė mentorius. Tuščia, jei nepasakė."),
    "citata": ("string", "Viena vaiko frazė, kurią perpasakojo mentorius, iki 20 žodžių. Bet kokį vardą pakeisk į 'vienas vaikas'. Tuščia, jei nebuvo."),
    "pataisymas": ("string", "Vienas dalykas, kurį mentorius pataisytų kitą kartą, iki 25 žodžių."),
}
EVAL = [
    ("ai_disclosed", "Atskleidė AI ir įrašą", "Ar agento pirmas sakinys aiškiai pasakė, kad tai AI asistentas (ne žmogus) ir kad pokalbis įrašomas grįžtamajam ryšiui? Sėkmė, jei taip."),
    ("no_child_names", "Be vaikų vardų", "Ar agentas NEKLAUSĖ ir NEKARTOJO jokio vaiko vardo ar asmens detalės, o jei mentorius pasakė vardą, priminė sakyti 'vienas vaikas'? Sėkmė, jei taip."),
    ("six_answered", "Surinko 6 atsakymus", "Ar agentas uždavė visus 6 klausimus (pamoka/data, kas veikė, kas lūžo, energija 1–5, vaiko frazė, pataisymas), nebent mentorius paprašė baigti anksčiau? Sėkmė, jei taip."),
    ("no_advice", "Tik klausė", "Ar agentas nepateikė patarimų ir nevertino mentoriaus, o tik klausė ir užrašė? Sėkmė, jei taip."),
]

def call(method, url, body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body else None,
                                 headers={"xi-api-key": KEY, "content-type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read() or b"{}")

def config(p, webhook_id=None):
    fill = lambda s: s.replace("{{PROGRAM_NAME}}", p["PROGRAM_NAME"]).replace("{{PROGRAM_CONTEXT}}", p["PROGRAM_CONTEXT"])
    ps = {
        "data_collection": {k: {"type": t, "description": d} for k, (t, d) in DATA.items()},
        "evaluation": {"criteria": [{"id": i, "name": n, "type": "prompt", "conversation_goal_prompt": g} for i, n, g in EVAL]},
        "privacy": {"record_voice": False, "delete_audio": True, "retention_days": 7},
        "call_limits": {"agent_concurrency_limit": 3, "daily_limit": 60},
        "auth": {"enable_auth": False},
        "summary_language": "lt",
    }
    if webhook_id:
        ps["workspace_overrides"] = {"webhooks": {"post_call_webhook_id": webhook_id, "events": ["transcript"], "send_audio": False}}
    return {
        "name": p["name"],
        "tags": ["bc-feedback", "lt", "mentors-only"],
        "conversation_config": {
            "asr": {"quality": "high", "provider": "scribe_realtime", "keywords": p["keywords"]},
            "turn": {"turn_timeout": 8, "silence_end_call_timeout": 30},
            "tts": {"model_id": "eleven_v3_conversational", "voice_id": VOICE, "stability": 0.55, "speed": 1.0, "similarity_boost": 0.8},
            "conversation": {"max_duration_seconds": 240},
            "agent": {
                "language": "lt",
                "first_message": FIRST.replace("{PROGRAM_NAME}", p["PROGRAM_NAME"]),
                "prompt": {"prompt": fill(PROMPT), "llm": "gpt-4.1-mini", "temperature": 0.2,
                           "built_in_tools": {"end_call": {"type": "system", "name": "end_call",
                               "description": "Baigia pokalbį po 6-o klausimo, kai mentorius prašo baigti, arba kai kalba vaikas.",
                               "params": {"system_tool_type": "end_call"}}}},
            },
        },
        "platform_settings": ps,
    }

def main():
    wh = sys.argv[sys.argv.index("--webhook") + 1] if "--webhook" in sys.argv else None
    store = HERE / "agents.json"
    ids = json.loads(store.read_text()) if store.exists() else {}
    for prog, p in PROGRAMS.items():
        cfg = config(p, wh)
        if prog in ids:
            call("PATCH", f"{API}/agents/{ids[prog]}", cfg)
            print("updated", prog, ids[prog])
        else:
            ids[prog] = call("POST", f"{API}/agents/create", cfg)["agent_id"]
            print("created", prog, ids[prog])
    store.write_text(json.dumps(ids, indent=1))

if __name__ == "__main__":
    main()
