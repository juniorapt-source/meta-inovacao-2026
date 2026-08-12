-- =====================================================================
-- meta_inovacao_matriz_demandas — setup no projeto Supabase compartilhado
-- "Coisas do Sebrae" (wdygbfrmewlaffjsfyoi.supabase.co). Tabelas deste site
-- são todas prefixadas com meta_inovacao_ pra conviver com outros projetos
-- (ex.: Dream Force 2026) no mesmo projeto Supabase.
--
-- GERADO A PARTIR DE data/canais.js + data/iniciativas.js + data/matriz.js
-- em 2026-08-12. Não foi executado pelo agente — não havia
-- credencial disponível no ambiente de execução (sem supabase CLI, sem psql,
-- só a anon key, que não tem permissão de DDL). Rode este arquivo inteiro no
-- SQL Editor do dashboard do Supabase (projeto wdygbfrmewlaffjsfyoi), na ordem
-- em que aparece. É idempotente: pode rodar mais de uma vez sem duplicar dado
-- nem quebrar se a tabela já existir.
--
-- v0.3.1: adicionado o bloco 3.5 com os GRANTs de tabela pra anon/authenticated
-- — sem eles o Postgres barra a query com "permission denied" antes do RLS
-- sequer ser avaliado. Já foi rodado manualmente em produção; a nota acima
-- ("não executado pelo agente") vale do ponto de vista histórico do setup
-- original, não deste ajuste.
-- =====================================================================

-- 0) Registro de auditoria — tabelas existentes no schema public antes do setup.
--    Rode isso primeiro e guarde o resultado no log da execução (pedido do plano).
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public';

-- 1) Tabela principal: uma linha por iniciativa, uma coluna por canal.
--    Espelha data/matriz.js (objeto iniciativa -> {canal_id: estado}).
--    Estados possíveis por célula: '', previsto, oficina, formulario,
--    justificado, priorizado, encaminhado (mesmo vocabulário do editor.html /
--    demandas.html, ESTADOS_CEL / ROTULO_CEL).
create table if not exists public.meta_inovacao_matriz_demandas (
  id uuid primary key default gen_random_uuid(),
  iniciativa text not null unique,
  foco text not null default '' check (foco in ('', 'previsto', 'oficina', 'formulario', 'justificado', 'priorizado', 'encaminhado')),
  cnr text not null default '' check (cnr in ('', 'previsto', 'oficina', 'formulario', 'justificado', 'priorizado', 'encaminhado')),
  empresa text not null default '' check (empresa in ('', 'previsto', 'oficina', 'formulario', 'justificado', 'priorizado', 'encaminhado')),
  portal text not null default '' check (portal in ('', 'previsto', 'oficina', 'formulario', 'justificado', 'priorizado', 'encaminhado')),
  mkt text not null default '' check (mkt in ('', 'previsto', 'oficina', 'formulario', 'justificado', 'priorizado', 'encaminhado')),
  loja text not null default '' check (loja in ('', 'previsto', 'oficina', 'formulario', 'justificado', 'priorizado', 'encaminhado')),
  rede text not null default '' check (rede in ('', 'previsto', 'oficina', 'formulario', 'justificado', 'priorizado', 'encaminhado')),
  assessoria text not null default '' check (assessoria in ('', 'previsto', 'oficina', 'formulario', 'justificado', 'priorizado', 'encaminhado')),
  dxp text not null default '' check (dxp in ('', 'previsto', 'oficina', 'formulario', 'justificado', 'priorizado', 'encaminhado')),
  contab text not null default '' check (contab in ('', 'previsto', 'oficina', 'formulario', 'justificado', 'priorizado', 'encaminhado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

comment on table public.meta_inovacao_matriz_demandas is
  'Matriz de demandas do Meta Inovação 2026 — 1 linha por iniciativa, 1 coluna por canal (grade v2, 10 canais).';

-- 2) Trigger: atualizado_em sempre reflete a última escrita, mesmo se o
--    cliente esquecer de mandar o campo.
create or replace function public.meta_inovacao_set_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

drop trigger if exists trg_meta_inovacao_matriz_atualizado_em on public.meta_inovacao_matriz_demandas;
create trigger trg_meta_inovacao_matriz_atualizado_em
before update on public.meta_inovacao_matriz_demandas
for each row
execute function public.meta_inovacao_set_atualizado_em();

-- 3) RLS — habilitada, com policy aberta pra role anon *apenas nesta tabela*.
--    Isso é intencional pro estágio atual (edição colaborativa sem login).
--    Pra restringir depois: apague a policy abaixo e crie uma nova exigindo
--    auth, por exemplo:
--      create policy meta_inovacao_matriz_demandas_auth_all
--      on public.meta_inovacao_matriz_demandas for all
--      to authenticated using (true) with check (true);
--    (e revogue o acesso de anon removendo a policy anon_all).
alter table public.meta_inovacao_matriz_demandas enable row level security;

drop policy if exists meta_inovacao_matriz_demandas_anon_all on public.meta_inovacao_matriz_demandas;
create policy meta_inovacao_matriz_demandas_anon_all
on public.meta_inovacao_matriz_demandas
for all
to anon
using (true)
with check (true);

-- 3.5) GRANTs no nível de tabela.
--      RLS sozinho não basta: sem GRANT, o Postgres barra a query antes de
--      avaliar as policies e o cliente recebe "permission denied for table".
--      Tabelas criadas pelo Table Editor do Supabase (UI) recebem esses grants
--      automaticamente; quando a tabela é criada por SQL cru (como aqui), a
--      gente precisa dar explicitamente.
grant select, insert, update, delete
  on public.meta_inovacao_matriz_demandas
  to anon;

