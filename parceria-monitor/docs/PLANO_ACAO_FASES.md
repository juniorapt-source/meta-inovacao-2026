# Plano de ação por fases — site da Parceria Sebrae e Instituto Integrador

Documento vivo para executar com o Claude Code, uma fase por sessão. Cada fase tem:
objetivo, o que o Code faz, o que **você** faz (as poucas coisas que só um humano faz:
clicar no Vercel, rodar SQL no Supabase, responder decisões), critério de pronto e um
**prompt pronto para colar**.

- Conteúdo de partida: [`CONTEUDO_INICIAL.md`](CONTEUDO_INICIAL.md) — transcrição fiel do
  `resumo_para_sistema_2.docx`. **O site nasce só com isso; nenhuma tarefa nova é criada.**
- Base técnica: o projeto Carta de Corso (`meta-monitor/`, publicado em
  cartacorso.com.br) — mesmo stack, mesmos padrões, código reaproveitado por cópia.
- Horizonte: projeto curto, com marco final em **08/12/2026**. As fases 1–4 são o MVP
  (site no ar, com dados, todo mundo inserindo e editando) e devem fechar na primeira
  semana. As fases 5–7 são monitoramento; a 8 é qualidade; a 9 é opcional.

---

## Arquitetura em uma página

| Tema | Decisão proposta | Por quê |
|---|---|---|
| Onde mora o código | Pasta `parceria-monitor/` **neste mesmo repositório**, irmã de `meta-monitor/` | O GitHub desta sessão já tem acesso; zero configuração nova. Nada é compartilhado em tempo de execução: o que for reaproveitado do Corso é **copiado** para dentro da pasta. |
| Stack | HTML + CSS + JS puro, sem build, sem framework (igual ao Corso) | Abre do disco, publica no Vercel sem configuração, qualquer sessão do Code entende. |
| Hospedagem | Vercel, projeto novo `parceria-sebrae-integrador`, **Root Directory = `parceria-monitor`** → URL `parceria-sebrae-integrador.vercel.app` | Domínio gratuito do Vercel; cada push publica sozinho. Marcar "Skip deployments when there are no changes to the root directory" para que commits do Corso não republiquem este site (e vice-versa). |
| Banco | Supabase — **mesmo projeto do Corso ("Coisas do Sebrae")**, tabelas com prefixo `parceria_` | O plano gratuito limita projetos ativos; o Corso já faz isso com o prefixo `meta_inovacao_`. Alternativa: projeto Supabase novo (só muda a URL/chave em `js/config.js`). Decisão D2. |
| Login | **Nenhum agora.** Leitura e escrita abertas para quem tem o link (RLS com policy para `anon`) | Pedido explícito. O risco (qualquer um com o link escreve) fica mitigado por: sem exclusão física (só "arquivar"), histórico de toda alteração e campo "quem está editando". Login pode entrar depois (Fase 9) sem refazer nada. |
| Rastreabilidade sem login | Seletor "Quem é você?" (lista de pessoas, guardado no navegador) que preenche `atualizado_por` em cada gravação | Dá o "quem mudou" no histórico sem senha. Não é segurança — é etiqueta. |
| Fallback | Se o Supabase falhar, o site lê `data/*.js` (seed local) e mostra um aviso discreto | Mesmo padrão do Corso; o site funciona antes de o banco existir. |

### Modelo de dados (Fase 2)

| Tabela | Conteúdo | Campos principais |
|---|---|---|
| `parceria_frentes` | As 9 frentes da EAP (A–I) | `id` (letra), `nome`, `entrega`, `nota`, `ordem`, `arquivado` |
| `parceria_tarefas` | As tarefas de cada frente | `id` uuid, `codigo`, `frente_id`, `titulo`, `responsavel` (texto livre), `prazo` (date), `prazo_texto`, `depende_de` (códigos), `status`, `observacao`, `ordem`, `arquivado` |
| `parceria_pessoas` | Pessoas e papéis | `id`, `nome`, `apelidos[]`, `instituicao`, `email`, `papel`, `arquivado` |
| `parceria_rituais` | Daily e pontos de controle | `id`, `tipo`, `publico`, `periodicidade`, `dia_semana`, `horario`, `link`, `arquivado` |
| `parceria_eventos` | Itens de agenda com data (reuniões avulsas, marcos, eventos) | `id`, `titulo`, `tipo` (reunião/marco/evento), `data_inicio`, `data_fim`, `hora`, `local`, `ritual_id`, `arquivado` |
| `parceria_calendario` | Feriados, pontos facultativos e férias (para dias úteis) | `id`, `data_inicio`, `data_fim`, `tipo`, `descricao`, `pessoa_id` |
| `parceria_historico` | Log de auditoria (preenchido por trigger, só leitura no site) | `tabela`, `registro_id`, `acao`, `antes` jsonb, `depois` jsonb, `quem`, `quando` |

