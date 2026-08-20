#!/usr/bin/env node
/**
 * Självtest av läckagedetektionen.
 *
 * Hela testsvitens värde vilar på att den fäller körningen om en testrad
 * hamnar omärkt i den riktiga statistiken. Att den rapporterar noll när allt
 * är rätt bevisar inte att den skulle fånga ett fel — det gör det här.
 *
 * Kör: node tests/sjalvtest-lackage.mjs
 */

import { jamfor } from './kor-tester.mjs';

let fel = 0;
const pastaende = (namn, villkor, detalj) => {
    console.log(`  ${villkor ? '✔' : '✖'} ${namn}${villkor ? '' : '  → ' + detalj}`);
    if (!villkor) fel++;
};

const ID = '11111111-2222-3333-4444-555555555555';
const FRAMMANDE = '99999999-8888-7777-6666-555555555555';

const resa = {
    nr: 1,
    gjorde: { alder: 32, belopp: 2500000, scenarier: [], filter: [], vantatNoll: false },
    sok_id: ID,
    traffar: 15,
    klick: { bolag: 'Folksam', pris: 58, position: 0, sortering: 'price' },
    fel: [],
};

const sokRad = (over = {}) => ({
    sok_id: ID, alder: 32, belopp: 2500000, filter_valda: [], antal_traffar: 15,
    enhet: 'desktop', ar_test: true, skapad_at: '2026-08-20T01:00:00Z', ...over,
});
const klickRad = (over = {}) => ({
    sok_id: ID, bolag: 'Folksam', pris_visat: 58, klick_position: 0,
    sortering: 'price', ar_test: true, skapad_at: '2026-08-20T01:00:05Z', ...over,
});

const kor = (sok, klick, meta = {}) => jamfor([resa], sok, klick, {
    bas: 'test', start: new Date(), slut: new Date(), blockerade: 1,
    omarktaSokningar: [], omarktaKlick: [], fonster: { fran: 'a', till: 'b' }, ...meta,
});

console.log('\n  Självtest — läckagedetektion\n  ' + '─'.repeat(50));

/* 1. Allt rätt → godkänd */
let r = kor([sokRad()], [klickRad()]);
pastaende('rent fall ger GODKÄND', r.sammanfattning.resultat === 'GODKÄND', r.sammanfattning.resultat);
pastaende('rent fall rapporterar noll läckage', r.sammanfattning.lackage === 0, r.sammanfattning.lackage);

/* 2. Omärkt sökningsrad bland våra → läckage */
r = kor([sokRad({ ar_test: false })], [klickRad()]);
pastaende('omärkt sökningsrad ger LÄCKAGE', r.sammanfattning.resultat === 'LÄCKAGE', r.sammanfattning.resultat);
pastaende('läckaget räknas', r.sammanfattning.lackage === 1, r.sammanfattning.lackage);
pastaende('avvikelsen har typ LACKAGE',
    r.avvikelser.some((a) => a.typ === 'LACKAGE'), JSON.stringify(r.avvikelser.map((a) => a.typ)));

/* 3. Omärkt klickrad bland våra → läckage */
r = kor([sokRad()], [klickRad({ ar_test: false })]);
pastaende('omärkt klickrad ger LÄCKAGE', r.sammanfattning.resultat === 'LÄCKAGE', r.sammanfattning.resultat);

/* 4. Omärkt rad i fönstret som hör till oss → läckage */
r = kor([sokRad()], [klickRad()], { omarktaSokningar: [sokRad({ ar_test: false })] });
pastaende('omärkt rad i fönstret med vårt sok_id ger LÄCKAGE',
    r.sammanfattning.resultat === 'LÄCKAGE', r.sammanfattning.resultat);

/* 5. Omärkt rad i fönstret från någon annan → INTE läckage.
      En riktig besökare kan surfa samtidigt; det får inte fälla testet. */
r = kor([sokRad()], [klickRad()], {
    omarktaSokningar: [sokRad({ sok_id: FRAMMANDE, ar_test: false })],
});
pastaende('främmande omärkt rad ger INTE läckage',
    r.sammanfattning.lackage === 0, r.sammanfattning.lackage);
pastaende('främmande rad räknas separat',
    r.flaggkontroll.frammande_omarkta_i_fonstret === 1,
    r.flaggkontroll.frammande_omarkta_i_fonstret);
pastaende('främmande rad påverkar inte verdict',
    r.sammanfattning.resultat === 'GODKÄND', r.sammanfattning.resultat);

/* 6. Läckage väger tyngre än vanliga avvikelser */
r = kor([sokRad({ ar_test: false, alder: 99 })], [klickRad()]);
pastaende('läckage vinner över AVVIKELSER i verdict',
    r.sammanfattning.resultat === 'LÄCKAGE', r.sammanfattning.resultat);

console.log('  ' + '─'.repeat(50));
console.log(fel === 0
    ? '  ✅ Alla kontroller passerade — detektionen fångar läckage\n'
    : `  ❌ ${fel} kontroll(er) misslyckades\n`);
process.exitCode = fel === 0 ? 0 : 1;
