-- ============================================================================
-- Golden record de cadastros de referência — Camada 2, item 2.3
-- ============================================================================
-- ALTER meta_inovacao_urc_lideranca: + pessoa_id FK -> meta_inovacao_pessoas(id),
-- convivendo com nome/papel/email (texto) já existentes. Popula casando por
-- `nome` EXATO: os 3 líderes da URC (Enio, Milva, Iuri Barbosa de Andrade) foram
-- inseridos em meta_inovacao_pessoas no item 1.3 com o `nome` idêntico ao texto
-- original de data/urc.js/meta_inovacao_urc_lideranca — por isso o casamento aqui
-- é por igualdade simples, sem alias (diferente do que 2.2/2.6 vão precisar).
--
-- ORDEM DE EXECUÇÃO: depois de 2026-08_migracao_modo_edicao.sql (cria
-- meta_inovacao_urc_lideranca) e 2026-08_pessoas_golden.sql (Camada 1, item 1.3 —
-- é quem insere as linhas de Enio/Milva/Iuri em meta_inovacao_pessoas).
-- IDEMPOTENTE.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.meta_inovacao_urc_lideranca') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_urc_lideranca não existe — rode tools/sql/2026-08_migracao_modo_edicao.sql antes deste script.';
  END IF;
  IF to_regclass('public.meta_inovacao_pessoas') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_pessoas não existe — rode tools/sql/2026-08_migracao_modo_edicao.sql antes deste script.';
  END IF;
END $$;

ALTER TABLE public.meta_inovacao_urc_lideranca
  ADD COLUMN IF NOT EXISTS pessoa_id bigint REFERENCES public.meta_inovacao_pessoas(id);

UPDATE public.meta_inovacao_urc_lideranca l
SET pessoa_id = p.id
FROM public.meta_inovacao_pessoas p
WHERE p.nome = l.nome
  AND p.grupo = 'URC'
  AND p.deleted_at IS NULL
  AND l.deleted_at IS NULL
  AND l.pessoa_id IS DISTINCT FROM p.id;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verificação
-- ============================================================================
-- (a) cobertura — esperado 0 linhas (os 3 líderes deveriam casar):
SELECT id, nome, papel
FROM public.meta_inovacao_urc_lideranca
WHERE deleted_at IS NULL AND pessoa_id IS NULL;

-- (b) conferência visual:
SELECT l.nome AS nome_lideranca, p.nome_completo, p.email
FROM public.meta_inovacao_urc_lideranca l
LEFT JOIN public.meta_inovacao_pessoas p ON p.id = l.pessoa_id
WHERE l.deleted_at IS NULL
ORDER BY l.ordem;

-- Pra REVERTER:
--   ALTER TABLE public.meta_inovacao_urc_lideranca DROP COLUMN IF EXISTS pessoa_id;
