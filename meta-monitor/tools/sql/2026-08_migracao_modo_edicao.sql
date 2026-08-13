-- ============================================================================
-- Migração dos conjuntos restantes do Modo edição pro Supabase — "Correções v0.18.x"
-- ============================================================================
-- Até aqui só Plano de ação e Agenda editavam ao vivo no Supabase (P10); Pessoas,
-- Projetos e URC (Liderança/Canais) ainda usavam o fluxo antigo (editar cópia local em
-- editor.html → baixar arquivo → substituir em data/ → validar → git push). Este script
-- cria as 4 tabelas que fecham essa lacuna:
--   - meta_inovacao_pessoas               (data/pessoas.js → window.DB.pessoas)
--   - meta_inovacao_projetos              (data/projetos.js → window.DB.projetos)
--   - meta_inovacao_urc_lideranca         (data/urc.js → window.DB.urc_lideranca)
--   - meta_inovacao_urc_canais_responsaveis (data/urc.js → window.DB.urc_canais, ACHATADA)
--
-- A Matriz de demandas (5º conjunto "ainda-arquivo" do dropdown) NÃO entra aqui: a
-- edição de verdade já é Supabase desde a v0.3.0 (meta_inovacao_matriz_demandas, via
-- demandas.html/js/matriz-store.js) — o botão de "Matriz" em editor.html é só um
-- export/snapshot que regenera data/matriz.js (o arquivo de fallback), não uma 2ª
-- superfície de edição. Renomeado no frontend pra deixar isso explícito no rótulo do
-- botão, sem mudar nada de dado.
--
-- ORDEM DE EXECUÇÃO: depois de 2026-08_plano.sql / 2026-08_agenda.sql /
-- 2026-08_protecao_escrita.sql / 2026-08_auditoria.sql (a função cc_audit() usada nas
-- seções 4 seguintes já precisa existir — se este script rodar antes dela por engano,
-- cada bloco 4.x abaixo recria a função sozinho via CREATE OR REPLACE, então funciona
-- de qualquer ordem, mas o ideal é auditoria.sql primeiro pra não ficar um período sem
-- os triggers nas 4 tabelas novas).
--
-- DESVIOS do desenho literal do pedido, registrados aqui pra rastreabilidade:
--   - Nenhuma das 4 listas de origem (data/pessoas.js.pessoas, data/projetos.js,
--     data/urc.js.urc_lideranca/urc_canais) tem id hoje — todas ganham
--     "id bigint GENERATED ALWAYS AS IDENTITY", mesmo padrão de
--     meta_inovacao_agenda_encontros (P10): chave estável de verdade, não amarrada a
--     posição em array.
--   - urc_canais (array de canais, cada um com array aninhado de responsáveis) vira
--     UMA tabela achatada (1 linha por canal+responsável), não duas tabelas
--     relacionadas — os 8 canais em si continuam uma lista FIXA no client
--     (CANAIS_URC, já hardcoded em editor.html/participantes.html hoje), não uma
--     tabela: não há como criar/remover canal pela UI, só responsáveis dentro dos 8
--     que já existem. Mesmo modelo mental que editor.html já usa no client hoje pra
--     editar isso (achatarUrcCanais/regravarUrcCanais) — a tabela só nasce já
--     achatada, sem precisar desse passo de tradução.
--   - Auditoria (cc_audit()): as 4 tabelas se qualificam como "editável de verdade"
--     pelo critério do próprio tools/sql/PADRAO_TABELA.md (item 7) e por isso já
--     entram na auditoria nesta mesma leva, mesmo sem o prompt original desta rodada
--     ter pedido — evita um período de tabela editável sem rastro de quem mudou o quê.
--   - Guardrail de liderança-fora-de-canal (tools/validar_dados.py, hoje só roda
--     contra o arquivo local): replicado no client (editor.html bloqueia salvar um
--     responsável de canal com nome que bate com algum de urc_lideranca, mesma
--     mensagem do validador) E como teste de auditoria contra o Supabase de produção
--     (tools/testar_guardrail_urc_supabase.js) — RLS/SQL não impõe isso sozinho (não
--     dá pra expressar "nome não pode aparecer em outra tabela" como CHECK constraint
--     simples sem FK cruzada, e não faz sentido criar uma FK só pra isso).
-- ============================================================================


