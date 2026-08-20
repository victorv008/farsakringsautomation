#!/usr/bin/env node
/**
 * Radera testdata ur Supabase.
 *
 * Tar bort alla rader med ar_test = true. Riktiga besöksrader lämnas orörda.
 *
 *   node tests/rensa-testdata.mjs            visar hur många som skulle tas bort
 *   node tests/rensa-testdata.mjs --kor      raderar på riktigt
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROT = join(dirname(fileURLToPath(import.meta.url)), '..');

const fil = join(ROT, '.env');
if (existsSync(fil)) {
    for (const rad of readFileSync(fil, 'utf8').split('\n')) {
        const m = rad.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
}

const URL = process.env.SUPABASE_URL || 'https://eptpgmfupemwtkkqcpiw.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
const SKARPT = process.argv.includes('--kor');

if (!KEY) {
    console.error('\n  ✖ SUPABASE_SERVICE_ROLE_KEY (eller SUPABASE_SECRET_KEY) saknas i .env\n');
    process.exitCode = 1;
} else {
    const db = createClient(URL, KEY, { auth: { persistSession: false } });

    const [s, k] = await Promise.all([
        db.from('sokningar').select('id', { count: 'exact', head: true }).eq('ar_test', true),
        db.from('bolagsklick').select('id', { count: 'exact', head: true }).eq('ar_test', true),
    ]);

    if (s.error || k.error) {
        console.error('\n  ✖ Kunde inte räkna: ' + (s.error?.message ?? k.error?.message) + '\n');
        process.exitCode = 1;
    } else {
        console.log('');
        console.log(`  Testrader i databasen:  ${s.count} sökningar, ${k.count} klick`);

        if (!SKARPT) {
            console.log('');
            console.log('  Torrkörning — inget raderat.');
            console.log('  Kör med --kor för att radera på riktigt.');
            console.log('');
        } else {
            const d1 = await db.from('bolagsklick').delete().eq('ar_test', true);
            const d2 = await db.from('sokningar').delete().eq('ar_test', true);
            if (d1.error || d2.error) {
                console.error('  ✖ Fel vid radering: ' + (d1.error?.message ?? d2.error?.message));
                process.exitCode = 1;
            } else {
                const [e1, e2] = await Promise.all([
                    db.from('sokningar').select('id', { count: 'exact', head: true }).eq('ar_test', true),
                    db.from('bolagsklick').select('id', { count: 'exact', head: true }).eq('ar_test', true),
                ]);
                console.log('');
                console.log(`  ✔ Raderat. Kvarvarande testrader: ${e1.count} sökningar, ${e2.count} klick`);
                console.log('');
            }
        }
    }
}
