-- ============================================================================
-- Correção — "Sem permissão de escrita" ao CRIAR projeto no editor.html
-- ============================================================================
-- Sintoma (produção, cartacorso.com.br): no conjunto "Projetos & Representantes"
-- do Modo edição, "+ Novo projeto" → Adicionar falha com o alerta
-- "Sem permissão de escrita — fale com o JR." (js/supabase.js →
-- mensagemEscritaAmigavel, disparado por erro de RLS/permissão do PostgREST).
--
-- Diagnóstico: a LEITURA de meta_inovacao_projetos funciona ao vivo (a tabela
-- carrega os 27 projetos do Supabase, não do fallback data/projetos.js), e ela
-- usa o MESMO client, com o MESMO header x-cc-token (js/supabase.js), que a
-- escrita. Ou seja: o token certo (data/config.js.tokenEscrita =
-- 90bb649c-0a59-43b1-b486-17ec58f99108) está chegando ao banco. O que falha é
-- só a barreira de ESCRITA da tabela — GRANT INSERT/policy cc_token_insert
-- ausentes ou defasados em produção (a criação foi testada na v0.25.0, mas o
-- estado de RLS/GRANT em produção divergiu do script original
-- 2026-08_migracao_modo_edicao.sql). Como PADRAO_TABELA.md (item 3) registra:
-- sem o GRANT, o Postgres nega a operação ANTES de avaliar a policy — e o erro
-- aparece como permissão negada mesmo com a policy "certa" criada.
--
-- Este script RE-AFIRMA, de forma idempotente, o GRANT e as policies de escrita
-- de meta_inovacao_projetos, exatamente como o padrão da casa manda. Não mexe na
-- tabela, no seed, nos triggers (cc_touch_updated_at_projetos / cc_audit_projetos)
-- nem em nenhuma outra tabela — é seguro rodar quantas vezes precisar.
--
-- Soft delete (deleted_at) é o padrão do projeto: a remoção pela tela é UPDATE
-- (DB_PROJETOS.removerSoft), coberta por cc_token_update. Por isso NÃO há GRANT
-- DELETE nem policy de DELETE aqui (PADRAO_TABELA.md, item 3).
--
-- COMO RODAR: cole este script inteiro no SQL Editor do Supabase (projeto
-- "Coisas do Sebrae") e execute. Confira o SELECT de verificação no fim — deve
-- listar cc_select_publico (SELECT) + cc_token_insert (INSERT) + cc_token_update
-- (UPDATE), as duas últimas com o token acima dentro de qual/with_check.
-- ============================================================================

-- 1) Remove qualquer policy pré-existente da tabela (nome real pode não ser
--    conhecido — busca dinâmica no catálogo em vez de adivinhar), pra não deixar
--    nenhuma policy antiga/defasada coexistindo com as certas.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'meta_inovacao_projetos'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_projetos', pol.policyname);
  END LOOP;
END $$;

-- 2) Garante RLS ligada (idempotente).
ALTER TABLE public.meta_inovacao_projetos ENABLE ROW LEVEL SECURITY;

-- 3) GRANT vem ANTES das policies — sem ele, RLS nunca é avaliado e a escrita é
--    negada na base (PADRAO_TABELA.md, item 3). DELETE fica de fora: soft delete
--    via deleted_at (remoção = UPDATE).
GRANT SELECT, INSERT, UPDATE ON public.meta_inovacao_projetos TO anon, authenticated;

-- 4) Policies — leitura pública, escrita condicionada ao token compartilhado
--    (mesmo token de data/config.js.tokenEscrita — um só pro site inteiro).
CREATE POLICY "cc_select_publico" ON public.meta_inovacao_projetos
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "cc_token_insert" ON public.meta_inovacao_projetos
  FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

CREATE POLICY "cc_token_update" ON public.meta_inovacao_projetos
  FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

-- 5) Recarrega o cache de schema do PostgREST — o script tocou GRANT numa tabela
--    que JÁ EXISTIA (PADRAO_TABELA.md, item 8). Inofensivo se não fosse
--    necessário; evita que a escrita continue falhando por cache velho da API.
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Verificação — deve listar 3 linhas: cc_select_publico (SELECT),
-- cc_token_insert (INSERT) e cc_token_update (UPDATE), as duas de escrita já
-- com o token 90bb649c-... aparecendo em qual/with_check.
-- ---------------------------------------------------------------------------
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'meta_inovacao_projetos'
ORDER BY cmd, policyname;
