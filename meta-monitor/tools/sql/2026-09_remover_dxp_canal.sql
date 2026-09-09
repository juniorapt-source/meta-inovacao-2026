-- ============================================================================
-- Remove o canal "DXP" do catálogo (meta_inovacao_canais) — soft delete
-- ============================================================================
-- Decisão do José (set/2026): a oficina "Estratégia DXP" não vai mais acontecer em
-- ciclo nenhum. tools/sql/2026-09_remover_dxp_agenda.sql já tirou os 2 encontros dela
-- de meta_inovacao_agenda_encontros; este script vai além e remove o canal do
-- CATÁLOGO em si, porque agenda.html mostrava a linha da DXP na visão Timeline mesmo
-- sem encontro nenhum — a Timeline desenha uma linha por CANAL do catálogo (uma por
-- data/canais.js), não uma por encontro (ver js/timeline.js).
--
-- Espelha o que já foi feito no código, no mesmo commit:
--   - data/canais.js: entrada "dxp" removida (10 → 9 canais)
--   - data/matriz.js: chave "dxp" removida das 27 iniciativas (já vinha vazia em todas)
--   - data/urc.js / js/db-urc.js (CANAIS_FIXOS): "DXP" removido (8 → 7 canais URC)
--   - js/db-canva.js (whitelist do client): "dxp" removido (9 canais)
--   - apresentacao_canais.html: slide da DXP removido
--
-- ORDEM DE EXECUÇÃO: rodar no SQL editor do Supabase (projeto "Coisas do Sebrae"),
-- depois de 2026-09_remover_dxp_agenda.sql (não depende dele, mas é a mesma remoção
-- em duas tabelas — faz sentido rodar junto).
--
-- É SOFT DELETE (mesmo padrão de 2026-08_canais.sql: RLS ligada, sem policy de
-- DELETE, soft delete via UPDATE em deleted_at). meta_inovacao_matriz_celulas
-- referencia canal_id como FK — soft delete não quebra a FK (a linha continua
-- existindo fisicamente, só marcada). As células da DXP na Matriz (todas vazias,
-- confirmado no passo 1c) ficam órfãs-mas-inofensivas: nenhuma tela lista canal por
-- canal_id direto, sempre parte da lista de meta_inovacao_canais (que passa a não
-- incluir mais a DXP) — a coluna simplesmente some de demandas.html/editor.html.
--
-- NÃO mexe na whitelist da função SQL (cc_canva_gravar/cc_canva_editar, v_canais com
-- 'dxp' — ver tools/sql/2026-08_canva_grupo_local.sql) de propósito: é uma
-- CREATE OR REPLACE FUNCTION inteira, alto risco de reescrever errado numa função em
-- produção usada pra captura de demanda ao vivo nas oficinas. Como o client não
-- oferece mais "dxp" como opção (js/db-canva.js), o valor nunca chega a ser mandado —
-- a função aceitar "dxp" sem ninguém mandar é inofensivo, só "morto". Se quiser
-- fechar isso também, é um script à parte, feito com calma.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Diagnóstico (não altera nada).
-- ---------------------------------------------------------------------------

-- 1a) o canal em si — esperado: 1 linha, deleted_at ainda nulo.
SELECT id, slug, nome, ativo, deleted_at
FROM public.meta_inovacao_canais
WHERE slug = 'dxp';

-- 1b) responsáveis de URC pra DXP — esperado: 0 linhas (data/urc.js já tinha
--     "DXP": responsaveis: [] — nada devia ter sido gravado em produção).
SELECT count(*) AS urc_responsaveis_dxp
FROM public.meta_inovacao_urc_canais_responsaveis
WHERE deleted_at IS NULL AND upper(canal) = 'DXP';

-- 1c) células da Matriz de demandas com conteúdo real na coluna DXP — esperado: 0
--     (data/matriz.js só tinha "" pra dxp nas 27 iniciativas; isso confirma que
--     produção não divergiu do seed local, e que a coluna pode sumir sem perder nada).
SELECT count(*) AS celulas_dxp_com_conteudo
FROM public.meta_inovacao_matriz_celulas mc
JOIN public.meta_inovacao_canais c ON c.id = mc.canal_id
WHERE c.slug = 'dxp' AND btrim(coalesce(mc.estado, '')) <> '';

-- contagem de canais ativos ANTES (referência pro passo 3)
SELECT count(*) AS canais_ativos_antes
FROM public.meta_inovacao_canais
WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 2) Remoção (soft delete). Só rode depois de conferir o passo 1 — em especial 1b/1c:
--    se alguma delas vier > 0, PARE e avise o José antes de continuar (tem dado real
--    que este script não estava esperando).
-- ---------------------------------------------------------------------------
UPDATE public.meta_inovacao_canais
SET deleted_at = now(),
    updated_by = 'migração SQL — remoção do canal DXP (José, set/2026)'
WHERE slug = 'dxp'
  AND deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 3) Verificação.
-- ---------------------------------------------------------------------------
SELECT count(*) AS dxp_ativo_depois
FROM public.meta_inovacao_canais
WHERE slug = 'dxp' AND deleted_at IS NULL;
-- dxp_ativo_depois = 0 → remoção concluída.

SELECT count(*) AS canais_ativos_depois
FROM public.meta_inovacao_canais
WHERE deleted_at IS NULL;
-- canais_ativos_depois = canais_ativos_antes - 1  (deve dar 9)
