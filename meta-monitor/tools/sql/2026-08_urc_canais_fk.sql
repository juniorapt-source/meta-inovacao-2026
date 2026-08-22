-- ============================================================================
-- Golden record de cadastros de referência — Camada 2, item 2.4
-- ============================================================================
-- ALTER meta_inovacao_urc_canais_responsaveis: + canal_id FK ->
-- meta_inovacao_canais(id), + pessoa_id FK -> meta_inovacao_pessoas(id).
-- Convive com `canal`/`nome` (texto) já existentes.
--
-- canal_id: casa `canal` (texto: "CNR","Portal","Loja",...) contra
-- meta_inovacao_canais.nome — os nomes usados aqui são um SUBCONJUNTO dos 10 canais
-- da Camada 0 (CANAIS_FIXOS/CANAIS_URC de js/db-urc.js tem só 8; "Sebrae na sua
-- empresa" e "Contabilizações e instrumentos" ainda não têm responsável indicado —
-- ver PROPOSTA_ESQUEMA_CADASTROS_REFERENCIA.md). Cobertura esperada: 100% das
-- linhas que existem (só há linha pros canais que já têm responsável).
--
-- pessoa_id: casa `nome` (texto exato) contra meta_inovacao_pessoas.nome — os 11
-- responsáveis de canal foram inseridos em meta_inovacao_pessoas no item 1.3 com o
-- `nome` idêntico ao texto original desta tabela, então o casamento é por
-- igualdade simples, sem alias.
--
-- ORDEM DE EXECUÇÃO: depois de 2026-08_migracao_modo_edicao.sql (cria a tabela),
-- 2026-08_canais.sql (Camada 0) e 2026-08_pessoas_golden.sql (Camada 1, item 1.3).
-- IDEMPOTENTE.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.meta_inovacao_urc_canais_responsaveis') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_urc_canais_responsaveis não existe — rode tools/sql/2026-08_migracao_modo_edicao.sql antes deste script.';
  END IF;
  IF to_regclass('public.meta_inovacao_canais') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_canais não existe — rode tools/sql/2026-08_canais.sql (Camada 0) antes deste script.';
  END IF;
  IF to_regclass('public.meta_inovacao_pessoas') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_pessoas não existe — rode tools/sql/2026-08_migracao_modo_edicao.sql antes deste script.';
  END IF;
END $$;

ALTER TABLE public.meta_inovacao_urc_canais_responsaveis
  ADD COLUMN IF NOT EXISTS canal_id  bigint REFERENCES public.meta_inovacao_canais(id),
  ADD COLUMN IF NOT EXISTS pessoa_id bigint REFERENCES public.meta_inovacao_pessoas(id);

UPDATE public.meta_inovacao_urc_canais_responsaveis r
SET canal_id = c.id
FROM public.meta_inovacao_canais c
WHERE c.nome = r.canal
  AND c.deleted_at IS NULL
  AND r.deleted_at IS NULL
  AND r.canal_id IS DISTINCT FROM c.id;

UPDATE public.meta_inovacao_urc_canais_responsaveis r
SET pessoa_id = p.id
FROM public.meta_inovacao_pessoas p
WHERE p.nome = r.nome
  AND p.grupo = 'URC'
  AND p.deleted_at IS NULL
  AND r.deleted_at IS NULL
  AND r.pessoa_id IS DISTINCT FROM p.id;

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verificação
-- ============================================================================
-- (a) cobertura de canal_id — esperado 0 linhas:
SELECT id, canal, nome FROM public.meta_inovacao_urc_canais_responsaveis
WHERE deleted_at IS NULL AND canal_id IS NULL;

-- (b) cobertura de pessoa_id — esperado 0 linhas:
SELECT id, canal, nome FROM public.meta_inovacao_urc_canais_responsaveis
WHERE deleted_at IS NULL AND pessoa_id IS NULL;

-- (c) conferência visual:
SELECT c.nome AS canal, p.nome_completo, p.email
FROM public.meta_inovacao_urc_canais_responsaveis r
LEFT JOIN public.meta_inovacao_canais c ON c.id = r.canal_id
LEFT JOIN public.meta_inovacao_pessoas p ON p.id = r.pessoa_id
WHERE r.deleted_at IS NULL
ORDER BY c.ordem, r.ordem;

-- Pra REVERTER:
--   ALTER TABLE public.meta_inovacao_urc_canais_responsaveis
--     DROP COLUMN IF EXISTS canal_id, DROP COLUMN IF EXISTS pessoa_id;
