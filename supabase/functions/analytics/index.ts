/**
 * Edge Function: analytics
 *
 * Dashboarden läser statistik härifrån. Lösenordet kontrolleras på
 * serversidan mot miljövariabeln DASHBOARD_PASSWORD och finns aldrig i
 * klientkoden. Funktionen använder service role-nyckeln, som kringgår RLS —
 * det är därför den publika nyckeln kan sakna läsrättigheter helt.
 *
 * Sätt lösenordet i Supabase → Edge Functions → Secrets:
 *   DASHBOARD_PASSWORD=<valfritt lösenord>
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RAD_TAK = 50000;

/** Jämförelse som tar lika lång tid oavsett var strängarna skiljer sig. */
function likaSakert(a: string, b: string): boolean {
  const ba = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ba.length !== bb.length) {
    // Kör ändå igenom en jämförelse så längden inte läcker via svarstid
    let d = 1;
    for (let i = 0; i < Math.max(ba.length, bb.length); i++) d |= 1;
    return false;
  }
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

function svar(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/* ── Hjälpare för sammanställning ─────────────────────────────────────── */

function rakna<T extends string>(varden: T[]): Record<string, number> {
  const ut: Record<string, number> = {};
  for (const v of varden) ut[v] = (ut[v] ?? 0) + 1;
  return ut;
}

function topplista(karta: Record<string, number>, max = 20) {
  return Object.entries(karta)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([namn, antal]) => ({ namn, antal }));
}

const ALDERSGRUPPER = [
  { namn: "18–29", min: 0, max: 29 },
  { namn: "30–39", min: 30, max: 39 },
  { namn: "40–49", min: 40, max: 49 },
  { namn: "50–59", min: 50, max: 59 },
  { namn: "60+", min: 60, max: 200 },
];

const BELOPPSGRUPPER = [
  { namn: "< 1 Mkr", min: 0, max: 999999 },
  { namn: "1–2 Mkr", min: 1000000, max: 1999999 },
  { namn: "2–3 Mkr", min: 2000000, max: 2999999 },
  { namn: "3–5 Mkr", min: 3000000, max: 4999999 },
  { namn: "5 Mkr+", min: 5000000, max: 1e12 },
];

function gruppera(varden: number[], grupper: { namn: string; min: number; max: number }[]) {
  return grupper.map((g) => ({
    namn: g.namn,
    antal: varden.filter((v) => v >= g.min && v <= g.max).length,
  }));
}

/* ── Plats ─────────────────────────────────────────────────────────────────
   Mobil och dator hålls isär, alltid. Skillnaden mellan de två
   fördelningarna ÄR måttet på hur opålitligt IP-uppslaget är: svenska
   operatörer dirigerar mobiltrafik genom ett fåtal noder, mest i
   Stockholmsregionen, så en mobilfördelning som lutar kraftigt mot
   Stockholm medan datorfördelningen inte gör det är bevis på nätnoder, inte
   på var besökarna bor. Slås de ihop försvinner just den signalen.

   Osäkerheten mäts alltså, den påstås inte. En hårdkodad etikett
   "mobil är opålitlig" hade sagt samma sak varje dag oavsett verkligheten
   och därför ignorerats inom en vecka. */

type PlatsRad = {
  enhet: string;
  lan: string;
  stad: string | null;
  besok: number;
  varierade: number;
};

// Under så här många besök på en ort redovisas den som "Övrigt".
const K_TROSKEL = 5;

function platsEtikett(r: PlatsRad): string {
  if (r.lan === "saknas") return "(hann inte hämtas)";
  if (r.lan === "utland") return "Utanför Sverige";
  if (r.stad) return r.stad;
  return "(ort okänd)";
}

// Etiketter som inte pekar ut någon och därför inte omfattas av k-tröskeln.
const EJ_IDENTIFIERANDE = new Set(["(hann inte hämtas)", "Utanför Sverige", "(ort okänd)"]);

