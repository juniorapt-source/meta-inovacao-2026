-- ============================================================================
-- Canvas de demandas das oficinas — item 1 do plano "canvas preenchido direto no site"
-- ============================================================================
-- Cria meta_inovacao_canva_demandas: UMA LINHA POR DEMANDA (um serviço apresentado),
-- preenchida pelo gestor de projeto na própria oficina, via canva.html, com LINK ABERTO
-- (sem login e sem código de oficina). É a camada de detalhe por trás de cada célula de
-- meta_inovacao_matriz_demandas: um projeto pode ter N demandas para N canais, e mais de
-- uma demanda para o MESMO canal (3 linhas de "Sebrae na sua empresa" pra Embrapii é o
-- caso normal — por isso NÃO existe unique em (projeto, canal)).
--
-- Segue tools/sql/PADRAO_TABELA.md (prefixo meta_inovacao_, RLS, GRANT antes das
-- policies, soft delete via deleted_at, updated_at, NOTIFY pgrst) com DUAS EXCEÇÕES
-- deliberadas, ambas por causa do link aberto:
--
--   EXCEÇÃO 1 — leitura NÃO é pública, e NÃO é protegida por token. O canvas guarda
--   "por que não funcionaria", com nome de responsável e prazo. A única policy de SELECT
--   é authenticated + cc_eh_editor() (§6.5 do plano). Ver seção 4.
--
--   Por que NÃO cc_token_select, que é o precedente de meta_inovacao_audit_log (P13):
--   o token vive em texto puro em data/config.js, num repositório público — quem abre o
--   repo tem o token. Pra uma tabela de leitura pública-de-fato como as outras isso não
--   muda nada, mas aqui seria obscuridade vendida como proteção. Login de verdade é o
--   único jeito de a frase "não fica legível pra internet inteira" ser verdadeira.
--
--   EXCEÇÃO 2 — anon NÃO recebe GRANT de INSERT nem de UPDATE nesta tabela. Nenhum.
--   Com link aberto, dar INSERT direto pro anon é dar INSERT pra internet. A única porta
--   de escrita é a dupla de funções SECURITY DEFINER cc_canva_gravar/cc_canva_editar
--   (seções 5 e 6), que validam antes de gravar e forçam status='rascunho'. Nada
--   preenchido pelo público toca a matriz antes de um editor promover (quarentena).
--
-- RELAÇÃO COM A v0.30.0 (o ponto que confunde quem ler este script depois): a v0.30.0
-- reverteu o SITE INTEIRO pro token compartilhado, e este script NÃO desfaz nada disso.
-- As 9 tabelas do esquema seguem no modelo de token, as 5 telas de escrita seguem sem
-- login, js/auth.js segue não sendo carregado por nenhuma delas. O que muda é só o
-- alcance da tabela NOVA: ela nasce fora daquele modelo, e canva-consolidado.html
-- (item 4) nasce sendo a ÚNICA tela do site que exige identidade — por código de 6
-- dígitos no e-mail, não por senha (ver "COMO A SESSÃO NASCE", abaixo).
-- Escolha deliberada, não inconsistência: o canvas é o primeiro conteúdo do site que
-- não pode ser lido por quem só tem o link.
--
-- CONTRATO PRO ITEM 4 (canva-consolidado.html), pra não se descobrir isso na hora de
-- fazer a tela: ela é gateada pelo js/auth-otp.js (código de 6 dígitos por e-mail, ver
-- acima); sem sessão o SELECT devolve 0 linhas em SILÊNCIO (é RLS filtrando, não erro),
-- então a tela tem que mostrar "peça seu código", nunca "nenhuma demanda ainda" — são
-- coisas diferentes e parecem iguais na tela. Vale pros dois motivos de 0 linhas: sem
-- sessão, e com sessão de um e-mail fora da allowlist.
--
-- Atenção ao precedente de tools/sql/2026-08_corrige_escrita_select_autenticado.sql: já
-- aconteceu neste projeto de a policy de SELECT faltar e a tela quebrar em produção.
-- Por isso leitura e escrita saem no MESMO script, aqui.
--
-- ORDEM DE EXECUÇÃO: depois de 2026-08_auditoria.sql (usa cc_audit()) e de
-- 2026-08_auth_escrita.sql (usa cc_eh_editor() e meta_inovacao_editores — a seção 0
-- confere e ABORTA se faltarem). meta_inovacao_projetos precisa existir (FK opcional
-- de projeto_id).
--
-- ⚠️ COMO A SESSÃO NASCE — regra de projeto, não detalhe de implementação: este site
-- NÃO tem senha em tela nenhuma. A identidade da canva-consolidado.html é código de 6
-- dígitos por e-mail (§6.6 do plano): signInWithOtp com shouldCreateUser:false, depois
-- verifyOtp, num js/auth-otp.js novo — sem tocar em js/auth.js, que fica onde está.
-- shouldCreateUser:false é o que faz a allowlist da seção 0 valer de ponta a ponta: quem
-- não tem usuário no projeto não ganha um só por digitar o e-mail.
--
-- Isto está escrito AQUI, num script SQL que não implementa nada disso, por um motivo:
-- daqui a três meses alguém lê "authenticated + cc_eh_editor()" e recria login por
-- senha, que é o caminho que a v0.30.0 já mostrou não servir pra este projeto (a
-- reversão inteira aconteceu porque a senha tinha sido esquecida). O SQL é indiferente
-- ao assunto — cc_eh_editor() olha auth.uid() e não sabe nem se importa como a sessão
-- nasceu — e é exatamente por ser indiferente que ele não protege a decisão sozinho.
--
-- IDEMPOTENTE: pode rodar de novo — CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE
-- FUNCTION, DROP POLICY/TRIGGER antes de recriar.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 0) Pré-requisitos do modelo de leitura — FALHA CEDO, de propósito
-- ---------------------------------------------------------------------------
-- A única policy de SELECT desta tabela é authenticated + cc_eh_editor(). Se a função
-- ou a allowlist não existirem, o script criaria uma tabela que ninguém consegue ler,
-- e o sintoma só apareceria na tela da consolidação, sem erro nenhum (RLS filtra em
-- silêncio — 0 linhas, não "permission denied"). Melhor abortar aqui: o SQL Editor do
-- Supabase roda o script numa transação, então nada fica pela metade.
DO $$
BEGIN
  IF to_regclass('public.meta_inovacao_editores') IS NULL THEN
    RAISE EXCEPTION 'meta_inovacao_editores não existe — rode tools/sql/2026-08_auth_escrita.sql antes deste script.';
  END IF;
  IF to_regprocedure('public.cc_eh_editor()') IS NULL THEN
    RAISE EXCEPTION 'cc_eh_editor() não existe — rode tools/sql/2026-08_auth_escrita.sql antes deste script.';
  END IF;
