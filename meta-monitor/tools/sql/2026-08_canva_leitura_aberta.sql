-- ============================================================================
-- Canvas das oficinas — leitura aberta e moderação sem credencial (item 4, parte SQL)
-- ============================================================================
-- Complementa tools/sql/2026-08_canva_demandas.sql, que já rodou em produção.
-- Corresponde à v8 do docs/PLANO_CANVA_OFICINAS.md (§6.5, §6.6 e §8).
--
-- O QUE ESTE SCRIPT FAZ, EM UMA LINHA: desfaz a EXCEÇÃO 1 do script anterior (leitura
-- fechada) e mantém a EXCEÇÃO 2 (escrita só por função), acrescentando a função de
-- moderação que a tela de consolidação vai usar.
--
-- ---------------------------------------------------------------------------
-- POR QUE A LEITURA ABRE — leia antes de achar que é regressão
-- ---------------------------------------------------------------------------
-- O script de criação argumentava que o canvas guarda "por que não funcionaria" com
-- nome de responsável e prazo, e concluía que a leitura não podia ser pública. A
-- conclusão foi revista em 21/08/2026, e o motivo não é técnico:
--
--   O ponto de partida real desta equipe é uma planilha em Excel que circulava por
--   e-mail. Lá, quem tinha o arquivo tinha tudo, para sempre, sem registro nenhum. O
--   canvas no site é melhor que aquilo em todas as dimensões, inclusive nesta. Exigir
--   credencial aqui protegeria contra um adversário que a versão anterior da mesma
--   informação não tinha, e cobraria o preço em quem realmente vai usar a tela: a
--   pessoa da equipe que precisa conferir o que a oficina produziu.
--
-- São 6 usuários, todos da mesma equipe. A decisão é para AGORA e é reversível de
-- propósito: fechar de novo é trocar a policy da seção 1, sem migrar dado nenhum e sem
-- mexer em coluna nenhuma. Os três gatilhos que mandam revisar estão na §6.6 do plano
-- (alguém de fora ganha o link; o campo "bloqueio" vira avaliação de pessoa; passa de
-- ~15 pessoas com escrita).
--
-- Consequência honesta, escrita aqui pra não se descobrir depois: quem tem o link lê, e
-- o anon key do Supabase está no data/config.js de um repositório público. robots.txt
-- bloqueia indexação (Disallow: /), então não é conteúdo que aparece em busca — mas
-- também não é conteúdo protegido.
--
-- ---------------------------------------------------------------------------
-- POR QUE A ESCRITA NÃO ABRE JUNTO — a assimetria é o ponto
-- ---------------------------------------------------------------------------
-- Seria mais curto dar GRANT UPDATE pro anon com a policy cc_token_update, como nas
-- outras nove tabelas, e deixar a tela dar PATCH direto. Não se faz aqui por um motivo
-- que não vale para as outras tabelas: o link desta feature vai IMPRESSO EM QR CODE e
-- distribuído numa sala de oficina. Com UPDATE direto, qualquer pessoa que abriu o QR
-- pode marcar a própria demanda como 'validada' — e a quarentena, que é a única
-- proteção que sobrou depois da decisão acima, deixa de existir.
--
-- Então: leitura por SELECT direto (seção 1), escrita por função (seção 2). A função
-- NÃO pede credencial. Ela não é barreira de identidade, é barreira de integridade:
-- garante transição de status válida e mantém status e deleted_at coerentes entre si,
-- que é justamente o que um UPDATE solto não garante.
--
-- ---------------------------------------------------------------------------
-- ORDEM DE EXECUÇÃO: depois de 2026-08_canva_demandas.sql. A seção 0 aborta se ele não
-- tiver rodado. Idempotente: pode rodar duas vezes.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 0) Pré-condição
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.meta_inovacao_canva_demandas') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_canva_demandas não existe — rode tools/sql/2026-08_canva_demandas.sql primeiro.';
  END IF;
  IF to_regprocedure('public.cc_canva_normalizar(text)') IS NULL THEN
    RAISE EXCEPTION 'cc_canva_normalizar(text) não existe — rode tools/sql/2026-08_canva_demandas.sql primeiro.';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 1) Leitura aberta — volta ao padrão de tools/sql/PADRAO_TABELA.md
