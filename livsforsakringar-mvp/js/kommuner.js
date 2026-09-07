/**
 * Sveriges 290 kommuner, grupperade på län.
 *
 * ALL normalisering av ortsnamn sker här, i webbläsaren — både för orten
 * som /api/plats härleder ur IP och för den ort besökaren själv skriver in.
 * Serverfunktionen skickar bara vidare vad Vercel sa, och gör ingen egen
 * tolkning. Skälet är att en delad modul över server/klient inte går att
 * lita på här: Node avgör CJS mot ESM utifrån närmaste package.json, och
 * repo-roten har "type": "module" medan Vercels projektrot saknar
 * package.json helt. Två kopior av listan hade kunnat glida isär. En kopia
 * på ett ställe kan inte det.
 *
 * Ortsnamn från Vercel kommer utan svenska tecken ("Malmo", "Gothenburg"),
 * så uppslaget sker på en avskalad nyckel: gemener, diakriter borttagna.
 *
 * Kranskommuner grupperas till sin stad — det var vad som efterfrågades och
 * det minskar fragmenteringen. Baksidan: det förstärker Stockholms andel,
 * som redan är uppblåst av att mobiltrafik dirigeras via noder i regionen.
 */
window.Kommuner = (function () {
    'use strict';

    /* Länens officiella bokstavskoder är också det Vercel skickar i
       x-vercel-ip-country-region, så nyckeln duger åt båda hållen. */
    var LAN = {
        AB: { namn: 'Stockholm', slug: 'stockholm', kommuner: ['Botkyrka', 'Danderyd', 'Ekerö', 'Haninge', 'Huddinge', 'Järfälla', 'Lidingö', 'Nacka', 'Norrtälje', 'Nykvarn', 'Nynäshamn', 'Salem', 'Sigtuna', 'Sollentuna', 'Solna', 'Stockholm', 'Sundbyberg', 'Södertälje', 'Tyresö', 'Täby', 'Upplands Väsby', 'Upplands-Bro', 'Vallentuna', 'Vaxholm', 'Värmdö', 'Österåker'] },
        C:  { namn: 'Uppsala', slug: 'uppsala', kommuner: ['Enköping', 'Heby', 'Håbo', 'Knivsta', 'Tierp', 'Uppsala', 'Älvkarleby', 'Östhammar'] },
        D:  { namn: 'Södermanland', slug: 'sodermanland', kommuner: ['Eskilstuna', 'Flen', 'Gnesta', 'Katrineholm', 'Nyköping', 'Oxelösund', 'Strängnäs', 'Trosa', 'Vingåker'] },
        E:  { namn: 'Östergötland', slug: 'ostergotland', kommuner: ['Boxholm', 'Finspång', 'Kinda', 'Linköping', 'Mjölby', 'Motala', 'Norrköping', 'Söderköping', 'Vadstena', 'Valdemarsvik', 'Ydre', 'Åtvidaberg', 'Ödeshög'] },
        F:  { namn: 'Jönköping', slug: 'jonkoping', kommuner: ['Aneby', 'Eksjö', 'Gislaved', 'Gnosjö', 'Habo', 'Jönköping', 'Mullsjö', 'Nässjö', 'Sävsjö', 'Tranås', 'Vaggeryd', 'Vetlanda', 'Värnamo'] },
        G:  { namn: 'Kronoberg', slug: 'kronoberg', kommuner: ['Alvesta', 'Lessebo', 'Ljungby', 'Markaryd', 'Tingsryd', 'Uppvidinge', 'Växjö', 'Älmhult'] },
        H:  { namn: 'Kalmar', slug: 'kalmar', kommuner: ['Borgholm', 'Emmaboda', 'Hultsfred', 'Högsby', 'Kalmar', 'Mönsterås', 'Mörbylånga', 'Nybro', 'Oskarshamn', 'Torsås', 'Vimmerby', 'Västervik'] },
        I:  { namn: 'Gotland', slug: 'gotland', kommuner: ['Gotland'] },
        K:  { namn: 'Blekinge', slug: 'blekinge', kommuner: ['Karlshamn', 'Karlskrona', 'Olofström', 'Ronneby', 'Sölvesborg'] },
        M:  { namn: 'Skåne', slug: 'skane', kommuner: ['Bjuv', 'Bromölla', 'Burlöv', 'Båstad', 'Eslöv', 'Helsingborg', 'Hässleholm', 'Höganäs', 'Hörby', 'Höör', 'Klippan', 'Kristianstad', 'Kävlinge', 'Landskrona', 'Lomma', 'Lund', 'Malmö', 'Osby', 'Perstorp', 'Simrishamn', 'Sjöbo', 'Skurup', 'Staffanstorp', 'Svalöv', 'Svedala', 'Tomelilla', 'Trelleborg', 'Vellinge', 'Ystad', 'Åstorp', 'Ängelholm', 'Örkelljunga', 'Östra Göinge'] },
        N:  { namn: 'Halland', slug: 'halland', kommuner: ['Falkenberg', 'Halmstad', 'Hylte', 'Kungsbacka', 'Laholm', 'Varberg'] },
        O:  { namn: 'Västra Götaland', slug: 'vastra-gotaland', kommuner: ['Ale', 'Alingsås', 'Bengtsfors', 'Bollebygd', 'Borås', 'Dals-Ed', 'Essunga', 'Falköping', 'Färgelanda', 'Grästorp', 'Gullspång', 'Göteborg', 'Götene', 'Herrljunga', 'Hjo', 'Härryda', 'Karlsborg', 'Kungälv', 'Lerum', 'Lidköping', 'Lilla Edet', 'Lysekil', 'Mariestad', 'Mark', 'Mellerud', 'Munkedal', 'Mölndal', 'Orust', 'Partille', 'Skara', 'Skövde', 'Sotenäs', 'Stenungsund', 'Strömstad', 'Svenljunga', 'Tanum', 'Tibro', 'Tidaholm', 'Tjörn', 'Tranemo', 'Trollhättan', 'Töreboda', 'Uddevalla', 'Ulricehamn', 'Vara', 'Vårgårda', 'Vänersborg', 'Åmål', 'Öckerö'] },
        S:  { namn: 'Värmland', slug: 'varmland', kommuner: ['Arvika', 'Eda', 'Filipstad', 'Forshaga', 'Grums', 'Hagfors', 'Hammarö', 'Karlstad', 'Kil', 'Kristinehamn', 'Munkfors', 'Storfors', 'Sunne', 'Säffle', 'Torsby', 'Årjäng'] },
        T:  { namn: 'Örebro', slug: 'orebro', kommuner: ['Askersund', 'Degerfors', 'Hallsberg', 'Hällefors', 'Karlskoga', 'Kumla', 'Laxå', 'Lekeberg', 'Lindesberg', 'Ljusnarsberg', 'Nora', 'Örebro'] },
        U:  { namn: 'Västmanland', slug: 'vastmanland', kommuner: ['Arboga', 'Fagersta', 'Hallstahammar', 'Kungsör', 'Köping', 'Norberg', 'Sala', 'Skinnskatteberg', 'Surahammar', 'Västerås'] },
        W:  { namn: 'Dalarna', slug: 'dalarna', kommuner: ['Avesta', 'Borlänge', 'Falun', 'Gagnef', 'Hedemora', 'Leksand', 'Ludvika', 'Malung-Sälen', 'Mora', 'Orsa', 'Rättvik', 'Smedjebacken', 'Säter', 'Vansbro', 'Älvdalen'] },
        X:  { namn: 'Gävleborg', slug: 'gavleborg', kommuner: ['Bollnäs', 'Gävle', 'Hofors', 'Hudiksvall', 'Ljusdal', 'Nordanstig', 'Ockelbo', 'Ovanåker', 'Sandviken', 'Söderhamn'] },
        Y:  { namn: 'Västernorrland', slug: 'vasternorrland', kommuner: ['Härnösand', 'Kramfors', 'Sollefteå', 'Sundsvall', 'Timrå', 'Ånge', 'Örnsköldsvik'] },
        Z:  { namn: 'Jämtland', slug: 'jamtland', kommuner: ['Berg', 'Bräcke', 'Härjedalen', 'Krokom', 'Ragunda', 'Strömsund', 'Åre', 'Östersund'] },
        AC: { namn: 'Västerbotten', slug: 'vasterbotten', kommuner: ['Bjurholm', 'Dorotea', 'Lycksele', 'Malå', 'Nordmaling', 'Norsjö', 'Robertsfors', 'Skellefteå', 'Sorsele', 'Storuman', 'Umeå', 'Vilhelmina', 'Vindeln', 'Vännäs', 'Åsele'] },
        BD: { namn: 'Norrbotten', slug: 'norrbotten', kommuner: ['Arjeplog', 'Arvidsjaur', 'Boden', 'Gällivare', 'Haparanda', 'Jokkmokk', 'Kalix', 'Kiruna', 'Luleå', 'Pajala', 'Piteå', 'Älvsbyn', 'Överkalix', 'Övertorneå'] },
    };

    /* Kranskommuner som redovisas under sin stad. Håll listan kort och
       försvarbar: bara kommuner vars invånare i praktiken pendlar in. */
    var GRUPP = {
        // Stockholm
        'Solna': 'Stockholm', 'Sundbyberg': 'Stockholm', 'Nacka': 'Stockholm',
        'Danderyd': 'Stockholm', 'Lidingö': 'Stockholm', 'Järfälla': 'Stockholm',
        'Sollentuna': 'Stockholm', 'Huddinge': 'Stockholm', 'Botkyrka': 'Stockholm',
        'Täby': 'Stockholm', 'Tyresö': 'Stockholm', 'Haninge': 'Stockholm',
        'Upplands Väsby': 'Stockholm', 'Upplands-Bro': 'Stockholm', 'Ekerö': 'Stockholm',
        'Salem': 'Stockholm', 'Vallentuna': 'Stockholm', 'Österåker': 'Stockholm',
        'Vaxholm': 'Stockholm', 'Värmdö': 'Stockholm',
        // Göteborg
        'Mölndal': 'Göteborg', 'Partille': 'Göteborg', 'Härryda': 'Göteborg',
        'Öckerö': 'Göteborg', 'Ale': 'Göteborg', 'Lerum': 'Göteborg',
        // Malmö
        'Burlöv': 'Malmö', 'Lomma': 'Malmö', 'Staffanstorp': 'Malmö',
        'Svedala': 'Malmö', 'Vellinge': 'Malmö',
        // Övriga tydliga stadskärnor
        'Kävlinge': 'Lund',
        'Bjuv': 'Helsingborg', 'Åstorp': 'Helsingborg',
        'Hammarö': 'Karlstad',
        'Timrå': 'Sundsvall',
        'Kumla': 'Örebro',
        'Habo': 'Jönköping', 'Mullsjö': 'Jönköping',
        'Bollebygd': 'Borås',
        'Knivsta': 'Uppsala',
        'Hofors': 'Gävle',
        'Vännäs': 'Umeå',
    };

    /* ── Uppslag ────────────────────────────────────────────────────── */

    var lista = [];              // alla 290, sorterade — för <datalist>
    var lanForKommun = {};       // nyckel → länets slug
    var kanoniskt = {};          // nyckel → kommunens riktiga namn

    function nyckel(s) {
        return String(s || '')
            .normalize('NFD').replace(/[̀-ͯ]/g, '')  // ö → o, å → a, é → e
            .toLowerCase()
            .replace(/[^a-z]/g, '');                           // bindestreck, mellanslag
    }

    for (var kod in LAN) {
        if (!Object.prototype.hasOwnProperty.call(LAN, kod)) continue;
        for (var i = 0; i < LAN[kod].kommuner.length; i++) {
            var k = LAN[kod].kommuner[i];
            lista.push(k);
            lanForKommun[nyckel(k)] = LAN[kod].slug;
            kanoniskt[nyckel(k)] = k;
        }
    }
    lista.sort(function (a, b) { return a.localeCompare(b, 'sv'); });

    /* Extra nycklar för namn Vercel kan skicka men som inte är kommunnamn. */
    var ALIAS = {
        gothenburg: 'Göteborg',
        stockholmcounty: 'Stockholm',
        vasterasstad: 'Västerås',
        linkopingskommun: 'Linköping',
    };

    /**
     * Ett fritt ortsnamn → den kommun vi redovisar det under.
     * Okänt namn ger null — aldrig ett påhittat värde, och aldrig
     * indataströmmen rakt igenom.
     */
    function tillOrt(namn) {
        var n = nyckel(namn);
        if (!n) return null;
        var kommun = kanoniskt[n] || ALIAS[n] || null;
        if (!kommun) return null;
        return GRUPP[kommun] || kommun;
    }

    /** Ett fritt ortsnamn → länets slug, eller null. */
    function lanForOrt(namn) {
        var n = nyckel(namn);
        if (!n) return null;
        if (!kanoniskt[n] && ALIAS[n]) n = nyckel(ALIAS[n]);
        return lanForKommun[n] || null;
    }

    /** En länsbokstavskod från Vercel → slug. Okänd kod ger null. */
    function lanForKod(kod) {
        var v = LAN[String(kod || '').toUpperCase()];
        return v ? v.slug : null;
    }

    /** Alla giltiga länsslugar — används av CHECK-constrainten och testet. */
    function lanSlugar() {
        var ut = [];
        for (var kod in LAN) if (Object.prototype.hasOwnProperty.call(LAN, kod)) ut.push(LAN[kod].slug);
        ut.sort();
        return ut;
    }

    /** Slug → visningsnamn, för dashboarden. */
    function lanNamn(slug) {
        for (var kod in LAN) {
            if (Object.prototype.hasOwnProperty.call(LAN, kod) && LAN[kod].slug === slug) return LAN[kod].namn;
        }
        return slug === 'utland' ? 'Utanför Sverige' : slug === 'okand' ? 'Okänt' : slug;
    }

    return {
        lista: lista,
        tillOrt: tillOrt,
        lanForOrt: lanForOrt,
        lanForKod: lanForKod,
        lanSlugar: lanSlugar,
        lanNamn: lanNamn,
        nyckel: nyckel,
    };
})();
