-- ============================================================================
-- Proteção de escrita no Supabase — item 2.1 do plano de melhorias (Prompt 3)
-- ============================================================================
-- Hoje as tabelas abaixo aceitam INSERT/UPDATE/DELETE de qualquer um com a URL do
-- site (RLS permissiva pro role "anon", chave anon exposta no client de propósito —
-- ver comentário em data/config.js / js/config.js). Este script troca a escrita
-- anônima livre por escrita condicionada a um header HTTP customizado:
--
--   x-cc-token: <TOKEN>
--
-- Só quem manda esse header com o valor certo consegue INSERT/UPDATE/DELETE. A
-- LEITURA (SELECT) não muda em nada — continua pública, sem token, pras 10 páginas
-- do painel que só leem continuarem funcionando exatamente como hoje.
--
-- ⚠️ DECISÃO REGISTRADA (ver BACKLOG.md / prompts_code_melhorias_carta_corso.md,
-- Prompt 3): com senha compartilhada e sem usuários individuais, esta é a proteção
-- proporcional possível — impede escrita por bots/curiosos que só têm a URL, mas
-- quem tiver a senha do site consegue, tecnicamente, extrair o token do
-- sessionStorage via DevTools. Autenticação de verdade (Supabase Auth com usuários
-- individuais) fica registrada como evolução futura, não é este script.
--
-- TABELAS AFETADAS (as únicas com escrita client-side no repositório — conferido
-- lendo js/matriz-store.js e plano-acao.html; corsario_criterios/corsario_status são
-- só leitura, não entram aqui):
--   1. plano_acao_atividades         (plano-acao.html — CRUD de atividades por iniciativa)
--   2. meta_inovacao_matriz_demandas (demandas.html, via js/matriz-store.js — Matriz)
--
-- ============================================================================
-- COMO ATIVAR (passo a passo — ver também o rodapé deste arquivo)
-- ============================================================================
--   1. Gere um token aleatório (ex.: `uuidgen` no terminal, ou qualquer gerador de
--      UUID v4 — não precisa ser especificamente um UUID, só precisa ser longo e
--      imprevisível).
--   2. Nas duas seções WITH CHECK/USING abaixo, substitua TODAS as ocorrências de
--      'SUBSTITUIR_PELO_TOKEN_UUID' pelo token gerado (mantendo as aspas simples).
--   3. Rode este script inteiro no SQL Editor do Supabase (projeto "Coisas do
--      Sebrae", o mesmo compartilhado por outros sites — por isso o prefixo
--      meta_inovacao_ nos nomes de tabela, pra não colidir com tabela de outro site).
--   4. Confira o SELECT de verificação no fim do script — deve listar 6 policies
--      novas (INSERT/UPDATE/DELETE × 2 tabelas), todas com o token certo.
--   5. Depois do SQL rodado: troque `tokenEscrita` em data/config.js pro MESMO
--      token (substitui o placeholder "SUBSTITUIR_PELO_TOKEN" lá) e faça o commit.
--      Sem esse passo o site manda um token errado e ninguém mais consegue
--      escrever — plano-acao.html e demandas.html mostram "Sem permissão de
--      escrita — fale com o JR." pra qualquer edição.
--
-- COMO REVERTER (se algo der errado e precisar voltar pro estado de hoje —
-- escrita anônima livre, sem token):
--   Rode, pra cada tabela, os 3 comandos "voltar pro estado anterior" comentados
--   logo depois de cada bloco de policy nova abaixo (removem as policies com
--   token e recriam as antigas, permissivas). Não precisa reverter tokenEscrita
--   em data/config.js — o campo fica inofensivo enquanto a RLS não exigir ele.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) plano_acao_atividades
-- ---------------------------------------------------------------------------

-- 1a) Remove TODAS as policies de INSERT/UPDATE/DELETE existentes nesta tabela,
--     seja qual for o nome delas hoje (geradas pela UI do Supabase, nomes não
--     documentados no repo) — busca dinâmica no catálogo do Postgres em vez de
--     tentar adivinhar o nome, pra não deixar nenhuma policy antiga esquecida
--     coexistindo com a nova (o que reabriria a escrita livre por engano).
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'plano_acao_atividades'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.plano_acao_atividades', pol.policyname);
  END LOOP;
