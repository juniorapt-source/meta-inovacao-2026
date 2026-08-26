-- ============================================================================
-- Golden record de cadastros de referência — Camada 2, item 2.5
-- ============================================================================
-- ALTER meta_inovacao_canva_demandas: + 4 FK, convivendo com o texto que FICA
-- (padrão da Camada 2 — nenhuma coluna de texto é tocada nem dropada aqui):
--
--   nucleo      text  -> nucleo_id              FK meta_inovacao_nucleos(id)
--   canal       text  -> canal_id               FK meta_inovacao_canais(id)
--   facilitador text  -> facilitador_pessoa_id  FK meta_inovacao_pessoas(id)
--   responsavel text  -> responsavel_pessoa_id  FK meta_inovacao_pessoas(id)
--
-- Todas nullable — inclusive responsavel_pessoa_id, apesar de `responsavel` (texto)
-- ser NOT NULL na tabela: o texto sempre existe, mas nem todo nome digitado casa
-- com um golden record de pessoa (ver seção de verificação).
--
-- Este item ficou de fora da Camada 2 quando ela foi fechada (22/08/2026) — sumiu
-- da tabela de acompanhamento sem nunca ter sido executado. Ver a nota da Camada 2
-- em docs/PLANO_EXECUCAO_GOLDEN_RECORD.md.
--
-- COMO CADA FK CASA:
--
--   canal_id — `canal` já guarda o SLUG de data/canais.js ("foco","cnr",...), o
--   mesmo slug de meta_inovacao_canais.slug (2026-08_canais.sql) e da whitelist
--   hardcoded em cc_canva_gravar. Casamento por IGUALDADE EXATA, sem normalização
--   — é a mesma lógica de 2026-08_urc_canais_fk.sql, só que aqui o texto já É o
--   slug (não o nome de exibição), então nem precisa casar por nome.
--
--   nucleo_id — `nucleo` é preenchido pela própria cc_canva_gravar a partir de
--   meta_inovacao_projetos.nucleo quando o projeto casa (§5.8 da função) — mesmo
--   texto de NUCLEOS_VALIDOS que semeou meta_inovacao_nucleos.nome
--   (2026-08_nucleos.sql). Ainda assim casa por public.cc_pessoa_normalizar()
--   (minúsculas/sem acento/sem ponto/trim) em vez de igualdade crua, por pedido
--   explícito: linhas antigas ou digitação manual podem ter variado acento/caixa.
--
--   facilitador_pessoa_id / responsavel_pessoa_id — os dois são texto livre digitado
--   na oficina (facilitador vem de ?facilitador= na URL do QR, responsavel é campo
--   de texto do formulário) — não são dropdown ligado a um cadastro. Casam contra
--   meta_inovacao_pessoas por public.cc_pessoa_normalizar(), tentando nesta ordem:
--   nome -> nome_exibicao -> nome_completo (mesmos 3 campos que
--   2026-08_projeto_representantes.sql já usa pra resolver os tokens curtos de
--   `representantes[]`; aqui sem o passo de alias explícito "júnior", que era
--   específico daquele caso). Não filtra por `grupo`: facilitador e responsável
--   podem ser qualquer pessoa do golden record (URC, núcleo, comitê...), não só
--   um grupo fixo.
--
-- REUSA public.cc_pessoa_normalizar(txt) — criada em
-- 2026-08_projeto_representantes.sql (item 2.2) — em vez de criar uma segunda régua
-- de normalização de nome de pessoa.
--
-- NÃO FORÇA COBERTURA: nome/núcleo/canal que não casarem ficam com a FK NULL — a
-- seção de verificação lista o que sobrou, pra José decidir o que resolver na mão
-- (mesmo espírito de "sinalizar discrepância, não esconder" do resto da Camada 2).
--
-- Depois do ALTER + popular, esta migração também substitui `cc_canva_gravar` e
-- `cc_canva_editar` (CREATE OR REPLACE, mesma assinatura) pra que TODA demanda nova
-- já nasça com as 4 FKs preenchidas — sem isso, a cobertura cairia sozinha a cada
-- oficina nova, e o 2.5 viraria um retrato que envelhece. `canal_id`/`nucleo_id` só
-- são gravados na criação (canal e projeto não são editáveis depois, ver
-- 2026-08_canva_demandas.sql, seção 6); `facilitador_pessoa_id`/
-- `responsavel_pessoa_id` são recalculados também em cc_canva_editar, porque
-- `facilitador`/`responsavel` SÃO editáveis lá.
--
-- ORDEM DE EXECUÇÃO: depois de 2026-08_canva_demandas.sql (cria a tabela e as
-- funções), 2026-08_nucleos.sql (Camada 0), 2026-08_canais.sql (Camada 0) e
-- 2026-08_projeto_representantes.sql (Camada 2, item 2.2 — cria
-- cc_pessoa_normalizar). A seção 0 confere e ABORTA se algo faltar.
--
-- IDEMPOTENTE: ADD COLUMN IF NOT EXISTS, UPDATE só quando a FK ainda não bate
-- (IS DISTINCT FROM), CREATE OR REPLACE FUNCTION.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 0) Pré-requisitos — FALHA CEDO
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regclass('public.meta_inovacao_canva_demandas') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_canva_demandas não existe — rode tools/sql/2026-08_canva_demandas.sql antes deste script.';
  END IF;
  IF to_regclass('public.meta_inovacao_nucleos') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_nucleos não existe — rode tools/sql/2026-08_nucleos.sql (Camada 0) antes deste script.';
  END IF;
  IF to_regclass('public.meta_inovacao_canais') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_canais não existe — rode tools/sql/2026-08_canais.sql (Camada 0) antes deste script.';
  END IF;
  IF to_regclass('public.meta_inovacao_pessoas') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_pessoas não existe — rode tools/sql/2026-08_migracao_modo_edicao.sql antes deste script.';
  END IF;
  IF to_regprocedure('public.cc_pessoa_normalizar(text)') IS NULL THEN
    RAISE EXCEPTION 'cc_pessoa_normalizar() não existe — rode tools/sql/2026-08_projeto_representantes.sql (Camada 2, item 2.2) antes deste script.';
  END IF;
  IF to_regprocedure('public.cc_canva_gravar(jsonb)') IS NULL THEN
    RAISE EXCEPTION 'cc_canva_gravar() não existe — rode tools/sql/2026-08_canva_demandas.sql antes deste script.';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 1) ALTER — 4 colunas novas, todas nullable, convivendo com o texto
