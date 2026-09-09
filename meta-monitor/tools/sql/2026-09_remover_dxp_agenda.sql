-- ============================================================================
-- Remove os encontros da DXP de meta_inovacao_agenda_encontros (Ciclo 1 e 2)
-- ============================================================================
-- Decisão do José (set/2026): a oficina "Estratégia DXP" sai da agenda dos ciclos —
-- não vai mais acontecer em ciclo nenhum. Este script soft-deleta as linhas dela em
-- meta_inovacao_agenda_encontros (canal = 'dxp'), espelhando o que já foi feito no
-- código: data/agenda.js (seed/fallback) teve os registros "c1-dxp" e "c2-dxp"
-- removidos no mesmo commit deste script.
--
-- Este script SÓ mexe na agenda de encontros. O canal "DXP" em si (data/canais.js,
-- meta_inovacao_urc_canais_responsaveis, apresentacao_canais.html) NÃO é tocado aqui —
-- fora do escopo pedido.
--
-- ORDEM DE EXECUÇÃO: rodar no SQL editor do Supabase (projeto "Coisas do Sebrae"),
-- a qualquer momento — não depende de nenhuma migração posterior a 2026-08_agenda.sql
-- (que criou a tabela e a coluna deleted_at).
--
-- É SOFT DELETE (a tabela não tem policy de DELETE — ver 2026-08_agenda.sql, linha
-- "sem policy de DELETE (soft delete via UPDATE em deleted_at)"): agenda.html já
-- filtra `deleted_at IS NULL` (js/db-agenda.js -> js/db-base.js), então a linha some
-- da tela sem precisar de DELETE de verdade. O passo 1 mostra o que será afetado
-- ANTES de gravar — confira a saída antes de rodar o passo 2.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Diagnóstico (não altera nada) — encontros da DXP hoje, ainda ativos.
--    Esperado: 2 linhas (ciclo 1 e ciclo 2), ambas com deleted_at IS NULL.
-- ---------------------------------------------------------------------------
SELECT id, ciclo, canal, sessao, status, deleted_at
FROM public.meta_inovacao_agenda_encontros
WHERE canal = 'dxp'
ORDER BY ciclo;

-- contagem de encontros ativos ANTES (referência pro passo 3)
SELECT count(*) AS encontros_ativos_antes
FROM public.meta_inovacao_agenda_encontros
WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 2) Remoção (soft delete). Só rode depois de conferir o passo 1.
-- ---------------------------------------------------------------------------
UPDATE public.meta_inovacao_agenda_encontros
SET deleted_at = now(),
    updated_by = 'migração SQL — remoção da DXP (José, set/2026)'
WHERE canal = 'dxp'
  AND deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 3) Verificação — nenhum encontro ativo da DXP deve sobrar.
-- ---------------------------------------------------------------------------
SELECT count(*) AS dxp_ativos_depois
FROM public.meta_inovacao_agenda_encontros
WHERE canal = 'dxp'
  AND deleted_at IS NULL;
-- dxp_ativos_depois = 0 → remoção concluída.

SELECT count(*) AS encontros_ativos_depois
FROM public.meta_inovacao_agenda_encontros
WHERE deleted_at IS NULL;
-- encontros_ativos_depois = encontros_ativos_antes - 2
