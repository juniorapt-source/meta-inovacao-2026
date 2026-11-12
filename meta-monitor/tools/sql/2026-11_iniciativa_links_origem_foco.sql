-- =====================================================================
-- 2026-11_iniciativa_links_origem_foco.sql
-- Página "Painéis" (v0.41.0): nova coluna de texto livre "Origem no Foco",
-- ao lado de "Responsável pela manutenção". Só usada em tipo = 'painel'.
--
-- Rodar DEPOIS de 2026-11_iniciativa_links.sql.
--
-- Idempotente. Atômico (begin/commit).
-- =====================================================================

begin;

alter table public.meta_inovacao_iniciativa_links
  add column if not exists origem_foco text;

commit;

-- Verificação: a coluna existe
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'meta_inovacao_iniciativa_links' and column_name = 'origem_foco';

-- Pra REVERTER:
--   alter table public.meta_inovacao_iniciativa_links drop column if exists origem_foco;
