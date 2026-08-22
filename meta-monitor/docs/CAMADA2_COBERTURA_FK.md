# Camada 2, item 2.9 — retrato de cobertura de FK (antes de rodar em produção)

> Números abaixo vêm dos testes locais que rodei contra um Postgres simulando o
> estado real de produção (Camada 0 + Camada 1 já aplicadas + os seeds originais
> de `2026-08_migracao_modo_edicao.sql`/`2026-08_plano.sql`) — não são uma
> consulta ao Supabase de verdade (este ambiente não tem rede liberada pra
> `supabase.co`). Depois que você rodar as 6 migrações da Camada 2,
> `node tools/relatorio_cobertura_fk.js` reproduz esta mesma tabela contra os
> dados reais — rode pra confirmar que bate com o que está aqui.

## Cobertura por item

| Item | FK | Cobertura testada | Faltando |
|---|---|---|---|
| 2.1 | `meta_inovacao_projetos.nucleo_id` | **27/27 (100%)** | — |
| 2.3 | `meta_inovacao_urc_lideranca.pessoa_id` | **3/3 (100%)** | — |
| 2.4 | `meta_inovacao_urc_canais_responsaveis.canal_id` | **11/11 (100%)** | — |
| 2.4 | `meta_inovacao_urc_canais_responsaveis.pessoa_id` | **11/11 (100%)** | — |
| 2.7 | `corsario_status.projeto_id` (por iniciativa) | **27/27 (100%)*** | — |
| 2.7 | `corsario_status.nucleo_id` (por núcleo) | **5/5 (100%)*** | — |
| 2.2 | `meta_inovacao_projeto_representantes` (vínculos) | **33/34 (97%)** | 1 — placeholder intencional |
| 2.6 | `meta_inovacao_plano_responsaveis` (vínculos) | **61/61 (100%)** | — |

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

## O único "faltando" esperado: item 2.2

`Sebrae Startups` → representante `"Núcleo de Startups"` não vira vínculo em
`meta_inovacao_projeto_representantes` — é o placeholder intencional de "ainda
aguarda indicação nominal", já investigado e confirmado como não-órfão em
`GOVERNANCA_GOLDEN_RECORD.md` (Camada 4, "Representantes órfãos"). Nenhuma ação
necessária; a linha nasce sem representante mesmo, até alguém indicar um nome
real ali.

## Como usei isso pra decidir a ordem dos 6 scripts

100% de cobertura nos 5 primeiros (2.1/2.3/2.4/2.7/2.6) e 97% no 2.2 (com a
diferença explicada) foi o que me deu confiança de que **nenhuma migração
precisa de ajuste manual antes de rodar** — não achei um caso de "nome que
não casa e precisa virar alias novo" em nenhum dos 6 itens. Se
`relatorio_cobertura_fk.js` mostrar número diferente destes depois de rodado
em produção de verdade, o motivo mais provável é dado que mudou entre o
levantamento do item 1.1 (22/08/2026) e agora — não um bug nas migrações.

## Checklist pra rodar no SQL Editor

Ordem sem dependência forte entre si (cada script confere os pré-requisitos
sozinho e aborta com mensagem clara se faltar algo), mas nesta sequência bate
com a ordem que você pediu:

1. `2026-08_projetos_nucleo_id.sql` (2.1)
2. `2026-08_urc_lideranca_pessoa_id.sql` (2.3)
3. `2026-08_urc_canais_fk.sql` (2.4)
4. `2026-08_corsario_status_fk.sql` (2.7)
5. `2026-08_projeto_representantes.sql` (2.2)
6. `2026-08_plano_responsaveis.sql` (2.6)

Depois de rodar as 6: `node tools/relatorio_cobertura_fk.js` (precisa de rede
até `supabase.co` — não roda neste ambiente, mas roda no seu terminal/máquina).
