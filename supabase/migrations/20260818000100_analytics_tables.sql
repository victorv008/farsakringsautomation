-- Anonym analytics för Livförsäkringar.se
-- Två tabeller: en rad per sökning, en rad per klick vidare till ett bolag.
-- Kopplas ihop med sok_id (slumpmässigt, lever i sessionStorage, försvinner när fliken stängs).
--
-- Ingen IP, inga cookies, ingen persistent identifierare.

create extension if not exists pgcrypto;

-- ── Sökningar ────────────────────────────────────────────────────────────────
create table if not exists public.sokningar (
  id             uuid        primary key default gen_random_uuid(),
  sok_id         uuid        not null,
  alder          smallint,
  belopp         bigint,
  filter_valda   text[]      not null default '{}',
  antal_traffar  smallint,
  enhet          text,
  skapad_at      timestamptz not null default now(),

  -- anon får skriva, så gränserna hindrar skräpdata
  constraint sokningar_alder_rimlig       check (alder is null or (alder between 0 and 120)),
  constraint sokningar_belopp_rimligt     check (belopp is null or (belopp between 0 and 100000000)),
  constraint sokningar_traffar_rimligt    check (antal_traffar is null or (antal_traffar between 0 and 1000)),
  constraint sokningar_enhet_giltig       check (enhet is null or enhet in ('mobil','desktop')),
  constraint sokningar_filter_rimligt     check (array_length(filter_valda, 1) is null or array_length(filter_valda, 1) <= 20)
);

comment on table public.sokningar is 'En rad per gång resultatsidan laddas. Helt anonym.';

-- ── Bolagsklick ──────────────────────────────────────────────────────────────
create table if not exists public.bolagsklick (
  id             uuid        primary key default gen_random_uuid(),
  sok_id         uuid        not null,
  bolag          text        not null,
  pris_visat     integer,
  klick_position smallint,
  sortering      text,
  skapad_at      timestamptz not null default now(),

  constraint bolagsklick_bolag_rimligt    check (char_length(bolag) between 1 and 120),
  constraint bolagsklick_pris_rimligt     check (pris_visat is null or (pris_visat between 0 and 1000000)),
  constraint bolagsklick_position_rimlig  check (klick_position is null or (klick_position between 0 and 1000)),
  constraint bolagsklick_sortering_giltig check (sortering is null or sortering in ('price','max_age','max_amount'))
);

comment on table public.bolagsklick is 'En rad per klick vidare till ett bolag. Kopplas till sokningar via sok_id.';

-- ── Index för dashboardens frågor ────────────────────────────────────────────
create index if not exists sokningar_skapad_at_idx    on public.sokningar   (skapad_at desc);
create index if not exists sokningar_sok_id_idx       on public.sokningar   (sok_id);
create index if not exists bolagsklick_skapad_at_idx  on public.bolagsklick (skapad_at desc);
create index if not exists bolagsklick_bolag_idx      on public.bolagsklick (bolag);
create index if not exists bolagsklick_sok_id_idx     on public.bolagsklick (sok_id);

-- ── RLS: anon får SKRIVA men aldrig LÄSA ─────────────────────────────────────
-- Den publika nyckeln syns i sidkällan. Utan det här kan vem som helst
-- ladda ner hela datamängden.
alter table public.sokningar   enable row level security;
alter table public.bolagsklick enable row level security;

drop policy if exists "anon far skriva sokningar"   on public.sokningar;
drop policy if exists "anon far skriva bolagsklick" on public.bolagsklick;

create policy "anon far skriva sokningar"
  on public.sokningar for insert to anon with check (true);

create policy "anon far skriva bolagsklick"
  on public.bolagsklick for insert to anon with check (true);

-- Ingen SELECT-policy finns => ingen läsning via publik nyckel.
-- Dessutom explicit återkallande, så skyddet inte bara vilar på RLS.
revoke select, update, delete on public.sokningar   from anon, authenticated;
revoke select, update, delete on public.bolagsklick from anon, authenticated;

grant insert on public.sokningar   to anon;
grant insert on public.bolagsklick to anon;

-- Dashboarden läser via Edge Function med service role, som kringgår RLS.
