-- ============================================================================
-- Golden record de cadastros de referência — Camada 0, item 0.2 (catálogo-base)
-- ============================================================================
-- Cria meta_inovacao_canais: catálogo unificado dos 10 canais de relacionamento com
-- o Sebrae. Hoje esse conceito vive em DUAS listas mantidas em sincronia na mão
-- (PROPOSTA_ESQUEMA_CADASTROS_REFERENCIA.md, seção "meta_inovacao_canais"):
--   - data/canais.js — 10 canais completos (nome, formato, pauta), usado por
--     apresentacao_canais.html/qrcodes.html/canva.html.
--   - CANAIS_FIXOS em js/db-urc.js (a antiga constante CANAIS_URC) — só 8 nomes,
--     usado por urc_canais_responsaveis/urc_lideranca; ainda não inclui "Sebrae na
--     sua empresa" nem "Contabilizações e instrumentos" por não terem responsável de
--     URC definido ainda.
-- Esta migração NÃO mexe em nenhuma tabela existente nem apaga as duas listas atuais
-- (isso é Camada 4) — só cria o catálogo novo com os 10 canais, pra Camada 2/3
-- poderem passar a apontar canal_id FK pra cá em vez de texto solto.
--
-- slug: mantém o MESMO id de data/canais.js ("foco", "cnr", ...) — é o texto que
-- hoje aparece espalhado em meta_inovacao_agenda_encontros.canal,
-- meta_inovacao_canva_demandas.canal e nas 10 colunas físicas de
-- meta_inovacao_matriz_demandas. Preservar o slug é o que permite Camada 2/3
-- casarem o texto antigo com o canal_id novo por igualdade simples, sem heurística
-- de nome (mesmo raciocínio de canal ser "whitelist DURA" em cc_canva_gravar).
--
-- Segue tools/sql/PADRAO_TABELA.md: RLS ligada, GRANT antes das policies,
-- cc_select_publico pra leitura, cc_token_insert/cc_token_update pra escrita
-- (mesmo token compartilhado x-cc-token do resto do site), soft delete.
--
-- IDEMPOTENTE: pode rodar de novo — CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE
-- FUNCTION, DROP POLICY/TRIGGER antes de recriar, seed com WHERE NOT EXISTS.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Tabela
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.meta_inovacao_canais (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug          text NOT NULL,                 -- id estável de data/canais.js (ex.: "foco")
  nome          text NOT NULL,
  nome_completo text,
  formato       text,
  pauta         jsonb NOT NULL DEFAULT '[]'::jsonb,  -- lista de linhas de pauta (texto)
  ordem         int NOT NULL DEFAULT 0,
  ativo         boolean NOT NULL DEFAULT true,
  deleted_at    timestamptz,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    text
);

CREATE UNIQUE INDEX IF NOT EXISTS meta_inovacao_canais_slug_ativo_idx
  ON public.meta_inovacao_canais (slug) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS meta_inovacao_canais_nome_ativo_idx
  ON public.meta_inovacao_canais (nome) WHERE deleted_at IS NULL;


-- ---------------------------------------------------------------------------
-- 2) Trigger de updated_at
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cc_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cc_touch_updated_at_canais ON public.meta_inovacao_canais;
CREATE TRIGGER cc_touch_updated_at_canais
  BEFORE UPDATE ON public.meta_inovacao_canais
  FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();


-- ---------------------------------------------------------------------------
-- 3) RLS — SELECT público, escrita só com x-cc-token certo (PADRAO_TABELA.md)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'meta_inovacao_canais'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.meta_inovacao_canais', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.meta_inovacao_canais ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.meta_inovacao_canais TO anon, authenticated;

CREATE POLICY "cc_select_publico" ON public.meta_inovacao_canais
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "cc_token_insert" ON public.meta_inovacao_canais
  FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90');

CREATE POLICY "cc_token_update" ON public.meta_inovacao_canais
  FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'a7c11b08-5a62-453c-ba8d-6bd0680e2f90');

-- Pra REVERTER (só faz sentido logo depois de criar, antes de qualquer edição real):
--   DROP TABLE IF EXISTS public.meta_inovacao_canais;
--   DROP TRIGGER IF EXISTS cc_touch_updated_at_canais ON public.meta_inovacao_canais;


