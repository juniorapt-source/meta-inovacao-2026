# Segurança de escrita — migração para Supabase Auth

**Objetivo:** trocar o token compartilhado (hoje público no navegador) por login de verdade,
de modo que só editores autenticados consigam alterar dados. A leitura das telas continua
pública, sem login.

**Status:** planejado. Nada ainda foi aplicado em produção.

---

## 1. Por que mudar

O site é estático e fala direto com o Supabase pelo navegador. A escrita é "protegida" por um
header `x-cc-token` (um UUID) validado pela RLS. Esse token é entregue ao browser em texto puro
em `data/config.js` — logo **não é secreto**: qualquer um que abra o DevTools em qualquer página
tem o token e pode escrever. O valor também está no histórico do Git. **Considere-o comprometido.**

Depois desta migração:
- não há mais segredo de escrita no navegador;
- só um usuário logado **e** presente na allowlist de editores escreve;
- o "quem editou" (`x-cc-editor`) passa a ser confiável (vem da sessão, não digitado);
- acesso é revogável (remover da allowlist ou desativar o usuário).

---

## 2. Decisões deste plano (padrões recomendados — dá pra mudar)

| # | Decisão | Padrão escolhido | Alternativa |
|---|---------|------------------|-------------|
| D1 | Quem pode escrever | **Allowlist** (`meta_inovacao_editores`) — só quem o JR cadastrar | "Qualquer conta autenticada" (mais frouxo) |
| D2 | Método de login | **E-mail + senha** (não precisa configurar envio de e-mail) | Magic link (exige SMTP no projeto) |
| D3 | Onde aparece o login | Só nas telas de escrita (editor, plano-ação, matriz) | Cobrir o site inteiro |
| D4 | Signup do projeto | **Desligar** signup público (editores criados à mão pelo JR) | Deixar aberto (a allowlist ainda protege) |

A allowlist (D1) é o que garante que, mesmo se uma conta qualquer existir, ela não escreve nada
até o JR incluir o `user_id` dela na tabela.

---

## 3. Passo a passo

### Fase 0 — Preparação no painel do Supabase (você faz)
1. **Confirme o impacto no projeto compartilhado.** Este Supabase serve outros sites do Sebrae.
   Em *Authentication > Providers/Settings*, veja se algum outro site depende de signup aberto.
   Se sim, mantenha D4 como "deixar aberto" (a allowlist protege mesmo assim).
2. **Email/Password provider ligado** (default no Supabase). Se for usar magic link (D2), aí sim
   configure SMTP — não recomendado agora.
3. **Crie os usuários editores** em *Authentication > Users > Add user* (e-mail + senha), um por
   pessoa que edita. Anote o **UID** de cada um.

### Fase 1 — Banco (você roda o SQL; eu preparei)
4. Rode **`tools/sql/2026-08_auth_escrita.sql`** no SQL Editor. Ele:
   - cria a allowlist `meta_inovacao_editores` e a função `cc_eh_editor()`;
   - **auto-detecta** todas as tabelas que hoje usam `x-cc-token` e troca as policies de escrita
     por "editor autenticado" (role `authenticated` + allowlist);
   - a leitura pública fica intacta.
5. **Cadastre os editores** na allowlist (o script traz o `insert` pronto no rodapé):
   ```sql
   insert into public.meta_inovacao_editores (user_id, nome)
   values ('<uid-copiado-do-painel>', 'Nome do editor');
   ```
6. **Confira** com as duas queries de verificação do fim do script — a segunda tem de vir vazia
   (nenhuma policy citando o token).

> Neste ponto o banco já exige login para escrever. O site **ainda manda o token e não faz login**,
> então a edição vai falhar com "Sem permissão de escrita" até a Fase 2 subir. Combine uma janela
> curta, ou suba a Fase 2 logo em seguida.

### Fase 2 — Site (eu implemento, depois do seu ok)
Mudanças de código (não commitadas ainda — dependem de você concluir a Fase 0/1):
- **`js/config.js`** — nada de token; mantém só `SUPABASE_URL` e `SUPABASE_ANON_KEY` (públicas por
  natureza; a anon key pode continuar).
- **`js/auth.js` (novo)** — inicia a sessão do Supabase Auth (login/logout, estado atual do usuário),
  usando a sessão persistida (compartilhada entre as páginas do mesmo domínio: loga uma vez, vale em
  todas).
- **`js/supabase.js`** — os clients passam a usar a sessão autenticada; `headersComToken()` deixa de
  mandar `x-cc-token`. O `x-cc-editor` passa a sair do e-mail/nome do usuário logado.
- **`js/gate.js`** — aposentado (ou reduzido): a barreira de escrita agora é o login real, não o
  overlay de senha SHA-256.
- **Telas de escrita** (`editor.html`, `plano-acao.html`, `demandas.html` no Modo edição) — botão
  **"Entrar para editar"** que abre o formulário de login; enquanto não logado, os controles de
  edição ficam desabilitados (a leitura aparece normal). Logou → edição habilitada.
- **`data/config.js`** — remover o campo `tokenEscrita` (fica inofensivo depois que a RLS não o
  checa mais, mas melhor sair).

### Fase 3 — Limpeza
- Confirmar que a edição funciona logada e falha deslogada, nas 3 telas.
- Rodar os testes headless de escrita/guardrail (`tools/testar_*`).
- Commit + push (produção).

---

## 4. Rollback

Se algo travar a edição em produção, dá pra voltar ao estado de hoje sem perder dado:
- **Banco:** rerode `tools/sql/2026-08_protecao_escrita.sql` (e os `*_token` das outras tabelas) —
  recriam as policies por token. Seção "COMO REVERTER" no fim do script novo.
- **Site:** `git revert` do commit da Fase 3.

---

## 5. O que continua fora de escopo

- A **anon key** e a **URL** do Supabase seguem públicas no cliente — isso é o uso normal e correto
  delas (só habilitam leitura pública, que já é o desejado).
- Auditoria por linha e histórico já existem (`x-cc-editor`, `meta_inovacao_audit_log`); com Auth
  eles passam a ser confiáveis, mas não mudam de estrutura aqui.
