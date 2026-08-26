-- ============================================================================
-- AUDITORIA FINAL de FK — Camadas 2 e 4 do golden record (item 5.1 do plano)
-- ============================================================================
-- SÓ LEITURA. Não cria, não altera e não apaga nada. Pode rodar quantas vezes
-- quiser, com o site aberto e gente editando.
--
-- Responde a metade que o `node tools/auditoria_fk_final.js` NÃO consegue
-- responder daqui (este ambiente não alcança supabase.co, e a anon key não
-- enxerga meta_inovacao_canva_demandas):
--
--   as linhas que JÁ EXISTEM têm a FK preenchida?  → CONSULTA A
--   alguma FK aponta pra linha apagada ou some?    → CONSULTA B
--   o que exatamente ficou sem FK?                 → CONSULTA C
--
-- A outra metade — "as linhas que ainda vão existir vão NASCER com a FK?" — é
-- propriedade do código, não do banco, e sai de `node tools/auditoria_fk_final.js`.
-- As duas juntas é que fecham o "ponta a ponta" do item 5.1: uma FK 100%
-- preenchida hoje mas que nenhuma tela grava volta a ficar furada na primeira
-- linha nova.
--
-- COMO RODAR — o SQL Editor do Supabase mostra o resultado da ÚLTIMA consulta,
-- então rode UM BLOCO POR VEZ: selecione o bloco da CONSULTA 0, execute, leia;
-- depois o da A, e assim por diante.
--
-- COMO LER — a coluna `veredito`:
--   OK          nada a fazer.
--   DIVERGE     não bate com o esperado. Ver "o que fazer" no fim do arquivo.
--   ATENÇÃO     não é erro de dado, mas muda a decisão do item 5.2.
--   INFORMATIVO só pra você ver o que está lá.
--
-- Pré-requisito: todas as migrações das Camadas 0–2 rodadas (é o caso desde
-- 23/08/2026). A CONSULTA 0 confirma isso antes de qualquer contagem — se ela
-- acusar coluna faltando, PARE: as consultas seguintes vão dar erro de coluna
-- inexistente, e o erro é esse, não um problema de cobertura.
-- ============================================================================


-- ============================================================================
-- CONSULTA 0 — as colunas/tabelas das Camadas 2 e 4 existem?
-- ============================================================================
WITH esperado(ordem, item, objeto, coluna) AS (
  VALUES
    (1,  '2.1', 'meta_inovacao_projetos',                'nucleo_id'),
    (2,  '2.2', 'meta_inovacao_projeto_representantes',  'pessoa_id'),
    (3,  '2.3', 'meta_inovacao_urc_lideranca',           'pessoa_id'),
    (4,  '2.4', 'meta_inovacao_urc_canais_responsaveis', 'canal_id'),
    (5,  '2.4', 'meta_inovacao_urc_canais_responsaveis', 'pessoa_id'),
    (6,  '2.5', 'meta_inovacao_canva_demandas',          'nucleo_id'),
    (7,  '2.5', 'meta_inovacao_canva_demandas',          'canal_id'),
    (8,  '2.5', 'meta_inovacao_canva_demandas',          'facilitador_pessoa_id'),
    (9,  '2.5', 'meta_inovacao_canva_demandas',          'responsavel_pessoa_id'),
    (10, '2.6', 'meta_inovacao_plano_responsaveis',      'pessoa_id'),
    (11, '2.6', 'meta_inovacao_plano_responsaveis',      'coletivo_id'),
    (12, '2.7', 'corsario_status',                       'projeto_id'),
    (13, '2.7', 'corsario_status',                       'nucleo_id')
)
SELECT e.ordem, e.item, e.objeto || '.' || e.coluna AS verificacao,
       CASE WHEN c.column_name IS NULL THEN '(não existe)' ELSE c.data_type END AS encontrado,
       CASE WHEN c.column_name IS NULL THEN 'DIVERGE' ELSE 'OK' END AS veredito
