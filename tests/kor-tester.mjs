#!/usr/bin/env node
/**
 * End-to-end-test för Livförsäkringar.se
 *
 * Kör ett antal besök genom sajten med en riktig webbläsare — fyller i ålder
 * och belopp, väljer livssituation, aktiverar filter, klickar vidare till ett
 * bolag — och jämför sedan det som faktiskt hamnade i Supabase mot det
 * skriptet gjorde.
 *
 * Klicket på bolaget ska registreras och loggas, men aldrig navigera ut till
 * bolagets riktiga sajt. Utgående navigering blockeras.
 *
 * Varje rad skrivs med ar_test = true. Servern kräver rätt token för det, så
 * riktiga besökare kan inte förorena statistiken.
 *
 *   node tests/kor-tester.mjs
 *   node tests/kor-tester.mjs --korningar 20 --bas https://www.livforsakringar.se
 *   node tests/kor-tester.mjs --headed        (se webbläsaren arbeta)
 */

import { webkit } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HAR = dirname(fileURLToPath(import.meta.url));
const ROT = join(HAR, '..');

/* ── Miljö ──────────────────────────────────────────────────────────────── */

function laddaEnv() {
    const fil = join(ROT, '.env');
    if (!existsSync(fil)) return;
    for (const rad of readFileSync(fil, 'utf8').split('\n')) {
        const m = rad.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) {
            process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
        }
    }
}
laddaEnv();

const flagga = (namn, standard) => {
    const i = process.argv.indexOf('--' + namn);
    return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
        ? process.argv[i + 1] : standard;
};
const harFlagga = (namn) => process.argv.includes('--' + namn);

// Produktion är standardmål — det är där spårningen faktiskt måste fungera.
// Staging ligger bakom Vercel SSO och kräver VERCEL_AUTOMATION_BYPASS_SECRET;
// lokalt körs med --bas http://localhost:PORT.
const BAS = flagga('bas', process.env.TEST_BAS_URL || 'https://www.livforsakringar.se');
const KORNINGAR = parseInt(flagga('korningar', '12'), 10);
const HEADED = harFlagga('headed');
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://eptpgmfupemwtkkqcpiw.supabase.co';
// Repot använder redan SUPABASE_SECRET_KEY för ingest-pipelinen — acceptera
// båda namnen så samma hemlighet inte behöver ligga två gånger i .env.
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const TEST_TOKEN = process.env.TEST_TOKEN;
// Staging ligger bakom Vercel Deployment Protection. Sätt den här i .env för
// att komma förbi SSO:n utan att öppna previewen publikt:
//   Vercel → Project Settings → Deployment Protection → Protection Bypass for Automation
const VERCEL_BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;

/* ── Testfall ───────────────────────────────────────────────────────────── */

// Verifierade mot data/insurance.json: teckningsalder_max ligger mellan 56
// och 73, så ålder 74+ utesluter samtliga bolag.
const SCENARIER = ['ingen_halso', 'ingen_nedtrappning', 'hog_slutalder', 'riskfylld_sport', 'arbetsfor'];
const FILTER = ['no_halso', 'no_nedtrappning', 'no_arbetsfor', 'long_term', 'no_sport'];

