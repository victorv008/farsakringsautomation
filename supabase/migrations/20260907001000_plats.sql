-- Ungefärlig plats per besök — län alltid, ort när den går att fastställa.
--
-- IP-uppslag. /api/plats läser Vercels geo-header i samma ögonblick som
-- sidan laddas, och skickar tillbaka landskod, länskod och ortsnamn.
-- IP-adressen läses i en request-header, används i minnet och skrivs
-- aldrig — varken här eller i Vercels applikationskod.
--
-- Täcker alla besök, men är systematiskt fel för mobiltrafik: svenska
-- operatörer dirigerar trafik genom ett fåtal noder, mest i
-- Stockholmsregionen, så en besökare i Växjö rapporteras rutinmässigt
-- som Stockholm. Den informationen finns inte i paketet och kan inte
-- återskapas av någon leverantör.
--
-- En tidigare version av den här funktionen kompletterade uppslaget med en
-- frivillig fråga på resultatsidan där besökaren skrev sin egen kommun.
-- Den togs bort innan den nådde besökarna: det skulle ha känts som att
-- sajten bad om personlig information, precis det ingen ville signalera.
-- IP-uppslaget står kvar ensamt, med den osäkerhet det innebär.
--
-- All normalisering av ortsnamn sker i js/kommuner.js, i webbläsaren. Ett
-- ortsnamn som inte matchar en svensk kommun blir null, aldrig ett fritt
-- värde.

alter table public.handelser add column if not exists lan  text;
alter table public.handelser add column if not exists stad text;

comment on column public.handelser.lan is
  'Ungefärligt län ur IP. null = uppslaget hann inte klart innan besökaren lämnade. Grovt, och ofta fel för mobiltrafik.';
comment on column public.handelser.stad is
  'Ungefärlig kommun ur IP, normaliserad mot Sveriges 290 kommuner. Kranskommuner redovisas under sin stad. Exponeras aldrig på en enskild besöksresa.';

-- ── lan: hård whitelist ──────────────────────────────────────────────────
-- Länsindelningen har inte ändrats sedan 1998 och klienten defaultar till
-- 'okand', så en giltig klient kan aldrig fälla den här. Den finns för
-- fientliga POST:ar. Listan speglar Kommuner.lanSlugar() i js/kommuner.js —
-- tests/kor-tester.mjs jämför de två och fäller körningen vid drift.
alter table public.handelser drop constraint if exists handelser_lan_giltigt;
alter table public.handelser add constraint handelser_lan_giltigt check (
  lan is null or lan in (
    'blekinge','dalarna','gavleborg','gotland','halland','jamtland',
    'jonkoping','kalmar','kronoberg','norrbotten','orebro','ostergotland',
    'skane','sodermanland','stockholm','uppsala','varmland','vasterbotten',
    'vasternorrland','vastmanland','vastra-gotaland',
    'utland','okand'));

-- ── stad: BARA formkontroll, ingen innehållswhitelist ────────────────────
-- Avsiktligt. En innehållswhitelist skulle betyda att ett enda oväntat
-- ortsnamn avvisar HELA batchen med 400 — och en batch bär upp till åtta av
-- besökets händelser, inte bara ortsfältet. Tyst, oåterkallelig
-- dataförlust. Den auktoritativa listan ligger i läsvägen i stället, där
-- ett okänt värde bara faller ur topplistan och ingen skada sker.
--
-- Invändningen är att skräprader kan hamna i tabellen. De kan aldrig nå
-- dashboarden, det finns ingen ::int-cast att fälla, och bolagsklick.bolag
-- är redan fritext som går rakt in i en topplista. Exponeringen är inte ny.
alter table public.handelser drop constraint if exists handelser_stad_form;
alter table public.handelser add constraint handelser_stad_form check (
  stad is null or (char_length(stad) between 2 and 40
                   and stad ~ '^[A-Za-zÅÄÖÜÉÀÈåäöüéàè''. -]+$'));

create index if not exists handelser_lan_idx
  on public.handelser (lan, skapad_at desc) where lan is not null;

