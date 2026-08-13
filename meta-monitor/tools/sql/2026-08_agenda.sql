-- ============================================================================
-- Migração do conjunto AGENDA pro Supabase — item 3.1 do plano de melhorias (Prompt 10)
-- ============================================================================
-- Cria meta_inovacao_agenda_encontros (datas/locais/confirmações dos 20 encontros da
-- agenda dos ciclos — hoje só em data/agenda.js). data/agenda.js continua existindo
-- como SEED + fallback de leitura (js/db-agenda.js cai pra lá se o Supabase estiver
-- fora do ar) — mesmo padrão do 2026-08_plano.sql, rodar depois dele (reaproveita a
-- função de trigger cc_touch_updated_at criada lá; recria sozinha se rodar isolado).
--
-- DESVIOS do desenho original do prompt, registrados aqui pra rastreabilidade:
--   - "id" nesta tabela é um bigint identity (chave interna da linha), mas o id
--     VISÍVEL de sempre ("c1-foco" etc., usado em âncoras de link — agenda.html,
--     js/busca.js, js/drawer.js) é recalculado no client como "c"+ciclo+"-"+canal a
--     partir de (ciclo, canal) — não precisou virar coluna própria, e o link direto
--     de qualquer página continua funcionando sem mudar nada nelas.
--   - "hora" (campo que já existia em data/agenda.js, sempre vazio em todos os 20
--     encontros até hoje) foi fundido em "turno" (texto livre) em vez de virar coluna
--     própria — zero perda de dado hoje; se um dia precisar de hora, "turno" aceita
--     texto tipo "tarde · 14h".
--   - "local" e "modo" (campos separados em data/agenda.js) viraram um único
--     "local_modo" texto livre, seguindo o nome de coluna pedido no desenho original.
--   - "confirmados"/"convidados" (dois inteiros em data/agenda.js) viraram um único
--     "confirmacoes" texto livre ("3/5", "a confirmar"...), seguindo o desenho
--     original — mais alinhado com o jeito manual/aproximado que Sandra preenche isso.
--   - status default 'a_agendar' do desenho original virou 'encontro_a_agendar' — é
--     a chave canônica de verdade em js/status.js (contexto "encontro"; o prefixo
--     "encontro_" existe desde P6 pra não colidir com outras chaves no mesmo
--     dicionário) — usar a chave real, não uma aproximação dela, é o que "não criar
--     vocabulário novo" (Tarefa 0.2) pede.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Função de trigger — mesma de 2026-08_plano.sql; CREATE OR REPLACE de novo
--    aqui pra este script funcionar sozinho mesmo se rodado fora de ordem.
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
CREATE TABLE IF NOT EXISTS public.meta_inovacao_agenda_encontros (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ciclo          int NOT NULL,                  -- 1 ou 2
  canal          text NOT NULL,                 -- id do canal (data/canais.js, ex.: "foco")
  sessao         int NOT NULL DEFAULT 1,        -- hoje sempre 1 (1 encontro por canal × ciclo); campo
                                                 -- pronto pra um canal ganhar 2ª sessão no mesmo ciclo um dia
  pauta_resumo   text,                          -- resumo da pauta do canal (denormalizado de data/canais.js na hora do seed)
  data_iso       date,
  turno          text,                          -- "manhã"/"tarde"/texto livre (ver nota de "hora" acima)
  local_modo     text,
  confirmacoes   text,                          -- "3/5" ou vazio — texto livre, não dois inteiros
  status         text NOT NULL DEFAULT 'encontro_a_agendar',  -- chave canônica (P6, contexto "encontro")
  observacao     text,                          -- era "nota" em data/agenda.js
  deleted_at     timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     text,
  UNIQUE (ciclo, canal, sessao)
);

DROP TRIGGER IF EXISTS cc_touch_updated_at_agenda ON public.meta_inovacao_agenda_encontros;
CREATE TRIGGER cc_touch_updated_at_agenda
  BEFORE UPDATE ON public.meta_inovacao_agenda_encontros
  FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 3) RLS — mesmo padrão do 2026-08_plano.sql: SELECT público, escrita só com
--    x-cc-token certo, sem policy de DELETE (soft delete via UPDATE em deleted_at).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'meta_inovacao_agenda_encontros'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_agenda_encontros', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.meta_inovacao_agenda_encontros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_publico" ON public.meta_inovacao_agenda_encontros
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "cc_token_insert" ON public.meta_inovacao_agenda_encontros
  FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

CREATE POLICY "cc_token_update" ON public.meta_inovacao_agenda_encontros
  FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = '90bb649c-0a59-43b1-b486-17ec58f99108');

-- Pra REVERTER (só faz sentido logo depois de criar, antes de qualquer edição real):
--   DROP TABLE IF EXISTS public.meta_inovacao_agenda_encontros;
--   DROP TRIGGER IF EXISTS cc_touch_updated_at_agenda ON public.meta_inovacao_agenda_encontros;


-- ---------------------------------------------------------------------------
-- 4) Seed — gerado por tools/gerar_seed_supabase.js a partir de data/agenda.js
--    + data/canais.js (pauta_resumo). Sem "ON CONFLICT (id)" — id é gerado pelo
--    banco; a constraint UNIQUE (ciclo, canal, sessao) evita duplicar linha se
--    este script rodar 2 vezes (rode com WHERE NOT EXISTS se precisar reforçar).
-- ---------------------------------------------------------------------------
INSERT INTO public.meta_inovacao_agenda_encontros
  (ciclo, canal, sessao, pauta_resumo, data_iso, turno, local_modo, confirmacoes, status, observacao)
