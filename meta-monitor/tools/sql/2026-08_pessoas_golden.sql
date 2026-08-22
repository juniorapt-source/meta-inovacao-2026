-- ============================================================================
-- Golden record de cadastros de referência — Camada 1, item 1.3
-- ============================================================================
-- Ref.: PLANO_EXECUCAO_GOLDEN_RECORD.md, Camada 1 · CAMADA1_DEDUPE_PESSOAS.md
-- (levantamento do item 1.1, confirmado por José em 22/08/2026 — item 1.2).
--
-- O QUE ESTE SCRIPT FAZ:
--   1) ALTER meta_inovacao_pessoas: + nome_completo, nome_exibicao, email, ativo.
--      NÃO mexe em nome/papel/grupo/nucleo/pendente/ordem — ficam como estão,
--      convivendo com as colunas novas (mesmo padrão da Camada 2 do golden record
--      de projetos: aposentar texto livre é Camada 5, não agora). As 20 linhas
--      atuais continuam sendo o que participantes.html/editor.html leem hoje —
--      este script só ENRIQUECE essas linhas, não apaga nem funde nenhuma.
--   2) CREATE meta_inovacao_pessoa_papeis: junção pessoa × contexto (UI/Comitê/
--      Núcleo), pro caso de uma pessoa acumular mais de um papel — como Sandra
--      (assistente do plano + Comitê + núcleo Gestão do Conhecimento) e JR.
--      (coordenação + núcleo Inovação para Competitividade), confirmados por
--      José como a MESMA pessoa em cada caso (ver §3.1/§3.2 do relatório).
--   3) Enriquece as 10 pessoas que já tinham linha (uma ou mais, por causa dos
--      grupos duplicados) com nome_completo/nome_exibicao, e grava os papéis
--      correspondentes.
--   4) Insere as 27 pessoas que só apareciam em `representantes`/
--      `urc_lideranca`/`urc_canais_responsaveis` e ainda não tinham linha própria
--      em meta_inovacao_pessoas — SEM criar FK pra essas tabelas ainda (isso é
--      Camada 2, itens 2.2/2.3/2.4). grupo='Projetos' pros representantes de
--      projeto, grupo='URC' pra liderança/responsáveis de canal — grupo é texto
--      livre nesta tabela (sem CHECK), então não colide com "UI"/"Comitê"/
--      "Núcleos" já usados.
--
-- O QUE ESTE SCRIPT NÃO FAZ (fica pra depois, de propósito):
--   - Não popula pessoa_id em urc_lideranca/urc_canais_responsaveis/projetos —
--     Camada 2.
--   - Não muda "Gerência UI" nem soft-deleta a linha dela — ela vira coletivo à
--     parte, em 2026-08_coletivos_gerencia_ui.sql (irmão deste script), e a
--     linha antiga de pessoas.js segue existindo até a Camada 5 decidir o que
--     fazer com o texto legado.
--   - NÃO usa a coluna `pendente` pra marcar "falta nome completo" — `pendente`
--     já tem um significado diferente e em produção (participantes.html: chip
--     "indicação pendente — CAN-05", uma nomeação ainda não formalizada). As 15
--     pessoas cujo nome completo José decidiu deixar em aberto (editar depois
--     direto no site) ficam com nome_completo NULL — é essa nulidade que marca
--     "falta preencher", não um novo overload de `pendente`.
--
-- ORDEM DE EXECUÇÃO: depois de 2026-08_migracao_modo_edicao.sql (cria
-- meta_inovacao_pessoas) e de 2026-08_nucleos.sql (Camada 0 — pessoa_papeis
-- referencia meta_inovacao_nucleos por nome via subquery, não por id fixo, mas a
-- tabela precisa existir). Sem NOTIFY explícito de reload pro cache de schema
-- reconhecer as colunas novas antes da 1ª leitura pela API — ver seção 6.
--
-- IDEMPOTENTE: pode rodar de novo — ADD COLUMN IF NOT EXISTS, CREATE TABLE IF
-- NOT EXISTS, UPDATEs são só atribuição (não acumulam), INSERTs com WHERE NOT
-- EXISTS.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 0) Pré-requisito — falha cedo se a base não é a que o script espera
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.meta_inovacao_pessoas') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_pessoas não existe — rode tools/sql/2026-08_migracao_modo_edicao.sql antes deste script.';
  END IF;
  IF to_regclass('public.meta_inovacao_nucleos') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_nucleos não existe — rode tools/sql/2026-08_nucleos.sql (Camada 0) antes deste script.';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 1) ALTER meta_inovacao_pessoas — 4 colunas novas, todas nullable (não quebra
