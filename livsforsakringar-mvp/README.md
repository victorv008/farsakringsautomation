# Livförsäkringar.se — MVP

AI-driven jämförelsetjänst för svenska livförsäkringar. Data hämtas dynamiskt från `data/insurance.json` (16 bolag, baserat på Konsumenternas.se).

## Struktur

- `index.html` — startsida / behovsval
- `livssituation.html` — steg 2, välj livssituation
- `resultat.html` — jämförelseresultat med filter/sortering
- `faq.html`, `sa-fungerar-det.html`, `om-oss.html` — innehållssidor
- `data/insurance.json` — bolagsdata
- `js/render-results.js` — dynamisk rendering + filtrering på resultatsidan
- `css/transitions.css` — sidövergångar och nav-styling

## Kör lokalt

Starta en enkel statisk server i denna mapp:

```bash
npx serve .
```

## Deploy

Hostas statiskt på Netlify. Se `netlify.toml`.
