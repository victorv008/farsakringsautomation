# MAC HANDOFF — Komplett guide för att jobba vidare på MacBook

**Senast uppdaterad:** 2026-04-30
**Repo:** https://github.com/victorv008/farsakringsautomation
**Lokal Windows-sökväg (referens):** `C:\Users\Victor\Farsäkringsautomation`

Den här filen innehåller allt du (eller en AI-assistent) behöver för att fortsätta jobbet på Mac. Läs den uppifrån och ner första gången, sen kan du använda innehållsförteckningen som hoppstation.

---

## Innehåll

1. [Snabbstart (TL;DR)](#1-snabbstart-tldr)
2. [Vad projektet är](#2-vad-projektet-är)
3. [Förkunskaper / verktyg som krävs](#3-förkunskaper--verktyg-som-krävs)
4. [Klona och installera på Mac](#4-klona-och-installera-på-mac)
5. [Kör frontenden lokalt](#5-kör-frontenden-lokalt)
6. [Filstruktur — vad varje sak gör](#6-filstruktur--vad-varje-sak-gör)
7. [Frontend-arkitektur (livsforsakringar-mvp/)](#7-frontend-arkitektur-livsforsakringar-mvp)
8. [Datamodell — `data/insurance.json`](#8-datamodell--datainsurancejson)
9. [Filterlogik (resultat.html + render-results.js)](#9-filterlogik-resultathtml--render-resultsjs)
10. [Mobil-UX (FAB + drawer)](#10-mobil-ux-fab--drawer)
11. [Skrapnings- och datapipeline-skript (parent-mappen)](#11-skrapnings--och-datapipeline-skript-parent-mappen)
12. [Deploy: Netlify](#12-deploy-netlify)
13. [Git-flöde](#13-git-flöde)
14. [Kända problem & TODO](#14-kända-problem--todo)
15. [Konventioner & beslut](#15-konventioner--beslut)
16. [Externa tjänster och konton](#16-externa-tjänster-och-konton)
17. [Kontakt och credits](#17-kontakt-och-credits)

---

## 1. Snabbstart (TL;DR)

```bash
# På din Mac, i en terminal:
cd ~/code   # eller var du nu vill ha projektet
git clone https://github.com/victorv008/farsakringsautomation.git
cd farsakringsautomation

# Installera beroenden för parent-skript (om du ska köra skrapning/excel-grejer)
npm install

# Starta frontenden lokalt — ingen build behövs, det är ren statisk HTML/JS
cd livsforsakringar-mvp
npx serve .
# Öppna http://localhost:3000 i Chrome / Safari
```

Det är allt. Frontenden har ingen build-kedja. Tailwind körs via CDN och ingen bundler används.

---

## 2. Vad projektet är

**Namn:** Livförsäkringar.se (MVP)
**Affärsidé:** AI-driven jämförelsetjänst för svenska livförsäkringar — den enda i Sverige som inte bara visar pris utan också tolkar villkoren (undantag, hälsodeklaration, nedtrappning, åldersgränser etc.).

**Status just nu:**
- Fas 1 (manuell datainsamling): klar för 16 bolag, sparat i `livsforsakringar-mvp/data/insurance.json`. Källa: Konsumenternas.se.
- Fas 2 (frontend MVP): **fungerande** — 3-stegsflöde (`index.html` → `livssituation.html` → `resultat.html`) med dynamisk filtrering, sortering, exklusionsförklaring och mobil-drawer.
- Fas 3 (backend / n8n / AI-tolkning): ej påbörjad. Allt lever just nu i frontenden.

**Konkurrensmoat:** den manuellt strukturerade villkorsdatan (`insurance.json`). Det tar månader att bygga — det är därför Zmarta/Insplanet inte gjort det med AI.

Bakgrund: läs [`PROJEKTSAMMANFATTNING.md`](PROJEKTSAMMANFATTNING.md) i repo-roten.

---

## 3. Förkunskaper / verktyg som krävs

Allt som behövs på Mac:

| Verktyg | Min. version | Varför | Mac-installation |
|---|---|---|---|
| **macOS** | 13+ | — | — |
| **Homebrew** | senaste | Pakethanterare | `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"` |
| **Git** | 2.30+ | Versionshantering | `brew install git` (eller via Xcode CLT) |
| **Node.js** | 18 LTS+ | För npm-skripten i parent-mappen | `brew install node` |
| **GitHub CLI** | 2.0+ | Auth + push utan att fippla med tokens | `brew install gh` |
| **Netlify CLI** *(valfritt)* | senaste | Deploy från terminal | `npm install -g netlify-cli` |
| **Editor** | — | Rekommenderar VS Code med ESLint, Prettier, Tailwind IntelliSense | `brew install --cask visual-studio-code` |
| **Statisk webbserver** | — | Kör frontenden lokalt | Inget extra — `npx serve` räcker |

### Auth-checklista efter installation

```bash
# GitHub
gh auth login         # välj GitHub.com → HTTPS → autentisera via webbläsaren
gh auth status        # ska säga "Logged in to github.com as victorv008"

# Konfigurera git globalt om det inte redan är gjort
git config --global user.name  "Victor Voong"
git config --global user.email "victorvoong06@gmail.com"

# Netlify (om du använder CLI)
netlify login
```

---

## 4. Klona och installera på Mac

```bash
mkdir -p ~/code && cd ~/code
git clone https://github.com/victorv008/farsakringsautomation.git
cd farsakringsautomation

# Installera Node-deps för skrapnings-/excel-skripten i parent-mappen
npm install
```

Vad `npm install` gör i parent-mappen:
- Installerar `pdfjs-dist` och `xlsx` (används av `read_pdf.js`, `excel_to_json.js`, `update_excel.js`).
- `pdf-parse` som dev-dependency.

Frontenden i `livsforsakringar-mvp/` har **inga** Node-beroenden. Den behöver bara en webbserver för att kunna `fetch('data/insurance.json')` (CORS-blockerat om du öppnar `index.html` direkt med `file://`).

---

## 5. Kör frontenden lokalt

```bash
cd livsforsakringar-mvp
npx serve .
```

`npx serve` är ett zero-install kommando som startar en HTTP-server på `http://localhost:3000`. Alternativ:

```bash
# Pythons inbyggda
python3 -m http.server 8000

# eller
npx http-server . -p 8000 -c-1
```

**Viktigt:** öppna inte `resultat.html` direkt med `file://` — `fetch('data/insurance.json')` blockas då av CORS i de flesta browsers.

### Snabbtest på sajten

1. Gå till `http://localhost:3000/index.html` — fyll i ålder + belopp.
2. Steg 2: välj livssituation (Standard / Bolån / Barn / etc).
3. Steg 3: resultatsidan ska visa **N försäkringar matchar dina uppgifter** + bolagskort.
4. Klicka i sidebar-filter → korten ska sortera/filtrera om i realtid.
5. Förminska fönstret < 1024px → en flytande **Filtrera**-knapp dyker upp längst ner till höger. Öppnar slide-in-drawer.

---

## 6. Filstruktur — vad varje sak gör

```
farsakringsautomation/
├─ MAC_HANDOFF.md                    ← den här filen
├─ PROJEKTSAMMANFATTNING.md          ← affärsidé, fasplan, beslut
├─ claude_handoff_prompt.md          ← gammal handoff till tidigare AI-session
├─ konsumenternas_data.md            ← anteckningar från datainsamling
├─ package.json                      ← Node-deps för parent-skripten
├─ package-lock.json
├─ .gitignore
│
│ ── Datainsamling / skrapning ──
├─ scrape_konsumenternas.js          ← Puppeteer-skrapare för Konsumenternas.se
├─ download_html.js                  ← laddar ner HTML-sidor
├─ download_screens.js               ← screenshot-tagare
├─ download_steg2.js
├─ get_steg1_url.js
├─ excel_to_json.js                  ← konverterar Excel → JSON
├─ update_excel.js                   ← skriver tillbaka till Excel
├─ read_pdf.js                       ← läser villkors-PDF:er via pdfjs
├─ read_oversikt.js                  ← läser PDF i Oversiktsdesign-mappen
├─ test_access.js                    ← liten dirlist-debug
├─ clickup-briefing-agent.json       ← n8n workflow-export (ClickUp brief-agent)
├─ livforsakring_datainsamling_v2.xlsx  ← rådata-kalkylark
├─ Instructions/                     ← CSV-instruktioner
│   └─ livforsakring_datainsamling_v2(Instruktioner).csv
├─ Oversiktsdesign/                  ← designreferens
│   └─ Översiktsdesign.pdf
│
│ ── Frontend MVP (det viktiga) ──
└─ livsforsakringar-mvp/
   ├─ README.md
   ├─ netlify.toml                   ← Netlify deploy-config
   ├─ .gitignore
   ├─ index.html                     ← steg 1: ålder + belopp
   ├─ livssituation.html             ← steg 2: livssituation
   ├─ resultat.html                  ← steg 3: jämförelse + filter
   ├─ faq.html
   ├─ sa-fungerar-det.html
   ├─ om-oss.html
   ├─ css/
   │   ├─ style.css
   │   └─ transitions.css            ← view-transitions, blob-animation, nav-styling
   ├─ js/
   │   ├─ render-results.js          ← HUVUDLOGIK: filter + sort + render på resultatsidan
   │   ├─ filter.js                  ← äldre filter-skript (delvis ersatt av render-results.js)
   │   ├─ sheets-loader.js           ← förmodligen oanvänd, men kvar
   │   └─ transitions.js             ← view-transitions API hooks
   └─ data/
       └─ insurance.json             ← 16 bolag, all data
```

---

## 7. Frontend-arkitektur (`livsforsakringar-mvp/`)

### Tech stack

- **HTML5** + **Tailwind CSS via CDN** (`<script src="https://cdn.tailwindcss.com?plugins=forms,container-queries">`)
- **Vanilla JavaScript** — ingen bundler, ingen build, inga ramverk.
- **Material Symbols** för ikoner (Google Fonts).
- **Plus Jakarta Sans** + **Inter** som fonter.

### Designtokens

Tailwind-config inline i varje HTML-fil definierar Material Design 3-färger:
- **Primary:** `#00595c` (mörk teal)
- **Secondary container:** `#fdba49` (amber/orange)
- **Surface:** `#f9f9f9`

Bakgrunden använder `blob-bg`-klassen med två stora "blobs" (teal + amber) som driver långsamt med CSS keyframes (se `css/transitions.css`).

### Sidövergångar

`css/transitions.css` använder View Transitions API (`::view-transition-old(root)` / `::view-transition-new(root)`) för en **circular reveal** — den nya sidan poppar upp som en cirkel från den punkt användaren klickade. `transitions.js` plockar muskoordinater och sätter CSS-variablerna `--origin-x` / `--origin-y`.

### Datalagring mellan sidor

Steg 1 → 2 → 3 använder `sessionStorage`:
```js
sessionStorage.setItem('ins_age', '32');
sessionStorage.setItem('ins_amount', '2500000');
sessionStorage.setItem('ins_scenarios', 'barn,bostadskop');
```

Resultatsidan läser dessa och anropar `fetch('data/insurance.json')`.

---

## 8. Datamodell — `data/insurance.json`

Filen har formatet:

```json
{
  "_meta": {
    "källa": "Konsumenternas.se",
    "url": "...",
    "senast_uppdaterad": "2026-04-23",
    "antal_bolag": 16,
    "pris_baserat_pa": "2 000 000 kr försäkringsbelopp, årspremie",
    "notering": "..."
  },
  "bolag": [ /* 16 objekt */ ]
}
```

### Fält per bolag

| Fält | Typ | Exempel | Beskrivning |
|---|---|---|---|
| `bolag` | string | `"Folksam"` | Namnet |
| `teckningsalder` | string | `"18-69"` | Visningsformat |
| `teckningsalder_min` / `_max` | number | `18` / `69` | För filtrering |
| `slutalder` | number | `85` | Försäkringen gäller till denna ålder |
| `nedtrappning` | bool | `false` | Sänks beloppet med åldern? |
| `nedtrappning_alder` | number\|null | `56` | Vid vilken ålder nedtrappning börjar |
| `krav_sverige` | bool | `true` | Måste man bo i Sverige? |
| `krav_arbetsfor` | bool | `false` | Krav på fullt arbetsför? |
| `belopp_min` / `belopp_max` | number | `200000` / `6000000` | Försäkringsbelopps-spann (kr) |
| `pris_30` / `_50` / `_60` / `_65` | number\|null | `504` | Årspremie i kr för olika åldrar |
| `undantag_sport` | string[] | `["privat_flygning"]` | Sporter som undantas |
| `halso_deklaration` | bool | `true` | (vissa bolag, finns inte i alla) |
| `kommentar` | string\|null | `null` | Fritextkommentar |
| `webbsida` | string\|null | (saknas i vissa) | Affiliate-länk |

**Observera:** vissa fält saknas på vissa bolag (t.ex. `pris_30: null` om priset inte gick att hämta för 30-åringar). Koden hanterar `null` med fallback.

### Uppdatera datan

Datan kommer från `livforsakring_datainsamling_v2.xlsx`. Workflow:
1. Uppdatera Excel-arket manuellt (priser ändras t.ex.).
2. Kör `node excel_to_json.js` i parent-mappen → genererar ny `insurance.json`.
3. Pusha ändringen → Netlify redeployar automatiskt.

---

## 9. Filterlogik (`resultat.html` + `render-results.js`)

All logik lever i [`livsforsakringar-mvp/js/render-results.js`](livsforsakringar-mvp/js/render-results.js). Det är en IIFE som:

1. **Läser sessionStorage** (`ins_age`, `ins_amount`, `ins_scenarios`).
2. **Hämtar `data/insurance.json`** med `fetch`.
3. **Initialiserar state**:
   ```js
   const state = {
     allInsurers: [],          // alla 16 bolag
     sortBy: 'price',          // 'price' | 'max_age' | 'max_amount'
     toggles: {
       no_halso: false,         // dölj bolag med hälsodeklaration
       no_nedtrappning: false,  // dölj bolag med nedtrappning
       no_arbetsfor: false,     // dölj bolag som kräver arbetsförhet
       long_term: false,        // bara bolag som gäller till ≥ 85 år
       no_sport: false,         // bara bolag utan sportundantag
     },
     selectedBolag: null,       // Set<string> — null = alla
   };
   ```
4. **Bygger bolags-checkboxlistan** dynamiskt (`buildBolagList`).
5. **Wire'ar event listeners** på sort-radios, toggle-checkboxar, bolag-checkboxar, "Rensa alla filter"-knappen och mobil-drawer FAB/close/backdrop.
6. **`applyAndRender()` kör pipelinen** vid varje filterändring:
   - Grundfilter (ålder/belopp/sport-scenario) delar i `matched` + `excluded`
   - Toggle-filter applicerats på matched
   - Bolag-filter applicerats
   - Sortering enligt `state.sortBy`
   - Bolag-listans rader dimmas/överstryks om de inte matchar övriga filter
   - "Rensa"-knappen visas/döljs beroende på om något filter är aktivt
   - Mobil-FAB-badge uppdateras med antal aktiva filter
   - `renderResults()` skriver nytt HTML → stagger-animation triggar via setTimeout

### Sidebar-element (i `resultat.html`)

| Element | ID / data-attribut | Vad det styr |
|---|---|---|
| Sort-radios | `name="sort"`, `value="price\|max_age\|max_amount"` | `state.sortBy` |
| Hälsodeklaration-toggle | `data-filter="no_halso"` | `state.toggles.no_halso` |
| Nedtrappning-toggle | `data-filter="no_nedtrappning"` | … |
| Arbetsför-toggle | `data-filter="no_arbetsfor"` | … |
| Långa-toggle | `data-filter="long_term"` | … |
| Sport-toggle | `data-filter="no_sport"` | … |
| Bolag-checkboxar | `data-bolag="<namn>"` | `state.selectedBolag` |
| Rensa-knapp | `id="clear-filters"` | Nollar allt |
| Bolag-rubrik | `id="bolag-heading"` | Visar `Bolag (X av 16)` |
| Mobil-FAB | `id="mobile-filter-fab"` | Öppnar drawer |
| FAB-badge | `id="fab-badge"` | Antal aktiva filter |
| Mobil-stäng-knapp | `id="mobile-close"` | Stänger drawer |
| Backdrop | `id="mobile-backdrop"` | Klick → stäng |

### Nyckel-funktioner i `render-results.js`

| Funktion | Vad den gör |
|---|---|
| `buildBolagList(insurers)` | Bygger checkbox-listan från datan + initierar `selectedBolag` |
| `wireSidebar()` | Lägger event listeners på alla filter-inputs + rensa-knapp |
| `wireMobileDrawer()` | Lägger event listeners för FAB / backdrop / close / Esc |
| `applyAndRender()` | Hela pipelinen — körs vid varje ändring |
| `passesToggles(ins, t)` | Returnerar `true` om bolaget passerar alla toggles |
| `sortMatched(list, sortBy)` | Sorterar in-place |
| `filterInsurers(...)` | Splittar bolag i `matched` / `excluded` baserat på user-input från steg 1+2 |
| `updateBolagListAnnotations(matched, togglePass)` | Dimmar bolag-rader som inte matchar övriga filter, uppdaterar rubriken |
| `updateFilterChrome()` | Visar/döljer rensa-knappen + uppdaterar FAB-badge |
| `resetFilters()` | Nollar state + synkar UI + re-renderar |
| `renderResults(matched, excluded, age, amount)` | Sätter banner-text + bygger HTML för alla kort |
| `renderCard(ins, index)` | Ett matchande kort |
| `renderExcludedCard(ins)` | Ett exkluderat kort med anledning |

---

## 10. Mobil-UX (FAB + drawer)

CSS:n ligger inline i `<style>`-taggen i `resultat.html` (sök efter `Mobile filter drawer`).

- **< 1024px:** sidebaren är `position: fixed; right: 0; transform: translateX(100%);` och syns inte. En FAB-knapp visas längst ner till höger.
- Klick på FAB → `sidebar.classList.add('is-open')` → slide-in från höger.
- Backdrop täcker resten av skärmen, klick = stäng.
- Esc-tangent stänger också.
- `body.no-scroll` låser bakgrundsscroll.

CSS-knapp för att även få det att fungera i Safari iOS: `height: 100dvh` används istället för `100vh` för att korrekt hantera safe-area.

---

## 11. Skrapnings- och datapipeline-skript (parent-mappen)

Dessa skript är **inte** del av frontenden — de användes en gång för att samla in datan. Du behöver dem bara om du vill uppdatera `insurance.json`.

| Skript | Vad det gör | Hur du kör |
|---|---|---|
| `scrape_konsumenternas.js` | Puppeteer-skrapare som hämtar tabellen från Konsumenternas.se | `node scrape_konsumenternas.js` (kräver `npm i puppeteer` om det inte redan finns — se `package.json`) |
| `download_html.js` | Laddar ner HTML-sidor lokalt | `node download_html.js` |
| `download_steg2.js` / `download_screens.js` / `get_steg1_url.js` | Hjälpskript för designreferensen | — |
| `read_pdf.js` / `read_oversikt.js` | Läser PDF:er med `pdfjs-dist` | `node read_pdf.js <fil.pdf>` |
| `excel_to_json.js` | Konverterar `livforsakring_datainsamling_v2.xlsx` → `livsforsakringar-mvp/data/insurance.json` | `node excel_to_json.js` |
| `update_excel.js` | Skriver tillbaka från JSON till Excel | `node update_excel.js` |
| `test_access.js` | Litet debug-script som listar `../ElvioNode` | Ignorerbart |

`clickup-briefing-agent.json` är en n8n-workflow-export. Detta är fas 3 (AI-tolkning av ClickUp-tasks → research-brief). Inte kopplat till frontenden ännu.

---

## 12. Deploy: Netlify

### Konfiguration
[`livsforsakringar-mvp/netlify.toml`](livsforsakringar-mvp/netlify.toml):
```toml
[build]
  publish = "."

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
  force = false

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    Referrer-Policy = "strict-origin-when-cross-origin"
```

### Kopplat på Netlify
Sajten är (eller ska vara) kopplad till GitHub-repo:t. **Bas-mapp** måste sättas till `livsforsakringar-mvp` (annars ser Netlify inte `netlify.toml` på rätt nivå).

Steg om du behöver återansluta eller deploya på nytt:
1. https://app.netlify.com/start
2. Välj **Deploy with GitHub** → repot `victorv008/farsakringsautomation`
3. **Base directory:** `livsforsakringar-mvp`
4. **Build command:** *(tomt)*
5. **Publish directory:** `livsforsakringar-mvp` (eller `.` om base är satt)
6. Klicka **Deploy site**.

Varje `git push` till `main` triggar en ny deploy automatiskt.

### Sätt domän
Site → **Domain management** → **Add custom domain** → `livforsakringar.se` (om/när du köpt domänen).

---

## 13. Git-flöde

### Vardagsflöde
```bash
git pull                                  # innan du börjar dagens jobb
# … gör ändringar …
git status                                # se vad som ändrats
git add livsforsakringar-mvp/             # eller specifika filer
git commit -m "Beskriv vad du ändrade"
git push                                  # auto-deploy startar på Netlify
```

### Skapa en feature-branch
```bash
git checkout -b feature/nya-filter
# … jobba …
git push -u origin feature/nya-filter
gh pr create --fill                       # öppnar PR via GitHub CLI
```

### Vanliga gotchas
- `*.xlsx` är **inte** längre i `.gitignore` (vi ändrade det) — du kan committa Excel-filen.
- `node_modules/` är ignorerat. Glöm inte `npm install` på en ny dator.
- Filnamn med svenska tecken (`Översiktsdesign.pdf`) funkar i git men kan se konstiga ut i `git ls-tree`-output (escapade som `\303\226`).

---

## 14. Kända problem & TODO

### Bekräftat fungerande
- ✅ Steg 1 → 2 → 3-flödet
- ✅ Dynamisk rendering av kort
- ✅ Sortera (3 ordningar)
- ✅ Filter-toggles (5 st)
- ✅ Bolags-checkboxar (16 st, dynamiskt)
- ✅ Bolags-räknare + dimning av icke-matchande bolag
- ✅ Rensa-alla-filter-knapp
- ✅ Mobil-drawer + FAB med badge
- ✅ Esc / backdrop / close-knapp stänger drawer
- ✅ Stagger-animation vid re-render

### TODO / nästa steg
1. **Spara filter-val i `sessionStorage`** så de ligger kvar vid omladdning.
2. **Domän:** köpa `livforsakringar.se` och peka mot Netlify.
3. **Avtal med bolag** för affiliate (Insplanet/Compricer-stil).
4. **Fas 3:** koppla in n8n + Claude/GPT API för att tolka villkorstexter dynamiskt — istället för manuell datainsamling.
5. **Underhålls-cron:** `insurance.json` blir inaktuell inom månader. Sätt upp kvartalsvis verifiering.
6. **SEO:** sitemap.xml, meta-taggar, OG-bilder, structured data (faq schema).
7. **Analytics:** Plausible eller Vercel Analytics — inte GA om vi vill vara GDPR-vänliga.
8. **A11y:** lägg `aria-live="polite"` på resultaten så screen readers meddelar uppdateringar; verifiera focus-trap i drawer.
9. **Frontend-ramverk?** Diskutera om Astro/Next är värt komplexiteten när allt funkar i vanilla.
10. **Testa på iPhone/Android i fysiska enheter** — emulator räcker inte.

### Kända småbuggar / städobjekt
- `livssituation.html` har ett kvarvarande HTML-kommentar `<!-- Auto-deploy test -->` ovanför `<style>` i `index.html` (rad 20). Skadar inget men är skräp.
- `js/filter.js` är delvis överlappande med `js/render-results.js` — på resultatsidan används `render-results.js`. `filter.js` kan eventuellt tas bort.
- `js/sheets-loader.js` används inte av någon HTML-fil längre (verifiera innan radering).
- `css/style.css` är nästan tom — innehåll kan flyttas till `transitions.css` eller raderas.

---

## 15. Konventioner & beslut

- **Språk i UI:** svenska, formell men varm ton.
- **Format:** Tailwind utility classes inline. Custom CSS bara där Tailwind inte räcker.
- **JS:** ingen TypeScript ännu. Vanilla JS i IIFE-mönster.
- **Inga emojis i kod** om inte UI:t kräver det (t.ex. ⭐ Bäst matchning).
- **Beslut: Tailwind via CDN** (inte byggd) — accepterad kostnad för enklare deploy. Byt till JIT-build om vi någonsin går in i tooling-territory.
- **Beslut: ingen bundler** — sajten är 7 sidor med en enda fetch. Det räcker.
- **Beslut: n8n istället för Zapier/Make** — self-hosted, gratis per körning.
- **Beslut: Konsumenternas.se som datakälla** — neutral myndighetsdrivet, lagligt.
- **Inga sessionStorage-värden ska vara säkerhetskritiska** — det är klientdata bara för UX.

---

## 16. Externa tjänster och konton

| Tjänst | Konto | Vad det används till |
|---|---|---|
| GitHub | `victorv008` | Källkod |
| Netlify | (ditt konto) | Hosting |
| Google Fonts | publik | Fonter (Plus Jakarta Sans, Inter, Material Symbols) |
| Tailwind CDN | publik | CSS |
| ClickUp | (Victor) | Task management — `clickup-briefing-agent.json` är n8n-workflow för automatiserade briefer |
| n8n | TBD | Backend-orkestrering (fas 3) |
| Claude API / OpenAI | TBD | AI-tolkning av villkor (fas 3) |

**Inga API-nycklar i repot.** Om / när du lägger in dem — använd `.env` (redan i `.gitignore`).

---

## 17. Kontakt och credits

- **Projektägare:** Victor Voong (`victorvoong06@gmail.com`)
- **Bolag:** Sanctuary Life AB
- **Datakälla:** Konsumenternas.se (Konsumentverket / försäkringsmyndigheten)

---

**Lycka till med jobbet på Mac!** Om något i den här filen är otydligt eller inaktuellt — uppdatera den. Den ska vara levande dokumentation, inte ett one-shot.
