# BC grįžtamasis ryšys · kaip veikia (Gabrieliui)

**Atnaujinta:** 2026-09-29 · **Viena nuoroda:** https://krisvas333.github.io/bc-feedback/skambutis.html · QR: https://krisvas333.github.io/bc-feedback/qr.html (3-ias QR kodas)

## Trys keliai po pamokos

| Kelias | Kas kalba ar spaudžia | Kiek laiko |
|---|---|---|
| 📞 **Mentorius** | Mentorius kalba su Kraist (AI, Kris'o balso klonas), atviras mikrofonas | 2–3 min., max 5 |
| 📞 **Vaikų ratas** | Kraist garsiai klausia klasę. Vaikai atsako **mentoriui**. Mentorius **laiko mygtuką** ir perduoda grupės atsakymą („devyni iš dvylikos", „dauguma sako VR žaidimas"). Paleidus mygtuką mikrofonas išjungtas | ~4 min., max 6 |
| 👧 **Vaikų paspaudimai** | Kiekvienas vaikas spaudžia 7 atsakymus planšetėje ar Quest naršyklėje. Be balso | 60–90 s vaikui |

## Kas renkama

- **Mentorius:** pamoka, vieta, vaikų sk., kas pavyko, kas nesuveikė, ar veikė žaidimas ir šalmai, problemos tipas, ar gidas aiškus, pasitikėjimas 1–5, istorija 1–5, ką išmoko, kas įdomiausia, ko prašė daugiau, viena vaiko frazė be vardo, įvertinimas 1–10, ką pakeisti.
- **Vaikų ratas (tik grupės atsakymai, mentoriaus žodžiais):** pamoka, vieta, vaikų sk., įvertinimo vidurkis, smagiausia, nepatiko, išmoko, kur panaudos, ko daugiau, kiek pakviestų draugą („9 iš 12"), kodėl, viena vaiko frazė be vardo (tik jei mentorius ją perpasakojo).
- **Vaikų paspaudimai:** 8 kodai vienam vaikui (balas 1–10, smagiausia, nepatiko, išmoko, panaudos, daugiau, pakviestų draugą, kodėl).

## Kas NErenkama

**Vaikų vardai, amžius, lytis, klasė, vaikų balsas, garso įrašai, IP, įrenginio ID, laisvas vaikų tekstas.**
- Garsas nesaugomas niekur (ElevenLabs `record_voice=false`, `delete_audio=true`).
- Pokalbio tekstas ir santrauka lieka tik ElevenLabs 7 dienas ir į mūsų duomenų bazę nekeliauja.
- Jei mentorius pasako vaiko vardą, agentas jo nekartoja ir įrašo „vienas vaikas".
- Jei vaikas prabyla į telefoną, Kraist atsako „Atsakymus perduoda mentorius" ir to neįrašo. Jei vaikas kalba 2+ kartus arba mentorius nieko neperdavė, neišsaugoma **nieko**.
- ⚠️ Kol mentorius laiko mygtuką, mikrofonas girdi ir klasės foną. Todėl: vaikai atsako mentoriui, mentorius spaudžia tik tada, kai pats kalba.

## Kodėl vaikai nekalba su AI

ElevenLabs taisyklės draudžia naudotis jaunesniems nei 18 m., o jaunesniems nei 13 m. visiškai. Todėl ElevenLabs naudotojas yra **tik suaugęs mentorius**. Vaikai tik girdi klausimus (Kris'o balsu) ir atsako mentoriui.

## Kur saugoma

- Supabase projektas `kris-life-os` (ES), lentelės `feedback_mentor`, `feedback_vaikai_ratas`, `feedback_vaikai`. Visos uždarytos (RLS deny-all): skaityti gali tik serverio funkcijos.
- Įrašas patenka tik per pasirašytą ElevenLabs webhook'ą (HMAC) ir tik iš 3 registruotų agentų.
- Saugojimo terminas: kol ištrinsim ⚠️ (automatinio trynimo dar nėra).

## Kas mato

- **Kris ir Gabrielius**: Slack kanalas **#bc-feedback** (privatus). Žinutės antraštė, pvz.: „👧🎙️ Vaikų ratas · BC VR · L9 · Šiaurės licėjus · 2026-10-01 · 12 vaikų · ⭐ 8/10".
- Kris'o wiki savaitinis pulsas ir BrainBridge (bendra atmintis su tavo Claude) gauna tik suvestines.
- Bandymai (`bandymas`, `t=1`) Slack'e pažymėti „🧪 TESTAS“ ir neįskaičiuojami į suvestines.

## Kaip pasiekti

1. Prieš pamoką: atidaryk `qr.html`, pasirink pamoką, vietą, datą → atspausdink arba parodyk 3 QR.
2. Po pamokos: nuskenuok 3-ią QR (📞 Skambutis) → paspausk „Skambinti · Vaikų ratas" arba „Skambinti · Mentorius" → leisk mikrofoną.
3. Vaikų rate: laikyk didelį mygtuką tik kai kalbi tu. Pabaigoje Kraist padėkoja ir skambutis baigiasi pats. Raudonas „Baigti" nutraukia bet kada.
4. Be balso: vaikų paspaudimų puslapis (1-as QR).

⚗️ AI · eksperimentinis · gali klysti · garsas nesaugomas. Radai klaidą? Parašyk Kris'ui.
