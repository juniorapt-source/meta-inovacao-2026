-- ============================================================================
-- Golden record de cadastros de referência — Camada 2, item 2.2
-- ============================================================================
-- CREATE meta_inovacao_projeto_representantes: junção projeto × pessoa, populada
-- a partir de meta_inovacao_projetos.representantes (text[], 34 instâncias em 27
-- projetos) — convive com o array de texto, que NÃO é tocado (Camada 5).
--
-- RESOLUÇÃO DE NOME — o motivo deste item ser "esforço alto": os 34 tokens de
-- `representantes` são nomes curtos ("Carol", "Matheus", "Jr.") que precisam achar
-- a pessoa certa em meta_inovacao_pessoas. Estratégia, na ordem:
--   1) casa contra `nome` (a maioria dos 13 golden records novos do item 1.3 foi
--      inserida com `nome` = o próprio token de representantes — "Carol", "Felipe",
--      etc. — casamento direto);
--   2) senão, casa contra `nome_exibicao` (as pessoas que já tinham linha própria
--      ganharam nome_exibicao curto no item 1.3 — "Matheus", "Hulda", "Gabriel",
--      "Pova", "JR." — cobre os tokens que abreviam um nome completo);
--   3) senão, um alias explícito — só 1 caso: "Júnior" (se essa for a grafia que
--      está em produção, em vez de "Jr." de data/projetos.js) aponta pra mesma
--      pessoa de nome_exibicao "JR." — mesmo par que js/responsaveis.js.ALIASES já
--      resolve (`jr`/`junior` → hoje a MESMA pessoa física, confirmado por José em
--      22/08/2026, CAMADA1_DEDUPE_PESSOAS.md §3.2).
--   "Núcleo de Startups" (Sebrae Startups) fica de propósito SEM casar em nenhuma
--   das 3 — é o placeholder intencional de "aguarda indicação nominal"
--   (docs/GOVERNANCA_GOLDEN_RECORD.md, Camada 4 — já investigado e confirmado que
--   não é órfão acidental). Verificação da seção final espera só ele como não
--   resolvido.
--
-- ORDEM DE EXECUÇÃO: depois de 2026-08_migracao_modo_edicao.sql (cria
-- meta_inovacao_projetos) e 2026-08_pessoas_golden.sql (Camada 1, item 1.3 — quem
-- dá nome_exibicao/nome às pessoas que este script casa).
-- IDEMPOTENTE.
-- ============================================================================

DO $$
BEGIN
  IF to_regclass('public.meta_inovacao_projetos') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_projetos não existe — rode tools/sql/2026-08_migracao_modo_edicao.sql antes deste script.';
  END IF;
  IF to_regclass('public.meta_inovacao_pessoas') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_pessoas não existe — rode tools/sql/2026-08_migracao_modo_edicao.sql antes deste script.';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 1) Normalização — mesma régua de js/responsaveis.js.RESP.normalizar (minúsculas,
