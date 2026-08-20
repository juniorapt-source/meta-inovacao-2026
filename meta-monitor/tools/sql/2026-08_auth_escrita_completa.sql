-- ============================================================================
-- Fecha a migração pra Auth: as 4 tabelas que 2026-08_auth_escrita.sql não pegou
-- ============================================================================
-- CONTEXTO: 2026-08_auth_escrita.sql migrou a escrita pra "authenticated +
-- cc_eh_editor()" auto-detectando tabelas com policy de escrita citando
-- 'x-cc-token'. Rodando de novo o levantamento em produção (Database > Policies),
-- 5 tabelas migraram certo (meta_inovacao_plano_acoes, _agenda_encontros,
-- _pessoas, _urc_lideranca, _urc_canais_responsaveis) — mas 4 tabelas ficaram
-- pra trás, cada uma por um motivo diferente:
--
--   - corsario_status e meta_inovacao_projetos: foram migradas certo, mas dois
--     fixes de produção de 18/ago (c89b68a, d8d9253) recriaram as policies
--     cc_token_insert/cc_token_update nelas pra destravar o site ANTIGO (sem
--     login) — sem saber que a migração pra Auth também as tinha alcançado.
--     Ficaram "presas" no modelo de token.
--   - meta_inovacao_matriz_demandas: nunca teve policy citando 'x-cc-token'
--     no texto (usa uma única policy "ALL" pra anon, de uma consolidação
--     posterior de feature) — o auto-detect por LIKE não pegou.
--   - plano_acao_atividades: está com policies OPEN (role "public", sem token
--     nenhum) de antes até do modelo de token — nunca teve 'x-cc-token' pra
--     detectar. Ver nota de segurança no commit desta correção.
--
-- POR QUE PRECISA FECHAR AGORA: o front novo (js/auth.js, Fase 2) já não manda
-- mais x-cc-token — só a sessão do Supabase Auth. Publicar esse front sem
-- migrar essas 4 tabelas também QUEBRARIA a escrita nelas (que hoje funciona).
-- Este script fecha a lacuna pra TODAS ficarem no mesmo modelo antes do front
-- novo ir ao ar.
--
-- ORDEM: rodar depois de 2026-08_auth_escrita_cadastro_editor.sql (senão
-- ninguém, nem o JR., escreve em NENHUMA tabela até a allowlist ter alguém).
-- REVERSÍVEL: seção "COMO REVERTER" no fim (volta pro estado observado hoje).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) corsario_status
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "cc_token_insert" ON public.corsario_status;
DROP POLICY IF EXISTS "cc_token_update" ON public.corsario_status;

GRANT SELECT, INSERT, UPDATE ON public.corsario_status TO anon, authenticated;

CREATE POLICY "escrita_editor_insert" ON public.corsario_status
  FOR INSERT TO authenticated WITH CHECK (public.cc_eh_editor());
CREATE POLICY "escrita_editor_update" ON public.corsario_status
  FOR UPDATE TO authenticated USING (public.cc_eh_editor()) WITH CHECK (public.cc_eh_editor());
CREATE POLICY "escrita_editor_delete" ON public.corsario_status
  FOR DELETE TO authenticated USING (public.cc_eh_editor());

-- ---------------------------------------------------------------------------
-- 2) meta_inovacao_projetos
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "cc_token_insert" ON public.meta_inovacao_projetos;
DROP POLICY IF EXISTS "cc_token_update" ON public.meta_inovacao_projetos;

GRANT SELECT, INSERT, UPDATE ON public.meta_inovacao_projetos TO anon, authenticated;

CREATE POLICY "escrita_editor_insert" ON public.meta_inovacao_projetos
  FOR INSERT TO authenticated WITH CHECK (public.cc_eh_editor());
CREATE POLICY "escrita_editor_update" ON public.meta_inovacao_projetos
  FOR UPDATE TO authenticated USING (public.cc_eh_editor()) WITH CHECK (public.cc_eh_editor());
CREATE POLICY "escrita_editor_delete" ON public.meta_inovacao_projetos
  FOR DELETE TO authenticated USING (public.cc_eh_editor());

-- ---------------------------------------------------------------------------
-- 3) meta_inovacao_matriz_demandas
-- ---------------------------------------------------------------------------
-- única policy hoje ("..._anon_all", ALL, role anon) cobria SELECT+INSERT+
-- UPDATE+DELETE de uma vez — troca pelo padrão de 2 grupos (leitura pública +
-- escrita de editor) igual às outras tabelas.
DROP POLICY IF EXISTS "meta_inovacao_matriz_demandas_anon_all" ON public.meta_inovacao_matriz_demandas;

GRANT SELECT, INSERT, UPDATE ON public.meta_inovacao_matriz_demandas TO anon, authenticated;