END $$;

-- Allowlist: a v0.30.0 esvaziou meta_inovacao_editores (o login tinha saído de cena),
-- e com ela vazia cc_eh_editor() devolve false pra todo mundo, inclusive pro JR. — a
-- consolidação abriria sem ler nada. Mesmo INSERT idempotente de
-- 2026-08_auth_escrita_cadastro_editor.sql: rodar de novo só atualiza o nome.
-- O user_id é o do usuário já criado em Authentication > Users (juniorapt@gmail.com);
-- se ele tiver sido apagado desde então, recrie o usuário no painel e troque o UUID
-- aqui antes de rodar.
INSERT INTO public.meta_inovacao_editores (user_id, nome)
VALUES ('5afe68ad-4fa5-4959-b62f-3fb1bbf65a2b', 'JR.')
ON CONFLICT (user_id) DO UPDATE SET nome = EXCLUDED.nome;


-- ---------------------------------------------------------------------------
-- 1) Tabela
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_inovacao_canva_demandas (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- quem preencheu, por qual projeto
  projeto            text NOT NULL,                      -- nome CANÔNICO: o do golden record quando casou, senão o cru
  -- O texto CRU, exatamente como saiu do dropdown ou do campo livre, sem normalizar e
  -- sem canonizar. Existe pra que o casamento normalizado da seção 5.8 seja AUDITÁVEL:
  -- no dia em que ele casar com o projeto errado (dois projetos de nome parecido, um
  -- apelido que colide), sem o cru não há como descobrir — a evidência do que a pessoa
  -- realmente escolheu teria sido sobrescrita pelo palpite da função. Nunca é lido pra
  -- decidir nada; é registro.
  projeto_digitado   text NOT NULL,
  projeto_id         bigint REFERENCES public.meta_inovacao_projetos(id),  -- nulo enquanto o projeto for novo
  projeto_novo       boolean NOT NULL DEFAULT false,     -- veio pelo escape "não encontrei meu projeto" — fila de normalização
  nucleo             text,                               -- preenchido pela função quando o projeto é conhecido

  -- contexto da oficina
  canal              text NOT NULL,                      -- id de data/canais.js (CANAL/URC no .docx) — whitelist na seção 5
  facilitador        text,                               -- FACILITADOR URC
  ciclo              text,
  encontro_id        text,

  -- a demanda em si (os 6 campos do .docx)
  servico            text NOT NULL,                      -- Serviço apresentado
  problema           text NOT NULL,                      -- Problema do projeto que ele resolve
  bloqueio           text,                               -- Por que não funcionaria?
  canal_proprio      text NOT NULL,                      -- Já existe em canal próprio (pirata)? sim/nao/nao_sei
  canal_proprio_qual text,                               -- qual? (obrigatório quando canal_proprio='sim')
  responsavel        text NOT NULL,                      -- Responsável
  prazo              date NOT NULL,                      -- Prazo

  -- quarentena e rastreio
  status             text NOT NULL DEFAULT 'rascunho',   -- rascunho (nasce sempre) → validada | descartada
  autor_nome         text NOT NULL,                      -- quem digitou, texto livre (não tem login nesta tela)
  sessao_id          uuid NOT NULL,                      -- crypto.randomUUID() do navegador — dono da linha pra edição (§6.4)
  criado_em          timestamptz NOT NULL DEFAULT now(),

  -- padrão do projeto
  deleted_at         timestamptz,                        -- soft delete — nunca DELETE físico
  updated_at         timestamptz NOT NULL DEFAULT now(),
  updated_by         text,

  -- "Nenhuma linha sai da mesa sem responsável e prazo" — o rodapé do .docx vira
  -- constraint. O outro lugar onde essa regra vive é o botão desabilitado da tela.
  CONSTRAINT cc_canva_responsavel_prazo CHECK (btrim(responsavel) <> '' AND prazo IS NOT NULL),
  CONSTRAINT cc_canva_servico_nao_vazio CHECK (btrim(servico) <> ''),
  CONSTRAINT cc_canva_problema_nao_vazio CHECK (btrim(problema) <> ''),
  CONSTRAINT cc_canva_projeto_nao_vazio CHECK (btrim(projeto) <> ''),
  CONSTRAINT cc_canva_status_valido CHECK (status IN ('rascunho', 'validada', 'descartada')),
  CONSTRAINT cc_canva_canal_proprio_valido CHECK (canal_proprio IN ('sim', 'nao', 'nao_sei')),
  -- "sim" sem dizer qual não serve pra nada na consolidação
  CONSTRAINT cc_canva_canal_proprio_qual CHECK (
    canal_proprio <> 'sim' OR btrim(coalesce(canal_proprio_qual, '')) <> ''
  )
);

