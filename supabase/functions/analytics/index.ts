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

  let kropp: { losenord?: string; dagar?: number; visaTest?: boolean };
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

  const [sokRes, klickRes] = await Promise.all([
    (visaTest
      ? db.from("sokningar").select("sok_id, alder, belopp, filter_valda, antal_traffar, enhet, skapad_at, ar_test")
      : db.from("sokningar").select("sok_id, alder, belopp, filter_valda, antal_traffar, enhet, skapad_at, ar_test").eq("ar_test", false)
    ).gte("skapad_at", fran).order("skapad_at", { ascending: false }).limit(RAD_TAK),
    (visaTest
      ? db.from("bolagsklick").select("sok_id, bolag, pris_visat, klick_position, sortering, skapad_at, ar_test")
      : db.from("bolagsklick").select("sok_id, bolag, pris_visat, klick_position, sortering, skapad_at, ar_test").eq("ar_test", false)
    ).gte("skapad_at", fran).order("skapad_at", { ascending: false }).limit(RAD_TAK),
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

  return svar({
    period: { dagar, fran, visar_testdata: visaTest },
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
    sortering: topplista(rakna(klick.map((k) => (k.sortering ?? "okänd") as string))),
    position: topplista(rakna(klick.map((k) => String(k.klick_position ?? "?"))), 10),
    tidsserie,
  });
});
