/**
 * Ungefärlig plats ur besökarens IP-adress.
 *
 * Läser Vercels geo-headers, som sätts i edgen innan requesten når hit.
 * IP-adressen finns i x-vercel-forwarded-for men läses aldrig, loggas
 * aldrig och lämnar aldrig funktionen. Inga koordinater, ingen postort,
 * ingen cookie, ingen tredje part.
 *
 * Funktionen TOLKAR inte ortsnamnet. Den avkodar det och skickar vidare.
 * All normalisering mot Sveriges 290 kommuner sker i js/kommuner.js i
 * webbläsaren, så att samma kod hanterar både den här orten och den ort
 * besökaren själv skriver in på resultatsidan. En enda lista, ett enda
 * ställe den kan vara fel på.
 *
 * .mjs och inte .js: Node avgör modulformat utifrån närmaste package.json,
 * och repo-roten har "type": "module" medan Vercels projektrot saknar
 * package.json. .mjs är ESM oavsett vilken av dem byggmiljön ser.
 */

export default function handler(req, res) {
    // KRITISKT: ett cachat svar skulle serveras till NÄSTA besökare — fel
    // data, och en verklig läcka mellan besök. Detta är inte en optimering.
    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    res.setHeader('Vary', '*');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    const land = String(req.headers['x-vercel-ip-country'] || '').toUpperCase().slice(0, 2);
    const region = String(req.headers['x-vercel-ip-country-region'] || '').toUpperCase().slice(0, 4);

    // Vercel URL-kodar ortsnamnet: Malmö kommer som Malm%C3%B6. Utan
    // avkodning hamnar procenttecknen rakt in i statistiken.
    let ort = '';
    try {
        ort = decodeURIComponent(req.headers['x-vercel-ip-city'] || '').slice(0, 60);
    } catch (e) {
        ort = '';
    }

    // Oberoende enhetssignal. analytics.js gissar enhet ur fönsterbredden,
    // vilket räknar ett smalt desktopfönster som mobil — och hela
    // osäkerhetsberättelsen i dashboarden vilar på mobil/dator-uppdelningen.
    // Webbläsaren säger här vad den faktiskt är.
    const hint = req.headers['sec-ch-ua-mobile'];
    const mobil = hint === '?1' ? true : hint === '?0' ? false : null;

    res.status(200).end(JSON.stringify({
        land: land || null,
        region: region || null,
        ort: ort || null,
        mobil,
    }));
}