Todas com `criado_em`, `atualizado_em` (trigger) e `atualizado_por`.
Status de tarefa: `A iniciar` · `Em andamento` · `Bloqueado` · `Concluído` · `Cancelado`.
"Atrasada" não é status gravado — é calculado (prazo < hoje e status ≠ Concluído/Cancelado).

### Telas

| Página | O quê |
|---|---|
| `index.html` — Painel | Contagem regressiva até 16/11 e 08/12 (dias corridos e úteis), progresso por frente, atrasadas, próximos 7 dias úteis, lacunas (tarefas sem responsável / sem prazo) |
| `eap.html` — EAP | Árvore Projeto → Frentes → Tarefas, com a entrega de cada frente e o status de cada tarefa; botão "+ tarefa" em cada frente |
| `tarefas.html` — Tarefas | Tabela com filtros (frente, status, responsável, atrasadas), busca, edição na linha com salvamento automático, "Nova tarefa" |
| `cronograma.html` — Gantt | Barras por tarefa com prazo, dias úteis, feriados e férias sombreados, marcos |
| `agenda.html` — Agenda | Calendário que junta prazos das tarefas + rituais + eventos + feriados (como pede o documento) |
| `pessoas.html` — Pessoas | Pessoas e papéis; clique numa pessoa → tarefas dela |
| `relato.html` — Relato semanal | Texto pronto para a sexta (tarefa A9): concluídas na semana, atrasadas, próximos marcos; botão copiar |
| `historico.html` — Histórico | Últimas alterações, com quem/quando/antes/depois |

---

## Decisões para o José antes da Fase 1 (5 minutos)

Cada uma já tem um padrão: se você não responder, o Code segue com o padrão.

| # | Decisão | Padrão |
|---|---|---|
| D1 | Nome do projeto no Vercel (vira a URL) | `parceria-sebrae-integrador` → `parceria-sebrae-integrador.vercel.app` |
| D2 | Supabase: mesmo projeto do Corso com prefixo `parceria_`, ou projeto novo | Mesmo projeto, prefixo `parceria_` |
| D3 | Identidade visual: reaproveitar a "Carta Náutica" do Corso ou uma paleta própria da parceria | Mesma base (fontes, grid, componentes), paleta própria em 2–3 cores |
| D4 | Excluir registro: ninguém exclui (só arquiva) | Só arquivar; exclusão física só via SQL |
| D5 | Código das tarefas sem código (B–I): gerar automaticamente (B1, B2...) | Gerar na carga, por ordem; tarefas novas recebem o próximo número da frente |
| D6 | Tarefa com status vazio no documento entra como | `A iniciar` |
| D7 | Calendário de feriados: nacionais + DF (Brasília) | Nacionais + DF |

As pendências de **conteúdo** (P1–P7, em `CONTEUDO_INICIAL.md`) não bloqueiam nada: o
site sobe com o texto como veio e vocês corrigem pela própria tela.

---

## Fase 1 — Fundação e site no ar (com dados locais)

**Objetivo:** URL do Vercel no ar mostrando a EAP com o conteúdo inicial, antes de existir banco.

**O Code faz**
1. Cria `parceria-monitor/` com `index.html`, `eap.html`, `css/base.css`, `js/core.js`
   (navegação, formatação de data, cálculo de atraso), `js/config.js` (vazio de Supabase
   por enquanto) e `README.md`.
2. Copia do Corso o que for útil (adaptando nomes e removendo o que não se aplica):
   `meta-monitor/css/base.css` (base visual), `js/core.js`, `js/status.js`,
   `js/calendario.js`, `js/csv-export.js`. Nada é importado de `../meta-monitor` — tudo
   copiado para dentro da pasta.
3. Gera `data/frentes.js`, `data/tarefas.js`, `data/pessoas.js`, `data/rituais.js`,
   `data/marcos.js`, `data/calendario.js` **a partir de `docs/CONTEUDO_INICIAL.md`** —
   mesmo formato do Corso (`window.DB.chave = [...]`). Nenhuma tarefa inventada.