-- ---------------------------------------------------------------------------
ALTER TABLE public.meta_inovacao_canva_demandas
  ADD COLUMN IF NOT EXISTS nucleo_id              bigint REFERENCES public.meta_inovacao_nucleos(id),
  ADD COLUMN IF NOT EXISTS canal_id               bigint REFERENCES public.meta_inovacao_canais(id),
  ADD COLUMN IF NOT EXISTS facilitador_pessoa_id  bigint REFERENCES public.meta_inovacao_pessoas(id),
  ADD COLUMN IF NOT EXISTS responsavel_pessoa_id  bigint REFERENCES public.meta_inovacao_pessoas(id);


-- ---------------------------------------------------------------------------
-- 2) Popular — só o que já existe (linhas de oficinas já rodadas)
-- ---------------------------------------------------------------------------

-- canal_id: igualdade exata contra o slug (canal JÁ é o slug, não o nome de exibição)
UPDATE public.meta_inovacao_canva_demandas d
SET canal_id = c.id
FROM public.meta_inovacao_canais c
WHERE c.slug = d.canal
  AND c.deleted_at IS NULL
  AND d.deleted_at IS NULL
  AND d.canal_id IS DISTINCT FROM c.id;

-- nucleo_id: normalizado, só quando `nucleo` está preenchido. Subquery correlada
-- com ORDER BY id LIMIT 1 (mesmo critério de desempate de cc_canva_gravar) em vez
-- de um JOIN direto: casamento por normalização, ao contrário do slug acima, não
-- tem unique index por trás garantindo par único — sem o LIMIT 1 o resultado
-- ficaria não-determinístico (e a UPDATE deixaria de ser idempotente) se um dia
-- existirem dois núcleos cujo nome normalize igual. (UPDATE ... FROM não aceita
-- LATERAL correlacionado com a própria tabela-alvo — por isso subquery no SET, não
-- no FROM.)
UPDATE public.meta_inovacao_canva_demandas d
SET nucleo_id = (
  SELECT n.id FROM public.meta_inovacao_nucleos n
  WHERE n.deleted_at IS NULL
    AND public.cc_pessoa_normalizar(n.nome) = public.cc_pessoa_normalizar(d.nucleo)
  ORDER BY n.id LIMIT 1
)
WHERE d.nucleo IS NOT NULL
  AND d.deleted_at IS NULL
  AND d.nucleo_id IS DISTINCT FROM (
    SELECT n.id FROM public.meta_inovacao_nucleos n
    WHERE n.deleted_at IS NULL
      AND public.cc_pessoa_normalizar(n.nome) = public.cc_pessoa_normalizar(d.nucleo)
    ORDER BY n.id LIMIT 1
  );

