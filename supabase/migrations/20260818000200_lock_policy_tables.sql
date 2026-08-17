-- Lås de befintliga policy-tabellerna.
--
-- Båda hade RLS avstängt, vilket innebar att vem som helst med den publika
-- nyckeln kunde läsa och skriva varje rad. Båda var tomma när detta kördes.
--
-- ingest/ingest.js ansluter med SUPABASE_SECRET_KEY (service role), som
-- kringgår RLS. Ingest-pipelinen påverkas därför inte av den här ändringen.

alter table public.policy_documents enable row level security;
alter table public.policy_chunks    enable row level security;

-- Inga policies skapas med flit: ingen åtkomst alls via anon eller
-- authenticated. Endast service role kommer åt tabellerna.
revoke all on public.policy_documents from anon, authenticated;
revoke all on public.policy_chunks    from anon, authenticated;
