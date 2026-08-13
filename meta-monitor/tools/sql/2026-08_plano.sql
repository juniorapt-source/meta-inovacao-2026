-- ============================================================================
-- Migração do conjunto PLANO pro Supabase — item 3.1 do plano de melhorias (Prompt 10)
-- ============================================================================
-- Cria meta_inovacao_plano_acoes (status e prazos das 47 ações do plano — hoje só em
-- data/plano.js, editado via Modo edição → baixa arquivo → commit). data/plano.js
-- continua existindo como SEED + fallback de leitura (js/db-plano.js cai pra lá se o
-- Supabase estiver fora do ar) — não é removido, só deixa de ser a fonte primária.
--
-- ORDEM DE EXECUÇÃO: este script é o 1º dos dois desta leva (rodar antes do
-- 2026-08_agenda.sql — a função de trigger cc_touch_updated_at criada aqui é
-- reaproveitada lá, embora o outro script também saiba se criar sozinho caso rode
-- isolado). Mesmo padrão de token do 2026-08_protecao_escrita.sql (P3) — já deve
-- estar aplicado e ativo antes de rodar este aqui (RLS por header x-cc-token).
--
-- DESVIOS do desenho original do prompt, registrados aqui pra rastreabilidade:
--   - Colunas extras (dependencias, cc_tipo, como, monitor, ferramenta) além das
--     listadas no prompt: sem elas, plano.html perderia a seção "Depende de" e a
--     "solução proposta" (como executar/monitorar/ferramenta) de cada ação, e
--     caminho.html perderia o chip ★ Nó/cadeia/SLA — funcionalidade real hoje, não
--     dá pra migrar perdendo isso.
--   - "status" guarda só os 3 estados ARMAZENADOS (nao_iniciado/em_andamento/
--     concluida) — "atrasada"/"janela" continuam calculados no client (CALC.ehAtrasada
--     + presença de prazo_iso), exatamente como hoje; nunca foram um valor gravado.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Função de trigger reaproveitável — atualiza updated_at sozinha em todo UPDATE.
--    CREATE OR REPLACE: idempotente, seguro rodar de novo ou noutra ordem.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cc_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
-- 2) Tabela
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_inovacao_plano_acoes (
  id             text PRIMARY KEY,              -- mesmo ID visível hoje (ex.: CMT-01)
  frente         text,
  subfrente      text,
  atividade      text NOT NULL,
  responsavel    text,                          -- legado, texto livre (compatibilidade — Tarefa 0.3)
  responsavel_id text[] DEFAULT '{}',            -- ids da lista canônica (data/pessoas.js, P4)
  prazo_iso      date,
  prazo_texto    text,                          -- prazo em texto quando não há data fixa ("contínuo", "set–out"...)
  status         text NOT NULL DEFAULT 'nao_iniciado',  -- chave canônica armazenada (P6, contexto "acao")
  dependencias   text[] DEFAULT '{}',            -- ids de outras ações desta mesma tabela
  cc_tipo        text,                          -- 'no' | 'cadeia' | 'sla' | null (caminho crítico)
  no_critico     int,                           -- número do nó, quando cc_tipo aplicável
  como           text,                          -- solução proposta: como executar
  monitor        text,                          -- solução proposta: como monitorar
  ferramenta     text,                          -- solução proposta: com qual ferramenta
  ordem          int,                           -- ordem de exibição (mesma do array original)
  deleted_at     timestamptz,                   -- soft delete — nunca DELETE físico
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     text
);

DROP TRIGGER IF EXISTS cc_touch_updated_at_plano ON public.meta_inovacao_plano_acoes;
CREATE TRIGGER cc_touch_updated_at_plano
  BEFORE UPDATE ON public.meta_inovacao_plano_acoes
  FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 3) RLS — mesmo padrão do P3 (tools/sql/2026-08_protecao_escrita.sql): SELECT
