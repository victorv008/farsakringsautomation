# Plan — Egen analytics-dashboard för Livförsäkringar.se

**Status:** Planering
**Skapad:** 2026-08-17
**Beslut:** Egen lösning i Supabase istället för Google Analytics — ni äger datan och bestämmer exakt vad som samlas in.

---

## Designbeslut (fattade 2026-08-17)

| Fråga | Val |
|-------|-----|
| Integritet | **Helt anonymt** — ingen IP, inga cookies, ingen persistent identifierare |
| Dashboard-innehåll | Populäraste bolagen, filterbeteende, demografi, trafikflöde |
| Åtkomstskydd | **Lösenord** — delat mellan Victor och kollegan |

---

## Vad som samlas in

### Vid varje sökning (när resultat.html laddas)

| Fält | Exempel | Varför |
|------|---------|--------|
| `alder` | 32 | Demografi — vilka åldrar använder sajten? |
| `belopp` | 2500000 | Demografi — vilka summor väljer folk? |
| `filter` | `["ingen_halso"]` | Vilka filter används, och i vilka kombinationer? |
| `antal_traffar` | 7 | Ger filtret rimligt många resultat, eller noll? |
| `enhet` | `"mobil"` | Påverkar UX-prioriteringar |
| `skapad_at` | tidsstämpel | Trender över tid |

### Vid klick på ett bolag

| Fält | Exempel | Varför |
|------|---------|--------|
| `bolag` | `"Folksam"` | **Viktigast** — vilka bolag konverterar? |
| `pris_visat` | 58 | Vilket pris fick de se när de klickade? |
| `position` | 1 | Klickar folk bara på det första resultatet? |
| `sortering` | `"pris"` | Hur hade de sorterat listan? |

### Vad som INTE samlas in

- Ingen IP-adress
- Inga cookies
- Inget namn, e-post eller kontaktuppgift
- Ingen koppling mellan olika besök från samma person

Datan kan alltså aldrig kopplas till en enskild individ. Det gör upplägget okomplicerat ur GDPR-synpunkt — men om ni vill vara helt säkra bör en jurist titta på det innan lansering. Jag är inte jurist.

---

## Teknisk lösning

### 1. Databas (Supabase)

Två tabeller:

**`sokningar`** — en rad per gång någon når resultatsidan
**`bolagsklick`** — en rad per gång någon klickar vidare till ett bolag

De kopplas ihop med ett slumpmässigt `sok_id` som lever i `sessionStorage` — det försvinner när fliken stängs och kan inte spåra någon mellan besök. Det behövs för att kunna räkna ut hur många som når resultatsidan men aldrig klickar vidare (drop-off).

### 2. Säkerhet — viktigt

Sajten använder Supabase publika nyckel, som syns för alla som tittar i koden. Därför måste behörigheterna sättas så att:

- **Vem som helst får skriva** (annars kan inte sajten logga något)
- **Ingen får läsa** med den publika nyckeln

Utan den regeln kan vem som helst ladda ner hela er databas. Det är det enskilt viktigaste steget i hela bygget.

Dashboarden läser istället datan via en **Edge Function** som kontrollerar lösenordet på serversidan innan den lämnar ut något.

### 3. Dashboard

En fil: `dashboard.html`, skyddad med lösenord.

Innehåll:
- **Topplista bolag** — antal klick per bolag, stapeldiagram
- **Filteranvändning** — vilka filter används mest, vilka kombinationer
- **Demografi** — åldersfördelning och beloppsfördelning
- **Trafikflöde** — antal sökningar → antal klick → konverteringsgrad
- **Nollresultat** — vilka filterkombinationer ger inga träffar (viktigt att fånga)

Diagram byggs med Chart.js via CDN — samma upplägg som resten av sajten, ingen build-process.

---

## Genomförande — steg för steg

Varje steg testas på staging innan nästa påbörjas.

### Steg 0 — Återaktivera Supabase
Projektet `livforsakringar-se` rapporteras som pausat. Måste startas i Supabase-dashboarden innan något annat kan göras.

**Obs:** Wiki-loggen säger att keepalive-pingen lyckats varje dag. Statusen behöver dubbelkollas manuellt i Supabase innan vi drar slutsatser.

### Steg 1 — Skapa tabellerna
Databastabeller + behörighetsregler. Ingen påverkan på sajten ännu.

### Steg 2 — Logga sökningar
Antigravity-prompt som lägger till spårning på `resultat.html`. Testas på staging: gör en sökning, kontrollera att raden dyker upp i Supabase.

### Steg 3 — Logga bolagsklick
Antigravity-prompt som lägger till spårning på "Gå till bolaget"-knappen. Testas likadant.

### Steg 4 — Edge Function
Serverfunktionen som hämtar och räknar ihop statistiken bakom lösenordsskydd.

### Steg 5 — Dashboard
Själva sidan med diagram. Byggs sist när det finns riktig data att visa.

### Steg 6 — Live
Merge staging → main. Data börjar samlas in på riktigt.

---

## Att tänka på

**Det tar tid innan datan säger något.** Med låg trafik i början blir siffrorna slumpmässiga. Räkna med några veckor innan mönstren är meningsfulla.

**Bygg inte allt på en gång.** Steg 1–3 ger redan värde — då samlas datan in. Dashboarden kan komma efteråt; datan finns kvar och kan visas i efterhand.

**GA4 fortsätter fungera parallellt.** Ni behöver inte välja bort det. GA4 ger besökarstatistik (varifrån folk kommer, sidvisningar), den egna databasen ger produktdata (vad folk faktiskt väljer). De kompletterar varandra.

---

## Öppna frågor

- Ska dashboarden ligga på livforsakringar.se/dashboard eller på en separat adress?
- Vill ni kunna exportera datan till Excel?
- Ska det finnas datumfilter i dashboarden (t.ex. "senaste 30 dagarna")?