4. Feriados de out–dez/2026 em `data/calendario.js`: 12/10,
   02/11, 15/11, 20/11, 30/11 (Dia do Evangélico — DF), 25/12.
5. Script `tools/conferir_seed.js`: compara a contagem de frentes/tarefas/pessoas com o
   `CONTEUDO_INICIAL.md` (9 frentes, 45 tarefas, 12 pessoas) e falha se divergir.

**Você faz**
1. Vercel → **Add New → Project → Import** `juniorapt-source/meta-inovacao-2026`.
2. Project Name: `parceria-sebrae-integrador` · Framework: **Other** · **Root Directory:
   `parceria-monitor`** · sem build command · Deploy.
3. Settings → Git → ligar **"Skip deployments when there are no changes to the root
   directory"**.
4. Conferir que o projeto Vercel do Corso tem Root Directory = `meta-monitor` (se estiver na
   raiz do repo, a pasta nova também apareceria em `cartacorso.com.br/parceria-monitor/` —
   não quebra nada, mas vale saber).

**Pronto quando:** `https://parceria-sebrae-integrador.vercel.app/eap.html` mostra as 9
frentes com as tarefas do documento; `node tools/conferir_seed.js` passa.

**Prompt para colar:**
```
Execute a Fase 1 de parceria-monitor/docs/PLANO_ACAO_FASES.md. Leia antes
parceria-monitor/docs/CONTEUDO_INICIAL.md (é o único conteúdo permitido — não crie
tarefas) e meta-monitor/docs/IDENTIDADE_VISUAL.md. Decisões D1–D7: use os padrões do
plano, exceto: [escreva aqui o que mudou, ou "nenhuma"]. Ao final, atualize a seção
"Status por fase" do plano, commite e faça push.
```

---

## Fase 2 — Banco no Supabase

**Objetivo:** tabelas criadas, abertas para leitura/escrita sem login, com histórico automático
e já povoadas com o conteúdo inicial.

**O Code faz**
1. `supabase/01_schema.sql` — as 7 tabelas do modelo acima, `check` de status, índices,
   trigger de `atualizado_em`, chave de `codigo` única por frente.
2. `supabase/02_rls.sql` — RLS ligada em todas; policies para `anon`: `select`, `insert`,
   `update` em todas as tabelas de conteúdo; **sem `delete`** (D4); `parceria_historico`
   só `select`. Inclui os `GRANT`s (a armadilha que já custou caro no Corso: policy sem
   grant = tabela muda).
3. `supabase/03_historico.sql` — trigger genérica que grava antes/depois em
   `parceria_historico` em todo insert/update.
4. `supabase/04_seed.sql` — gerado por `tools/gerar_seed_sql.js` a partir de `data/*.js`
   (fonte única: o seed SQL e o seed local nunca divergem). Idempotente (`on conflict do nothing`).
5. `tools/checar_banco.js --rede` — consulta cada tabela e diz: responde / não existe / sem grant.

**Você faz**
1. Supabase → SQL Editor → rodar os 4 arquivos, na ordem.
2. Rodar `node tools/checar_banco.js --rede` (ou pedir ao Code) e colar o resultado.

**Pronto quando:** checador mostra 7 tabelas respondendo; `select count(*)` bate com o seed
(9 frentes / 45 tarefas / 12 pessoas / 3 rituais); um `update` de teste via anon aparece em `parceria_historico`.

**Prompt para colar:**
```
Execute a Fase 2 de parceria-monitor/docs/PLANO_ACAO_FASES.md. Use como referência os
padrões de meta-monitor/supabase/setup.sql e meta-monitor/tools/sql/2026-08_auditoria.sql.
Projeto Supabase: [o mesmo do Corso | URL e anon key do projeto novo]. Gere os SQL, me
diga a ordem para rodar no SQL Editor e espere eu confirmar antes de atualizar o status.
```

---

## Fase 3 — Leitura online com fallback

**Objetivo:** todas as telas leem do Supabase; se ele falhar, caem para `data/*.js` com aviso.

**O Code faz**
1. `js/supabase.js` (cliente REST mínimo) e `js/db-base.js` (fábrica de wrappers) copiados do
   Corso e adaptados; um wrapper por tabela (`js/db-tarefas.js`, `db-frentes.js`...).
2. `js/config.js` com URL e anon key.
3. `?semrede=1` força o fallback (para teste).
4. EAP e Painel passam a usar os wrappers.

