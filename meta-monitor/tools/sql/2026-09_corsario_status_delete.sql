-- ============================================================================
-- Libera DELETE em corsario_status (por token) — sincronia projeto removido → Corsário
-- ============================================================================
-- Remover um projeto no editor (aba Projetos) faz soft-delete em meta_inovacao_projetos,
-- mas corsario.html monta a lista de iniciativas só a partir de corsario_status. Sem
-- apagar as linhas de lá, o projeto removido continuava aparecendo no Corsário.
-- js/db-corsario.js#removerIniciativa apaga essas linhas (hard delete: corsario_status
-- não tem deleted_at) e precisa desta permissão.
--
-- ORDEM: depois de 2026-08_corsario_edicao.sql. Rodar no SQL Editor do Supabase.
-- A trigger cc_audit_corsario_status já registra o DELETE em meta_inovacao_audit_log.
-- ============================================================================

GRANT DELETE ON public.corsario_status TO anon, authenticated;

DROP POLICY IF EXISTS "cc_token_delete" ON public.corsario_status;
CREATE POLICY "cc_token_delete" ON public.corsario_status FOR DELETE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

NOTIFY pgrst, 'reload schema';

-- Limpeza única do que já ficou órfão (projeto removido no golden, linhas ainda aqui).
-- Confira antes de apagar:
SELECT s.iniciativa, count(*) AS linhas
FROM public.corsario_status s
WHERE NOT EXISTS (
  SELECT 1 FROM public.meta_inovacao_projetos p
  WHERE p.deleted_at IS NULL AND lower(trim(p.iniciativa)) = lower(trim(s.iniciativa))
)
GROUP BY s.iniciativa;

-- Se a lista acima for só o que deve sumir (ex.: ALI Academy), descomente e rode:
-- DELETE FROM public.corsario_status s
-- WHERE NOT EXISTS (
--   SELECT 1 FROM public.meta_inovacao_projetos p
--   WHERE p.deleted_at IS NULL AND lower(trim(p.iniciativa)) = lower(trim(s.iniciativa))
-- );

-- Reverter:
--   DROP POLICY IF EXISTS "cc_token_delete" ON public.corsario_status;
--   REVOKE DELETE ON public.corsario_status FROM anon, authenticated;
