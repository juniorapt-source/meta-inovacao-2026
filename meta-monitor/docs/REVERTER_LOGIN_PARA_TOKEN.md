# Reverter o login de editores (Supabase Auth) pro token compartilhado

**Quando usar:** se o login com e-mail/senha (v0.29.0) virar mais dor de cabeça do que
proteção pra este projeto — gente esquecendo senha, projeto pequeno/temporário demais pra
justificar conta individual. Isso volta pro modelo de antes: qualquer um com o link do
site edita, sem logar (mesmo risco de sempre — token exposto no navegador — já aceito
antes, ver `tools/sql/2026-08_protecao_escrita.sql`).

**Estado revertido:** volta pro comportamento de v0.27.x (escrita liberada por
`x-cc-token`, sem login). **Não** apaga dado nenhum — só troca a barreira de escrita.

**Antes de rodar:** gere um token novo (não reaproveite o antigo,
`90bb649c-0a59-43b1-b486-17ec58f99108` — ficou tempo demais exposto no histórico do Git e
em capturas de tela). Qualquer UUID serve:

```bash
uuidgen
```

Guarde esse valor — ele entra em **dois** lugares abaixo (SQL e `data/config.js`).

---

## 1) Banco — troca as policies de escrita de volta pro token

Rode no SQL Editor do Supabase (produção). Substitua `SEU_TOKEN_NOVO_AQUI` pelo UUID
gerado acima **nas duas ocorrências** antes de rodar.

```sql
-- Auto-detecta toda tabela hoje no modelo "authenticated + cc_eh_editor()"
-- (policies escrita_editor_insert/update/delete) e troca por cc_token_*, sem
-- login, mesmo padrão de antes da v0.28.0.
DO $$
DECLARE
  t text;
  alvos text[];
BEGIN
  SELECT array_agg(DISTINCT tablename) INTO alvos
  FROM pg_policies
  WHERE schemaname = 'public' AND policyname LIKE 'escrita_editor_%';

  IF alvos IS NULL THEN
    RAISE NOTICE 'Nenhuma tabela no modelo authenticated encontrada — nada a reverter.';
    RETURN;
  END IF;

  RAISE NOTICE 'Tabelas a reverter: %', alvos;

  FOREACH t IN ARRAY alvos LOOP
    EXECUTE format('DROP POLICY IF EXISTS "escrita_editor_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "escrita_editor_update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "escrita_editor_delete" ON public.%I', t);

    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON public.%I TO anon, authenticated', t);

    EXECUTE format(
      'CREATE POLICY "cc_token_insert" ON public.%I FOR INSERT TO anon ' ||
      'WITH CHECK (current_setting(''request.headers'', true)::json->>''x-cc-token'' = ''SEU_TOKEN_NOVO_AQUI'')', t);
    EXECUTE format(
      'CREATE POLICY "cc_token_update" ON public.%I FOR UPDATE TO anon ' ||
      'USING (current_setting(''request.headers'', true)::json->>''x-cc-token'' = ''SEU_TOKEN_NOVO_AQUI'') ' ||
      'WITH CHECK (current_setting(''request.headers'', true)::json->>''x-cc-token'' = ''SEU_TOKEN_NOVO_AQUI'')', t);
    EXECUTE format(
      'CREATE POLICY "cc_token_delete" ON public.%I FOR DELETE TO anon ' ||
      'USING (current_setting(''request.headers'', true)::json->>''x-cc-token'' = ''SEU_TOKEN_NOVO_AQUI'')', t);
  END LOOP;
END $$;

-- Verificação — todas as 9 tabelas (meta_inovacao_plano_acoes, _agenda_encontros,
-- _pessoas, _urc_lideranca, _urc_canais_responsaveis, corsario_status,
-- meta_inovacao_projetos, meta_inovacao_matriz_demandas, plano_acao_atividades) devem
-- aparecer só com cc_token_insert/update/delete (role anon) + cc_select_publico:
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public' AND cmd IN ('INSERT','UPDATE','DELETE')
ORDER BY tablename, cmd;
```

**Não precisa mexer** em `cc_select_publico` (SELECT) — ela já cobre `anon, authenticated`
e continua assim; leitura pública não muda em nada aqui.

---

## 2) `data/config.js` — token de volta

Adicione o campo `tokenEscrita` (removido na v0.29.0) com o token gerado no passo 0:

```js
window.DB.config = {
 "projeto": "Carta de Corso",
 "subtitulo": "Meta Inovação 2026 · Unidade de Inovação · Sebrae Nacional",
 "versao": "0.30.0",
 "atualizado_em": "<DATA DE HOJE>",
 "hoje_referencia": null,
 "exigirSenha": false,
 "tokenEscrita": "SEU_TOKEN_NOVO_AQUI"
};
```

