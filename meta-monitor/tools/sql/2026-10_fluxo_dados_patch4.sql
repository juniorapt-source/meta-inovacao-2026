-- =====================================================================
-- 2026-10_fluxo_dados_patch4.sql
-- Fluxo de dados: link do painel.
--
-- Adiciona fluxo_dados_paineis.link_painel (texto, opcional).
-- Só aceita endereço começando com http:// ou https:// (bloqueia
-- javascript: e outros esquemas que virariam link perigoso na tela).
-- As policies da tabela (patch2) já cobrem a coluna nova: não mexe nelas.
--
-- Ordem: depois do patch3. Idempotente. Não altera dados existentes.
-- =====================================================================

begin;

alter table fluxo_dados_paineis
  add column if not exists link_painel text;

alter table fluxo_dados_paineis
  drop constraint if exists fluxo_dados_paineis_link_painel_http;

alter table fluxo_dados_paineis
  add constraint fluxo_dados_paineis_link_painel_http
  check (link_painel is null or link_painel ~* '^https?://[^[:space:]]+$');

comment on column fluxo_dados_paineis.link_painel is
  'Endereço (http/https) onde o painel pode ser aberto. Opcional.';

commit;

notify pgrst, 'reload schema';

-- Conferência (rodar depois):
-- select column_name, data_type from information_schema.columns
--  where table_name = 'fluxo_dados_paineis' and column_name = 'link_painel';
