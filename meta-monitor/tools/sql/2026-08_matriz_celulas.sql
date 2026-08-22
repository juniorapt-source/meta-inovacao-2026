-- ============================================================================
-- Golden record de cadastros de referência — Camada 3, item 3.1
-- meta_inovacao_matriz_celulas: a matriz de demandas normalizada (wide -> long)
-- ============================================================================
-- ESTA MIGRAÇÃO JÁ FOI EXECUTADA EM PRODUÇÃO (a tabela existe e alimenta
-- demandas.html desde o item 3.2). O arquivo estava faltando no repositório: sem ele
-- ninguém consegue recriar a tabela num ambiente novo nem conferir o schema contra o
-- que js/matriz-store.js espera. É IDEMPOTENTE de ponta a ponta (CREATE ... IF NOT
-- EXISTS, DROP POLICY/TRIGGER antes de recriar, INSERT ... ON CONFLICT DO NOTHING):
-- rodar de novo no SQL Editor não duplica célula nem derruba nada.
--
-- O QUE MUDA EM RELAÇÃO À TABELA ANTIGA
-- meta_inovacao_matriz_demandas (supabase/setup.sql) tem 1 linha por iniciativa e
-- 10 COLUNAS FÍSICAS, uma por canal, cada uma com seu próprio CHECK. Cadastrar o canal
-- 11 exige ALTER TABLE + mexer no HTML que lista as colunas na mão — o oposto de
-- "cadastra e aparece sozinho". Aqui cada célula vira uma LINHA (projeto_id, canal_id),
-- e a grade de demandas.html é montada em runtime a partir de
-- meta_inovacao_projetos × meta_inovacao_canais.
--
-- CÉLULA AUSENTE = CÉLULA VAZIA. Não existe uma linha por par possível: a migração
-- abaixo só materializa as células com estado preenchido, e demandas.html só cria
-- linha nova quando alguém edita de fato (upsert no par).
--
-- A TABELA ANTIGA NÃO É TOCADA por este script — continua viva, com todo o dado, como
-- rede de segurança de rollback e como base da conferência célula a célula que
-- demandas.html mostra durante a validação humana (item 3.5 do plano, que decide quando
-- aposentá-la). A partir da virada do item 3.2 ela deixa de receber escrita.
--
-- Segue tools/sql/PADRAO_TABELA.md: RLS ligada, GRANT antes das policies,
-- cc_select_publico pra leitura, cc_token_insert/cc_token_update pra escrita (mesmo
-- token compartilhado x-cc-token de data/config.js), trigger de updated_at.
-- (A proposta original — docs/PROPOSTA_ESQUEMA_CADASTROS_REFERENCIA.md, decisão de
-- 22/08 — falava em herdar a policy aberta da tabela antiga; quando essa decisão foi
-- escrita a tabela antiga ainda estava aberta, mas 2026-08_protecao_escrita.sql e
-- 2026-08_reverte_para_token_compartilhado.sql já a puseram no padrão de token. A
-- tabela nova nasce no padrão atual, que é o mesmo nível de proteção que a antiga tem
-- hoje — não um aperto novo.)
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Tabela
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_inovacao_matriz_celulas (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  projeto_id  bigint NOT NULL REFERENCES public.meta_inovacao_projetos(id),
  canal_id    bigint NOT NULL REFERENCES public.meta_inovacao_canais(id),
  estado      text NOT NULL DEFAULT ''
                CHECK (estado IN ('', 'previsto', 'oficina', 'formulario', 'justificado', 'priorizado', 'encaminhado')),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text,
  CONSTRAINT meta_inovacao_matriz_celulas_par_unico UNIQUE (projeto_id, canal_id)
);

COMMENT ON TABLE public.meta_inovacao_matriz_celulas IS
  'Matriz de demandas normalizada — 1 linha por (projeto, canal). Célula ausente = vazia. Substitui as 10 colunas físicas de meta_inovacao_matriz_demandas (Camada 3 do golden record).';

-- a grade lê a matriz inteira de uma vez e casa por par; o índice do UNIQUE já cobre
-- (projeto_id, canal_id). Este aqui serve a "todas as células de um canal", que é o que
-- a conferência por canal e os relatórios por canal fazem.
CREATE INDEX IF NOT EXISTS meta_inovacao_matriz_celulas_canal_idx
  ON public.meta_inovacao_matriz_celulas (canal_id);


-- ---------------------------------------------------------------------------
-- 2) Trigger de updated_at
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
-- 3) RLS — SELECT público, escrita só com x-cc-token certo (PADRAO_TABELA.md)
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

-- GRANT vem ANTES das policies — sem ele o RLS nem chega a ser avaliado.
-- Sem DELETE: apagar uma célula é gravar estado '' (a grade nunca remove linha).
GRANT SELECT, INSERT, UPDATE ON public.meta_inovacao_matriz_celulas TO anon, authenticated;

CREATE POLICY "cc_select_publico" ON public.meta_inovacao_matriz_celulas
  FOR SELECT TO anon
  USING (true);

-- demandas.html grava por UPSERT no par (projeto_id, canal_id) — INSERT ... ON CONFLICT
-- DO UPDATE. Isso exige as DUAS policies abaixo: a de INSERT pro caminho novo e a de
-- UPDATE pro caminho de conflito. Faltando uma, metade das edições falha em silêncio.
CREATE POLICY "cc_token_insert" ON public.meta_inovacao_matriz_celulas
  FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90');