const FALL = [
    { alder: 32, belopp: 2500000, scenarier: [],                    filter: [],                                  vantatNoll: false },
    { alder: 28, belopp: 1000000, scenarier: ['ingen_halso'],       filter: ['no_halso'],                        vantatNoll: false },
    { alder: 45, belopp: 3000000, scenarier: [],                    filter: ['no_nedtrappning'],                 vantatNoll: false },
    { alder: 55, belopp: 2000000, scenarier: ['hog_slutalder'],     filter: ['long_term'],                       vantatNoll: false },
    { alder: 38, belopp: 1500000, scenarier: ['riskfylld_sport'],   filter: ['no_sport'],                        vantatNoll: false },
    { alder: 41, belopp: 4000000, scenarier: ['arbetsfor'],         filter: ['no_arbetsfor'],                    vantatNoll: false },
    { alder: 50, belopp: 5000000, scenarier: [],                    filter: ['no_nedtrappning', 'no_sport'],     vantatNoll: false },
    { alder: 24, belopp: 800000,  scenarier: ['ingen_nedtrappning'],filter: [],                                  vantatNoll: false },
    { alder: 60, belopp: 1200000, scenarier: [],                    filter: ['no_arbetsfor', 'no_sport'],        vantatNoll: false },
    { alder: 35, belopp: 2000000, scenarier: [],                    filter: ['no_halso', 'long_term', 'no_sport'], vantatNoll: true  },
    { alder: 78, belopp: 2500000, scenarier: [],                    filter: [],                                  vantatNoll: true  },
    { alder: 33, belopp: 3500000, scenarier: ['ingen_halso'],       filter: ['no_halso', 'no_nedtrappning'],     vantatNoll: false },
    { alder: 47, belopp: 900000,  scenarier: [],                    filter: ['long_term'],                       vantatNoll: false },
    { alder: 29, belopp: 4500000, scenarier: ['hog_slutalder'],     filter: [],                                  vantatNoll: false },
    { alder: 52, belopp: 1800000, scenarier: [],                    filter: ['no_halso'],                        vantatNoll: false },
    { alder: 36, belopp: 2200000, scenarier: [],
      filter: ['no_halso', 'no_nedtrappning', 'no_arbetsfor', 'long_term', 'no_sport'],                          vantatNoll: true  },
    { alder: 44, belopp: 1100000, scenarier: ['riskfylld_sport'],   filter: [],                                  vantatNoll: false },
    { alder: 31, belopp: 2800000, scenarier: [],                    filter: ['no_sport'],                        vantatNoll: false },
    { alder: 58, belopp: 700000,  scenarier: ['arbetsfor'],         filter: [],                                  vantatNoll: false },
    { alder: 26, belopp: 3200000, scenarier: [],                    filter: ['no_nedtrappning', 'long_term'],    vantatNoll: false },
];

/* ── Hjälpare ───────────────────────────────────────────────────────────── */

const log = (...a) => console.log(...a);
// Backtick som konstant — undviker nästlingsproblem i mallsträngar nedan
const BT = String.fromCharCode(96);
const vänta = (ms) => new Promise((r) => setTimeout(r, ms));

// Bolag ska variera mellan körningar: välj klickposition utifrån körningsnummer
const valjPosition = (i, antalKort) => antalKort ? i % Math.min(antalKort, 5) : 0;

/* ── En körning ─────────────────────────────────────────────────────────── */

