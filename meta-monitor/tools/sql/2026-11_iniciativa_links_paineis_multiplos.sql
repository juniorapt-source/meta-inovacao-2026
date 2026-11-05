-- =====================================================================
-- 2026-11_iniciativa_links_paineis_multiplos.sql
-- Página "Painéis" (v0.34.0): mais de um painel por iniciativa + coluna de detalhes.
--
-- Rodar DEPOIS de 2026-11_iniciativa_links.sql.
--
-- 1) Coluna `descricao` (texto livre, opcional): o que é o painel.
-- 2) A restrição única (tipo, iniciativa) sai. No lugar entra um índice único parcial
--    que continua garantindo UMA linha por iniciativa só para tipo = 'site'.
--    Para tipo = 'painel' a iniciativa pode ter várias linhas.
--
-- Remover painel = soft delete (deleted_at), pela policy de UPDATE que já existe.
-- Nenhuma policy/GRANT muda.
--
-- Idempotente. Atômico (begin/commit).
-- =====================================================================

begin;

alter table public.meta_inovacao_iniciativa_links
  add column if not exists descricao text;

alter table public.meta_inovacao_iniciativa_links
  drop constraint if exists meta_inovacao_iniciativa_links_tipo_iniciativa_uq;

create unique index if not exists meta_inovacao_iniciativa_links_site_uq
  on public.meta_inovacao_iniciativa_links (iniciativa)
  where tipo = 'site' and deleted_at is null;

create index if not exists meta_inovacao_iniciativa_links_tipo_iniciativa_idx
  on public.meta_inovacao_iniciativa_links (tipo, iniciativa);

commit;

-- Verificação: a coluna existe e a restrição antiga sumiu (deve voltar 1 linha e 0 linhas)
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'meta_inovacao_iniciativa_links' and column_name = 'descricao';
select conname from pg_constraint
 where conname = 'meta_inovacao_iniciativa_links_tipo_iniciativa_uq';

-- Pra REVERTER (só se nenhuma iniciativa tiver mais de um painel ativo):
--   drop index if exists public.meta_inovacao_iniciativa_links_site_uq;
--   alter table public.meta_inovacao_iniciativa_links
--     add constraint meta_inovacao_iniciativa_links_tipo_iniciativa_uq unique (tipo, iniciativa);
--   alter table public.meta_inovacao_iniciativa_links drop column if exists descricao;
