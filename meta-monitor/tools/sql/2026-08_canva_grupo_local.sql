-- ---------------------------------------------------------------------------
-- 2026-08_canva_grupo_local.sql
--
-- Item 3 do plano de melhorias de navegação, rodada 3 (28/08/2026): no canvas das
-- oficinas o gestor marca vários projetos, digita UMA demanda e ela vira UMA LINHA POR
-- PROJETO. Esta migração dá a essas linhas irmãs um carimbo comum — "nasceram do mesmo
-- pedido" — para quem consolida saber que são o mesmo pedido replicado, e não três
-- gestores pedindo a mesma coisa por acaso.
--
-- É OPCIONAL e ADITIVA. Sem ela o canvas funciona igual: canva.html já manda
-- `grupo_local` no payload da RPC e a função hoje simplesmente ignora a chave. Rodar
-- isto é o que faz o valor passar a ser gravado — nada precisa mudar no site depois.
--
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- Segue tools/sql/PADRAO_TABELA.md (a tabela já existe; aqui só entra coluna e a nova
-- versão da função, sem tocar em GRANT nem em policy).
--
-- Como rodar: SQL Editor do Supabase, projeto de produção, tudo de uma vez.
-- ---------------------------------------------------------------------------

-- 1) a coluna. Nullable de propósito: toda linha gravada ANTES desta migração fica
--    com NULL, e linha de projeto único também — carimbo só faz sentido em grupo.
ALTER TABLE public.meta_inovacao_canva_demandas
  ADD COLUMN IF NOT EXISTS grupo_local uuid;

COMMENT ON COLUMN public.meta_inovacao_canva_demandas.grupo_local IS
  'Carimbo de origem comum: linhas com o mesmo valor nasceram da MESMA demanda digitada '
  'no canvas, replicada para os projetos que o gestor marcou. NULL = linha avulsa, ou '
  'gravada antes de 28/08/2026. Não é chave de nada: nenhuma leitura depende dele.';

-- 2) índice parcial — só as linhas agrupadas entram, que são a minoria.
CREATE INDEX IF NOT EXISTS meta_inovacao_canva_demandas_grupo_local_idx
  ON public.meta_inovacao_canva_demandas (grupo_local)
  WHERE grupo_local IS NOT NULL;

