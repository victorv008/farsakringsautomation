/**
 * Facebook cover-bild, byggd ur sajtens egen hero — inte en ny design.
 *
 * Körs bara lokalt mot screenshots/. Ligger utanför livsforsakringar-mvp/,
 * som är Vercels root directory för hela projektet, så den här mappen kan
 * aldrig deployas oavsett vad som pushas eller mergas.
 *
 * Varför omkomponerad och inte bara en beskärning av startsidan:
 * Facebook visar covern i två olika proportioner — 820×312 på desktop,
 * 640×360 på mobil. Mobilversionen är smalare (bredden krymper till ~68%),
 * inte lägre. Startsidans hero har en skarp diagonal gräns mellan den stora
 * teala blobben och den ljusa ytan — en gräns som ligger fint på en bred,
 * låg yta men blir ett hårt vertikalt färgskifte när bredden krymps och
 * höjden behålls. Löst genom att göra hela ytan en sammanhängande
 * tealgradient (ingen hård kant att beskära illa) och flytta amber till
 * accenter — pricken i loggan, "prisförslag"-texten, ikonerna — i stället
 * för ett eget färgblock.
 *
 * Säker zon: 820×312 (2x = 1640×624) är desktop-dukens fulla yta. Mobilens
 * 640×360 har bredd/höjd-förhållande 1.78 mot desktops 2.63 — vid samma
 * duk-höjd (624px) visar mobilen bara den mittersta ~1109px av bredden.
 * Säker zon sätts till 1100×600, centrerad, med extra marginal nere till
 * vänster där Facebook lägger profilbilden ovanpå covern på både
 * desktop och mobil.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HAR = dirname(fileURLToPath(import.meta.url));
const ROT = join(HAR, '..', '..');
const UT = join(ROT, 'screenshots', 'facebook-cover');
mkdirSync(UT, { recursive: true });

const W = 1640, H = 624;           // 2x av Facebooks 820×312
const SAFE_W = 1100, SAFE_H = 600; // central zon som överlever mobilbeskärningen
const SKALA = 2;                   // skärmdumpar i 2x för skärpa

/* ── Sajtens egna färger och typsnitt, inget nytt ───────────────────────── */
const FARG = {
  teal: '#0D7377', tealLight: '#14a0a5',
  amber: '#E8A838', amberLight: '#f0c273',
  textMain: '#1A2024', textMuted: '#5C6B73',
  surface: '#FAFCFC',
  blobTealA: '#6ec6c0', blobTealB: '#8bd4ce',
};

