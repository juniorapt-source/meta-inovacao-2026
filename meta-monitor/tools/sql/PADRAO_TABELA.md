# Padrão de criação de tabela — Carta de Corso / Supabase

Checklist obrigatório para **toda tabela nova** deste projeto (escrita client-side sem
usuários individuais, protegida por um token compartilhado — `x-cc-token`, ver
`2026-08_protecao_escrita.sql`). Existe porque os scripts do P10
(`2026-08_plano.sql`/`2026-08_agenda.sql`) esqueceram dois passos e isso quebrou a
leitura em produção: `401 permission denied for table`, mesmo com a policy de SELECT
certa criada.

**Por que faltar o GRANT quebra mesmo com a policy certa:** no Postgres, RLS é a
*segunda* barreira, não a primeira. O `GRANT` decide se o role (`anon`/`authenticated`)
tem permissão de base pra operação naquela tabela; as *policies* de RLS só entram em
jogo depois disso, filtrando quais linhas. Sem `GRANT SELECT`, o Postgres nega o acesso
antes de sequer avaliar `cc_select_publico` — não importa que a policy exista e esteja
com `USING (true)`. É um erro fácil de cometer porque a tabela "parece" pronta (RLS
ligado, policy criada) e só quebra em produção contra o client de verdade.

## Checklist

1. **`CREATE TABLE`** com prefixo `meta_inovacao_` — exceto as tabelas legadas de antes
   deste padrão (`plano_acao_atividades`, `corsario_criterios`, `corsario_status`), que
   não são renomeadas retroativamente.
2. **`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`**.
3. **`GRANT SELECT, INSERT, UPDATE ON <tabela> TO anon, authenticated;`** — sempre,
   logo depois do `ENABLE ROW LEVEL SECURITY`, antes de criar qualquer policy. **Sem
   isso, RLS nunca chega a ser avaliado** (ver explicação acima). `GRANT DELETE` só
   entra se a tabela **não** usa soft delete via `deleted_at` — o padrão do projeto é
   soft delete (remoção = `UPDATE deleted_at`), então a maioria das tabelas **não**
   precisa de `GRANT DELETE` nem de policy de `DELETE`.
4. **Uma única policy de SELECT**, sempre chamada `cc_select_publico` (não
   `select_publico`, não duplicar com outro nome). Antes de criar, remover
   dinamicamente qualquer policy pré-existente na tabela via `pg_policies` (bloco `DO $$`
   — não um `DROP POLICY IF EXISTS <nome-adivinhado>`, porque o nome real pode não ser
   conhecido/documentado).
5. **Policies `cc_token_insert` e `cc_token_update`**, exigindo
   `current_setting('request.headers', true)::json->>'x-cc-token' = '<TOKEN>'` — mesmo
   token de `data/config.js.tokenEscrita`, não gerar um novo por tabela.
6. **Trigger de `updated_at`** via `cc_touch_updated_at()` (reaproveitar a função com
   `CREATE OR REPLACE FUNCTION` — idempotente, segura de repetir em todo script) —
   só se a tabela tiver coluna `updated_at`.
7. **Trigger de auditoria** via `cc_audit()` (`tools/sql/2026-08_auditoria.sql`, P13) —
   `AFTER INSERT OR UPDATE OR DELETE ... FOR EACH ROW EXECUTE FUNCTION public.cc_audit()`.
   Entra nas tabelas "editáveis de verdade" (hoje: `meta_inovacao_plano_acoes`,
   `meta_inovacao_agenda_encontros`, `plano_acao_atividades`,
   `meta_inovacao_matriz_demandas`, `corsario_status`) — não é obrigatório em toda tabela
   nova por padrão; avaliar caso a caso se a tabela nova entra nesse grupo.
8. **`NOTIFY pgrst, 'reload schema';` no FINAL do script, sempre que o script faz
   `ALTER TABLE` numa tabela que JÁ EXISTIA** (não é preciso em `CREATE TABLE` de tabela
   nova — o PostgREST detecta relação nova sozinho). Pego em produção com
   `2026-08_corsario_edicao.sql`: o `ALTER TABLE ... ADD COLUMN` rodou sem erro, mas toda
   escrita seguinte falhava com `PGRST204: Could not find the '<coluna>' column ... in
   the schema cache` — a coluna existia de verdade no Postgres, só a API não sabia ainda.
   Sem esse `NOTIFY`, o cache só se atualiza sozinho depois de um tempo (minutos) ou de
   um restart manual do serviço (Project Settings → API → "Reload schema" no painel).

## Exceção: tabelas cuja leitura NÃO é pública

O item 4 acima (`cc_select_publico`, `USING (true)`) é o padrão — mas `SELECT` público
nem sempre é certo. `meta_inovacao_audit_log` (P13) é a primeira exceção: é um log de
quem mudou o quê, sensível o bastante pra exigir o mesmo token de escrita também pra
LER, não só pra gravar. Nesses casos: troque a policy por `cc_token_select`
(`FOR SELECT TO anon USING (current_setting('request.headers', true)::json->>'x-cc-token' = '<TOKEN>')`)
em vez de `cc_select_publico`, e documente a exceção num comentário no topo do script —
sem isso, quem ler o script depois assume o padrão errado.