-- SEM unique em (projeto, canal), de propósito: N demandas pro mesmo par é o
-- comportamento esperado (§3 do plano), não duplicata a evitar.
CREATE INDEX IF NOT EXISTS meta_inovacao_canva_demandas_projeto_canal_idx
  ON public.meta_inovacao_canva_demandas (projeto, canal);
CREATE INDEX IF NOT EXISTS meta_inovacao_canva_demandas_status_idx
  ON public.meta_inovacao_canva_demandas (status);
CREATE INDEX IF NOT EXISTS meta_inovacao_canva_demandas_projeto_novo_idx
  ON public.meta_inovacao_canva_demandas (projeto_novo) WHERE projeto_novo;
-- usado pelo teto por sessão (§6.3) e pela edição da própria linha (§6.4)
CREATE INDEX IF NOT EXISTS meta_inovacao_canva_demandas_sessao_idx
  ON public.meta_inovacao_canva_demandas (sessao_id);


-- ---------------------------------------------------------------------------
-- 2) Trigger de updated_at (reaproveita a função — CREATE OR REPLACE é idempotente)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cc_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cc_touch_updated_at_canva ON public.meta_inovacao_canva_demandas;
CREATE TRIGGER cc_touch_updated_at_canva
  BEFORE UPDATE ON public.meta_inovacao_canva_demandas
  FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 3) Trigger de auditoria (§6.7) — tabela editável de verdade, entra no grupo de
