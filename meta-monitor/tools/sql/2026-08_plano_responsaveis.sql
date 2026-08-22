-- ============================================================================
-- Golden record de cadastros de referência — Camada 2, item 2.6
-- ============================================================================
-- CREATE meta_inovacao_plano_responsaveis: junção ação do plano × (pessoa OU
-- coletivo), populada a partir de meta_inovacao_plano_acoes.responsavel_id
-- (text[] de ids da lista estática window.DB.responsaveis, data/pessoas.js) —
-- convive com o array de texto, que NÃO é tocado (Camada 5).
--
-- RESOLUÇÃO — diferente de 2.2 (que casa por nome normalizado), aqui os tokens
-- são IDS ESTÁVEIS ("jr", "comite", "gabriel_barreto_barros"...), não nomes — a
-- tradução id → pessoa/coletivo é a MESMA tabela que window.DB.responsaveis já
-- é (data/pessoas.js), reproduzida abaixo como VALUES porque não existe em
-- lugar nenhum do banco. Cada id vira exatamente 1 pessoa OU 1 coletivo:
--   - "jr" e "jose_mendes_junior" → MESMA pessoa (José Mendes de Oliveira
--     Júnior, nome_exibicao "JR.") — confirmado por José em 22/08/2026
--     (CAMADA1_DEDUPE_PESSOAS.md §3.2); os 2 ids continuam existindo em
--     window.DB.responsaveis (decisão de UX da Camada 4, não deste script),
--     mas resolvem pro mesmo pessoa_id aqui.
--   - "sandra" e "sandra_chaves_paraiso" → mesma lógica, mesma pessoa (§3.1).
--   - "gerencia"/"comite"/"urc"/"solucoes"/"coordenadores"/"gestores" → os 6
--     coletivos (Camada 0 + o complemento "Gerência UI" do item 1.3).
--   - os demais (pessoas físicas, curto ou completo) → pessoa por
--     nome_exibicao (golden record, item 1.3).
-- Se algum id aparecer em responsavel_id e não estiver nesta tabela de tradução
-- (não deveria — são só os 32 ids conhecidos de window.DB.responsaveis), a
-- verificação da seção final acusa.
--
-- ORDEM DE EXECUÇÃO: depois de 2026-08_plano.sql (cria meta_inovacao_plano_acoes),
-- 2026-08_pessoas_golden.sql (item 1.3) e 2026-08_coletivos_gerencia_ui.sql.
-- IDEMPOTENTE.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.meta_inovacao_plano_acoes') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_plano_acoes não existe — rode tools/sql/2026-08_plano.sql antes deste script.';
  END IF;
  IF to_regclass('public.meta_inovacao_pessoas') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_pessoas não existe — rode tools/sql/2026-08_migracao_modo_edicao.sql antes deste script.';
  END IF;
  IF to_regclass('public.meta_inovacao_coletivos') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_coletivos não existe — rode tools/sql/2026-08_coletivos.sql (Camada 0) antes deste script.';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 1) Tabela
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_inovacao_plano_responsaveis (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  plano_acao_id text NOT NULL REFERENCES public.meta_inovacao_plano_acoes(id),
  pessoa_id     bigint REFERENCES public.meta_inovacao_pessoas(id),
  coletivo_id   bigint REFERENCES public.meta_inovacao_coletivos(id),
  ordem         int,                 -- posição original em responsavel_id[]
  deleted_at    timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text,
  CONSTRAINT cc_plano_resp_exatamente_um CHECK (
    (pessoa_id IS NOT NULL AND coletivo_id IS NULL) OR (pessoa_id IS NULL AND coletivo_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS meta_inovacao_plano_responsaveis_pessoa_idx
  ON public.meta_inovacao_plano_responsaveis (plano_acao_id, pessoa_id) WHERE deleted_at IS NULL AND pessoa_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS meta_inovacao_plano_responsaveis_coletivo_idx
  ON public.meta_inovacao_plano_responsaveis (plano_acao_id, coletivo_id) WHERE deleted_at IS NULL AND coletivo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS meta_inovacao_plano_responsaveis_plano_idx
  ON public.meta_inovacao_plano_responsaveis (plano_acao_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.cc_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cc_touch_updated_at_plano_resp ON public.meta_inovacao_plano_responsaveis;
CREATE TRIGGER cc_touch_updated_at_plano_resp
  BEFORE UPDATE ON public.meta_inovacao_plano_responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meta_inovacao_plano_responsaveis'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_plano_responsaveis', pol.policyname); END LOOP;
END $$;

ALTER TABLE public.meta_inovacao_plano_responsaveis ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.meta_inovacao_plano_responsaveis TO anon, authenticated;

CREATE POLICY "cc_select_publico" ON public.meta_inovacao_plano_responsaveis
  FOR SELECT TO anon USING (true);
CREATE POLICY "cc_token_insert" ON public.meta_inovacao_plano_responsaveis
  FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90');
CREATE POLICY "cc_token_update" ON public.meta_inovacao_plano_responsaveis
  FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90');

-- Pra REVERTER (só faz sentido logo depois de criar):
--   DROP TABLE IF EXISTS public.meta_inovacao_plano_responsaveis;


-- ---------------------------------------------------------------------------
-- 2) Tabela de tradução id → (tipo, alvo) — espelha window.DB.responsaveis
--    (data/pessoas.js) inteiro, os 32 ids conhecidos hoje.
-- ---------------------------------------------------------------------------
-- SEM "ON COMMIT DROP": o Supabase SQL Editor roda o script inteiro numa única
-- transação, mas rodar este arquivo statement-a-statement (psql -f sem
-- --single-transaction, por exemplo) confirma cada comando na hora — "ON COMMIT
-- DROP" apagaria a tabela antes do INSERT/JOIN seguinte conseguirem usá-la. Tabela
-- TEMP já some sozinha no fim da sessão, então não precisa do ON COMMIT pra isso.
DROP TABLE IF EXISTS cc_tmp_responsaveis_map;
CREATE TEMP TABLE cc_tmp_responsaveis_map (id text PRIMARY KEY, tipo text, alvo text);
INSERT INTO cc_tmp_responsaveis_map (id, tipo, alvo) VALUES
  ('jr', 'pessoa', 'JR.'),
  ('sandra', 'pessoa', 'Sandra'),
  ('anny', 'pessoa', 'Anny'),
  ('pova', 'pessoa', 'Pova'),
  ('gerencia', 'coletivo', 'Gerência UI'),

  ('comite', 'coletivo', 'Comitê'),
  ('urc', 'coletivo', 'URC'),
  ('solucoes', 'coletivo', 'Soluções'),
  ('coordenadores', 'coletivo', 'Coordenadores'),
  ('gestores', 'coletivo', 'Gestores dos projetos'),

  ('gabriel_barreto_barros', 'pessoa', 'Gabriel'),
  ('hulda_giesbrecht', 'pessoa', 'Hulda'),
  ('lara_chicuta_franco', 'pessoa', 'Lara'),
  ('marcus_lopes_bezerra', 'pessoa', 'Marcus'),
  ('matheus_queiroz_campos', 'pessoa', 'Matheus'),
  ('paulo_puppin_zandonadi', 'pessoa', 'Paulo'),
  ('sandra_chaves_paraiso', 'pessoa', 'Sandra'),        -- mesma pessoa de "sandra"
  ('jose_mendes_junior', 'pessoa', 'JR.'),               -- mesma pessoa de "jr"

  ('agnaldo', 'pessoa', 'Agnaldo'),
  ('carol', 'pessoa', 'Carol'),
  ('cris', 'pessoa', 'Cris'),
  ('dario', 'pessoa', 'Dario'),
  ('felipe', 'pessoa', 'Felipe'),
  ('fernanda', 'pessoa', 'Fernanda'),
  ('fred', 'pessoa', 'Fred'),
  ('jessica', 'pessoa', 'Jéssica'),
  ('rafa', 'pessoa', 'Rafa'),
  ('raquel', 'pessoa', 'Raquel'),
  ('thiago', 'pessoa', 'Thiago'),
  ('valeria', 'pessoa', 'Valéria'),
  ('webia', 'pessoa', 'Wébia');


-- ---------------------------------------------------------------------------
-- 3) Popular — desdobra responsavel_id[] (WITH ORDINALITY preserva a posição).
-- ---------------------------------------------------------------------------
WITH tokens AS (
  SELECT pa.id AS plano_acao_id, tok.valor AS resp_id, tok.pos AS ordem
  FROM public.meta_inovacao_plano_acoes pa
  CROSS JOIN LATERAL unnest(pa.responsavel_id) WITH ORDINALITY AS tok(valor, pos)
  WHERE pa.deleted_at IS NULL
),
resolvido AS (
  SELECT
    t.plano_acao_id, t.ordem, m.tipo,
    CASE WHEN m.tipo = 'pessoa' THEN
      (SELECT p.id FROM public.meta_inovacao_pessoas p WHERE p.deleted_at IS NULL AND p.nome_exibicao = m.alvo ORDER BY p.id LIMIT 1)
    END AS pessoa_id,
    CASE WHEN m.tipo = 'coletivo' THEN
      (SELECT c.id FROM public.meta_inovacao_coletivos c WHERE c.deleted_at IS NULL AND c.nome = m.alvo ORDER BY c.id LIMIT 1)
    END AS coletivo_id
  FROM tokens t
  JOIN cc_tmp_responsaveis_map m ON m.id = t.resp_id
)
INSERT INTO public.meta_inovacao_plano_responsaveis (plano_acao_id, pessoa_id, coletivo_id, ordem)
SELECT r.plano_acao_id, r.pessoa_id, r.coletivo_id, r.ordem
FROM resolvido r
WHERE (r.pessoa_id IS NOT NULL OR r.coletivo_id IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM public.meta_inovacao_plano_responsaveis e
    WHERE e.plano_acao_id = r.plano_acao_id
      AND e.pessoa_id IS NOT DISTINCT FROM r.pessoa_id
      AND e.coletivo_id IS NOT DISTINCT FROM r.coletivo_id
      AND e.deleted_at IS NULL
  );

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verificação
-- ============================================================================
-- (a) ids de responsavel_id[] que NÃO estão na tabela de tradução (§2) — esperado
--     0 linhas; se aparecer algo, window.DB.responsaveis ganhou um id novo desde
--     que este script foi escrito e a tabela de tradução precisa de manutenção:
WITH tokens AS (
  SELECT DISTINCT tok.valor AS resp_id
  FROM public.meta_inovacao_plano_acoes pa
  CROSS JOIN LATERAL unnest(pa.responsavel_id) AS tok(valor)
  WHERE pa.deleted_at IS NULL
)
SELECT t.resp_id
FROM tokens t
LEFT JOIN (VALUES
  ('jr'),('sandra'),('anny'),('pova'),('gerencia'),('comite'),('urc'),('solucoes'),
  ('coordenadores'),('gestores'),('gabriel_barreto_barros'),('hulda_giesbrecht'),
  ('lara_chicuta_franco'),('marcus_lopes_bezerra'),('matheus_queiroz_campos'),
  ('paulo_puppin_zandonadi'),('sandra_chaves_paraiso'),('jose_mendes_junior'),
  ('agnaldo'),('carol'),('cris'),('dario'),('felipe'),('fernanda'),('fred'),
  ('jessica'),('rafa'),('raquel'),('thiago'),('valeria'),('webia')
) AS conhecidos(id) ON conhecidos.id = t.resp_id
WHERE conhecidos.id IS NULL;

-- (b) contagem total:
SELECT count(*) AS total_vinculos FROM public.meta_inovacao_plano_responsaveis WHERE deleted_at IS NULL;

-- (c) conferência visual — ação × responsáveis resolvidos (pessoa ou coletivo):
SELECT pa.id AS acao, pa.atividade,
       string_agg(COALESCE(p.nome_completo, p.nome_exibicao, c.nome), ', ' ORDER BY r.ordem) AS responsaveis
FROM public.meta_inovacao_plano_responsaveis r
JOIN public.meta_inovacao_plano_acoes pa ON pa.id = r.plano_acao_id
LEFT JOIN public.meta_inovacao_pessoas p ON p.id = r.pessoa_id
LEFT JOIN public.meta_inovacao_coletivos c ON c.id = r.coletivo_id
WHERE r.deleted_at IS NULL
GROUP BY pa.id, pa.atividade
ORDER BY pa.id
LIMIT 10;
