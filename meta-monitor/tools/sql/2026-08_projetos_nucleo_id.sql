-- ============================================================================
-- Golden record de cadastros de referência — Camada 2, item 2.1
-- ============================================================================
-- ALTER meta_inovacao_projetos: + nucleo_id FK -> meta_inovacao_nucleos(id),
-- convivendo com a coluna `nucleo` (texto) que já existe — não é removida (é
-- Camada 5). Popula automaticamente casando texto exato: os 27 projetos usam os
-- mesmos 5 nomes de núcleo que NUCLEOS_VALIDOS/meta_inovacao_nucleos (Camada 0),
-- então a expectativa é 100% de cobertura sem intervenção manual.
--
-- ORDEM DE EXECUÇÃO: depois de 2026-08_migracao_modo_edicao.sql (cria
-- meta_inovacao_projetos) e 2026-08_nucleos.sql (Camada 0).
-- IDEMPOTENTE: ADD COLUMN IF NOT EXISTS; o UPDATE é só atribuição (rodar de novo
-- não muda nada que já esteja certo).
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.meta_inovacao_projetos') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_projetos não existe — rode tools/sql/2026-08_migracao_modo_edicao.sql antes deste script.';
  END IF;
  IF to_regclass('public.meta_inovacao_nucleos') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_nucleos não existe — rode tools/sql/2026-08_nucleos.sql (Camada 0) antes deste script.';
  END IF;
END $$;

ALTER TABLE public.meta_inovacao_projetos
  ADD COLUMN IF NOT EXISTS nucleo_id bigint REFERENCES public.meta_inovacao_nucleos(id);

UPDATE public.meta_inovacao_projetos p
SET nucleo_id = n.id
FROM public.meta_inovacao_nucleos n
WHERE n.nome = p.nucleo
  AND n.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND p.nucleo_id IS DISTINCT FROM n.id;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verificação
-- ============================================================================
-- (a) cobertura — esperado 0 linhas (todos os 27 projetos deveriam casar):
SELECT id, nucleo, iniciativa
FROM public.meta_inovacao_projetos
WHERE deleted_at IS NULL AND nucleo_id IS NULL;

-- (b) contagem por núcleo, pra conferência visual rápida:
SELECT n.nome AS nucleo, count(*) AS total
FROM public.meta_inovacao_projetos p
JOIN public.meta_inovacao_nucleos n ON n.id = p.nucleo_id
WHERE p.deleted_at IS NULL
GROUP BY n.nome
ORDER BY n.nome;

-- Pra REVERTER:
--   ALTER TABLE public.meta_inovacao_projetos DROP COLUMN IF EXISTS nucleo_id;
