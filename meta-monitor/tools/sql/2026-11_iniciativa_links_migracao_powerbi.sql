-- =====================================================================
-- 2026-11_iniciativa_links_migracao_powerbi.sql
-- Página "Painéis" (v0.42.0): 3 colunas novas sobre a migração de cada painel pro Power
-- BI novo — "Prioridade de migração" (nº, único entre os painéis ativos: dois painéis não
-- podem dividir a mesma ordem), "Responsável pela migração" (outra pessoa, convive com o
-- responsável pela manutenção) e "Link do novo painel (Power BI)". Só usadas em
-- tipo = 'painel'.
--
-- Rodar DEPOIS de 2026-11_iniciativa_links.sql.
--
-- Idempotente. Atômico (begin/commit).
-- =====================================================================

begin;

alter table public.meta_inovacao_iniciativa_links
  add column if not exists prioridade_migracao integer,
  add column if not exists responsavel_migracao_pessoa_id bigint references public.meta_inovacao_pessoas(id),
  add column if not exists responsavel_migracao text,
  add column if not exists link_novo_powerbi text check (link_novo_powerbi is null or link_novo_powerbi ~* '^https?://');

-- dois painéis não podem dividir a mesma prioridade de migração
create unique index if not exists meta_inovacao_iniciativa_links_prioridade_migracao_uq
  on public.meta_inovacao_iniciativa_links (prioridade_migracao)
  where tipo = 'painel' and deleted_at is null and prioridade_migracao is not null;

commit;

-- Verificação: as 4 colunas existem e o índice único também
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'meta_inovacao_iniciativa_links'
   and column_name in ('prioridade_migracao', 'responsavel_migracao_pessoa_id', 'responsavel_migracao', 'link_novo_powerbi')
 order by column_name;
select indexname from pg_indexes
 where schemaname = 'public' and tablename = 'meta_inovacao_iniciativa_links'
   and indexname = 'meta_inovacao_iniciativa_links_prioridade_migracao_uq';

-- Pra REVERTER:
--   drop index if exists public.meta_inovacao_iniciativa_links_prioridade_migracao_uq;
--   alter table public.meta_inovacao_iniciativa_links
--     drop column if exists prioridade_migracao,
--     drop column if exists responsavel_migracao_pessoa_id,
--     drop column if exists responsavel_migracao,
--     drop column if exists link_novo_powerbi;
