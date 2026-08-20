-- ============================================================================
-- Corrige leitura pública quebrada para editores logados (pós Supabase Auth)
-- ============================================================================
-- BUG: JR. (editor cadastrado em meta_inovacao_editores, allowlist de
-- tools/sql/2026-08_auth_escrita.sql) loga em editor.html, muda o Status ou o Prazo de
-- uma linha do conjunto "Plano de ação — status e prazos" (ex.: CMT-01) e a UI mostra
-- "Sem permissão de escrita — fale com o JR." — mesmo ele SENDO o JR, com a barra de
-- auth confirmando "editor" e a região desbloqueada (CC_AUTH.podeEditar() = true).
--
-- CAUSA RAIZ (confirmada nas policies, não é chute):
--   1. tools/sql/2026-08_auth_escrita.sql (seção 3) trocou as policies de
--      INSERT/UPDATE/DELETE de "x-cc-token" para "authenticated + cc_eh_editor()" em
--      toda tabela auto-detectada — INCLUINDO meta_inovacao_plano_acoes. Até aqui,
--      certo: com JR logado, a UPDATE em si passa (USING/WITH CHECK = cc_eh_editor(),
--      true pra ele) e a linha É gravada no Postgres.
--   2. Mas esse script deliberadamente NÃO tocou a policy de SELECT ("SELECT não é
--      tocado (segue público)", comentário na seção 3) — e toda tabela migrada pelo
--      padrão do projeto (tools/sql/PADRAO_TABELA.md item 4; ver
--      tools/sql/2026-08_plano.sql:110-112 pra meta_inovacao_plano_acoes) criou a
--      policy de SELECT como "cc_select_publico ... FOR SELECT TO anon USING (true)"
--      — role FIXO "anon", não "public".
--   3. js/db-plano.js (DB_PLANO.salvar) faz
--      `.update(patch).eq("id", id).select().single()` — pede a linha de volta depois
--      de gravar (RETURNING). No Postgres, RETURNING de um UPDATE/INSERT/DELETE
--      protegido por RLS É FILTRADO PELAS POLICIES DE SELECT da mesma role da sessão
--      (doc oficial do Postgres, capítulo Row Security Policies) — não basta a UPDATE
--      ter passado.
--   4. Um editor logado (JR.) executa a query como role `authenticated` (o
--      PostgREST troca de role pelo JWT da sessão), não `anon`. Como
--      "cc_select_publico" só vale `TO anon`, a RETURNING não encontra NENHUMA policy
--      de SELECT aplicável pra `authenticated` → devolve 0 linhas, mesmo com a UPDATE
--      tendo gravado de verdade. O supabase-js, ao pedir objeto único (`.single()`,
--      header `Accept: application/vnd.pgrst.object+json`) e receber 0 linhas, devolve
--      erro `PGRST116` ("JSON object requested, multiple (or no) rows returned"),
--      HTTP 406 — um erro "disfarçado": parece que a escrita falhou/foi negada, mas na
--      verdade só a RE-LEITURA da linha gravada é que não tem policy pra `authenticated`.
--      (js/supabase.js:ehErroDePermissao não reconhece esse formato — ver o commit
--      desta correção pro ajuste companheiro no front, que dá um rótulo honesto pra
--      esse caso em vez de confundir com falta de permissão de verdade.)
--
-- Mesma classe de bug em TODA tabela que passou por 2026-08_auth_escrita.sql e segue o
-- padrão "cc_select_publico ... TO anon USING (true)" — não só meta_inovacao_plano_acoes
-- (confirmado pelo mesmo padrão .update()...select().single() em js/db-agenda.js,
-- js/db-pessoas.js, js/db-projetos.js, js/db-urc.js, js/db-corsario.js). Corrigir só
-- meta_inovacao_plano_acoes deixaria o mesmo estouro esperando qualquer editor logado
-- salvar em Agenda/Pessoas/Projetos/URC — este script corrige a causa raiz em toda
-- tabela que se encaixa no padrão, não só a reportada.
--
-- CORREÇÃO (sem widening): a leitura JÁ era pra ser 100% pública, com ou sem login
-- ("leitura pública, sem login" — docs/SEGURANCA_ESCRITA_AUTH.md linha 5,
-- 2026-08_auth_escrita.sql linha 11). `USING (true)` não muda — só o escopo de role
-- passa a cobrir `authenticated` além de `anon`, fechando o gap sem abrir NADA que já
-- não estivesse aberto (dado já era 100% público pra quem não loga; agora também é
-- público pra quem loga, que é exatamente a intenção documentada).
--
-- AUTO-DETECÇÃO (mesmo estilo de 2026-08_auth_escrita.sql seção 3): só mexe em
-- policies chamadas exatamente "cc_select_publico", com `USING (true)` e hoje restritas
-- só à role anon — não toca em exceções documentadas (ex.: meta_inovacao_audit_log usa
-- "cc_token_select", nome diferente, fica de fora automaticamente) nem em tabelas fora
-- do padrão (plano_acao_atividades/meta_inovacao_matriz_demandas, cuja policy de SELECT
-- não tem esse nome — ficam de fora até serem migradas pro padrão cc_select_publico).
--
-- ORDEM: rodar depois de 2026-08_auth_escrita.sql (já deve estar aplicado — é o que
-- criou a lacuna). REVERSÍVEL: seção "COMO REVERTER" no fim.
-- ============================================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname = 'cc_select_publico'
      AND cmd = 'SELECT'
      AND coalesce(qual, '') = 'true'
      AND roles = '{anon}'::name[]
  LOOP
    EXECUTE format('DROP POLICY "cc_select_publico" ON public.%I', pol.tablename);
    EXECUTE format(
      'CREATE POLICY "cc_select_publico" ON public.%I FOR SELECT TO anon, authenticated USING (true)',
      pol.tablename);
    RAISE NOTICE 'cc_select_publico corrigida (agora TO anon, authenticated) em: %', pol.tablename;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Verificação — rode e confira à mão
-- ---------------------------------------------------------------------------
-- (a) toda "cc_select_publico" deve listar {anon,authenticated} em "roles":
SELECT tablename, policyname, roles
FROM pg_policies
WHERE schemaname = 'public' AND policyname = 'cc_select_publico'
ORDER BY tablename;

-- (b) reprodução do bug relatado — confirma que a RETURNING do UPDATE volta com a
--     linha (não mais 0 linhas) pra role authenticated. Rode logado como um editor
--     cadastrado em meta_inovacao_editores (painel Supabase > SQL Editor > "Run as" não
--     simula role de sessão HTTP; o teste real é repetir o passo a passo no navegador:
--     editor.html → login → mudar Status de CMT-01 → deve marcar "salvo", não o aviso
--     amarelo).

-- ============================================================================
-- COMO REVERTER (volta pra SELECT só-anon; NÃO recomendado — reabre o bug para todo
-- editor logado, inclusive o JR.)
-- ============================================================================
--   DO $$
--   DECLARE pol RECORD;
--   BEGIN
--     FOR pol IN
--       SELECT tablename FROM pg_policies
--       WHERE schemaname='public' AND policyname='cc_select_publico'
--         AND roles = '{anon,authenticated}'::name[]
--     LOOP
--       EXECUTE format('DROP POLICY "cc_select_publico" ON public.%I', pol.tablename);
--       EXECUTE format('CREATE POLICY "cc_select_publico" ON public.%I FOR SELECT TO anon USING (true)', pol.tablename);
--     END LOOP;
--   END $$;
-- ============================================================================
