-- =====================================================================
-- plano_acao_atividades — GRANTs + RLS no projeto Supabase compartilhado
-- "Coisas do Sebrae" (wdygbfrmewlaffjsfyoi.supabase.co).
--
-- A TABELA JÁ EXISTE (criada fora deste repositório, provavelmente pelo
-- Table Editor do dashboard) — este script NÃO cria a tabela, só corrige
-- o acesso. Confirmado em 2026-08-12: uma consulta com a anon key contra
-- /rest/v1/plano_acao_atividades devolve
--   {"code":"42501","message":"permission denied for table plano_acao_atividades",
--    "hint":"Grant the required privileges to the current role with:
--    GRANT SELECT ON public.plano_acao_atividades TO anon;"}
-- — ou seja, a tabela existe (senão o erro seria "relation does not exist" /
-- PGRST205), só falta GRANT. Mesmíssimo problema que já tinha acontecido com
-- meta_inovacao_matriz_demandas (corrigido na v0.3.1) — tabelas criadas pelo
-- Table Editor da UI ganham GRANT automático pro dono, mas não necessariamente
-- pra anon/authenticated quando RLS entra em cena.
--
-- Não foi executado pelo agente — não há credencial de DDL disponível no
-- ambiente de automação (só a anon key, que é read/write de dado, não de
-- schema). Rode este arquivo inteiro no SQL Editor do dashboard do Supabase
-- (projeto wdygbfrmewlaffjsfyoi), na ordem em que aparece. É idempotente.
--
-- Sem isso, a aba "Plano de Ação" do site carrega e mostra a mensagem de
-- erro "Não consegui carregar do Supabase" em vez das atividades.
-- =====================================================================

-- 0) Conferência do estado atual — rode antes e guarde o resultado.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'plano_acao_atividades'
order by ordinal_position;

select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename = 'plano_acao_atividades';

-- 1) Trigger: updated_at sempre reflete a última escrita, mesmo se o
--    cliente esquecer de mandar o campo (o site já manda explicitamente
--    a cada save, isso aqui é rede de segurança — mesmo padrão já usado
--    em meta_inovacao_matriz_demandas).
create or replace function public.plano_acao_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_plano_acao_updated_at on public.plano_acao_atividades;
create trigger trg_plano_acao_updated_at
before update on public.plano_acao_atividades
for each row
execute function public.plano_acao_set_updated_at();

-- 2) RLS — habilitada, com policy aberta pra role anon. O site não tem
--    login (igual o resto do painel): todo mundo que abre vê e edita o
--    mesmo conteúdo. Pra restringir depois, apague a policy abaixo e crie
--    uma exigindo auth:
--      create policy plano_acao_atividades_auth_all
--      on public.plano_acao_atividades for all
--      to authenticated using (true) with check (true);
--    (e revogue o acesso de anon removendo a policy anon_all).
alter table public.plano_acao_atividades enable row level security;

drop policy if exists plano_acao_atividades_anon_all on public.plano_acao_atividades;
create policy plano_acao_atividades_anon_all
on public.plano_acao_atividades
for all
to anon
using (true)
with check (true);

-- 3) GRANTs no nível de tabela — é isso que está faltando hoje (ver nota
--    do topo). RLS sozinho não basta: sem GRANT, o Postgres barra a query
--    antes de sequer avaliar as policies.
grant select, insert, update, delete
  on public.plano_acao_atividades
  to anon;

-- authenticated fica preparado pra quando/se a gente migrar pra login.
grant select, insert, update, delete
  on public.plano_acao_atividades
  to authenticated;

-- 4) Conferência final (rode depois e guarde o resultado no log):
select tablename, rowsecurity from pg_tables
where schemaname='public' and tablename='plano_acao_atividades';
select policyname, cmd, roles from pg_policies
where tablename = 'plano_acao_atividades';
select count(*) as total_atividades from public.plano_acao_atividades;
