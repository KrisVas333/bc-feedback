# BC VR feedback v2 · klausimai (Kris'o sąrašas → ≤3 min.)

Principai: After-Action Review (kas turėjo įvykti · kas įvyko · kodėl · ką keičiam) + Dublino Fireflies modelis. Vienas posūkis = vienas klausimas, sujungiant artimus. Agentas neklausia to, kas jau pasakyta. Data = pokalbio laikas (neklausiama). Tikslas 2–3 min., kietas limitas 5 min.

## 🎙️ Mentoriaus agentas (BC VR LT, Kraist balsas)

| # | Agentas klausia (LT) | Dengia Kris'o klausimus | Laukai |
|---|---|---|---|
| 0 | „Labas, čia Kraist, dirbtinio intelekto Kris'o balso versija, ne pats Kris. Tris minutes paklausiu apie pamoką, garsas nesaugomas. Kuri pamoka, kur vedei ir kiek vaikų buvo?" | pamoka · vieta · vaikų sk. | `pamoka`, `vieta`, `vaiku_sk` (+ `data` auto) |
| 1 | „Kas šiandien pavyko geriausiai?" | ką patiko | `patiko` |
| 2 | „O kas nesuveikė arba vaikams neįstrigo?" | ko nepatiko · kas neįstrigo | `nepatiko`, `neistrigo` |
| 3 | „Ar žaidimas ir šalmai veikė? Jei kas lūžo, kas tiksliai?" | žaidimas · šalmas · problemų tipas | `zaidimas_veike` taip/dalinai/ne · `salmai_veike` taip/dalinai/ne · `problemu_tipai` [šalmas, baterija, žaidimas, casting, wifi, instrukcija, laikas, elgesys, kita] · `problema` |
| 4 | „Ar gidas buvo aiškus ir kaip jauteisi vesdamas, nuo 1 iki 5?" | instrukcija aiški · (mentoriaus patirtis) | `instrukcija_aiski` taip/dalinai/ne · `kur_strigo` · `pasitikejimas` 1–5 |
| 5 | „Kaip vaikams sekėsi su istorija? Ką jie išmoko ir kas buvo įdomiausia?" | istorija · ką išmoko · kas įdomu | `istorija_vaikams` 1–5 · `ismoko` · `idomiausia` |
| 6 | „Ko vaikai prašė daugiau? Gal prisimeni vieną jų frazę, be vardo?" | ko prašo daugiau | `prase_daugiau` · `vaiko_citata` |
| 7 | „Nuo 1 iki 10, kiek balų pamokai? Ir ką vieną pakeistum kitą kartą?" | įvertinimas · ką patobulinti | `ivertinimas` 1–10 · `pataisymas` |
| ✓ | „Ačiū, perduosiu Kris'ui ir Gabrieliui. Gero vakaro!" → end_call | | |