-- ── Vyn: länet följer med, ALDRIG orten ──────────────────────────────────
-- Ort + ålder + belopp + klockslag på en enskild besöksresa är en betydligt
-- starkare identifierare än länet. Regeln ligger här i vyn och inte i
-- gränssnittet, så att den inte kan gå förlorad vid en framtida omskrivning
-- av dashboard.html. Av samma skäl räknar Edge Function upp sina kolumner
-- explicit i handling: 'resa' — lägg inte till lan eller stad där heller.
--
-- drop + create, inte create or replace: den senare kan bara LÄGGA TILL
-- kolumner sist, och lan hamnar mitt i listan. Migrationen körs i en
-- transaktion, så vyn är aldrig borta för någon läsare.
drop view if exists public.resor_sammanfattning;

create view public.resor_sammanfattning as
select
  h.sok_id,
  h.ar_test,
  min(h.skapad_at)                                              as start,
  max(h.skapad_at)                                              as slut,
  -- Längden tas ur ms_sedan_start, inte ur skapad_at. Händelser skickas i
  -- batch och delar då tidsstämpel, vilket får skapad_at-differensen att
  -- underskatta resans längd — ofta ända ner till noll.
  coalesce(max(h.ms_sedan_start) / 1000, 0)                     as langd_sek,
  count(*)                                                      as antal_handelser,
  max(h.enhet)                                                  as enhet,

  -- max() ignorerar null, så resan får sitt län även om de första
  -- händelserna hann köas innan geo-uppslaget landade.
  max(h.lan)                                                    as lan,

  -- Bytte länet MITT i besöket är det bevis på ett nätnodsbyte, inte på att
  -- besökaren flyttade. Ett mått på opålitligheten räknat på egen data.
  (count(distinct h.lan) filter (where h.lan is not null) > 1)   as geo_varierade,

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
  'En rad per besök. Avhopp härleds ur formen: nadde_resultat = true och utklick = 0 betyder avhopp på resultatsidan. Innehåller lan men ALDRIG stad — se migrationens kommentar.';

-- ── Aggregat för dashboardens platskort ──────────────────────────────────
-- Egen funktion, inte en fråga mot resor_sammanfattning, eftersom den vyn
-- grupperar över hela tabellen och filtrerar först på aggregatet. Här trycks
-- datumfiltret ned till det indexerade skapad_at före grupperingen.
--
-- Skiljer på två sorters saknat värde, som har olika orsak och olika bias:
--   'okand'  — uppslaget gjordes, gav inget (VPN, Private Relay, blockerat)
--   'saknas' — uppslaget hann aldrig göras (besökaren studsade)
-- Att slå ihop dem hade dolt studsarbiasen: besök utan län är systematiskt
-- kortare än genomsnittet.
-- drop + create, inte create or replace: returtypen tappar en kolumn
-- (ort_svar) och Postgres vägrar byta returtyp på en befintlig funktion.
drop function if exists public.plats_oversikt(timestamptz, boolean);

create function public.plats_oversikt(fran timestamptz, visa_test boolean)
returns table (
  enhet        text,
  lan          text,
  stad         text,
  besok        bigint,
  varierade    bigint
)
language sql stable security definer set search_path = '' as $$
  with resor as (
    select h.sok_id,
           max(h.enhet)                                          as enhet,
           max(h.lan)                                            as lan,
           max(h.stad)                                           as stad,
           count(distinct h.lan) filter (where h.lan is not null) as antal_lan
    from public.handelser h
    where h.skapad_at >= fran
      and (visa_test or h.ar_test = false)
    group by h.sok_id
  )
  select coalesce(r.enhet, 'okand'),
         coalesce(r.lan,   'saknas'),
         r.stad,
         count(*),
         count(*) filter (where r.antal_lan > 1)
  from resor r
  group by 1, 2, 3;
$$;

comment on function public.plats_oversikt(timestamptz, boolean) is
  'Platsfördelning per besök, uppdelad på enhet. Mobil och dator får aldrig slås ihop — divergensen mellan dem är själva måttet på hur opålitligt IP-uppslaget är.';

revoke execute on function public.plats_oversikt(timestamptz, boolean) from public, anon, authenticated;
grant  execute on function public.plats_oversikt(timestamptz, boolean) to service_role;

-- Låt PostgREST se de nya kolumnerna direkt. Utan det svarar den PGRST204
-- på klientens skrivningar tills cachen laddas om av sig själv — och
-- .catch() i analytics.js sväljer felet tyst, för ALLA besökare.
notify pgrst, 'reload schema';
