# End-to-end-test

Kör riktiga besök genom sajten med en webbläsare och kontrollerar att allt
som händer också hamnar i Supabase — med rätt värden.

Testraderna märks med `ar_test = true` och göms i dashboarden, så de aldrig
blandas ihop med riktiga besökare.

---

## Engångsuppsättning

### 1. Installera

```bash
npm install
npx playwright install webkit
```

### 2. Fyll i `.env` i projektroten

`.env` är gitignorerad. Lägg aldrig in de här värdena i repot.

```
SUPABASE_URL=https://eptpgmfupemwtkkqcpiw.supabase.co
SUPABASE_SECRET_KEY=<service role-nyckeln>
TEST_TOKEN=<lång slumpsträng, se nedan>

# Bara om du vill köra mot staging (se "Vilket mål" längre ner)
VERCEL_AUTOMATION_BYPASS_SECRET=<från Vercel>
```

`SUPABASE_SECRET_KEY` används redan av ingest-pipelinen, så den ligger
troligen där. Skriptet accepterar även namnet `SUPABASE_SERVICE_ROLE_KEY`.

### 3. Sätt testtoken

Flaggan `ar_test` går **inte** att sätta från klienten. Databasen släpper
bara igenom den om anropet bär rätt token. Det gör att en besökare inte kan
förorena statistiken genom att pilla i URL:en eller i konsolen.

Generera en token:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Lägg samma värde både i `.env` som `TEST_TOKEN` och i databasen — kör detta
i Supabase SQL Editor:

```sql
insert into public.test_config (id, token) values (1, '<din-token>')
on conflict (id) do update set token = excluded.token;
```

Byt token när som helst genom att köra om samma sak. Testerna slutar då
fungera tills `.env` uppdaterats — det är meningen.

---

## Köra

```bash
npm test                                        # 12 körningar mot staging
node tests/kor-tester.mjs --korningar 20         # fler körningar
node tests/kor-tester.mjs --bas https://www.livforsakringar.se
node tests/kor-tester.mjs --headed               # se webbläsaren arbeta
```

| Flagga | Standard | Betydelse |
|---|---|---|
| `--korningar` | 12 | Antal besök |
| `--bas` | staging-URL:en | Vilken sajt som testas |
| `--headed` | av | Visa webbläsarfönstret |

### Vilket mål

Standard är staging. **Vercel skyddar previews med SSO**, så staging kräver
antingen att du stänger av Deployment Protection eller att du sätter
`VERCEL_AUTOMATION_BYPASS_SECRET` i `.env`
(Vercel → Project Settings → Deployment Protection → Protection Bypass for
Automation). Utan den fastnar körningen på en inloggningssida.

Produktion har inget SSO och fungerar direkt med `--bas`.

Går också att köra mot en lokal server:

```bash
npx http-server livsforsakringar-mvp -p 8080 -s
node tests/kor-tester.mjs --bas http://localhost:8080
```

---

## Vad testet gör

Varje körning går igenom hela flödet som en besökare:

1. Fyller i ålder och belopp på startsidan
2. Väljer livssituation
3. Landar på resultatsidan
4. Aktiverar filter
5. Klickar vidare till ett bolag

Ålder, belopp, filterkombination och vilket bolag som klickas varierar
mellan körningarna, så olika vägar täcks i stället för samma resa om och om
igen. Tre av fallen är avsiktligt konstruerade för att ge **noll träffar** —
två genom filterkombinationer och ett genom en ålder över alla bolags
teckningsåldrar.

**Klicket lämnar aldrig sajten.** Länkarna har `target="_blank"`; riggen
blockerar utgående navigering och stänger fliken direkt. Klicket hinner
loggas, men bolagets sajt laddas aldrig. Rapporten visar hur många
navigeringar som blockerades.

---

## Rapporten

Skrivs till `testrapporter/` i två format:

- `e2e-<tidpunkt>.md` — att läsa som människa
- `e2e-<tidpunkt>.json` — att läsa maskinellt

Överst står **GODKÄND** eller antalet avvikelser. Varje avvikelse listas med
körningsnummer, typ och vad som skilde sig:

| Typ | Betyder |
|---|---|
| `sokning_saknas` | Körningen nådde resultatsidan men ingen rad skrevs |
| `klick_saknas` | Ett bolag klickades men ingen rad i `bolagsklick` |
| `fel_varde` | Ålder, belopp eller antal träffar skiljer sig |
| `fel_filter` | Fel filter registrerades |
| `fel_bolag` / `fel_pris` / `fel_position` | Klickraden stämmer inte med kortet |
| `ej_markt_test` | Raden saknar `ar_test` — **den syns i dashboarden** |
| `vantade_noll` | Ett nollfall gav träffar ändå |
| `oväntat_klick` | Rader finns utan att något klickades |
| `körfel` | JS-fel eller avbrott under körningen |

Skriptet avslutas med kod `0` vid godkänt och `1` vid avvikelser, så det
går att koppla in i CI.

En detalj: **antalet sökningsrader är fler än antalet körningar.** Varje
filterändring loggas som en egen rad, vilket är avsiktligt — det är så
filterbeteende och nollresultat fångas. Jämförelsen använder den sista raden
per besök, och dashboardens konvertering räknas på unika `sok_id`, inte på
antal rader.

---

## Rensa testdata

```bash
npm run test:rensa            # visar hur många som skulle tas bort
npm run test:rensa -- --kor   # raderar på riktigt
```

Tar bara bort rader med `ar_test = true`. Riktiga besöksrader rörs inte.

I dashboarden finns en knapp med en kolv (🧪) i toppraden som växlar mellan
att dölja och visa testdata. Testrader är dolda som standard.

---

## Om något går fel

**Alla körningar fastnar direkt** — troligen Vercel-SSO. Se "Vilket mål".

**`ej_markt_test` på alla rader** — `TEST_TOKEN` i `.env` matchar inte den i
`test_config`. Sätt om båda.

**`klick_saknas`** — kontrollera att `js/analytics.js` är deployad till den
sajt du testar mot. En äldre version saknar teststödet.

**`fel_varde` på `antal_traffar`** — kan betyda att `insurance.json` har
ändrats sedan testfallen skrevs. Fallen i `kor-tester.mjs` bygger på att
teckningsåldrarna ligger mellan 56 och 73 år.
