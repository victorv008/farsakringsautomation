/**
 * Den frivilliga ortsfrågan på resultatsidan.
 *
 * Varför den finns: IP-uppslaget i /api/plats kan inte ge ett sant svar för
 * mobiltrafik — svenska operatörer dirigerar trafik genom ett fåtal noder,
 * så en besökare i Växjö rapporteras som Stockholm. Informationen finns
 * inte i paketet. Det enda sättet att veta är att fråga.
 *
 * Svarsfrekvensen blir låg, och det gör ingenting: poängen är inte täckning
 * utan kalibrering. Med hundra svar går det att mäta hur ofta IP-gissningen
 * träffade rätt, och då vet vi vad resten av siffrorna är värda.
 *
 * Ligger EFTER resultatkorten, så den inte kostar något i tratten. Ingen
 * skicka-knapp, ingen modal, inget som tar uppmärksamhet från jämförelsen.
 *
 * Progressiv förbättring: rutan är dold i HTML och visas bara om
 * kommunlistan och Analytics faktiskt laddat.
 */
(function () {
    'use strict';

    function starta() {
        try {
            var ruta = document.getElementById('ortfraga');
            var falt = document.getElementById('ort-input');
            var lista = document.getElementById('kommuner-lista');
            var tack = document.getElementById('ort-tack');
            var K = window.Kommuner;

            if (!ruta || !falt || !lista || !K || !window.Analytics ||
                typeof window.Analytics.loggaOrt !== 'function') return;

            // 290 <option> i ett svep — en fragment-insättning, inte 290.
            var frag = document.createDocumentFragment();
            for (var i = 0; i < K.lista.length; i++) {
                var o = document.createElement('option');
                o.value = K.lista[i];
                frag.appendChild(o);
            }
            lista.appendChild(frag);
            ruta.hidden = false;

            var klar = false;

            function svara() {
                if (klar) return;
                var v = falt.value;
                if (!v || !v.trim()) return;
                // Loggas bara om texten matchar en riktig kommun. Halvskrivet
                // ("Väx") eller påhittat ("Xyzzy") loggas inte alls — hellre
                // inget svar än ett gissat.
                if (!window.Analytics.loggaOrt(v)) return;
                klar = true;
                falt.disabled = true;
                falt.classList.add('opacity-60');
                if (tack) tack.hidden = false;
            }

            // change fyras när fältet lämnas eller ett förslag väljs.
            falt.addEventListener('change', svara);
            falt.addEventListener('blur', svara);
            falt.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); svara(); }
            });
        } catch (e) {
            /* tyst — frågan är en bonus, den får aldrig störa sidan */
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', starta);
    } else {
        starta();
    }
})();
