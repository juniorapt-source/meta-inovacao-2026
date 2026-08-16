-- ============================================================================
-- Remove "Salas do Empreendedor" de corsario_status (reconciliação 27×28)
-- ============================================================================
-- Governança do golden record (docs/GOVERNANCA_GOLDEN_RECORD.md), camada 4.
--
-- O portfólio canônico (golden record = meta_inovacao_projetos) tem 27 iniciativas.
-- A tabela corsario_status tinha 28 — a iniciativa a mais, "Salas do Empreendedor",
-- nunca esteve no portfólio e foi decidido (Aug/2026) removê-la de TODO o projeto.
-- Este script apaga as linhas dela em corsario_status (uma por critério).
--
-- ORDEM DE EXECUÇÃO: rodar no SQL editor do Supabase (projeto "Coisas do Sebrae"),
-- depois de 2026-08_auditoria.sql (a trigger cc_audit registra o DELETE no log).
--
-- É um HARD DELETE (corsario_status não tem soft-delete). O passo 1 mostra o que será
-- apagado ANTES de apagar — confira a saída antes de rodar o passo 2.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Diagnóstico (não altera nada) — o que existe hoje com esse nome.
--    Esperado: várias linhas (1 por critério) só de "Salas do Empreendedor".
--    A grafia canônica no banco é "Salas do Empreendedor" (plural); a variante
--    singular "Sala do Empreendedor" entra no filtro por segurança, caso exista.
-- ---------------------------------------------------------------------------
SELECT iniciativa, count(*) AS linhas
FROM public.corsario_status
WHERE iniciativa IN ('Salas do Empreendedor', 'Sala do Empreendedor')
GROUP BY iniciativa;

-- contagem de iniciativas distintas ANTES (esperado: 28)
SELECT count(DISTINCT iniciativa) AS iniciativas_antes FROM public.corsario_status;


-- ---------------------------------------------------------------------------
-- 2) Remoção. Só rode depois de conferir o passo 1.
-- ---------------------------------------------------------------------------
DELETE FROM public.corsario_status
WHERE iniciativa IN ('Salas do Empreendedor', 'Sala do Empreendedor');


-- ---------------------------------------------------------------------------
-- 3) Verificação — deve voltar 27 e nenhuma linha remanescente.
-- ---------------------------------------------------------------------------
SELECT count(DISTINCT iniciativa) AS iniciativas_depois FROM public.corsario_status;

SELECT count(*) AS remanescentes_salas
FROM public.corsario_status
WHERE iniciativa IN ('Salas do Empreendedor', 'Sala do Empreendedor');
-- iniciativas_depois = 27  e  remanescentes_salas = 0  → reconciliação concluída.