**Pridėta virš Kris'o sąrašo (kodėl):** `pasitikejimas` 1–5 (mentoriaus patirtis, tai tikslas; Dublino modelis) · `vaiko_citata` (gyvas balsas be vardo) · `pataisymas` = vienas konkretus veiksmas (AAR „ką keičiam", kitaip grįžtamasis ryšys neįgyvendinamas).
**Taisyklės:** jokių vaikų vardų (agentas perrašo „vienas vaikas") · jei kalba vaikas → mandagiai baigia · jei atsakymas trumpas, 1 patikslinimas, ne daugiau · po 4:00 praleidžia likusius ir klausia tik #7.

## 👧 Vaikų puslapis (3–6 kl., BE balso įrašo, tik paspaudimai; klausimus skaito Kraist 🔊)

Pamoka, data, vieta ateina iš QR (mentorius nustato) → vaiko neklausiama.

| # | Klausimas vaikui | Kris'o klausimas | Atsakymas |
|---|---|---|---|
| 1 | „Kiek balų duotum šiandienos pamokai?" | įvertink 1–10 | 1–10 skalė su veideliais |
| 2 | „Kas buvo smagiausia?" | kas patiko · mėgstamiausia dalis · kas labiausiai patiko | kortelės: istorija · VR žaidimas · komandos darbas · užduotis/galvosūkis · mentorius · kita |
| 3 | „Kas nepatiko?" | kas nepatiko | nieko · per ilgai laukti · per sunku · per lengva · šalmas nepatogus · nesupratau · kita |
| 4 | „Ką šiandien išmokai?" | ką išmokai | kortelės iš pamokos tikslų (`lessons.json`) + „kita" |
| 5 | „Kur tai panaudosi?" | kaip panaudosi kasdienybėje | papasakosiu šeimai · išbandysiu namie · padėsiu draugui · mokykloje · dar nežinau |
| 6 | „Ko norėtum daugiau?" | ko daugiau | daugiau VR · daugiau žaidimų · daugiau istorijos · sunkesnių užduočių · daugiau laiko |
| 7 | „Ar pakviestum draugą? Kodėl?" | rekomenduotum draugui | Taip / Gal / Ne → viena kortelė kodėl |

Sujungta: „mėgstamiausia dalis" + „kas labiausiai patiko" = #2 (vaikui tas pats klausimas). Laisvo teksto nėra (vaikai įrašytų vardus). ~60–90 s vienam vaikui.

## 📞 Vaikų ratas (v3, 2026-09-29 · agentas `BC VR LT · Vaikų ratas`, Kraist balsas)

Mentorius laiko telefoną prieš klasę. Kraist **garsiai** klausia klasę, vaikai atsako **mentoriui**, mentorius laiko mygtuką ir perduoda grupės atsakymą. Vaikai su AI nekalba (ElevenLabs: <18 draudžiama naudotis, <13 visiškai). ≤5 min., kietas limitas 6.

| # | Kraist sako klasei | Laukas (grupės atsakymas mentoriaus žodžiais) |
|---|---|---|
| 0 | Mentoriui: „Labas, čia Kraist, dirbtinio intelekto Kris'o balso versija. Aš užduosiu klausimus klasei garsiai, o tu, mentoriau, laikyk mygtuką ir perduok atsakymus. Devinta pamoka, Šiaurės licėjus, dvylika vaikų, teisingai?" | `pamoka` · `vieta` · `vaiku_sk` |
| 1 | „Labas, komanda! Aš Kraist. Parodykit pirštais: kiek balų nuo vieno iki dešimt duotumėt šiandienos pamokai?" | `ivertinimas_vid` (skaičius) |
| 2 | „Kas šiandien buvo smagiausia? Pasakykit mentoriui!" | `smagiausia` |
| 3 | „O kas nepatiko arba buvo per sunku?" | `nepatiko` |
| 4 | „Ką šiandien išmokot?" | `ismoko` |
| 5 | „Kur tai panaudosit? Namie, mokykloje, su draugais?" | `panaudos` |
| 6 | „Ko norėtumėt daugiau kitą kartą?" | `daugiau` |
| 7 | „Pakelkit rankas, kas pakviestų draugą į šitą pamoką!" | `rekomenduotu_kiek` („9 iš 12") |
| 8 | „O kodėl? Kas nors vienu sakiniu, mentoriui." | `kodel` · `vaiko_citata` (tik jei mentorius perpasakojo, be vardo) |
| ✓ | „Ačiū, komanda! Mentoriau, ačiū, perduosiu Kris'ui ir Gabrieliui." → puslapis baigia skambutį | |

**Taisyklės:** vardų neklausia ir nekartoja · jei prabyla vaikas: „Atsakymus perduoda mentorius." (antrą kartą iš eilės: „…Iki!" ir pabaiga) · vaiko pasakyti dalykai neįrašomi · 1 patikslinimas per klausimą · po 250 s tik 7 klausimas ir pabaiga.