--    público, escrita só com o header x-cc-token certo. Sem policy de DELETE —
--    remoção é sempre soft delete (UPDATE em deleted_at), igual a
--    plano_acao_atividades; não existe hard DELETE nesta tabela.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'meta_inovacao_plano_acoes'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_plano_acoes', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.meta_inovacao_plano_acoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_publico" ON public.meta_inovacao_plano_acoes
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "cc_token_insert" ON public.meta_inovacao_plano_acoes
  FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

CREATE POLICY "cc_token_update" ON public.meta_inovacao_plano_acoes
  FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

-- Pra REVERTER (apaga a tabela inteira — só faz sentido logo depois de criar,
-- antes de qualquer edição real acontecer pelo Modo edição):
--   DROP TABLE IF EXISTS public.meta_inovacao_plano_acoes;
--   DROP TRIGGER IF EXISTS cc_touch_updated_at_plano ON public.meta_inovacao_plano_acoes;


-- ---------------------------------------------------------------------------
-- 4) Seed — gerado por tools/gerar_seed_supabase.js a partir de data/plano.js
--    (rode de novo esse script se data/plano.js mudar antes desta migração
--    acontecer de verdade, pra pegar a versão mais recente).
-- ---------------------------------------------------------------------------
INSERT INTO public.meta_inovacao_plano_acoes
  (id, frente, subfrente, atividade, responsavel, responsavel_id, prazo_iso, prazo_texto, status, dependencias, cc_tipo, no_critico, como, monitor, ferramenta, ordem)
