#!/usr/bin/env python3
"""Create/update the 2 LT mentor feedback agents on ElevenLabs. Idempotent: ids live in agents.json.
v2 (2026-09-28): BC VR uses prompt-vr.md + docs/QUESTIONS-v2.md fields; BC Jr keeps the v1 questions.
Both speak in Kraist v2 (Kris's voice clone). Rollback VR: backup-v1-vr.json.
Key: ~/.config/elevenlabs/key (never printed). Webhook id: ~/.config/elevenlabs/bc-feedback-webhook.json.
Usage: python3 build.py [vr|jr|ratas ...]   (default all three)"""
import json, os, sys, urllib.request, pathlib

HERE = pathlib.Path(__file__).parent
KEY = open(os.path.expanduser("~/.config/elevenlabs/key")).read().strip()
API = "https://api.elevenlabs.io/v1/convai"
VOICE = "UobNtYFTcCUxlYZA6j6J"  # Kraist v2 = Kris's own voice clone (IVC). v1 used AIstė A2 If6gt8kmFRfS5SzLE1Lx
PROMPT = (HERE / "prompt.md").read_text()          # BC Jr (v1 questions, unchanged)
PROMPT_VR = (HERE / "prompt-vr.md").read_text()    # BC VR v2
PROMPT_RATAS = (HERE / "prompt-ratas.md").read_text()  # BC VR "Vaikų ratas" (mentor relays the class's answers)
# TTS model for ALL agents. Chosen 2026-09-29: eleven_v4 (non-turbo) = most advanced model the agent API accepts for LT
# (eleven_v3_conversational is superseded). Measured over WebSocket: first audio after text turn ~2.9 s vs ~2.3 s for
# eleven_v4_turbo (+~0.6 s/turn). Fallback if calls feel slow: set "eleven_v4_turbo" and rerun build.py.
TTS_MODEL = "eleven_v4"
# Vaikų ratas needs stricter turn logic (child detection, spoken goodbye before end_call) than the mentor call
LLM_RATAS = "gpt-4.1"
# public agents (no signed URL), but only these browser origins may open a call (docs/skambutis.html + ElevenLabs talk-to)
ALLOW = [{"hostname": "krisvas333.github.io"}, {"hostname": "elevenlabs.io"}]
WEBHOOK_ID = json.load(open(os.path.expanduser("~/.config/elevenlabs/bc-feedback-webhook.json")))["webhook_id"]