function anonymisera(karta: Record<string, number>) {
  const ut: Record<string, number> = {};
  let smatt = 0;
  for (const [namn, n] of Object.entries(karta)) {
    if (EJ_IDENTIFIERANDE.has(namn)) { ut[namn] = n; continue; }
    if (n < K_TROSKEL) smatt += n; else ut[namn] = n;
  }
  if (smatt) ut["Övrigt"] = (ut["Övrigt"] ?? 0) + smatt;
  return ut;
}

function platsBlock(rader: PlatsRad[]) {
  const per: Record<string, Record<string, number>> = { mobil: {}, desktop: {}, okand: {} };
  let totalt = 0, saknas = 0, varierade = 0;

  for (const r of rader) {
    const e = per[r.enhet] ? r.enhet : "okand";
    const etikett = platsEtikett(r);
    per[e][etikett] = (per[e][etikett] ?? 0) + Number(r.besok);
    totalt += Number(r.besok);
    varierade += Number(r.varierade);
    if (r.lan === "saknas") saknas += Number(r.besok);
  }

  // k-tröskeln läggs EFTER uppdelningen, inte före. Uppdelningen halverar
  // varje cell, så den är i sig en integritetskostnad som måste räknas på.
  const m = anonymisera(per.mobil);
  const d = anonymisera(per.desktop);
  const summa = (k: Record<string, number>) => Object.values(k).reduce((a, b) => a + b, 0);
  const nM = summa(m), nD = summa(d);

  // Total variation distance mellan fördelningarna, 0–100. Låg = mobil och
  // dator ser likadana ut, alltså troligen verkliga besökare. Hög = mobilen
  // är förskjuten, alltså troligen nätnoder.
  let divergens: number | null = null;
  if (nM >= 50 && nD >= 50) {
    const alla = new Set([...Object.keys(m), ...Object.keys(d)]);
    let s = 0;
    for (const k of alla) s += Math.abs((m[k] ?? 0) / nM - (d[k] ?? 0) / nD);
    divergens = Math.round(s * 50);
  }

  return {
    dator: { besok: nD, topplista: topplista(d, 14) },
    mobil: { besok: nM, topplista: topplista(m, 14) },
    besok_totalt: totalt,
    saknas_procent: totalt ? Math.round((saknas / totalt) * 1000) / 10 : 0,
    varierade_procent: totalt ? Math.round((varierade / totalt) * 1000) / 10 : 0,
    divergens_procent: divergens,
    for_lite_data: nM < 50 || nD < 50,
    k_troskel: K_TROSKEL,
  };
}

