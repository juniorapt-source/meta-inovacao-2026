-- =====================================================================
-- 2026-11_iniciativa_links_portal_sebrae.sql
-- Página "Sites" (v0.40.0): nova coluna de check "Está no Portal Sebrae?",
-- ao lado de "Formulário de captura de lead". Só usada em tipo = 'site'.
--
-- Rodar DEPOIS de 2026-11_iniciativa_links.sql.
--
-- Idempotente. Atômico (begin/commit).
-- =====================================================================

begin;

alter table public.meta_inovacao_iniciativa_links
  add column if not exists portal_sebrae boolean not null default false;

commit;

-- Verificação: a coluna existe
select column_name from information_schema.columns
 where table_schema = 'public' and table_name = 'meta_inovacao_iniciativa_links' and column_name = 'portal_sebrae';

-- Pra REVERTER:
--   alter table public.meta_inovacao_iniciativa_links drop column if exists portal_sebrae;
