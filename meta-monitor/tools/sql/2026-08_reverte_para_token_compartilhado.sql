-- Reverte escrita autenticada (v0.28.0/v0.29.0, modelo authenticated + cc_eh_editor())
-- pro token compartilhado (v0.27.x, header x-cc-token via role anon). Faz par com
-- data/config.js/v0.30.0 e a remoção de js/auth.js das telas. Ver CHANGELOG.md e o
-- runbook que originou essa reversão (histórico completo em docs/SEGURANCA_ESCRITA_AUTH.md).
--
-- Token novo (gerado em 2026-08-20, NÃO reaproveita o antigo 90bb649c-… que ficou
-- exposto em Git/capturas): a7c11b08-5a62-453c-ba8d-6bd0680e2f90.
-- Precisa bater 1:1 com data/config.js:tokenEscrita — se um mudar, o outro muda junto.
--
-- Auto-detecta toda tabela hoje no modelo escrita_editor_* e troca por cc_token_*.
-- cc_select_publico (leitura pública) NÃO é tocada — segue cobrindo anon+authenticated.

DO $$
DECLARE
  t text;
  alvos text[];
BEGIN
  SELECT array_agg(DISTINCT tablename) INTO alvos
  FROM pg_policies
  WHERE schemaname = 'public' AND policyname LIKE 'escrita_editor_%';

  IF alvos IS NULL THEN
    RAISE NOTICE 'Nenhuma tabela no modelo authenticated encontrada — nada a reverter.';
    RETURN;
  END IF;

  RAISE NOTICE 'Tabelas a reverter: %', alvos;

  FOREACH t IN ARRAY alvos LOOP
    EXECUTE format('DROP POLICY IF EXISTS "escrita_editor_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "escrita_editor_update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "escrita_editor_delete" ON public.%I', t);

    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO anon, authenticated', t);

    EXECUTE format(
      'CREATE POLICY "cc_token_insert" ON public.%I FOR INSERT TO anon ' ||
      'WITH CHECK (current_setting(''request.headers'', true)::json->>''x-cc-token'' = ''a7c11b08-5a62-453c-ba8d-6bd0680e2f90'')', t);
    EXECUTE format(
      'CREATE POLICY "cc_token_update" ON public.%I FOR UPDATE TO anon ' ||
      'USING (current_setting(''request.headers'', true)::json->>''x-cc-token'' = ''a7c11b08-5a62-453c-ba8d-6bd0680e2f90'') ' ||
      'WITH CHECK (current_setting(''request.headers'', true)::json->>''x-cc-token'' = ''a7c11b08-5a62-453c-ba8d-6bd0680e2f90'')', t);
    EXECUTE format(
      'CREATE POLICY "cc_token_delete" ON public.%I FOR DELETE TO anon ' ||
      'USING (current_setting(''request.headers'', true)::json->>''x-cc-token'' = ''a7c11b08-5a62-453c-ba8d-6bd0680e2f90'')', t);
  END LOOP;
END $$;

-- Verificação — todas as 9 tabelas (meta_inovacao_plano_acoes, _agenda_encontros,
-- _pessoas, _urc_lideranca, _urc_canais_responsaveis, corsario_status,
-- meta_inovacao_projetos, meta_inovacao_matriz_demandas, plano_acao_atividades) devem
-- aparecer só com cc_token_insert/update/delete (role anon) + cc_select_publico.
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND cmd IN ('INSERT','UPDATE','DELETE')
ORDER BY tablename, cmd;