CREATE POLICY "cc_select_publico" ON public.meta_inovacao_matriz_demandas
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "escrita_editor_insert" ON public.meta_inovacao_matriz_demandas
  FOR INSERT TO authenticated WITH CHECK (public.cc_eh_editor());
CREATE POLICY "escrita_editor_update" ON public.meta_inovacao_matriz_demandas
  FOR UPDATE TO authenticated USING (public.cc_eh_editor()) WITH CHECK (public.cc_eh_editor());
CREATE POLICY "escrita_editor_delete" ON public.meta_inovacao_matriz_demandas
  FOR DELETE TO authenticated USING (public.cc_eh_editor());

-- ---------------------------------------------------------------------------
-- 4) plano_acao_atividades
-- ---------------------------------------------------------------------------
-- NOTA DE SEGURANÇA: as policies atuais ("delete all"/"read all"/"update
-- all"/"write all", role "public", sem check nenhum, mais uma
-- "..._anon_all" redundante) deixam esta tabela gravável por QUALQUER
-- requisição com a anon key, sem token e sem login — de uma configuração
-- anterior ao próprio modelo de token (2026-08_protecao_escrita.sql nunca
-- incluiu GRANT pra esta tabela, então essas policies "public" provavelmente
-- vêm de antes desse script). A troca abaixo FECHA esse gap (authenticated +
-- allowlist), não abre nada nem widening.
DROP POLICY IF EXISTS "delete all" ON public.plano_acao_atividades;
DROP POLICY IF EXISTS "read all" ON public.plano_acao_atividades;
DROP POLICY IF EXISTS "update all" ON public.plano_acao_atividades;
DROP POLICY IF EXISTS "write all" ON public.plano_acao_atividades;
DROP POLICY IF EXISTS "plano_acao_atividades_anon_all" ON public.plano_acao_atividades;

GRANT SELECT, INSERT, UPDATE ON public.plano_acao_atividades TO anon, authenticated;

CREATE POLICY "cc_select_publico" ON public.plano_acao_atividades
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "escrita_editor_insert" ON public.plano_acao_atividades
  FOR INSERT TO authenticated WITH CHECK (public.cc_eh_editor());
CREATE POLICY "escrita_editor_update" ON public.plano_acao_atividades
  FOR UPDATE TO authenticated USING (public.cc_eh_editor()) WITH CHECK (public.cc_eh_editor());
CREATE POLICY "escrita_editor_delete" ON public.plano_acao_atividades
  FOR DELETE TO authenticated USING (public.cc_eh_editor());

-- recarrega o cache de schema do PostgREST (paranoia documentada em
-- tools/sql/PADRAO_TABELA.md item 8 / incidente v0.22.1 — não é estritamente
-- necessário pra troca de policy, só de coluna, mas custa nada e evita dúvida).
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Verificação — rode e confira à mão
-- ---------------------------------------------------------------------------
-- (a) toda tabela abaixo deve mostrar só escrita_editor_insert/update/delete
--     (role authenticated) + cc_select_publico (role anon,authenticated) —
--     nenhuma cc_token_*/"...anon_all"/"delete all" etc. sobrando:
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('corsario_status', 'meta_inovacao_projetos',
                     'meta_inovacao_matriz_demandas', 'plano_acao_atividades')
ORDER BY tablename, cmd;

-- (b) não pode sobrar nada citando x-cc-token nessas 4 tabelas:
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('corsario_status', 'meta_inovacao_projetos',
                     'meta_inovacao_matriz_demandas', 'plano_acao_atividades')
  AND (coalesce(qual,'') LIKE '%x-cc-token%' OR coalesce(with_check,'') LIKE '%x-cc-token%');
-- ^ deve vir VAZIO.

-- ============================================================================
-- COMO REVERTER (volta pro estado observado antes deste script — mistura de
-- token e "public" aberto; NÃO recomendado, é o estado que gerou o gap de
-- segurança de plano_acao_atividades. Só usar em emergência.)
-- ============================================================================
-- corsario_status / meta_inovacao_projetos:
--   DROP POLICY IF EXISTS "escrita_editor_insert" ON public.<tabela>;
--   DROP POLICY IF EXISTS "escrita_editor_update" ON public.<tabela>;
--   DROP POLICY IF EXISTS "escrita_editor_delete" ON public.<tabela>;
--   CREATE POLICY "cc_token_insert" ON public.<tabela> FOR INSERT TO anon
--     WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');
--   CREATE POLICY "cc_token_update" ON public.<tabela> FOR UPDATE TO anon
--     USING (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108')
--     WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');
-- meta_inovacao_matriz_demandas / plano_acao_atividades: recriar as policies
--   antigas exige o texto exato de antes — não documentado aqui de propósito
--   (o estado antigo tinha o gap de segurança do "public" sem check; reverter
--   isso merece decisão explícita, não um comando pronto pra copiar e colar).
-- ============================================================================