VALUES
  ('CMT-01', '1. Comitê e Governança', 'Governança', 'Constituição do Comitê', 'Coordenadores', ARRAY['coordenadores']::text[], '2026-07-28', '28/07', 'concluida', '{}', NULL, NULL, 'Concluída. Registrar em ata a composição e os três papéis do Comitê (engajamento, curadoria, devolutiva) para citação nas comunicações.', 'Ata publicada e referenciada no boletim CG-01.', 'Ata + repositório do projeto', 1),
  ('CMT-02', '1. Comitê e Governança', 'Governança', 'Programação das agendas recorrentes (semanais ou quinzenais) do Comitê', 'Sandra', ARRAY['sandra']::text[], '2026-08-05', '05/08', 'nao_iniciado', '{}', NULL, NULL, 'Sandra cria série recorrente no calendário (semanal ou quinzenal, 50 min) com pauta padrão fixa: nós da semana, pendências de formulário, decisões.', 'Série criada no calendário e taxa de realização das reuniões registrada neste painel (agenda).', 'Outlook/Teams + painel', 2),
  ('CMT-03', '1. Comitê e Governança', 'Comunicação', 'Apresentação do Comitê e do plano de ação na reunião de equipe', 'Gerência', ARRAY['gerencia']::text[], '2026-08-10', '10/08', 'nao_iniciado', '{}', NULL, NULL, 'Usar o deck já validado; apresentar plano, papéis e este painel na reunião de equipe de 10/08. Encerrar com o trilho dos 7 nós.', 'Apresentação realizada; link do painel circulado ao time.', 'Deck + painel (link Vercel)', 3),
  ('CMT-04', '1. Comitê e Governança', 'Governança', 'Definição do rito do Comitê: pauta padrão, registro de decisões e encaminhamentos', 'Comitê', ARRAY['comite']::text[], '2026-08-07', '07/08', 'nao_iniciado', '{}', NULL, NULL, 'Definir no rito de 07/08: pauta padrão, quem registra decisões, prazo de resposta do Comitê (ex.: 2 d.u.) e canal único de entrada de demandas.', 'Documento de rito de 1 página versionado no repo (docs/).', 'docs/rito_comite.md no repo', 4),
  ('INS-01', '2. Instrumentos', 'Criação', 'Definição do Lote 1 de instrumentos para aprovação (UASJUR, UGE e UGS/Soluções)', 'Jr. e gestores', ARRAY['jr','gestores']::text[], '2026-08-05', '05/08', 'concluida', '{}', NULL, NULL, 'Concluída. Lote 1 definido com as unidades-alvo (UASJUR, UGE, UGS/Soluções, URC).', 'Lista do Lote 1 refletida nas ações INS-02/06/07.', 'Painel · plano', 5),
  ('INS-02', '2. Instrumentos', 'Discussão Técnica', 'Agendas de debate e validação técnica dos instrumentos do Lote 1', 'Sandra', ARRAY['sandra']::text[], NULL, '—', 'em_andamento', ARRAY['INS-01']::text[], 'no', 3, 'Sandra agenda os debates restantes (Op. Fomento e Op. Investimento) até 11/08; convocar Agnaldo e, se preciso, Giovanni para a fronteira FAMPE/Finep.', 'Debates realizados até 11/08 = Nó 3 no verde; registrar resultado por instrumento no painel.', 'Agenda + painel (caminho crítico)', 6),
  ('INS-03', '2. Instrumentos', 'Criação', 'Definição do Lote 2 (último) de instrumentos para aprovação', 'Comitê', ARRAY['comite']::text[], NULL, '—', 'concluida', '{}', NULL, NULL, 'Concluída. Lote 2 fechado (inclui itens dependentes da UDT e definições ALI IG).', 'Escopo do Lote 2 listado no painel.', 'Painel · plano', 7),
  ('INS-04', '2. Instrumentos', 'Discussão Técnica', 'Agendas de debate e validação técnica dos instrumentos do Lote 2', 'Sandra', ARRAY['sandra']::text[], NULL, '—', 'nao_iniciado', ARRAY['INS-03']::text[], 'no', 6, 'Anny confirma a oficina UDT (convite saiu até 07/08). Antecipar com o time o que não depende da UDT (ex.: ALI IG) nas mesmas agendas.', 'Data da oficina cravada até 14/08; sem data → gatilho do Nó 6 (gerência aciona).', 'Convite Anny + gatilho Nó 6', 8),
  ('INS-06', '2. Instrumentos', 'Aprovação', 'Validação final do Lote 1 pelo Comitê antes da submissão', 'Comitê', ARRAY['comite']::text[], '2026-08-12', '12/08', 'nao_iniciado', ARRAY['INS-02']::text[], 'no', 3, 'Validação final do Lote 1 no Comitê em 12/08; se Fomento/Investimento não fecharem, aplicar fallback: Lote 1A (3 prontos) sobe dia 14, restante 21/08.', 'Decisão registrada em ata; status muda para Concluído no painel em 12/08.', 'Rito do Comitê + painel', 9),
  ('INS-07', '2. Instrumentos', 'Aprovação', 'Submissão do Lote 1 às unidades responsáveis', 'JR./Gerência', ARRAY['jr','gerencia']::text[], '2026-08-14', '14/08', 'nao_iniciado', ARRAY['INS-06']::text[], 'no', 4, 'Submeter ofícios/fichas às unidades em 14/08 (compromisso público do deck — não desliza). Distribuir a carga do dia com Sandra e Pova.', 'Protocolos de submissão anexados; Nó 4 verde no painel em 14/08.', 'Ofício/e-mail institucional + painel', 10),
  ('INS-08', '2. Instrumentos', 'Aprovação', 'Validação dos instrumentos do Lote 2 pelo Comitê', 'Comitê', ARRAY['comite']::text[], '2026-09-18', '18/09', 'nao_iniciado', ARRAY['INS-04']::text[], 'cadeia', 6, 'Validar Lote 2 no Comitê em 18/09, com insumos da oficina UDT (Nó 6).', 'Ata de validação; cadeia 6 em dia no painel.', 'Rito do Comitê', 11),
  ('INS-09', '2. Instrumentos', 'Aprovação', 'Submissão do Lote 2 às unidades responsáveis', 'JR./Gerência', ARRAY['jr','gerencia']::text[], '2026-09-25', '25/09', 'nao_iniciado', ARRAY['INS-08']::text[], 'cadeia', 6, 'Submeter Lote 2 em 25/09 às unidades responsáveis, mesmo rito do Lote 1.', 'Protocolos anexados; cadeia 6 concluída.', 'Ofício/e-mail institucional', 12),
  ('INS-10', '2. Instrumentos', 'Aprovação', 'Recebimento e incorporação das devolutivas das unidades (UASJUR/UGE/UGS) nas fichas dos instrumentos', 'Jr. e gestores', ARRAY['jr','gestores']::text[], NULL, 'set–out', 'nao_iniciado', ARRAY['INS-07','INS-09']::text[], NULL, NULL, 'Consolidar devolutivas por instrumento numa tabela única (aceito · aceito com ajustes · não aceito) e incorporar às fichas.', 'Tabela de devolutivas preenchida; % de fichas ajustadas visível no boletim.', 'Planilha de devolutivas + boletim CG-01', 13),
  ('INS-11', '2. Instrumentos', 'Comunicação', 'Comunicação às UFs sobre a aprovação do Lote 1', 'Sandra/Gerência', ARRAY['sandra','gerencia']::text[], NULL, 'após devolutiva', 'nao_iniciado', ARRAY['INS-10']::text[], NULL, NULL, 'Comunicado às UFs sobre o Lote 1 aprovado: o que muda, a partir de quando, onde registrar.', 'Comunicado enviado; data registrada no painel.', 'Marketing Cloud / canal institucional', 14),
  ('INS-12', '2. Instrumentos', 'Comunicação', 'Comunicação às UFs sobre a aprovação do Lote 2', 'Sandra/Gerência', ARRAY['sandra','gerencia']::text[], NULL, 'após devolutiva', 'nao_iniciado', ARRAY['INS-10']::text[], NULL, NULL, 'Mesmo modelo do INS-11 para o Lote 2.', 'Comunicado enviado; data registrada no painel.', 'Marketing Cloud / canal institucional', 15),
  ('CAN-01', '3. Adoção aos Canais de Relacionamento', 'Metodologia', 'Elaboração e envio da proposta de encontros para a URC', 'JR.', ARRAY['jr']::text[], '2026-07-30', '30/07', 'concluida', '{}', NULL, NULL, 'Concluída. Proposta enviada à URC (Enio e Milva) com estrutura de 2 sessões × 3h por canal.', 'E-mail enviado em 30/07.', 'E-mail institucional', 16),
  ('CAN-02', '3. Adoção aos Canais de Relacionamento', 'Aprovação', 'Validação da grade de encontros pela URC', 'URC', ARRAY['urc']::text[], '2026-08-04', '04/08', 'em_andamento', ARRAY['CAN-01']::text[], 'no', 1, 'Aguardar devolutiva da URC; silêncio até 12h de 05/08 já venceu → manter ligação gerência-a-gerência ativa. Qualquer contraproposta serve se o Ciclo 1 começar até ~18/08.', 'Nó 1: grade devolvida = verde. Cada dia sem resposta consome a folga de 26/08–04/09.', 'Gerência + gatilho Nó 1', 17),
  ('CAN-03', '3. Adoção aos Canais de Relacionamento', 'Comunicação', 'Apresentação do plano, dos objetivos das oficinas, do cronograma e das expectativas na reunião de equipe da Inovação', 'Gerência', ARRAY['gerencia']::text[], '2026-08-10', '10/08', 'nao_iniciado', ARRAY['CAN-02']::text[], NULL, NULL, 'Gerência apresenta plano, objetivos das oficinas e cronograma na reunião de equipe de 10/08 (mesma agenda do CMT-03).', 'Apresentação realizada; presença dos coordenadores registrada.', 'Reunião de equipe + painel', 18),
  ('CAN-04', '3. Adoção aos Canais de Relacionamento', 'Comunicação', 'Divulgação do calendário aprovado, convites de agenda e material prévio por canal', 'Sandra', ARRAY['sandra']::text[], '2026-08-11', '11/08', 'nao_iniciado', ARRAY['CAN-02']::text[], 'no', 5, 'Com a grade validada, Sandra dispara calendário + convites de agenda + materiais em até 24h (meta 11/08, limite 13/08).', 'Convites aceitos por canal ≥ mínimo definido; página agenda do painel preenchida.', 'Outlook + painel (agenda)', 19),
  ('CAN-05', '3. Adoção aos Canais de Relacionamento', 'Governança', 'Indicação dos representantes dos projetos nas oficinas', 'Comitê', ARRAY['comite']::text[], '2026-08-07', '07/08', 'nao_iniciado', ARRAY['CAN-02']::text[], 'no', 2, 'Cada núcleo indica representante até 07/08; sem indicação, vale o fallback aprovado: o gestor da iniciativa é o representante.', '5/5 núcleos com nome na página participantes (pendências ficam vermelhas).', 'Rito do Comitê + painel (participantes)', 20),
  ('CAN-06', '3. Adoção aos Canais de Relacionamento', 'Logística e Infraestrutura', 'Reserva dos locais para as oficinas presenciais', 'Sandra', ARRAY['sandra']::text[], '2026-08-07', '07/08', 'em_andamento', ARRAY['CAN-02']::text[], 'no', 2, 'Sandra reserva salas para todos os encontros; sala indisponível → canal migra para online (DXP, 2h, é candidato natural — pré-acordar com a URC).', 'Encontros com local definido na agenda do painel; pendências visíveis.', 'Reserva de salas + painel (agenda)', 21),
  ('CAN-07', '3. Adoção aos Canais de Relacionamento', 'Logística e Infraestrutura', 'Criação do repositório de conteúdos para a IA apoiar o preenchimento do formulário de demandas', 'Sandra', ARRAY['sandra']::text[], '2026-08-11', '11/08', 'nao_iniciado', '{}', NULL, NULL, 'Montar repositório por canal (materiais da URC + fichas das iniciativas + Diretrizes v1.2) para alimentar o agente de IA.', 'Repositório com estrutura mínima por canal até 11/08.', 'SharePoint/Drive + link no painel', 22),
  ('CAN-08', '3. Adoção aos Canais de Relacionamento', 'Logística e Infraestrutura', 'Criação do agente de IA de apoio ao preenchimento do formulário de demandas da URC', 'JR. e Pova', ARRAY['jr','pova']::text[], '2026-08-12', '12/08', 'em_andamento', ARRAY['CAN-07']::text[], NULL, NULL, 'JR. e Pova desenvolvem o agente de apoio ao preenchimento do formulário URC usando o repositório do CAN-07.', 'Agente responde às perguntas do formulário com dados de 1 iniciativa de teste.', 'Agente IA (Pova)', 23),
  ('CAN-09', '3. Adoção aos Canais de Relacionamento', 'Logística e Infraestrutura', 'Piloto interno do agente de IA com 1–2 iniciativas', 'JR. e Pova', ARRAY['jr','pova']::text[], '2026-08-14', '14/08', 'nao_iniciado', ARRAY['CAN-08']::text[], NULL, NULL, 'Piloto com 1–2 iniciativas em 14/08. O agente está FORA do caminho crítico: o plano B (formulário estático) cobre o Ciclo 1.', 'Piloto rodado e ajustes listados; decisão go/no-go para uso no Ciclo 1.', 'Agente IA + formulário plano B', 24),
  ('CAN-10', '3. Adoção aos Canais de Relacionamento', 'Governança', 'Entrega dos formulários de demanda em até 5 dias úteis após cada oficina, com controle de entrega por iniciativa', 'Gestores e IA', ARRAY['gestores','pova']::text[], NULL, 'contínuo · C1 até 01/09 · C2 até 30/09', 'nao_iniciado', ARRAY['CAN-04']::text[], 'no', 5, 'Cada projeto entrega o formulário (ou justificativa de não adoção) em até 5 d.u. após cada oficina. C1 até 01/09, C2 até 30/09.', 'Matriz de demandas do painel: célula muda de ''oficina'' para ''formulário'' dentro do prazo; checkpoint 19/08 (5 de 8 canais rodados).', 'Formulário URC + matriz do painel', 25),
  ('CAN-11', '3. Adoção aos Canais de Relacionamento', 'Monitoramento', 'Monitoramento de confirmação de presença, alimentação do repositório e cumprimento dos prazos dos formulários', 'Sandra', ARRAY['sandra']::text[], NULL, 'contínuo (ago–set)', 'nao_iniciado', '{}', NULL, NULL, 'Sandra monitora confirmações de presença, alimenta o repositório e cobra pendências semanalmente (rotina fixa, ex.: sexta 10h).', 'Página agenda com % de confirmação por encontro; pendências nominais no boletim.', 'Painel (agenda) + boletim CG-01', 26),
  ('CAN-12', '3. Adoção aos Canais de Relacionamento', 'Governança', 'Definição dos critérios de priorização das demandas', 'Comitê', ARRAY['comite']::text[], '2026-08-21', '21/08', 'nao_iniciado', '{}', 'cadeia', 7, 'Comitê define critérios de priorização até 21/08; fallback barato: primeira pauta do Comitê após o início do ciclo.', 'Documento de critérios (1 página) aprovado em ata; sem ele, Nó 7 fica âmbar.', 'Rito do Comitê + docs/ no repo', 27),
  ('CAN-13', '3. Adoção aos Canais de Relacionamento', 'Governança', 'Priorização e encaminhamento das demandas do Ciclo 1 à URC', 'Comitê', ARRAY['comite']::text[], '2026-09-11', '11/09', 'nao_iniciado', ARRAY['CAN-10','CAN-12']::text[], 'no', 7, 'Aplicar os critérios às demandas do Ciclo 1 e encaminhar lote priorizado à URC em 11/09 (Nó 7).', 'Lote enviado com nº de demandas por canal; células da matriz mudam para ''priorizado''.', 'Comitê + matriz do painel', 28),
  ('CAN-14', '3. Adoção aos Canais de Relacionamento', 'Governança', 'Priorização e encaminhamento das demandas do Ciclo 2 à URC', 'Comitê', ARRAY['comite']::text[], '2026-10-09', '09/10', 'nao_iniciado', ARRAY['CAN-10','CAN-12']::text[], NULL, NULL, 'Mesmo rito para o Ciclo 2, encaminhando até 09/10.', 'Lote 2 enviado; matriz atualizada.', 'Comitê + matriz do painel', 29),
  ('CAN-15', '3. Adoção aos Canais de Relacionamento', 'Metodologia', 'Consolidação das devolutivas por canal e do diagnóstico de adoção (potencial visto × não visto; lacuna de entendimento × oportunidade de melhoria do canal)', 'JR. e Comitê', ARRAY['jr','comite']::text[], '2026-10-16', '16/10', 'nao_iniciado', ARRAY['CAN-13','CAN-14']::text[], NULL, NULL, 'Consolidar devolutivas por canal + diagnóstico de aderência (adotado · em adoção · não adotado com justificativa) — insumo direto do RD/Adequação.', 'Relatório de aderência por canal publicado em 16/10.', 'Painel (matriz) + relatório', 30),
  ('CAN-16', '3. Adoção aos Canais de Relacionamento', 'Comunicação', 'Comunicação para os Estados quanto às demandas', 'Gerência', ARRAY['gerencia']::text[], NULL, 'out', 'nao_iniciado', ARRAY['CAN-13','CAN-14']::text[], NULL, NULL, 'Gerência comunica aos Estados as demandas priorizadas e o que muda para as UFs.', 'Comunicado enviado em out; registrado no painel.', 'Canal institucional NA→UF', 31),
  ('CAN-17', '3. Adoção aos Canais de Relacionamento', 'Implantação', 'Cronograma de entrega das demandas da Inovação', 'URC', ARRAY['urc']::text[], NULL, 'out', 'nao_iniciado', ARRAY['CAN-13','CAN-14']::text[], 'sla', NULL, 'Negociar o SLA na própria devolutiva do Nó 1: URC devolve cronograma em até 10 d.u. após cada lote priorizado.', 'Cronograma da URC anexado; sem SLA, a linha fica âmbar permanente no painel.', 'Acordo URC (SLA) + painel', 32),
  ('CAN-18', '3. Adoção aos Canais de Relacionamento', 'Implantação', 'Monitoramento das entregas da URC e das pendências da UI', 'Sandra', ARRAY['sandra']::text[], NULL, 'contínuo (out–nov)', 'nao_iniciado', ARRAY['CAN-17']::text[], NULL, NULL, 'Sandra acompanha entregas da URC × pendências da UI em rotina quinzenal, alimentando a matriz (célula ''encaminhado'').', 'Matriz com datas de entrega; desvios sobem para o Comitê.', 'Painel (matriz) + rito do Comitê', 33),
  ('PTF-01', '4. Portfólio de Soluções', 'Governança', 'Solicitação de 4 oficinas à unidade de Soluções (uma por núcleo com interação com o público final)', 'JR./Gerência', ARRAY['jr','gerencia']::text[], '2026-08-14', '14/08', 'nao_iniciado', ARRAY['CAN-02']::text[], 'sla', NULL, 'Enviar em 14/08 o pedido das 4 oficinas à Soluções já completo: proposta de formato junto (PTF-02) e datas sugeridas 28/09–09/10 (fora do fim do Ciclo 2).', 'Pedido protocolado em 14/08; resposta da Soluções com datas = SLA ok.', 'Ofício + painel (caminho crítico)', 34),
  ('PTF-02', '4. Portfólio de Soluções', 'Metodologia', 'Elaboração da proposta de formato das oficinas de Soluções (espelho do modelo URC — EAD, nacionalização, CSN)', 'JR.', ARRAY['jr']::text[], '2026-08-14', '14/08', 'nao_iniciado', ARRAY['PTF-01']::text[], NULL, NULL, 'Elaborar a proposta de formato (espelhando a estrutura URC: apresentação + oficina + devolutiva macro) para anexar ao PTF-01.', 'Documento de formato anexado ao pedido de 14/08.', 'Documento (docs/) + ofício', 35),
  ('PTF-03', '4. Portfólio de Soluções', 'Comunicação', 'Apresentação do plano das oficinas de Soluções na reunião de equipe da Inovação', 'JR./Gerência', ARRAY['jr','gerencia']::text[], NULL, 'reunião de equipe de setembro', 'nao_iniciado', ARRAY['PTF-02']::text[], NULL, NULL, 'Apresentar o plano das oficinas de Soluções na reunião de equipe de setembro.', 'Apresentação realizada; registrada no painel.', 'Reunião de equipe', 36),
  ('PTF-04', '4. Portfólio de Soluções', 'Governança', 'Indicação dos representantes dos projetos nas oficinas', 'Comitê', ARRAY['comite']::text[], NULL, 'set', 'nao_iniciado', ARRAY['PTF-01']::text[], NULL, NULL, 'Comitê indica representantes (aproveitar a mesma lógica e nomes do CAN-05 quando fizer sentido).', 'Indicações completas na página participantes.', 'Rito do Comitê + painel', 37),
  ('PTF-05', '4. Portfólio de Soluções', 'Logística e Infraestrutura', 'Reserva dos locais para as oficinas presenciais', 'Sandra', ARRAY['sandra']::text[], NULL, 'set', 'nao_iniciado', ARRAY['PTF-01']::text[], NULL, NULL, 'Sandra reserva locais assim que a Soluções confirmar as datas.', 'Locais definidos na agenda do painel.', 'Reserva de salas + painel', 38),
  ('PTF-06', '4. Portfólio de Soluções', 'Governança', 'Formulários de demanda para criação/ajuste das soluções da Inovação', 'Gestores e IA', ARRAY['gestores','pova']::text[], NULL, '5 dias úteis após cada oficina', 'nao_iniciado', ARRAY['PTF-02']::text[], NULL, NULL, 'Formulários de criação/ajuste de soluções entregues em até 5 d.u. após cada oficina (mesma régua do CAN-10).', 'Controle por núcleo no painel; pendências no boletim.', 'Formulário Soluções + painel', 39),
  ('PTF-07', '4. Portfólio de Soluções', 'Governança', 'Priorização e encaminhamento das demandas de soluções pelo Comitê', 'Comitê', ARRAY['comite']::text[], NULL, 'out', 'nao_iniciado', ARRAY['PTF-06']::text[], NULL, NULL, 'Comitê prioriza e encaminha as demandas de soluções em outubro, com os critérios do CAN-12 adaptados.', 'Lote encaminhado; registrado no painel.', 'Comitê', 40),
  ('PTF-08', '4. Portfólio de Soluções', 'Comunicação', 'Comunicação para os Estados quanto às demandas', 'Gerência', ARRAY['gerencia']::text[], NULL, 'out–nov', 'nao_iniciado', ARRAY['PTF-07']::text[], NULL, NULL, 'Gerência comunica aos Estados as demandas de portfólio.', 'Comunicado enviado out–nov.', 'Canal institucional NA→UF', 41),
  ('PTF-09', '4. Portfólio de Soluções', 'Implantação', 'Cronograma de entrega das demandas da Inovação', 'Soluções', ARRAY['solucoes']::text[], NULL, 'out–nov', 'nao_iniciado', ARRAY['PTF-07']::text[], NULL, NULL, 'Receber da Soluções o cronograma de entrega (SLA espelho do CAN-17).', 'Cronograma anexado; sem ele, âmbar no painel.', 'Acordo Soluções (SLA)', 42),
  ('PTF-10', '4. Portfólio de Soluções', 'Implantação', 'Monitoramento das entregas de Soluções e das pendências da UI', 'Sandra', ARRAY['sandra']::text[], NULL, 'contínuo', 'nao_iniciado', ARRAY['PTF-09']::text[], NULL, NULL, 'Sandra monitora entregas de Soluções × pendências da UI, rotina quinzenal.', 'Status por demanda no painel; desvios ao Comitê.', 'Painel + rito do Comitê', 43),
  ('CG-01', '5. Comunicação e Gestão', 'Monitoramento', 'Boletim mensal com o andamento das ações: instrumentos, adoção dos canais, portfólio e principais entregas', 'Sandra', ARRAY['sandra']::text[], NULL, '1ª edição 31/08 · depois mensal', 'nao_iniciado', '{}', NULL, NULL, 'Boletim mensal de 1 página: nós, entregas do mês, pendências nominais, próximos marcos. 1ª edição 31/08. Fonte: este painel (imprimir/exportar).', 'Boletim enviado todo fim de mês; taxa de abertura se via Marketing Cloud.', 'Painel + Marketing Cloud', 44),
  ('CG-02', '5. Comunicação e Gestão', 'Comunicação', 'Atualização do status do projeto em todas as reuniões de equipe', 'Sandra', ARRAY['sandra']::text[], NULL, 'contínuo', 'nao_iniciado', '{}', NULL, NULL, 'Sandra atualiza o status do projeto em toda reunião de equipe usando o dashboard do painel projetado.', 'Item fixo de pauta cumprido; registrado em ata.', 'Painel (dashboard)', 45),
  ('CG-03', '5. Comunicação e Gestão', 'Monitoramento', 'Página web de monitoramento do plano de ação (projeto Vercel, página informativa)', 'JR. e IA', ARRAY['jr','pova']::text[], '2026-08-14', '14/08', 'nao_iniciado', '{}', NULL, NULL, 'Este projeto: publicar o painel no Vercel via repositório Git (deploy automático a cada commit) até 14/08.', 'URL pública ativa; versão e data de atualização no rodapé de todas as páginas.', 'Vercel + Git', 46),
  ('CG-04', '5. Comunicação e Gestão', 'Governança', 'Retrospectiva e lições aprendidas ao final do Ciclo 2', 'Comitê', ARRAY['comite']::text[], NULL, 'out', 'nao_iniciado', ARRAY['CAN-15']::text[], NULL, NULL, 'Retrospectiva ao final do Ciclo 2: o que protegeu os nós, o que consumiu folga, o que muda para 2027.', 'Documento de lições aprendidas versionado no repo (docs/).', 'docs/retrospectiva.md', 47)
ON CONFLICT (id) DO NOTHING;  -- rodar de novo não duplica se já tiver rodado antes


-- ---------------------------------------------------------------------------
-- Verificação — deve devolver 47.
-- ---------------------------------------------------------------------------
SELECT count(*) AS total_acoes FROM public.meta_inovacao_plano_acoes WHERE deleted_at IS NULL;