-- ============================================================================
-- 1) meta_inovacao_pessoas
-- ============================================================================
CREATE OR REPLACE FUNCTION public.cc_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.meta_inovacao_pessoas (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome       text NOT NULL,
  papel      text,                          -- só preenchido nos grupos "UI"/"Comitê"
  grupo      text NOT NULL,                 -- "UI" | "Comitê" | "Núcleos"
  nucleo     text,                          -- só preenchido no grupo "Núcleos"
  pendente   boolean NOT NULL DEFAULT false,
  ordem      int,                           -- ordem de exibição (mesma do array original)
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

DROP TRIGGER IF EXISTS cc_touch_updated_at_pessoas ON public.meta_inovacao_pessoas;
CREATE TRIGGER cc_touch_updated_at_pessoas
  BEFORE UPDATE ON public.meta_inovacao_pessoas
  FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meta_inovacao_pessoas'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_pessoas', pol.policyname); END LOOP;
END $$;

ALTER TABLE public.meta_inovacao_pessoas ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.meta_inovacao_pessoas TO anon, authenticated;

CREATE POLICY "cc_select_publico" ON public.meta_inovacao_pessoas FOR SELECT TO anon USING (true);
CREATE POLICY "cc_token_insert" ON public.meta_inovacao_pessoas FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');
CREATE POLICY "cc_token_update" ON public.meta_inovacao_pessoas FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

-- auditoria (item 3.4/P13) — reaproveita cc_audit(), já criada por 2026-08_auditoria.sql;
-- CREATE OR REPLACE aqui de novo só pra este script funcionar sozinho se rodar fora de ordem.
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
    v_autor := COALESCE(to_jsonb(OLD)->>'updated_by', to_jsonb(OLD)->>'atualizado_por', current_setting('request.headers', true)::json->>'x-cc-editor');
    INSERT INTO public.meta_inovacao_audit_log (tabela, registro_id, operacao, valor_anterior, valor_novo, autor)
    VALUES (TG_TABLE_NAME, to_jsonb(OLD)->>'id', TG_OP, to_jsonb(OLD), NULL, v_autor);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_autor := COALESCE(to_jsonb(NEW)->>'updated_by', to_jsonb(NEW)->>'atualizado_por', current_setting('request.headers', true)::json->>'x-cc-editor');
    INSERT INTO public.meta_inovacao_audit_log (tabela, registro_id, operacao, valor_anterior, valor_novo, autor)
    VALUES (TG_TABLE_NAME, to_jsonb(NEW)->>'id', TG_OP, to_jsonb(OLD), to_jsonb(NEW), v_autor);
    RETURN NEW;
  ELSE
    v_autor := COALESCE(to_jsonb(NEW)->>'updated_by', to_jsonb(NEW)->>'atualizado_por', current_setting('request.headers', true)::json->>'x-cc-editor');
    INSERT INTO public.meta_inovacao_audit_log (tabela, registro_id, operacao, valor_anterior, valor_novo, autor)
    VALUES (TG_TABLE_NAME, to_jsonb(NEW)->>'id', TG_OP, NULL, to_jsonb(NEW), v_autor);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS cc_audit_pessoas ON public.meta_inovacao_pessoas;
CREATE TRIGGER cc_audit_pessoas
  AFTER INSERT OR UPDATE OR DELETE ON public.meta_inovacao_pessoas
  FOR EACH ROW EXECUTE FUNCTION public.cc_audit();

-- Pra REVERTER:
--   DROP TRIGGER IF EXISTS cc_audit_pessoas ON public.meta_inovacao_pessoas;
--   DROP TRIGGER IF EXISTS cc_touch_updated_at_pessoas ON public.meta_inovacao_pessoas;
--   DROP TABLE IF EXISTS public.meta_inovacao_pessoas;