--    nenhuma linha existente nem exige preencher tudo de uma vez).
-- ---------------------------------------------------------------------------
ALTER TABLE public.meta_inovacao_pessoas
  ADD COLUMN IF NOT EXISTS nome_completo text,
  ADD COLUMN IF NOT EXISTS nome_exibicao text,
  ADD COLUMN IF NOT EXISTS email         text,
  ADD COLUMN IF NOT EXISTS ativo         boolean NOT NULL DEFAULT true;


-- ---------------------------------------------------------------------------
-- 2) CREATE meta_inovacao_pessoa_papeis
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_inovacao_pessoa_papeis (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pessoa_id  bigint NOT NULL REFERENCES public.meta_inovacao_pessoas(id),
  contexto   text NOT NULL,             -- 'UI' | 'Comite' | 'Nucleo'
  nucleo_id  bigint REFERENCES public.meta_inovacao_nucleos(id),  -- só quando contexto='Nucleo'
  papel      text,
  deleted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  CONSTRAINT cc_pessoa_papeis_contexto_valido CHECK (contexto IN ('UI', 'Comite', 'Nucleo')),
  CONSTRAINT cc_pessoa_papeis_nucleo_soh_se_contexto CHECK (
    (contexto = 'Nucleo' AND nucleo_id IS NOT NULL) OR (contexto <> 'Nucleo' AND nucleo_id IS NULL)
  )
);

-- evita gravar o mesmo papel 2x pra mesma pessoa por engano (relevante pro
-- contexto='Nucleo', onde o par (pessoa,nucleo) é o que precisa ser único; UI/Comite
-- não têm nucleo_id, então o índice trata NULL como valores distintos — cada pessoa
-- só deveria ter 1 linha de UI e 1 de Comite mesmo assim, mas isso não é uma
-- invariante que valha travar com constraint agora).
CREATE UNIQUE INDEX IF NOT EXISTS meta_inovacao_pessoa_papeis_pessoa_nucleo_idx
  ON public.meta_inovacao_pessoa_papeis (pessoa_id, nucleo_id)
  WHERE deleted_at IS NULL AND contexto = 'Nucleo';

CREATE INDEX IF NOT EXISTS meta_inovacao_pessoa_papeis_pessoa_idx
  ON public.meta_inovacao_pessoa_papeis (pessoa_id) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.cc_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cc_touch_updated_at_pessoa_papeis ON public.meta_inovacao_pessoa_papeis;
CREATE TRIGGER cc_touch_updated_at_pessoa_papeis
  BEFORE UPDATE ON public.meta_inovacao_pessoa_papeis
  FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meta_inovacao_pessoa_papeis'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_pessoa_papeis', pol.policyname); END LOOP;
END $$;

ALTER TABLE public.meta_inovacao_pessoa_papeis ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.meta_inovacao_pessoa_papeis TO anon, authenticated;

CREATE POLICY "cc_select_publico" ON public.meta_inovacao_pessoa_papeis
  FOR SELECT TO anon USING (true);
CREATE POLICY "cc_token_insert" ON public.meta_inovacao_pessoa_papeis
  FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90');
CREATE POLICY "cc_token_update" ON public.meta_inovacao_pessoa_papeis
  FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90');