FROM esperado e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public' AND c.table_name = e.objeto AND c.column_name = e.coluna
ORDER BY e.ordem;


-- ============================================================================
-- CONSULTA A — cobertura: as linhas que já existem têm a FK preenchida?
-- ============================================================================
-- Regra em toda linha desta consulta: o DENOMINADOR é só o que TEM TEXTO PRA
-- CASAR. Linha sem o texto de origem (o `facilitador` nunca preenchido da única
-- demanda do canva, por exemplo) não é falha de casamento, é ausência de dado —
-- contar isso como buraco produziria um número pessimista e falso.
WITH
proj AS (
  SELECT * FROM public.meta_inovacao_projetos WHERE deleted_at IS NULL
),
-- instâncias de representante em texto (o denominador do 2.2) e quantas delas
-- sequer têm pessoa correspondente no golden record (placeholders tipo
-- "Núcleo de Startups" — não são órfãos, são "aguarda indicação nominal")
repr_texto AS (
  SELECT p.id AS projeto_id, r.token, r.ord
  FROM proj p, LATERAL unnest(p.representantes) WITH ORDINALITY AS r(token, ord)
),
repr_sem_pessoa AS (
  SELECT rt.*
  FROM repr_texto rt
  WHERE NOT EXISTS (
    SELECT 1 FROM public.meta_inovacao_pessoas pe
    WHERE pe.deleted_at IS NULL
      AND public.cc_pessoa_normalizar(pe.nome) = public.cc_pessoa_normalizar(rt.token)
  )
),
acao AS (
  SELECT * FROM public.meta_inovacao_plano_acoes WHERE deleted_at IS NULL
),
resp_texto AS (
  SELECT a.id AS plano_acao_id, r.token
  FROM acao a, LATERAL unnest(a.responsavel_id) AS r(token)
),
checagens(ordem, item, fk, esperado, encontrado, veredito) AS (

  -- 2.1 --------------------------------------------------------------------
  SELECT 1, '2.1', 'meta_inovacao_projetos.nucleo_id',
         'todo projeto com núcleo em texto tem nucleo_id',
         (SELECT count(*) FILTER (WHERE nucleo_id IS NOT NULL) || '/' || count(*)
            FROM proj WHERE nucleo IS NOT NULL),
         (SELECT CASE WHEN count(*) FILTER (WHERE nucleo_id IS NULL) = 0 THEN 'OK' ELSE 'DIVERGE' END
            FROM proj WHERE nucleo IS NOT NULL)

  -- 2.2 --------------------------------------------------------------------
  UNION ALL SELECT 2, '2.2', 'meta_inovacao_projeto_representantes (vínculos)',
         'vínculos = instâncias em representantes[] MENOS os placeholders sem pessoa golden',
         (SELECT count(*) FROM public.meta_inovacao_projeto_representantes WHERE deleted_at IS NULL)
           || '/' || (SELECT count(*) - (SELECT count(*) FROM repr_sem_pessoa) FROM repr_texto),
         CASE WHEN (SELECT count(*) FROM public.meta_inovacao_projeto_representantes WHERE deleted_at IS NULL)
                 >= (SELECT count(*) - (SELECT count(*) FROM repr_sem_pessoa) FROM repr_texto)
              THEN 'OK' ELSE 'DIVERGE' END

  UNION ALL SELECT 3, '2.2', 'representantes[] sem pessoa no golden record',
         'só placeholders conhecidos ("Núcleo de Startups") — ver CONSULTA C',
         (SELECT count(*)::text FROM repr_sem_pessoa),
         CASE WHEN (SELECT count(*) FROM repr_sem_pessoa) <= 1 THEN 'OK' ELSE 'ATENÇÃO' END

  -- 2.3 --------------------------------------------------------------------
  UNION ALL SELECT 4, '2.3', 'meta_inovacao_urc_lideranca.pessoa_id',
         'toda liderança tem pessoa_id',
         (SELECT count(*) FILTER (WHERE pessoa_id IS NOT NULL) || '/' || count(*)
            FROM public.meta_inovacao_urc_lideranca WHERE deleted_at IS NULL),
         (SELECT CASE WHEN count(*) FILTER (WHERE pessoa_id IS NULL) = 0 THEN 'OK' ELSE 'DIVERGE' END
            FROM public.meta_inovacao_urc_lideranca WHERE deleted_at IS NULL)

  -- 2.4 --------------------------------------------------------------------
  UNION ALL SELECT 5, '2.4', 'meta_inovacao_urc_canais_responsaveis.canal_id',
         'todo responsável de canal tem canal_id',
         (SELECT count(*) FILTER (WHERE canal_id IS NOT NULL) || '/' || count(*)
            FROM public.meta_inovacao_urc_canais_responsaveis WHERE deleted_at IS NULL),
         (SELECT CASE WHEN count(*) FILTER (WHERE canal_id IS NULL) = 0 THEN 'OK' ELSE 'DIVERGE' END
            FROM public.meta_inovacao_urc_canais_responsaveis WHERE deleted_at IS NULL)

  UNION ALL SELECT 6, '2.4', 'meta_inovacao_urc_canais_responsaveis.pessoa_id',
         'todo responsável de canal tem pessoa_id',
         (SELECT count(*) FILTER (WHERE pessoa_id IS NOT NULL) || '/' || count(*)
            FROM public.meta_inovacao_urc_canais_responsaveis WHERE deleted_at IS NULL),
         (SELECT CASE WHEN count(*) FILTER (WHERE pessoa_id IS NULL) = 0 THEN 'OK' ELSE 'DIVERGE' END
            FROM public.meta_inovacao_urc_canais_responsaveis WHERE deleted_at IS NULL)

  -- 2.5 — denominador = só as linhas que têm o texto correspondente ----------
  UNION ALL SELECT 7, '2.5', 'meta_inovacao_canva_demandas.nucleo_id',
         'toda demanda com núcleo em texto tem nucleo_id',
         (SELECT count(*) FILTER (WHERE nucleo_id IS NOT NULL) || '/' || count(*)
            FROM public.meta_inovacao_canva_demandas WHERE deleted_at IS NULL AND nucleo IS NOT NULL),
         (SELECT CASE WHEN count(*) FILTER (WHERE nucleo_id IS NULL) = 0 THEN 'OK' ELSE 'DIVERGE' END
            FROM public.meta_inovacao_canva_demandas WHERE deleted_at IS NULL AND nucleo IS NOT NULL)

  UNION ALL SELECT 8, '2.5', 'meta_inovacao_canva_demandas.canal_id',
         'toda demanda tem canal_id (canal é NOT NULL na tabela)',
         (SELECT count(*) FILTER (WHERE canal_id IS NOT NULL) || '/' || count(*)
            FROM public.meta_inovacao_canva_demandas WHERE deleted_at IS NULL),
         (SELECT CASE WHEN count(*) FILTER (WHERE canal_id IS NULL) = 0 THEN 'OK' ELSE 'DIVERGE' END
            FROM public.meta_inovacao_canva_demandas WHERE deleted_at IS NULL)

  UNION ALL SELECT 9, '2.5', 'meta_inovacao_canva_demandas.facilitador_pessoa_id',
         'toda demanda COM facilitador em texto tem facilitador_pessoa_id',
         (SELECT count(*) FILTER (WHERE facilitador_pessoa_id IS NOT NULL) || '/' || count(*)
            FROM public.meta_inovacao_canva_demandas WHERE deleted_at IS NULL AND facilitador IS NOT NULL),
         (SELECT CASE WHEN count(*) FILTER (WHERE facilitador_pessoa_id IS NULL) = 0 THEN 'OK' ELSE 'ATENÇÃO' END
            FROM public.meta_inovacao_canva_demandas WHERE deleted_at IS NULL AND facilitador IS NOT NULL)

  UNION ALL SELECT 10, '2.5', 'meta_inovacao_canva_demandas.responsavel_pessoa_id',
         'toda demanda tem responsavel_pessoa_id (responsável é NOT NULL na tabela)',
         (SELECT count(*) FILTER (WHERE responsavel_pessoa_id IS NOT NULL) || '/' || count(*)
            FROM public.meta_inovacao_canva_demandas WHERE deleted_at IS NULL),
         (SELECT CASE WHEN count(*) FILTER (WHERE responsavel_pessoa_id IS NULL) = 0 THEN 'OK' ELSE 'ATENÇÃO' END
            FROM public.meta_inovacao_canva_demandas WHERE deleted_at IS NULL)

  -- 2.6 --------------------------------------------------------------------
  UNION ALL SELECT 11, '2.6', 'meta_inovacao_plano_responsaveis (vínculos)',
         'vínculos = instâncias em responsavel_id[]',
         (SELECT count(*) FROM public.meta_inovacao_plano_responsaveis WHERE deleted_at IS NULL)
           || '/' || (SELECT count(*) FROM resp_texto),
         CASE WHEN (SELECT count(*) FROM public.meta_inovacao_plano_responsaveis WHERE deleted_at IS NULL)
                 >= (SELECT count(*) FROM resp_texto)
              THEN 'OK' ELSE 'DIVERGE' END

  -- 2.7 — por iniciativa/núcleo DISTINTOS, não por linha (cada iniciativa tem
  --       até 19 linhas, uma por critério, todas com a mesma FK) -------------
  UNION ALL SELECT 12, '2.7', 'corsario_status.projeto_id (por iniciativa)',
         'toda iniciativa avaliada tem projeto_id',
         (SELECT count(DISTINCT iniciativa) FILTER (WHERE projeto_id IS NOT NULL) || '/' || count(DISTINCT iniciativa)
            FROM public.corsario_status),
         (SELECT CASE WHEN count(DISTINCT iniciativa) FILTER (WHERE projeto_id IS NULL) = 0 THEN 'OK' ELSE 'DIVERGE' END
            FROM public.corsario_status)

  UNION ALL SELECT 13, '2.7', 'corsario_status.nucleo_id (por núcleo)',
         'todo núcleo citado tem nucleo_id',
         (SELECT count(DISTINCT nucleo) FILTER (WHERE nucleo_id IS NOT NULL) || '/' || count(DISTINCT nucleo)
            FROM public.corsario_status WHERE nucleo IS NOT NULL),
         (SELECT CASE WHEN count(DISTINCT nucleo) FILTER (WHERE nucleo_id IS NULL) = 0 THEN 'OK' ELSE 'DIVERGE' END
            FROM public.corsario_status WHERE nucleo IS NOT NULL)
)
SELECT ordem, item, fk, esperado, encontrado, veredito FROM checagens ORDER BY ordem;


