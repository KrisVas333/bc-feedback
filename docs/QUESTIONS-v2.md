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
