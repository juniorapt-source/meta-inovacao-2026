# Camada 2, item 2.9 — retrato de cobertura de FK

> ✅ **As 6 migrações já rodaram em produção (22/08/2026) e os números abaixo
> são os RETORNOS REAIS**, conferidos linha a linha com José direto no SQL
> Editor — não são mais a simulação local. A seção "como testei antes de
> rodar" fica embaixo, como registro do que dava pra prever antes da execução.

## Cobertura real, confirmada em produção

| Item | FK | Cobertura real | Faltando |
|---|---|---|---|
| 2.1 | `meta_inovacao_projetos.nucleo_id` | **28/28 (100%)** | — |
| 2.3 | `meta_inovacao_urc_lideranca.pessoa_id` | **3/3 (100%)** | — |
| 2.4 | `meta_inovacao_urc_canais_responsaveis.canal_id` | **11/11 (100%)** | — |
| 2.4 | `meta_inovacao_urc_canais_responsaveis.pessoa_id` | **11/11 (100%)** | — |
| 2.7 | `corsario_status.projeto_id` (por iniciativa) | **27/27 (100%)** | — |
| 2.7 | `corsario_status.nucleo_id` (por núcleo) | ~~— (não quebrado por núcleo na conferência, mas a checagem "sem FK" veio vazia)~~ **⚠️ ERRADO — era 0/4, ver nota abaixo** | 4 |
| 2.2 | `meta_inovacao_projeto_representantes` (vínculos) | **34/35 (97%)** | 1 — placeholder intencional |
| 2.6 | `meta_inovacao_plano_responsaveis` (vínculos) | **61/61 (100%)** | — |

**Diferenças em relação ao que eu tinha testado localmente**, descobertas ao
rodar de verdade:
- **28 projetos, não 27** — apareceu "Startup Summit" (representante: Jéssica),
  criado em produção depois da minha última simulação local. Resolvido sem
  ajuste nenhum no script, porque a resolução é por texto, não por lista
  fixa de projetos.
- **"Consult" trocou de representante** — era "Matheus" no seed histórico que
  testei, é "Carol" em produção agora. Mesma razão: resolução por texto
  aguenta o dado ter mudado.
- Por causa do projeto novo, 2.2 foi de 33/34 (estimado) pra **34/35 (real)** —
  a MESMA diferença de 1 (só o placeholder "Núcleo de Startups"), só que com
  os totais maiores.

## Cobertura testada ANTES de rodar em produção (registro)

| Item | FK | Cobertura testada localmente |
|---|---|---|
| 2.1 | `meta_inovacao_projetos.nucleo_id` | 27/27 (100%) |
| 2.3 | `meta_inovacao_urc_lideranca.pessoa_id` | 3/3 (100%) |
| 2.4 | `meta_inovacao_urc_canais_responsaveis.canal_id`/`pessoa_id` | 11/11 nos dois (100%) |
| 2.7 | `corsario_status.projeto_id`/`nucleo_id` | 27/27 e 5/5 (100%)* |
| 2.2 | `meta_inovacao_projeto_representantes` (vínculos) | 33/34 (97%) |
| 2.6 | `meta_inovacao_plano_responsaveis` (vínculos) | 61/61 (100%) |

**\* 2.7 tem uma ressalva real:** testei com um `corsario_status` **sintético**,
que eu montei espelhando `iniciativa`/`nucleo` exatamente iguais ao golden
record (`meta_inovacao_projetos`) — porque este ambiente não conseguiu ler o
`corsario_status` de produção de jeito nenhum (nem a consulta pontual, nem o
`tools/testar_iniciativas_cruzado.js`, que também deu 403 tentando). Não é uma
medição real, é a melhor aproximação que consegui montar. A reconciliação
27×28 já documentada (`GOVERNANCA_GOLDEN_RECORD.md`, Camada 4 — "Salas do
Empreendedor" removida, `corsario_status` reduzido a 27 iniciativas batendo com
o golden) é o que me dá confiança de que o casamento por texto deveria fechar
limpo na prática — mas **este é o item com menos garantia** dos 6, e o único
que eu recomendo rodar `relatorio_cobertura_fk.js` logo depois de aplicar, sem
esperar o resto da Camada 2, pra pegar cedo se `nucleo`/`iniciativa` tiverem
alguma grafia divergente do que os testes aqui assumiram.