--    sem acento, sem ponto, trim) pra tokens curtos de representantes[] casarem
--    com nome/nome_exibicao independente de acento/maiúscula/pontuação.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cc_pessoa_normalizar(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT btrim(replace(
    translate(
      lower(coalesce(txt, '')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    ),
    '.', ''
  ));
$$;


-- ---------------------------------------------------------------------------
-- 2) Tabela
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_inovacao_projeto_representantes (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  projeto_id bigint NOT NULL REFERENCES public.meta_inovacao_projetos(id),
  pessoa_id  bigint NOT NULL REFERENCES public.meta_inovacao_pessoas(id),
  ordem      int,                    -- posição original em representantes[]
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

CREATE UNIQUE INDEX IF NOT EXISTS meta_inovacao_projeto_representantes_par_idx
  ON public.meta_inovacao_projeto_representantes (projeto_id, pessoa_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS meta_inovacao_projeto_representantes_projeto_idx
  ON public.meta_inovacao_projeto_representantes (projeto_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.cc_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cc_touch_updated_at_proj_repr ON public.meta_inovacao_projeto_representantes;
CREATE TRIGGER cc_touch_updated_at_proj_repr
  BEFORE UPDATE ON public.meta_inovacao_projeto_representantes
  FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meta_inovacao_projeto_representantes'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_projeto_representantes', pol.policyname); END LOOP;
END $$;

ALTER TABLE public.meta_inovacao_projeto_representantes ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.meta_inovacao_projeto_representantes TO anon, authenticated;

CREATE POLICY "cc_select_publico" ON public.meta_inovacao_projeto_representantes
  FOR SELECT TO anon USING (true);
CREATE POLICY "cc_token_insert" ON public.meta_inovacao_projeto_representantes
  FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90');
CREATE POLICY "cc_token_update" ON public.meta_inovacao_projeto_representantes
  FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90');

-- Pra REVERTER (só faz sentido logo depois de criar):
--   DROP TABLE IF EXISTS public.meta_inovacao_projeto_representantes;
--   DROP FUNCTION IF EXISTS public.cc_pessoa_normalizar(text);


-- ---------------------------------------------------------------------------
-- 3) Popular — desdobra representantes[] (WITH ORDINALITY preserva a posição
--    original), resolve pessoa pelos 3 passos do cabeçalho, ignora o que não
--    resolver (fica só no relatório de verificação, não é erro).
-- ---------------------------------------------------------------------------
WITH tokens AS (
  SELECT pr.id AS projeto_id, tok.valor AS token, tok.pos AS ordem
  FROM public.meta_inovacao_projetos pr
  CROSS JOIN LATERAL unnest(pr.representantes) WITH ORDINALITY AS tok(valor, pos)
  WHERE pr.deleted_at IS NULL
),
resolvido AS (
  SELECT
    t.projeto_id, t.token, t.ordem,
    COALESCE(
      -- passo 1: nome exato
      (SELECT p.id FROM public.meta_inovacao_pessoas p
       WHERE p.deleted_at IS NULL AND public.cc_pessoa_normalizar(p.nome) = public.cc_pessoa_normalizar(t.token)
       ORDER BY p.id LIMIT 1),
      -- passo 2: nome_exibicao
      (SELECT p.id FROM public.meta_inovacao_pessoas p
       WHERE p.deleted_at IS NULL AND public.cc_pessoa_normalizar(p.nome_exibicao) = public.cc_pessoa_normalizar(t.token)
       ORDER BY p.id LIMIT 1),
      -- passo 3: alias "júnior" -> mesma pessoa de nome_exibicao "JR."
      (CASE WHEN public.cc_pessoa_normalizar(t.token) = 'junior' THEN
         (SELECT p.id FROM public.meta_inovacao_pessoas p
          WHERE p.deleted_at IS NULL AND p.nome_exibicao = 'JR.' ORDER BY p.id LIMIT 1)
       END)
    ) AS pessoa_id
  FROM tokens t
)
INSERT INTO public.meta_inovacao_projeto_representantes (projeto_id, pessoa_id, ordem)
SELECT r.projeto_id, r.pessoa_id, r.ordem
FROM resolvido r
WHERE r.pessoa_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.meta_inovacao_projeto_representantes existing
    WHERE existing.projeto_id = r.projeto_id AND existing.pessoa_id = r.pessoa_id AND existing.deleted_at IS NULL
  );

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verificação
-- ============================================================================
-- (a) tokens NÃO resolvidos — esperado só "Núcleo de Startups" (placeholder
--     intencional, ver cabeçalho). Qualquer outro nome aqui é bug/regressão pra
--     investigar antes de seguir.
WITH tokens AS (
  SELECT pr.iniciativa, tok.valor AS token
  FROM public.meta_inovacao_projetos pr
  CROSS JOIN LATERAL unnest(pr.representantes) WITH ORDINALITY AS tok(valor, pos)
  WHERE pr.deleted_at IS NULL
)
SELECT t.iniciativa, t.token
FROM tokens t
WHERE NOT EXISTS (
  SELECT 1 FROM public.meta_inovacao_pessoas p
  WHERE p.deleted_at IS NULL AND (
    public.cc_pessoa_normalizar(p.nome) = public.cc_pessoa_normalizar(t.token)
    OR public.cc_pessoa_normalizar(p.nome_exibicao) = public.cc_pessoa_normalizar(t.token)
  )
) AND public.cc_pessoa_normalizar(t.token) <> 'junior'
ORDER BY t.iniciativa;

-- (b) contagem — esperado 33 linhas (34 instâncias − 1 placeholder "Núcleo de Startups"):
SELECT count(*) AS total_vinculos FROM public.meta_inovacao_projeto_representantes WHERE deleted_at IS NULL;

-- (c) conferência visual — projeto × representantes resolvidos. COALESCE porque
--     14 das pessoas ainda não têm nome_completo preenchido (§3.3 do relatório de
--     dedupe) — cai pro nome_exibicao/nome nesse caso, só pra esta lista não sair
--     com célula vazia.
SELECT pr.iniciativa,
       string_agg(COALESCE(p.nome_completo, p.nome_exibicao, p.nome), ', ' ORDER BY r.ordem) AS representantes_resolvidos
FROM public.meta_inovacao_projeto_representantes r
JOIN public.meta_inovacao_projetos pr ON pr.id = r.projeto_id
JOIN public.meta_inovacao_pessoas p ON p.id = r.pessoa_id
WHERE r.deleted_at IS NULL
GROUP BY pr.iniciativa
ORDER BY pr.iniciativa;
