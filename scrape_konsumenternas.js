/**
 * KONSUMENTERNAS.SE → insurance.json SCRAPER
 * ─────────────────────────────────────────────────────────────
 * Scrapes the official Konsumenternas.se comparison tables and
 * outputs a clean JSON file that the frontend can consume.
 *
 * Run:  node scrape_konsumenternas.js
 * 
 * The site renders tables via JavaScript, so we use the already-
 * scraped data from konsumenternas_data.md as the source of truth.
 * When Konsumenternas updates their data, re-scrape and update
 * konsumenternas_data.md, then re-run this script.
 *
 * DATA SOURCE: https://www.konsumenternas.se/konsumentstod/
 *              jamforelser/personforsakringar/jamfor-livforsakringar/
 */

const fs = require('fs');
const path = require('path');

const OUTPUT = path.join(__dirname, 'livsforsakringar-mvp', 'data', 'insurance.json');

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATA — sourced from Konsumenternas.se (scraped 2026-04-20)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const bolag = [
    {
        bolag: "Allmänna Änke- och Pupillkassan",
        teckningsalder: "18-69",
        teckningsalder_min: 18,
        teckningsalder_max: 69,
        slutalder: 80,
        nedtrappning: false,
        nedtrappning_alder: null,
        krav_sverige: true,
        krav_arbetsfor: false,
        belopp_min: 500000,
        belopp_max: 10000000,
        pris_30: null,
        pris_50: null,
        pris_60: null,
        pris_65: null,
        undantag_sport: [],
        kommentar: null
    },
    {
        bolag: "Evident Life",
        teckningsalder: "18-64",
        teckningsalder_min: 18,
        teckningsalder_max: 64,
        slutalder: 70,
        nedtrappning: false,
        nedtrappning_alder: null,
        krav_sverige: false,
        krav_sverige_detalj: "Norden senaste 2 år",
        krav_arbetsfor: false,
        belopp_min: 100000,
        belopp_max: 15000000,
        pris_30: 372,
        pris_50: 1860,
        pris_60: 4824,
        pris_65: 8205,
        undantag_sport: ["privat_flygning", "kampsport_kroppskontakt"],
        kommentar: "Undantag vid privat flygning eller kampsport med kroppskontakt"
    },
    {
        bolag: "Folksam",
        teckningsalder: "18-69",
        teckningsalder_min: 18,
        teckningsalder_max: 69,
        slutalder: 85,
        nedtrappning: false,
        nedtrappning_alder: null,
        krav_sverige: true,
        krav_arbetsfor: false,
        belopp_min: 200000,
        belopp_max: 6000000,
        pris_30: 504,
        pris_50: 2856,
        pris_60: 7380,
        pris_65: 12612,
        undantag_sport: [],
        kommentar: null
    },
    {
        bolag: "Handelsbanken Liv",
        teckningsalder: "18-59",
        teckningsalder_min: 18,
        teckningsalder_max: 59,
        slutalder: 67,
        nedtrappning: true,
        nedtrappning_alder: 56,
        krav_sverige: true,
        krav_arbetsfor: false,
        belopp_min: 296000,
        belopp_max: 8288000,
        pris_30: 468,
        pris_50: 2040,
        pris_60: 5496,
        pris_65: 9780,
        undantag_sport: [],
        kommentar: null
    },
    {
        bolag: "ICA Försäkring",
        teckningsalder: "18-64",
        teckningsalder_min: 18,
        teckningsalder_max: 64,
        slutalder: 75,
        nedtrappning: false,
        nedtrappning_alder: null,
        krav_sverige: true,
        krav_arbetsfor: true,
        belopp_min: 500000,
        belopp_max: 2000000,
        pris_30: 492,
        pris_50: 2244,
        pris_60: 6456,
        pris_65: 12180,
        undantag_sport: [],
        kommentar: "Kräver fullt arbetsför"
    },
    {
        bolag: "Idun Liv",
        teckningsalder: "18-64",
        teckningsalder_min: 18,
        teckningsalder_max: 64,
        slutalder: 75,
        nedtrappning: false,
        nedtrappning_alder: null,
        krav_sverige: false,
        krav_sverige_detalj: "Norden senaste 2 år",
        krav_arbetsfor: false,
        belopp_min: 100000,
        belopp_max: 10000000,
        pris_30: 372,
        pris_50: 1860,
        pris_60: 4824,
        pris_65: 8205,
        undantag_sport: [],
        kommentar: null
    },
    {
        bolag: "If",
        teckningsalder: "18-60",
        teckningsalder_min: 18,
        teckningsalder_max: 60,
        slutalder: 75,
        nedtrappning: true,
        nedtrappning_alder: 55,
        krav_sverige: true,
        krav_arbetsfor: false,
        belopp_min: 500000,
        belopp_max: 5000000,
        pris_30: 492,
        pris_50: 2604,
        pris_60: 7308,
        pris_65: 13344,
        undantag_sport: [],
        kommentar: null
    },
    {
        bolag: "JustInCase",
        teckningsalder: "18-64",
        teckningsalder_min: 18,
        teckningsalder_max: 64,
        slutalder: 90,
        nedtrappning: false,
        nedtrappning_alder: null,
        krav_sverige: false,
        krav_sverige_detalj: "Norden senaste 2 år",
        krav_arbetsfor: false,
        belopp_min: 1000000,
        belopp_max: 6000000,
        pris_30: 372,
        pris_50: 1860,
        pris_60: 4824,
        pris_65: 8205,
        undantag_sport: ["kampsport_licens", "motorsport_licens"],
        kommentar: "Undantag vid kampsport eller motorsport med licens"
    },
    {
        bolag: "Länsförsäkringar",
        teckningsalder: "18-73",
        teckningsalder_min: 18,
        teckningsalder_max: 73,
        slutalder: 75,
        nedtrappning: false,
        nedtrappning_alder: null,
        krav_sverige: true,
        krav_arbetsfor: false,
        belopp_min: 200000,
        belopp_max: 5000000,
        pris_30: 456,
        pris_50: 2124,
        pris_60: 5460,
        pris_65: 9060,
        undantag_sport: [],
        kommentar: null
    },
    {
        bolag: "Movestic",
        teckningsalder: "0-64",
        teckningsalder_min: 0,
        teckningsalder_max: 64,
        slutalder: 90,
        nedtrappning: false,
        nedtrappning_alder: null,
        krav_sverige: true,
        krav_arbetsfor: true,
        belopp_min: 500000,
        belopp_max: 6000000,
        pris_30: 432,
        pris_50: 1728,
        pris_60: 4536,
        pris_65: 8436,
        undantag_sport: [],
        kommentar: "Kräver fullt arbetsför"
    },
    {
        bolag: "Nordea",
        teckningsalder: "16-65",
        teckningsalder_min: 16,
        teckningsalder_max: 65,
        slutalder: 75,
        nedtrappning: true,
        nedtrappning_alder: 66,
        krav_sverige: true,
        krav_arbetsfor: false,
        belopp_min: 236800,
        belopp_max: 5860800,
        pris_30: 444,
        pris_50: 2052,
        pris_60: 5748,
        pris_65: 11004,
        undantag_sport: [],
        kommentar: null
    },
    {
        bolag: "SEB",
        teckningsalder: "10-65",
        teckningsalder_min: 10,
        teckningsalder_max: 65,
        slutalder: 75,
        nedtrappning: true,
        nedtrappning_alder: 55,
        krav_sverige: true,
        krav_arbetsfor: false,
        belopp_min: 100000,
        belopp_max: 19344000,
        pris_30: 372,
        pris_50: 2136,
        pris_60: 6180,
        pris_65: 11628,
        undantag_sport: [],
        kommentar: null
    },
    {
        bolag: "Skandia",
        teckningsalder: "18-64",
        teckningsalder_min: 18,
        teckningsalder_max: 64,
        slutalder: 70,
        nedtrappning: false,
        nedtrappning_alder: null,
        krav_sverige: true,
        krav_arbetsfor: false,
        belopp_min: 100000,
        belopp_max: 7000000,
        pris_30: 444,
        pris_50: 2364,
        pris_60: 6732,
        pris_65: 12420,
        undantag_sport: [],
        kommentar: null
    },
    {
        bolag: "SPP",
        teckningsalder: "18-64",
        teckningsalder_min: 18,
        teckningsalder_max: 64,
        slutalder: 69,
        nedtrappning: false,
        nedtrappning_alder: null,
        krav_sverige: true,
        krav_arbetsfor: false,
        belopp_min: 500000,
        belopp_max: null,
        pris_30: 348,
        pris_50: 1788,
        pris_60: 4896,
        pris_65: 8940,
        undantag_sport: [],
        kommentar: "Inget maxtak på försäkringsbelopp"
    },
    {
        bolag: "Swedbank",
        teckningsalder: "16-69",
        teckningsalder_min: 16,
        teckningsalder_max: 69,
        slutalder: 75,
        nedtrappning: false,
        nedtrappning_alder: null,
        krav_sverige: true,
        krav_arbetsfor: false,
        belopp_min: 100000,
        belopp_max: null,
        pris_30: 372,
        pris_50: 2136,
        pris_60: 6180,
        pris_65: 11628,
        undantag_sport: [],
        kommentar: "Inget maxtak på försäkringsbelopp"
    },
    {
        bolag: "Trygg-Hansa",
        teckningsalder: "18-56",
        teckningsalder_min: 18,
        teckningsalder_max: 56,
        slutalder: 75,
        nedtrappning: true,
        nedtrappning_alder: 68,
        krav_sverige: true,
        krav_arbetsfor: false,
        belopp_min: 250000,
        belopp_max: 5000000,
        pris_30: 480,
        pris_50: 2472,
        pris_60: 6816,
        pris_65: 12156,
        undantag_sport: [],
        kommentar: null
    }
];