-- ---------------------------------------------------------------------------
-- Remove QUALQUER policy de SELECT existente pelo pg_policies, não pelo nome adivinhado
-- (PADRAO_TABELA.md item 4): na prática a que está lá é a cc_select_editor_autenticado,
-- mas o nome real é o que o catálogo disser.
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'meta_inovacao_canva_demandas'
      AND cmd IN ('SELECT', 'ALL')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_canva_demandas', pol.policyname);
    RAISE NOTICE 'policy de SELECT removida: %', pol.policyname;
  END LOOP;
END $$;

-- GRANT ANTES da policy. É a armadilha nº 1 deste repositório: sem GRANT, o Postgres
-- nega ANTES de avaliar RLS e a tela recebe 401 "permission denied for table" com a
-- policy certa no lugar (tools/sql/2026-08_corrige_escrita_select_autenticado.sql).
--
-- SÓ SELECT. Nada de INSERT/UPDATE/DELETE pro anon nesta tabela — ver a assimetria no
-- cabeçalho. Esta linha não substitui o REVOKE ALL do script anterior, soma a ele.
GRANT SELECT ON public.meta_inovacao_canva_demandas TO anon, authenticated;

-- "TO anon, authenticated" e não só "TO anon": é o formato corrigido em
-- 2026-08_corrige_escrita_select_autenticado.sql, e sem o authenticated um RETURNING de
-- sessão logada não encontra policy nenhuma.
--
-- USING (true), sem filtrar deleted_at, também de propósito: a consolidação PRECISA
-- enxergar o que foi descartado, senão "descartar" vira caminho sem volta e a ação
-- 'reabrir' da seção 2 não teria como listar o que reabrir. Quem filtra é a tela.
CREATE POLICY "cc_select_publico" ON public.meta_inovacao_canva_demandas
  FOR SELECT TO anon, authenticated
  USING (true);