-- Pra REVERTER (só faz sentido logo depois de criar, antes de qualquer edição real):
--   DROP TABLE IF EXISTS public.meta_inovacao_pessoa_papeis;
--   ALTER TABLE public.meta_inovacao_pessoas
--     DROP COLUMN IF EXISTS nome_completo, DROP COLUMN IF EXISTS nome_exibicao,
--     DROP COLUMN IF EXISTS email, DROP COLUMN IF EXISTS ativo;


-- ---------------------------------------------------------------------------
-- 3) Enriquecer as 10 pessoas que já têm linha (1 a 3 linhas cada, por causa
--    dos grupos duplicados) com nome_completo/nome_exibicao. Casa por `nome`
--    exato do seed original (2026-08_migracao_modo_edicao.sql) — se alguma
--    dessas linhas já foi editada manualmente em produção desde então, o
--    UPDATE correspondente afeta 0 linhas (não quebra o script) e sobra pra
--    verificação da seção 7 pegar.
-- ---------------------------------------------------------------------------
UPDATE public.meta_inovacao_pessoas SET nome_completo = 'José Mendes de Oliveira Júnior', nome_exibicao = 'JR.'
  WHERE nome IN ('JR. (José Júnior)', 'José Mendes de Oliveira Júnior') AND deleted_at IS NULL;

UPDATE public.meta_inovacao_pessoas SET nome_completo = 'Sandra Chaves Silva Paraíso', nome_exibicao = 'Sandra'
  WHERE nome IN ('Sandra', 'Sandra Chaves Silva Paraíso') AND deleted_at IS NULL;

UPDATE public.meta_inovacao_pessoas SET nome_completo = 'Gabriel Silva Povoa', nome_exibicao = 'Pova'
  WHERE nome = 'Pova' AND deleted_at IS NULL;

UPDATE public.meta_inovacao_pessoas SET nome_exibicao = 'Anny'
  WHERE nome = 'Anny' AND deleted_at IS NULL;  -- nome_completo fica NULL — José edita depois no site

UPDATE public.meta_inovacao_pessoas SET nome_completo = 'Gabriel Gil Barreto Barros', nome_exibicao = 'Gabriel'
  WHERE nome = 'Gabriel Gil Barreto Barros' AND deleted_at IS NULL;
UPDATE public.meta_inovacao_pessoas SET nome_completo = 'Hulda Oliveira Giesbrecht', nome_exibicao = 'Hulda'
  WHERE nome = 'Hulda Oliveira Giesbrecht' AND deleted_at IS NULL;
UPDATE public.meta_inovacao_pessoas SET nome_completo = 'Lara Chicuta Franco', nome_exibicao = 'Lara'
  WHERE nome = 'Lara Chicuta Franco' AND deleted_at IS NULL;
UPDATE public.meta_inovacao_pessoas SET nome_completo = 'Marcus Vinicius Lopes Bezerra', nome_exibicao = 'Marcus'
  WHERE nome = 'Marcus Vinicius Lopes Bezerra' AND deleted_at IS NULL;
UPDATE public.meta_inovacao_pessoas SET nome_completo = 'Matheus Lopes de Queiroz Campos', nome_exibicao = 'Matheus'
  WHERE nome = 'Matheus Lopes de Queiroz Campos' AND deleted_at IS NULL;
UPDATE public.meta_inovacao_pessoas SET nome_completo = 'Paulo Puppin Zandonadi', nome_exibicao = 'Paulo'
  WHERE nome = 'Paulo Puppin Zandonadi' AND deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 4) Papéis das 10 pessoas acima — 1 linha por (pessoa, contexto). O pessoa_id