/* ── Huvudhanterare ───────────────────────────────────────────────────── */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return svar({ fel: "Endast POST" }, 405);

  const forvantat = Deno.env.get("DASHBOARD_PASSWORD");
  if (!forvantat) {
    return svar(
      { fel: "DASHBOARD_PASSWORD är inte satt i Edge Function-secrets." },
      503,
    );
  }

  let kropp: {
    losenord?: string;
    dagar?: number;
    visaTest?: boolean;
    handling?: string;   // undefined = KPI-vyn, som tidigare
    sok_id?: string;
    urval?: string;
  };
  try {
    kropp = await req.json();
  } catch {
    return svar({ fel: "Ogiltig förfrågan" }, 400);
  }

  if (typeof kropp.losenord !== "string" || !likaSakert(kropp.losenord, forvantat)) {
    // Liten fördröjning så gissningar inte går att köra snabbt
    await new Promise((r) => setTimeout(r, 400));
    return svar({ fel: "Fel lösenord" }, 401);
  }

  const dagar = [7, 30, 90, 365].includes(Number(kropp.dagar)) ? Number(kropp.dagar) : 30;
  const fran = new Date(Date.now() - dagar * 86400000).toISOString();

  // Testrader döljs som standard. Dashboarden kan be om dem uttryckligen.
  const visaTest = kropp.visaTest === true;

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  /* ── Resvy: lista besök ────────────────────────────────────────────────
     Aggregeringen ligger i vyn resor_sammanfattning, inte här, så RAD_TAK
     aldrig kan kapa den. */
  if (kropp.handling === "resor") {
    let q = db.from("resor_sammanfattning").select("*").gte("start", fran);
    if (!visaTest) q = q.eq("ar_test", false);

    switch (kropp.urval) {
      case "utan_klick":   q = q.eq("nadde_resultat", true).eq("utklick", 0); break;
      case "nollresultat": q = q.eq("sag_nollresultat", true); break;
      case "med_klick":    q = q.gt("utklick", 0); break;
      case "mest_filter":  q = q.gt("filterandringar", 0); break;
    }

    const ordning = kropp.urval === "mest_filter"
      ? { kolumn: "filterandringar", stigande: false }
      : { kolumn: "start", stigande: false };

    const res = await q.order(ordning.kolumn, { ascending: ordning.stigande }).limit(50);
    if (res.error) return svar({ fel: "Kunde inte hämta resor", detalj: res.error.message }, 500);

    return svar({
      urval: kropp.urval ?? "senaste",
      period: { dagar, fran, visar_testdata: visaTest },
      resor: (res.data ?? []).map((r) => ({
        ...r,
        slutsteg: !r.nadde_resultat ? "avhopp_innan_resultat"
                : r.utklick > 0 ? "klickade_vidare"
                : r.sag_nollresultat ? "nollresultat"
                : "avhopp_pa_resultat",
      })),
    });
  }

  /* ── Resvy: en enskild resa ───────────────────────────────────────────
     CHECK-constrainten begränsar sekvens till 1000, så en resa kan aldrig
     bli större än så. */
  if (kropp.handling === "resa") {
    if (typeof kropp.sok_id !== "string" || !/^[0-9a-f-]{36}$/i.test(kropp.sok_id)) {
      return svar({ fel: "Ogiltigt sok_id" }, 400);
    }
    const res = await db.from("handelser")
      .select("sekvens, typ, sida, ms_sedan_start, enhet, alder, belopp, antal_traffar, data, skapad_at, ar_test")
      .eq("sok_id", kropp.sok_id)
      .order("sekvens", { ascending: true })
      .limit(1001);
    if (res.error) return svar({ fel: "Kunde inte hämta resan", detalj: res.error.message }, 500);
    return svar({ sok_id: kropp.sok_id, handelser: res.data ?? [] });
  }

  const SOK_FALT = "sok_id, alder, belopp, filter_valda, antal_traffar, enhet, skapad_at, ar_test";
  const KLICK_FALT = "sok_id, bolag, pris_visat, klick_position, sortering, skapad_at, ar_test";

  let sokQ = db.from("sokningar").select(SOK_FALT).gte("skapad_at", fran);
  let klickQ = db.from("bolagsklick").select(KLICK_FALT).gte("skapad_at", fran);
  if (!visaTest) {
    sokQ = sokQ.eq("ar_test", false);
    klickQ = klickQ.eq("ar_test", false);
  }

  const [sokRes, klickRes, platsRes] = await Promise.all([
    sokQ.order("skapad_at", { ascending: false }).limit(RAD_TAK),
    klickQ.order("skapad_at", { ascending: false }).limit(RAD_TAK),
    // Aggregeras i SQL, inte här: funktionen trycker ned datumfiltret till
    // det indexerade skapad_at före grupperingen, och RAD_TAK kan inte kapa
    // resultatet på vägen.
    db.rpc("plats_oversikt", { fran, visa_test: visaTest }),
  ]);

  if (sokRes.error || klickRes.error) {
    return svar({ fel: "Kunde inte hämta data", detalj: sokRes.error?.message ?? klickRes.error?.message }, 500);
  }

  const sokningar = sokRes.data ?? [];
  const klick = klickRes.data ?? [];

  /* Trafikflöde — räknas på unika sok_id, inte på antal rader, eftersom
     varje filterändring skapar en ny rad för samma besök. */
  const unikaSok = new Set(sokningar.map((s) => s.sok_id));
  const unikaKlickSok = new Set(klick.map((k) => k.sok_id));
  const konvertering = unikaSok.size > 0
    ? Math.round((unikaKlickSok.size / unikaSok.size) * 1000) / 10
    : 0;

  /* Filter — både enskilda och kombinationer */
  const enskildaFilter: string[] = [];
  const kombinationer: string[] = [];
  for (const s of sokningar) {
    const f = (s.filter_valda ?? []) as string[];
    for (const x of f) enskildaFilter.push(x);
    kombinationer.push(f.length ? [...f].sort().join(" + ") : "(inga filter)");
  }

  /* Nollresultat — vilka kombinationer gav noll träffar */
  const noll = sokningar.filter((s) => s.antal_traffar === 0);
  const nollKombos = noll.map((s) => {
    const f = (s.filter_valda ?? []) as string[];
    return f.length ? [...f].sort().join(" + ") : "(inga filter)";
  });

  /* Tidsserie per dag */
  const perDag: Record<string, { sokningar: number; klick: number }> = {};
  for (const s of sokningar) {
    const d = String(s.skapad_at).slice(0, 10);
    (perDag[d] ??= { sokningar: 0, klick: 0 }).sokningar++;
  }
  for (const k of klick) {
    const d = String(k.skapad_at).slice(0, 10);
    (perDag[d] ??= { sokningar: 0, klick: 0 }).klick++;
  }
  const tidsserie = Object.entries(perDag)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([datum, v]) => ({ datum, ...v }));

  // limit() kapar de äldsta raderna. Utan den här flaggan blir ett
  // 90-dagarsdiagram tyst ett 20-dagarsdiagram när taket nås.
  const trunkerad = sokningar.length >= RAD_TAK || klick.length >= RAD_TAK;

  return svar({
    period: { dagar, fran, visar_testdata: visaTest },
    trunkerad,
    testrader: {
      sokningar: sokningar.filter((s) => s.ar_test === true).length,
      klick: klick.filter((k) => k.ar_test === true).length,
    },
    flode: {
      sokningar_rader: sokningar.length,
      unika_besok: unikaSok.size,
      klick: klick.length,
      besok_med_klick: unikaKlickSok.size,
      konvertering_procent: konvertering,
    },
    bolag: topplista(rakna(klick.map((k) => k.bolag as string))),
    filter_enskilda: topplista(rakna(enskildaFilter)),
    filter_kombinationer: topplista(rakna(kombinationer), 12),
    nollresultat: {
      antal: noll.length,
      andel_procent: sokningar.length ? Math.round((noll.length / sokningar.length) * 1000) / 10 : 0,
      kombinationer: topplista(rakna(nollKombos), 10),
    },
    alder: gruppera(
      sokningar.map((s) => s.alder).filter((v): v is number => typeof v === "number"),
      ALDERSGRUPPER,
    ),
    belopp: gruppera(
      sokningar.map((s) => s.belopp).filter((v): v is number => typeof v === "number"),
      BELOPPSGRUPPER,
    ),
    enhet: topplista(rakna(sokningar.map((s) => (s.enhet ?? "okänd") as string))),
    // Platsblocket får aldrig fälla hela dashboarden. Går RPC:n fel visas
    // kortet som tomt, resten fungerar.
    plats: platsRes.error ? null : platsBlock((platsRes.data ?? []) as PlatsRad[]),
    plats_fel: platsRes.error ? platsRes.error.message : null,
    sortering: topplista(rakna(klick.map((k) => (k.sortering ?? "okänd") as string))),
    position: topplista(rakna(klick.map((k) => String(k.klick_position ?? "?"))), 10),
    tidsserie,
  });
});