**Pronto quando:** mudar um título direto no Supabase aparece no site ao recarregar;
`?semrede=1` mostra os dados locais e o aviso.

**Prompt para colar:**
```
Execute a Fase 3 de parceria-monitor/docs/PLANO_ACAO_FASES.md, reaproveitando
meta-monitor/js/db-base.js e meta-monitor/js/supabase.js (copiar e adaptar, não importar
da outra pasta). Teste com e sem ?semrede=1, commite e faça push.
```

---

## Fase 4 — Inserção e edição por todos (fecha o MVP)

**Objetivo:** qualquer pessoa com o link cria e edita frentes, tarefas, pessoas, rituais e
eventos, sem login.

**O Code faz**
1. `tarefas.html`: tabela com filtros + edição na linha com salvamento automático ao sair do
   campo (padrão `meta-monitor/js/editor-plano.js`: indicador "salvando… / salvo / erro").
2. Formulário **"Nova tarefa"** (em `tarefas.html` e no "+" de cada frente na EAP):
   frente, título (obrigatórios), responsável (autocompletar pessoas, aceita texto livre),
   prazo (data ou texto), depende de (seleção de tarefas), status, observação. Código
   gerado automaticamente (D5).
3. Formulários de **nova frente**, **nova pessoa**, **novo ritual**, **novo evento/marco**.
4. **Arquivar** no lugar de excluir, com filtro "mostrar arquivados" e "desarquivar".
5. **"Quem é você?"** na primeira gravação (lista de pessoas + "outro"), guardado no
   navegador e enviado como `atualizado_por`.
6. Validações: prazo inválido, dependência circular, título vazio.

**Pronto quando:** em duas abas/navegadores diferentes, uma pessoa cria uma tarefa e a outra
a vê ao recarregar; editar status salva sozinho; nada pode ser excluído pela tela; histórico
registra quem fez.

**Prompt para colar:**
```
Execute a Fase 4 de parceria-monitor/docs/PLANO_ACAO_FASES.md. Padrão de edição na linha
e salvamento automático: meta-monitor/js/editor-plano.js e editor-shared.js. Sem login.
Não crie nenhum registro de conteúdo — só a infraestrutura e os formulários. Ao final
teste criando e arquivando uma tarefa de teste e depois remova-a via SQL (me passe o SQL).
```

---

## Fase 5 — Painel de monitoramento

**Objetivo:** abrir o site e saber em 10 segundos como o projeto está.

**O Code faz**
1. `index.html`: contagem regressiva para 16/11 e 08/12 (dias corridos e **úteis**,
   descontando `parceria_calendario`); % concluído geral e por frente; atrasadas;
   próximos 7 dias úteis; **lacunas** (sem responsável, sem prazo, dependência não
   concluída com prazo próximo).
2. `pessoas.html` com "minhas tarefas" por pessoa (resolve apelidos: Arthur, Jr., PR...).
3. Dependências: tarefa cujo pré-requisito não está concluído ganha selo "aguardando".

**Pronto quando:** os números do painel batem com uma contagem manual da tabela de tarefas.

**Prompt para colar:**
```
Execute a Fase 5 de parceria-monitor/docs/PLANO_ACAO_FASES.md. Inspiração de layout:
meta-monitor/index.html e meta-monitor/minhas-acoes.html. Inclua teste de cálculo
(dias úteis, atraso, % por frente) em tools/testar_calc.js.
```

---

## Fase 6 — Cronograma (Gantt) e Agenda

**Objetivo:** atender à tarefa A6 (Gantt com dias úteis, feriados e férias) e à seção
"Agendas" do documento.

**O Code faz**
1. `cronograma.html`: Gantt por frente; barra = da criação/início até o prazo; feriados e
   férias sombreados; marcos como losangos; linha do "hoje"; contador de dias úteis.
   Tarefas sem prazo aparecem numa faixa "sem data" (não somem).
2. Cadastro de **férias** por pessoa (entra no cálculo de dias úteis e alerta se a pessoa
   tem tarefa com prazo no período).
3. `agenda.html`: visão semana/mês juntando prazos de tarefas + rituais (expandidos pela
   periodicidade) + eventos + feriados; exporta `.ics` para quem quiser no Outlook.

**Pronto quando:** Gantt mostra todas as tarefas com prazo; um feriado cadastrado muda a
contagem de dias úteis do painel; a agenda mostra o Daily nos dias certos.