CREATE POLICY "cc_token_update" ON public.meta_inovacao_matriz_celulas
  FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90');


-- ---------------------------------------------------------------------------
-- 4) Auditoria (PADRAO_TABELA.md item 7) — a matriz é uma das tabelas "editáveis de
--    verdade", e a antiga já tinha o trigger (2026-08_auditoria.sql). O bloco só cria
--    se cc_audit() existir, pra este script continuar rodando num ambiente que ainda
--    não tem a auditoria instalada.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'cc_audit') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS cc_audit_matriz_celulas ON public.meta_inovacao_matriz_celulas';
    EXECUTE 'CREATE TRIGGER cc_audit_matriz_celulas
               AFTER INSERT OR UPDATE OR DELETE ON public.meta_inovacao_matriz_celulas
               FOR EACH ROW EXECUTE FUNCTION public.cc_audit()';
  ELSE
    RAISE NOTICE 'cc_audit() não existe neste banco — trigger de auditoria não criado.';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 5) Realtime — demandas.html assina postgres_changes nesta tabela pra atualizar a
--    grade quando outra pessoa edita. Sem a tabela na publicação, a assinatura
--    simplesmente nunca dispara (a página segue funcionando, só sem atualização
--    automática). Ignora o erro de "já está na publicação".
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_inovacao_matriz_celulas;
EXCEPTION
  WHEN duplicate_object THEN RAISE NOTICE 'meta_inovacao_matriz_celulas já está na publicação supabase_realtime.';
  WHEN undefined_object THEN RAISE NOTICE 'publicação supabase_realtime não existe neste banco — realtime não configurado.';
END $$;


-- ---------------------------------------------------------------------------
-- 6) Migração do dado: as 10 colunas físicas da tabela antiga viram linhas.
--    - casa iniciativa (texto) com meta_inovacao_projetos.iniciativa e slug de canal
--      com meta_inovacao_canais.slug — os dois casamentos são por igualdade exata,
--      sem heurística, que é justamente por que 2026-08_canais.sql preservou os slugs
--      de data/canais.js;
--    - só materializa célula com estado preenchido (ausente = vazia);
--    - ON CONFLICT DO NOTHING: rodar de novo não sobrescreve edição feita depois da
--      virada. Se o objetivo for RE-migrar por cima, troque por DO UPDATE
--      conscientemente — não é o caso normal.
-- ---------------------------------------------------------------------------
INSERT INTO public.meta_inovacao_matriz_celulas (projeto_id, canal_id, estado, updated_by)
SELECT p.id, c.id, v.estado, m.atualizado_por
FROM public.meta_inovacao_matriz_demandas m
JOIN public.meta_inovacao_projetos p
  ON p.iniciativa = m.iniciativa AND p.deleted_at IS NULL
CROSS JOIN LATERAL (VALUES
  ('foco', m.foco), ('cnr', m.cnr), ('empresa', m.empresa), ('portal', m.portal),
  ('mkt', m.mkt), ('loja', m.loja), ('rede', m.rede), ('assessoria', m.assessoria),
  ('dxp', m.dxp), ('contab', m.contab)
) AS v(slug, estado)
JOIN public.meta_inovacao_canais c
  ON c.slug = v.slug AND c.deleted_at IS NULL
WHERE COALESCE(v.estado, '') <> ''
ON CONFLICT (projeto_id, canal_id) DO NOTHING;


-- ---------------------------------------------------------------------------
-- 7) Verificação
-- ---------------------------------------------------------------------------
-- 7a) quantas células vieram, por estado
SELECT estado, count(*) AS celulas
FROM public.meta_inovacao_matriz_celulas
GROUP BY estado ORDER BY estado;

-- 7b) o que a tabela antiga tem preenchido e NÃO chegou na nova (deveria vir vazio).
--     Linha aqui = iniciativa que não casou com o portfólio ou canal que não casou com
--     o catálogo — resolver na mão antes de aposentar a tabela antiga (item 3.5).
SELECT m.iniciativa, v.slug, v.estado
FROM public.meta_inovacao_matriz_demandas m
CROSS JOIN LATERAL (VALUES
  ('foco', m.foco), ('cnr', m.cnr), ('empresa', m.empresa), ('portal', m.portal),
  ('mkt', m.mkt), ('loja', m.loja), ('rede', m.rede), ('assessoria', m.assessoria),
  ('dxp', m.dxp), ('contab', m.contab)
) AS v(slug, estado)
WHERE COALESCE(v.estado, '') <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.meta_inovacao_matriz_celulas mc
    JOIN public.meta_inovacao_projetos p ON p.id = mc.projeto_id
    JOIN public.meta_inovacao_canais c   ON c.id = mc.canal_id
    WHERE p.iniciativa = m.iniciativa AND c.slug = v.slug
  )
ORDER BY m.iniciativa, v.slug;

-- Pra REVERTER (só faz sentido antes de qualquer edição real na tabela nova):
--   DROP TABLE IF EXISTS public.meta_inovacao_matriz_celulas;
--   (a tabela antiga nunca foi tocada — voltar demandas.html/js/matriz-store.js pra ela
--    é um git revert, sem perda de dado.)
