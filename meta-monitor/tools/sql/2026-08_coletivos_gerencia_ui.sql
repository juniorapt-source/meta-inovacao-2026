-- ============================================================================
-- Golden record de cadastros de referência — Camada 1, item 1.3 (complemento)
-- ============================================================================
-- "Gerência UI" (papel institucional, guardiã dos Nós 1 e 4 · comunicação
-- institucional) não é pessoa física — José confirmou (22/08/2026,
-- CAMADA1_DEDUPE_PESSOAS.md §3.5) que ela entra em meta_inovacao_coletivos junto
-- de Comitê/URC/Coordenadores/Gestores dos projetos/Soluções, mesmo sendo um
-- cargo e não um "grupo de pessoas" no sentido original da Camada 0.
--
-- A linha "Gerência UI" que já existe em meta_inovacao_pessoas (grupo UI, seed
-- original de 2026-08_migracao_modo_edicao.sql) NÃO é tocada aqui — continua
-- existindo pra não quebrar nenhuma tela que ainda lê o grupo UI direto; a
-- aposentadoria desse texto legado é Camada 5, não este script.
--
-- ORDEM DE EXECUÇÃO: depois de 2026-08_coletivos.sql (Camada 0).
-- IDEMPOTENTE: WHERE NOT EXISTS.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.meta_inovacao_coletivos') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_coletivos não existe — rode tools/sql/2026-08_coletivos.sql (Camada 0) antes deste script.';
  END IF;
END $$;

INSERT INTO public.meta_inovacao_coletivos (nome, ordem)
SELECT 'Gerência UI', 6
WHERE NOT EXISTS (
  SELECT 1 FROM public.meta_inovacao_coletivos c
  WHERE c.nome = 'Gerência UI' AND c.deleted_at IS NULL
);

-- Verificação — deve devolver 6 (os 5 da Camada 0 + Gerência UI):
SELECT count(*) AS total_coletivos FROM public.meta_inovacao_coletivos WHERE deleted_at IS NULL;
SELECT nome, ordem FROM public.meta_inovacao_coletivos WHERE deleted_at IS NULL ORDER BY ordem;