## Template mínimo (copiar como base para tabela nova)

```sql
-- ============================================================================
-- <descrição da migração> — <referência ao prompt/item do plano de melhorias>
-- ============================================================================

-- 1) Tabela
CREATE TABLE IF NOT EXISTS public.<TABELA> (
  id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  -- ... colunas específicas da tabela ...
  deleted_at timestamptz,                 -- soft delete — nunca DELETE físico
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text
);

-- 2) Trigger de updated_at (reaproveita a função se já existir)
CREATE OR REPLACE FUNCTION public.cc_touch_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cc_touch_updated_at_<sufixo> ON public.<TABELA>;
CREATE TRIGGER cc_touch_updated_at_<sufixo>
  BEFORE UPDATE ON public.<TABELA>
  FOR EACH ROW EXECUTE FUNCTION public.cc_touch_updated_at();

-- 3) RLS — remove qualquer policy existente, liga RLS, GRANT, policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = '<TABELA>'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.<TABELA>', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.<TABELA> ENABLE ROW LEVEL SECURITY;

-- GRANT vem ANTES das policies — sem ele, RLS nunca é avaliado (ver nota acima).
-- DELETE fica de fora: esta tabela usa soft delete (deleted_at).
GRANT SELECT, INSERT, UPDATE ON public.<TABELA> TO anon, authenticated;

CREATE POLICY "cc_select_publico" ON public.<TABELA>
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "cc_token_insert" ON public.<TABELA>
  FOR INSERT TO anon
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'SUBSTITUIR_PELO_TOKEN_UUID');

CREATE POLICY "cc_token_update" ON public.<TABELA>
  FOR UPDATE TO anon
  USING (current_setting('request.headers', true)::json->>'x-cc-token' = 'SUBSTITUIR_PELO_TOKEN_UUID')
  WITH CHECK (current_setting('request.headers', true)::json->>'x-cc-token' = 'SUBSTITUIR_PELO_TOKEN_UUID');

-- TODO (a partir do P13, quando cc_audit existir): trigger de auditoria em <TABELA>.

-- Pra REVERTER (só faz sentido logo depois de criar, antes de qualquer edição real):
--   DROP TABLE IF EXISTS public.<TABELA>;
--   DROP TRIGGER IF EXISTS cc_touch_updated_at_<sufixo> ON public.<TABELA>;

-- 4) Seed (se houver)
-- INSERT INTO public.<TABELA> (...) VALUES (...) ON CONFLICT DO NOTHING;

-- 5) Verificação
SELECT count(*) FROM public.<TABELA> WHERE deleted_at IS NULL;
```

Placeholders a substituir: `<TABELA>` (nome real, com o prefixo `meta_inovacao_`),
`<sufixo>` (nome curto pro trigger, ex.: `plano`, `agenda`, `audit`) e
`SUBSTITUIR_PELO_TOKEN_UUID` (token real de `data/config.js.tokenEscrita` — mesmo token
em todas as tabelas, não gerar um novo).

## Padrão de convivência FK + texto legado (golden record de cadastros de referência)

Quando uma coluna nova de FK substitui um texto livre já em produção numa tabela
existente (ex.: `nucleo_id` ao lado de `nucleo`, `pessoa_id` ao lado de `responsavel`),
o padrão adotado pela frente "golden record de cadastros de referência"
(`docs/PLANO_EXECUCAO_GOLDEN_RECORD.md`) é **"convivendo, nunca substituindo"**:

1. **Escrita:** toda porta de entrada que grava o texto passa a resolver e gravar a FK
   junto, no mesmo `INSERT`/`UPDATE` — nunca só a FK sozinha.
2. **Leitura:** telas passam a preferir a FK quando ela existe e resolve; sem FK
   (linha antiga) ou sem o vínculo carregado (script/módulo ausente na página), cai pro
   texto legado de sempre — a leitura **nunca quebra** por falta do dado novo.
3. **A coluna de texto nunca é `DROP`ada.** Decisão humana registrada no item 5.2 do
   plano: vira cópia/histórico congelado, mantida pra sempre — mesmo depois de nenhuma
   tela mais consultá-la como fonte de verdade. `DROP COLUMN` não é "adiado" nesse
   padrão, é decisão de nunca acontecer, a menos que uma decisão nova troque a de
   26/08/2026.

Ver os itens 4.1–4.4 e 5.5–5.9 de `docs/PLANO_EXECUCAO_GOLDEN_RECORD.md` pros exemplos
reais desse padrão aplicado (chip+select, select-com-sincronia-de-texto,
lista-derivada-do-golden-record, bloco-assíncrono-com-fallback-de-texto).