async function korEnResa(context, fall, index) {
    const resa = {
        nr: index + 1,
        gjorde: { ...fall },
        sok_id: null,
        traffar: null,
        klick: null,
        fel: [],
    };

    const page = await context.newPage();
    const konsolfel = [];
    page.on('pageerror', (e) => konsolfel.push(e.message));

    // Bolagslänkarna har target="_blank". Stäng fliken direkt — klicket ska
    // hinna loggas, men vi ska aldrig hamna på bolagets sajt. Lyssnaren sitter
    // på sidan, inte på context, annars stänger den nästa körnings egen sida.
    page.on('popup', (p) => { p.close().catch(() => {}); });

    try {
        /* 1. Startsidan — ålder och belopp */
        await page.goto(BAS + '/', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('#age', { timeout: 15000 });

        await page.fill('#age', String(fall.alder));
        await page.evaluate((v) => {
            const el = document.getElementById('amount');
            el.value = String(v);
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }, fall.belopp);

        await page.evaluate(() => {
            document.getElementById('step1-form')
                .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        });

        /* 2. Livssituation — välj scenarier */
        await page.waitForURL(/livssituation/, { timeout: 15000 });
        await page.waitForSelector('[data-scenario]', { timeout: 15000 });

        for (const s of fall.scenarier) {
            await page.evaluate((namn) => {
                const k = document.querySelector(`[data-scenario="${namn}"]`);
                if (k) k.click();
            }, s);
            await vänta(150);
        }
        await page.evaluate(() => document.getElementById('cta-btn').click());

        /* 3. Resultatsidan */
        await page.waitForURL(/resultat/, { timeout: 15000 });
        await page.waitForSelector('#results-wrapper', { timeout: 15000 });
        await vänta(2500); // låt render-results hämta data och rita

        resa.sok_id = await page.evaluate(() => {
            try { return sessionStorage.getItem('ins_sok_id'); } catch (e) { return null; }
        });

        /* 4. Aktivera filter */
        for (const f of fall.filter) {
            await page.evaluate((namn) => {
                const cb = document.querySelector(`input[type=checkbox][data-filter="${namn}"]`);
                if (cb && !cb.checked) cb.click();
            }, f);
            await vänta(250);
        }

        // Debouncen i render-results är 1200 ms — vänta ut den med marginal
        await vänta(2200);

        // antal_traffar loggas som matched + noPrice. Bortfiltrerade kort bär
        // klassen .excl och ska inte räknas med.
        resa.traffar = await page.$$eval('.result-card:not(.excl)', (c) => c.length);

        /* 5. Klicka vidare till ett bolag — utan att lämna sajten */
        if (resa.traffar > 0) {
            const pos = valjPosition(index, resa.traffar);
            resa.klick = await page.evaluate((p) => {
                const kort = document.querySelectorAll('.result-card:not(.excl)');
                const k = kort[p] || kort[0];
                if (!k) return null;
                const a = k.querySelector('a[target="_blank"]');
                if (!a) return null;
                const pris = parseInt(k.getAttribute('data-pris'), 10);
                const position = parseInt(k.getAttribute('data-position'), 10);
                a.click();
                return {
                    bolag: k.getAttribute('data-bolag'),
                    pris: Number.isFinite(pris) ? pris : null,
                    position: Number.isFinite(position) ? position : null,
                    sortering: 'price',
                };
            }, pos);
            await vänta(1200);
        }

        if (konsolfel.length) resa.fel.push(...konsolfel.map((f) => 'JS-fel: ' + f));
    } catch (e) {
        resa.fel.push('Avbröts: ' + e.message);
    } finally {
        await page.close().catch(() => {});
    }

    return resa;
}

/* ── Huvudflöde ─────────────────────────────────────────────────────────── */

async function main() {
    log('');
    log('  Livförsäkringar.se — end-to-end-test');
    log('  ' + '─'.repeat(58));
    log(`  Mål:        ${BAS}`);
    log(`  Körningar:  ${KORNINGAR}`);
    log(`  Webbläsare: WebKit${HEADED ? ' (synlig)' : ''}`);
    if (BAS.includes('vercel.app') && !VERCEL_BYPASS) {
        log('');
        log('  ⚠ Målet är en Vercel-preview och VERCEL_AUTOMATION_BYPASS_SECRET saknas.');
        log('    Previews är skyddade av SSO — körningen kommer troligen att fastna på');
        log('    en inloggningssida. Se tests/README.md.');
    }

    if (!TEST_TOKEN) {
        log('');
        log('  ✖ TEST_TOKEN saknas. Utan den kan raderna inte märkas som');
        log('    testdata och skulle förorena dashboarden. Se tests/README.md.');
        process.exitCode = 1; return;
    }
    if (!SERVICE_KEY) {
        log('');
        log('  ✖ SUPABASE_SERVICE_ROLE_KEY saknas. Den behövs för att läsa');
        log('    tillbaka raderna — den publika nyckeln får inte läsa.');
        log('    Se tests/README.md.');
        process.exitCode = 1; return;
    }

    const fall = Array.from({ length: KORNINGAR }, (_, i) => FALL[i % FALL.length]);
    const startTid = new Date();

    const browser = await webkit.launch({ headless: !HEADED });
    const context = await browser.newContext({
        viewport: { width: 1280, height: 900 },
        extraHTTPHeaders: VERCEL_BYPASS
            ? { 'x-vercel-protection-bypass': VERCEL_BYPASS, 'x-vercel-set-bypass-cookie': 'true' }
            : {},
    });

    // Injicera testläget innan någon sidkod kör
    await context.addInitScript((token) => {
        window.__LFTEST__ = { token };
    }, TEST_TOKEN);

    // Blockera utgående navigering — klicket ska loggas, inte lämna sajten
    const TILLATNA = [BAS, 'supabase.co', 'cdn.tailwindcss.com', 'fonts.googleapis.com',
                      'fonts.gstatic.com', 'jsdelivr.net'];
    let blockerade = 0;
    await context.route('**/*', (route) => {
        const req = route.request();
        const url = req.url();
        const tillaten = TILLATNA.some((t) => url.startsWith(t) || url.includes(t));
        if (req.isNavigationRequest() && !tillaten) {
            blockerade++;
            return route.abort();
        }
        return route.continue();
    });

    log('');
    const resor = [];
    for (let i = 0; i < fall.length; i++) {
        const r = await korEnResa(context, fall[i], i);
        resor.push(r);
        const status = r.fel.length ? '✖' : (r.klick ? '✔' : (r.traffar === 0 ? '○' : '·'));
        log(`  ${status} ${String(r.nr).padStart(2)}/${fall.length}  ` +
            `${String(r.gjorde.alder).padStart(2)} år, ${(r.gjorde.belopp / 1e6).toFixed(1)} Mkr, ` +
            `${(r.gjorde.filter.join('+') || 'inga filter').padEnd(42)} ` +
            `${String(r.traffar ?? '?').padStart(2)} träffar` +
            (r.klick ? ` → ${r.klick.bolag}` : (r.traffar === 0 ? ' → inget klick (väntat)' : '')));
    }

    await context.close();
    await browser.close();
    log('');
    log(`  Blockerade utgående navigeringar: ${blockerade}`);

    /* ── Läs tillbaka och jämför ─────────────────────────────────────────── */

    log('  Väntar 3 s så sista raden hinner fram…');
    await vänta(3000);

    const slutTid = new Date();
    const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const sokIds = resor.map((r) => r.sok_id).filter(Boolean);

    // Fönstret spänner över hela körningen med marginal åt båda håll, så inget
    // missas på grund av klockskillnad mellan den här maskinen och databasen.
    const franTid = new Date(startTid.getTime() - 60000).toISOString();
    const tillTid = new Date(slutTid.getTime() + 60000).toISOString();

    const [sokRes, klickRes, omarktSokRes, omarktKlickRes] = await Promise.all([
        db.from('sokningar').select('*').in('sok_id', sokIds),
        db.from('bolagsklick').select('*').in('sok_id', sokIds),
        // Omärkta rader som dök upp medan testet kördes. Om någon av dem hör
        // till oss har testdata läckt in i den riktiga statistiken.
        db.from('sokningar').select('*').eq('ar_test', false)
          .gte('skapad_at', franTid).lte('skapad_at', tillTid),
        db.from('bolagsklick').select('*').eq('ar_test', false)
          .gte('skapad_at', franTid).lte('skapad_at', tillTid),
    ]);

    const lasfel = sokRes.error || klickRes.error || omarktSokRes.error || omarktKlickRes.error;
    if (lasfel) {
        log('  ✖ Kunde inte läsa tillbaka: ' + lasfel.message);
        process.exitCode = 1; return;
    }

    const rapport = jamfor(resor, sokRes.data ?? [], klickRes.data ?? [], {
        bas: BAS, start: startTid, slut: slutTid, blockerade,
        omarktaSokningar: omarktSokRes.data ?? [],
        omarktaKlick: omarktKlickRes.data ?? [],
        fonster: { fran: franTid, till: tillTid },
    });

    skrivRapport(rapport);
    process.exitCode = rapport.sammanfattning.avvikelser === 0 ? 0 : 1;
}

/* ── Jämförelse ─────────────────────────────────────────────────────────── */

export function jamfor(resor, sokRader, klickRader, meta) {
    const avvikelser = [];
    const perResa = [];

    for (const r of resor) {
        const mina = sokRader.filter((s) => s.sok_id === r.sok_id);
        const minaKlick = klickRader.filter((k) => k.sok_id === r.sok_id);
        const punkter = [];

        if (!r.sok_id) {
            avvikelser.push({ resa: r.nr, typ: 'inget_sok_id',
                text: 'Körningen fick aldrig något sok_id — inget kunde loggas.' });
        } else if (mina.length === 0) {
            avvikelser.push({ resa: r.nr, typ: 'sokning_saknas',
                text: `Ingen sökningsrad skrevs för sok_id ${r.sok_id}.` });
        } else {
            // Sista raden speglar det slutliga filterläget
            const sista = [...mina].sort((a, b) => a.skapad_at.localeCompare(b.skapad_at)).at(-1);

            const kollar = [
                ['alder', sista.alder, r.gjorde.alder],
                ['belopp', sista.belopp, r.gjorde.belopp],
                ['antal_traffar', sista.antal_traffar, r.traffar],
            ];
            for (const [falt, fick, vantat] of kollar) {
                if (Number(fick) !== Number(vantat)) {
                    avvikelser.push({ resa: r.nr, typ: 'fel_varde',
                        text: `${falt}: databasen har ${fick}, körningen gjorde ${vantat}.` });
                } else {
                    punkter.push(`${falt} = ${fick}`);
                }
            }

            const fickFilter = [...(sista.filter_valda ?? [])].sort().join(',');
            const vantatFilter = [...r.gjorde.filter].sort().join(',');
            if (fickFilter !== vantatFilter) {
                avvikelser.push({ resa: r.nr, typ: 'fel_filter',
                    text: `filter_valda: databasen har [${fickFilter}], körningen valde [${vantatFilter}].` });
            } else {
                punkter.push(`filter = [${fickFilter || 'inga'}]`);
            }

            if (sista.ar_test !== true) {
                avvikelser.push({ resa: r.nr, typ: 'ej_markt_test',
                    text: 'Raden är INTE märkt som testdata — den syns i dashboarden.' });
            }

            if (r.gjorde.vantatNoll && sista.antal_traffar !== 0) {
                avvikelser.push({ resa: r.nr, typ: 'vantade_noll',
                    text: `Fallet skulle ge noll träffar men gav ${sista.antal_traffar}.` });
            }
        }

        // Klick
        if (r.klick) {
            if (minaKlick.length === 0) {
                avvikelser.push({ resa: r.nr, typ: 'klick_saknas',
                    text: `Klickade på ${r.klick.bolag} men ingen rad skrevs i bolagsklick.` });
            } else {
                const k = minaKlick[0];
                if (k.bolag !== r.klick.bolag) {
                    avvikelser.push({ resa: r.nr, typ: 'fel_bolag',
                        text: `bolag: databasen har "${k.bolag}", klicket gällde "${r.klick.bolag}".` });
                } else punkter.push(`klick på ${k.bolag}`);

                if (Number(k.pris_visat) !== Number(r.klick.pris)) {
                    avvikelser.push({ resa: r.nr, typ: 'fel_pris',
                        text: `pris_visat: databasen har ${k.pris_visat}, kortet visade ${r.klick.pris}.` });
                }
                if (Number(k.klick_position) !== Number(r.klick.position)) {
                    avvikelser.push({ resa: r.nr, typ: 'fel_position',
                        text: `klick_position: databasen har ${k.klick_position}, kortet låg på ${r.klick.position}.` });
                }
                if (k.ar_test !== true) {
                    avvikelser.push({ resa: r.nr, typ: 'ej_markt_test',
                        text: 'Klickraden är INTE märkt som testdata.' });
                }
            }
        } else if (minaKlick.length > 0) {
            avvikelser.push({ resa: r.nr, typ: 'oväntat_klick',
                text: `Ingen klickning gjordes men ${minaKlick.length} rad(er) finns i bolagsklick.` });
        }

        for (const f of r.fel) {
            avvikelser.push({ resa: r.nr, typ: 'körfel', text: f });
        }

        perResa.push({
            nr: r.nr,
            sok_id: r.sok_id,
            gjorde: r.gjorde,
            traffar: r.traffar,
            klick: r.klick,
            rader_i_db: { sokningar: mina.length, bolagsklick: minaKlick.length },
            stammer: punkter,
            avvikelser: avvikelser.filter((a) => a.resa === r.nr).length,
        });
    }

    /* ── Flaggkontroll ────────────────────────────────────────────────────
       Poängen med hela övningen: ingen testrad får hamna i den riktiga
       statistiken. Två oberoende kontroller.

       1. Varje rad som hör till våra sok_id måste ha ar_test = true.
       2. Inga omärkta rader i körningsfönstret får höra till oss.

       Punkt 2 måste skilja på våra rader och riktiga besökare, som mycket
       väl kan surfa på sajten samtidigt. Bara rader vars sok_id matchar
       körningen räknas som läckage — övriga rapporteras som trolig
       riktig trafik, utan att fälla testet. */
    const varaSokIds = new Set(resor.map((r) => r.sok_id).filter(Boolean));

    const laktaSok = (meta.omarktaSokningar ?? []).filter((r) => varaSokIds.has(r.sok_id));
    const laktaKlick = (meta.omarktaKlick ?? []).filter((r) => varaSokIds.has(r.sok_id));
    const frammandeSok = (meta.omarktaSokningar ?? []).filter((r) => !varaSokIds.has(r.sok_id));
    const frammandeKlick = (meta.omarktaKlick ?? []).filter((r) => !varaSokIds.has(r.sok_id));

    const omarktaVara = [
        ...sokRader.filter((r) => r.ar_test !== true),
        ...klickRader.filter((r) => r.ar_test !== true),
    ];

    for (const r of omarktaVara) {
        avvikelser.push({
            resa: resor.find((x) => x.sok_id === r.sok_id)?.nr ?? 0,
            typ: 'LACKAGE',
            text: `Rad med sok_id ${r.sok_id} saknar ar_test — den ligger i den riktiga statistiken.`,
        });
    }
    for (const r of [...laktaSok, ...laktaKlick]) {
        avvikelser.push({
            resa: resor.find((x) => x.sok_id === r.sok_id)?.nr ?? 0,
            typ: 'LACKAGE',
            text: `Omärkt rad i körningsfönstret hör till körningen (sok_id ${r.sok_id}).`,
        });
    }

    const flaggkontroll = {
        vara_rader: sokRader.length + klickRader.length,
        alla_markta: omarktaVara.length === 0 && laktaSok.length === 0 && laktaKlick.length === 0,
        lackage: omarktaVara.length + laktaSok.length + laktaKlick.length,
        frammande_omarkta_i_fonstret: frammandeSok.length + frammandeKlick.length,
        fonster: meta.fonster,
    };

    const forvantadeKlick = resor.filter((r) => r.klick).length;
    const faktiskaKlick = klickRader.length;

    /* Underlag för manuell kontroll i dashboarden */
    const bolagRakning = {};
    for (const k of klickRader) bolagRakning[k.bolag] = (bolagRakning[k.bolag] ?? 0) + 1;
    const kombiRakning = {};
    for (const r of sokRader) {
        const nyckel = [...(r.filter_valda ?? [])].sort().join(' + ') || '(inga filter)';
        kombiRakning[nyckel] = (kombiRakning[nyckel] ?? 0) + 1;
    }
    const manuellt = {
        unika_besok: new Set(sokRader.map((r) => r.sok_id)).size,
        sokningsrader: sokRader.length,
        klick: klickRader.length,
        besok_med_klick: new Set(klickRader.map((r) => r.sok_id)).size,
        konvertering_procent: sokRader.length
            ? Math.round((new Set(klickRader.map((r) => r.sok_id)).size /
                          new Set(sokRader.map((r) => r.sok_id)).size) * 1000) / 10
            : 0,
        nollresultat: sokRader.filter((r) => r.antal_traffar === 0).length,
        bolag: Object.entries(bolagRakning).sort((a, b) => b[1] - a[1])
            .map(([namn, antal]) => ({ namn, antal })),
        filterkombinationer: Object.entries(kombiRakning).sort((a, b) => b[1] - a[1])
            .map(([namn, antal]) => ({ namn, antal })),
    };

    return {
        flaggkontroll,
        manuellt,
        korning: {
            tidpunkt: meta.start.toISOString(),
            mal: meta.bas,
            antal_resor: resor.length,
            blockerade_navigeringar: meta.blockerade,
        },
        sammanfattning: {
            resor: resor.length,
            sokningsrader_i_db: sokRader.length,
            klickrader_i_db: faktiskaKlick,
            forvantade_klick: forvantadeKlick,
            alla_markta_som_test: flaggkontroll.alla_markta,
            lackage: flaggkontroll.lackage,
            avvikelser: avvikelser.length,
            resultat: flaggkontroll.lackage > 0 ? 'LÄCKAGE'
                    : (avvikelser.length === 0 ? 'GODKÄND' : 'AVVIKELSER'),
        },
        avvikelser,
        resor: perResa,
    };
}

/* ── Rapport ────────────────────────────────────────────────────────────── */

function skrivRapport(rap) {
    const mapp = join(ROT, 'testrapporter');
    mkdirSync(mapp, { recursive: true });
    const stamp = rap.korning.tidpunkt.replace(/[:.]/g, '-').slice(0, 19);

    const jsonFil = join(mapp, `e2e-${stamp}.json`);
    writeFileSync(jsonFil, JSON.stringify(rap, null, 2), 'utf8');

    const s = rap.sammanfattning;
    const rader = [];
    rader.push(`# End-to-end-test — ${rap.korning.tidpunkt.slice(0, 16).replace('T', ' ')}`);
    rader.push('');
    if (s.lackage > 0) {
        rader.push('## 🚨 LÄCKAGE — ' + s.lackage + ' testrad(er) hamnade i den riktiga statistiken');
        rader.push('');
        rader.push('Detta är det allvarligaste utfallet: rader som testet skapat syns nu som');
        rader.push('riktiga besök i dashboarden. Kör ' + BT + 'npm run test:rensa -- --kor' + BT + ' och');
        rader.push('kontrollera att TEST_TOKEN i .env matchar tokenen i tabellen ' + BT + 'test_config' + BT + '.');
    } else if (s.avvikelser === 0) {
        rader.push('## ✅ GODKÄND — allt loggades, alla värden stämmer, inga rader läckte');
    } else {
        rader.push('## ❌ ' + s.avvikelser + ' AVVIKELSER');
    }
    rader.push('');
    rader.push(`- **Mål:** ${rap.korning.mal}`);
    rader.push(`- **Resor:** ${s.resor}`);
    rader.push(`- **Sökningsrader i databasen:** ${s.sokningsrader_i_db}`);
    rader.push(`- **Klickrader i databasen:** ${s.klickrader_i_db} (förväntade ${s.forvantade_klick})`);
    rader.push('- **Blockerade utgående navigeringar:** ' + rap.korning.blockerade_navigeringar);
    rader.push('');

    const fk = rap.flaggkontroll;
    rader.push('## Flaggkontroll');
    rader.push('');
    rader.push('| Kontroll | Utfall |');
    rader.push('|---|---|');
    rader.push('| Rader skapade av testet | ' + fk.vara_rader + ' |');
    rader.push('| Alla märkta med ' + BT + 'ar_test' + BT + ' | ' + (fk.alla_markta ? '**ja**' : '**NEJ**') + ' |');
    rader.push('| Läckta rader | ' + (fk.lackage === 0 ? '0' : '**' + fk.lackage + '**') + ' |');
    rader.push('| Omärkta rader i fönstret från andra besök | ' + fk.frammande_omarkta_i_fonstret + ' |');
    rader.push('');
    if (fk.frammande_omarkta_i_fonstret > 0) {
        rader.push('> ' + fk.frammande_omarkta_i_fonstret + ' omärkt(a) rad(er) skapades under körningen ' +
            'men hör inte till testets sok_id. Det är med största sannolikhet riktiga besökare — ' +
            'de räknas inte som läckage.');
        rader.push('');
    }

    if (rap.avvikelser.length) {
        rader.push('## Avvikelser');
        rader.push('');
        rader.push('| Resa | Typ | Beskrivning |');
        rader.push('|-----:|-----|-------------|');
        for (const a of rap.avvikelser) {
            rader.push(`| ${a.resa} | \`${a.typ}\` | ${a.text} |`);
        }
        rader.push('');
    }

    rader.push('## Alla resor');
    rader.push('');
    rader.push('| # | Ålder | Belopp | Filter | Träffar | Klick | Rader | Status |');
    rader.push('|--:|------:|-------:|--------|--------:|-------|-------|--------|');
    for (const r of rap.resor) {
        rader.push(`| ${r.nr} | ${r.gjorde.alder} | ${(r.gjorde.belopp / 1e6).toFixed(1)} Mkr | ` +
            `${r.gjorde.filter.join(' + ') || '–'} | ${r.traffar ?? '?'} | ` +
            `${r.klick ? r.klick.bolag : '–'} | ${r.rader_i_db.sokningar}s/${r.rader_i_db.bolagsklick}k | ` +
            `${r.avvikelser === 0 ? '✅' : '❌ ' + r.avvikelser} |`);
    }
    rader.push('');
    const m = rap.manuellt;
    rader.push('## Kontrollera i dashboarden');
    rader.push('');
    rader.push('Testdatan ligger kvar med flit. Öppna dashboarden, slå på testvyn med');
    rader.push('kolvknappen i toppraden och jämför mot siffrorna nedan. Välj ett');
    rader.push('tidsintervall som rymmer körningen.');
    rader.push('');
    rader.push('| I dashboarden | Ska visa |');
    rader.push('|---|---|');
    rader.push('| Unika besök | **' + m.unika_besok + '** |');
    rader.push('| Klick vidare | **' + m.klick + '** |');
    rader.push('| Konvertering | **' + m.konvertering_procent + ' %** (' + m.besok_med_klick +
        ' av ' + m.unika_besok + ' besök) |');
    rader.push('| Sökningar utan träffar | **' + m.nollresultat + '** |');
    rader.push('| Sidfoten | varav ' + m.sokningsrader + ' testsökningar och ' + m.klick + ' testklick |');
    rader.push('');
    if (m.bolag.length) {
        rader.push('**Populäraste bolagen** ska innehålla exakt dessa:');
        rader.push('');
        rader.push('| Bolag | Klick |');
        rader.push('|---|---:|');
        for (const b of m.bolag) rader.push('| ' + b.namn + ' | ' + b.antal + ' |');
        rader.push('');
    }
    if (m.filterkombinationer.length) {
        rader.push('**Vanligaste kombinationerna** ska innehålla exakt dessa:');
        rader.push('');
        rader.push('| Kombination | Antal |');
        rader.push('|---|---:|');
        for (const k of m.filterkombinationer) rader.push('| ' + k.namn + ' | ' + k.antal + ' |');
        rader.push('');
    }
    rader.push('När kontrollen är gjord tar ' + BT + 'npm run test:rensa -- --kor' + BT + ' bort raderna.');
    rader.push('');
    rader.push('_Maskinläsbar version: ' + BT + jsonFil.replace(ROT + '\\', '').replace(ROT + '/', '') + BT + '_');

    const mdFil = join(mapp, `e2e-${stamp}.md`);
    writeFileSync(mdFil, rader.join('\n'), 'utf8');

    log('');
    log('  ' + '─'.repeat(58));
    log('  ' + (s.lackage > 0
        ? '🚨 LÄCKAGE — ' + s.lackage + ' testrad(er) i den riktiga statistiken'
        : (s.avvikelser === 0 ? '✅ GODKÄND' : '❌ ' + s.avvikelser + ' AVVIKELSER')));
    log('');
    log(`  Sökningsrader:  ${s.sokningsrader_i_db}`);
    log(`  Klickrader:     ${s.klickrader_i_db} (förväntade ${s.forvantade_klick})`);
    log('  Märkta som test: ' + (s.alla_markta_som_test ? 'alla ✓' : 'NEJ — några saknar flaggan'));
    if (rap.flaggkontroll.frammande_omarkta_i_fonstret > 0) {
        log('  Omärkta rader i fönstret från andra besök: ' +
            rap.flaggkontroll.frammande_omarkta_i_fonstret + ' (trolig riktig trafik)');
    }
    log('');
    log('  Testdatan ligger kvar för manuell kontroll i dashboarden.');
    log('  Rensa när du är klar: npm run test:rensa -- --kor');
    if (rap.avvikelser.length) {
        log('');
        for (const a of rap.avvikelser.slice(0, 12)) {
            log(`   • resa ${a.resa}: ${a.text}`);
        }
        if (rap.avvikelser.length > 12) log(`   … och ${rap.avvikelser.length - 12} till`);
    }
    log('');
    log(`  Rapport: testrapporter/e2e-${stamp}.md`);
    log(`           testrapporter/e2e-${stamp}.json`);
    log('');
}

// Kör bara när filen startas direkt. Utan det här startar en `import` av
// modulen hela testsviten som sidoeffekt.
const korsDirekt = process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href;

if (korsDirekt) {
    main().catch((e) => { console.error(e); process.exitCode = 1; });
}
