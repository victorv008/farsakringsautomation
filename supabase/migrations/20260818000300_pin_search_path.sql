-- Lås search_path för match_policy_chunks.
--
-- Funktionen är SECURITY INVOKER, så den saknade search_path:en var ingen
-- privilegie-eskalering — den kör med anroparens rättigheter, inte ägarens.
-- Men tabellreferensen var okvalificerad, så en anropare som satte en egen
-- search_path kunde få funktionen att läsa från en annan tabell med samma
-- namn. Det är ett korrekthetsproblem, och det är fyndet Supabase-linten
-- flaggar.
--
-- search_path = '' kräver att allt kvalificeras fullt ut, inklusive
-- operatorerna från vector-tillägget (som ligger i public).

create or replace function public.match_policy_chunks(
  query_embedding  vector,
  match_threshold  double precision default 0.5,
  match_count      integer          default 8
)
returns table (id uuid, bolag text, content text, similarity double precision)
language sql
stable
set search_path = ''
as $function$
  select
    pc.id,
    pc.bolag,
    pc.content,
    1 - (pc.embedding operator(public.<=>) query_embedding) as similarity
  from public.policy_chunks pc
  where 1 - (pc.embedding operator(public.<=>) query_embedding) > match_threshold
  order by pc.embedding operator(public.<=>) query_embedding
  limit match_count;
$function$;

-- Funktionen kunde köras av anon. Efter att RLS slagits på för policy_chunks
-- returnerar den ändå tomt för anon, eftersom SECURITY INVOKER innebär att
-- radskyddet gäller. Att återkalla rättigheten gör beteendet uttryckligt i
-- stället för tyst, och ingen anropare finns i kodbasen.
--
-- Bygger ni en RAG-funktion senare: anropa den från en Edge Function med
-- service role, precis som analytics-funktionen gör.
-- Postgres ger EXECUTE till PUBLIC som standard. Att återkalla från anon
-- räcker inte — grant:en måste tas från PUBLIC först.
revoke execute on function public.match_policy_chunks(vector, double precision, integer) from public;
revoke execute on function public.match_policy_chunks(vector, double precision, integer) from anon, authenticated;
grant  execute on function public.match_policy_chunks(vector, double precision, integer) to service_role;