END $$;

-- 1b) Garante RLS ligada (idempotente — se já estava ligada, não faz nada)
ALTER TABLE public.plano_acao_atividades ENABLE ROW LEVEL SECURITY;

-- 1c) Novas policies — só quem manda o header x-cc-token certo escreve
CREATE POLICY "escrita_com_token_insert" ON public.plano_acao_atividades
  FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

CREATE POLICY "escrita_com_token_update" ON public.plano_acao_atividades
  FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

CREATE POLICY "escrita_com_token_delete" ON public.plano_acao_atividades
  FOR DELETE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

-- (as policies de SELECT desta tabela não são tocadas por este script — a leitura
-- continua exatamente como está hoje, pública, sem token)

-- Pra REVERTER só esta tabela (volta pra escrita anônima livre, sem token):
--   DROP POLICY IF EXISTS "escrita_com_token_insert" ON public.plano_acao_atividades;
--   DROP POLICY IF EXISTS "escrita_com_token_update" ON public.plano_acao_atividades;
--   DROP POLICY IF EXISTS "escrita_com_token_delete" ON public.plano_acao_atividades;
--   CREATE POLICY "insert_publico" ON public.plano_acao_atividades FOR INSERT TO anon WITH CHECK (true);
--   CREATE POLICY "update_publico" ON public.plano_acao_atividades FOR UPDATE TO anon USING (true) WITH CHECK (true);
--   CREATE POLICY "delete_publico" ON public.plano_acao_atividades FOR DELETE TO anon USING (true);


-- ---------------------------------------------------------------------------
-- 2) meta_inovacao_matriz_demandas
-- ---------------------------------------------------------------------------

-- 2a) mesma lógica do bloco 1a — remove qualquer policy de escrita existente,
--     não importa o nome
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'meta_inovacao_matriz_demandas'
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_matriz_demandas', pol.policyname);
  END LOOP;
END $$;

-- 2b) Garante RLS ligada (idempotente)
ALTER TABLE public.meta_inovacao_matriz_demandas ENABLE ROW LEVEL SECURITY;

-- 2c) Novas policies — mesmo token das de cima (um token só pro site inteiro,
--     não um por tabela — mais simples de operar com uma senha compartilhada)
CREATE POLICY "escrita_com_token_insert" ON public.meta_inovacao_matriz_demandas
  FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

CREATE POLICY "escrita_com_token_update" ON public.meta_inovacao_matriz_demandas
  FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

CREATE POLICY "escrita_com_token_delete" ON public.meta_inovacao_matriz_demandas
  FOR DELETE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

-- (SELECT desta tabela também intocado — Realtime de leitura, usado por
-- demandas.html pra atualizar a tela quando outra pessoa edita, continua igual)

-- Pra REVERTER só esta tabela:
--   DROP POLICY IF EXISTS "escrita_com_token_insert" ON public.meta_inovacao_matriz_demandas;
--   DROP POLICY IF EXISTS "escrita_com_token_update" ON public.meta_inovacao_matriz_demandas;
--   DROP POLICY IF EXISTS "escrita_com_token_delete" ON public.meta_inovacao_matriz_demandas;
--   CREATE POLICY "insert_publico" ON public.meta_inovacao_matriz_demandas FOR INSERT TO anon WITH CHECK (true);
--   CREATE POLICY "update_publico" ON public.meta_inovacao_matriz_demandas FOR UPDATE TO anon USING (true) WITH CHECK (true);
--   CREATE POLICY "delete_publico" ON public.meta_inovacao_matriz_demandas FOR DELETE TO anon USING (true);


-- ---------------------------------------------------------------------------
-- Verificação — rode depois do script pra conferir que ficou como esperado.
-- Deve listar 6 linhas (3 comandos × 2 tabelas), todas com o TOKEN certo já
-- substituído aparecendo dentro de "qual" (a condição da policy).
-- ---------------------------------------------------------------------------
SELECT schemaname, tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('plano_acao_atividades', 'meta_inovacao_matriz_demandas')
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
ORDER BY tablename, cmd;