function mallHTML({ cardScale, cardShiftX, cardShiftY, headlineSize, showBadges, showSubtext, extraRing, badgeCount, cardContent }) {
  return `<!doctype html>
<html lang="sv"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com" rel="preconnect">
<link crossorigin href="https://fonts.gstatic.com" rel="preconnect">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@300..600,0..1&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:${W}px;height:${H}px;overflow:hidden;}
  body{
    font-family:'Inter',sans-serif;
    position:relative;
    /* Sammanhängande teal-gradient i stället för startsidans skarpa
       diagonala blobbgräns — ingen kant som blir ett hårt band vid
       mobilens smalare beskärning. */
    background:
      radial-gradient(ellipse 1100px 700px at 78% 50%, rgba(255,255,255,0.94) 0%, rgba(250,252,252,0.0) 60%),
      linear-gradient(118deg, ${FARG.blobTealA} 0%, ${FARG.blobTealB} 42%, #bfe8e3 68%, ${FARG.surface} 100%);
  }
  .safezone{position:absolute;left:${(W-SAFE_W)/2}px;top:${(H-SAFE_H)/2}px;width:${SAFE_W}px;height:${SAFE_H}px;}
  .noplace{position:absolute;left:0;bottom:0;width:30%;height:34%;}

  /* Mjuka ringar, draget in mot mitten, inte vid kanterna */
  .ring{position:absolute;border-radius:50%;border-style:solid;}
  .r1{width:230px;height:230px;left:560px;top:60px;border-width:26px;border-color:rgba(255,255,255,0.38);}
  .r2{width:140px;height:140px;left:1040px;top:420px;border-width:18px;border-color:rgba(255,255,255,0.30);}
  .r3{width:110px;height:110px;left:260px;top:430px;border-width:14px;border-color:rgba(13,115,119,0.12);display:${extraRing ? 'block' : 'none'};}

  /* Amber bara som mjuk glöd bakom kortet — accent, inget eget block */
  .glow{position:absolute;width:620px;height:620px;left:980px;top:-60px;
    background:radial-gradient(circle, rgba(232,168,56,0.30) 0%, rgba(232,168,56,0) 70%);
    pointer-events:none;}

  .brand{position:absolute;left:0;top:0;display:flex;align-items:center;gap:12px;}
  .brand svg{width:40px;height:40px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.08));}
  .brand span{font-family:'Plus Jakarta Sans';font-weight:800;font-size:26px;color:${FARG.teal};letter-spacing:-0.01em;}

  .headline-wrap{position:absolute;left:0;top:calc(50% - 64px);transform:translateY(-50%);max-width:560px;}
  .eyebrow{display:inline-flex;align-items:center;gap:8px;padding:6px 16px;margin-bottom:18px;
    background:rgba(255,255,255,0.55);border:1px solid rgba(13,115,119,0.18);border-radius:999px;
    font-family:'Plus Jakarta Sans';font-weight:700;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:${FARG.teal};}
  .eyebrow .dot{width:7px;height:7px;border-radius:50%;background:${FARG.teal};}
  h1{font-family:'Plus Jakarta Sans';font-weight:800;color:${FARG.teal};font-size:${headlineSize}px;line-height:1.08;letter-spacing:-0.01em;margin-bottom:16px;}
  h1 .accent{background:linear-gradient(90deg, ${FARG.teal}, ${FARG.amber});-webkit-background-clip:text;background-clip:text;color:transparent;}
  .sub{font-size:19px;font-weight:400;color:${FARG.textMuted};line-height:1.5;max-width:480px;display:${showSubtext ? 'block' : 'none'};}
  .badges{display:${showBadges ? 'flex' : 'none'};gap:22px;margin-top:26px;}
  .badge{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:${FARG.textMuted};}
  .badge .material-symbols-outlined{font-size:18px;color:${FARG.teal};font-variation-settings:'FILL' 1,'wght' 500;}

  /* UI-kortet: mindre och mer centrerat än på startsidan, så det inte
     tar över kompositionen på mobil */
  .card-wrap{position:absolute;right:${cardShiftX}px;top:50%;
    transform:translateY(calc(-50% + ${cardShiftY}px)) scale(${cardScale});
    transform-origin:right center;width:430px;}
  .card{background:#ffffff;border-radius:28px;box-shadow:0 30px 60px -20px rgba(13,115,119,0.28);
    border:1px solid rgba(13,115,119,0.06);padding:30px 34px;position:relative;overflow:hidden;}
  .card .barTop{position:absolute;left:0;top:0;width:100%;height:6px;background:rgba(13,115,119,0.1);}
  .card .barTop i{display:block;width:52%;height:100%;background:linear-gradient(90deg,${FARG.teal},${FARG.tealLight});border-radius:0 6px 6px 0;}
  .field-label{display:flex;align-items:center;gap:7px;font-family:'Plus Jakarta Sans';font-weight:700;font-size:12px;
    letter-spacing:0.05em;text-transform:uppercase;color:${FARG.textMain};margin-bottom:10px;}
  .field-label .material-symbols-outlined{font-size:17px;color:${FARG.amber};}
  .age-box{background:${FARG.surface};border:1px solid rgba(13,115,119,0.12);border-radius:16px;padding:16px 20px;
    font-family:'Plus Jakarta Sans';font-weight:600;font-size:22px;color:${FARG.textMain};margin-bottom:22px;}
  .age-box span{color:rgba(26,32,36,0.35);}
  .amount-row{display:flex;align-items:baseline;gap:8px;margin-bottom:12px;}
  .amount-row b{font-family:'Plus Jakarta Sans';font-weight:800;font-size:34px;color:${FARG.teal};letter-spacing:-0.01em;}
  .amount-row span{font-size:15px;color:${FARG.textMuted};}
  .track{width:100%;height:8px;background:rgba(13,115,119,0.1);border-radius:999px;margin-bottom:24px;position:relative;}
  .track i{position:absolute;left:0;top:0;height:100%;width:44%;background:${FARG.teal};border-radius:999px;}
  .track .thumb{position:absolute;left:44%;top:50%;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;
    background:${FARG.amber};border:3px solid #fff;box-shadow:0 2px 8px rgba(232,168,56,0.5);}
  .cta{width:100%;background:${FARG.teal};color:#fff;border-radius:16px;padding:17px;text-align:center;
    font-family:'Plus Jakarta Sans';font-weight:700;font-size:17px;display:flex;align-items:center;justify-content:center;gap:8px;
    box-shadow:0 10px 24px -6px rgba(13,115,119,0.45);}
  .cta .material-symbols-outlined{font-size:20px;}
  .card-mini .amount-row,.card-mini .track{display:none;}

  .guide{display:none;}
</style></head>
<body>
  <div class="glow"></div>
  <div class="ring r1"></div><div class="ring r2"></div><div class="ring r3"></div>

  <div class="safezone">
    <div class="brand">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <path d="M16,92 L16,16.4 A8.4,8.4 0 0 1 32.8,16.4 L32.8,92 Z" fill="#0D7377"/>
        <rect x="16" y="72.8" width="66.3" height="19.2" rx="9.6" fill="#0D7377"/>
        <path d="M34.21,50.66 A25.25,25.25 0 0 1 79.28,42.72 L71.50,48.17 A15.75,15.75 0 0 0 43.39,53.12 Z" fill="#14A0A5"/>
        <circle cx="57.9" cy="58.7" r="11.8" fill="#E8A838"/>
      </svg>
      <span>Livförsäkringar.se</span>
    </div>

    <div class="headline-wrap">
      <div class="eyebrow"><span class="dot"></span>Steg 1 av 2</div>
      <h1>Börja här för ditt<br><span class="accent">prisförslag</span></h1>
      <p class="sub">Jämför livförsäkringar från svenska bolag på minuten.</p>
      <div class="badges">
        ${['verified Oberoende priser','bolt Ingen rådgivning','open_in_new Kontakta bolaget direkt'].slice(0, badgeCount).map(b => {
          const [icon, ...rest] = b.split(' ');
          return `<div class="badge"><span class="material-symbols-outlined">${icon}</span>${rest.join(' ')}</div>`;
        }).join('')}
      </div>
    </div>

    <div class="card-wrap">
      <div class="card ${cardContent === 'mini' ? 'card-mini' : ''}">
        <div class="barTop"><i></i></div>
        <div class="field-label"><span class="material-symbols-outlined">cake</span>Din ålder</div>
        <div class="age-box">35 <span>år</span></div>
        ${cardContent !== 'mini' ? `
        <div class="field-label"><span class="material-symbols-outlined">account_balance_wallet</span>Önskat belopp</div>
        <div class="amount-row"><b>1 000 000</b><span>kr</span></div>
        <div class="track"><i></i><div class="thumb"></div></div>
        ` : ''}
        <div class="cta">Fortsätt<span class="material-symbols-outlined">arrow_forward</span></div>
      </div>
    </div>
  </div>
  <div class="guide"></div>
</body></html>`;
}