-- facilitador_pessoa_id: normalizado contra nome -> nome_exibicao -> nome_completo,
-- só quando `facilitador` está preenchido (campo opcional). Mesma subquery
-- correlada + LIMIT 1 pelo mesmo motivo do nucleo_id acima — nome de pessoa não
-- tem unique index.
UPDATE public.meta_inovacao_canva_demandas d
SET facilitador_pessoa_id = (
  SELECT p.id FROM public.meta_inovacao_pessoas p
  WHERE p.deleted_at IS NULL
    AND (
      public.cc_pessoa_normalizar(p.nome) = public.cc_pessoa_normalizar(d.facilitador)
      OR public.cc_pessoa_normalizar(p.nome_exibicao) = public.cc_pessoa_normalizar(d.facilitador)
      OR public.cc_pessoa_normalizar(p.nome_completo) = public.cc_pessoa_normalizar(d.facilitador)
    )
  ORDER BY p.id LIMIT 1
)
WHERE d.facilitador IS NOT NULL
  AND d.deleted_at IS NULL
  AND d.facilitador_pessoa_id IS DISTINCT FROM (
    SELECT p.id FROM public.meta_inovacao_pessoas p
    WHERE p.deleted_at IS NULL
      AND (
        public.cc_pessoa_normalizar(p.nome) = public.cc_pessoa_normalizar(d.facilitador)
        OR public.cc_pessoa_normalizar(p.nome_exibicao) = public.cc_pessoa_normalizar(d.facilitador)
        OR public.cc_pessoa_normalizar(p.nome_completo) = public.cc_pessoa_normalizar(d.facilitador)
      )
    ORDER BY p.id LIMIT 1
  );

-- responsavel_pessoa_id: mesma régua — `responsavel` é NOT NULL na tabela, mas nem
-- todo nome digitado casa com um golden record (fica NULL, aparece na verificação)
UPDATE public.meta_inovacao_canva_demandas d
SET responsavel_pessoa_id = (
  SELECT p.id FROM public.meta_inovacao_pessoas p
  WHERE p.deleted_at IS NULL
    AND (
      public.cc_pessoa_normalizar(p.nome) = public.cc_pessoa_normalizar(d.responsavel)
      OR public.cc_pessoa_normalizar(p.nome_exibicao) = public.cc_pessoa_normalizar(d.responsavel)
      OR public.cc_pessoa_normalizar(p.nome_completo) = public.cc_pessoa_normalizar(d.responsavel)
    )
  ORDER BY p.id LIMIT 1
)
WHERE d.deleted_at IS NULL
  AND d.responsavel_pessoa_id IS DISTINCT FROM (
    SELECT p.id FROM public.meta_inovacao_pessoas p
    WHERE p.deleted_at IS NULL
      AND (
        public.cc_pessoa_normalizar(p.nome) = public.cc_pessoa_normalizar(d.responsavel)
        OR public.cc_pessoa_normalizar(p.nome_exibicao) = public.cc_pessoa_normalizar(d.responsavel)
        OR public.cc_pessoa_normalizar(p.nome_completo) = public.cc_pessoa_normalizar(d.responsavel)
      )
    ORDER BY p.id LIMIT 1
  );


