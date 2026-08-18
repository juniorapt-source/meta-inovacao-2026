-- ============================================================================
-- Correção — erro 406 ao EDITAR o "Caminho para o Corsário" no editor.html
-- ============================================================================
-- Sintoma (produção, cartacorso.com.br): no conjunto "O Caminho para o Corsário"
-- do Modo edição, mudar o status (ou a observação) de uma célula falha. No
-- console do navegador aparece:
--   Failed to load resource: the server responded with a status of 406 ()
--     .../corsario_status?id=eq.<n>&select=*
--   editor: falha ao salvar status do corsário   (editor.html)
--
-- Diagnóstico: a LEITURA de corsario_status funciona ao vivo (a tela monta a
-- matriz iniciativa×critério com dado real do Supabase, não de fallback — não
-- existe seed local pra este conjunto), e ela usa o MESMO client, com o MESMO
-- header x-cc-token (js/supabase.js), que a escrita. Ou seja: o token certo
-- (data/config.js.tokenEscrita = 90bb649c-0a59-43b1-b486-17ec58f99108) chega ao
-- banco — a prova é que a MESMA credencial edita normalmente as outras tabelas
-- (meta_inovacao_projetos etc.).
--
-- Por que 406 (e não "Sem permissão de escrita", como foi no caso de projetos)?
-- Porque aqui o GRANT UPDATE existe, mas a POLICY de UPDATE (cc_token_update) de
-- corsario_status está AUSENTE ou DEFASADA em produção (o estado de RLS divergiu
-- do script original 2026-08_corsario_edicao.sql — mesmo tipo de divergência que
-- 2026-08_corrige_escrita_projetos.sql corrigiu pra meta_inovacao_projetos). Com
-- RLS ligada e sem policy de UPDATE que case, o Postgres NÃO recusa a operação:
-- ele simplesmente filtra a linha e o UPDATE afeta 0 linhas. O editor pede
-- `.update(...).select().single()`; PostgREST então precisa devolver exatamente 1
-- objeto e, com 0 linhas, responde 406 (PGRST116, "Cannot coerce the result to a
-- single JSON object"). Ou seja: o 406 aqui é o disfarce de "a policy de escrita
-- não deixou passar" — o mesmo problema de RLS/escrita, só que silencioso em vez
-- de um 403 explícito.
--
-- Este script RE-AFIRMA, de forma idempotente, o GRANT e as policies de escrita
-- de corsario_status, exatamente como o padrão da casa manda (PADRAO_TABELA.md).
-- Não mexe na tabela, nas colunas (id/updated_by/atualizado_em), no seed nem no
-- trigger de auditoria (cc_audit_corsario_status), nem em nenhuma outra tabela —
-- é seguro rodar quantas vezes precisar. corsario_criterios (os 19 critérios,
-- só-leitura) NÃO é tocada aqui.
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
    WHERE schemaname = 'public' AND tablename = 'corsario_status'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.corsario_status', pol.policyname);
  END LOOP;
END $$;

-- 2) Garante RLS ligada (idempotente).
ALTER TABLE public.corsario_status ENABLE ROW LEVEL SECURITY;

-- 3) GRANT vem ANTES das policies — sem ele, RLS nunca é avaliado e a escrita é
--    negada na base (PADRAO_TABELA.md, item 3). DELETE fica de fora: o client
--    não exclui linha de corsario_status (2026-08_corsario_edicao.sql só liberou
--    SELECT/INSERT/UPDATE) — igual ao script do Corsário original.
GRANT SELECT, INSERT, UPDATE ON public.corsario_status TO anon, authenticated;

-- 4) Policies — leitura pública, escrita condicionada ao token compartilhado
--    (mesmo token de data/config.js.tokenEscrita — um só pro site inteiro).
CREATE POLICY "cc_select_publico" ON public.corsario_status
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "cc_token_insert" ON public.corsario_status
  FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

CREATE POLICY "cc_token_update" ON public.corsario_status
  FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

-- 5) Recarrega o cache de schema do PostgREST — o script tocou GRANT/policies numa
--    tabela que JÁ EXISTIA (PADRAO_TABELA.md, item 8). Inofensivo se não fosse
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
  AND tablename = 'corsario_status'
ORDER BY cmd, policyname;
