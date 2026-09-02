-- Händelselogg — hela resan inom ett besök.
--
-- Kopplas ihop med samma sok_id som sokningar och bolagsklick, alltså det som
-- ligger i sessionStorage och dör när fliken stängs. Ingen IP, inga cookies,
-- ingenting som överlever besöket eller kopplar ihop två besök.
--
-- Designregel: anon får skriva. Därför får allt som räknas aritmetiskt en
-- typad kolumn med CHECK, och allt övrigt ligger i data (jsonb). En enda
-- skräprad med data->>'alder' = 'abc' skulle annars fälla ::int-casten och
-- därmed hela dashboardfrågan — för alla, inte bara den raden.

create table if not exists public.handelser (
  id             uuid        primary key default gen_random_uuid(),
  sok_id         uuid        not null,
  sekvens        integer     not null,   -- löpnummer inom besöket
  typ            text        not null,
  sida           text,
  ms_sedan_start integer,                -- relativ tid, aldrig absolut klocka
  enhet          text,

  -- Hoistade ur payloaden eftersom de aggregeras numeriskt
  alder          smallint,
  belopp         bigint,
  antal_traffar  smallint,

  data           jsonb       not null default '{}',
  skapad_at      timestamptz not null default now(),
  ar_test        boolean     not null default false,

  constraint handelser_typ_giltig check (typ in (
    'sidvisning',
    'sidan_dold',
    'steg1_klart',
    'livssituation_val',
    'livssituation_klart',
    'resultat_visat',
    'filter_andrat',
    'filter_rensat',
    'sortering_andrad',
    'bolagsval_andrat',
    'utklick',
    'uppgifter_andrade',
    'fel'
  )),
  constraint handelser_sida_giltig check (sida is null or sida in (
    'start','livssituation','resultat','faq','om-oss',
    'sa-fungerar-det','integritet','villkor','okand'
  )),
  constraint handelser_enhet_giltig     check (enhet is null or enhet in ('mobil','desktop')),
  constraint handelser_sekvens_rimlig   check (sekvens between 0 and 1000),
  constraint handelser_ms_rimlig        check (ms_sedan_start is null
                                               or ms_sedan_start between 0 and 86400000),
  constraint handelser_alder_rimlig     check (alder is null or alder between 0 and 120),
  constraint handelser_belopp_rimligt   check (belopp is null or belopp between 0 and 100000000),
  constraint handelser_traffar_rimligt  check (antal_traffar is null
                                               or antal_traffar between 0 and 1000),
  constraint handelser_data_objekt      check (jsonb_typeof(data) = 'object'),
  constraint handelser_data_litet       check (octet_length(data::text) <= 2000)
);

comment on table public.handelser is
  'En rad per händelse inom ett besök. Kopplas via sok_id, som lever i sessionStorage och dör med fliken.';
comment on column public.handelser.sekvens is
  'Klientens löpnummer inom besöket. Medvetet INTE unikt — se migrationens kommentar.';

-- Medvetet inget unikt index på (sok_id, sekvens). Chrome och Firefox kopierar
-- sessionStorage vid "duplicera flik", så två flikar kan få samma sok_id och
-- samma räknare. Med ett unikt index skulle hela batchen avvisas — PostgREST
-- kör en INSERT-sats — och ge tyst dataförlust. Duplicerade rader är synliga
-- och ofarliga; tappade batchar är osynliga.
create index if not exists handelser_resa_idx    on public.handelser (sok_id, sekvens);
create index if not exists handelser_ar_test_idx on public.handelser (ar_test, skapad_at desc);
create index if not exists handelser_typ_idx     on public.handelser (typ, skapad_at desc);

-- ── RLS: samma mönster som sokningar/bolagsklick ─────────────────────────
alter table public.handelser enable row level security;

drop policy if exists "anon far skriva handelser" on public.handelser;
create policy "anon far skriva handelser"
  on public.handelser for insert to anon
  with check (ar_test = false or public.ar_giltig_testrequest());

revoke select, update, delete on public.handelser from anon, authenticated;
grant  insert                 on public.handelser to anon;

-- ── Sammanfattning per resa, för dashboardens resvy ──────────────────────
-- Aggregeringen ligger i SQL, inte i Edge Function, så RAD_TAK aldrig kan
-- kapa den. Att alder/belopp/antal_traffar är typade kolumner är precis det
-- som gör vyn robust mot en enskild skräprad.
create or replace view public.resor_sammanfattning as
select
  h.sok_id,
  h.ar_test,
  min(h.skapad_at)                                              as start,
  max(h.skapad_at)                                              as slut,
  extract(epoch from max(h.skapad_at) - min(h.skapad_at))::int   as langd_sek,
  count(*)                                                      as antal_handelser,
  max(h.enhet)                                                  as enhet,
  max(h.alder)         filter (where h.typ = 'steg1_klart')     as alder,
  max(h.belopp)        filter (where h.typ = 'steg1_klart')     as belopp,
  max(h.antal_traffar) filter (where h.typ = 'resultat_visat')  as antal_traffar,
  count(*) filter (where h.typ = 'utklick')                     as utklick,
  count(*) filter (where h.typ = 'filter_andrat')               as filterandringar,
  bool_or(h.typ = 'resultat_visat')                             as nadde_resultat,
  bool_or(h.typ = 'resultat_visat' and h.antal_traffar = 0)     as sag_nollresultat,
  max(h.data ->> 'bolag') filter (where h.typ = 'utklick')      as klickat_bolag
from public.handelser h
group by h.sok_id, h.ar_test;

revoke all on public.resor_sammanfattning from anon, authenticated;

comment on view public.resor_sammanfattning is
  'En rad per besök. Avhopp härleds ur formen: nadde_resultat = true och utklick = 0 betyder avhopp på resultatsidan.';

-- ── Städning ─────────────────────────────────────────────────────────────
-- handelser växer betydligt snabbare än sokningar. Beteendedata utan
-- bestående identifierare har litet värde efter ett halvår.
--
-- OBS: integritetspolicyn får inte lova en lagringstid förrän det här
-- jobbet faktiskt är schemalagt. Kräver att pg_cron är aktiverat i projektet.
--
-- select cron.schedule('stada-handelser', '0 4 * * *',
--   $$delete from public.handelser where skapad_at < now() - interval '180 days'$$);
