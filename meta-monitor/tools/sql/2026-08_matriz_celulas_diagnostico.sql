-- ============================================================================
-- DIAGNÓSTICO de meta_inovacao_matriz_celulas — Camada 3 do golden record
-- ============================================================================
-- SÓ LEITURA. Não cria, não altera e não apaga nada. Pode rodar quantas vezes quiser,
-- inclusive com o site aberto e gente editando a Matriz.
--
-- Responde duas perguntas:
--   A) o schema em produção bate com tools/sql/2026-08_matriz_celulas.sql?
--   B) a tabela está na publicação supabase_realtime (a grade se atualiza sozinha
--      quando outra pessoa edita)?
-- e, de quebra, C) a matriz nova bate com a antiga, célula a célula.
--
-- COMO RODAR — o SQL Editor do Supabase mostra o resultado da ÚLTIMA consulta, então
-- rode UMA POR VEZ: selecione o bloco da CONSULTA A, execute, leia; depois o da B.
--
-- COMO LER — a coluna `veredito`:
--   OK          nada a fazer.
--   DIVERGE     produção não bate com o arquivo. Ver "o que fazer" no fim deste arquivo.
--   ATENÇÃO     não é erro, mas muda o comportamento do site (ex.: sem realtime).
--   INFORMATIVO só pra você ver o que está lá.
-- ============================================================================