-- ---------------------------------------------------------------------------
-- 4) Seed — os 10 canais de data/canais.js, na mesma ordem em que aparecem lá.
--    ativo=true pros 10 (o catálogo não carrega a distinção "tem responsável de
--    URC definido" — isso continua sendo o papel de
--    meta_inovacao_urc_canais_responsaveis, que na Camada 2 ganha canal_id FK
--    apontando pra cá, nullable pros 2 canais ainda sem responsável).
-- ---------------------------------------------------------------------------
INSERT INTO public.meta_inovacao_canais (slug, nome, nome_completo, formato, pauta, ordem)
SELECT * FROM (VALUES
  ('foco', 'Foco+', 'CRM · Foco+', '2 sessões · 3h · presencial',
    '["Foco como centralizador dos dados e repositório dos sistemas externos","Além do atendimento: grupos de clientes, credenciamento, histórico, cruzamentos","Volume de informações e principais módulos"]'::jsonb, 1),
  ('cnr', 'CNR', 'CNR: operação ativa e receptiva', '2 sessões · 3h · presencial',
    '["Projeto, UFs presentes e time","NPS e volume de ligações/dia; da dúvida tributária ao apoio na guia DAS","Valor mesmo para projetos sazonais, pequenos ou MVP (case UI × CNR na MEE)"]'::jsonb, 2),
  ('empresa', 'Sebrae na sua empresa', 'Sebrae na sua empresa', '2 sessões · 3h · presencial',
    '["Pauta a definir com o canal — canal novo na grade v2"]'::jsonb, 3),
  ('portal', 'Portal', 'Portal Sebrae', '2 sessões · 3h · presencial',
    '["O que mudou do Portal 2025 para 2026","Integração Portal × MKT × Foco para leads (NA ou UFs)","Banner com QR code das páginas dos projetos em eventos","Área logada × não logada; Portal como centralizador","O que o Portal executa mas é gerido por Soluções"]'::jsonb, 4),
  ('mkt', 'Marketing Cloud', 'CRM · Marketing Cloud', '2 sessões · 3h · presencial',
    '["LPs, e-mail, SMS, WhatsApp; Bureau de CRM e jornadas","Disparo × campanha; transbordo entre canais e rastreabilidade","Campanhas do NA com alcance nacional","O que trava pedidos: sem estratégia, sem transbordo, sem base qualificada"]'::jsonb, 5),
  ('loja', 'Loja', 'Loja Sebrae', '2 sessões · 3h · presencial',
    '["Maturidade, adoção pelas UFs, receita gerada","Loja vs. Sympla e similares: comparativo com diferenciais (AMEI, Foco, Portal, captura em tempo real sem atrito)"]'::jsonb, 6),
  ('rede', 'Rede própria e parceira', 'Rede própria e rede parceira', '2 sessões · 3h · presencial',
    '["Mais de 14.000 pessoas onde não há escritório do Sebrae","Como a rede potencializa programas das UFs e do NA"]'::jsonb, 7),
  ('assessoria', 'Assessoria de Negócios', 'Assessoria de negócios', '2 sessões · 3h · presencial',
    '["Projeto, UFs presentes e time","Assessoria como promotora das estratégias da UI","Casos de relacionamento convertido em consumo de solução; conexão com o Foco"]'::jsonb, 8),
  ('dxp', 'DXP', 'Estratégia DXP', 'formato reduzido · 2h · candidato a online',
    '["O que é a estratégia DXP","Como pode transformar o relacionamento da Inovação com clientes e parceiros"]'::jsonb, 9),
  ('contab', 'Contabilizações e instrumentos', 'Contabilizações e instrumentos', '2 sessões · 3h · presencial',
    '["Pauta a definir com o canal — canal novo na grade v2, ainda sem data (Ciclo 1)"]'::jsonb, 10)
) AS seed(slug, nome, nome_completo, formato, pauta, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM public.meta_inovacao_canais c
  WHERE c.slug = seed.slug AND c.deleted_at IS NULL
);


-- ---------------------------------------------------------------------------
-- Verificação — deve devolver 10.
-- ---------------------------------------------------------------------------
SELECT count(*) AS total_canais FROM public.meta_inovacao_canais WHERE deleted_at IS NULL;
SELECT slug, nome, ordem FROM public.meta_inovacao_canais WHERE deleted_at IS NULL ORDER BY ordem;