/* ── Sex varianter: samma design, små skillnader i beskärning/placering ── */
const VARIANTER = [
  { namn: 'balanserad',       cardScale: 1.00, cardShiftX: 20,  cardShiftY: 0,   headlineSize: 58, showBadges: true,  showSubtext: true,  extraRing: false, badgeCount: 2, cardContent: 'full' },
  { namn: 'kort-centrerat',   cardScale: 0.92, cardShiftX: 40,  cardShiftY: 0,   headlineSize: 56, showBadges: true,  showSubtext: true,  extraRing: false, badgeCount: 2, cardContent: 'full' },
  { namn: 'rubrik-stor',      cardScale: 0.80, cardShiftX: 60,  cardShiftY: 10,  headlineSize: 68, showBadges: false, showSubtext: false, extraRing: false, badgeCount: 0, cardContent: 'mini' },
  { namn: 'logga-fokus',      cardScale: 0.88, cardShiftX: 50,  cardShiftY: 30,  headlineSize: 52, showBadges: true,  showSubtext: false, extraRing: true,  badgeCount: 1, cardContent: 'mini' },
  { namn: 'tatt-centrerad',   cardScale: 0.95, cardShiftX: 35,  cardShiftY: -10, headlineSize: 54, showBadges: true,  showSubtext: true,  extraRing: false, badgeCount: 3, cardContent: 'full' },
  { namn: 'dekorativ-mjuk',   cardScale: 1.00, cardShiftX: 25,  cardShiftY: -20, headlineSize: 58, showBadges: true,  showSubtext: true,  extraRing: true,  badgeCount: 2, cardContent: 'full' },
];

