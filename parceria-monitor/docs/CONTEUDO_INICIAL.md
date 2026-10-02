# Conteúdo inicial — Parceria Sebrae e Instituto Integrador

Transcrição fiel do documento `resumo_para_sistema_2.docx` (enviado por José em 02/10/2026).
**Este é o único conteúdo que o site nasce tendo.** Nenhuma tarefa nova foi criada: o que
está aqui é exatamente o que estava no documento, só organizado em tabelas para virar
seed (`data/*.js` e SQL). Erros de digitação do original foram corrigidos só onde não há
dúvida de sentido (ex.: "Publiccaçao" → "Publicação"); todo o resto está como veio.

Convenções usadas na transcrição:

- **Cód.** — o documento só traz código na Frente A (A1, A6, A8–A11, com lacunas que já
  existiam no original) e na Frente F (F1). Nas outras frentes a coluna veio vazia; o seed
  mantém `codigo` vazio e o site gera o código na carga (letra da frente + ordem: B1, B2...).
  Ver decisão D5 em `PLANO_ACAO_FASES.md`.
- **Prazo** — guardado de duas formas: `prazo_texto` (como veio) e `prazo` (data ISO, ano
  2026) quando a data é inequívoca. "Sexta" sem número fica só como texto.
- **Status** — vazio no original vira `A iniciar` no seed (decisão D6).
- Colunas vazias no original ficam vazias.

---

## Frentes da EAP

| Id | Frente | Entrega da frente (como veio) |
|---|---|---|
| A | Gestão do projeto | Time alinhado, cronograma vivo e riscos sob controle |
| B | Mobilização empresarial | 50 empresas selecionadas e confirmadas para o workshop até 16/11. |
| C | Workshop com as empresas | — |
| D | Edital / Chamada de Residência | — |
| E | Orçamento | — |
| F | Convênio (aditivo CNI / UCOMP) | — |
| G | Bonus: Eventos / cerimônias / agendas no dia 08/12 | agendas paralelas ao edital acontecendo no espaço |
| H | Contratações e logística | Workshop e evento com fornecedores e logística fechados. |
| I | Convênio | Workshop e evento com fornecedores e logística fechados. *(texto idêntico ao da Frente H no original — provável cópia; ver pendência P1)* |

## Tarefas

### Frente A — Gestão do projeto

| Cód. | Tarefa | Responsável | Prazo | Depende de | Status |
|---|---|---|---|---|---|
| A1 | Incluir a Renata (UCOMP) no grupo do projeto | | | | |
| A6 | Montar o Gantt com contador de dias úteis, feriados e férias | | | | |
| A8 | Montar o plano de riscos, com dono e plano B por risco | | | | |
| A9 | Enviar o relato semanal às gerências, toda sexta | | | | |
| A10 | Definir quem conduz a Gestão Operacional de 30/11 a 08/12 | | | | |
| A11 | Decidir se o Comitê Estratégico será formalizado e marcar as reuniões | | | | |

### Frente B — Mobilização empresarial

| Cód. | Tarefa | Responsável | Prazo (texto → data) | Depende de | Status |
|---|---|---|---|---|---|
| | Definir os critérios de divulgação (Inova biomas, Catalisa ICT, DeepTech Indústria, DF DeepTech) | | | | Concluído |
| | Proposta de formulário | Arthur | 01/10 → 2026-10-01 | | Concluído |
| | Definir o conteúdo/critérios do formulário | Hulda | Sexta 02 → 2026-10-02 | | Concluído |
| | Definir a tecnologia do formulário e da divulgação | Jr. | | | Concluído |
| | Definir a janela de inscrições (uma semana) | Rodrigo | | | Concluído |
| | Validação da fonte orçamentária para execução do workshop | PR e Marimon | 05/10 → 2026-10-05 | | |
| | Publicar na plataforma | Arthur | 05/10 → 2026-10-05 | | A iniciar |
| | Divulgação | Arthur | | | |
| | Propor para a CNI a estratégia de divulgação e segmentação | | 02/10 → 2026-10-02 | | |
| | Validar data e local do workshop | Victor | Sexta → *(sem data — P3)* | | |