-- ---------------------------------------------------------------------------
-- 2) cc_canva_moderar(p jsonb) — a porta de escrita da consolidação
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER, EXECUTE pro anon, SEM credencial: quem abriu a tela usa.
--
-- CONTRATO DE RETORNO: sempre jsonb, nunca EXCEPTION por erro de uso — igual às
-- cc_canva_gravar/cc_canva_editar, e pelo mesmo motivo (erro de preenchimento tem que
-- virar frase na tela, não stacktrace do PostgREST).
--   sucesso → {"ok": true, "id": 12, "status": "validada"}
--   lote    → {"ok": true, "afetadas": 7}
--   erro    → {"ok": false, "erro": "frase pro humano", "campo": "prazo" | null}
--
-- AÇÕES:
--   validar          → status 'validada'   (e limpa deleted_at, se estava descartada)
--   descartar        → status 'descartada' + deleted_at = now()  (soft delete, §5)
--   reabrir          → status 'rascunho'   + deleted_at = NULL
--   editar           → patch parcial do CONTEÚDO, sem tocar em status
--   vincular_projeto → resolve a fila de projetos novos (§8 do plano)
--   validar_lote     → valida todas as 'rascunho' de um projeto (opcionalmente de um canal)
--
-- O QUE ESTA FUNÇÃO NÃO FAZ: promover pra meta_inovacao_matriz_demandas. Isso é o item
-- 5 do plano, tem regra própria (§9) e três casos em que a célula NÃO deve mudar. Sai
-- em script separado, pra que "validei" e "a matriz mexeu" continuem sendo dois fatos
-- distintos enquanto o item 5 não existir.
CREATE OR REPLACE FUNCTION public.cc_canva_moderar(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id          bigint;
  v_acao        text;
  v_autor       text;
  v_linha       public.meta_inovacao_canva_demandas%ROWTYPE;
  v_max_campo   int := 2000;

  v_servico     text;
  v_problema    text;
  v_responsavel text;
  v_bloqueio    text;
  v_cproprio    text;
  v_cproprio_q  text;
  v_prazo       date;

  v_proj_id     bigint;
  v_canonico    text;
  v_nucleo      text;

  v_projeto     text;
  v_canal       text;
  v_afetadas    int;
BEGIN
  v_acao  := btrim(lower(coalesce(p->>'acao', '')));
  v_autor := NULLIF(btrim(coalesce(p->>'autor_nome', '')), '');

  -- Nome da ação conferido ANTES de qualquer outra coisa, e não no fim da cadeia de
  -- ELSIF: com a conferência no fim, um 'acao' escrito errado sem 'id' junto responde
  -- "não deu pra identificar a demanda", que manda quem está depurando procurar o
  -- problema na linha em vez de no verbo. Pego no teste.
  IF v_acao NOT IN ('validar', 'descartar', 'reabrir', 'editar', 'vincular_projeto', 'validar_lote') THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', format('Ação desconhecida: %s', coalesce(NULLIF(v_acao, ''), '(vazia)')),
      'campo', NULL
    );
  END IF;

  -- 2.1 lote: não tem id, tem projeto. Tratado antes por isso.
  IF v_acao = 'validar_lote' THEN
    v_projeto := btrim(coalesce(p->>'projeto', ''));
    v_canal   := NULLIF(btrim(coalesce(p->>'canal', '')), '');
    IF v_projeto = '' THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'Diga de qual projeto é o lote.', 'campo', 'projeto');
    END IF;

    UPDATE public.meta_inovacao_canva_demandas
    SET status = 'validada', updated_by = coalesce(v_autor, updated_by)
    WHERE public.cc_canva_normalizar(projeto) = public.cc_canva_normalizar(v_projeto)
      AND (v_canal IS NULL OR canal = v_canal)
      AND status = 'rascunho'
      AND deleted_at IS NULL;

    GET DIAGNOSTICS v_afetadas = ROW_COUNT;
    RETURN jsonb_build_object('ok', true, 'afetadas', v_afetadas);
  END IF;

  -- 2.2 as demais ações operam sobre UMA linha
  BEGIN
    v_id := (p->>'id')::bigint;
  EXCEPTION WHEN others THEN
    v_id := NULL;
  END;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Não deu pra identificar a demanda — recarregue a página.', 'campo', NULL);
  END IF;

  -- sem filtro de deleted_at: 'reabrir' precisa alcançar linha descartada
  SELECT * INTO v_linha
  FROM public.meta_inovacao_canva_demandas
  WHERE id = v_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Essa demanda não existe mais.', 'campo', NULL);
  END IF;

  -- 2.3 mudanças de status — status e deleted_at andam juntos, sempre.
  -- É a razão de ser desta função: um PATCH solto conseguiria gravar status
  -- 'descartada' com deleted_at nulo (linha que some da lista de descartadas e continua
  -- contando em todo lugar) ou o contrário. Aqui os dois campos são um par.
  IF v_acao = 'validar' THEN
    UPDATE public.meta_inovacao_canva_demandas
    SET status = 'validada', deleted_at = NULL, updated_by = coalesce(v_autor, updated_by)
    WHERE id = v_id;
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'status', 'validada');

  ELSIF v_acao = 'descartar' THEN
    UPDATE public.meta_inovacao_canva_demandas
    SET status = 'descartada', deleted_at = coalesce(deleted_at, now()), updated_by = coalesce(v_autor, updated_by)
    WHERE id = v_id;
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'status', 'descartada');

  ELSIF v_acao = 'reabrir' THEN
    UPDATE public.meta_inovacao_canva_demandas
    SET status = 'rascunho', deleted_at = NULL, updated_by = coalesce(v_autor, updated_by)
    WHERE id = v_id;
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'status', 'rascunho');

  -- 2.4 fila de projetos novos (§8): casa a linha com um projeto do golden record.
  -- Copia o nome CANÔNICO, não o digitado — senão o "agrupar por projeto" da tela
  -- continua quebrado em dois grupos, que é o problema que esta ação existe pra
  -- resolver. projeto_digitado NUNCA é sobrescrito: é a evidência do que a pessoa
  -- escolheu, e é a única forma de descobrir um casamento errado depois.
  ELSIF v_acao = 'vincular_projeto' THEN
    BEGIN
      v_proj_id := (p->>'projeto_id')::bigint;
    EXCEPTION WHEN others THEN
      v_proj_id := NULL;
    END;
    IF v_proj_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'Escolha com qual projeto essa demanda casa.', 'campo', 'projeto_id');
    END IF;

    SELECT iniciativa, nucleo INTO v_canonico, v_nucleo
    FROM public.meta_inovacao_projetos
    WHERE id = v_proj_id AND deleted_at IS NULL;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'erro', 'Esse projeto não está no cadastro.', 'campo', 'projeto_id');
    END IF;

    UPDATE public.meta_inovacao_canva_demandas
    SET projeto      = coalesce(NULLIF(btrim(coalesce(v_canonico, '')), ''), projeto),
        projeto_id   = v_proj_id,
        nucleo       = v_nucleo,
        projeto_novo = false,
        updated_by   = coalesce(v_autor, updated_by)
    WHERE id = v_id;

    RETURN jsonb_build_object('ok', true, 'id', v_id, 'projeto', v_canonico, 'nucleo', v_nucleo);

  END IF;
  -- só sobra 'editar' — o nome da ação já foi conferido lá em cima

  -- 2.5 editar — patch parcial, mesmas validações da cc_canva_editar, SEM a trava de
  -- dono/24h/rascunho: aqui é a equipe corrigindo o que a oficina escreveu errado, e o
  -- typo costuma aparecer justamente depois das 24h. status NÃO entra: mudar status é
  -- ação própria (2.3), pra que "corrigi o texto" nunca vire "validei sem querer".
  v_servico     := btrim(coalesce(p->>'servico', v_linha.servico));
  v_problema    := btrim(coalesce(p->>'problema', v_linha.problema));
  v_responsavel := btrim(coalesce(p->>'responsavel', v_linha.responsavel));
  v_bloqueio    := NULLIF(btrim(coalesce(p->>'bloqueio', coalesce(v_linha.bloqueio, ''))), '');
  v_cproprio    := btrim(lower(coalesce(p->>'canal_proprio', v_linha.canal_proprio)));
  v_cproprio_q  := NULLIF(btrim(coalesce(p->>'canal_proprio_qual', coalesce(v_linha.canal_proprio_qual, ''))), '');

  IF v_servico = ''     THEN RETURN jsonb_build_object('ok', false, 'erro', 'Falta o serviço apresentado.', 'campo', 'servico'); END IF;
  IF v_problema = ''    THEN RETURN jsonb_build_object('ok', false, 'erro', 'Falta a dor que esse serviço endereça.', 'campo', 'problema'); END IF;
  IF v_responsavel = '' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Nenhuma linha sai da mesa sem responsável.', 'campo', 'responsavel'); END IF;

  IF length(v_servico) > v_max_campo OR length(v_problema) > v_max_campo
     OR length(coalesce(v_bloqueio, '')) > v_max_campo OR length(v_responsavel) > v_max_campo
     OR length(coalesce(v_cproprio_q, '')) > v_max_campo THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Texto longo demais — resuma em até 2000 caracteres por campo.', 'campo', NULL);
  END IF;

  IF v_cproprio NOT IN ('sim', 'nao', 'nao_sei') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Responda se o serviço já existe em canal próprio.', 'campo', 'canal_proprio');
  END IF;
  IF v_cproprio = 'sim' AND v_cproprio_q IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Diga qual é o canal próprio.', 'campo', 'canal_proprio_qual');
  END IF;
  IF v_cproprio <> 'sim' THEN v_cproprio_q := NULL; END IF;

  BEGIN
    v_prazo := coalesce((p->>'prazo')::date, v_linha.prazo);
  EXCEPTION WHEN others THEN
    v_prazo := NULL;
  END;
  IF v_prazo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Nenhuma linha sai da mesa sem prazo.', 'campo', 'prazo');
  END IF;
  -- janela mais frouxa que a da cc_canva_editar de propósito: a consolidação acontece
  -- semanas depois da oficina, e um prazo legítimo daquele dia já pode ter vencido.
  IF v_prazo < (current_date - INTERVAL '2 years') OR v_prazo > (current_date + INTERVAL '5 years') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Prazo fora da janela — confira a data.', 'campo', 'prazo');
  END IF;

  UPDATE public.meta_inovacao_canva_demandas
  SET servico            = v_servico,
      problema           = v_problema,
      bloqueio           = v_bloqueio,
      canal_proprio      = v_cproprio,
      canal_proprio_qual = v_cproprio_q,
      responsavel        = v_responsavel,
      prazo              = v_prazo,
      facilitador        = coalesce(NULLIF(btrim(coalesce(p->>'facilitador','')), ''), v_linha.facilitador),
      ciclo              = coalesce(NULLIF(btrim(coalesce(p->>'ciclo','')), ''), v_linha.ciclo),
      updated_by         = coalesce(v_autor, v_linha.updated_by)
  WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'status', v_linha.status);