-- ===== SEED: meta_inovacao_pessoas (20 linhas, gerado por tools/gerar_seed_supabase.js) =====
INSERT INTO public.meta_inovacao_pessoas
  (nome, papel, grupo, nucleo, pendente, ordem)
VALUES
  ('JR. (José Júnior)', 'Coordenação do plano · ponto de contato com a URC', 'UI', NULL, false, 1),
  ('Gerência UI', 'Guardiã dos Nós 1 e 4 · comunicação institucional', 'UI', NULL, false, 2),
  ('Sandra', 'Assistente do plano: agendas, prazos, monitoramento, boletim', 'UI', NULL, false, 3),
  ('Anny', 'Comunicação · convite e articulação da oficina UDT', 'UI', NULL, false, 4),
  ('Pova', 'Agente de IA de apoio ao formulário (CAN-08/09)', 'UI', NULL, false, 5),
  ('Gabriel Gil Barreto Barros', 'Comitê de Atendimento e Relacionamento da Inovação', 'Comitê', NULL, false, 6),
  ('Hulda Oliveira Giesbrecht', 'Comitê de Atendimento e Relacionamento da Inovação', 'Comitê', NULL, false, 7),
  ('Lara Chicuta Franco', 'Comitê de Atendimento e Relacionamento da Inovação', 'Comitê', NULL, false, 8),
  ('Marcus Vinicius Lopes Bezerra', 'Comitê de Atendimento e Relacionamento da Inovação', 'Comitê', NULL, false, 9),
  ('Matheus Lopes de Queiroz Campos', 'Comitê de Atendimento e Relacionamento da Inovação', 'Comitê', NULL, false, 10),
  ('Paulo Puppin Zandonadi', 'Comitê de Atendimento e Relacionamento da Inovação', 'Comitê', NULL, false, 11),
  ('Sandra Chaves Silva Paraíso', 'Comitê de Atendimento e Relacionamento da Inovação', 'Comitê', NULL, false, 12),
  ('Gabriel Gil Barreto Barros', NULL, 'Núcleos', 'Tecnologias Portadoras de Futuro', false, 13),
  ('Hulda Oliveira Giesbrecht', NULL, 'Núcleos', 'Tecnologias Portadoras de Futuro', false, 14),
  ('Lara Chicuta Franco', NULL, 'Núcleos', 'Gestão do Conhecimento e Processos', false, 15),
  ('Marcus Vinicius Lopes Bezerra', NULL, 'Núcleos', 'Inovação Territorial', false, 16),
  ('Matheus Lopes de Queiroz Campos', NULL, 'Núcleos', 'Inovação para Competitividade', false, 17),
  ('Paulo Puppin Zandonadi', NULL, 'Núcleos', 'Startups', false, 18),
  ('Sandra Chaves Silva Paraíso', NULL, 'Núcleos', 'Gestão do Conhecimento e Processos', false, 19),
  ('José Mendes de Oliveira Júnior', NULL, 'Núcleos', 'Inovação para Competitividade', false, 20);

SELECT count(*) AS total_pessoas FROM public.meta_inovacao_pessoas WHERE deleted_at IS NULL; -- esperado 20


-- ============================================================================
-- 2) meta_inovacao_projetos
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.meta_inovacao_projetos (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nucleo         text NOT NULL,
  iniciativa     text NOT NULL,
  representantes text[] NOT NULL DEFAULT '{}',
  ordem          int,
  deleted_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     text
);

DROP TRIGGER IF EXISTS cc_touch_updated_at_projetos ON public.meta_inovacao_projetos;
CREATE TRIGGER cc_touch_updated_at_projetos
  BEFORE UPDATE ON public.meta_inovacao_projetos
  FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meta_inovacao_projetos'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_projetos', pol.policyname); END LOOP;
END $$;

ALTER TABLE public.meta_inovacao_projetos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.meta_inovacao_projetos TO anon, authenticated;

