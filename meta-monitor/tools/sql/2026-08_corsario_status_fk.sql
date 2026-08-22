-- ============================================================================
-- Golden record de cadastros de referência — Camada 2, item 2.7
-- ============================================================================
-- ALTER corsario_status: + projeto_id FK -> meta_inovacao_projetos(id) nullable,
-- + nucleo_id FK -> meta_inovacao_nucleos(id) nullable. Convive com
-- `iniciativa`/`nucleo` (texto) já existentes.
--
-- corsario_status é tabela LEGADA (de antes de tools/sql/PADRAO_TABELA.md — não leva
-- prefixo meta_inovacao_, não tem deleted_at/soft delete) e este script já a alterou
-- antes (2026-08_corsario_edicao.sql, que deu a ela id/updated_by/RLS por token). Por
-- isso este script segue o MESMO estilo defensivo daquele: IF NOT EXISTS em tudo, sem
-- presumir coluna que não foi criada por um script deste repo.
--
-- A divergência histórica 27×28 ("Salas do Empreendedor") já foi reconciliada
-- (docs/GOVERNANCA_GOLDEN_RECORD.md, Camada 4 — tools/sql/2026-08_remover_salas_empreendedor.sql
-- já rodado em produção): corsario_status deveria ter 27 iniciativas, as mesmas do
-- golden record. Por isso a verificação abaixo espera 0 órfãos, não 1 — se aparecer
-- algum, é uma divergência NOVA desde aquela reconciliação (não a antiga já resolvida),
-- e vale investigar antes de seguir pra Camada 3.
--
-- ORDEM DE EXECUÇÃO: depois de 2026-08_corsario_edicao.sql (garante id/updated_by),
-- 2026-08_migracao_modo_edicao.sql (cria meta_inovacao_projetos) e 2026-08_nucleos.sql
-- (Camada 0). Idealmente também depois de 2026-08_remover_salas_empreendedor.sql —
-- já rodado, mas o script abaixo não presume isso e simplesmente reporta o que achar.
-- IDEMPOTENTE.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.corsario_status') IS NULL THEN
    RAISE EXCEPTION 'corsario_status não existe.';
  END IF;
  IF to_regclass('public.meta_inovacao_projetos') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_projetos não existe — rode tools/sql/2026-08_migracao_modo_edicao.sql antes deste script.';
  END IF;
  IF to_regclass('public.meta_inovacao_nucleos') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_nucleos não existe — rode tools/sql/2026-08_nucleos.sql (Camada 0) antes deste script.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'corsario_status' AND column_name = 'id'
  ) THEN
    RAISE EXCEPTION 'corsario_status.id não existe — rode tools/sql/2026-08_corsario_edicao.sql antes deste script.';
  END IF;
END $$;

ALTER TABLE public.corsario_status
  ADD COLUMN IF NOT EXISTS projeto_id bigint REFERENCES public.meta_inovacao_projetos(id),
  ADD COLUMN IF NOT EXISTS nucleo_id  bigint REFERENCES public.meta_inovacao_nucleos(id);

UPDATE public.corsario_status s
SET projeto_id = p.id
FROM public.meta_inovacao_projetos p
WHERE p.iniciativa = s.iniciativa
  AND p.deleted_at IS NULL
  AND s.projeto_id IS DISTINCT FROM p.id;

UPDATE public.corsario_status s
SET nucleo_id = n.id
FROM public.meta_inovacao_nucleos n
WHERE n.nome = s.nucleo
  AND n.deleted_at IS NULL
  AND s.nucleo_id IS DISTINCT FROM n.id;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verificação
-- ============================================================================
-- (a) iniciativas SEM projeto_id — esperado 0 linhas (a divergência 27×28 antiga
--     já foi reconciliada; qualquer linha aqui é órfão NOVO, não o "Salas do
--     Empreendedor" de antes):
SELECT DISTINCT iniciativa
FROM public.corsario_status
WHERE projeto_id IS NULL
ORDER BY iniciativa;

-- (b) núcleos SEM nucleo_id — esperado 0 linhas:
SELECT DISTINCT nucleo
FROM public.corsario_status
WHERE nucleo_id IS NULL
ORDER BY nucleo;

-- (c) contagem geral pra conferência:
SELECT count(DISTINCT iniciativa) AS total_iniciativas,
       count(DISTINCT iniciativa) FILTER (WHERE projeto_id IS NOT NULL) AS iniciativas_com_projeto_id
FROM public.corsario_status;

-- Pra REVERTER:
--   ALTER TABLE public.corsario_status DROP COLUMN IF EXISTS projeto_id, DROP COLUMN IF EXISTS nucleo_id;