-- ---------------------------------------------------------------------------
-- 3) cc_canva_gravar(p jsonb) — agora grava as 4 FKs também, não só projeto_id
-- ---------------------------------------------------------------------------
-- Corpo idêntico ao de 2026-08_canva_demandas.sql, com as 4 resoluções novas (3.x)
-- e as 4 colunas novas no INSERT. Tudo o mais (honeypot, whitelist de canal,
-- validações, tetos, casamento de projeto) é o mesmo — ver comentários originais.
CREATE OR REPLACE FUNCTION public.cc_canva_gravar(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_canais       text[] := ARRAY['foco','cnr','empresa','portal','mkt','loja','rede','assessoria','dxp','contab'];
  v_max_campo    int    := 2000;
  v_teto_sessao  int    := 20;
  v_teto_projeto int    := 40;

  v_canal        text;
  v_projeto      text;
  v_servico      text;
  v_problema     text;
  v_bloqueio     text;
  v_cproprio     text;
  v_cproprio_q   text;
  v_responsavel  text;
  v_autor        text;
  v_facilitador  text;
  v_ciclo        text;
  v_encontro     text;
  v_prazo        date;
  v_sessao       uuid;

  v_projeto_id   bigint;
  v_nucleo       text;
  v_canonico     text;
  v_digitado     text;
  v_novo         boolean := false;
  v_qtd          int;
  v_id           bigint;

  -- item 2.5: as 4 FKs
  v_nucleo_id             bigint;
  v_canal_id              bigint;
  v_facilitador_pessoa_id bigint;
  v_responsavel_pessoa_id bigint;
BEGIN
  IF btrim(coalesce(p->>'empresa_site', '')) <> '' THEN
    RETURN jsonb_build_object('ok', true, 'id', NULL, 'ignorado', true);
  END IF;

  BEGIN
    v_sessao := (p->>'sessao_id')::uuid;
  EXCEPTION WHEN others THEN
    v_sessao := NULL;
  END;
  IF v_sessao IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Sessão inválida — recarregue a página e tente de novo.', 'campo', 'sessao_id');
  END IF;

  v_canal := btrim(coalesce(p->>'canal', ''));
  IF NOT (v_canal = ANY (v_canais)) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Canal desconhecido — escolha um dos 10 canais da lista.', 'campo', 'canal');
  END IF;

  v_projeto     := btrim(coalesce(p->>'projeto', ''));
  v_digitado    := coalesce(p->>'projeto', '');
  v_servico     := btrim(coalesce(p->>'servico', ''));
  v_problema    := btrim(coalesce(p->>'problema', ''));
  v_responsavel := btrim(coalesce(p->>'responsavel', ''));
  v_autor       := btrim(coalesce(p->>'autor_nome', ''));

  IF v_projeto = ''     THEN RETURN jsonb_build_object('ok', false, 'erro', 'Diga por qual projeto você está preenchendo.', 'campo', 'projeto'); END IF;
  IF v_autor = ''       THEN RETURN jsonb_build_object('ok', false, 'erro', 'Falta seu nome.', 'campo', 'autor_nome'); END IF;
  IF v_servico = ''     THEN RETURN jsonb_build_object('ok', false, 'erro', 'Falta o serviço apresentado.', 'campo', 'servico'); END IF;
  IF v_problema = ''    THEN RETURN jsonb_build_object('ok', false, 'erro', 'Falta a dor que esse serviço endereça.', 'campo', 'problema'); END IF;
  IF v_responsavel = '' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Nenhuma linha sai da mesa sem responsável.', 'campo', 'responsavel'); END IF;

  v_bloqueio    := NULLIF(btrim(coalesce(p->>'bloqueio', '')), '');
  v_facilitador := NULLIF(btrim(coalesce(p->>'facilitador', '')), '');
  v_ciclo       := NULLIF(btrim(coalesce(p->>'ciclo', '')), '');
  v_encontro    := NULLIF(btrim(coalesce(p->>'encontro_id', '')), '');

  IF length(v_digitado) > v_max_campo OR length(v_servico) > v_max_campo
     OR length(v_problema) > v_max_campo OR length(coalesce(v_bloqueio, '')) > v_max_campo
     OR length(v_responsavel) > v_max_campo OR length(v_autor) > v_max_campo
     OR length(coalesce(p->>'canal_proprio_qual', '')) > v_max_campo THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Texto longo demais — resuma em até 2000 caracteres por campo.', 'campo', NULL);
  END IF;

  v_cproprio   := btrim(lower(coalesce(p->>'canal_proprio', '')));
  v_cproprio_q := NULLIF(btrim(coalesce(p->>'canal_proprio_qual', '')), '');
  IF v_cproprio NOT IN ('sim', 'nao', 'nao_sei') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Responda se o serviço já existe em canal próprio.', 'campo', 'canal_proprio');
  END IF;
  IF v_cproprio = 'sim' AND v_cproprio_q IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Diga qual é o canal próprio.', 'campo', 'canal_proprio_qual');
  END IF;
  IF v_cproprio <> 'sim' THEN v_cproprio_q := NULL; END IF;

  BEGIN
    v_prazo := (p->>'prazo')::date;
  EXCEPTION WHEN others THEN
    v_prazo := NULL;
  END;
  IF v_prazo IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Nenhuma linha sai da mesa sem prazo.', 'campo', 'prazo');
  END IF;
  IF v_prazo < (current_date - INTERVAL '30 days') OR v_prazo > (current_date + INTERVAL '2 years') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Prazo fora da janela — use uma data entre 30 dias atrás e 2 anos à frente.', 'campo', 'prazo');
  END IF;

  SELECT id, nucleo, iniciativa INTO v_projeto_id, v_nucleo, v_canonico
  FROM public.meta_inovacao_projetos
  WHERE deleted_at IS NULL
    AND public.cc_canva_normalizar(iniciativa) = public.cc_canva_normalizar(v_projeto)
  ORDER BY id
  LIMIT 1;

  IF v_projeto_id IS NULL THEN
    v_novo := true;
    v_nucleo := NULL;
  ELSIF btrim(coalesce(v_canonico, '')) <> '' THEN
    v_projeto := v_canonico;
  END IF;

  -- item 2.5, passo 3.1: canal_id — igualdade exata de slug (v_canal já passou pela
  -- whitelist acima, então este SELECT só não acha nada se o catálogo golden record
  -- ainda não tiver semeado aquele canal — fica NULL, não bloqueia a gravação)
  SELECT id INTO v_canal_id
  FROM public.meta_inovacao_canais
  WHERE slug = v_canal AND deleted_at IS NULL
  ORDER BY id LIMIT 1;

  -- item 2.5, passo 3.2: nucleo_id — só quando o projeto casou e trouxe núcleo
  IF v_nucleo IS NOT NULL THEN
    SELECT id INTO v_nucleo_id
    FROM public.meta_inovacao_nucleos
    WHERE deleted_at IS NULL
      AND public.cc_pessoa_normalizar(nome) = public.cc_pessoa_normalizar(v_nucleo)
    ORDER BY id LIMIT 1;
  END IF;

  -- item 2.5, passo 3.3: facilitador_pessoa_id (campo opcional)
  IF v_facilitador IS NOT NULL THEN
    SELECT id INTO v_facilitador_pessoa_id
    FROM public.meta_inovacao_pessoas
    WHERE deleted_at IS NULL
      AND (
        public.cc_pessoa_normalizar(nome) = public.cc_pessoa_normalizar(v_facilitador)
        OR public.cc_pessoa_normalizar(nome_exibicao) = public.cc_pessoa_normalizar(v_facilitador)
        OR public.cc_pessoa_normalizar(nome_completo) = public.cc_pessoa_normalizar(v_facilitador)
      )
    ORDER BY id LIMIT 1;
  END IF;

  -- item 2.5, passo 3.4: responsavel_pessoa_id (v_responsavel sempre preenchido, mas
  -- pode ser um nome fora do golden record — fica NULL, não bloqueia)
  SELECT id INTO v_responsavel_pessoa_id
  FROM public.meta_inovacao_pessoas
  WHERE deleted_at IS NULL
    AND (
      public.cc_pessoa_normalizar(nome) = public.cc_pessoa_normalizar(v_responsavel)
      OR public.cc_pessoa_normalizar(nome_exibicao) = public.cc_pessoa_normalizar(v_responsavel)
      OR public.cc_pessoa_normalizar(nome_completo) = public.cc_pessoa_normalizar(v_responsavel)
    )
  ORDER BY id LIMIT 1;

  SELECT count(*) INTO v_qtd
  FROM public.meta_inovacao_canva_demandas
  WHERE sessao_id = v_sessao AND deleted_at IS NULL;
  IF v_qtd >= v_teto_sessao THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Você já registrou 20 demandas nesta sessão — fale com o facilitador pra continuar.', 'campo', NULL);
  END IF;

  SELECT count(*) INTO v_qtd
  FROM public.meta_inovacao_canva_demandas
  WHERE public.cc_canva_normalizar(projeto) = public.cc_canva_normalizar(v_projeto)
    AND criado_em >= (now() - INTERVAL '1 day')
    AND deleted_at IS NULL;
  IF v_qtd >= v_teto_projeto THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Este projeto já registrou 40 demandas nas últimas 24h — fale com o facilitador.', 'campo', NULL);
  END IF;

  INSERT INTO public.meta_inovacao_canva_demandas (
    projeto, projeto_digitado, projeto_id, projeto_novo, nucleo,
    canal, facilitador, ciclo, encontro_id,
    servico, problema, bloqueio, canal_proprio, canal_proprio_qual,
    responsavel, prazo, status, autor_nome, sessao_id, updated_by,
    nucleo_id, canal_id, facilitador_pessoa_id, responsavel_pessoa_id
  ) VALUES (
    v_projeto, v_digitado, v_projeto_id, v_novo, v_nucleo,
    v_canal, v_facilitador, v_ciclo, v_encontro,
    v_servico, v_problema, v_bloqueio, v_cproprio, v_cproprio_q,
    v_responsavel, v_prazo, 'rascunho', v_autor, v_sessao, v_autor,
    v_nucleo_id, v_canal_id, v_facilitador_pessoa_id, v_responsavel_pessoa_id
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'projeto_novo', v_novo, 'nucleo', v_nucleo);
END;
$$;


-- ---------------------------------------------------------------------------
-- 4) cc_canva_editar(p jsonb) — recalcula as FKs de pessoa quando o texto muda
-- ---------------------------------------------------------------------------
-- canal_id/nucleo_id NÃO entram aqui: `canal`/`projeto` continuam imutáveis nesta
-- função (ver comentário original em 2026-08_canva_demandas.sql, seção 6) — logo
-- as FKs derivadas deles também não mudam depois de gravadas. facilitador_pessoa_id
-- e responsavel_pessoa_id SÃO recalculados, porque facilitador/responsavel são
-- editáveis aqui.
CREATE OR REPLACE FUNCTION public.cc_canva_editar(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_campo   int := 2000;
  v_id          bigint;
  v_sessao      uuid;
  v_linha       public.meta_inovacao_canva_demandas%ROWTYPE;
  v_servico     text;
  v_problema    text;
  v_bloqueio    text;
  v_cproprio    text;
  v_cproprio_q  text;
  v_responsavel text;
  v_facilitador text;
  v_prazo       date;
  v_apagar      boolean;

  -- item 2.5
  v_facilitador_pessoa_id bigint;
  v_responsavel_pessoa_id bigint;
BEGIN
  IF btrim(coalesce(p->>'empresa_site', '')) <> '' THEN
    RETURN jsonb_build_object('ok', true, 'id', NULL, 'ignorado', true);
  END IF;

  BEGIN
    v_id     := (p->>'id')::bigint;
    v_sessao := (p->>'sessao_id')::uuid;
  EXCEPTION WHEN others THEN
    v_id := NULL; v_sessao := NULL;
  END;
  IF v_id IS NULL OR v_sessao IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Não deu pra identificar a demanda — recarregue a página.', 'campo', NULL);
  END IF;

  SELECT * INTO v_linha
  FROM public.meta_inovacao_canva_demandas
  WHERE id = v_id
    AND sessao_id = v_sessao
    AND status = 'rascunho'
    AND deleted_at IS NULL
    AND criado_em >= (now() - INTERVAL '24 hours');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Esta demanda não pode mais ser editada por aqui.', 'campo', NULL);
  END IF;

  BEGIN
    v_apagar := coalesce((p->>'apagar')::boolean, false);
  EXCEPTION WHEN others THEN
    v_apagar := false;
  END;
  IF v_apagar THEN
    UPDATE public.meta_inovacao_canva_demandas
    SET deleted_at = now(), updated_by = coalesce(NULLIF(btrim(coalesce(p->>'autor_nome','')), ''), v_linha.autor_nome)
    WHERE id = v_id;
    RETURN jsonb_build_object('ok', true, 'id', v_id, 'apagada', true);
  END IF;

  v_servico     := btrim(coalesce(p->>'servico', v_linha.servico));
  v_problema    := btrim(coalesce(p->>'problema', v_linha.problema));
  v_responsavel := btrim(coalesce(p->>'responsavel', v_linha.responsavel));
  v_facilitador := coalesce(NULLIF(btrim(coalesce(p->>'facilitador','')), ''), v_linha.facilitador);
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
  IF v_prazo < (current_date - INTERVAL '30 days') OR v_prazo > (current_date + INTERVAL '2 years') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Prazo fora da janela — use uma data entre 30 dias atrás e 2 anos à frente.', 'campo', 'prazo');
  END IF;

  -- item 2.5: recalcula as FKs de pessoa a partir do texto (possivelmente novo)
  SELECT id INTO v_responsavel_pessoa_id
  FROM public.meta_inovacao_pessoas
  WHERE deleted_at IS NULL
    AND (
      public.cc_pessoa_normalizar(nome) = public.cc_pessoa_normalizar(v_responsavel)
      OR public.cc_pessoa_normalizar(nome_exibicao) = public.cc_pessoa_normalizar(v_responsavel)
      OR public.cc_pessoa_normalizar(nome_completo) = public.cc_pessoa_normalizar(v_responsavel)
    )
  ORDER BY id LIMIT 1;

  IF v_facilitador IS NOT NULL THEN
    SELECT id INTO v_facilitador_pessoa_id
    FROM public.meta_inovacao_pessoas
    WHERE deleted_at IS NULL
      AND (
        public.cc_pessoa_normalizar(nome) = public.cc_pessoa_normalizar(v_facilitador)
        OR public.cc_pessoa_normalizar(nome_exibicao) = public.cc_pessoa_normalizar(v_facilitador)
        OR public.cc_pessoa_normalizar(nome_completo) = public.cc_pessoa_normalizar(v_facilitador)
      )
    ORDER BY id LIMIT 1;
  END IF;

  UPDATE public.meta_inovacao_canva_demandas
  SET servico               = v_servico,
      problema              = v_problema,
      bloqueio              = v_bloqueio,
      canal_proprio         = v_cproprio,
      canal_proprio_qual    = v_cproprio_q,
      responsavel           = v_responsavel,
      prazo                 = v_prazo,
      facilitador           = v_facilitador,
      responsavel_pessoa_id = v_responsavel_pessoa_id,
      facilitador_pessoa_id = v_facilitador_pessoa_id,
      updated_by            = coalesce(NULLIF(btrim(coalesce(p->>'autor_nome','')), ''), v_linha.autor_nome)
  WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;


-- ---------------------------------------------------------------------------
-- 5) PostgREST precisa saber das colunas novas (PADRAO_TABELA.md item 8 — ALTER
--    em tabela EXISTENTE, senão toda escrita seguinte falha com PGRST204)
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- Verificação — rode e confira à mão (José decide o que resolver caso a caso)
-- ============================================================================

