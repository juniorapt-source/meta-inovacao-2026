-- ============================================================================
-- Golden record de cadastros de referência — Camada 0, item 0.3 (catálogo-base)
-- ============================================================================
-- Cria meta_inovacao_coletivos: catálogo dos "responsáveis coletivos" (não uma
-- pessoa física) usados hoje em window.DB.responsaveis + js/responsaveis.js
-- (ex.: "jr", "comite", "gestores" — mistura pessoa e coletivo numa lista estática).
-- Decisão fechada em 22/08/2026 (PROPOSTA_ESQUEMA_CADASTROS_REFERENCIA.md, seção
-- "Decisões" — Opção A): coletivos ficam em tabela PRÓPRIA, separada de
-- meta_inovacao_pessoas, não como linha de pessoa com um campo "tipo". Isso é o que
-- permite meta_inovacao_plano_responsaveis (Camada 2) ter duas FKs nullable
-- (pessoa_id/coletivo_id) com CHECK de exatamente uma preenchida.
--
-- Esta migração NÃO mexe em nenhuma tabela existente — só cria a nova e semeia com
-- os 5 coletivos do desenho fechado. js/responsaveis.js e
-- meta_inovacao_plano_acoes.responsavel_id continuam como estão até a Camada 2.
--
-- Segue tools/sql/PADRAO_TABELA.md: RLS ligada, GRANT antes das policies,
-- cc_select_publico pra leitura, cc_token_insert/cc_token_update pra escrita
-- (mesmo token compartilhado x-cc-token do resto do site), soft delete.
--
-- IDEMPOTENTE: pode rodar de novo — CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE
-- FUNCTION, DROP POLICY/TRIGGER antes de recriar, seed com WHERE NOT EXISTS.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Tabela
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_inovacao_coletivos (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome       text NOT NULL,
  ordem      int NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE UNIQUE INDEX IF NOT EXISTS meta_inovacao_coletivos_nome_ativo_idx
  ON public.meta_inovacao_coletivos (nome) WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 2) Trigger de updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cc_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cc_touch_updated_at_coletivos ON public.meta_inovacao_coletivos;
CREATE TRIGGER cc_touch_updated_at_coletivos
  BEFORE UPDATE ON public.meta_inovacao_coletivos
  FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 3) RLS — SELECT público, escrita só com x-cc-token certo (PADRAO_TABELA.md)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'meta_inovacao_coletivos'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_coletivos', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.meta_inovacao_coletivos ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.meta_inovacao_coletivos TO anon, authenticated;

CREATE POLICY "cc_select_publico" ON public.meta_inovacao_coletivos
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "cc_token_insert" ON public.meta_inovacao_coletivos
  FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90');

CREATE POLICY "cc_token_update" ON public.meta_inovacao_coletivos
  FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90');

-- Pra REVERTER (só faz sentido logo depois de criar, antes de qualquer edição real):
--   DROP TABLE IF EXISTS public.meta_inovacao_coletivos;
--   DROP TRIGGER IF EXISTS cc_touch_updated_at_coletivos ON public.meta_inovacao_coletivos;


-- ---------------------------------------------------------------------------
-- 4) Seed — os 5 coletivos do desenho fechado em 22/08/2026.
-- ---------------------------------------------------------------------------
INSERT INTO public.meta_inovacao_coletivos (nome, ordem)
SELECT * FROM (VALUES
  ('Comitê', 1),
  ('URC', 2),
  ('Coordenadores', 3),
  ('Gestores dos projetos', 4),
  ('Soluções', 5)
) AS seed(nome, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM public.meta_inovacao_coletivos c
  WHERE c.nome = seed.nome AND c.deleted_at IS NULL
);


-- ---------------------------------------------------------------------------
-- Verificação — deve devolver 5.
-- ---------------------------------------------------------------------------
SELECT count(*) AS total_coletivos FROM public.meta_inovacao_coletivos WHERE deleted_at IS NULL;
SELECT nome, ordem FROM public.meta_inovacao_coletivos WHERE deleted_at IS NULL ORDER BY ordem;
