-- Skilj testdata från riktig besöksdata.
--
-- Testkörningar skriver riktiga rader. Utan separation förorenar de
-- dashboarden permanent.
--
-- Kravet är att flaggan inte ska gå att sätta genom att pilla i en URL.
-- Allt som avgörs i klienten går att förfalska, så kontrollen ligger i
-- databasen: RLS-policyn tillåter ar_test = true bara när anropet bär en
-- hemlig header som matchar en token som ligger i en låst tabell.
--
-- Token finns aldrig i klientkoden eller i repot — bara i databasen och i
-- testriggens .env.

-- ── Flaggan ──────────────────────────────────────────────────────────────
alter table public.sokningar   add column if not exists ar_test boolean not null default false;
alter table public.bolagsklick add column if not exists ar_test boolean not null default false;

comment on column public.sokningar.ar_test   is 'true = rad skriven av testriggen, döljs i dashboarden';
comment on column public.bolagsklick.ar_test is 'true = rad skriven av testriggen, döljs i dashboarden';

-- Dashboardens standardfrågor filtrerar på ar_test = false
create index if not exists sokningar_ar_test_idx   on public.sokningar   (ar_test, skapad_at desc);
create index if not exists bolagsklick_ar_test_idx on public.bolagsklick (ar_test, skapad_at desc);

-- ── Hemlig token ─────────────────────────────────────────────────────────
create table if not exists public.test_config (
  id         smallint primary key default 1,
  token      text     not null,
  skapad_at  timestamptz not null default now(),
  constraint test_config_en_rad check (id = 1)
);

alter table public.test_config enable row level security;
-- Inga policies: bara service role kommer åt tabellen.
revoke all on public.test_config from anon, authenticated;

comment on table public.test_config is 'Hemlig token som tillåter testriggen att sätta ar_test. Aldrig läsbar via publik nyckel.';

-- ── Serversidig kontroll ─────────────────────────────────────────────────
-- SECURITY DEFINER krävs för att läsa test_config, som anon saknar åtkomst
-- till. search_path låses, av samma skäl som i migration 20260818000300.
create or replace function public.ar_giltig_testrequest()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
           nullif(current_setting('request.headers', true), '')::json ->> 'x-test-token',
           ''
         ) = (select t.token from public.test_config t where t.id = 1)
     and exists (select 1 from public.test_config t where t.id = 1);
$$;

revoke execute on function public.ar_giltig_testrequest() from public;
grant  execute on function public.ar_giltig_testrequest() to anon, authenticated, service_role;

-- ── Nya insert-policies ──────────────────────────────────────────────────
-- ar_test = false står alla fritt att skriva. ar_test = true kräver token.
drop policy if exists "anon far skriva sokningar"   on public.sokningar;
drop policy if exists "anon far skriva bolagsklick" on public.bolagsklick;

create policy "anon far skriva sokningar"
  on public.sokningar for insert to anon
  with check (ar_test = false or public.ar_giltig_testrequest());

create policy "anon far skriva bolagsklick"
  on public.bolagsklick for insert to anon
  with check (ar_test = false or public.ar_giltig_testrequest());

-- Token sätts separat, inte i migrationen — den ska inte ligga i repot.
-- Se README under tests/.
