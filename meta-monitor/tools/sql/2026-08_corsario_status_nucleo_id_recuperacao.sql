-- ============================================================================
-- RECUPERAÇÃO de corsario_status.nucleo_id — achado da auditoria final (item 5.1)
-- ============================================================================
-- POR QUE ESTE SCRIPT EXISTE
--
-- A CONSULTA A de tools/sql/2026-08_auditoria_fk_final.sql, rodada em produção em
-- 26/08/2026, devolveu:
--
--     2.7 | corsario_status.nucleo_id (por núcleo) | 0/4 | DIVERGE
--
-- Zero de 4. Não é deriva de linha nova (essa seria parcial): NENHUMA linha de
-- corsario_status tem nucleo_id, embora `projeto_id` esteja 27/27 na mesma tabela
-- e a coluna exista (CONSULTA 0, `bigint`, OK). As duas colunas foram criadas pelo
-- MESMO `ALTER TABLE` e populadas por dois `UPDATE` seguidos em
-- tools/sql/2026-08_corsario_status_fk.sql — um pegou tudo, o outro pegou nada.
--
-- O que `docs/CAMADA2_COBERTURA_FK.md` registrou em 22/08 sobre esta FK, e que
-- envelheceu como a única linha hedgeada daquela tabela:
--
--     | 2.7 | corsario_status.nucleo_id (por núcleo) | — (não quebrado por núcleo
--     | na conferência, mas a checagem "sem FK" veio vazia) | — |
--
-- A verificação (b) daquele script é `SELECT DISTINCT nucleo ... WHERE nucleo_id
-- IS NULL`. Se `nucleo` estivesse NULL nas linhas na hora em que ela rodou, o
-- retorno seria UMA linha com a célula vazia — que é fácil de ler como "veio
-- vazia" no SQL Editor. Essa é a explicação mais provável, mas é hipótese: este
-- script não depende dela, porque a SEÇÃO 1 mede o estado de HOJE antes de
-- escrever qualquer coisa.
--
-- SÓ LEITURA até a SEÇÃO 2. Rode a SEÇÃO 1 primeiro e leia o veredito — ele diz
-- se a SEÇÃO 2 resolve ou se o caso é outro (núcleo que nem existe no catálogo,
-- que é cadastro, não migração).
--
-- IDEMPOTENTE: os UPDATE só tocam linha onde a FK ainda não bate (IS DISTINCT
-- FROM), então rodar duas vezes seguidas dá `UPDATE 0` na segunda.
-- ============================================================================


-- ============================================================================
-- SEÇÃO 1 — DIAGNÓSTICO (só leitura, rode e leia antes de seguir)
-- ============================================================================
-- Uma linha por texto de núcleo distinto em corsario_status, com o que ele casa
-- no catálogo golden pelas duas réguas. `veredito`:
--   JÁ OK ................. tem nucleo_id; nada a fazer nesta linha.
--   CASA EXATO ............ o texto bate caractere a caractere com um núcleo do
--                           catálogo e mesmo assim está sem FK — a SEÇÃO 2
--                           resolve (é o caso em que o UPDATE original não rodou
--                           ou rodou antes de o texto existir).
--   CASA NORMALIZADO ...... só bate ignorando acento/caixa/espaço — a SEÇÃO 2
--                           também resolve, pelo segundo passo.
--   SEM CORRESPONDENTE .... nenhum núcleo do catálogo casa nem normalizado. NÃO é
--                           caso pra este script: ou o núcleo precisa ser
--                           cadastrado em meta_inovacao_nucleos, ou o texto está
--                           errado no corsário. Decisão de José, não de migração.
SELECT
  s.nucleo                                   AS texto_no_corsario,
  count(*)                                   AS linhas,
  count(*) FILTER (WHERE s.nucleo_id IS NOT NULL) AS ja_com_fk,
  (SELECT n.nome FROM public.meta_inovacao_nucleos n
    WHERE n.deleted_at IS NULL AND n.nome = s.nucleo LIMIT 1)          AS casa_exato,
  (SELECT n.nome FROM public.meta_inovacao_nucleos n
    WHERE n.deleted_at IS NULL
      AND public.cc_pessoa_normalizar(n.nome) = public.cc_pessoa_normalizar(s.nucleo)
    LIMIT 1)                                                            AS casa_normalizado,
  CASE
    WHEN count(*) FILTER (WHERE s.nucleo_id IS NULL) = 0 THEN 'JÁ OK'
    WHEN EXISTS (SELECT 1 FROM public.meta_inovacao_nucleos n
                  WHERE n.deleted_at IS NULL AND n.nome = s.nucleo) THEN 'CASA EXATO'
    WHEN EXISTS (SELECT 1 FROM public.meta_inovacao_nucleos n
                  WHERE n.deleted_at IS NULL
                    AND public.cc_pessoa_normalizar(n.nome) = public.cc_pessoa_normalizar(s.nucleo))
         THEN 'CASA NORMALIZADO'
    ELSE 'SEM CORRESPONDENTE'
  END                                        AS veredito
