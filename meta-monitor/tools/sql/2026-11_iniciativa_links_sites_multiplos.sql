-- =====================================================================
-- 2026-11_iniciativa_links_sites_multiplos.sql
-- Página "Sites" (v0.39.0): mais de um link por iniciativa (igual ao que
-- 2026-11_iniciativa_links_paineis_multiplos.sql já fez pra Painéis).
--
-- Rodar DEPOIS de 2026-11_iniciativa_links.sql e de
-- 2026-11_iniciativa_links_paineis_multiplos.sql.
--
-- O índice único parcial que garantia UMA linha por iniciativa pra
-- tipo = 'site' (criado no script dos painéis) sai. Sem ele, os dois tipos
-- passam a aceitar várias linhas por iniciativa.
--
-- Remover site = soft delete (deleted_at), pela policy de UPDATE que já existe.
-- Nenhuma policy/GRANT muda.
--
-- Idempotente. Atômico (begin/commit).
-- =====================================================================

begin;

drop index if exists public.meta_inovacao_iniciativa_links_site_uq;

commit;

-- Verificação: o índice sumiu (deve voltar 0 linhas)
select indexname from pg_indexes
 where schemaname = 'public' and indexname = 'meta_inovacao_iniciativa_links_site_uq';

-- Pra REVERTER (só se nenhuma iniciativa tiver mais de um site ativo):
--   create unique index meta_inovacao_iniciativa_links_site_uq
--     on public.meta_inovacao_iniciativa_links (iniciativa)
--     where tipo = 'site' and deleted_at is null;