const b = await chromium.launch();

async function renderaHTML(html, pxW, pxH) {
  const p = await b.newPage({ viewport: { width: pxW, height: pxH }, deviceScaleFactor: SKALA });
  await p.setContent(html, { waitUntil: 'networkidle' });
  await p.waitForTimeout(150); // typsnitt hinner ladda
  return p;
}

let i = 0;
for (const v of VARIANTER) {
  i++;
  const nr = String(i).padStart(2, '0');
  const html = mallHTML(v);

  // 1. Huvudbilden — fullt 820×312-dukformat i 2x
  const p = await renderaHTML(html, W, H);
  await p.screenshot({ path: join(UT, `facebook-cover-${nr}.png`) });

  // 2. Desktopförhandsvisning — i en enkel FB-sidhuvud-mockup
  const descktopHTML = `<!doctype html><html><head><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{width:${W}px;background:#f0f2f5;font-family:'Inter',sans-serif;}
    .frame{background:#fff;}
    .cover{width:100%;height:${H}px;background-image:url('data:image/png;base64,__B64__');background-size:cover;}
    .meta{display:flex;align-items:flex-end;gap:28px;padding:0 48px 28px;margin-top:-70px;position:relative;}
    .avatar{width:200px;height:200px;border-radius:50%;background:#fff;border:8px solid #fff;box-shadow:0 2px 10px rgba(0,0,0,0.15);
      display:flex;align-items:center;justify-content:center;}
    .avatar svg{width:110px;height:110px;}
    .name{font-family:'Plus Jakarta Sans';font-weight:800;font-size:40px;color:#1A2024;padding-bottom:28px;}
  </style></head><body><div class="frame"><div class="cover"></div>
    <div class="meta"><div class="avatar"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M16,92 L16,16.4 A8.4,8.4 0 0 1 32.8,16.4 L32.8,92 Z" fill="#0D7377"/>
      <rect x="16" y="72.8" width="66.3" height="19.2" rx="9.6" fill="#0D7377"/>
      <path d="M34.21,50.66 A25.25,25.25 0 0 1 79.28,42.72 L71.50,48.17 A15.75,15.75 0 0 0 43.39,53.12 Z" fill="#14A0A5"/>
      <circle cx="57.9" cy="58.7" r="11.8" fill="#E8A838"/></svg></div>
      <div class="name">Livförsäkringar.se</div></div>
  </div></body></html>`;
  const b64 = (await p.screenshot()).toString('base64');
  await p.close();
  const pd = await renderaHTML(descktopHTML.replace('__B64__', b64), W, H + 220);
  await pd.screenshot({ path: join(UT, `facebook-cover-${nr}-desktop-preview.png`) });
  await pd.close();

  // 3. Mobilförhandsvisning — centrumbeskuren till mobilens 640×360-proportion
  //    (bredd krymper till ~68%, höjden behålls), i en enkel telefon-mockup
  const mobCropW = Math.round(H * (640 / 360)); // bredd vid oförändrad höjd
  const p2 = await renderaHTML(html, W, H);
  const full = await p2.screenshot();
  await p2.close();
  const mobileHTML = `<!doctype html><html><head><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{width:720px;background:#e4e6eb;font-family:'Inter',sans-serif;display:flex;justify-content:center;padding-top:30px;}
    .phone{width:660px;background:#fff;border-radius:28px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.12);}
    .cropwin{width:660px;height:${Math.round(660 / (mobCropW / H))}px;overflow:hidden;position:relative;}
    .cropwin img{position:absolute;left:50%;top:0;height:100%;transform:translateX(-50%);}
    .meta{display:flex;align-items:center;gap:16px;padding:16px 20px 22px;margin-top:-46px;position:relative;}
    .avatar{width:92px;height:92px;border-radius:50%;background:#fff;border:5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.15);
      display:flex;align-items:center;justify-content:center;}
    .avatar svg{width:50px;height:50px;}
    .name{font-family:'Plus Jakarta Sans';font-weight:800;font-size:21px;color:#1A2024;}
  </style></head><body><div class="phone">
    <div class="cropwin"><img src="data:image/png;base64,__B64__"></div>
    <div class="meta"><div class="avatar"><svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M16,92 L16,16.4 A8.4,8.4 0 0 1 32.8,16.4 L32.8,92 Z" fill="#0D7377"/>
      <rect x="16" y="72.8" width="66.3" height="19.2" rx="9.6" fill="#0D7377"/>
      <path d="M34.21,50.66 A25.25,25.25 0 0 1 79.28,42.72 L71.50,48.17 A15.75,15.75 0 0 0 43.39,53.12 Z" fill="#14A0A5"/>
      <circle cx="57.9" cy="58.7" r="11.8" fill="#E8A838"/></svg></div>
      <div class="name">Livförsäkringar.se</div></div>
  </div></body></html>`;
  const pm = await renderaHTML(mobileHTML.replace('__B64__', full.toString('base64')), 720, 760);
  await pm.screenshot({ path: join(UT, `facebook-cover-${nr}-mobile-preview.png`) });
  await pm.close();

  console.log(`  ✔ variant ${nr} (${v.namn})`);
}