END;
$$;


-- ---------------------------------------------------------------------------
-- 3) EXECUTE
-- ---------------------------------------------------------------------------
-- REVOKE de PUBLIC primeiro: SECURITY DEFINER + EXECUTE pra PUBLIC por padrão é a
-- combinação clássica de escalada de privilégio.
REVOKE ALL ON FUNCTION public.cc_canva_moderar(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cc_canva_moderar(jsonb) TO anon, authenticated;


-- ---------------------------------------------------------------------------
-- 4) PostgREST
-- ---------------------------------------------------------------------------
-- Função nova fora do cache devolve PGRST202 ("Could not find the function ... in the
-- schema cache"), que na tela parece bug de JavaScript. Custa uma linha.
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- Verificação — rode e confira à mão
-- ============================================================================
-- (a) GRANTs do anon nesta tabela. Resposta CERTA: UMA linha, anon | SELECT.
--     Se aparecer INSERT ou UPDATE, a assimetria do cabeçalho foi quebrada.
--
--   SELECT grantee, privilege_type
--   FROM information_schema.role_table_grants
--   WHERE table_schema = 'public'
--     AND table_name = 'meta_inovacao_canva_demandas'
--     AND grantee = 'anon';
--
-- (b) Policies. Resposta CERTA: UMA linha, cc_select_publico | SELECT | {anon,authenticated}.
--     Nenhuma cc_select_editor_autenticado sobrando.
--
--   SELECT policyname, cmd, roles, qual
--   FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'meta_inovacao_canva_demandas';
--
-- (c) O teste que importa, e que só vale contra o endpoint real (a seção 4 do script
--     anterior passou no SQL Editor e teria falhado aqui): com o anon key do
--     data/config.js, e SEM header de token,
--
--       GET /rest/v1/meta_inovacao_canva_demandas?select=id,projeto,canal,status
--
--     tem que devolver 200 com as linhas. 401 "permission denied for table" = faltou o
--     GRANT. 200 com [] e linhas na tabela = a policy não pegou o role.
--
-- (d) Moderação, no SQL Editor, numa linha de teste:
--
--   SELECT public.cc_canva_moderar('{"id": 1, "acao": "validar", "autor_nome": "JR."}'::jsonb);
--   SELECT id, status, deleted_at FROM public.meta_inovacao_canva_demandas WHERE id = 1;
--   SELECT public.cc_canva_moderar('{"id": 1, "acao": "descartar"}'::jsonb);
--   -- status 'descartada' E deleted_at preenchido, sempre os dois juntos
--   SELECT public.cc_canva_moderar('{"id": 1, "acao": "reabrir"}'::jsonb);
--   SELECT public.cc_canva_moderar('{"acao": "xpto"}'::jsonb);
--   -- {"ok": false, ...} — nunca EXCEPTION
--
-- (e) Auditoria continuou funcionando (a trigger é da tabela, mas confira depois de (d)):
--
--   SELECT tabela, operacao, criado_em FROM public.meta_inovacao_audit_log
--   ORDER BY criado_em DESC LIMIT 5;
--
-- ============================================================================
-- Pra REVERTER (fechar a leitura de novo — o cenário da V2, §6.6 do plano)
-- ============================================================================
--   DROP POLICY IF EXISTS "cc_select_publico" ON public.meta_inovacao_canva_demandas;
--   REVOKE SELECT ON public.meta_inovacao_canva_demandas FROM anon;
--   CREATE POLICY "cc_select_editor_autenticado" ON public.meta_inovacao_canva_demandas
--     FOR SELECT TO authenticated USING (public.cc_eh_editor());
--   NOTIFY pgrst, 'reload schema';
--
-- Três linhas. Nenhum dado migra, nenhuma coluna muda. Era esse o objetivo de manter a
-- leitura no padrão do projeto em vez de dar mecanismo próprio a ela.
-- ============================================================================