-- 3) cc_canva_gravar passa a ler `grupo_local` do payload. Corpo idêntico ao de
--    tools/sql/2026-08_canva_demandas.sql, com três acréscimos, todos marcados no
--    texto: a declaração de v_grupo, o bloco 5.1b que lê e valida, e a coluna no
--    INSERT. Nenhuma regra de validação, teto ou canonização foi tocada.
--    (CREATE OR REPLACE preserva os GRANTs de EXECUTE que já existem.)
CREATE OR REPLACE FUNCTION public.cc_canva_gravar(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- os 10 canais fixos (ids de data/canais.js)
  v_canais       text[] := ARRAY['foco','cnr','empresa','portal','mkt','loja','rede','assessoria','dxp','contab'];
  v_max_campo    int    := 2000;   -- §6.3
  v_teto_sessao  int    := 20;     -- linhas por sessao_id
  v_teto_projeto int    := 40;     -- linhas por dia, por projeto

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
  v_grupo        uuid;   -- carimbo de origem comum (item 3, rodada 3)

  v_projeto_id   bigint;
  v_nucleo       text;
  v_canonico     text;   -- nome do projeto como está no golden record (§5.8)
  v_digitado     text;   -- texto cru do gestor, antes de qualquer canonização
  v_novo         boolean := false;
  v_qtd          int;
  v_id           bigint;
BEGIN
  -- 5.1 honeypot (§6.6) — campo escondido por CSS. Bot preenche, humano não. Responde
  -- "ok" (não avisa o bot que foi pego) e não grava nada.
  IF btrim(coalesce(p->>'empresa_site', '')) <> '' THEN
    RETURN jsonb_build_object('ok', true, 'id', NULL, 'ignorado', true);
  END IF;

  -- 5.1b grupo_local — as N linhas que nasceram da MESMA digitação (o gestor marcou
  -- vários projetos e pediu a mesma coisa pra todos). É só um carimbo de origem: se
  -- vier ausente, vazio ou malformado, a linha é gravada igual, com NULL. Nada nesta
  -- função depende dele, e nenhuma tela quebra sem ele.
  BEGIN
    v_grupo := nullif(btrim(coalesce(p->>'grupo_local', '')), '')::uuid;
  EXCEPTION WHEN others THEN
    v_grupo := NULL;
  END;

  -- 5.2 sessão — identidade da linha pra edição posterior (§6.4)
  BEGIN
    v_sessao := (p->>'sessao_id')::uuid;
  EXCEPTION WHEN others THEN
    v_sessao := NULL;
  END;
  IF v_sessao IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Sessão inválida — recarregue a página e tente de novo.', 'campo', 'sessao_id');
  END IF;

  -- 5.3 canal: whitelist DURA
  v_canal := btrim(coalesce(p->>'canal', ''));
  IF NOT (v_canal = ANY (v_canais)) THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Canal desconhecido — escolha um dos 10 canais da lista.', 'campo', 'canal');
  END IF;

  -- 5.4 campos de texto obrigatórios
  v_projeto     := btrim(coalesce(p->>'projeto', ''));
  -- cru de verdade: sem btrim, guardado ANTES da 5.8 poder trocar v_projeto pelo nome
  -- canônico. Se um dia o casamento errar, é aqui que está a evidência do que a pessoa
  -- realmente escolheu, byte a byte — inclusive o espaço sobrando que denunciou um
  -- copiar-e-colar de outra planilha.
  v_digitado    := coalesce(p->>'projeto', '');
  v_servico     := btrim(coalesce(p->>'servico', ''));
  v_problema    := btrim(coalesce(p->>'problema', ''));
  v_responsavel := btrim(coalesce(p->>'responsavel', ''));
  v_autor       := btrim(coalesce(p->>'autor_nome', ''));

  IF v_projeto = ''     THEN RETURN jsonb_build_object('ok', false, 'erro', 'Diga por qual projeto você está preenchendo.', 'campo', 'projeto'); END IF;
  IF v_autor = ''       THEN RETURN jsonb_build_object('ok', false, 'erro', 'Falta seu nome.', 'campo', 'autor_nome'); END IF;
  IF v_servico = ''     THEN RETURN jsonb_build_object('ok', false, 'erro', 'Falta o serviço apresentado.', 'campo', 'servico'); END IF;
  IF v_problema = ''    THEN RETURN jsonb_build_object('ok', false, 'erro', 'Falta a dor que esse serviço endereça.', 'campo', 'problema'); END IF;
  -- a regra do rodapé do .docx, aqui em forma de frase pra tela
  IF v_responsavel = '' THEN RETURN jsonb_build_object('ok', false, 'erro', 'Nenhuma linha sai da mesa sem responsável.', 'campo', 'responsavel'); END IF;

  v_bloqueio    := NULLIF(btrim(coalesce(p->>'bloqueio', '')), '');
  v_facilitador := NULLIF(btrim(coalesce(p->>'facilitador', '')), '');
  v_ciclo       := NULLIF(btrim(coalesce(p->>'ciclo', '')), '');
  v_encontro    := NULLIF(btrim(coalesce(p->>'encontro_id', '')), '');

  -- 5.5 teto de tamanho por campo (§6.3)
  IF length(v_digitado) > v_max_campo OR length(v_servico) > v_max_campo
     OR length(v_problema) > v_max_campo OR length(coalesce(v_bloqueio, '')) > v_max_campo
     OR length(v_responsavel) > v_max_campo OR length(v_autor) > v_max_campo
     OR length(coalesce(p->>'canal_proprio_qual', '')) > v_max_campo THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Texto longo demais — resuma em até 2000 caracteres por campo.', 'campo', NULL);
  END IF;

  -- 5.6 canal próprio (a coluna 4 do canvas: "já existe em canal pirata?")
  v_cproprio   := btrim(lower(coalesce(p->>'canal_proprio', '')));
  v_cproprio_q := NULLIF(btrim(coalesce(p->>'canal_proprio_qual', '')), '');
  IF v_cproprio NOT IN ('sim', 'nao', 'nao_sei') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Responda se o serviço já existe em canal próprio.', 'campo', 'canal_proprio');
  END IF;
  IF v_cproprio = 'sim' AND v_cproprio_q IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Diga qual é o canal próprio.', 'campo', 'canal_proprio_qual');
  END IF;
  IF v_cproprio <> 'sim' THEN v_cproprio_q := NULL; END IF;  -- "não"/"não sei" não carrega "qual"

  -- 5.7 prazo: obrigatório e dentro de uma janela sã (§6.3)
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

  -- 5.8 projeto: casamento MACIO com o golden record
  -- Quando casa, o nome gravado passa a ser o CANÔNICO do golden record, não o que foi
  -- digitado: sem isso, "embrapii" e "Embrapii" viram dois grupos diferentes no
  -- "agrupar por projeto" da consolidação e no índice (projeto, canal) — o casamento
  -- normalizado teria servido só pra achar o núcleo, não pra unificar a linha.
  SELECT id, nucleo, iniciativa INTO v_projeto_id, v_nucleo, v_canonico
  FROM public.meta_inovacao_projetos
  WHERE deleted_at IS NULL
    AND public.cc_canva_normalizar(iniciativa) = public.cc_canva_normalizar(v_projeto)
  ORDER BY id
  LIMIT 1;

  IF v_projeto_id IS NULL THEN
    v_novo := true;   -- entra na fila de projetos novos da consolidação. NÃO é rejeitado.
    v_nucleo := NULL;
  ELSIF btrim(coalesce(v_canonico, '')) <> '' THEN
    v_projeto := v_canonico;
  END IF;

  -- 5.9 tetos de volume (§6.3) — conta só o que não foi descartado/soft-deletado
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

  -- 5.10 grava. status vem SEMPRE forçado como 'rascunho', ignorando o que vier no
  -- payload — é a quarentena do §4: nada preenchido pelo público toca a matriz antes
  -- de um editor promover.
  INSERT INTO public.meta_inovacao_canva_demandas (
    projeto, projeto_digitado, projeto_id, projeto_novo, nucleo,
    canal, facilitador, ciclo, encontro_id,
    servico, problema, bloqueio, canal_proprio, canal_proprio_qual,
    responsavel, prazo, status, autor_nome, sessao_id, updated_by, grupo_local
  ) VALUES (
    v_projeto, v_digitado, v_projeto_id, v_novo, v_nucleo,
    v_canal, v_facilitador, v_ciclo, v_encontro,
    v_servico, v_problema, v_bloqueio, v_cproprio, v_cproprio_q,
    v_responsavel, v_prazo, 'rascunho', v_autor, v_sessao, v_autor, v_grupo
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'projeto_novo', v_novo, 'nucleo', v_nucleo);
END;
$$;


-- ---------------------------------------------------------------------------
-- Verificação — rode DEPOIS e confira as três respostas.
-- ---------------------------------------------------------------------------

-- 1) a coluna existe e é uuid nullable?  esperado: 1 linha, uuid, YES
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name = 'meta_inovacao_canva_demandas' AND column_name = 'grupo_local';

-- 2) a função já enxerga o campo?  esperado: 1 linha (o texto do corpo contém grupo_local)
SELECT count(*) AS funcao_atualizada
  FROM pg_proc
 WHERE proname = 'cc_canva_gravar' AND prosrc LIKE '%grupo_local%';

-- 3) depois de a oficina rodar: quantos pedidos viraram mais de uma linha?
--    esperado no começo: 0 linhas (ninguém gravou em grupo ainda)
SELECT grupo_local, count(*) AS linhas, string_agg(DISTINCT projeto, ', ') AS projetos
  FROM public.meta_inovacao_canva_demandas
 WHERE grupo_local IS NOT NULL AND deleted_at IS NULL
 GROUP BY grupo_local
HAVING count(*) > 1
 ORDER BY linhas DESC;