--    cc_audit() (tools/sql/2026-08_auditoria.sql). cc_audit() pega o autor por
--    to_jsonb(NEW)->>'updated_by', que esta tabela tem.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS cc_audit_canva_demandas ON public.meta_inovacao_canva_demandas;
CREATE TRIGGER cc_audit_canva_demandas
  AFTER INSERT OR UPDATE OR DELETE ON public.meta_inovacao_canva_demandas
  FOR EACH ROW EXECUTE FUNCTION public.cc_audit();


-- ---------------------------------------------------------------------------
-- 4) RLS — leitura fechada, escrita SÓ por função (as duas exceções do cabeçalho)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'meta_inovacao_canva_demandas'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_canva_demandas', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.meta_inovacao_canva_demandas ENABLE ROW LEVEL SECURITY;

-- GRANT vem ANTES das policies (PADRAO_TABELA.md item 3 — sem ele, RLS nem é avaliado).
--
-- anon fica FORA do GRANT inteiro, inclusive de SELECT — diferente de todas as outras
-- tabelas do esquema. Não é rigor decorativo: anon é o role de quem só tem o link, e o
-- link desta feature é público de propósito. A única coisa que anon pode fazer nesta
-- feature é EXECUTE nas duas funções (seção 7).
--
-- authenticated leva só SELECT: nem INSERT, nem UPDATE, nem DELETE. A escrita do público
-- entra pelas funções SECURITY DEFINER das seções 5 e 6; a escrita do EDITOR
-- (validar/descartar/promover, na consolidação) também vai por função dedicada — item 4
-- do plano, não este script.
--
-- O REVOKE abaixo não é redundante, e isso só aparece no Supabase: por padrão ele
-- concede REFERENCES, TRIGGER e TRUNCATE a anon e authenticated em toda tabela nova, o
-- que num Postgres cru não acontece. Sem o REVOKE, a verificação (a) devolve 7 linhas
-- em vez de 1 e o script passa a prometer uma coisa e entregar outra. Não é buraco de
-- segurança — o PostgREST não expõe nenhum dos três, e desde 30/05/2026 as tabelas
-- novas já não recebem mais os GRANTs de DML — mas "anon não tem nada nesta tabela"
-- precisa ser verdade literal, senão a verificação vira ruído que se aprende a ignorar.
REVOKE ALL ON public.meta_inovacao_canva_demandas FROM anon, authenticated;

GRANT SELECT ON public.meta_inovacao_canva_demandas TO authenticated;

-- ÚNICA policy de leitura: sessão logada de verdade E presente na allowlist
-- meta_inovacao_editores (seção 0). Sem token, sem exceção pra anon.
CREATE POLICY "cc_select_editor_autenticado" ON public.meta_inovacao_canva_demandas
  FOR SELECT TO authenticated
  USING (public.cc_eh_editor());