## 3) `js/supabase.js` — manda o header de novo

Em `headersComToken()`, devolva a linha do token (removida na v0.29.0):

```js
  function headersComToken() {
    const h = {};
    if (root.CC_TOKEN) h["x-cc-token"] = root.CC_TOKEN;   // <- devolver esta linha
    const nomeEditor = root.EDITOR_ATUAL && root.EDITOR_ATUAL.nomeAtual ? root.EDITOR_ATUAL.nomeAtual() : null;
    if (nomeEditor) h["x-cc-editor"] = nomeEditor;
    return h;
  }
```

`js/gate.js` já lê `cfg.tokenEscrita` e seta `window.CC_TOKEN` sozinho — não precisa
mexer nele, ele só estava "adormecido" desde a v0.29.0 (config sem o campo).

A parte de sessão (`OPCOES_AUTH`, `persistSession`/`autoRefreshToken`, `clientePrincipal()`)
pode ficar — é inofensiva sem login ativo, só não faz nada. Se quiser remover mesmo, é
opcional (não tem chamada que dependa dela sobrando depois do passo 4).

## 4) Tirar o login das 5 telas de escrita

Remova as linhas abaixo (mesmo texto, uma tela por vez):

**`editor.html`** (perto de `js/db-plano.js`):
```html
<script src="js/auth.js"></script>
<script>window.CC_AUTH&&CC_AUTH.gatearRegiao&&CC_AUTH.gatearRegiao(document.getElementById("aba-dados"));</script>
```

**`plano-acao.html`** (perto de `data/projetos.js`):
```html
<script src="js/auth.js"></script>
<script>window.CC_AUTH&&CC_AUTH.gatearRegiao&&CC_AUTH.gatearRegiao(document.getElementById("pa-painel"));</script>
```

**`demandas.html`** (perto de `data/canais.js`):
```html
<script src="js/auth.js"></script>
<script>window.CC_AUTH&&CC_AUTH.gatearRegiao&&CC_AUTH.gatearRegiao(document.getElementById("mz-wrap"));</script>
```
Nessa mesma tela, o parágrafo de abertura ("A visualização é aberta a todos; editar exige
entrar como editor cadastrado.") pode voltar a dizer "Sem login: todo mundo que abre o
site vê e edita a mesma matriz." se quiser manter a redação de antes.

**`minhas-acoes.html`** (perto de `js/db-plano.js`):
```html
<script src="js/auth.js"></script>
<script>window.CC_AUTH&&CC_AUTH.gatearRegiao&&CC_AUTH.gatearRegiao(document.getElementById("ma-conteudo"));</script>
```

**`plano.html`** (antes de `js/db-plano.js`, junto do comentário explicando por que não
tem gate ali):
```html
<script src="js/auth.js"></script>
```

## 5) Limpeza opcional (não obrigatória pra funcionar)

- `meta-monitor/js/auth.js` — pode apagar o arquivo (nenhuma tela mais carrega ele
  depois do passo 4).
- `meta_inovacao_editores` — pode esvaziar (`DELETE FROM public.meta_inovacao_editores;`)
  ou só deixar como está (inofensiva, sem policy de escrita apontando pra ela).
- Os 2 usuários criados no Authentication > Users (juniorapt@gmail.com) podem ficar ou
  ser apagados — sem policy de authenticated + `cc_eh_editor()` em nenhuma tabela, logar
  não dá mais nenhum poder extra.

## 6) Fechar

- `data/config.js` → `versao` sobe (ex.: 0.29.0 → 0.30.0), `atualizado_em` na data.
- `CHANGELOG.md` → uma entrada curta: "reverte escrita autenticada pro token
  compartilhado — risco assumido, projeto pequeno/temporário, senha esquecida custava
  mais caro que a exposição do token".
- Testar: `node --check` em `js/*.js` alterados, `python3 tools/validar_site.py`.
- Commit + push em `main` (produção publica sozinha, mesmo fluxo de sempre).
- Testar ao vivo: editar uma linha em `editor.html` **sem estar logado** — deve salvar
  igual a antes da v0.28.0.

---

**Referência cruzada:** o histórico completo de como o login foi construído está em
`docs/SEGURANCA_ESCRITA_AUTH.md` e no `CHANGELOG.md` (entradas v0.28.0/v0.29.0) — útil se
um dia quiser reativar o login em vez de revertê-lo de novo.