### Frente C — Workshop com as empresas

| Cód. | Tarefa | Responsável | Prazo | Depende de | Status |
|---|---|---|---|---|---|
| | Definir quem vai liderar e custear a logística com o workshop | CNI | | | |
| | Decidir a data e o formato do workshop | Sebrae e CNI | | | |
| | Definir o objetivo, o roteiro e as perguntas do workshop | Empresa contratada pela CNI | | | |
| | Realizar o workshop com as 60 empresas *(a Frente B fala em 50 — P2)* | | | | |
| | Consolidar as contribuições para o edital a partir da entrega da facilitadora | CNI | | | |
| | Publicação no dia 08 | | 08 → 2026-12-08 *(inferido — P4)* | | |

### Frente D — Edital / Chamada de Residência

| Cód. | Tarefa | Responsável | Prazo | Depende de | Status |
|---|---|---|---|---|---|
| | Definir quem aprova o edital em cada instituição e quanto tempo leva | | | | |
| | Redigir a minuta-base do edital | | | | |
| | Validar o edital nas instituições (Sebrae, CNI) | | | | |
| | Mobilização das empresas/ecossistema para lançamento do edital | | | | |
| | Lançamento do Edital de Residência de Empresas | | | | |
| | Definir o que acontece depois de 08/12 (prazo de inscrição, quem opera) | | | | |

### Frente E — Orçamento

| Cód. | Tarefa | Responsável | Prazo | Depende de | Status |
|---|---|---|---|---|---|
| | Levantar os custos por frente (workshop, transfers, evento, divulgação) | | | | |
| | Estimar os valores e propor a fonte de recurso de cada item (Sebrae, CNI, SENAI) | | | | |
| | Validar o orçamento com Paulo Renato e Marimon | | | | |
| | Plano B para custeio | | | | |

### Frente F — Convênio (aditivo CNI / UCOMP)

| Cód. | Tarefa | Responsável | Prazo | Depende de | Status |
|---|---|---|---|---|---|
| F1 | Verificar se, o que e como pode ser consumido do convênio | | | | |

### Frente G — Bonus: Eventos / cerimônias / agendas no dia 08/12

| Cód. | Tarefa | Responsável | Prazo (texto → data) | Depende de | Status |
|---|---|---|---|---|---|
| | Senai: Culminância (Supernova + Inova) acontecer | | 09/10 (sex) → 2026-10-09 | | Concluído |
| | Senai: Avaliar outras iniciativas | | | | |
| | Validar a capacidade do espaço com as agendas já previstas para o dia do lançamento | | | | |

### Frente H — Contratações e logística

| Cód. | Tarefa | Responsável | Prazo | Depende de | Status |
|---|---|---|---|---|---|
| | Especificar o que contratar para o workshop (facilitação, espaço, materiais) | | | | |
| | Especificar transfers e hospedagem (perfil e número estimado de pessoas) | | | | |
| | Cotar fornecedores e preparar as contratações | | | | |
| | Fechar as contratações de facilitação e transfers | | | | |
| | Fechar transfers e hospedagem com a lista final das 50 | | | | |
| | Contratar fornecedores do evento de 08/12 (som, alimentação, credenciamento) | | | | |

### Frente I — Convênio

| Cód. | Tarefa | Responsável | Prazo | Depende de | Status |
|---|---|---|---|---|---|
| | Congresso — Encerrado | | | | *(P5)* |
| | Jornadas de inovação — Encerrado | | | | *(P5)* |
| | Deep tech indústria (Mirelli gestora CNI e Hulda Sebrae) | | | | |

**Nota da frente I** (no original aparece como linha de tarefa, mas é uma observação — o seed
grava no campo `nota` da frente):
> O saldo que tem no convênio é saldo do congresso e jornada; para remanejamento, a Renata
> Candida precisa negociar com a "Sil" qualquer remanejamento.

