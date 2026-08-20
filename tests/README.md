# End-to-end-test

Kör riktiga besök genom sajten med en webbläsare och kontrollerar att allt
som händer också hamnar i Supabase — med rätt värden.

**Testerna körs mot produktion.** Det är där spårningen faktiskt måste
fungera, och det är den enda miljön där hela kedjan går att bevisa. Raderna
märks med `ar_test = true` och göms i dashboarden, så de aldrig blandas ihop
med riktiga besökare.

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

# Bara om du vill köra mot staging
VERCEL_AUTOMATION_BYPASS_SECRET=<från Vercel>
```

`SUPABASE_SECRET_KEY` används redan av ingest-pipelinen. Skriptet accepterar
även namnet `SUPABASE_SERVICE_ROLE_KEY`.

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

### Rotera token

Kör samma SQL med ett nytt värde och uppdatera `.env`. Den gamla tokenen
slutar fungera omedelbart — försök att skriva `ar_test = true` med den ger
`401` från databasen. Rotera om en token misstänks ha läckt; den enda skada
en läckt token kan göra är att någon kan skriva rader som *göms* i
dashboarden, men rotera ändå.

---

## Köra

```bash
npm test                                     # 12 körningar mot produktion
node tests/kor-tester.mjs --korningar 20
node tests/kor-tester.mjs --headed           # se webbläsaren arbeta
```

| Flagga | Standard | Betydelse |
|---|---|---|
| `--korningar` | 12 | Antal besök |
| `--bas` | `https://www.livforsakringar.se` | Vilken sajt som testas |
| `--headed` | av | Visa webbläsarfönstret |

### Andra mål

```bash
# Lokal server
npx http-server livsforsakringar-mvp -p 8080 -s
node tests/kor-tester.mjs --bas http://localhost:8080

# Staging — kräver VERCEL_AUTOMATION_BYPASS_SECRET i .env, eftersom
# previews ligger bakom Vercel SSO
node tests/kor-tester.mjs --bas https://farsakringsautomation-git-staging-victorv008s-projects.vercel.app
```

Kör du mot ett mål vars `js/analytics.js` är äldre än testflaggan kommer
raderna att skrivas **omärkta**. Det fångas som `LÄCKAGE` och fäller
körningen — se nedan.

---

## Vad testet gör

Varje körning går igenom hela flödet som en besökare:

1. Fyller i ålder och belopp på startsidan
2. Väljer livssituation
3. Landar på resultatsidan
4. Aktiverar filter
5. Klickar vidare till ett bolag

Ålder, belopp, filterkombination och vilket bolag som klickas varierar mellan
körningarna. Tre av fallen ger avsiktligt **noll träffar** — två genom
filterkombinationer och ett genom en ålder över alla bolags teckningsåldrar.

**Klicket lämnar aldrig sajten.** Länkarna har `target="_blank"`; riggen
blockerar utgående navigering och stänger fliken direkt. Klicket hinner
loggas, men bolagets sajt laddas aldrig.

---

## Flaggkontrollen

Detta är poängen med hela upplägget: **ingen testrad får hamna i den riktiga
statistiken.** Efter varje körning görs två oberoende kontroller.

1. Varje rad som hör till körningens `sok_id` måste ha `ar_test = true`.
2. Inga omärkta rader i körningsfönstret får höra till körningen.

Slår någon av dem till blir utfallet **`LÄCKAGE`** — inte en varning, utan
ett hårt fel som väger tyngre än alla andra avvikelser och ger exitkod `1`.

Kontroll 2 skiljer på våra rader och riktiga besökare. En besökare kan surfa
på sajten medan testet kör; omärkta rader med andra `sok_id` rapporteras
separat som trolig riktig trafik och fäller inte körningen.

Att detektionen faktiskt fångar ett läckage — och inte bara rapporterar noll
när allt är rätt — verifieras av ett eget test:

```bash
npm run test:sjalvtest
```

Det konstruerar syntetiska läckage och kontrollerar att verdicten blir
`LÄCKAGE`, samt att en främmande omärkt rad *inte* gör det.

---

## Rapporten

Skrivs till `testrapporter/` i två format:

- `e2e-<tidpunkt>.md` — att läsa som människa
- `e2e-<tidpunkt>.json` — att läsa maskinellt

Överst står **GODKÄND**, antalet avvikelser, eller **LÄCKAGE**. Sedan
flaggkontrollen, alla resor, och sist ett avsnitt med de exakta siffror
dashboarden ska visa.

| Typ | Betyder |
|---|---|
| `LACKAGE` | En testrad ligger i den riktiga statistiken — **hårt fel** |
| `sokning_saknas` | Körningen nådde resultatsidan men ingen rad skrevs |
| `klick_saknas` | Ett bolag klickades men ingen rad i `bolagsklick` |
| `fel_varde` | Ålder, belopp eller antal träffar skiljer sig |
| `fel_filter` | Fel filter registrerades |
| `fel_bolag` / `fel_pris` / `fel_position` | Klickraden stämmer inte med kortet |
| `vantade_noll` | Ett nollfall gav träffar ändå |
| `oväntat_klick` | Rader finns utan att något klickades |
| `körfel` | JS-fel eller avbrott under körningen |

En detalj: **antalet sökningsrader är fler än antalet körningar.** Varje
filterändring loggas som en egen rad, vilket är avsiktligt — det är så
filterbeteende och nollresultat fångas. Jämförelsen använder den sista raden
per besök, och konverteringen räknas på unika `sok_id`, inte på antal rader.

---

## Manuell kontroll i dashboarden

**Testdatan raderas inte automatiskt.** Den ligger kvar med flit så att den
går att öppna och granska med ögonen.

Rapporten avslutas med ett avsnitt som listar exakt vad dashboarden ska visa
— antal besök, antal klick, konverteringsgrad, vilka bolag och vilka
filterkombinationer. Gör så här:

1. Öppna `/dashboard` och logga in
2. Slå på testvyn med kolvknappen i toppraden — en amberfärgad banner visas
3. Välj ett tidsintervall som rymmer körningen
4. Jämför mot tabellerna i rapporten

Stämmer siffrorna är hela kedjan bevisad: sajten loggar rätt, databasen
lagrar rätt, Edge Function aggregerar rätt och dashboarden ritar rätt.

---

## Rensa testdata

```bash
npm run test:rensa            # visar hur många som skulle tas bort
npm run test:rensa -- --kor   # raderar på riktigt
```

Tar bara bort rader med `ar_test = true`. Riktiga besöksrader rörs inte.

---

## Om något går fel

**`LÄCKAGE`** — kontrollera att målets `js/analytics.js` innehåller
`__LFTEST__`. Saknas det är den deployade versionen äldre än testflaggan.
Rensa sedan med `npm run test:rensa -- --kor` och kontrollera manuellt att
inga omärkta rader blev kvar.

**Alla körningar fastnar direkt** — kör du mot staging? Se "Andra mål".

**Inga rader alls skrivs** — `TEST_TOKEN` i `.env` matchar inte den i
`test_config`. Databasen avvisar då hela insert:en med `401` i stället för
att skriva den omärkt.

**`fel_varde` på `antal_traffar`** — kan betyda att `insurance.json` har
ändrats sedan testfallen skrevs. Fallen bygger på att teckningsåldrarna
ligger mellan 56 och 73 år.
