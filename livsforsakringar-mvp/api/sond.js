/**
 * TILLFÄLLIG SOND — raderas när mätningen är gjord.
 *
 * Vercels geo-headers beror på plan och runtime, och det går inte att
 * verifiera utan att deploya. Den här funktionen ekar tillbaka *enbart*
 * geo- och enhetshintar, så vi vet om ortsnivån alls är möjlig innan
 * något byggs på antagandet.
 *
 * Läser aldrig IP, cookies eller auth-headers. Svarar aldrig med dem.
 */

// Vitlista. Allt annat i requesten rörs inte och lämnar aldrig funktionen.
const TILLATNA = [
    'x-vercel-ip-country',
    'x-vercel-ip-country-region',
    'x-vercel-ip-city',
    'x-vercel-ip-timezone',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
];

module.exports = (req, res) => {
    // Ett cachat geosvar skulle serveras till NÄSTA besökare. Aldrig cacha.
    res.setHeader('Cache-Control', 'no-store, private, max-age=0');
    res.setHeader('Vary', '*');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const sett = {};
    for (const n of TILLATNA) {
        if (n in req.headers) sett[n] = req.headers[n];
    }

    const rastad = req.headers['x-vercel-ip-city'];
    let avkodad = null;
    try { avkodad = rastad ? decodeURIComponent(rastad) : null; } catch (e) { avkodad = '(ogiltig URL-kodning)'; }

    res.status(200).json({
        format: 'cjs',
        finns_stad: 'x-vercel-ip-city' in req.headers,
        stad_ra: rastad ?? null,
        stad_avkodad: avkodad,
        finns_region: 'x-vercel-ip-country-region' in req.headers,
        headers: sett,
        // Vilka x-vercel-headers finns över huvud taget? Namn, aldrig värden —
        // x-vercel-forwarded-for innehåller IP och får inte läcka ut.
        alla_vercel_headernamn: Object.keys(req.headers).filter((k) => k.startsWith('x-vercel-')),
    });
};
