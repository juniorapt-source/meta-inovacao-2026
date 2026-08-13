window.DB = window.DB || {};
window.DB.pessoas = [
 {
  "nome": "JR. (José Júnior)",
  "papel": "Coordenação do plano · ponto de contato com a URC",
  "grupo": "UI"
 },
 {
  "nome": "Gerência UI",
  "papel": "Guardiã dos Nós 1 e 4 · comunicação institucional",
  "grupo": "UI"
 },
 {
  "nome": "Sandra",
  "papel": "Assistente do plano: agendas, prazos, monitoramento, boletim",
  "grupo": "UI"
 },
 {
  "nome": "Anny",
  "papel": "Comunicação · convite e articulação da oficina UDT",
  "grupo": "UI"
 },
 {
  "nome": "Pova",
  "papel": "Agente de IA de apoio ao formulário (CAN-08/09)",
  "grupo": "UI"
 },
 {
  "nome": "Gabriel Gil Barreto Barros",
  "papel": "Comitê de Atendimento e Relacionamento da Inovação",
  "grupo": "Comitê"
 },
 {
  "nome": "Hulda Oliveira Giesbrecht",
  "papel": "Comitê de Atendimento e Relacionamento da Inovação",
  "grupo": "Comitê"
 },
 {
  "nome": "Lara Chicuta Franco",
  "papel": "Comitê de Atendimento e Relacionamento da Inovação",
  "grupo": "Comitê"
 },
 {
  "nome": "Marcus Vinicius Lopes Bezerra",
  "papel": "Comitê de Atendimento e Relacionamento da Inovação",
  "grupo": "Comitê"
 },
 {
  "nome": "Matheus Lopes de Queiroz Campos",
  "papel": "Comitê de Atendimento e Relacionamento da Inovação",
  "grupo": "Comitê"
 },
 {
  "nome": "Paulo Puppin Zandonadi",
  "papel": "Comitê de Atendimento e Relacionamento da Inovação",
  "grupo": "Comitê"
 },
 {
  "nome": "Sandra Chaves Silva Paraíso",
  "papel": "Comitê de Atendimento e Relacionamento da Inovação",
  "grupo": "Comitê"
 },
 {
  "nome": "Gabriel Gil Barreto Barros",
  "nucleo": "Tecnologias Portadoras de Futuro",
  "grupo": "Núcleos"
 },
 {
  "nome": "Hulda Oliveira Giesbrecht",
  "nucleo": "Tecnologias Portadoras de Futuro",
  "grupo": "Núcleos"
 },
 {
  "nome": "Lara Chicuta Franco",
  "nucleo": "Gestão do Conhecimento e Processos",
  "grupo": "Núcleos"
 },
 {
  "nome": "Marcus Vinicius Lopes Bezerra",
  "nucleo": "Inovação Territorial",
  "grupo": "Núcleos"
 },
 {
  "nome": "Matheus Lopes de Queiroz Campos",
  "nucleo": "Inovação para Competitividade",
  "grupo": "Núcleos"
 },
 {
  "nome": "Paulo Puppin Zandonadi",
  "nucleo": "Startups",
  "grupo": "Núcleos"
 },
 {
  "nome": "Sandra Chaves Silva Paraíso",
  "nucleo": "Gestão do Conhecimento e Processos",
  "grupo": "Núcleos"
 },
 {
  "nome": "José Mendes de Oliveira Júnior",
  "nucleo": "Inovação para Competitividade",
  "grupo": "Núcleos"
 }
];

/* Lista canônica de responsáveis (BACKLOG #004) — id estável + nome de exibição, usada
 * pelo select de "Responsável" (plano-acao.html) e pela página "Minhas ações"
 * (minhas-acoes.html). Extraída varrendo data/plano.js (campo "resp"), data/nos.js (campo
 * "guardiao") e data/projetos.js (campo "representantes"); ver js/responsaveis.js pra
 * como um texto livre ("JR. e Pova") vira array de ids desta lista.
 *
 * grupo aqui é só rótulo de agrupamento visual no select (Coordenação/Coletivo/Núcleos/
 * Projetos) — não é o mesmo campo/vocabulário do "grupo" de window.DB.pessoas acima. */
window.DB.responsaveis = [
 { "id": "jr", "nome": "JR. (José Júnior)", "grupo": "Coordenação" },
 { "id": "sandra", "nome": "Sandra", "grupo": "Coordenação" },
 { "id": "anny", "nome": "Anny", "grupo": "Coordenação" },
 { "id": "pova", "nome": "Pova (agente de IA)", "grupo": "Coordenação" },
 { "id": "gerencia", "nome": "Gerência UI", "grupo": "Coordenação" },

 { "id": "comite", "nome": "Comitê", "grupo": "Coletivo" },
 { "id": "urc", "nome": "URC", "grupo": "Coletivo" },
 { "id": "solucoes", "nome": "Soluções", "grupo": "Coletivo" },
 { "id": "coordenadores", "nome": "Coordenadores", "grupo": "Coletivo" },
 { "id": "gestores", "nome": "Gestores dos projetos", "grupo": "Coletivo" },

 { "id": "gabriel_barreto_barros", "nome": "Gabriel Gil Barreto Barros", "grupo": "Núcleos" },
 { "id": "hulda_giesbrecht", "nome": "Hulda Oliveira Giesbrecht", "grupo": "Núcleos" },
 { "id": "lara_chicuta_franco", "nome": "Lara Chicuta Franco", "grupo": "Núcleos" },
 { "id": "marcus_lopes_bezerra", "nome": "Marcus Vinicius Lopes Bezerra", "grupo": "Núcleos" },
 { "id": "matheus_queiroz_campos", "nome": "Matheus Lopes de Queiroz Campos", "grupo": "Núcleos" },
 { "id": "paulo_puppin_zandonadi", "nome": "Paulo Puppin Zandonadi", "grupo": "Núcleos" },
 { "id": "sandra_chaves_paraiso", "nome": "Sandra Chaves Silva Paraíso", "grupo": "Núcleos" },
 { "id": "jose_mendes_junior", "nome": "José Mendes de Oliveira Júnior", "grupo": "Núcleos" },

 { "id": "agnaldo", "nome": "Agnaldo", "grupo": "Projetos" },
 { "id": "carol", "nome": "Carol", "grupo": "Projetos" },
 { "id": "cris", "nome": "Cris", "grupo": "Projetos" },
 { "id": "dario", "nome": "Dario", "grupo": "Projetos" },
 { "id": "felipe", "nome": "Felipe", "grupo": "Projetos" },
 { "id": "fernanda", "nome": "Fernanda", "grupo": "Projetos" },
 { "id": "fred", "nome": "Fred", "grupo": "Projetos" },
 { "id": "jessica", "nome": "Jéssica", "grupo": "Projetos" },
 { "id": "rafa", "nome": "Rafa", "grupo": "Projetos" },
 { "id": "raquel", "nome": "Raquel", "grupo": "Projetos" },
 { "id": "thiago", "nome": "Thiago", "grupo": "Projetos" },
 { "id": "valeria", "nome": "Valéria", "grupo": "Projetos" },
 { "id": "webia", "nome": "Wébia", "grupo": "Projetos" }
];
