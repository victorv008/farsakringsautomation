/**
 * TILLFÄLLIG SOND nr 2 — raderas med sond.js.
 *
 * Samma svar som sond.js, men som ESM (.mjs) i stället för CommonJS.
 * Node avgör modulformat utifrån närmaste package.json: repo-roten har
 * "type": "module" medan Vercels projektrot (livsforsakringar-mvp/) saknar
 * package.json helt. Vilken som gäller i Vercels byggmiljö går inte att
 * veta utan att prova — så vi provar båda och låter deployen svara.
 *
 * Den som funkar avgör formatet på den skarpa api/plats.
 */

const TILLATNA = [
    'x-vercel-ip-country',
    'x-vercel-ip-country-region',
    'x-vercel-ip-city',
    'x-vercel-ip-timezone',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
];

export default function handler(req, res) {
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
        format: 'esm',
        finns_stad: 'x-vercel-ip-city' in req.headers,
        stad_ra: rastad ?? null,
        stad_avkodad: avkodad,
        finns_region: 'x-vercel-ip-country-region' in req.headers,
        headers: sett,
        // Namn, aldrig värden — x-vercel-forwarded-for bär IP och får inte läcka.
        alla_vercel_headernamn: Object.keys(req.headers).filter((k) => k.startsWith('x-vercel-')),
    });
}
