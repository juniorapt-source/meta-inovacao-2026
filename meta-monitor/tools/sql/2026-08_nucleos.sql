-- ============================================================================
-- Golden record de cadastros de referência — Camada 0, item 0.1 (catálogo-base)
-- ============================================================================
-- Cria meta_inovacao_nucleos: catálogo dos 5 núcleos da Unidade de Inovação. Hoje
-- "núcleo" é texto livre repetido em várias tabelas (meta_inovacao_projetos.nucleo,
-- corsario_status.nucleo, o array NUCLEOS_VALIDOS hardcoded em editor.html...) — esta
-- tabela é o primeiro passo de PLANO_EXECUCAO_GOLDEN_RECORD.md / Camada 0: um lugar
-- único de onde a lista nasce, pra Camada 2 poder acrescentar nucleo_id FK nas tabelas
-- que hoje só têm o texto. Esta migração NÃO mexe em nenhuma tabela existente — só
-- cria a nova e semeia com os 5 valores atuais de NUCLEOS_VALIDOS (editor.html).
--
-- Segue tools/sql/PADRAO_TABELA.md à risca (mesmo padrão de escrita por token
-- compartilhado x-cc-token do resto do site — nenhum motivo pra esta tabela ser
-- diferente): RLS ligada, GRANT antes das policies, cc_select_publico pra leitura,
-- cc_token_insert/cc_token_update pra escrita, soft delete via deleted_at.
--
-- IDEMPOTENTE: pode rodar de novo — CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE
-- FUNCTION, DROP POLICY/TRIGGER antes de recriar, seed com WHERE NOT EXISTS.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Tabela
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_inovacao_nucleos (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome       text NOT NULL,
  ordem      int NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

-- unique parcial (não em cima de linha soft-deletada) — permite recriar um núcleo com
-- o mesmo nome depois de removido, sem colidir com a linha antiga.
CREATE UNIQUE INDEX IF NOT EXISTS meta_inovacao_nucleos_nome_ativo_idx
  ON public.meta_inovacao_nucleos (nome) WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 2) Trigger de updated_at (reaproveita a função — CREATE OR REPLACE é idempotente)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cc_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cc_touch_updated_at_nucleos ON public.meta_inovacao_nucleos;
CREATE TRIGGER cc_touch_updated_at_nucleos
  BEFORE UPDATE ON public.meta_inovacao_nucleos
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
    WHERE schemaname = 'public' AND tablename = 'meta_inovacao_nucleos'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_nucleos', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.meta_inovacao_nucleos ENABLE ROW LEVEL SECURITY;

-- GRANT vem ANTES das policies — sem ele, RLS nunca chega a ser avaliado.
GRANT SELECT, INSERT, UPDATE ON public.meta_inovacao_nucleos TO anon, authenticated;

CREATE POLICY "cc_select_publico" ON public.meta_inovacao_nucleos
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "cc_token_insert" ON public.meta_inovacao_nucleos
  FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90');

CREATE POLICY "cc_token_update" ON public.meta_inovacao_nucleos
  FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90');

-- Pra REVERTER (só faz sentido logo depois de criar, antes de qualquer edição real):
--   DROP TABLE IF EXISTS public.meta_inovacao_nucleos;
--   DROP TRIGGER IF EXISTS cc_touch_updated_at_nucleos ON public.meta_inovacao_nucleos;


-- ---------------------------------------------------------------------------
-- 4) Seed — os 5 núcleos atuais, mesma ordem/grafia de NUCLEOS_VALIDOS em
--    editor.html (que por sua vez tem que bater com tools/validar_dados.py).
-- ---------------------------------------------------------------------------
INSERT INTO public.meta_inovacao_nucleos (nome, ordem)
SELECT * FROM (VALUES
  ('Inovação para Competitividade', 1),
  ('Inovação Territorial', 2),
  ('Startups', 3),
  ('Tecnologias Portadoras de Futuro', 4),
  ('Gestão do Conhecimento e Processos', 5)
) AS seed(nome, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM public.meta_inovacao_nucleos n
  WHERE n.nome = seed.nome AND n.deleted_at IS NULL
);


-- ---------------------------------------------------------------------------
-- Verificação — deve devolver 5.
-- ---------------------------------------------------------------------------
SELECT count(*) AS total_nucleos FROM public.meta_inovacao_nucleos WHERE deleted_at IS NULL;
SELECT nome, ordem FROM public.meta_inovacao_nucleos WHERE deleted_at IS NULL ORDER BY ordem;
