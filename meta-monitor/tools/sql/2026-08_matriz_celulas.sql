-- ============================================================================
-- Golden record de cadastros de referência — Camada 3, item 3.1
-- ============================================================================
-- Cria meta_inovacao_matriz_celulas: substitui as 10 colunas físicas de
-- meta_inovacao_matriz_demandas (foco, cnr, empresa, portal, mkt, loja, rede,
-- assessoria, dxp, contab) por UMA LINHA POR CÉLULA (projeto_id × canal_id), como
-- desenhado em docs/PROPOSTA_ESQUEMA_CADASTROS_REFERENCIA.md, seção "A mudança maior:
-- normalizar meta_inovacao_matriz_demandas".
--
-- meta_inovacao_matriz_demandas É A ÚNICA TABELA DO ESQUEMA QUE VIOLA "cadastra e
-- aparece sozinho": hoje, cadastrar um canal novo é um ALTER TABLE ADD COLUMN + mudar
-- demandas.html/editor.html na mão. Com canal_id FK, cadastrar o canal 11 em
-- meta_inovacao_canais faz a grade inteira nascer com essa coluna, pra todo projeto,
-- sem tocar em schema nem em HTML de opções.
--
-- ESTE SCRIPT NÃO TOCA em meta_inovacao_matriz_demandas — a tabela antiga continua
-- viva, em paralelo, sendo a fonte de leitura/escrita de demandas.html até o item 3.2
-- (reescrita da grade, Opus — a peça de maior risco do pacote) trocar de "colunas
-- fixas no HTML" pra "grade montada em JS a partir do catálogo" e cortar pra cá. Até
-- lá, as duas tabelas coexistem: matriz_demandas segue sendo editada pelo site, esta
-- migração é um retrato de UMA execução — rodar de novo antes do corte em 3.2 é
-- seguro (idempotente via ON CONFLICT DO NOTHING) mas não fica sincronizado
-- automaticamente com edições feitas em matriz_demandas depois deste ponto.
--
-- MAPEAMENTO canal → coluna: por slug, não por nome de exibição. meta_inovacao_canais
-- (Camada 0, tools/sql/2026-08_canais.sql) guarda em `slug` o MESMO id de
-- data/canais.js ("foco", "cnr", ...) — que são também os nomes literais das 10
-- colunas físicas desta migração. Casamento por igualdade simples, sem heurística de
-- nome, mesmo raciocínio de canal ser "whitelist DURA" em cc_canva_gravar
-- (2026-08_canva_demandas.sql).
--
-- MAPEAMENTO projeto → linha: por meta_inovacao_projetos.iniciativa =
-- meta_inovacao_matriz_demandas.iniciativa (igualdade exata). Só migra célula cujo
-- projeto casar — a verificação (b) ao final lista qualquer iniciativa da tabela
-- antiga com célula preenchida que NÃO tiver casado, pra não perder dado em silêncio.
--
-- CÉLULA VAZIA = AUSENTE: só migra célula com estado preenchido (≠ ''). Não insere
-- uma linha pra cada um dos projeto×canal — é o próprio ponto do redesenho (§3.2 vai
-- montar a grade iterando meta_inovacao_projetos × meta_inovacao_canais e preenchendo
-- só com o que encontrar aqui).
--
-- RLS: segue tools/sql/PADRAO_TABELA.md — SELECT público, escrita por
-- x-cc-token (modelo vigente desde a reversão de 2026-08-20,
-- tools/sql/2026-08_reverte_para_token_compartilhado.sql — é o mesmo padrão que
-- 2026-08_canais.sql/2026-08_nucleos.sql (Camada 0) já usam). NÃO é a policy "FOR ALL
-- TO anon USING (true)" que a proposta original documentou pra esta tabela — aquela
-- nota foi escrita quando o site inteiro tinha acabado de migrar pro modelo
-- authenticated + cc_eh_editor() (v0.28/v0.29), e a tabela nova "manter a policy
-- aberta" queria dizer "não seguir aquela migração pra login". O site reverteu pro
-- token um dia depois (v0.30.0) e nunca voltou — o padrão vigente HOJE é token, e uma
-- tabela nova deve nascer nele, não na exceção antiga que a nota tentava evitar.
--
-- DELETE físico é permitido nesta tabela (diferente do padrão de soft-delete do
-- resto do esquema): já que célula ausente = vazia, apagar uma linha não perde
-- informação nenhuma — é exatamente equivalente a nunca ter existido. Não há
-- deleted_at de propósito (também não existe na tabela antiga).
--
-- ORDEM DE EXECUÇÃO: depois de 2026-08_canais.sql (Camada 0 — cria
-- meta_inovacao_canais com os 10 slugs). meta_inovacao_projetos já existe desde
-- v0.3.2, nenhuma dependência de Camada 2 aqui (não usamos nucleo_id).
--
-- IDEMPOTENTE: CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE FUNCTION, DROP
-- POLICY/TRIGGER antes de recriar, INSERT com ON CONFLICT DO NOTHING.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 0) Pré-requisitos — FALHA CEDO, de propósito (mesmo espírito de
--    2026-08_canva_demandas.sql seção 0 e 2026-08_projetos_nucleo_id.sql):
--    sem meta_inovacao_canais com os 10 slugs, a migração de dado da seção 5
--    simplesmente não encontraria canal nenhum pra casar e sairia "silenciosamente"
--    sem migrar nada — melhor abortar aqui com uma mensagem clara.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_slugs_faltando text[];
BEGIN
  IF to_regclass('public.meta_inovacao_projetos') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_projetos não existe — algo está errado no ambiente, essa tabela é de v0.3.2.';
  END IF;

  IF to_regclass('public.meta_inovacao_matriz_demandas') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_matriz_demandas não existe — algo está errado no ambiente, essa tabela é de v0.3.0.';
  END IF;

  IF to_regclass('public.meta_inovacao_canais') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_canais não existe — rode tools/sql/2026-08_canais.sql (Camada 0) antes deste script.';
  END IF;

  SELECT array_agg(slug) INTO v_slugs_faltando
  FROM unnest(ARRAY['foco','cnr','empresa','portal','mkt','loja','rede','assessoria','dxp','contab']) AS slug
  WHERE NOT EXISTS (
    SELECT 1 FROM public.meta_inovacao_canais c
    WHERE c.slug = slug AND c.deleted_at IS NULL
  );
  IF v_slugs_faltando IS NOT NULL THEN
    RAISE EXCEPTION 'meta_inovacao_canais está sem os slugs: % — confira se 2026-08_canais.sql rodou e semeou os 10 canais.', v_slugs_faltando;
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 1) Tabela
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_inovacao_matriz_celulas (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  projeto_id bigint NOT NULL REFERENCES public.meta_inovacao_projetos(id),
  canal_id   bigint NOT NULL REFERENCES public.meta_inovacao_canais(id),
  estado     text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,

  CONSTRAINT cc_matriz_celulas_estado_valido CHECK (
    estado IN ('', 'previsto', 'oficina', 'formulario', 'justificado', 'priorizado', 'encaminhado')
  ),
  -- uma célula por par — é o que permite ON CONFLICT DO NOTHING na seção 5 e o
  -- upsert de célula individual que demandas.html (item 3.2) vai fazer depois.
  CONSTRAINT cc_matriz_celulas_projeto_canal_unico UNIQUE (projeto_id, canal_id)
);