CREATE POLICY "cc_select_publico" ON public.meta_inovacao_projetos FOR SELECT TO anon USING (true);
CREATE POLICY "cc_token_insert" ON public.meta_inovacao_projetos FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');
CREATE POLICY "cc_token_update" ON public.meta_inovacao_projetos FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

DROP TRIGGER IF EXISTS cc_audit_projetos ON public.meta_inovacao_projetos;
CREATE TRIGGER cc_audit_projetos
  AFTER INSERT OR UPDATE OR DELETE ON public.meta_inovacao_projetos
  FOR EACH ROW EXECUTE FUNCTION public.cc_audit();

-- Pra REVERTER:
--   DROP TRIGGER IF EXISTS cc_audit_projetos ON public.meta_inovacao_projetos;
--   DROP TRIGGER IF EXISTS cc_touch_updated_at_projetos ON public.meta_inovacao_projetos;
--   DROP TABLE IF EXISTS public.meta_inovacao_projetos;

-- ===== SEED: meta_inovacao_projetos (27 linhas) =====
INSERT INTO public.meta_inovacao_projetos
  (nucleo, iniciativa, representantes, ordem)
VALUES
  ('Inovação para Competitividade', 'ALI Academy', ARRAY['Carol']::text[], 1),
  ('Inovação para Competitividade', 'ALI Coop', ARRAY['Carol']::text[], 2),
  ('Inovação para Competitividade', 'ALI Produtividade', ARRAY['Fred']::text[], 3),
  ('Inovação para Competitividade', 'ALI Rural', ARRAY['Júnior']::text[], 4),
  ('Inovação para Competitividade', 'Consult', ARRAY['Matheus']::text[], 5),
  ('Inovação para Competitividade', 'Convênio Anprotec', ARRAY['Matheus']::text[], 6),
  ('Inovação para Competitividade', 'Coopera mais Amazônia', ARRAY['Carol']::text[], 7),
  ('Inovação para Competitividade', 'MEI + Inovador', ARRAY['Thiago']::text[], 8),
  ('Inovação para Competitividade', 'Sebraetec', ARRAY['Matheus']::text[], 9),
  ('Inovação Territorial', 'ALI Ecossistema', ARRAY['Raquel']::text[], 10),
  ('Inovação Territorial', 'ALI IG', ARRAY['Hulda']::text[], 11),
  ('Inovação Territorial', 'ATIVA', ARRAY['Raquel']::text[], 12),
  ('Inovação Territorial', 'Catalisa Gov', ARRAY['Dario','Rafa']::text[], 13),
  ('Inovação Territorial', 'ELI', ARRAY['Raquel']::text[], 14),
  ('Inovação Territorial', 'ELI Summit', ARRAY['Raquel']::text[], 15),
  ('Startups', 'Internacionalização', ARRAY['Cris']::text[], 16),
  ('Startups', 'Missões', ARRAY['Cris']::text[], 17),
  ('Startups', 'Prêmio Sebrae Startups', ARRAY['Pova']::text[], 18),
  ('Startups', 'Sebrae Startups', ARRAY['Núcleo de Startups']::text[], 19),
  ('Startups', 'Startup Day', ARRAY['Cris','Pova']::text[], 20),
  ('Startups', 'Startup NE', ARRAY['Wébia','Jéssica','Fernanda']::text[], 21),
  ('Startups', 'Websummit Rio e Lisboa', ARRAY['Cris','Pova']::text[], 22),
  ('Tecnologias Portadoras de Futuro', 'ACT Ministério da Saúde', ARRAY['Hulda']::text[], 23),
  ('Tecnologias Portadoras de Futuro', 'Catalisa ICT', ARRAY['Agnaldo']::text[], 24),
  ('Tecnologias Portadoras de Futuro', 'Embrapii', ARRAY['Agnaldo']::text[], 25),
  ('Tecnologias Portadoras de Futuro', 'Inova Biomas', ARRAY['Gabriel','Valéria','Felipe']::text[], 26),
  ('Tecnologias Portadoras de Futuro', 'Sebrae Origens', ARRAY['Hulda']::text[], 27);

