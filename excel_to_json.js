/**
 * EXCEL → JSON CONVERTER
 * ─────────────────────────────────────────────────────────────
 * Reads livforsakring_datainsamling_v2.xlsx and outputs a clean
 * JSON file to livsforsakringar-mvp/data/insurance.json
 *
 * Run: node excel_to_json.js
 * Run after every Excel edit to update the website data.
 */

const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');

// ── Config ───────────────────────────────────────────────────
const EXCEL_PATH = path.join(__dirname, 'livforsakring_datainsamling_v2.xlsx');
const JSON_OUTPUT = path.join(__dirname, 'livsforsakringar-mvp', 'data', 'insurance.json');

// ── Read Excel ───────────────────────────────────────────────
console.log('📖 Läser:', EXCEL_PATH);
const workbook = xlsx.readFile(EXCEL_PATH);

// ── Parse Grunddata ──────────────────────────────────────────
const grunddata = xlsx.utils.sheet_to_json(workbook.Sheets['Grunddata']);
console.log(`   Grunddata: ${grunddata.length} bolag`);

// ── Parse Prismatris ─────────────────────────────────────────
// The price matrix has a merged header row, so we parse it manually
const prisSheet = workbook.Sheets['Prismatris'];
const prisRaw = xlsx.utils.sheet_to_json(prisSheet, { header: 1 });

// Find the actual header row (contains "Bolag", "30 år", etc.)
let prisHeaderIdx = -1;
for (let i = 0; i < Math.min(prisRaw.length, 5); i++) {
    const row = prisRaw[i];
    if (row && row.some(cell => String(cell).includes('Bolag'))) {
        prisHeaderIdx = i;
        break;
    }
}

const prisMap = {};
if (prisHeaderIdx >= 0) {
    const headers = prisRaw[prisHeaderIdx].map(h => String(h).trim());
    const bolagCol = headers.findIndex(h => h === 'Bolag');

    for (let i = prisHeaderIdx + 1; i < prisRaw.length; i++) {
        const row = prisRaw[i];
        if (!row || !row[bolagCol]) continue;
        const bolag = String(row[bolagCol]).trim();
        if (!bolag || bolag === '') continue;

        const prices = {};
        headers.forEach((h, idx) => {
            if (h.includes('år') && idx !== bolagCol) {
                const age = h.replace(/\s*år\s*/, '').trim();
                const val = row[idx];
                prices[`pris_${age}`] = (val !== undefined && val !== '' && val !== '-')
                    ? Math.round(Number(val))
                    : null;
            }
        });
        prisMap[bolag] = prices;
    }
}
console.log(`   Prismatris: ${Object.keys(prisMap).length} bolag med priser`);

// ── Parse Villkorsanalys ─────────────────────────────────────
const villkor = xlsx.utils.sheet_to_json(workbook.Sheets['Villkorsanalys']);
const villkorMap = {};
villkor.forEach(row => {
    if (row['Bolag']) villkorMap[row['Bolag']] = row;
});
console.log(`   Villkorsanalys: ${villkor.length} bolag`);

// ── Merge everything ─────────────────────────────────────────
const result = grunddata.map(g => {
    const bolag = g['Bolag'];
    const priser = prisMap[bolag] || {};
    const v = villkorMap[bolag] || {};

    // Parse nedtrappning
    const nedtrappning = String(g['Nedtrappning (Ja/Nej)'] || '').toLowerCase();
    const harNedtrappning = nedtrappning === 'ja' || nedtrappning.startsWith('ja');
    const nedtrappningAlder = g['Nedtrappning startar vid ålder'];

    // Parse undantag
    const undantag = [];
    if (g['Undantag: Extremsport'] && String(g['Undantag: Extremsport']).toLowerCase().startsWith('ja')) {
        undantag.push('extremsport');
    }
    if (g['Undantag: Krig'] && String(g['Undantag: Krig']).toLowerCase().startsWith('ja')) {
        undantag.push('krig');
    }
    if (g['Undantag: Utlandsvistelse'] && String(g['Undantag: Utlandsvistelse']).toLowerCase().startsWith('ja')) {
        undantag.push('utlandsvistelse');
    }
    if (g['Undantag: Övriga']) {
        undantag.push(String(g['Undantag: Övriga']));
    }

    // Parse hälsodeklaration
    const halsodekl = String(g['Hälsodeklaration (Ja/Nej/Läkarintyg)'] || 'Ja');
    const kraverHalso = !halsodekl.toLowerCase().startsWith('nej');

    return {
        bolag,
        webbsida: g['Webbsida (produktsida)'] || null,
        villkor_pdf: g['Villkors-PDF (länk)'] || null,

        // Belopp
        belopp_min: g['Min belopp (kr)'] || null,
        belopp_max: g['Max belopp (kr)'] || null,
        belopp_steg: g['Beloppssteg (kr)'] || null,

        // Ålder
        teckningsalder_min: g['Min ålder'] || null,
        teckningsalder_max: g['Max teckningsålder'] || null,
        slutalder: g['Slutålder'] || null,

        // Nedtrappning
        nedtrappning: harNedtrappning,
        nedtrappning_alder: (harNedtrappning && nedtrappningAlder && nedtrappningAlder !== '-')
            ? Number(nedtrappningAlder) : null,
        nedtrappning_procent: g['Nedtrappning % per år'] || null,

        // Hälsa
        halso_deklaration: kraverHalso,
        halso_deklaration_detalj: halsodekl,
        lakarintyg_fran: g['Läkarintyg från belopp (kr)'] || null,

        // Karens
        karenstid_sjalvmord_man: g['Karenstid självmord (mån)'] || null,
        karenstid_ovriga_dagar: g['Karenstid övriga (dagar)'] || null,

        // Undantag
        undantag,
        undantag_extremsport: g['Undantag: Extremsport'] || null,
        undantag_utland: g['Undantag: Utlandsvistelse'] || null,

        // Avtal
        bindningstid: g['Bindningstid'] || null,
        uppsagningstid: g['Uppsägningstid'] || null,
        premie_typ: g['Fast/Rörlig premie'] || null,
        vardesakring: g['Värdesäkring (Ja/Nej)'] || null,

        // Förmånstagare
        formanstagare: g['Förmånstagarordning (standard)'] || null,
        barnforsakring: g['Barnlivförsäkring ingår (Ja/Nej)'] || null,

        // Priser (per månad vid 500 000 kr)
        ...priser,

        // Villkorsanalys
        galler_dygnet_runt: v['Gäller dygnet runt'] || null,
        galler_norden: v['Gäller i Norden'] || null,
        galler_globalt: v['Gäller globalt (max tid)'] || null,
        digital_teckning: v['Digital teckning möjlig'] || null,
        sammanfattning: v['Sammanfattande kommentar'] || null,

        // Meta
        senast_verifierad: g['Senast verifierad'] || null,
        anteckningar: g['Anteckningar'] || null,
    };
});

// ── Write JSON ───────────────────────────────────────────────
fs.writeFileSync(JSON_OUTPUT, JSON.stringify(result, null, 2), 'utf-8');
console.log(`\n✅ Klart! ${result.length} bolag exporterade till:`);
console.log(`   ${JSON_OUTPUT}`);
console.log('\n📊 Bolag:');
result.forEach(r => {
    const pris = r.pris_30 ? `${r.pris_30} kr/mån (30 år)` : 'pris saknas';
    console.log(`   • ${r.bolag} — ${pris}`);
});