CREATE INDEX IF NOT EXISTS meta_inovacao_matriz_celulas_projeto_idx
  ON public.meta_inovacao_matriz_celulas (projeto_id);
CREATE INDEX IF NOT EXISTS meta_inovacao_matriz_celulas_canal_idx
  ON public.meta_inovacao_matriz_celulas (canal_id);


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

DROP TRIGGER IF EXISTS cc_touch_updated_at_matriz_celulas ON public.meta_inovacao_matriz_celulas;
CREATE TRIGGER cc_touch_updated_at_matriz_celulas
  BEFORE UPDATE ON public.meta_inovacao_matriz_celulas
  FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 3) Trigger de auditoria — meta_inovacao_matriz_demandas está no grupo de tabelas
--    "editáveis de verdade" que usa cc_audit() (PADRAO_TABELA.md item 7,
--    tools/sql/2026-08_auditoria.sql); a sucessora nasce no mesmo grupo, pra não
--    perder histórico de mudança quando o item 3.2 cortar a edição pra cá.
--    cc_audit() já sabe extrair autor via to_jsonb(NEW)->>'updated_by'.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.cc_audit()') IS NOT NULL THEN
    EXECUTE 'DROP TRIGGER IF EXISTS cc_audit_matriz_celulas ON public.meta_inovacao_matriz_celulas';
    EXECUTE '
      CREATE TRIGGER cc_audit_matriz_celulas
        AFTER INSERT OR UPDATE OR DELETE ON public.meta_inovacao_matriz_celulas
        FOR EACH ROW EXECUTE FUNCTION public.cc_audit()';
  ELSE
    RAISE NOTICE 'cc_audit() não existe ainda (tools/sql/2026-08_auditoria.sql não rodou) — seguindo sem trigger de auditoria nesta tabela. Rode 2026-08_auditoria.sql e reaplique este script pra ligar.';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 4) RLS — SELECT público, escrita só com x-cc-token certo (PADRAO_TABELA.md,
--    mesmo padrão que 2026-08_canais.sql/2026-08_nucleos.sql já usam)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'meta_inovacao_matriz_celulas'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_matriz_celulas', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.meta_inovacao_matriz_celulas ENABLE ROW LEVEL SECURITY;

