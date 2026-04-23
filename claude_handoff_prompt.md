# Överlämning till Claude Code (Status & Prompt)

Här är en sammanfattning av projektets nuvarande status och en prompt du kan kopiera rakt in i Claude Code för att fortsätta exakt där vi slutade.

## Vad som är klart (Fas 1-3)
1. **Datapipeline:** `scrape_konsumenternas.js` skrapar 16 livförsäkringsbolag från Konsumenternas.se och genererar `data/insurance.json`.
2. **Frontend UI (Steg 1 & 2):** `index.html` (ålder & belopp) och `livssituation.html` (multi-select scenario-kort) sparar användarens val i `sessionStorage` och skickar vidare till resultatsidan. Designen följer Stitch-mockupen, komplett med blob-animationer.
3. **Dynamisk Rendering (Resultatsidan):** `js/render-results.js` hämtar JSON-datan, läser `sessionStorage` och renderar försäkringskorten i `resultat.html`. Den filtrerar automatiskt bort bolag baserat på teckningsålder, maxbelopp och sportundantag, och sorterar på pris.

## Vad som saknas (Nästa logiska steg)
I `resultat.html` finns det en sidebar till vänster med **filter och sorteringsval** (t.ex. "Sortera efter", "Krav på arbetsförhet", m.m.). Dessa knappar och switchar fungerar inte än — de är bara statisk HTML.

---

## 📋 Kopiera och klistra in denna prompt i Claude Code:

```text
Hej Claude! Jag arbetar på en AI-driven jämförelsetjänst för svenska livförsäkringar (Livförsäkringar.se MVP).

**Här är var vi är just nu:**
1. Vi hämtar all försäkringsdata (16 bolag) dynamiskt från `livsforsakringar-mvp/data/insurance.json`.
2. I filen `livsforsakringar-mvp/js/render-results.js` har vi logik som läser in användarens val från `sessionStorage` (ålder, belopp, livssituation) och renderar korten dynamiskt i `resultat.html`. Exkluderade bolag visas i en egen sektion längst ner.
3. Renderingen funkar perfekt, MEN vänstermenyn (sidebar) i `resultat.html` med alla filter- och sorteringsalternativ är fortfarande statisk och inte kopplad till koden.

**Ditt uppdrag är att koppla ihop vänstermenyn i `resultat.html` med logiken i `render-results.js`:**
1. Läs `livsforsakringar-mvp/resultat.html` och kolla på sidebar-filtren (Sortering: Pris/Ålder/Maxbelopp. Toggels: Ingen hälsodeklaration, Inget krav på arbetsförhet, Gäller utomlands).
2. Uppdatera `livsforsakringar-mvp/js/render-results.js` så att den lyssnar på ändringar från dessa filter (event listeners på checkboxar/radioknappar/selects i sidebaren).
3. När ett filter ändras, filtrera och sortera om listan dynamiskt (`matched` och `excluded` arrays) och kalla på `renderResults()` igen så att gränssnittet uppdateras i realtid.
4. Säkerställ att koden är ren, modulär och bygger vidare på den befintliga render-strukturen.
```