**Prompt para colar:**
```
Execute a Fase 6 de parceria-monitor/docs/PLANO_ACAO_FASES.md. Reaproveite
meta-monitor/js/calendario.js e meta-monitor/js/timeline.js onde fizer sentido. Rituais:
[periodicidade/dia/horário de Daily e pontos de controle, ou "ainda não definidos"].
```

---

## Fase 7 — Relato semanal, histórico e exportações

**Objetivo:** apoiar a rotina de gestão (tarefa A9 — relato toda sexta) e dar transparência.

**O Code faz**
1. `relato.html`: escolhe a semana → gera texto com concluídas na semana (via histórico),
   atrasadas, próximas 2 semanas, marcos e pontos de atenção; botão **copiar** (para e-mail/Teams)
   e versão para imprimir/PDF.
2. `historico.html`: últimas 200 alterações com filtro por tabela/pessoa; diff antes/depois.
3. Exportar CSV da tabela de tarefas (`js/csv-export.js` do Corso).

**Pronto quando:** o relato da semana sai pronto para colar sem edição manual de números.

**Prompt para colar:**
```
Execute a Fase 7 de parceria-monitor/docs/PLANO_ACAO_FASES.md. Base para o histórico:
meta-monitor/js/editor-historico.js.
```

---

## Fase 8 — Qualidade e documentação

**Objetivo:** dá para mexer sem medo e outra sessão do Code entende o projeto sozinha.

**O Code faz**
1. Suíte de testes: `tools/testar_calc.js` (Node) + 1–2 testes headless com Chromium
   (página carrega, cria tarefa em modo teste, fallback funciona) + `tools/rodar_testes.sh`.
2. `parceria-monitor/README.md` completo (páginas, dados, como publicar, como rodar testes)
   e `parceria-monitor/CLAUDE.md` (convenções para sessões futuras).
3. Revisão de acessibilidade básica e celular (largura 375px).

**Pronto quando:** `bash tools/rodar_testes.sh` passa; o site funciona no celular.

**Prompt para colar:**
```
Execute a Fase 8 de parceria-monitor/docs/PLANO_ACAO_FASES.md, usando
meta-monitor/tools/rodar_testes.sh e os testes headless do Corso como modelo.
```

---

## Fase 9 — Opcionais (só se fizer falta)

| Item | Quando faz sentido |
|---|---|
| **Plano de riscos** (tela + tabela `parceria_riscos`: risco, dono, probabilidade, impacto, plano B) | Apoia a tarefa A8. Só a estrutura — os riscos vocês cadastram. |
| **Senha simples / login** | Se o link vazar ou alguém editar indevidamente. O Corso já tem o caminho pronto (`meta-monitor/docs/SEGURANCA_ESCRITA_AUTH.md`): trocar a policy `anon` de escrita por `authenticated`. |
| **Atualização ao vivo** (Supabase Realtime) | Se várias pessoas editarem ao mesmo tempo e o "recarregar" incomodar. |
| **Lembrete por e-mail** de prazos | Se o relato semanal não for suficiente. |

---

## Riscos do próprio site

| Risco | Mitigação |
|---|---|
| Sem login, qualquer um com o link pode escrever | Sem exclusão pela tela, histórico completo com antes/depois, "quem é você" em cada gravação; Fase 9 fecha se precisar |
| Policy criada sem `GRANT` (tabela "muda" em silêncio) | `tools/checar_banco.js --rede` na Fase 2 e em toda mudança de SQL |
| Supabase pausa projeto gratuito inativo | Projeto compartilhado com o Corso tem uso diário; o fallback local mantém o site de pé |
| Duas pessoas editando o mesmo campo | Última gravação vence, mas o histórico guarda as duas; Realtime na Fase 9 se virar problema |
| Commits do Corso republicando este site | Root Directory + "skip deployments" no Vercel (Fase 1) |

---

## Status por fase

| Fase | Status | Data | Observação |
|---|---|---|---|
| 0 — Decisões D1–D7 | Pendente | | Padrões valem se não houver resposta |
| 1 — Fundação e site no ar | Pendente | | |
| 2 — Banco no Supabase | Pendente | | |
| 3 — Leitura online | Pendente | | |
| 4 — Inserção e edição (MVP) | Pendente | | |
| 5 — Painel de monitoramento | Pendente | | |
| 6 — Gantt e Agenda | Pendente | | |
| 7 — Relato, histórico, exportação | Pendente | | |
| 8 — Qualidade e documentação | Pendente | | |
| 9 — Opcionais | — | | |