---

## Pessoas e papéis

| Nome | Instituição | E-mail |
|---|---|---|
| José Júnior | Sebrae / UI | Jose.oliveira@sebrae.com.br |
| Rodrigo Rodrigues | Sebrae / UI | rodrigo.arodrigues@sebrae.com.br |
| Hulda Oliveira | *(vazio no original)* | hulda.giesbrecht@sebrae.com.br |
| Paulo Renato | Sebrae / UI | paulo.renato@sebrae.com.br |
| Renata Candida | UCOMP | renata.souza@sebrae.com.br |
| Marimon | UCOMP | fabio.marimon@sebrae.com.br |
| Victor Rafael | Sebrae / UI | victor.melo@sebrae.com.br |
| Arthur Alves Prates | Sebrae / UI | potenza.arthurp@sebrae.com.br |
| Francine Duarte Castro | Instituto | francine.castro@senaicni.com.br |
| Artur Vicari Granato | Instituto | artur.granato@senaicni.com.br |
| Jade Ribeiro dos Santos | Instituto | jade.santos@senaicni.com.br |
| Angela Luzia Drezza | Instituto | angela.drezza@senaicni.com.br |

Apelidos usados na coluna "Responsável" das tarefas (o seed guarda o texto como veio; o
site resolve para a pessoa quando o apelido é inequívoco):
`Arthur` → Arthur Alves Prates · `Hulda` → Hulda Oliveira · `Jr.` → José Júnior ·
`Rodrigo` → Rodrigo Rodrigues · `Victor` → Victor Rafael · `PR` → Paulo Renato ·
`Marimon` → Marimon. Responsáveis institucionais (`CNI`, `Sebrae e CNI`,
`Empresa contratada pela CNI`) ficam como texto livre.

## Agendas (rituais)

O original diz: *"Agendas (que absorve os prazos das atividades + as agendas abaixo)"* —
ou seja, a tela de agenda mostra os prazos das tarefas **e** estes rituais.

| Tipo | Público |
|---|---|
| Daily | Time técnico Sebrae |
| Ponto de controle executivo | Time técnico e gerentes Sebrae |
| Ponto de controle institucional | Time técnico Sebrae e Instituto |

Periodicidade, dia e horário de cada ritual não constam do documento (pendência P6).

## Marcos citados no texto

Não são tarefas novas — são datas que já aparecem dentro das tarefas/entregas e que o
painel usa para contagem regressiva:

| Data | Marco | Onde aparece |
|---|---|---|
| 2026-11-16 | 50 empresas selecionadas e confirmadas | Entrega da Frente B |
| 2026-11-30 a 2026-12-08 | Período da Gestão Operacional | Tarefa A10 |
| 2026-12-08 | Lançamento do edital / evento no espaço | Frentes C, D, G, H |

---

## Pendências de conteúdo (para o José responder — não bloqueiam o site)

| # | Dúvida |
|---|---|
| P1 | Frente I tem o mesmo texto de entrega da Frente H. Qual é a entrega real da Frente I? E as Frentes F e I (ambas "Convênio") devem ser fundidas? |
| P2 | Frente B fala em 50 empresas; a tarefa da Frente C fala em 60. Qual vale? |
| P3 | "Validar data e local do workshop — Victor — Sexta": qual sexta (02/10 ou 09/10)? |
| P4 | "Publicação no dia 08" (Frente C) é 08/12? Publicação de quê — das contribuições consolidadas ou do edital? |
| P5 | "Congresso" e "Jornadas de inovação" estão marcados como encerrados: entram como tarefa `Concluído` ou só como registro histórico do saldo do convênio? (Seed provisório: `Concluído`.) |
| P6 | Daily / pontos de controle: periodicidade, dia, horário e link. |
| P7 | Instituição da Hulda Oliveira (vazia no original). |