-- (a) cobertura por FK — quantas linhas ativas ficaram sem cada uma:
SELECT
  count(*) FILTER (WHERE nucleo IS NOT NULL AND nucleo_id IS NULL)             AS sem_nucleo_id,
  count(*) FILTER (WHERE nucleo IS NOT NULL)                                  AS com_texto_nucleo,
  count(*) FILTER (WHERE canal_id IS NULL)                                     AS sem_canal_id,
  count(*)                                                                     AS total_linhas,
  count(*) FILTER (WHERE facilitador IS NOT NULL AND facilitador_pessoa_id IS NULL) AS sem_facilitador_pessoa_id,
  count(*) FILTER (WHERE facilitador IS NOT NULL)                             AS com_texto_facilitador,
  count(*) FILTER (WHERE responsavel_pessoa_id IS NULL)                        AS sem_responsavel_pessoa_id
FROM public.meta_inovacao_canva_demandas
WHERE deleted_at IS NULL;

-- (b) QUAIS valores de `nucleo` não casaram:
SELECT DISTINCT nucleo, count(*) OVER (PARTITION BY nucleo) AS linhas
FROM public.meta_inovacao_canva_demandas
WHERE deleted_at IS NULL AND nucleo IS NOT NULL AND nucleo_id IS NULL
ORDER BY nucleo;

