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

    /**
     * Testläge. Riggen injicerar __LFTEST__ innan sidan laddas.
     * Att sätta flaggan i klienten räcker inte — servern kräver att anropet
     * bär rätt token, så en besökare kan inte förorena statistiken genom att
     * pilla i konsolen eller i URL:en.
     */
    function testlage() {
        try {
            var t = window.__LFTEST__;
            return (t && typeof t.token === 'string' && t.token) ? t.token : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Löpnummer inom besöket. Ligger i sessionStorage, inte i minnet — annars
     * börjar varje sidladdning om på noll och tidslinjen går inte att ordna.
     */
    function nastaSekvens() {
        try {
            var n = parseInt(sessionStorage.getItem('ins_sek'), 10);
            if (!Number.isFinite(n) || n < 0) n = 0;
            if (n > 1000) return 1000;          // taket i CHECK-constrainten
            sessionStorage.setItem('ins_sek', String(n + 1));
            return n;
        } catch (e) {
            return 0;
        }
    }

    /** Millisekunder sedan besöket började — inte sedan sidan laddades. */
    function msSedanStart() {
        try {
            var t = parseInt(sessionStorage.getItem('ins_start'), 10);
            if (!Number.isFinite(t)) {
                t = Date.now();
                sessionStorage.setItem('ins_start', String(t));
            }
            var d = Date.now() - t;
            return (d >= 0 && d <= 86400000) ? d : null;
        } catch (e) {
            return null;
        }
    }

    /** Vilken sida vi står på. Whitelist — CHECK-constrainten avvisar annat. */
    var SIDOR = {
        '/': 'start', '/index': 'start',
        '/livssituation': 'livssituation',
        '/resultat': 'resultat',
        '/faq': 'faq',
        '/om-oss': 'om-oss',
        '/sa-fungerar-det': 'sa-fungerar-det',
        '/integritetspolicy': 'integritet',
        '/anvandarvillkor': 'villkor'
    };

    function nuvarandeSida() {
        try {
            // Produktion har cleanUrls, lokal server serverar .html
            var p = location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || '/';
            return SIDOR[p] || 'okand';
        } catch (e) {
            return 'okand';
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
            var token = testlage();
            var headers = {
                'apikey': NYCKEL,
                'Authorization': 'Bearer ' + NYCKEL,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            };
            if (token) {
                headers['x-test-token'] = token;
                rad.ar_test = true;
            }

            if (token) {
                // Arrayer märks rad för rad
                if (Array.isArray(rad)) rad.forEach(function (r) { r.ar_test = true; });
            }

            fetch(BAS + '/rest/v1/' + tabell, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(rad),
                keepalive: true // överlever att fliken navigerar bort
            }).then(function (r) {
                // Tyst i produktion, men testriggen måste få veta. Utan det här
                // kan en typ som CHECK-constrainten inte känner igen avvisas med
                // 400 i veckor utan att någon märker något.
                if (!r.ok && token) {
                    console.warn('[analytics] ' + r.status + ' ' + tabell);
                }
            }).catch(function () { /* tyst */ });
        } catch (e) {
            /* tyst */
        }
    }

    /* ── Händelsekö ─────────────────────────────────────────────────────── */

    var ko = [];
    var koTimer = null;

    function spola() {
        if (koTimer) { clearTimeout(koTimer); koTimer = null; }
        if (!ko.length) return;
        var batch = ko.splice(0, ko.length);
        skicka('handelser', batch);
    }

    function koa(rad) {
        ko.push(rad);
        if (ko.length >= 8) { spola(); return; }
        if (koTimer) clearTimeout(koTimer);
        koTimer = setTimeout(spola, 2000);
    }

    /**
     * Logga en händelse.
     *   typ    — måste finnas i CHECK-constrainten på handelser
     *   data   — fritt objekt, hamnar i jsonb
     *   typade — { alder, belopp, antal_traffar } när de ska aggregeras
     */
    /**
     * Logga en händelse.
     *
     * Varje rad MÅSTE ha exakt samma nycklar som alla andra i batchen —
     * PostgREST avvisar hela anropet med PGRST102 annars. Därför sätts alla
     * fält alltid, med null där värde saknas. Lägg aldrig till ett fält
     * villkorligt här.
     */
    function loggaHandelse(typ, data, typade) {
        try {
            var id = sokId();
            if (!id || !typ) return;
            var t = typade || {};
            koa({
                sok_id: id,
                sekvens: nastaSekvens(),
                typ: typ,
                sida: nuvarandeSida(),
                ms_sedan_start: msSedanStart(),
                enhet: enhet(),
                alder: Number.isFinite(t.alder) ? t.alder : null,
                belopp: Number.isFinite(t.belopp) ? t.belopp : null,
                antal_traffar: Number.isFinite(t.antalTraffar) ? t.antalTraffar : null,
                data: (data && typeof data === 'object' && !Array.isArray(data)) ? data : {}
            });
        } catch (e) {
            /* tyst */
        }
    }

    /* ── Automatiska händelser ──────────────────────────────────────────── */

    var harLoggatDold = false;

    function starta() {
        try {
            msSedanStart();                       // sätter ins_start första gången
            var ref = 'direkt';
            try {
                if (document.referrer) {
                    ref = document.referrer.indexOf(location.origin) === 0 ? 'intern' : 'extern';
                }
            } catch (e) { /* tyst */ }
            loggaHandelse('sidvisning', { ref: ref });

            // Spola när sidan lämnas. Vi loggar ingen avhoppshändelse —
            // beforeunload är opålitlig och visibilitychange fyras vid varje
            // flikbyte. Avhoppet härleds i stället ur resans form.
            document.addEventListener('visibilitychange', function () {
                if (document.visibilityState === 'hidden') {
                    if (!harLoggatDold) {
                        harLoggatDold = true;
                        loggaHandelse('sidan_dold', {});
                    }
                    spola();
                }
            });
            window.addEventListener('pagehide', function () {
                if (!harLoggatDold) {
                    harLoggatDold = true;
                    loggaHandelse('sidan_dold', {});
                }
                spola();
            });
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
        loggaKlick: loggaKlick,
        loggaHandelse: loggaHandelse,
        spola: spola,
        // Läses av testriggen för att koppla ihop rader med rätt körning
        sokId: sokId,
        arTest: function () { return !!testlage(); }
    };

    starta();
})();