-- ============================================================================
-- CONSULTA B — integridade: FK apontando pra linha apagada (soft delete)
-- ============================================================================
-- A FK do Postgres garante que o id EXISTE; não garante que a linha apontada
-- ainda está viva — soft delete (deleted_at) passa despercebido por ela. Uma FK
-- apontando pra pessoa apagada é pior que FK nula: a tela mostra um nome que
-- ninguém deveria mais ver, e o item 5.3 (DROP da coluna de texto) tornaria isso
-- irreversível.
WITH checagens(ordem, item, verificacao, encontrado, veredito) AS (

  SELECT 1, '2.1', 'projetos.nucleo_id → núcleo apagado',
         (SELECT count(*)::text FROM public.meta_inovacao_projetos p
           JOIN public.meta_inovacao_nucleos n ON n.id = p.nucleo_id
          WHERE p.deleted_at IS NULL AND n.deleted_at IS NOT NULL),
         CASE WHEN (SELECT count(*) FROM public.meta_inovacao_projetos p
                     JOIN public.meta_inovacao_nucleos n ON n.id = p.nucleo_id
                    WHERE p.deleted_at IS NULL AND n.deleted_at IS NOT NULL) = 0
              THEN 'OK' ELSE 'DIVERGE' END

  UNION ALL SELECT 2, '2.2', 'vínculo projeto×pessoa → pessoa ou projeto apagado',
         (SELECT count(*)::text FROM public.meta_inovacao_projeto_representantes v
           LEFT JOIN public.meta_inovacao_pessoas pe ON pe.id = v.pessoa_id
           LEFT JOIN public.meta_inovacao_projetos pr ON pr.id = v.projeto_id
          WHERE v.deleted_at IS NULL AND (pe.deleted_at IS NOT NULL OR pr.deleted_at IS NOT NULL)),
         CASE WHEN (SELECT count(*) FROM public.meta_inovacao_projeto_representantes v
                     LEFT JOIN public.meta_inovacao_pessoas pe ON pe.id = v.pessoa_id
                     LEFT JOIN public.meta_inovacao_projetos pr ON pr.id = v.projeto_id
                    WHERE v.deleted_at IS NULL AND (pe.deleted_at IS NOT NULL OR pr.deleted_at IS NOT NULL)) = 0
              THEN 'OK' ELSE 'DIVERGE' END

  UNION ALL SELECT 3, '2.3', 'urc_lideranca.pessoa_id → pessoa apagada',
         (SELECT count(*)::text FROM public.meta_inovacao_urc_lideranca l
           JOIN public.meta_inovacao_pessoas pe ON pe.id = l.pessoa_id
          WHERE l.deleted_at IS NULL AND pe.deleted_at IS NOT NULL),
         CASE WHEN (SELECT count(*) FROM public.meta_inovacao_urc_lideranca l
                     JOIN public.meta_inovacao_pessoas pe ON pe.id = l.pessoa_id
                    WHERE l.deleted_at IS NULL AND pe.deleted_at IS NOT NULL) = 0
              THEN 'OK' ELSE 'DIVERGE' END

  UNION ALL SELECT 4, '2.4', 'urc_canais.canal_id/pessoa_id → linha apagada',
         (SELECT count(*)::text FROM public.meta_inovacao_urc_canais_responsaveis r
           LEFT JOIN public.meta_inovacao_canais c  ON c.id = r.canal_id
           LEFT JOIN public.meta_inovacao_pessoas pe ON pe.id = r.pessoa_id
          WHERE r.deleted_at IS NULL AND (c.deleted_at IS NOT NULL OR pe.deleted_at IS NOT NULL)),
         CASE WHEN (SELECT count(*) FROM public.meta_inovacao_urc_canais_responsaveis r
                     LEFT JOIN public.meta_inovacao_canais c  ON c.id = r.canal_id
                     LEFT JOIN public.meta_inovacao_pessoas pe ON pe.id = r.pessoa_id
                    WHERE r.deleted_at IS NULL AND (c.deleted_at IS NOT NULL OR pe.deleted_at IS NOT NULL)) = 0
              THEN 'OK' ELSE 'DIVERGE' END

  UNION ALL SELECT 5, '2.5', 'canva_demandas → núcleo/canal/pessoa apagados',
         (SELECT count(*)::text FROM public.meta_inovacao_canva_demandas d
           LEFT JOIN public.meta_inovacao_nucleos n  ON n.id = d.nucleo_id
           LEFT JOIN public.meta_inovacao_canais c   ON c.id = d.canal_id
           LEFT JOIN public.meta_inovacao_pessoas pf ON pf.id = d.facilitador_pessoa_id
           LEFT JOIN public.meta_inovacao_pessoas pr ON pr.id = d.responsavel_pessoa_id
          WHERE d.deleted_at IS NULL AND (n.deleted_at IS NOT NULL OR c.deleted_at IS NOT NULL
                OR pf.deleted_at IS NOT NULL OR pr.deleted_at IS NOT NULL)),
         CASE WHEN (SELECT count(*) FROM public.meta_inovacao_canva_demandas d
                     LEFT JOIN public.meta_inovacao_nucleos n  ON n.id = d.nucleo_id
                     LEFT JOIN public.meta_inovacao_canais c   ON c.id = d.canal_id
                     LEFT JOIN public.meta_inovacao_pessoas pf ON pf.id = d.facilitador_pessoa_id
                     LEFT JOIN public.meta_inovacao_pessoas pr ON pr.id = d.responsavel_pessoa_id
                    WHERE d.deleted_at IS NULL AND (n.deleted_at IS NOT NULL OR c.deleted_at IS NOT NULL
                          OR pf.deleted_at IS NOT NULL OR pr.deleted_at IS NOT NULL)) = 0
              THEN 'OK' ELSE 'DIVERGE' END

  UNION ALL SELECT 6, '2.6', 'plano_responsaveis → ação/pessoa/coletivo apagados',
         (SELECT count(*)::text FROM public.meta_inovacao_plano_responsaveis v
           LEFT JOIN public.meta_inovacao_plano_acoes a  ON a.id = v.plano_acao_id
           LEFT JOIN public.meta_inovacao_pessoas pe     ON pe.id = v.pessoa_id
           LEFT JOIN public.meta_inovacao_coletivos co   ON co.id = v.coletivo_id
          WHERE v.deleted_at IS NULL AND (a.deleted_at IS NOT NULL OR pe.deleted_at IS NOT NULL
                OR co.deleted_at IS NOT NULL)),
         CASE WHEN (SELECT count(*) FROM public.meta_inovacao_plano_responsaveis v
                     LEFT JOIN public.meta_inovacao_plano_acoes a  ON a.id = v.plano_acao_id
                     LEFT JOIN public.meta_inovacao_pessoas pe     ON pe.id = v.pessoa_id
                     LEFT JOIN public.meta_inovacao_coletivos co   ON co.id = v.coletivo_id
                    WHERE v.deleted_at IS NULL AND (a.deleted_at IS NOT NULL OR pe.deleted_at IS NOT NULL
                          OR co.deleted_at IS NOT NULL)) = 0
              THEN 'OK' ELSE 'DIVERGE' END

  UNION ALL SELECT 7, '2.7', 'corsario_status → projeto/núcleo apagados',
         (SELECT count(*)::text FROM public.corsario_status s
           LEFT JOIN public.meta_inovacao_projetos p ON p.id = s.projeto_id
           LEFT JOIN public.meta_inovacao_nucleos n  ON n.id = s.nucleo_id
          WHERE p.deleted_at IS NOT NULL OR n.deleted_at IS NOT NULL),
         CASE WHEN (SELECT count(*) FROM public.corsario_status s
                     LEFT JOIN public.meta_inovacao_projetos p ON p.id = s.projeto_id
                     LEFT JOIN public.meta_inovacao_nucleos n  ON n.id = s.nucleo_id
                    WHERE p.deleted_at IS NOT NULL OR n.deleted_at IS NOT NULL) = 0
              THEN 'OK' ELSE 'DIVERGE' END

  -- Divergência entre a FK e o texto que ela deveria representar. Enquanto as
  -- duas colunas convivem (é o estado de hoje), elas podem discordar — e é a
  -- FK que manda. Linha aqui é candidata a acerto ANTES do 5.3, porque depois
  -- do DROP some a evidência de que discordavam.
  UNION ALL SELECT 8, '2.1', 'projetos.nucleo (texto) ≠ nucleo_id (FK)',
         (SELECT count(*)::text FROM public.meta_inovacao_projetos p
           JOIN public.meta_inovacao_nucleos n ON n.id = p.nucleo_id
          WHERE p.deleted_at IS NULL AND p.nucleo IS DISTINCT FROM n.nome),
         CASE WHEN (SELECT count(*) FROM public.meta_inovacao_projetos p
                     JOIN public.meta_inovacao_nucleos n ON n.id = p.nucleo_id
                    WHERE p.deleted_at IS NULL AND p.nucleo IS DISTINCT FROM n.nome) = 0
              THEN 'OK' ELSE 'ATENÇÃO' END

  UNION ALL SELECT 9, '2.3', 'urc_lideranca.nome (texto) ≠ pessoa_id (FK)',
         (SELECT count(*)::text FROM public.meta_inovacao_urc_lideranca l
           JOIN public.meta_inovacao_pessoas pe ON pe.id = l.pessoa_id
          WHERE l.deleted_at IS NULL
            AND public.cc_pessoa_normalizar(l.nome) <> public.cc_pessoa_normalizar(pe.nome)),
         CASE WHEN (SELECT count(*) FROM public.meta_inovacao_urc_lideranca l
                     JOIN public.meta_inovacao_pessoas pe ON pe.id = l.pessoa_id
                    WHERE l.deleted_at IS NULL
                      AND public.cc_pessoa_normalizar(l.nome) <> public.cc_pessoa_normalizar(pe.nome)) = 0
              THEN 'OK' ELSE 'ATENÇÃO' END

  UNION ALL SELECT 10, '2.4', 'urc_canais.nome (texto) ≠ pessoa_id (FK)',
         (SELECT count(*)::text FROM public.meta_inovacao_urc_canais_responsaveis r
           JOIN public.meta_inovacao_pessoas pe ON pe.id = r.pessoa_id
          WHERE r.deleted_at IS NULL
            AND public.cc_pessoa_normalizar(r.nome) <> public.cc_pessoa_normalizar(pe.nome)),
         CASE WHEN (SELECT count(*) FROM public.meta_inovacao_urc_canais_responsaveis r
                     JOIN public.meta_inovacao_pessoas pe ON pe.id = r.pessoa_id
                    WHERE r.deleted_at IS NULL
                      AND public.cc_pessoa_normalizar(r.nome) <> public.cc_pessoa_normalizar(pe.nome)) = 0
              THEN 'OK' ELSE 'ATENÇÃO' END
)
SELECT ordem, item, verificacao, encontrado, veredito FROM checagens ORDER BY ordem;