PROGRAMS = {
    "vr": {"name": "BC VR LT v2 · mentorių grįžtamasis ryšys (Kraist)", "PROGRAM_NAME": "BrAIn Club VR",
           "PROGRAM_CONTEXT": "10–14 metų vaikai, Quest akiniai, casting, socialinės ir kognityvinės užduotys",
           "keywords": ["BrAIn Club", "VR", "Quest", "casting", "Flying Squirrel", "headsetas", "akiniai", "šalmas", "Šiaurės licėjus", "Gabrielius", "Kraist"]},
    "jr": {"name": "BC Jr LT · mentorių grįžtamasis ryšys", "PROGRAM_NAME": "BrAIn Club Jr (Info Gynėjai)",
           "PROGRAM_CONTEXT": "6–8 metų vaikai, 1–2 klasė, kompiuterio pagrindai, Klaidas, Mistė, Baitas, Neuronas",
           "keywords": ["Info Gynėjai", "Klaidas", "Mistė", "Baitas", "Neuronas", "Lekta", "Klavišų Šokis"]},
    "ratas": {"name": "BC VR LT · Vaikų ratas (Kraist)", "PROGRAM_NAME": "BrAIn Club VR",
              "PROGRAM_CONTEXT": "mentorius perduoda klasės (3–6 kl.) atsakymus",
              "keywords": ["BrAIn Club", "VR", "Quest", "casting", "Šiaurės licėjus", "Gabrielius", "Kraist", "vidurkis", "rankų", "iš"]},
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

# ---------- BC VR v2 (docs/QUESTIONS-v2.md) ----------
FIRST_VR = ("Labas, čia Kraist, dirbtinio intelekto Kris'o balso versija, ne pats Kris. "
            "Tris minutes paklausiu apie pamoką, garsas nesaugomas. {{pradzia}}")
# talk-to link may carry ?var_pamoka=&var_vieta=&var_data=&var_bandymas=&var_pradzia= (qr.html builds them)
VARS_VR = {"pradzia": "Kuri pamoka, kur vedei ir kiek vaikų buvo?", "pamoka": "", "vieta": "", "data": "", "bandymas": "ne"}
NN = " Jei mentorius pasakė konkretaus vaiko vardą, jį pakeisk į 'vienas vaikas'; kitaip daugiskaitą ('vaikai', 'jie') palik kaip pasakyta."
ONLY = " Tik tai, ką mentorius pats pasakė, jo žodžiais, trumpai. Nieko nepridėk ir neišvesk. Jei nepasakė, palik tuščią."
TRI = ["taip", "dalinai", "ne"]
EMPTY = " Tuščia, jei nepasakė."
DATA_VR = {k: (t, d + ONLY, e) for k, (t, d, e) in {
    "pamoka": ("string", "Pamokos numeris, tik skaičius (pvz. 3). Jei mentorius patvirtino agento pasakytą pamoką, tas skaičius.", None),
    "vieta": ("string", "Mokykla ar vieta, kur vyko pamoka, iki 6 žodžių, VARDININKO linksniu (pvz. „Šiaurės licėjus“, ne „Šiaurės licėjuje“).", None),
    "vaiku_sk": ("integer", "Kiek vaikų buvo pamokoje, sveikas skaičius 0–60." + EMPTY, None),
    "patiko": ("string", "Kas šiandien pavyko geriausiai, iki 25 žodžių lietuviškai." + NN, None),
    "nepatiko": ("string", "Kas nesuveikė, iki 25 žodžių lietuviškai; 'nieko', jei mentorius taip pasakė." + NN, None),
    "neistrigo": ("string", "Kas vaikams neįstrigo ar liko nesuprasta, iki 20 žodžių." + NN, None),
    "zaidimas_veike": ("string", "Ar VR žaidimas veikė: tiksliai viena reikšmė iš: taip, dalinai, ne." + EMPTY, TRI),
    "salmai_veike": ("string", "Ar šalmai (Quest akiniai) veikė: tiksliai viena reikšmė iš: taip, dalinai, ne." + EMPTY, TRI),
    "problemu_tipai": ("string", "Problemų tipai, atskirti kableliais, TIK iš sąrašo: šalmas, baterija, žaidimas, casting, wifi, instrukcija, laikas, elgesys, kita.", None),
    "problema": ("string", "Kas tiksliai lūžo, iki 20 žodžių.", None),
    "instrukcija_aiski": ("string", "Ar mentoriaus gidas (instrukcija) buvo aiškus: tiksliai viena reikšmė iš: taip, dalinai, ne." + EMPTY, TRI),
    "kur_strigo": ("string", "Kur gide ar pamokos eigoje mentorius strigo, iki 20 žodžių.", None),
    "pasitikejimas": ("integer", "Kaip mentorius jautėsi vesdamas (pasitikėjimas), sveikas skaičius 1–5." + EMPTY, None),
    "istorija_vaikams": ("integer", "Kaip vaikams sekėsi su istorija, sveikas skaičius 1–5, kurį pasakė mentorius." + EMPTY, None),
    "ismoko": ("string", "Ką vaikai išmoko, iki 20 žodžių." + NN, None),
    "idomiausia": ("string", "Kas vaikams buvo įdomiausia, iki 15 žodžių." + NN, None),
    "prase_daugiau": ("string", "Ko vaikai prašė daugiau, iki 15 žodžių." + NN, None),
    "vaiko_citata": ("string", "Viena vaiko frazė, iki 20 žodžių, tik jei mentorius perpasakojo konkrečią vaiko frazę, kitaip tuščia. Vardą pakeisk į 'vienas vaikas'.", None),
    "ivertinimas": ("integer", "Mentoriaus pamokos įvertinimas, sveikas skaičius 1–10." + EMPTY, None),
    "pataisymas": ("string", "Vienas konkretus dalykas, kurį mentorius pakeistų kitą kartą, iki 25 žodžių.", None),
}.items()}
EVAL_VR = [
    ("ai_disclosed", "Atskleidė AI", "Ar agento pirmas sakinys aiškiai pasakė, kad tai dirbtinio intelekto Kris'o balso versija, ne pats Kris, ir kad garsas nesaugomas? Sėkmė, jei taip."),
    ("no_child_names", "Be vaikų vardų", "Ar agentas NEKLAUSĖ ir NEKARTOJO jokio vaiko vardo ar asmens detalės, o jei mentorius pasakė vardą, priminė sakyti 'vienas vaikas'? Sėkmė, jei taip."),
    ("all_core_answered", "Surinko pagrindą", "Ar surinkta: pamoka, vaikų skaičius, kas pavyko, kas nesuveikė, ar veikė žaidimas ir šalmai, įvertinimas 1–10 ir vienas pataisymas? Sėkmė, jei visi 7 yra, nebent mentorius paprašė baigti anksčiau arba kalbėjo vaikas."),
    ("under_5_min", "Iki 5 minučių", "Ar pokalbis buvo trumpas ir susikaupęs: agentas nekartojo klausimų, darė ne daugiau kaip vieną patikslinimą per klausimą ir baigė per 8 klausimus (tikslas 2–3 min., ne ilgiau 5 min.)? Sėkmė, jei taip."),
]

# ---------- BC VR "Vaikų ratas" (mentor runs the call in front of the class; kids never use ElevenLabs) ----------
FIRST_RATAS = ("Labas, čia Kraist, dirbtinio intelekto Kris'o balso versija. Aš užduosiu klausimus klasei garsiai, "
               "o tu, mentoriau, laikyk mygtuką ir perduok atsakymus. {{pradzia}}")
VARS_RATAS = {"pradzia": "Kuri pamoka, kur ir kiek vaikų?", "pamoka": "", "vieta": "", "data": "", "vaiku_sk": "", "bandymas": "ne"}
GRP = " Tik tai, ką apie VISĄ GRUPĘ perdavė suaugęs mentorius (trečiu asmeniu: „dauguma“, „keli vaikai“), jo žodžiais, trumpai. Ignoruok viską, ką vaikas pasakė tiesiogiai agentui pirmu asmeniu. Jokių vardų. Jei nepasakė, palik tuščią."
DATA_RATAS = {
    "pamoka": ("string", "Pamokos numeris, tik skaičius (pvz. 3), kurį pasakė ar patvirtino mentorius. Tuščia, jei nežinoma.", None),
    "vieta": ("string", "Mokykla ar vieta, iki 6 žodžių, VARDININKO linksniu (pvz. „Šiaurės licėjus“), kurią pasakė ar patvirtino mentorius. Tuščia, jei nežinoma.", None),
    "vaiku_sk": ("integer", "Kiek vaikų buvo pamokoje, sveikas skaičius 0–60, kaip pasakė ar patvirtino mentorius. Tuščia, jei nežinoma.", None),
    "ivertinimas_vid": ("number", "Klasės pamokos įvertinimo vidurkis 1–10, kaip perdavė mentorius (jei pasakė kelis skaičius, jų vidurkis, viena dešimtainė). Tuščia, jei nepasakė.", None),
    "smagiausia": ("string", "Kas vaikams buvo smagiausia, iki 20 žodžių." + GRP, None),
    "nepatiko": ("string", "Kas vaikams nepatiko ar buvo per sunku, iki 20 žodžių; 'nieko', jei mentorius taip pasakė." + GRP, None),
    "ismoko": ("string", "Ką vaikai išmoko, iki 20 žodžių." + GRP, None),
    "panaudos": ("string", "Kur vaikai tai panaudos, iki 15 žodžių." + GRP, None),
    "daugiau": ("string", "Ko vaikai norėtų daugiau, iki 15 žodžių." + GRP, None),
    "rekomenduotu_kiek": ("string", "Kiek vaikų pakviestų draugą, formatu 'X iš Y' (pvz. '9 iš 12'), kaip perdavė mentorius. Jei pasakė tik X, rašyk tik X. Tuščia, jei nepasakė.", None),
    "kodel": ("string", "Kodėl vaikai pakviestų (ar ne) draugą, iki 20 žodžių." + GRP, None),
    "vaiko_citata": ("string", "Viena vaiko frazė iki 20 žodžių, TIK jei mentorius ją perpasakojo. Bet kokį vardą pašalink ('vienas vaikas'). Niekada nerašyk to, ką vaikas pasakė tiesiogiai agentui. Tuščia, jei nebuvo.", None),
    "mentorius_perdave": ("boolean", "true, jei suaugęs mentorius (trečiu asmeniu, be vaiko požymių) perdavė bent vieną grupės atsakymą į klasės klausimus (1–8); false, jei atsakinėjo vaikas (kalbėjo pirmu asmeniu apie save: „aš“, „man“, prisistatė vardu ar amžiumi, kreipėsi „Kraist“) arba niekas neatsakė.", None),
    "vaiko_replikos": ("integer", "Kiek agento pokalbio replikų pasakė vaikas, kalbėdamas tiesiogiai agentui pirmu asmeniu apie save (prisistatė vardu ar amžiumi, „aš“, „man patiko“, kreipėsi „Kraist“). 0, jei nė vienos.", None),
}
EVAL_RATAS = [
    ("ai_disclosed", "Atskleidė AI", "Ar agento pirmas sakinys aiškiai pasakė, kad tai dirbtinio intelekto Kris'o balso versija ir kad mentorius perduoda atsakymus? Sėkmė, jei taip."),
    ("no_child_names", "Be vaikų vardų", "Ar agentas NEKLAUSĖ ir NEKARTOJO jokio vaiko vardo, amžiaus ar asmens detalės? Sėkmė, jei taip."),
    ("child_redirected", "Vaikas nukreiptas", "Jei pokalbyje vaikas kalbėjo tiesiogiai agentui, ar agentas atsakė 'Atsakymus perduoda mentorius' ir nesikalbėjo su vaiku? Sėkmė, jei taip arba jei vaikas nekalbėjo."),
    ("all_asked", "Visi klausimai", "Ar agentas klasei uždavė visus 8 klausimus (įvertinimas, smagiausia, nepatiko, išmoko, kur panaudos, ko daugiau, ar pakviestų draugą, kodėl), nebent mentorius paprašė baigti anksčiau ar kalbėjo tik vaikas? Sėkmė, jei taip."),
]

def call(method, url, body=None):
    req = urllib.request.Request(url, method=method, data=json.dumps(body).encode() if body else None,
                                 headers={"xi-api-key": KEY, "content-type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read() or b"{}")

def dc_item(t, d, enum=None):
    it = {"type": t, "description": d}
    if enum: it["enum"] = enum
    return it

def config(prog, p, webhook_id=None):
    fill = lambda s: s.replace("{{PROGRAM_NAME}}", p["PROGRAM_NAME"]).replace("{{PROGRAM_CONTEXT}}", p["PROGRAM_CONTEXT"])
    v2 = prog == "vr"
    ratas = prog == "ratas"
    if ratas:
        data, ev = {k: dc_item(*v) for k, v in DATA_RATAS.items()}, EVAL_RATAS
    else:
        data = {k: dc_item(*v) for k, v in DATA_VR.items()} if v2 else {k: dc_item(t, d) for k, (t, d) in DATA.items()}
        ev = EVAL_VR if v2 else EVAL
    ps = {
        "data_collection": data,
        "evaluation": {"criteria": [{"id": i, "name": n, "type": "prompt", "conversation_goal_prompt": g} for i, n, g in ev]},
        "privacy": {"record_voice": False, "delete_audio": True, "retention_days": 7},
        "call_limits": {"agent_concurrency_limit": 3, "daily_limit": 60},
        "auth": {"enable_auth": False, "allowlist": ALLOW},
        "summary_language": "lt",
    }
    if webhook_id:
        ps["workspace_overrides"] = {"webhooks": {"post_call_webhook_id": webhook_id, "events": ["transcript"], "send_audio": False}}
    if ratas:
        # two-step close: the goodbye is a text-only turn (docs/skambutis.html ends the session when it hears it);
        # end_call is only the fallback on the NEXT turn. gpt-4.1(-mini) otherwise emits a silent end_call (seen in sims).
        end_desc = ("Baigia pokalbį. Kviesk TIK jei tavo ANKSTESNĖ replika jau buvo atsisveikinimas ('Ačiū, komanda! Mentoriau, ačiū, "
                    "perduosiu Kris'ui ir Gabrieliui.' arba 'Atsakymus perduoda mentorius. Iki!') ir kažkas vėl kalba, "
                    "arba jei mentorius paprašė baigti ir tu jau padėkojai.")
    elif v2:
        end_desc = ("Baigia pokalbį. Kviesk TIK tame pačiame atsakyme, kuriame JAU parašei atsisveikinimo tekstą (po 7 klausimo: 'Ačiū, perduosiu Kris'ui ir Gabrieliui. Gero vakaro!'; jei kalba vaikas: 'Šis pokalbis skirtas mentoriams, ačiū!'). Niekada nekviesk be teksto.")
    else:
        end_desc = "Baigia pokalbį po 6-o klausimo, kai mentorius prašo baigti, arba kai kalba vaikas."
    first = FIRST_RATAS if ratas else FIRST_VR if v2 else FIRST.replace("{PROGRAM_NAME}", p["PROGRAM_NAME"])
    return {
        "name": p["name"],
        "tags": ["bc-feedback", "lt", "mentors-only"] + (["vaiku-ratas"] if ratas else []),
        "conversation_config": {
            "asr": {"quality": "high", "provider": "scribe_realtime", "keywords": p["keywords"]},
            # Vaikų ratas: long silences are normal (kids think, mic is muted until the mentor holds the button)
            "turn": {"turn_timeout": 30, "silence_end_call_timeout": 120} if ratas else {"turn_timeout": 8, "silence_end_call_timeout": 30},
            "tts": {"model_id": TTS_MODEL, "voice_id": VOICE, "stability": 0.55, "speed": 1.0, "similarity_boost": 0.8},
            "conversation": {"max_duration_seconds": 360 if ratas else 300 if v2 else 240, "file_input": {"enabled": False}},
            "agent": {
                "language": "lt",
                "first_message": first,
                "dynamic_variables": {"dynamic_variable_placeholders": VARS_RATAS if ratas else VARS_VR if v2 else {}},
                **({"max_conversation_duration_message": "Laikas baigėsi. Ačiū, perduosiu Kris'ui ir Gabrieliui!"} if (v2 or ratas) else {}),
                "prompt": {"prompt": PROMPT_RATAS if ratas else PROMPT_VR if v2 else fill(PROMPT), "llm": LLM_RATAS if ratas else "gpt-4.1-mini", "temperature": 0.2,
                           "built_in_tools": {"end_call": {"type": "system", "name": "end_call", "description": end_desc,
                               "params": {"system_tool_type": "end_call"}}}},
            },
        },
        "platform_settings": ps,
    }

def main():
    wh = WEBHOOK_ID  # always re-attach the per-agent webhook, a PATCH without it would drop it
    only = [a for a in sys.argv[1:] if a in PROGRAMS] or list(PROGRAMS)
    store = HERE / "agents.json"
    ids = json.loads(store.read_text()) if store.exists() else {}
    for prog, p in PROGRAMS.items():
        if prog not in only: continue
        cfg = config(prog, p, wh)
        if prog in ids:
            call("PATCH", f"{API}/agents/{ids[prog]}", cfg)
            print("updated", prog, ids[prog])
        else:
            ids[prog] = call("POST", f"{API}/agents/create", cfg)["agent_id"]
            print("created", prog, ids[prog])
    store.write_text(json.dumps(ids, indent=1))

if __name__ == "__main__":
    main()