SELECT count(*) AS total_projetos FROM public.meta_inovacao_projetos WHERE deleted_at IS NULL; -- esperado 27
-- nota: essa contagem (27) é uma das duas pontas da divergência 27×28 documentada em
-- tools/testar_iniciativas_cruzado.js — a outra ponta (28, Supabase corsario_status,
-- com "Salas do Empreendedor" a mais) NÃO é tocada por este script nem por esta rodada.


-- ============================================================================
-- 3) meta_inovacao_urc_lideranca
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.meta_inovacao_urc_lideranca (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nome       text NOT NULL,
  papel      text,
  email      text,
  ordem      int,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

DROP TRIGGER IF EXISTS cc_touch_updated_at_urc_lideranca ON public.meta_inovacao_urc_lideranca;
CREATE TRIGGER cc_touch_updated_at_urc_lideranca
  BEFORE UPDATE ON public.meta_inovacao_urc_lideranca
  FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meta_inovacao_urc_lideranca'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_urc_lideranca', pol.policyname); END LOOP;
END $$;

ALTER TABLE public.meta_inovacao_urc_lideranca ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.meta_inovacao_urc_lideranca TO anon, authenticated;

CREATE POLICY "cc_select_publico" ON public.meta_inovacao_urc_lideranca FOR SELECT TO anon USING (true);
CREATE POLICY "cc_token_insert" ON public.meta_inovacao_urc_lideranca FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');
CREATE POLICY "cc_token_update" ON public.meta_inovacao_urc_lideranca FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

DROP TRIGGER IF EXISTS cc_audit_urc_lideranca ON public.meta_inovacao_urc_lideranca;
CREATE TRIGGER cc_audit_urc_lideranca
  AFTER INSERT OR UPDATE OR DELETE ON public.meta_inovacao_urc_lideranca
  FOR EACH ROW EXECUTE FUNCTION public.cc_audit();

-- Pra REVERTER:
--   DROP TRIGGER IF EXISTS cc_audit_urc_lideranca ON public.meta_inovacao_urc_lideranca;
--   DROP TRIGGER IF EXISTS cc_touch_updated_at_urc_lideranca ON public.meta_inovacao_urc_lideranca;
--   DROP TABLE IF EXISTS public.meta_inovacao_urc_lideranca;

-- ===== SEED: meta_inovacao_urc_lideranca (3 linhas) =====
INSERT INTO public.meta_inovacao_urc_lideranca
  (nome, papel, email, ordem)
VALUES
  ('Enio', 'Gerente da URC', NULL, 1),
  ('Milva', 'Gerente adjunta da URC', NULL, 2),
  ('Iuri Barbosa de Andrade', 'Coordenador do núcleo de canais da URC', 'iuri.andrade@sebrae.com.br', 3);

SELECT count(*) AS total_urc_lideranca FROM public.meta_inovacao_urc_lideranca WHERE deleted_at IS NULL; -- esperado 3


