# PROJEKTSAMMANFATTNING — AI-DRIVEN LIVFÖRSÄKRINGSJÄMFÖRELSE

*Senast uppdaterad: 2026-04-14*

---

## Affärsidé

Bygga en AI-driven webbsida där svenska konsumenter fyller i sina uppgifter och får en personlig rekommendation om vilken livförsäkring som passar dem bäst — inte bara billigast, utan rätt villkor för deras situation.

Ingen i Sverige gör detta idag med AI. Befintliga sajter (Zmarta, Insplanet, Konsument.se, Försäkrat.se) har statiska listor och affiliatelänkar, ingen djup villkorsanalys.

---

## Konkurrensfördel (moat)

Inte tekniken — den kan vem som helst bygga. Moaten är en **manuellt uppbyggd, strukturerad databas med tolkade villkor** från varje svenskt försäkringsbolag. Det tar månader att bygga och underhålla. AI-delen tolkar villkoren och gör dem begripliga för vanliga människor.

---

## Teknisk arkitektur

| Komponent | Val | Anmärkning |
|---|---|---|
| Frontend | Next.js eller vanilla HTML | Hosting på Vercel (gratis) |
| Backend/Orchestrering | n8n (self-hosted) | MVP-fasen |
| AI-motor | ChatGPT API eller Claude API | Testa båda — Claude bättre på långa villkorsdokument |
| Databas | Supabase (PostgreSQL) | Gratis tier |

**Varför n8n och inte Zapier/Make/ActivePieces:** Zapier och Make tar betalt per körning — för dyrt för publik trafik. n8n är self-hosted, gratis, och har webhook + databas + HTTP-noder inbyggt.

**Obs:** Claude Cowork är ett skrivbordsverktyg, inte en skalbar server — används inte som backend.

---

## Fasplan

### ✅ Fas 1 — Databasen (PÅGÅR)
Gå igenom villkorsdokument och prisofferter från alla svenska bolag. Samla i kalkylark.

Kalkylarket **livforsakring_datainsamling.xlsx** är skapat med fyra flikar:
- **Grunddata** — 28 kolumner per bolag (belopp, åldrar, karenstider, undantag, nedtrappning etc.)
- **Prismatris** — priser per månad för 4 belopp × 8 åldrar × 12 bolag
- **Villkorsanalys** — djupare analys av undantag, betyg, tydlighet
- **Instruktioner** — steg-för-steg hur man fyller i

### ⬜ Fas 2 — n8n-flödet (1–2 dagar)
Webhook + databasquery + API-anrop + svarsformatering.

### ⬜ Fas 3 — Webbsida (1–2 dagar)
Formulär eller chatt som skickar till n8n-webhooken.

### ⬜ Fas 4 — Testa med riktiga människor

---

## Bolag att täcka (12 st)

Prioritetsordning för datainsamling:

1. **JustInCase** — enklast online, tydlig prissättning
2. **Folksam** — stor aktör, bra referenspunkt
3. **If** — stor aktör
4. **Konsumentförsäkring** — budgetalternativet
5. **Skandia** — premium
6. Länsförsäkringar
7. SEB Trygg Liv
8. Swedbank Försäkring
9. Movestic
10. Bliwa
11. Danica Pension
12. Euro Accident

---

## Arbetsflöde i Cowork (Fas 1)

1. Ladda ner villkors-PDF:er från varje bolag till en mapp
2. Be Claude läsa PDF:erna och fylla i kalkylarket (Grunddata + Villkorsanalys)
3. **Prismatrisen måste fyllas i manuellt** — kör offertflöden på bolagens hemsidor (kan ingen AI göra)

---

## Olösta frågor

- **Prissättningsmodell** — per sökning, abonnemang, freemium, eller affiliatemodell (provision från bolagen som Insplanet/Compricer)?
- **Trafikstrategi** — SEO, sociala medier, eller betald annonsering?
- **Underhållsrutin** — datan blir felaktig inom månader utan kvartalsvis uppdatering. Fältet "Senast verifierad" finns i kalkylarket för detta.

---

## Nuläge / Nästa steg

Vi avslutade med att Fas 1 är påbörjad — kalkylarket är skapat. Nästa konkreta steg är att börja samla in data för **JustInCase** (högst prioritet).