## ⚠️ Correção (26/08/2026) — a linha hedgeada do 2.7 estava errada

A auditoria final da Camada 5 (item 5.1, `docs/CAMADA5_AUDITORIA_FK.md`) mediu
`corsario_status.nucleo_id` em produção e achou **0/4**: nenhuma linha da tabela
tem a FK, embora `projeto_id` — criada pelo mesmo `ALTER TABLE` e populada pelo
`UPDATE` seguinte do mesmo arquivo — esteja 27/27.

A linha desta tabela era a única das 8 com um veredito hedgeado em vez de um
número, e o hedge escondia o buraco. A verificação (b) de
`tools/sql/2026-08_corsario_status_fk.sql` é
`SELECT DISTINCT nucleo … WHERE nucleo_id IS NULL`: se `nucleo` estivesse NULL nas
linhas quando ela rodou, o retorno seria UMA linha com a célula vazia — que se lê
como "veio vazia" no SQL Editor. Hipótese, não certeza; o que é certo é o 0/4 de
hoje.

**Lição registrada:** checagem cujo "vazio" é ambíguo não é checagem. Por isso a
CONSULTA A da auditoria conta numerador/denominador em vez de listar o que falta, e
deixa os nomes pra CONSULTA C.

**Correção:** `tools/sql/2026-08_corsario_status_nucleo_id_recuperacao.sql`
(item 5.8 do plano) — diagnostica, popula por igualdade exata e depois normalizada,
reverifica. Idempotente. Não fecha a porta de escrita: iniciativa nova do corsário
continua nascendo sem as duas FKs até o item 5.7.

## O único "faltando", confirmado e sem ação necessária

`Sebrae Startups` → representante `"Núcleo de Startups"` não vira vínculo em
`meta_inovacao_projeto_representantes` — é o placeholder intencional de "ainda
aguarda indicação nominal", já investigado e confirmado como não-órfão em
`GOVERNANCA_GOLDEN_RECORD.md` (Camada 4, "Representantes órfãos"). Nenhuma ação
necessária; a linha nasce sem representante mesmo, até alguém indicar um nome
real ali.

## Status — Camada 2 concluída (22/08/2026)

As 6 migrações rodaram em produção nesta ordem, cada uma conferida por José
direto no SQL Editor antes de seguir pra próxima:

1. ✅ `2026-08_projetos_nucleo_id.sql` (2.1) — 28/28
2. ✅ `2026-08_urc_lideranca_pessoa_id.sql` (2.3) — 3/3
3. ✅ `2026-08_urc_canais_fk.sql` (2.4) — 11/11 nos dois FKs
4. ✅ `2026-08_corsario_status_fk.sql` (2.7) — 27/27, zero órfãos (a ressalva de
   dado sintético não se confirmou como risco real)
5. ✅ `2026-08_projeto_representantes.sql` (2.2) — 34/35, só o placeholder
6. ✅ `2026-08_plano_responsaveis.sql` (2.6) — 61/61

Nenhuma migração precisou de ajuste manual — nenhum caso de "nome que não casa
e precisa virar alias novo" apareceu em produção, incluindo nos 2 pontos onde
o dado real já tinha mudado desde o levantamento do item 1.1 (projeto novo
"Startup Summit", representante trocado em "Consult").

`node tools/relatorio_cobertura_fk.js` continua disponível pra reconferir
esses números quando quiser (precisa de rede até `supabase.co` — não roda
neste ambiente, mas roda no terminal/máquina de quem tiver acesso).
