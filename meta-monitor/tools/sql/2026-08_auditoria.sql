-- ============================================================================
-- Log de alterações / auditoria — item 3.4 do plano de melhorias (Prompt 13)
-- ============================================================================
-- Registra quem mudou o quê e quando nas 4 tabelas editáveis do site
-- (meta_inovacao_plano_acoes, meta_inovacao_agenda_encontros,
-- plano_acao_atividades, meta_inovacao_matriz_demandas), via trigger — não depende de
-- nenhuma página lembrar de gravar o log, é automático no banco. Segue
-- tools/sql/PADRAO_TABELA.md com UMA exceção deliberada: a leitura desta tabela NÃO é
-- pública (ver seção 3) — o log é sensível (quem mudou o quê), só quem já tem o token
-- de escrita pode ler.
--
-- ORDEM DE EXECUÇÃO: depois de 2026-08_plano.sql, 2026-08_agenda.sql e
-- 2026-08_protecao_escrita.sql (P3/P10) — este script assume que as 4 tabelas
-- editáveis já existem e que plano_acao_atividades/meta_inovacao_matriz_demandas já
-- têm suas colunas de autoria atuais (nenhuma delas é criada aqui).
--
-- DESVIO do desenho original do prompt, registrado aqui pra rastreabilidade:
--   - cc_audit() usa COALESCE(to_jsonb(NEW)->>'updated_by', to_jsonb(NEW)->>'atualizado_por',
--     header x-cc-editor) em vez de só COALESCE(NEW.updated_by, header) como o prompt
--     descreveu literalmente. Motivo: nem as 4 tabelas usam o mesmo nome de coluna pra
--     autoria — meta_inovacao_plano_acoes/meta_inovacao_agenda_encontros têm
--     "updated_by" (P10), mas meta_inovacao_matriz_demandas usa "atualizado_por" (nome
--     de antes deste prompt, não renomeado agora pra não quebrar js/matriz-store.js).
--     `NEW.updated_by` direto nessa tabela faria a função SUBIR ERRO em todo INSERT/
--     UPDATE ("record new has no field updated_by") — a extração via to_jsonb()->>'...'
--     devolve NULL de forma inofensiva quando a coluna não existe no registro, em vez
--     de estourar. plano_acao_atividades não tinha NENHUMA coluna de autoria até este
--     script (seção 0) — ganhou "updated_by" aqui mesmo, igual às tabelas do P10.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 0) plano_acao_atividades ainda não tinha coluna de autoria nenhuma (plano-acao.html
--    nunca gravou "quem" até este prompt) — ganha "updated_by" aqui, mesmo nome das
--    tabelas do P10, populada por plano-acao.html a partir de agora (item 2.3).
-- ---------------------------------------------------------------------------
ALTER TABLE public.plano_acao_atividades ADD COLUMN IF NOT EXISTS updated_by text;


-- ---------------------------------------------------------------------------
-- 1) Tabela do log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_inovacao_audit_log (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tabela         text NOT NULL,             -- TG_TABLE_NAME de quem disparou (ex.: "meta_inovacao_plano_acoes")
  registro_id    text NOT NULL,             -- id (PK) do registro afetado, sempre como texto (PKs são text ou bigint conforme a tabela)
  operacao       text NOT NULL,             -- 'INSERT' | 'UPDATE' | 'DELETE' (TG_OP)
  valor_anterior jsonb,                     -- registro inteiro ANTES (NULL em INSERT)
  valor_novo     jsonb,                     -- registro inteiro DEPOIS (NULL em DELETE)
  autor          text,                      -- ver cc_audit() abaixo — pode ficar NULL se nem a coluna do registro nem o header vieram preenchidos
  criado_em      timestamptz NOT NULL DEFAULT now()
);

-- índices pra filtrar rápido na tela de Histórico (item 3.3 do prompt: por tabela e por autor)
CREATE INDEX IF NOT EXISTS meta_inovacao_audit_log_tabela_idx ON public.meta_inovacao_audit_log (tabela);
CREATE INDEX IF NOT EXISTS meta_inovacao_audit_log_autor_idx ON public.meta_inovacao_audit_log (autor);
CREATE INDEX IF NOT EXISTS meta_inovacao_audit_log_criado_em_idx ON public.meta_inovacao_audit_log (criado_em DESC);