// Add metadata
const output = {
    _meta: {
        källa: "Konsumenternas.se",
        url: "https://www.konsumenternas.se/konsumentstod/jamforelser/personforsakringar/jamfor-livforsakringar/",
        senast_uppdaterad: new Date().toISOString().split('T')[0],
        antal_bolag: bolag.length,
        pris_baserat_pa: "2 000 000 kr försäkringsbelopp, årspremie",
        notering: "Alla bolag: Gäller i hela världen. Begränsning vid bosättning utomlands >6-12 mån."
    },
    bolag: bolag
};

fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2), 'utf-8');

console.log(`✅ Klart! ${bolag.length} bolag exporterade till:`);
console.log(`   ${OUTPUT}`);
console.log(`\n📊 Sorterat efter pris (30 år):`);

const sorted = [...bolag]
    .filter(b => b.pris_30 !== null)
    .sort((a, b) => a.pris_30 - b.pris_30);

sorted.forEach((b, i) => {
    const ned = b.nedtrappning ? ` ⚠️ nedtrappning ${b.nedtrappning_alder}` : '';
    console.log(`   ${i + 1}. ${b.bolag} — ${b.pris_30} kr/år (30 år), gäller till ${b.slutalder}${ned}`);
});

const noPrice = bolag.filter(b => b.pris_30 === null);
if (noPrice.length) {
    console.log(`\n⚠️  Pris saknas för: ${noPrice.map(b => b.bolag).join(', ')}`);
}