-- ============================================================================
-- CONSULTA A — schema, RLS e publicação (rode este bloco inteiro de uma vez)
-- ============================================================================
WITH
tab AS (SELECT to_regclass('public.meta_inovacao_matriz_celulas') AS oid),
col AS (
  SELECT column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'meta_inovacao_matriz_celulas'
),
con AS (
  SELECT conname, contype, pg_get_constraintdef(c.oid) AS def
  FROM pg_constraint c, tab WHERE c.conrelid = tab.oid
),
pol AS (
  SELECT policyname, cmd, coalesce(qual, '') || ' ' || coalesce(with_check, '') AS regra
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'meta_inovacao_matriz_celulas'
),
grants AS (
  SELECT privilege_type, grantee
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public' AND table_name = 'meta_inovacao_matriz_celulas'
    AND grantee IN ('anon', 'authenticated')
),
trg AS (
  SELECT tgname, pg_get_triggerdef(t.oid) AS def
  FROM pg_trigger t, tab WHERE t.tgrelid = tab.oid AND NOT t.tgisinternal
),
pub AS (
  SELECT pubname FROM pg_publication_tables
  WHERE schemaname = 'public' AND tablename = 'meta_inovacao_matriz_celulas'
),
checagens(ordem, verificacao, esperado, encontrado, veredito) AS (

  SELECT 1, 'tabela existe',
         'meta_inovacao_matriz_celulas',
         coalesce((SELECT oid::text FROM tab), '(não existe)'),
         CASE WHEN (SELECT oid FROM tab) IS NULL THEN 'DIVERGE' ELSE 'OK' END

  UNION ALL SELECT 2, 'conjunto de colunas',
         'canal_id, estado, id, projeto_id, updated_at, updated_by',
         coalesce((SELECT string_agg(column_name, ', ' ORDER BY column_name) FROM col), '(nenhuma)'),
         CASE WHEN (SELECT string_agg(column_name, ', ' ORDER BY column_name) FROM col)
                   = 'canal_id, estado, id, projeto_id, updated_at, updated_by'
              THEN 'OK' ELSE 'DIVERGE' END

  UNION ALL SELECT 3, 'tipos das colunas',
         'id/projeto_id/canal_id bigint · estado text · updated_at timestamptz · updated_by text',
         coalesce((SELECT string_agg(column_name || ' ' || data_type, ' · ' ORDER BY column_name) FROM col), '(nenhuma)'),
         CASE WHEN (SELECT count(*) FROM col WHERE (column_name IN ('id','projeto_id','canal_id') AND data_type = 'bigint')
                                                OR (column_name IN ('estado','updated_by')      AND data_type = 'text')
                                                OR (column_name = 'updated_at' AND data_type LIKE 'timestamp%')) = 6
              THEN 'OK' ELSE 'DIVERGE' END

  UNION ALL SELECT 4, 'chave primária',
         'PRIMARY KEY (id)',
         coalesce((SELECT def FROM con WHERE contype = 'p'), '(não tem)'),
         CASE WHEN EXISTS (SELECT 1 FROM con WHERE contype = 'p' AND def LIKE '%(id)%') THEN 'OK' ELSE 'DIVERGE' END

  UNION ALL SELECT 5, 'par único (projeto, canal) — o upsert da grade depende dele',
         'UNIQUE (projeto_id, canal_id)',
         coalesce((SELECT string_agg(def, ' | ') FROM con WHERE contype = 'u'), '(não tem)'),
         CASE WHEN EXISTS (SELECT 1 FROM con WHERE contype = 'u' AND def ILIKE '%(projeto_id, canal_id)%') THEN 'OK' ELSE 'DIVERGE' END

  UNION ALL SELECT 6, 'FK projeto_id -> meta_inovacao_projetos',
         'FOREIGN KEY (projeto_id) REFERENCES meta_inovacao_projetos(id)',
         coalesce((SELECT def FROM con WHERE contype = 'f' AND def ILIKE '%projeto_id%'), '(não tem)'),
         CASE WHEN EXISTS (SELECT 1 FROM con WHERE contype = 'f' AND def ILIKE '%projeto_id%' AND def ILIKE '%meta_inovacao_projetos%') THEN 'OK' ELSE 'DIVERGE' END

  UNION ALL SELECT 7, 'FK canal_id -> meta_inovacao_canais',
         'FOREIGN KEY (canal_id) REFERENCES meta_inovacao_canais(id)',
         coalesce((SELECT def FROM con WHERE contype = 'f' AND def ILIKE '%canal_id%'), '(não tem)'),
         CASE WHEN EXISTS (SELECT 1 FROM con WHERE contype = 'f' AND def ILIKE '%canal_id%' AND def ILIKE '%meta_inovacao_canais%') THEN 'OK' ELSE 'DIVERGE' END

  -- Os 7 estados do CHECK são exatamente os que o <select> da Matriz oferece
  -- (js/matriz-store.js, ESTADOS). Se este check divergir, ou a tela oferece algo que o
  -- banco recusa, ou o banco aceita algo que a tela não sabe mostrar.
  UNION ALL SELECT 8, 'CHECK de estado com os 7 valores',
         '''''(vazio), previsto, oficina, formulario, justificado, priorizado, encaminhado',
         coalesce((SELECT string_agg(def, ' | ') FROM con WHERE contype = 'c'), '(não tem)'),
         CASE WHEN EXISTS (
                SELECT 1 FROM con WHERE contype = 'c'
                  AND def LIKE '%previsto%' AND def LIKE '%oficina%' AND def LIKE '%formulario%'
                  AND def LIKE '%justificado%' AND def LIKE '%priorizado%' AND def LIKE '%encaminhado%')
              THEN 'OK' ELSE 'DIVERGE' END

  UNION ALL SELECT 9, 'RLS habilitada',
         'sim',
         coalesce((SELECT CASE WHEN relrowsecurity THEN 'sim' ELSE 'NÃO' END FROM pg_class c, tab WHERE c.oid = tab.oid), '(tabela não existe)'),
         CASE WHEN (SELECT relrowsecurity FROM pg_class c, tab WHERE c.oid = tab.oid) THEN 'OK' ELSE 'DIVERGE' END

  -- Sem GRANT, o Postgres nega antes de sequer avaliar a policy (PADRAO_TABELA.md).
  UNION ALL SELECT 10, 'GRANT SELECT/INSERT/UPDATE pra anon',
         'SELECT, INSERT, UPDATE',
         coalesce((SELECT string_agg(DISTINCT privilege_type, ', ' ORDER BY privilege_type) FROM grants WHERE grantee = 'anon'), '(nenhum)'),
         CASE WHEN (SELECT count(DISTINCT privilege_type) FROM grants WHERE grantee = 'anon' AND privilege_type IN ('SELECT','INSERT','UPDATE')) = 3
              THEN 'OK' ELSE 'DIVERGE' END

  UNION ALL SELECT 11, 'policy de leitura pública',
         'cc_select_publico (SELECT)',
         coalesce((SELECT string_agg(policyname, ', ' ORDER BY policyname) FROM pol WHERE cmd = 'SELECT'), '(nenhuma)'),
         CASE WHEN EXISTS (SELECT 1 FROM pol WHERE cmd = 'SELECT') THEN 'OK' ELSE 'DIVERGE' END

  -- O upsert usa INSERT ... ON CONFLICT DO UPDATE: precisa das DUAS policies de escrita.
  -- Faltando uma, metade das edições falha (as células novas OU as que já existem).
  UNION ALL SELECT 12, 'policies de escrita (INSERT e UPDATE) com x-cc-token',
         'uma de INSERT e uma de UPDATE, ambas exigindo x-cc-token',
         coalesce((SELECT string_agg(policyname || ' [' || cmd || ']', ', ' ORDER BY cmd) FROM pol WHERE cmd IN ('INSERT','UPDATE')), '(nenhuma)'),
         CASE WHEN EXISTS (SELECT 1 FROM pol WHERE cmd = 'INSERT' AND regra ILIKE '%x-cc-token%')
                   AND EXISTS (SELECT 1 FROM pol WHERE cmd = 'UPDATE' AND regra ILIKE '%x-cc-token%')
              THEN 'OK' ELSE 'DIVERGE' END

  UNION ALL SELECT 13, 'token das policies bate com data/config.js',
         'a7c11b08-5a62-453c-ba8d-6bd0680e2f90',
         CASE WHEN EXISTS (SELECT 1 FROM pol WHERE regra LIKE '%a7c11b08-5a62-453c-ba8d-6bd0680e2f90%')
              THEN 'bate' ELSE 'NÃO bate (ou não usa token)' END,
         CASE WHEN EXISTS (SELECT 1 FROM pol WHERE regra LIKE '%a7c11b08-5a62-453c-ba8d-6bd0680e2f90%')
              THEN 'OK' ELSE 'DIVERGE' END

  UNION ALL SELECT 14, 'trigger de updated_at',
         'BEFORE UPDATE ... cc_touch_updated_at()',
         coalesce((SELECT string_agg(tgname, ', ') FROM trg WHERE def ILIKE '%cc_touch_updated_at%'), '(não tem)'),
         CASE WHEN EXISTS (SELECT 1 FROM trg WHERE def ILIKE '%cc_touch_updated_at%') THEN 'OK' ELSE 'DIVERGE' END

  UNION ALL SELECT 15, 'trigger de auditoria (opcional)',
         'cc_audit() — só nas tabelas editáveis de verdade',
         coalesce((SELECT string_agg(tgname, ', ') FROM trg WHERE def ILIKE '%cc_audit%'), '(não tem)'),
         CASE WHEN EXISTS (SELECT 1 FROM trg WHERE def ILIKE '%cc_audit%') THEN 'OK' ELSE 'ATENÇÃO' END

  -- ESTA É A RESPOSTA DA PERGUNTA (B). Sem a tabela na publicação, a Matriz funciona
  -- igual, mas não se atualiza sozinha: quem estiver com a tela aberta só vê a edição
  -- de outra pessoa depois de recarregar a página (o aviso "atualizado por … agora"
  -- nunca aparece). Não é erro, é uma funcionalidade a menos.
  UNION ALL SELECT 16, 'está na publicação supabase_realtime',
         'sim (senão a grade não se atualiza sozinha)',
         coalesce((SELECT string_agg(pubname, ', ') FROM pub), '(não está em nenhuma publicação)'),
         CASE WHEN EXISTS (SELECT 1 FROM pub WHERE pubname = 'supabase_realtime') THEN 'OK' ELSE 'ATENÇÃO' END

  UNION ALL SELECT 17, 'colunas a mais que o arquivo não prevê',
         '(nenhuma — mas coluna extra não quebra nada)',
         coalesce((SELECT string_agg(column_name, ', ' ORDER BY column_name) FROM col
                   WHERE column_name NOT IN ('id','projeto_id','canal_id','estado','updated_at','updated_by')), '(nenhuma)'),
         CASE WHEN EXISTS (SELECT 1 FROM col WHERE column_name NOT IN ('id','projeto_id','canal_id','estado','updated_at','updated_by'))
              THEN 'INFORMATIVO' ELSE 'OK' END
)
SELECT ordem AS "#", verificacao AS "verificação", esperado, encontrado, veredito
FROM checagens ORDER BY ordem;


-- ============================================================================
-- CONSULTA B — os dados: matriz nova × matriz antiga, célula a célula
-- ============================================================================
-- Mesma conta que o painel "Conferência com a tabela antiga" faz dentro da
-- demandas.html e que tools/conferir_matriz_celulas.js faz por fora.
-- Lembre: a tabela antiga congelou na virada da Camada 3, então divergência que
-- corresponde a uma edição feita na grade nova depois disso é ESPERADA.
WITH antiga AS (
  SELECT m.iniciativa, v.slug, coalesce(v.estado, '') AS estado
  FROM public.meta_inovacao_matriz_demandas m
  CROSS JOIN LATERAL (VALUES
    ('foco', m.foco), ('cnr', m.cnr), ('empresa', m.empresa), ('portal', m.portal),
    ('mkt', m.mkt), ('loja', m.loja), ('rede', m.rede), ('assessoria', m.assessoria),
    ('dxp', m.dxp), ('contab', m.contab)
  ) AS v(slug, estado)
),
nova AS (
  SELECT p.iniciativa, c.slug, mc.estado, mc.updated_at, mc.updated_by
  FROM public.meta_inovacao_matriz_celulas mc
  JOIN public.meta_inovacao_projetos p ON p.id = mc.projeto_id
  JOIN public.meta_inovacao_canais   c ON c.id = mc.canal_id
)
SELECT
  coalesce(a.iniciativa, n.iniciativa) AS iniciativa,
  coalesce(a.slug, n.slug)             AS canal,
  coalesce(a.estado, '(sem linha na tabela antiga)') AS na_antiga,
  coalesce(n.estado, '(sem célula: vazia)')          AS na_nova,
  n.updated_at, n.updated_by,
  CASE WHEN coalesce(a.estado, '') = coalesce(n.estado, '') THEN 'confere' ELSE 'DIVERGE' END AS veredito
FROM antiga a
FULL OUTER JOIN nova n ON n.iniciativa = a.iniciativa AND n.slug = a.slug
WHERE coalesce(a.estado, '') <> coalesce(n.estado, '')   -- troque por TRUE pra ver tudo
ORDER BY 1, 2;

-- Contagem resumida da CONSULTA B (rode sozinha se só quiser o número):
-- WITH antiga AS (...), nova AS (...)  -- mesmas CTEs acima
-- SELECT count(*) FILTER (WHERE coalesce(a.estado,'') =  coalesce(n.estado,'')) AS conferem,
--        count(*) FILTER (WHERE coalesce(a.estado,'') <> coalesce(n.estado,'')) AS divergem
-- FROM antiga a FULL OUTER JOIN nova n ON n.iniciativa = a.iniciativa AND n.slug = a.slug;


-- ============================================================================
-- O QUE FAZER com cada resultado
-- ============================================================================
-- Linhas 1–14 e 17 com DIVERGE
--   Produção não bate com tools/sql/2026-08_matriz_celulas.sql. Rodar aquele arquivo
--   inteiro no SQL Editor conserta os itens 4–15 (é idempotente e o INSERT final usa
--   ON CONFLICT DO NOTHING, então não sobrescreve nenhuma edição já feita na grade nova).
--   ATENÇÃO: ele NÃO conserta coluna faltando nem tipo errado — CREATE TABLE IF NOT
--   EXISTS não mexe em tabela que já existe. Se as linhas 2 ou 3 divergirem, me traga o
--   resultado desta consulta antes de rodar qualquer coisa: aí a correção é um ALTER
--   pensado caso a caso, não a migração inteira.
--
-- Linha 15 (auditoria) com ATENÇÃO
--   Só quer dizer que quem editou o quê não está indo pro meta_inovacao_audit_log.
--   Roda tools/sql/2026-08_auditoria.sql primeiro, depois este arquivo de novo.
--
-- Linha 16 (realtime) com ATENÇÃO — resolve com uma linha:
--   ALTER PUBLICATION supabase_realtime ADD TABLE public.meta_inovacao_matriz_celulas;
--   (ou no painel: Database › Replication › supabase_realtime › ligar a tabela).
--   Depois disso, quem estiver com a Matriz aberta passa a ver "atualizado por … agora"
--   quando outra pessoa mexe numa célula, sem recarregar.
--
-- CONSULTA B com divergências
--   Confira se cada linha corresponde a uma edição feita na Matriz depois da virada
--   (as colunas updated_at/updated_by dizem quando e por quem). O que não corresponder
--   é erro de migração: resolver ANTES de aposentar a tabela antiga (item 3.5 do plano).