-- ---------------------------------------------------------------------------
-- 5) cc_canva_gravar(p jsonb) — a ÚNICA porta de entrada de demanda nova
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER: roda com privilégio do dono da função, não do anon que chamou —
-- é assim que ela grava numa tabela onde anon não tem GRANT de INSERT nenhum.
--
-- CONTRATO DE RETORNO: sempre jsonb, nunca EXCEPTION em erro de validação. Erro de
-- preenchimento não é falha de sistema — a tela precisa mostrar a frase, não um
-- stacktrace do PostgREST. Formatos:
--   sucesso  → {"ok": true,  "id": 123, "projeto_novo": false, "nucleo": "Startups"}
--   honeypot → {"ok": true,  "id": null, "ignorado": true}      (bot: responde ok, não grava)
--   erro     → {"ok": false, "erro": "frase pra tela", "campo": "canal"}
--
-- VALIDAÇÃO ASSIMÉTRICA (§6.2, o ponto mais importante desta versão):
--   canal   → whitelist DURA. Desconhecido não grava. Canais são fixos e a matriz
--             depende deles pra casar a célula.
--   projeto → MACIO. Se casar com o golden record, grava projeto_id + nucleo. Se não
--             casar, grava projeto_novo=true e a linha entra normalmente. Barrar aqui
--             seria mandar embora o gestor mais novo, que é quem mais precisa entrar
--             na matriz. A normalização acontece depois, na consolidação.
--
-- ⚠️ A whitelist de canais abaixo é o QUARTO lugar onde os 10 canais aparecem, junto de
-- data/canais.js, data/matriz.js e o dropdown de demandas.html. Canal novo = bater nos
-- quatro (nota do §12 do plano).
-- ---------------------------------------------------------------------------

-- normalização de nome pra casar "embrapii", "Embrapii" e "EMBRAPII " no mesmo lugar:
-- minúsculas, sem acento, espaços colapsados. IMMUTABLE porque só depende da entrada.
CREATE OR REPLACE FUNCTION public.cc_canva_normalizar(txt text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT btrim(regexp_replace(
    translate(
      lower(coalesce(txt, '')),
      'áàâãäéèêëíìîïóòôõöúùûüçñ',
      'aaaaaeeeeiiiiooooouuuucn'
    ),
    '\s+', ' ', 'g'
  ));
$$;

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
    responsavel, prazo, status, autor_nome, sessao_id, updated_by
  ) VALUES (
    v_projeto, v_digitado, v_projeto_id, v_novo, v_nucleo,
    v_canal, v_facilitador, v_ciclo, v_encontro,
    v_servico, v_problema, v_bloqueio, v_cproprio, v_cproprio_q,
    v_responsavel, v_prazo, 'rascunho', v_autor, v_sessao, v_autor
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'projeto_novo', v_novo, 'nucleo', v_nucleo);
END;
$$;


-- ---------------------------------------------------------------------------
-- 6) cc_canva_editar(p jsonb) — corrigir a PRÓPRIA linha (§6.4)
-- ---------------------------------------------------------------------------
-- Só atualiza se: o sessao_id do payload bate com o da linha, a linha tem menos de 24h
-- e ainda está como 'rascunho'. Permite corrigir typo sem abrir a porta pra editar o
-- que outro escreveu — o sessao_id é o que faz as vezes de "dono" numa tela sem login.
-- Mesmo contrato de retorno da cc_canva_gravar.
--
-- projeto/canal NÃO são editáveis aqui de propósito: mudar o par projeto×canal depois
-- de gravado é mover a demanda de célula da matriz, decisão que é da consolidação
-- (item 4), não do gestor no meio da oficina. Pra "mover", apague e crie outra.
-- ---------------------------------------------------------------------------
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
  v_prazo       date;
  v_apagar      boolean;
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

  -- uma resposta só pros 4 motivos (linha de outro, já validada, velha demais,
  -- inexistente): dizer QUAL deles é entregaria informação sobre linha alheia.
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Esta demanda não pode mais ser editada por aqui.', 'campo', NULL);
  END IF;

  -- 6.1 apagar a própria linha (soft delete) — o "remover" do cartão na tela.
  -- cast dentro de BEGIN/EXCEPTION porque o contrato desta função é "sempre jsonb":
  -- um 'apagar' com lixo no lugar de true/false não pode virar EXCEPTION crua.
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

  -- 6.2 campos editáveis — ausente no payload = mantém o valor atual (patch parcial)
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
  IF v_prazo < (current_date - INTERVAL '30 days') OR v_prazo > (current_date + INTERVAL '2 years') THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Prazo fora da janela — use uma data entre 30 dias atrás e 2 anos à frente.', 'campo', 'prazo');
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
      updated_by         = coalesce(NULLIF(btrim(coalesce(p->>'autor_nome','')), ''), v_linha.autor_nome)
      -- status NÃO entra: continua 'rascunho'. Promover é ato de editor, na consolidação.
  WHERE id = v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;