/* ── Säker-zon-guide, en gång, mot första varianten ──────────────────────── */
const guideHTML = mallHTML(VARIANTER[0]).replace(
  '<div class="guide">',
  `<div class="guide" style="display:block">
     <div style="position:absolute;left:${(W - SAFE_W) / 2}px;top:${(H - SAFE_H) / 2}px;width:${SAFE_W}px;height:${SAFE_H}px;
       border:3px dashed rgba(255,255,255,0.95);box-shadow:0 0 0 3px rgba(0,0,0,0.35);border-radius:4px;"></div>
     <div style="position:absolute;left:0;bottom:0;width:30%;height:34%;background:repeating-linear-gradient(45deg,rgba(220,50,50,0.35) 0 10px,rgba(220,50,50,0.15) 10px 20px);
       border-top:3px dashed rgba(220,50,50,0.9);border-right:3px dashed rgba(220,50,50,0.9);"></div>
     <div style="position:absolute;left:16px;bottom:calc(34% + 10px);font-family:'Plus Jakarta Sans';font-weight:700;font-size:13px;color:#b91c1c;
       background:rgba(255,255,255,0.9);padding:4px 10px;border-radius:6px;">Undvik — profilbildszon</div>
     <div style="position:absolute;left:${(W - SAFE_W) / 2}px;top:${(H - SAFE_H) / 2 - 34}px;font-family:'Plus Jakarta Sans';font-weight:700;font-size:13px;color:#1A2024;
       background:rgba(255,255,255,0.9);padding:4px 10px;border-radius:6px;">Säker zon — syns på både mobil och desktop</div>
   </div>`
);
const pg = await renderaHTML(guideHTML, W, H);
await pg.screenshot({ path: join(UT, 'safe-zone-guide.png') });
await pg.close();
console.log('  ✔ safe-zone-guide.png');

await b.close();
console.log('\nKlart — se screenshots/facebook-cover/');