-- (c) QUAIS valores de `canal` não casaram (esperado 0 linhas — canal é whitelist
--     dura na função de gravação, então só sobra órfão aqui se meta_inovacao_canais
--     não tiver os 10 slugs semeados):
SELECT DISTINCT canal, count(*) OVER (PARTITION BY canal) AS linhas
FROM public.meta_inovacao_canva_demandas
WHERE deleted_at IS NULL AND canal_id IS NULL
ORDER BY canal;

-- (d) QUAIS valores de `facilitador` não casaram:
SELECT DISTINCT facilitador, count(*) OVER (PARTITION BY facilitador) AS linhas
FROM public.meta_inovacao_canva_demandas
WHERE deleted_at IS NULL AND facilitador IS NOT NULL AND facilitador_pessoa_id IS NULL
ORDER BY facilitador;

-- (e) QUAIS valores de `responsavel` não casaram:
SELECT DISTINCT responsavel, count(*) OVER (PARTITION BY responsavel) AS linhas
FROM public.meta_inovacao_canva_demandas
WHERE deleted_at IS NULL AND responsavel_pessoa_id IS NULL
ORDER BY responsavel;

-- (f) conferência visual:
SELECT d.id, d.projeto, d.nucleo, n.nome AS nucleo_golden,
       d.canal, c.slug AS canal_golden,
       d.facilitador, pf.nome AS facilitador_golden,
       d.responsavel, pr.nome AS responsavel_golden
FROM public.meta_inovacao_canva_demandas d
LEFT JOIN public.meta_inovacao_nucleos n  ON n.id = d.nucleo_id
LEFT JOIN public.meta_inovacao_canais c   ON c.id = d.canal_id
LEFT JOIN public.meta_inovacao_pessoas pf ON pf.id = d.facilitador_pessoa_id
LEFT JOIN public.meta_inovacao_pessoas pr ON pr.id = d.responsavel_pessoa_id
WHERE d.deleted_at IS NULL
ORDER BY d.id;

-- Pra REVERTER (o ALTER; as funções voltam pro estado de 2026-08_canva_demandas.sql
-- rodando aquele script de novo por cima):
--   ALTER TABLE public.meta_inovacao_canva_demandas
--     DROP COLUMN IF EXISTS nucleo_id, DROP COLUMN IF EXISTS canal_id,
--     DROP COLUMN IF EXISTS facilitador_pessoa_id, DROP COLUMN IF EXISTS responsavel_pessoa_id;
--   NOTIFY pgrst, 'reload schema';
-- ============================================================================