FROM public.corsario_status s
WHERE s.nucleo IS NOT NULL
GROUP BY s.nucleo
ORDER BY s.nucleo;

-- Quantas linhas têm o texto do núcleo em branco (não aparecem acima e também não
-- podem ganhar FK — não há de onde tirar):
SELECT count(*) AS linhas_sem_texto_de_nucleo
FROM public.corsario_status WHERE nucleo IS NULL;


-- ============================================================================
-- SEÇÃO 2 — POPULAR (escreve; rode depois de ler a SEÇÃO 1)
-- ============================================================================
-- Passo 1 — igualdade exata: a MESMA régua do UPDATE original de
-- tools/sql/2026-08_corsario_status_fk.sql. Repetida aqui de propósito, pra este
-- script ser suficiente sozinho e pra ficar explícito que ele não inventa
-- casamento novo pro caso comum.
UPDATE public.corsario_status s
SET nucleo_id = n.id
FROM public.meta_inovacao_nucleos n
WHERE n.nome = s.nucleo
  AND n.deleted_at IS NULL
  AND s.nucleo_id IS DISTINCT FROM n.id;

-- Passo 2 — igualdade normalizada (acento/caixa/espaço), só pro que sobrou.
-- Reaproveita public.cc_pessoa_normalizar() em vez de criar uma segunda régua de
-- texto — mesma decisão do item 2.5 (o nome da função fala em "pessoa" porque
-- nasceu ali, mas ela é um normalizador de texto genérico: minúsculas, sem
-- acento, sem ponto, sem espaço nas pontas).
UPDATE public.corsario_status s
SET nucleo_id = n.id
FROM public.meta_inovacao_nucleos n
WHERE public.cc_pessoa_normalizar(n.nome) = public.cc_pessoa_normalizar(s.nucleo)
  AND n.deleted_at IS NULL
  AND s.nucleo_id IS NULL;

NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- SEÇÃO 3 — VERIFICAÇÃO (rode depois da 2)
-- ============================================================================
-- (a) esperado: nenhuma linha. Cada linha aqui é um núcleo do corsário que não
--     existe no catálogo golden — vira decisão de cadastro, ver SEÇÃO 1.
SELECT DISTINCT nucleo
FROM public.corsario_status
WHERE nucleo IS NOT NULL AND nucleo_id IS NULL
ORDER BY nucleo;

-- (b) o mesmo número que a CONSULTA A da auditoria mede — esperado bater
--     numerador = denominador (era 0/4 em 26/08/2026):
SELECT count(DISTINCT nucleo) FILTER (WHERE nucleo_id IS NOT NULL) || '/' || count(DISTINCT nucleo)
         AS nucleos_com_fk_sobre_total
FROM public.corsario_status
WHERE nucleo IS NOT NULL;

-- (c) conferência visual — o texto e o núcleo golden lado a lado:
SELECT s.nucleo AS texto_no_corsario, n.nome AS nucleo_golden, count(*) AS linhas
FROM public.corsario_status s
LEFT JOIN public.meta_inovacao_nucleos n ON n.id = s.nucleo_id
GROUP BY s.nucleo, n.nome
ORDER BY s.nucleo;

-- ============================================================================
-- IMPORTANTE — isto NÃO fecha a porta de escrita
-- ============================================================================
-- Este script conserta o dado que já existe. A iniciativa nova criada pelo
-- "+ Nova iniciativa" do editor.html continua nascendo sem projeto_id e sem
-- nucleo_id, porque js/db-corsario.js não monta as duas FKs no payload — é a
-- lacuna 2.7 registrada em docs/CAMADA5_AUDITORIA_FK.md e o item 5.7 do plano.
-- Enquanto o 5.7 não for feito, esta recuperação vai precisar ser repetida.
--
-- Pra REVERTER (volta ao estado de 26/08, com a FK vazia):
--   UPDATE public.corsario_status SET nucleo_id = NULL;