SELECT * FROM (VALUES
  (1, 'foco', 1, 'Foco como centralizador dos dados e repositório dos sistemas externos · Além do atendimento: grupos de clientes, credenciamento, histórico, cruzamentos · +1', '2026-08-18'::date, 'tarde', 'presencial', '', 'encontro_agendado', ''),
  (1, 'cnr', 1, 'Projeto, UFs presentes e time · NPS e volume de ligações/dia; da dúvida tributária ao apoio na guia DAS · +1', '2026-08-19'::date, 'tarde', 'presencial', '', 'encontro_agendado', ''),
  (1, 'empresa', 1, 'Pauta a definir com o canal — canal novo na grade v2', '2026-08-20'::date, 'tarde', 'presencial', '', 'encontro_agendado', 'canal novo na grade v2'),
  (1, 'portal', 1, 'O que mudou do Portal 2025 para 2026 · Integração Portal × MKT × Foco para leads (NA ou UFs) · +3', '2026-08-24'::date, 'tarde', 'presencial', '', 'encontro_agendado', ''),
  (1, 'mkt', 1, 'LPs, e-mail, SMS, WhatsApp; Bureau de CRM e jornadas · Disparo × campanha; transbordo entre canais e rastreabilidade · +2', '2026-08-25'::date, 'manhã', 'presencial', '', 'encontro_agendado', ''),
  (1, 'loja', 1, 'Maturidade, adoção pelas UFs, receita gerada · Loja vs. Sympla e similares: comparativo com diferenciais (AMEI, Foco, Portal, captura em tempo real sem atrito)', '2026-08-26'::date, 'tarde', 'presencial', '', 'encontro_agendado', ''),
  (1, 'rede', 1, 'Mais de 14.000 pessoas onde não há escritório do Sebrae · Como a rede potencializa programas das UFs e do NA', '2026-08-27'::date, 'tarde', 'presencial', '', 'encontro_agendado', ''),
  (1, 'assessoria', 1, 'Projeto, UFs presentes e time · Assessoria como promotora das estratégias da UI · +1', '2026-08-31'::date, 'tarde', 'presencial', '', 'encontro_agendado', ''),
  (1, 'dxp', 1, 'O que é a estratégia DXP · Como pode transformar o relacionamento da Inovação com clientes e parceiros', NULL, '', 'a definir', '', 'encontro_a_agendar', ''),
  (1, 'contab', 1, 'Pauta a definir com o canal — canal novo na grade v2, ainda sem data (Ciclo 1)', NULL, '', 'a definir', '', 'encontro_a_agendar', 'canal novo na grade v2'),
  (2, 'foco', 1, 'Foco como centralizador dos dados e repositório dos sistemas externos · Além do atendimento: grupos de clientes, credenciamento, histórico, cruzamentos · +1', NULL, '', 'presencial', '', 'encontro_a_agendar', ''),
  (2, 'cnr', 1, 'Projeto, UFs presentes e time · NPS e volume de ligações/dia; da dúvida tributária ao apoio na guia DAS · +1', NULL, '', 'presencial', '', 'encontro_a_agendar', ''),
  (2, 'empresa', 1, 'Pauta a definir com o canal — canal novo na grade v2', NULL, '', 'presencial', '', 'encontro_a_agendar', 'canal novo na grade v2'),
  (2, 'portal', 1, 'O que mudou do Portal 2025 para 2026 · Integração Portal × MKT × Foco para leads (NA ou UFs) · +3', NULL, '', 'presencial', '', 'encontro_a_agendar', ''),
  (2, 'mkt', 1, 'LPs, e-mail, SMS, WhatsApp; Bureau de CRM e jornadas · Disparo × campanha; transbordo entre canais e rastreabilidade · +2', NULL, '', 'presencial', '', 'encontro_a_agendar', ''),
  (2, 'loja', 1, 'Maturidade, adoção pelas UFs, receita gerada · Loja vs. Sympla e similares: comparativo com diferenciais (AMEI, Foco, Portal, captura em tempo real sem atrito)', NULL, '', 'presencial', '', 'encontro_a_agendar', ''),
  (2, 'rede', 1, 'Mais de 14.000 pessoas onde não há escritório do Sebrae · Como a rede potencializa programas das UFs e do NA', NULL, '', 'presencial', '', 'encontro_a_agendar', ''),
  (2, 'assessoria', 1, 'Projeto, UFs presentes e time · Assessoria como promotora das estratégias da UI · +1', NULL, '', 'presencial', '', 'encontro_a_agendar', ''),
  (2, 'dxp', 1, 'O que é a estratégia DXP · Como pode transformar o relacionamento da Inovação com clientes e parceiros', NULL, '', 'a definir', '', 'encontro_a_agendar', ''),
  (2, 'contab', 1, 'Pauta a definir com o canal — canal novo na grade v2, ainda sem data (Ciclo 1)', NULL, '', 'presencial', '', 'encontro_a_agendar', 'canal novo na grade v2')
) AS seed(ciclo, canal, sessao, pauta_resumo, data_iso, turno, local_modo, confirmacoes, status, observacao)
WHERE NOT EXISTS (
  SELECT 1 FROM public.meta_inovacao_agenda_encontros e
  WHERE e.ciclo = seed.ciclo AND e.canal = seed.canal AND e.sessao = seed.sessao
);


-- ---------------------------------------------------------------------------
-- Verificação — deve devolver 20.
-- ---------------------------------------------------------------------------
SELECT count(*) AS total_encontros FROM public.meta_inovacao_agenda_encontros WHERE deleted_at IS NULL;