-- GRANT vem ANTES das policies — sem ele, RLS nunca é avaliado.
-- DELETE entra aqui (diferente do padrão do resto do esquema) — ver nota no
-- cabeçalho: célula ausente já É o estado vazio, apagar a linha não perde dado.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_inovacao_matriz_celulas TO anon, authenticated;

CREATE POLICY "cc_select_publico" ON public.meta_inovacao_matriz_celulas
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "cc_token_insert" ON public.meta_inovacao_matriz_celulas
  FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90');

CREATE POLICY "cc_token_update" ON public.meta_inovacao_matriz_celulas
  FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90');

CREATE POLICY "cc_token_delete" ON public.meta_inovacao_matriz_celulas
  FOR DELETE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90');

-- Pra REVERTER (só faz sentido logo depois de criar, antes de qualquer edição real):
--   DROP TRIGGER IF EXISTS cc_audit_matriz_celulas ON public.meta_inovacao_matriz_celulas;
--   DROP TRIGGER IF EXISTS cc_touch_updated_at_matriz_celulas ON public.meta_inovacao_matriz_celulas;
--   DROP TABLE IF EXISTS public.meta_inovacao_matriz_celulas;


-- ---------------------------------------------------------------------------
-- 5) Migração de dado — as 10 colunas físicas viram linhas.
--    LATERAL VALUES faz o "unpivot" das 10 colunas de cada linha da tabela antiga
--    num par (slug, estado); só as células com estado ≠ '' viram linha aqui.
--    ON CONFLICT DO NOTHING deixa o script seguro de rodar mais de uma vez antes do
--    corte em 3.2 (não sobrescreve o que já foi migrado numa rodada anterior).
-- ---------------------------------------------------------------------------
INSERT INTO public.meta_inovacao_matriz_celulas (projeto_id, canal_id, estado, updated_at, updated_by)
SELECT
  p.id,
  c.id,
  v.estado,
  m.atualizado_em,
  m.atualizado_por
FROM public.meta_inovacao_matriz_demandas m
JOIN public.meta_inovacao_projetos p
  ON p.iniciativa = m.iniciativa
  AND p.deleted_at IS NULL
CROSS JOIN LATERAL (VALUES
  ('foco',       m.foco),
  ('cnr',        m.cnr),
  ('empresa',    m.empresa),
  ('portal',     m.portal),
  ('mkt',        m.mkt),
  ('loja',       m.loja),
  ('rede',       m.rede),
  ('assessoria', m.assessoria),
  ('dxp',        m.dxp),
  ('contab',     m.contab)
) AS v(slug, estado)
JOIN public.meta_inovacao_canais c
  ON c.slug = v.slug
  AND c.deleted_at IS NULL