--    usado é sempre o da linha "âncora" (a de menor ordem entre as que casam
--    pelo nome_completo já gravado no passo 3) — não importa qual das
--    linhas duplicadas é a âncora, porque nenhuma tela ainda lê pessoa_papeis
--    (isso é Camada 4); o que importa é ter EXATAMENTE 1 pessoa_id por pessoa
--    física aqui.
-- ---------------------------------------------------------------------------
WITH ancora AS (
  SELECT DISTINCT ON (nome_completo) id, nome_completo
  FROM public.meta_inovacao_pessoas
  WHERE nome_completo IS NOT NULL AND deleted_at IS NULL
  ORDER BY nome_completo, ordem NULLS LAST, id
)
INSERT INTO public.meta_inovacao_pessoa_papeis (pessoa_id, contexto, nucleo_id, papel)
SELECT a.id, v.contexto,
       (SELECT n.id FROM public.meta_inovacao_nucleos n WHERE n.nome = v.nucleo_nome AND n.deleted_at IS NULL),
       v.papel
FROM ancora a
JOIN (VALUES
  ('José Mendes de Oliveira Júnior', 'UI',     NULL::text, 'Coordenação do plano · ponto de contato com a URC'),
  ('José Mendes de Oliveira Júnior', 'Nucleo', 'Inovação para Competitividade', NULL),

  ('Sandra Chaves Silva Paraíso',    'UI',     NULL, 'Assistente do plano: agendas, prazos, monitoramento, boletim'),
  ('Sandra Chaves Silva Paraíso',    'Comite', NULL, 'Comitê de Atendimento e Relacionamento da Inovação'),
  ('Sandra Chaves Silva Paraíso',    'Nucleo', 'Gestão do Conhecimento e Processos', NULL),

  ('Gabriel Silva Povoa',            'UI',     NULL, 'Agente de IA de apoio ao formulário (CAN-08/09)'),

  ('Gabriel Gil Barreto Barros',     'Comite', NULL, 'Comitê de Atendimento e Relacionamento da Inovação'),
  ('Gabriel Gil Barreto Barros',     'Nucleo', 'Tecnologias Portadoras de Futuro', NULL),

  ('Hulda Oliveira Giesbrecht',      'Comite', NULL, 'Comitê de Atendimento e Relacionamento da Inovação'),
  ('Hulda Oliveira Giesbrecht',      'Nucleo', 'Tecnologias Portadoras de Futuro', NULL),

  ('Lara Chicuta Franco',            'Comite', NULL, 'Comitê de Atendimento e Relacionamento da Inovação'),
  ('Lara Chicuta Franco',            'Nucleo', 'Gestão do Conhecimento e Processos', NULL),

  ('Marcus Vinicius Lopes Bezerra',  'Comite', NULL, 'Comitê de Atendimento e Relacionamento da Inovação'),
  ('Marcus Vinicius Lopes Bezerra',  'Nucleo', 'Inovação Territorial', NULL),

  ('Matheus Lopes de Queiroz Campos','Comite', NULL, 'Comitê de Atendimento e Relacionamento da Inovação'),
  ('Matheus Lopes de Queiroz Campos','Nucleo', 'Inovação para Competitividade', NULL),

  ('Paulo Puppin Zandonadi',         'Comite', NULL, 'Comitê de Atendimento e Relacionamento da Inovação'),
  ('Paulo Puppin Zandonadi',         'Nucleo', 'Startups', NULL)
) AS v(nome_completo, contexto, nucleo_nome, papel)
  ON v.nome_completo = a.nome_completo
WHERE NOT EXISTS (
  SELECT 1 FROM public.meta_inovacao_pessoa_papeis pp
  WHERE pp.pessoa_id = a.id AND pp.contexto = v.contexto
    AND pp.deleted_at IS NULL
    AND (pp.nucleo_id IS NOT DISTINCT FROM (SELECT n.id FROM public.meta_inovacao_nucleos n WHERE n.nome = v.nucleo_nome AND n.deleted_at IS NULL))
);