-- ============================================================================
-- 4) meta_inovacao_urc_canais_responsaveis (achatada — ver desvio no cabeçalho)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.meta_inovacao_urc_canais_responsaveis (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  canal      text NOT NULL,   -- um dos 8 CANAIS_URC (lista fixa no client, não é FK)
  nome       text NOT NULL,
  email      text,
  ordem      int,             -- reinicia em 1 a cada canal (posição dentro do canal)
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

DROP TRIGGER IF EXISTS cc_touch_updated_at_urc_canais ON public.meta_inovacao_urc_canais_responsaveis;
CREATE TRIGGER cc_touch_updated_at_urc_canais
  BEFORE UPDATE ON public.meta_inovacao_urc_canais_responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();

DO $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'meta_inovacao_urc_canais_responsaveis'
  LOOP EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_urc_canais_responsaveis', pol.policyname); END LOOP;
END $$;

ALTER TABLE public.meta_inovacao_urc_canais_responsaveis ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.meta_inovacao_urc_canais_responsaveis TO anon, authenticated;

CREATE POLICY "cc_select_publico" ON public.meta_inovacao_urc_canais_responsaveis FOR SELECT TO anon USING (true);
CREATE POLICY "cc_token_insert" ON public.meta_inovacao_urc_canais_responsaveis FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');
CREATE POLICY "cc_token_update" ON public.meta_inovacao_urc_canais_responsaveis FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

DROP TRIGGER IF EXISTS cc_audit_urc_canais ON public.meta_inovacao_urc_canais_responsaveis;
CREATE TRIGGER cc_audit_urc_canais
  AFTER INSERT OR UPDATE OR DELETE ON public.meta_inovacao_urc_canais_responsaveis
  FOR EACH ROW EXECUTE FUNCTION public.cc_audit();

-- Pra REVERTER:
--   DROP TRIGGER IF EXISTS cc_audit_urc_canais ON public.meta_inovacao_urc_canais_responsaveis;
--   DROP TRIGGER IF EXISTS cc_touch_updated_at_urc_canais ON public.meta_inovacao_urc_canais_responsaveis;
--   DROP TABLE IF EXISTS public.meta_inovacao_urc_canais_responsaveis;

-- ===== SEED: meta_inovacao_urc_canais_responsaveis (11 linhas) =====
-- canais sem responsável hoje (Assessoria de Negócios, Marketing Cloud, Foco+, Rede
-- própria e parceira, DXP) não geram linha nenhuma — normal, a lista de 8 canais em
-- si é fixa no client, não depende de ter linha na tabela pra existir na UI.
INSERT INTO public.meta_inovacao_urc_canais_responsaveis
  (canal, nome, email, ordem)
VALUES
  ('CNR', 'Cendie Carvalho Da Costa Barbieri', 'cendie.barbieri@sebrae.com.br', 1),
  ('CNR', 'André Luís M. Chanpan dos Santos', 'andre.chanpan@sebrae.com.br', 2),
  ('CNR', 'Filipe Medeiros Ferreira', 'filipe.ferreira@sebrae.com.br', 3),
  ('Portal', 'Rafael Rodrigues de Lima', 'rafael.rodrigues@sebrae.com.br', 1),
  ('Portal', 'Thaíza Soares Cardoso Lima Kopp', 'thaiza.kopp@sebrae.com.br', 2),
  ('Portal', 'Michelle Carsten Santos', 'michelle.santos@sebrae.com.br', 3),
  ('Portal', 'Marcos Paulo de Sousa Santos Soares', 'marcos.soares@sebrae.com.br', 4),
  ('Portal', 'Sabrina Mendes Gonçalves', 'sabrina.mendes@sebrae.com.br', 5),
  ('Loja', 'Leandro Pereira de Jesus', 'leandro.jesus@sebrae.com.br', 1),
  ('Loja', 'Cláudia Schirmbeck Peixoto', 'claudia.peixoto@sebrae.com.br', 2),
  ('Loja', 'Davison da Silva Ferreira', 'davison.sferreira@sebrae.com.br', 3);

-- guardrail (herdado de tools/validar_dados.py — nenhum responsável de canal pode ter
-- o mesmo nome de alguém da liderança; liderança é transversal, não entra em canal
-- específico). Verificação pós-seed — deve devolver 0 linhas:
SELECT ucr.canal, ucr.nome
FROM public.meta_inovacao_urc_canais_responsaveis ucr
JOIN public.meta_inovacao_urc_lideranca ul ON ul.nome = ucr.nome AND ul.deleted_at IS NULL
WHERE ucr.deleted_at IS NULL;
-- esperado: 0 linhas. Se vier alguma, é o mesmo problema que o guardrail do
-- validador bloqueia no arquivo local — resolver ANTES de liberar a edição ao vivo
-- desta tabela (tools/testar_guardrail_urc_supabase.js reforça essa checagem depois
-- de rodado, pra detectar se isso voltar a acontecer via edição direta no Supabase).

SELECT count(*) AS total_urc_canais FROM public.meta_inovacao_urc_canais_responsaveis WHERE deleted_at IS NULL; -- esperado 11