WHERE btrim(coalesce(v.estado, '')) <> ''
ON CONFLICT (projeto_id, canal_id) DO NOTHING;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- Verificação — rode e confira à mão
-- ============================================================================
-- (a) total de células migradas — compare com (a2), devem BATER:
SELECT count(*) AS total_celulas_migradas FROM public.meta_inovacao_matriz_celulas;

-- (a2) total de células preenchidas na tabela antiga (soma das 10 colunas ≠ ''),
--      restrito às iniciativas que EXISTEM no golden record (as únicas que a
--      migração consegue casar — ver (b) pra quem ficou de fora):
SELECT count(*) AS total_celulas_preenchidas_tabela_antiga
FROM public.meta_inovacao_matriz_demandas m
JOIN public.meta_inovacao_projetos p ON p.iniciativa = m.iniciativa AND p.deleted_at IS NULL
CROSS JOIN LATERAL (VALUES (m.foco), (m.cnr), (m.empresa), (m.portal), (m.mkt),
                            (m.loja), (m.rede), (m.assessoria), (m.dxp), (m.contab)) AS v(estado)
WHERE btrim(coalesce(v.estado, '')) <> '';

-- (b) iniciativas da tabela antiga que NÃO casaram com nenhum projeto do golden
--     record — DEVE VIR VAZIO. Se vier alguma linha, o nome diverge entre as duas
--     tabelas (ex.: projeto renomeado num lado só) e as células dela NÃO foram
--     migradas — precisa corrigir o nome (num lado ou no outro) e rodar de novo
--     antes de considerar a migração completa:
SELECT m.iniciativa
FROM public.meta_inovacao_matriz_demandas m
LEFT JOIN public.meta_inovacao_projetos p ON p.iniciativa = m.iniciativa AND p.deleted_at IS NULL
WHERE p.id IS NULL
  AND (
    btrim(coalesce(m.foco,''))       <> '' OR btrim(coalesce(m.cnr,''))    <> '' OR
    btrim(coalesce(m.empresa,''))    <> '' OR btrim(coalesce(m.portal,'')) <> '' OR
    btrim(coalesce(m.mkt,''))        <> '' OR btrim(coalesce(m.loja,''))  <> '' OR
    btrim(coalesce(m.rede,''))       <> '' OR btrim(coalesce(m.assessoria,'')) <> '' OR
    btrim(coalesce(m.dxp,''))        <> '' OR btrim(coalesce(m.contab,'')) <> ''
  );

-- (c) projetos do golden record que a tabela antiga nem conhece (esperado: qualquer
--     projeto criado DEPOIS do último snapshot de matriz.js/matriz_demandas — não é
--     erro, só nasce sem células, exatamente como qualquer projeto novo nasceria na
--     grade nova a partir de 3.2):
SELECT p.iniciativa
FROM public.meta_inovacao_projetos p
LEFT JOIN public.meta_inovacao_matriz_demandas m ON m.iniciativa = p.iniciativa
WHERE p.deleted_at IS NULL AND m.iniciativa IS NULL
ORDER BY p.iniciativa;

-- (d) amostra por estado, pra conferência visual rápida:
SELECT k.estado, count(*) AS total
FROM public.meta_inovacao_matriz_celulas k
GROUP BY k.estado
ORDER BY k.estado;

-- (e) GRANTs — esperado: SELECT/INSERT/UPDATE/DELETE pra anon e authenticated:
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'meta_inovacao_matriz_celulas'
ORDER BY grantee, privilege_type;

-- (f) policies — esperado: cc_select_publico (SELECT), cc_token_insert (INSERT),
--     cc_token_update (UPDATE), cc_token_delete (DELETE), todas citando x-cc-token
--     exceto a de SELECT:
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'meta_inovacao_matriz_celulas'
ORDER BY cmd, policyname;

-- (g) confirma que a tabela antiga CONTINUA intacta e viva (mesma contagem de
--     sempre, RLS/policies dela inalteradas — este script não tocou nela):
SELECT count(*) AS total_linhas_tabela_antiga FROM public.meta_inovacao_matriz_demandas;