-- ---------------------------------------------------------------------------
-- 5) As 27 pessoas confirmadas em 1.1/1.2 que ainda não têm linha própria —
--    representantes de projeto (grupo='Projetos') e liderança/responsáveis de
--    canal da URC (grupo='URC'). nome_completo NULL nas 15 cujo José decidiu
--    deixar em aberto (edita depois direto no site).
-- ---------------------------------------------------------------------------
INSERT INTO public.meta_inovacao_pessoas (nome, nome_completo, nome_exibicao, papel, grupo, email, ordem)
SELECT v.nome, v.nome_completo, v.nome_exibicao, v.papel, v.grupo, v.email, v.ordem
FROM (VALUES
  -- representantes de projeto sem nome completo confirmado ainda
  ('Carol',    NULL::text, 'Carol',    NULL::text, 'Projetos', NULL::text, 21),
  ('Fred',     NULL,       'Fred',     NULL,       'Projetos', NULL,       22),
  ('Thiago',   NULL,       'Thiago',   NULL,       'Projetos', NULL,       23),
  ('Raquel',   NULL,       'Raquel',   NULL,       'Projetos', NULL,       24),
  ('Dario',    NULL,       'Dario',    NULL,       'Projetos', NULL,       25),
  ('Rafa',     NULL,       'Rafa',     NULL,       'Projetos', NULL,       26),
  ('Cris',     NULL,       'Cris',     NULL,       'Projetos', NULL,       27),
  ('Wébia',    NULL,       'Wébia',    NULL,       'Projetos', NULL,       28),
  ('Jéssica',  NULL,       'Jéssica',  NULL,       'Projetos', NULL,       29),
  ('Fernanda', NULL,       'Fernanda', NULL,       'Projetos', NULL,       30),
  ('Agnaldo',  NULL,       'Agnaldo',  NULL,       'Projetos', NULL,       31),
  ('Valéria',  NULL,       'Valéria',  NULL,       'Projetos', NULL,       32),
  -- representante de projeto com nome completo confirmado (§3.4)
  ('Felipe', 'Philippe Fauguet Figueiredo', 'Felipe', NULL, 'Projetos', NULL, 33),

  -- URC — liderança, sem nome completo ainda (papel já é conhecido)
  ('Enio',  NULL, 'Enio',  'Gerente da URC', 'URC', NULL, 34),
  ('Milva', NULL, 'Milva', 'Gerente adjunta da URC', 'URC', NULL, 35),
  -- URC — liderança, nome completo e e-mail já conhecidos
  ('Iuri Barbosa de Andrade', 'Iuri Barbosa de Andrade', 'Iuri', 'Coordenador do núcleo de canais da URC', 'URC', 'iuri.andrade@sebrae.com.br', 36),

  -- URC — responsáveis de canal (todos com nome completo e e-mail já em urc.js)
  ('Cendie Carvalho Da Costa Barbieri', 'Cendie Carvalho Da Costa Barbieri', 'Cendie', 'Responsável de canal — CNR', 'URC', 'cendie.barbieri@sebrae.com.br', 37),
  ('André Luís M. Chanpan dos Santos',  'André Luís M. Chanpan dos Santos',  'André',  'Responsável de canal — CNR', 'URC', 'andre.chanpan@sebrae.com.br', 38),
  ('Filipe Medeiros Ferreira',          'Filipe Medeiros Ferreira',          'Filipe', 'Responsável de canal — CNR', 'URC', 'filipe.ferreira@sebrae.com.br', 39),
  ('Rafael Rodrigues de Lima',            'Rafael Rodrigues de Lima',            'Rafael',   'Responsável de canal — Portal', 'URC', 'rafael.rodrigues@sebrae.com.br', 40),
  ('Thaíza Soares Cardoso Lima Kopp',     'Thaíza Soares Cardoso Lima Kopp',     'Thaíza',   'Responsável de canal — Portal', 'URC', 'thaiza.kopp@sebrae.com.br', 41),
  ('Michelle Carsten Santos',             'Michelle Carsten Santos',             'Michelle', 'Responsável de canal — Portal', 'URC', 'michelle.santos@sebrae.com.br', 42),
  ('Marcos Paulo de Sousa Santos Soares', 'Marcos Paulo de Sousa Santos Soares', 'Marcos',   'Responsável de canal — Portal', 'URC', 'marcos.soares@sebrae.com.br', 43),
  ('Sabrina Mendes Gonçalves',            'Sabrina Mendes Gonçalves',            'Sabrina',  'Responsável de canal — Portal', 'URC', 'sabrina.mendes@sebrae.com.br', 44),
  ('Leandro Pereira de Jesus',   'Leandro Pereira de Jesus',   'Leandro', 'Responsável de canal — Loja', 'URC', 'leandro.jesus@sebrae.com.br', 45),
  ('Cláudia Schirmbeck Peixoto', 'Cláudia Schirmbeck Peixoto', 'Cláudia', 'Responsável de canal — Loja', 'URC', 'claudia.peixoto@sebrae.com.br', 46),
  ('Davison da Silva Ferreira',  'Davison da Silva Ferreira',  'Davison', 'Responsável de canal — Loja', 'URC', 'davison.sferreira@sebrae.com.br', 47)
) AS v(nome, nome_completo, nome_exibicao, papel, grupo, email, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM public.meta_inovacao_pessoas p
  WHERE p.nome = v.nome AND p.grupo = v.grupo AND p.deleted_at IS NULL
);


