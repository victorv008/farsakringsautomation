-- Ungefärlig plats per besök — län alltid, ort när den går att fastställa.
--
-- Två källor, medvetet, eftersom ingen av dem duger ensam:
--
--   A. IP-uppslag. /api/plats läser Vercels geo-header i samma ögonblick som
--      sidan laddas, och skickar tillbaka landskod, länskod och ortsnamn.
--      IP-adressen läses i en request-header, används i minnet och skrivs
--      aldrig — varken här eller i Vercels applikationskod.
--
--      Täcker alla besök, men är systematiskt fel för mobiltrafik: svenska
--      operatörer dirigerar trafik genom ett fåtal noder, mest i
--      Stockholmsregionen, så en besökare i Växjö rapporteras rutinmässigt
--      som Stockholm. Den informationen finns inte i paketet och kan inte
--      återskapas av någon leverantör.
--
--   B. Frivillig fråga på resultatsidan. Besökaren skriver själv sin kommun.
--      Täcker få besök, men svaren är sanna — och de mäter hur ofta A hade
--      rätt. Ligger i data->>'ort' på en 'ort_angiven'-händelse, efter
--      samma mönster som utklick redan lägger bolagsnamnet i data.
--
-- All normalisering av ortsnamn sker i js/kommuner.js, i webbläsaren, för
-- båda källorna. Ett ortsnamn som inte matchar en svensk kommun blir null,
-- aldrig ett fritt värde.

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

-- Samma resonemang för besökarens egna svar: form, aldrig innehåll.
alter table public.handelser drop constraint if exists handelser_ort_svar_form;
alter table public.handelser add constraint handelser_ort_svar_form check (
  data ->> 'ort' is null or (char_length(data ->> 'ort') between 2 and 40
                             and data ->> 'ort' ~ '^[A-Za-zÅÄÖÜÉÀÈåäöüéàè''. -]+$'));

-- ── Ny händelsetyp för det frivilliga svaret ─────────────────────────────
alter table public.handelser drop constraint if exists handelser_typ_giltig;
alter table public.handelser add constraint handelser_typ_giltig check (typ in (
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
  'ort_angiven',
  'fel'
));

create index if not exists handelser_lan_idx
  on public.handelser (lan, skapad_at desc) where lan is not null;

-- ── Vyn: länet följer med, ALDRIG orten ──────────────────────────────────
-- Ort + ålder + belopp + klockslag på en enskild besöksresa är en betydligt
-- starkare identifierare än länet. Regeln ligger här i vyn och inte i
-- gränssnittet, så att den inte kan gå förlorad vid en framtida omskrivning
-- av dashboard.html. Av samma skäl räknar Edge Function upp sina kolumner
-- explicit i handling: 'resa' — lägg inte till lan eller stad där heller.
create or replace view public.resor_sammanfattning as
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
create or replace function public.plats_oversikt(fran timestamptz, visa_test boolean)
returns table (
  enhet        text,
  lan          text,
  stad         text,
  ort_svar     text,
  besok        bigint,
  varierade    bigint
)
language sql stable security definer set search_path = '' as $$
  with resor as (
    select h.sok_id,
           max(h.enhet)                                              as enhet,
           max(h.lan)                                                as lan,
           max(h.stad)                                               as stad,
           max(h.data ->> 'ort') filter (where h.typ = 'ort_angiven') as ort_svar,
           count(distinct h.lan) filter (where h.lan is not null)     as antal_lan
    from public.handelser h
    where h.skapad_at >= fran
      and (visa_test or h.ar_test = false)
    group by h.sok_id
  )
  select coalesce(r.enhet, 'okand'),
         coalesce(r.lan,   'saknas'),
         r.stad,
         r.ort_svar,
         count(*),
         count(*) filter (where r.antal_lan > 1)
  from resor r
  group by 1, 2, 3, 4;
$$;

comment on function public.plats_oversikt(timestamptz, boolean) is
  'Platsfördelning per besök, uppdelad på enhet. Mobil och dator får aldrig slås ihop — divergensen mellan dem är själva måttet på hur opålitligt IP-uppslaget är.';

revoke execute on function public.plats_oversikt(timestamptz, boolean) from public, anon, authenticated;
grant  execute on function public.plats_oversikt(timestamptz, boolean) to service_role;

-- Låt PostgREST se de nya kolumnerna direkt. Utan det svarar den PGRST204
-- på klientens skrivningar tills cachen laddas om av sig själv — och
-- .catch() i analytics.js sväljer felet tyst, för ALLA besökare.
notify pgrst, 'reload schema';