-- ============================================================================
-- CONSULTA C — o que exatamente ficou sem FK (a lista nominal)
-- ============================================================================
-- Só o que a CONSULTA A contou como buraco, com o texto que não casou — é o que
-- José precisa ver pra decidir item a item no 5.2. Vazio = nada a resolver.
SELECT '2.1' AS item, 'projeto sem nucleo_id' AS o_que, iniciativa AS chave, nucleo AS texto
FROM public.meta_inovacao_projetos
WHERE deleted_at IS NULL AND nucleo IS NOT NULL AND nucleo_id IS NULL

UNION ALL
SELECT '2.2', 'representante em texto sem pessoa no golden record', p.iniciativa, r.token
FROM public.meta_inovacao_projetos p, LATERAL unnest(p.representantes) AS r(token)
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.meta_inovacao_pessoas pe
    WHERE pe.deleted_at IS NULL
      AND public.cc_pessoa_normalizar(pe.nome) = public.cc_pessoa_normalizar(r.token)
  )

UNION ALL
SELECT '2.3', 'liderança sem pessoa_id', nome, papel
FROM public.meta_inovacao_urc_lideranca
WHERE deleted_at IS NULL AND pessoa_id IS NULL

UNION ALL
SELECT '2.4', 'responsável de canal sem canal_id/pessoa_id', canal || ' / ' || nome,
       concat_ws(' ', CASE WHEN canal_id IS NULL THEN 'sem canal_id' END,
                      CASE WHEN pessoa_id IS NULL THEN 'sem pessoa_id' END)
