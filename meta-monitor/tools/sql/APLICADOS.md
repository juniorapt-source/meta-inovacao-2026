# `tools/sql/` — o que já rodou em produção

Índice, não migration tooling: uma linha por script, o que ele faz, quando José rodou (ou
devia rodar) no SQL Editor do Supabase, e o estado atual. Fonte: `CHANGELOG.md` (histórico
em prosa) e os planos de execução em `docs/`. Onde a prosa não deixava 100% claro que o
script rodou de fato (em vez de só ter sido gerado/instruído), está marcado abaixo.

Ordem: cronológica, mais antigo primeiro. "Estado atual" é sobre **hoje** — um script pode
ter sido aplicado e depois revertido ou substituído por outro.

| Script | Data (rodado ou instruído) | Estado atual | Nota |
|---|---|---|---|
| `2026-08_nucleos.sql` | — | ✅ aplicado | Golden record 0.1 — tabela + RLS + trigger + seed dos 5 núcleos. |
| `2026-08_coletivos.sql` | — | ✅ aplicado | Golden record 0.2 — seed Comitê/URC/Coordenadores/Gestores/Soluções. |
| `2026-08_canais.sql` | — | ✅ aplicado | Golden record 0.3 — unifica `data/canais.js` + `CANAIS_URC`, preserva slug. |
| `2026-08_pessoas_golden.sql` | — | ✅ aplicado | Golden record 1.3 (junto com `coletivos_gerencia_ui.sql`) — `ALTER meta_inovacao_pessoas` + `CREATE meta_inovacao_pessoa_papeis`. |
| `2026-08_coletivos_gerencia_ui.sql` | — | ✅ aplicado | Golden record 1.3, ver acima. |
| `2026-08_projetos_nucleo_id.sql` | — | ✅ aplicado | Camada 2, item 2.1 — 28/28 conferido. |
| `2026-08_projeto_representantes.sql` | — | ✅ aplicado | Camada 2, item 2.2 — 34/35 (1 placeholder sem par, documentado). |
| `2026-08_urc_lideranca_pessoa_id.sql` | — | ✅ aplicado | Camada 2, item 2.3 — 3/3. |
| `2026-08_urc_canais_fk.sql` | — | ✅ aplicado | Camada 2, item 2.4 — 11/11 nos dois FKs. |
| `2026-08_plano_responsaveis.sql` | — | ✅ aplicado | Camada 2, item 2.6 — 61/61. |
| `2026-08_corsario_status_fk.sql` | — | ✅ aplicado | Camada 2, item 2.7 — 27/27, zero órfãos. |
| `2026-08_plano.sql` | v0.19.0 (2026-08-13), gerado; instruções de ativação em v0.20.0 | ✅ aplicado | `CHANGELOG.md` gera o script "não executado" e depois instrui a ordem de rodar (plano → agenda → proteção de escrita → auditoria). A migração seguinte (`migracao_modo_edicao.sql`) já assume essas 4 rodadas — sem elas o site não teria saído do fallback local. |
| `2026-08_agenda.sql` | v0.19.0 (2026-08-13), gerado; ativação em v0.20.0 | ✅ aplicado | Mesma cadeia do item acima (roda junto com `plano.sql`, não depende de ordem entre os dois). |
| `2026-08_protecao_escrita.sql` | v0.19.0 (2026-08-13), gerado; ativação em v0.20.0 | ⚠️ aplicado, depois substituído | Modelo original de token compartilhado (role `anon` + header `x-cc-token`). Substituído pelo modelo `authenticated + cc_eh_editor()` na v0.29.0 e revertido para o mesmo formato (token novo) por `2026-08_reverte_para_token_compartilhado.sql` na v0.30.0 — hoje o modelo é token compartilhado de novo, mas não literalmente este script (o token mudou). |
| `2026-08_auditoria.sql` | v0.19.0 (2026-08-13), gerado; ativação em v0.20.0 | ✅ aplicado (diagnóstico) | Cria a auditoria (`meta_inovacao_audit_log`/`cc_audit()`) que as migrações seguintes (`migracao_modo_edicao.sql` e adiante) já assumem existir. |
| `2026-08_migracao_modo_edicao.sql` | v0.20.0 (2026-08-13) | ✅ aplicado | Cria `meta_inovacao_pessoas`, `meta_inovacao_projetos`, `meta_inovacao_urc_lideranca`, `meta_inovacao_urc_canais_responsaveis`. `editor.html`/`participantes.html`/`projetos.html` já leem/gravam essas tabelas em produção desde então. |
| `2026-08_remover_salas_empreendedor.sql` | — | ✅ aplicado | `corsario_status` — iniciativa fora do portfólio removida. |
| `2026-08_corsario_edicao.sql` | 2026-08-18 (v0.28.0, e antes) | ✅ aplicado | Libera SELECT/INSERT/UPDATE de `corsario_status` (não libera DELETE — pendência conhecida, ver `2026-08_corrige_escrita_corsario.sql`). |
| `2026-08_corrige_escrita_projetos.sql` | 2026-08-18 | ✅ aplicado | Corrige `GRANT`/policy de `meta_inovacao_projetos` que tinham divergido em produção (causa do "Sem permissão de escrita" ao criar projeto). |
| `2026-08_corrige_escrita_corsario.sql` | 2026-08-18 (v0.28.0) | ✅ aplicado | Mesma correção, espelhada pra `corsario_status` (causa do 406 ao editar o Corsário). |
| `2026-08_corrige_escrita_select_autenticado.sql` | — | ✅ aplicado | `docs/PLANO_CANVA_OFICINAS.md` cita como precedente já ocorrido ("já aconteceu neste projeto de a policy de SELECT faltar e a tela quebrar em produção") — corrige policy de SELECT ausente sob o modelo autenticado. |
| `2026-08_auth_escrita.sql` | Fase 1 da migração de auth, rodado "há um tempo" antes da v0.29.0 (2026-08-19) | ⚠️ aplicado, depois revertido | Cria a allowlist `meta_inovacao_editores` + `cc_eh_editor()` e migra as policies de escrita pro modelo `authenticated`. Revertido por `2026-08_reverte_para_token_compartilhado.sql` (v0.30.0, 2026-08-20). |
| `2026-08_auth_escrita_cadastro_editor.sql` | v0.29.0 (2026-08-19) | ✅ aplicado (efeito revertido) | Cadastra o primeiro editor (JR.) na allowlist. A allowlist continua no banco (vazia de uso) depois da reversão — não foi desfeito, só ficou sem função. |
| `2026-08_auth_escrita_completa.sql` | v0.29.0 (2026-08-19) | ⚠️ aplicado, depois revertido | Fecha as 4 tabelas que a Fase 1 tinha deixado de fora (`corsario_status`, `meta_inovacao_projetos`, `meta_inovacao_matriz_demandas`, `plano_acao_atividades`) pro modelo `authenticated`. Revertido junto com `auth_escrita.sql` na v0.30.0. |
| `2026-08_reverte_para_token_compartilhado.sql` | v0.30.0, 2026-08-20 | ✅ aplicado — **modelo atual** | Volta as 9 tabelas do esquema pro token compartilhado (`cc_token_*`, role `anon`), com token novo (o anterior tinha vazado em capturas/Git). É o modelo de escrita em produção hoje. |
| `2026-08_canva_leitura_aberta.sql` | 2026-08-21 | ✅ aplicado | Troca a policy de SELECT autenticado do Canva por leitura aberta. |
| `2026-08_canva_demandas.sql` | — (antes de 21/08) | ✅ aplicado | Cria `meta_inovacao_canva_demandas` — tabela, índices, RLS, funções de gravação. |
| `2026-08_canva_demandas_fk.sql` | 23/08/2026 | ✅ aplicado | Golden record 2.5 — adiciona as 4 FKs (núcleo, canal, facilitador, responsável) e popula. |
| `2026-08_matriz_celulas.sql` | — | ✅ aplicado | Golden record 3.1 — `CREATE meta_inovacao_matriz_celulas`, 32/32 células migradas. |
| `2026-08_corsario_status_nucleo_id_recuperacao.sql` | — | ✅ aplicado | Camada 5, item 5.8 — recuperação de `nucleo_id` de `corsario_status`. |
| `2026-08_canva_grupo_local.sql` | 28/08/2026 | ✅ aplicado | Melhorias de navegação, item 3.14 — conferido em produção (`coluna=1, funcao=1, indice=1`), ensaiado contra PostgreSQL 16 real antes de rodar. |
| `2026-08_auditoria_fk_final.sql` | roda sob demanda | — (diagnóstico) | Só leitura — não é migração. É o script do guardrail de FK (Camada 5, D1 deste débito técnico) rodado manualmente por José no SQL Editor a cada auditoria. |
| `2026-08_matriz_celulas_diagnostico.sql` | roda sob demanda | — (diagnóstico) | Só leitura — 17 checagens de schema/RLS/realtime da Matriz. Não é migração. |

## Como manter isto atualizado

Todo novo script em `tools/sql/` ganha uma linha aqui quando José confirmar que rodou (ou
que decidiu não rodar). Não precisa ser na mesma sessão que criou o script — só não deixar
acumular de novo o hábito de só documentar em prosa no `CHANGELOG.md`.
