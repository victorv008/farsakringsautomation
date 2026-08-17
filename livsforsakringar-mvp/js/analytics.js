/**
 * Anonym analytics för Livförsäkringar.se
 *
 * Loggar två saker: när någon når resultatsidan, och när någon klickar
 * vidare till ett bolag. Kopplas ihop med ett slumpmässigt sok_id som ligger
 * i sessionStorage och försvinner när fliken stängs.
 *
 * Ingen IP, inga cookies, ingen identifierare som överlever ett besök.
 *
 * Allt är inkapslat i try/catch och tysta promise-avslag. Om loggningen
 * fallerar — blockerad av adblock, offline, Supabase nere — ska besökaren
 * inte märka något alls.
 */
(function () {
    'use strict';

    var BAS = 'https://eptpgmfupemwtkkqcpiw.supabase.co';
    var NYCKEL = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVwdHBnbWZ1cGVtd3Rra3FjcGl3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NDA2MjUsImV4cCI6MjA5NTMxNjYyNX0.A5moYH95Dd615ZgXyw_cm0TpTBMv_yJq6uYP6SeeJyA';

    /* ── Slumpmässigt id per flik ───────────────────────────────────────── */

    function nyttId() {
        try {
            if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
            // Fallback: bygg en v4-liknande sträng ur getRandomValues
            var b = new Uint8Array(16);
            crypto.getRandomValues(b);
            b[6] = (b[6] & 0x0f) | 0x40;
            b[8] = (b[8] & 0x3f) | 0x80;
            var h = [];
            for (var i = 0; i < 16; i++) h.push((b[i] + 0x100).toString(16).slice(1));
            return h.slice(0, 4).join('') + '-' + h.slice(4, 6).join('') + '-' +
                   h.slice(6, 8).join('') + '-' + h.slice(8, 10).join('') + '-' +
                   h.slice(10, 16).join('');
        } catch (e) {
            return null;
        }
    }

    function sokId() {
        try {
            var id = sessionStorage.getItem('ins_sok_id');
            if (!id) {
                id = nyttId();
                if (!id) return null;
                sessionStorage.setItem('ins_sok_id', id);
            }
            return id;
        } catch (e) {
            // Privat läge kan blockera sessionStorage helt
            return null;
        }
    }

    function enhet() {
        try {
            return window.matchMedia('(max-width: 1023px)').matches ? 'mobil' : 'desktop';
        } catch (e) {
            return null;
        }
    }

    /* ── Skicka ─────────────────────────────────────────────────────────── */

    function skicka(tabell, rad) {
        try {
            fetch(BAS + '/rest/v1/' + tabell, {
                method: 'POST',
                headers: {
                    'apikey': NYCKEL,
                    'Authorization': 'Bearer ' + NYCKEL,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(rad),
                keepalive: true // överlever att fliken navigerar bort
            }).catch(function () { /* tyst */ });
        } catch (e) {
            /* tyst */
        }
    }

    /* ── Publikt API ────────────────────────────────────────────────────── */

    var senasteSokning = null; // hindrar dubbelloggning av identisk sökning

    function loggaSokning(data) {
        try {
            var id = sokId();
            if (!id) return;

            var filter = Array.isArray(data.filter) ? data.filter.slice(0, 20) : [];
            var fingeravtryck = [data.alder, data.belopp, filter.join(','), data.antalTraffar].join('|');
            if (fingeravtryck === senasteSokning) return;
            senasteSokning = fingeravtryck;

            skicka('sokningar', {
                sok_id: id,
                alder: Number.isFinite(data.alder) ? data.alder : null,
                belopp: Number.isFinite(data.belopp) ? data.belopp : null,
                filter_valda: filter,
                antal_traffar: Number.isFinite(data.antalTraffar) ? data.antalTraffar : null,
                enhet: enhet()
            });
        } catch (e) {
            /* tyst */
        }
    }

    function loggaKlick(data) {
        try {
            var id = sokId();
            if (!id || !data.bolag) return;

            skicka('bolagsklick', {
                sok_id: id,
                bolag: String(data.bolag).slice(0, 120),
                pris_visat: Number.isFinite(data.pris) ? data.pris : null,
                klick_position: Number.isFinite(data.position) ? data.position : null,
                sortering: data.sortering || null
            });
        } catch (e) {
            /* tyst */
        }
    }

    window.Analytics = {
        loggaSokning: loggaSokning,
        loggaKlick: loggaKlick
    };
})();