-- ---------------------------------------------------------------------------
-- 6) PostgREST precisa enxergar as colunas novas de meta_inovacao_pessoas e a
--    tabela nova — coluna nova em tabela existente entra no cache de schema
--    (PADRAO_TABELA.md item 8); tabela nova o PostgREST detecta sozinho.
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- 7) Verificação — rode e confira à mão
-- ============================================================================
-- (a) contagem total de pessoas (esperado: 20 originais + 27 novas = 47 linhas,
--     nenhuma soft-deletada por este script):
SELECT count(*) AS total_linhas_pessoas FROM public.meta_inovacao_pessoas WHERE deleted_at IS NULL;

-- (b) as 10 pessoas que já tinham linha devem estar TODAS com nome_completo
--     preenchido agora (Anny fica de fora de propósito — sem nome completo
--     ainda). Se alguma aparecer com nome_completo NULL fora da lista abaixo,
--     o UPDATE da seção 3 não achou a linha pelo nome esperado — confira se o
--     texto de `nome` foi editado em produção desde o seed original.
SELECT nome, grupo, nome_completo, nome_exibicao
FROM public.meta_inovacao_pessoas
WHERE deleted_at IS NULL AND grupo IN ('UI', 'Comitê', 'Núcleos')
ORDER BY ordem;

-- (c) pessoa_papeis — esperado 18 linhas (José 2 + Sandra 3 + Pova 1 + 6×2 dos
--     outros Comitê/Núcleo):
SELECT count(*) AS total_papeis FROM public.meta_inovacao_pessoa_papeis WHERE deleted_at IS NULL;
SELECT p.nome_completo, pp.contexto, n.nome AS nucleo, pp.papel
FROM public.meta_inovacao_pessoa_papeis pp
JOIN public.meta_inovacao_pessoas p ON p.id = pp.pessoa_id
LEFT JOIN public.meta_inovacao_nucleos n ON n.id = pp.nucleo_id
WHERE pp.deleted_at IS NULL
ORDER BY p.nome_completo, pp.contexto;

-- (d) as 27 pessoas novas — esperado 27 linhas, 15 com nome_completo NULL:
SELECT nome, nome_completo, grupo, papel, email
FROM public.meta_inovacao_pessoas
WHERE deleted_at IS NULL AND grupo IN ('Projetos', 'URC')
ORDER BY ordem;
SELECT count(*) FILTER (WHERE nome_completo IS NULL) AS pendentes_nome_completo
FROM public.meta_inovacao_pessoas
WHERE deleted_at IS NULL AND grupo IN ('Projetos', 'URC');
-- esperado 14 (Enio, Milva + as 12 de representantes sem nome completo — Anny
-- não entra aqui: ela já existia no grupo UI original, tratada na seção 3. O
-- total de "nome completo ainda em aberto" no site inteiro é 14 + 1 (Anny) =
-- 15, batendo com o §3.3 do relatório).