FROM public.meta_inovacao_urc_canais_responsaveis
WHERE deleted_at IS NULL AND (canal_id IS NULL OR pessoa_id IS NULL)

UNION ALL
SELECT '2.5', 'demanda do canva sem alguma das 4 FKs', projeto || ' / ' || canal,
       concat_ws(' ', CASE WHEN nucleo IS NOT NULL AND nucleo_id IS NULL THEN 'sem nucleo_id' END,
                      CASE WHEN canal_id IS NULL THEN 'sem canal_id' END,
                      CASE WHEN facilitador IS NOT NULL AND facilitador_pessoa_id IS NULL THEN 'sem facilitador_pessoa_id (' || facilitador || ')' END,
                      CASE WHEN responsavel_pessoa_id IS NULL THEN 'sem responsavel_pessoa_id (' || responsavel || ')' END)
FROM public.meta_inovacao_canva_demandas
WHERE deleted_at IS NULL
  AND ((nucleo IS NOT NULL AND nucleo_id IS NULL) OR canal_id IS NULL
       OR (facilitador IS NOT NULL AND facilitador_pessoa_id IS NULL) OR responsavel_pessoa_id IS NULL)

UNION ALL
SELECT '2.6', 'responsável de ação em texto sem vínculo na junção', a.id, r.token
FROM public.meta_inovacao_plano_acoes a, LATERAL unnest(a.responsavel_id) AS r(token)
WHERE a.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.meta_inovacao_plano_responsaveis v
    WHERE v.plano_acao_id = a.id AND v.deleted_at IS NULL
  )

