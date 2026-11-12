-- =====================================================================
-- 2026-11_iniciativa_links_id.sql
-- Página "Painéis" (v0.43.0): nova coluna de texto livre "ID", entre "Origem no Foco" e
-- "Prioridade de migração". Só usada em tipo = 'painel'.
--
-- Rodar DEPOIS de 2026-11_iniciativa_links.sql.
--
-- Idempotente. Atômico (begin/commit).
-- =====================================================================

begin;

alter table public.meta_inovacao_iniciativa_links
  add column if not exists identificador text;

commit;

-- Verificação: a coluna existe
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'meta_inovacao_iniciativa_links' and column_name = 'identificador';

-- Pra REVERTER:
--   alter table public.meta_inovacao_iniciativa_links drop column if exists identificador;