-- authenticated fica preparado pra quando/se a gente migrar pra login.
-- Sem policy pra authenticated, o RLS bloqueia mesmo com grant — é só terreno.
grant select, insert, update, delete
  on public.meta_inovacao_matriz_demandas
  to authenticated;

-- 4) Seed a partir do data/matriz.js atual (27 iniciativas × 10 canais).
--    on conflict (iniciativa) do nothing => idempotente: rodar de novo não duplica.
insert into public.meta_inovacao_matriz_demandas (iniciativa, foco, cnr, empresa, portal, mkt, loja, rede, assessoria, dxp, contab)
values
  ('ACT Ministério da Saúde', '', '', '', '', '', '', '', '', '', ''),
  ('ALI Academy', '', '', '', '', '', '', '', '', '', ''),
  ('ALI Coop', '', '', '', '', '', '', '', '', '', ''),
  ('ALI Ecossistema', '', '', '', '', '', '', '', '', '', ''),
  ('ALI IG', '', '', '', '', '', '', '', '', '', ''),
  ('ALI Produtividade', '', '', '', '', '', '', '', '', '', ''),
  ('ALI Rural', '', '', '', '', '', '', '', '', '', ''),
  ('ATIVA', '', '', '', '', '', '', '', '', '', ''),
  ('Catalisa Gov', '', '', '', '', '', '', '', '', '', ''),
  ('Catalisa ICT', '', '', '', '', '', '', '', '', '', ''),
  ('Consult', '', '', '', '', '', '', '', '', '', ''),
  ('Convênio Anprotec', '', '', '', '', '', '', '', '', '', ''),
  ('Coopera mais Amazônia', '', '', '', '', '', '', '', '', '', ''),
  ('ELI', '', '', '', '', '', '', '', '', '', ''),
  ('ELI Summit', '', '', '', '', '', '', '', '', '', ''),
  ('Embrapii', '', '', '', '', '', '', '', '', '', ''),
  ('Inova Biomas', '', '', '', '', '', '', '', '', '', ''),
  ('Internacionalização', '', '', '', '', '', '', '', '', '', ''),
  ('MEI + Inovador', '', '', '', '', '', '', '', '', '', ''),
  ('Missões', '', '', '', '', '', '', '', '', '', ''),
  ('Prêmio Sebrae Startups', '', '', '', '', '', '', '', '', '', ''),
  ('Sebrae Origens', '', '', '', '', '', '', '', '', '', ''),
  ('Sebrae Startups', '', '', '', '', '', '', '', '', '', ''),
  ('Sebraetec', '', '', '', '', '', '', '', '', '', ''),
  ('Startup Day', '', '', '', '', '', '', '', '', '', ''),
  ('Startup NE', '', '', '', '', '', '', '', '', '', ''),
  ('Websummit Rio e Lisboa', '', '', '', '', '', '', '', '', '', '')
on conflict (iniciativa) do nothing;

-- 5) Conferência (rode depois do insert e guarde o resultado no log):
select count(*) as total_linhas from public.meta_inovacao_matriz_demandas;
select iniciativa, foco, cnr, empresa, portal, mkt, loja, rede, assessoria, dxp, contab, atualizado_em, atualizado_por
from public.meta_inovacao_matriz_demandas
order by iniciativa
limit 5;
select tablename, rowsecurity from pg_tables where schemaname='public' and tablename='meta_inovacao_matriz_demandas';
select policyname, cmd, roles from pg_policies where tablename = 'meta_inovacao_matriz_demandas';