UNION ALL
SELECT '2.7', 'iniciativa do corsário sem projeto_id', iniciativa, nucleo
FROM (SELECT DISTINCT iniciativa, nucleo FROM public.corsario_status WHERE projeto_id IS NULL) s

ORDER BY 1, 3;


-- ============================================================================
-- O QUE FAZER com cada veredito
-- ============================================================================
-- CONSULTA 0, DIVERGE ........ a migração daquele item não rodou. Rode o
--   tools/sql/2026-08_*.sql correspondente (a tabela da Camada 2 no plano diz
--   qual) e só então volte pra CONSULTA A.
--
-- CONSULTA A, DIVERGE ........ linha nova entrou depois da migração sem a FK.
--   Duas causas possíveis, e a CONSULTA C distingue: (a) o texto não casa com
--   ninguém do golden record — cadastre a pessoa/núcleo/canal ou corrija a
--   grafia; (b) o texto casa, mas a tela que gravou a linha não preenche a FK —
--   é lacuna de caminho de escrita, e quem lista essas é
--   `node tools/auditoria_fk_final.js` (as conhecidas estão em
--   docs/CAMADA5_AUDITORIA_FK.md). Repopular só a FK, sem fechar a porta de
--   entrada, faz o número subir hoje e cair de novo amanhã.
--
-- CONSULTA A, ATENÇÃO (2.5) .. demanda sem facilitador/responsável casado. Se o
--   texto é NULL, não é buraco (o denominador já exclui). Se tem texto e não
--   casou, é nome fora do golden record — decisão de cadastro, não de migração.
--
-- CONSULTA B, DIVERGE ........ FK apontando pra linha soft-deleted. Resolva ANTES
--   do 5.3: depois do DROP da coluna de texto não há mais como saber quem era.
--
-- CONSULTA B, ATENÇÃO ........ texto e FK discordam. A FK manda; o texto está
--   velho. Vale acertar o texto agora se a coluna vai sobreviver ao 5.2, ou
--   simplesmente dropar se não vai.
--
-- Nenhuma consulta deste arquivo escreve — não há o que reverter.