-- ---------------------------------------------------------------------------
-- 7) EXECUTE nas funções — a única permissão que anon ganha nesta feature
-- ---------------------------------------------------------------------------
-- REVOKE de PUBLIC primeiro: SECURITY DEFINER + EXECUTE pra PUBLIC por padrão é a
-- combinação clássica de escalada de privilégio. Aqui o EXECUTE é explícito e restrito.
REVOKE ALL ON FUNCTION public.cc_canva_gravar(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cc_canva_editar(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cc_canva_normalizar(text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.cc_canva_gravar(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_canva_editar(jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cc_canva_normalizar(text) TO anon, authenticated;


-- ---------------------------------------------------------------------------
-- 8) PostgREST precisa enxergar a tabela e as funções novas
-- ---------------------------------------------------------------------------
-- Tabela nova o PostgREST detecta sozinho (PADRAO_TABELA.md item 8), mas FUNÇÃO nova
-- exposta como RPC entra no mesmo cache de schema — sem isso, a primeira chamada de
-- /rest/v1/rpc/cc_canva_gravar pode voltar PGRST202 ("Could not find the function ...
-- in the schema cache") até o cache renovar sozinho.
NOTIFY pgrst, 'reload schema';


-- ============================================================================
-- Verificação — rode e confira à mão
-- ============================================================================
-- (a) GRANTs: a resposta CERTA é UMA linha só — authenticated | SELECT.
--     Se vierem 7 linhas (REFERENCES/TRIGGER/TRUNCATE pros dois roles), o REVOKE da
--     seção 4 não rodou: são os GRANTs que o Supabase dá sozinho em tabela nova, não
--     algo que este script tenha concedido. Rode a seção 4 de novo.
--     Qualquer linha com grantee 'anon' — em especial SELECT/INSERT/UPDATE/DELETE —
--     é bug de verdade: anon não tem nada nesta tabela, nem leitura.
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'meta_inovacao_canva_demandas'
  AND grantee IN ('anon', 'authenticated')
ORDER BY grantee, privilege_type;

-- (b) policies: UMA só — cc_select_editor_autenticado | SELECT | {authenticated}.
--     Nenhuma de INSERT/UPDATE/DELETE, nenhuma citando x-cc-token.
SELECT policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'meta_inovacao_canva_demandas'
ORDER BY cmd, policyname;

-- (b2) a allowlist tem que ter o JR., senão cc_eh_editor() devolve false e a
--      consolidação abre vazia mesmo com login (deve trazer 1 linha):
SELECT user_id, nome FROM public.meta_inovacao_editores;

-- (c) normalização casa as três grafias no mesmo lugar (deve vir 't'):
SELECT public.cc_canva_normalizar('EMBRAPII ') = public.cc_canva_normalizar('Embrapii')
   AND public.cc_canva_normalizar('  Inovação   Territorial ') = 'inovacao territorial' AS normalizacao_ok;

-- (d) canal fora da whitelist é recusado sem gravar (deve vir ok=false, campo=canal):
SELECT public.cc_canva_gravar(jsonb_build_object(
  'projeto','Embrapii','canal','canal_inventado','servico','x','problema','y',
  'canal_proprio','nao','responsavel','Fulano','prazo', (current_date + 30)::text,
  'autor_nome','Teste','sessao_id', gen_random_uuid()::text));

-- (e) projeto DESCONHECIDO grava normalmente, com projeto_novo=true (§6.2 — o coração
--     desta versão). Deve vir ok=true e projeto_novo=true:
SELECT public.cc_canva_gravar(jsonb_build_object(
  'projeto','Projeto Que Nao Existe No Golden Record','canal','empresa',
  'servico','teste de fumaça','problema','validar o script','canal_proprio','nao_sei',
  'responsavel','Teste','prazo', (current_date + 30)::text,
  'autor_nome','Teste','sessao_id', gen_random_uuid()::text));

-- (f) projeto CONHECIDO casa e traz o núcleo (deve vir ok=true, projeto_novo=false,
--     nucleo preenchido):
SELECT public.cc_canva_gravar(jsonb_build_object(
  'projeto','embrapii  ','canal','empresa',
  'servico','teste de fumaça','problema','validar o casamento de nome','canal_proprio','sim',
  'canal_proprio_qual','planilha própria',
  'responsavel','Teste','prazo', (current_date + 30)::text,
  'autor_nome','Teste','sessao_id', gen_random_uuid()::text));

-- (g) honeypot não grava (deve vir ok=true com ignorado=true, e a contagem de (h) não sobe):
SELECT public.cc_canva_gravar(jsonb_build_object(
  'projeto','Embrapii','canal','empresa','servico','spam','problema','spam',
  'canal_proprio','nao','responsavel','Bot','prazo', (current_date + 30)::text,
  'autor_nome','Bot','sessao_id', gen_random_uuid()::text,'empresa_site','http://spam'));

-- (h) as linhas de teste de (e) e (f) — LIMPE depois de conferir. Repare na linha da
--     Embrapii: projeto='Embrapii' (canônico, o que a consolidação agrupa) e
--     projeto_digitado='embrapii  ' (cru, o que a pessoa escolheu). É esse par que
--     torna o casamento normalizado auditável depois.
SELECT id, projeto, projeto_digitado, projeto_novo, nucleo, canal, status
FROM public.meta_inovacao_canva_demandas
WHERE autor_nome = 'Teste' ORDER BY id;
-- DELETE FROM public.meta_inovacao_canva_demandas WHERE autor_nome IN ('Teste','Bot');
-- (DELETE físico aqui é ok e é o certo: são linhas de fumaça do próprio script, não
--  dado de oficina — soft delete só vale pro conteúdo de verdade.)


-- ============================================================================
-- COMO REVERTER (só faz sentido antes da primeira oficina — depois disso a tabela
-- tem dado de gestor que não foi digitado em outro lugar nenhum)
-- ============================================================================
--   DROP TRIGGER IF EXISTS cc_audit_canva_demandas ON public.meta_inovacao_canva_demandas;
--   DROP TRIGGER IF EXISTS cc_touch_updated_at_canva ON public.meta_inovacao_canva_demandas;
--   DROP FUNCTION IF EXISTS public.cc_canva_gravar(jsonb);
--   DROP FUNCTION IF EXISTS public.cc_canva_editar(jsonb);
--   DROP TABLE IF EXISTS public.meta_inovacao_canva_demandas;
--   DROP FUNCTION IF EXISTS public.cc_canva_normalizar(text);
--   NOTIFY pgrst, 'reload schema';
-- A linha do JR. em meta_inovacao_editores (seção 0) NÃO entra na reversão: ela não é
-- desta feature, é o cadastro de editor do site — apagar reabriria o buraco que a
-- v0.30.0 deixou. Se for pra remover mesmo, é decisão separada.
-- ============================================================================