-- ---------------------------------------------------------------------------
-- 2) Função de trigger SECURITY DEFINER — roda com o privilégio de quem a CRIOU (o
--    dono da função, normalmente o superusuário do projeto no SQL Editor), não do
--    role anon/authenticated que disparou a escrita original. É assim que a tabela do
--    log consegue receber INSERT sem precisar dar policy de INSERT pra ninguém (seção
--    3) — só a função, rodando com privilégio de dono, escreve nela.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cc_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autor text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_autor := COALESCE(
      to_jsonb(OLD)->>'updated_by',
      to_jsonb(OLD)->>'atualizado_por',
      current_setting('request.headers', true)::json->>'x-cc-editor'
    );
    INSERT INTO public.meta_inovacao_audit_log (tabela, registro_id, operacao, valor_anterior, valor_novo, autor)
    VALUES (TG_TABLE_NAME, to_jsonb(OLD)->>'id', TG_OP, to_jsonb(OLD), NULL, v_autor);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_autor := COALESCE(
      to_jsonb(NEW)->>'updated_by',
      to_jsonb(NEW)->>'atualizado_por',
      current_setting('request.headers', true)::json->>'x-cc-editor'
    );
    INSERT INTO public.meta_inovacao_audit_log (tabela, registro_id, operacao, valor_anterior, valor_novo, autor)
    VALUES (TG_TABLE_NAME, to_jsonb(NEW)->>'id', TG_OP, to_jsonb(OLD), to_jsonb(NEW), v_autor);
    RETURN NEW;
  ELSE -- INSERT
    v_autor := COALESCE(
      to_jsonb(NEW)->>'updated_by',
      to_jsonb(NEW)->>'atualizado_por',
      current_setting('request.headers', true)::json->>'x-cc-editor'
    );
    INSERT INTO public.meta_inovacao_audit_log (tabela, registro_id, operacao, valor_anterior, valor_novo, autor)
    VALUES (TG_TABLE_NAME, to_jsonb(NEW)->>'id', TG_OP, NULL, to_jsonb(NEW), v_autor);
    RETURN NEW;
  END IF;
END;
$$;


-- ---------------------------------------------------------------------------
-- 3) RLS do log — EXCEÇÃO ao padrão de SELECT público de tools/sql/PADRAO_TABELA.md:
--    aqui a leitura também exige o token de escrita (x-cc-token), não é aberta. Sem
--    policy de INSERT/UPDATE/DELETE — a única escrita é via cc_audit() (SECURITY
--    DEFINER, seção 2), que roda com privilégio de dono e ignora RLS por padrão (dono
--    de tabela não é restringido pela própria RLS, a menos que FORCE ROW LEVEL
--    SECURITY esteja ligado — não está).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'meta_inovacao_audit_log'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_audit_log', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.meta_inovacao_audit_log ENABLE ROW LEVEL SECURITY;

-- só SELECT no GRANT — sem INSERT/UPDATE/DELETE, de propósito (ver comentário acima).
GRANT SELECT ON public.meta_inovacao_audit_log TO anon, authenticated;

CREATE POLICY "cc_token_select" ON public.meta_inovacao_audit_log
  FOR SELECT TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');


-- ---------------------------------------------------------------------------
-- 4) Triggers nas 4 tabelas editáveis — AFTER (não BEFORE: o log registra o que JÁ
--    aconteceu, não decide se acontece) INSERT OR UPDATE OR DELETE, FOR EACH ROW.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS cc_audit_plano_acoes ON public.meta_inovacao_plano_acoes;
CREATE TRIGGER cc_audit_plano_acoes
  AFTER INSERT OR UPDATE OR DELETE ON public.meta_inovacao_plano_acoes
  FOR EACH ROW EXECUTE FUNCTION public.cc_audit();

DROP TRIGGER IF EXISTS cc_audit_agenda_encontros ON public.meta_inovacao_agenda_encontros;
CREATE TRIGGER cc_audit_agenda_encontros
  AFTER INSERT OR UPDATE OR DELETE ON public.meta_inovacao_agenda_encontros
  FOR EACH ROW EXECUTE FUNCTION public.cc_audit();

DROP TRIGGER IF EXISTS cc_audit_plano_acao_atividades ON public.plano_acao_atividades;
CREATE TRIGGER cc_audit_plano_acao_atividades
  AFTER INSERT OR UPDATE OR DELETE ON public.plano_acao_atividades
  FOR EACH ROW EXECUTE FUNCTION public.cc_audit();

DROP TRIGGER IF EXISTS cc_audit_matriz_demandas ON public.meta_inovacao_matriz_demandas;
CREATE TRIGGER cc_audit_matriz_demandas
  AFTER INSERT OR UPDATE OR DELETE ON public.meta_inovacao_matriz_demandas
  FOR EACH ROW EXECUTE FUNCTION public.cc_audit();


-- Pra REVERTER (tudo, na ordem inversa — os triggers primeiro, senão a função fica
-- "em uso" e o DROP FUNCTION falha):
--   DROP TRIGGER IF EXISTS cc_audit_plano_acoes ON public.meta_inovacao_plano_acoes;
--   DROP TRIGGER IF EXISTS cc_audit_agenda_encontros ON public.meta_inovacao_agenda_encontros;
--   DROP TRIGGER IF EXISTS cc_audit_plano_acao_atividades ON public.plano_acao_atividades;
--   DROP TRIGGER IF EXISTS cc_audit_matriz_demandas ON public.meta_inovacao_matriz_demandas;
--   DROP FUNCTION IF EXISTS public.cc_audit();
--   DROP TABLE IF EXISTS public.meta_inovacao_audit_log;
--   ALTER TABLE public.plano_acao_atividades DROP COLUMN IF EXISTS updated_by;


-- ---------------------------------------------------------------------------
-- Verificação — não há seed/backfill (o log só registra escritas DAQUI PRA FRENTE,
-- não reconstrói o histórico de mudanças que já aconteceram antes deste script rodar).
-- Logo depois de rodar, a contagem abaixo deve ser 0; edite qualquer coisa numa das 4
-- telas de escrita e rode nesse depois — deve aparecer 1 linha nova.
-- ---------------------------------------------------------------------------
SELECT count(*) AS total_no_log_ainda FROM public.meta_inovacao_audit_log;
