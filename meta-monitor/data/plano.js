window.DB = window.DB || {};
window.DB.plano = [
 {
  "id": "CMT-01",
  "frente": "1. Comitê e Governança",
  "sub": "Governança",
  "atividade": "Constituição do Comitê",
  "resp": "Coordenadores",
  "responsavel_id": ["coordenadores"],
  "prazo": "28/07",
  "prazo_iso": "2026-07-28",
  "status": "Concluído",
  "dep": [],
  "cc": {
   "tipo": null
  },
  "como": "Concluída. Registrar em ata a composição e os três papéis do Comitê (engajamento, curadoria, devolutiva) para citação nas comunicações.",
  "monitor": "Ata publicada e referenciada no boletim CG-01.",
  "ferramenta": "Ata + repositório do projeto"
 },
 {
  "id": "CMT-02",
  "frente": "1. Comitê e Governança",
  "sub": "Governança",
  "atividade": "Programação das agendas recorrentes (semanais ou quinzenais) do Comitê",
  "resp": "Sandra",
  "responsavel_id": ["sandra"],
  "prazo": "05/08",
  "prazo_iso": "2026-08-05",
  "status": "Não iniciado",
  "dep": [],
  "cc": {
   "tipo": null
  },
  "como": "Sandra cria série recorrente no calendário (semanal ou quinzenal, 50 min) com pauta padrão fixa: nós da semana, pendências de formulário, decisões.",
  "monitor": "Série criada no calendário e taxa de realização das reuniões registrada neste painel (agenda).",
  "ferramenta": "Outlook/Teams + painel"
 },
 {
  "id": "CMT-03",
  "frente": "1. Comitê e Governança",
  "sub": "Comunicação",
  "atividade": "Apresentação do Comitê e do plano de ação na reunião de equipe",
  "resp": "Gerência",
  "responsavel_id": ["gerencia"],
  "prazo": "10/08",
  "prazo_iso": "2026-08-10",
  "status": "Não iniciado",
  "dep": [],
  "cc": {
   "tipo": null
  },
  "como": "Usar o deck já validado; apresentar plano, papéis e este painel na reunião de equipe de 10/08. Encerrar com o trilho dos 7 nós.",
  "monitor": "Apresentação realizada; link do painel circulado ao time.",
  "ferramenta": "Deck + painel (link Vercel)"
 },
 {
  "id": "CMT-04",
  "frente": "1. Comitê e Governança",
  "sub": "Governança",
  "atividade": "Definição do rito do Comitê: pauta padrão, registro de decisões e encaminhamentos",
  "resp": "Comitê",
  "responsavel_id": ["comite"],
  "prazo": "07/08",
  "prazo_iso": "2026-08-07",
  "status": "Não iniciado",
  "dep": [],
  "cc": {
   "tipo": null
  },
  "como": "Definir no rito de 07/08: pauta padrão, quem registra decisões, prazo de resposta do Comitê (ex.: 2 d.u.) e canal único de entrada de demandas.",
  "monitor": "Documento de rito de 1 página versionado no repo (docs/).",
  "ferramenta": "docs/rito_comite.md no repo"
 },
 {
  "id": "INS-01",
  "frente": "2. Instrumentos",
  "sub": "Criação",
  "atividade": "Definição do Lote 1 de instrumentos para aprovação (UASJUR, UGE e UGS/Soluções)",
  "resp": "Jr. e gestores",
  "responsavel_id": ["jr","gestores"],
  "prazo": "05/08",
  "prazo_iso": "2026-08-05",
  "status": "Concluído",
  "dep": [],
  "cc": {
   "tipo": null
  },
  "como": "Concluída. Lote 1 definido com as unidades-alvo (UASJUR, UGE, UGS/Soluções, URC).",
  "monitor": "Lista do Lote 1 refletida nas ações INS-02/06/07.",
  "ferramenta": "Painel · plano"
 },
 {
  "id": "INS-02",
  "frente": "2. Instrumentos",
  "sub": "Discussão Técnica",
  "atividade": "Agendas de debate e validação técnica dos instrumentos do Lote 1",
  "resp": "Sandra",
  "responsavel_id": ["sandra"],
  "prazo": "—",
  "prazo_iso": null,
  "status": "Em andamento",
  "dep": [
   "INS-01"
  ],
  "cc": {
   "tipo": "no",
   "no": 3
  },
  "como": "Sandra agenda os debates restantes (Op. Fomento e Op. Investimento) até 11/08; convocar Agnaldo e, se preciso, Giovanni para a fronteira FAMPE/Finep.",
  "monitor": "Debates realizados até 11/08 = Nó 3 no verde; registrar resultado por instrumento no painel.",
  "ferramenta": "Agenda + painel (caminho crítico)"
 },
 {
  "id": "INS-03",
  "frente": "2. Instrumentos",
  "sub": "Criação",
  "atividade": "Definição do Lote 2 (último) de instrumentos para aprovação",
  "resp": "Comitê",
  "responsavel_id": ["comite"],
  "prazo": "—",
  "prazo_iso": null,
  "status": "Concluído",
  "dep": [],
  "cc": {
   "tipo": null
  },
  "como": "Concluída. Lote 2 fechado (inclui itens dependentes da UDT e definições ALI IG).",
  "monitor": "Escopo do Lote 2 listado no painel.",
  "ferramenta": "Painel · plano"
 },
 {
  "id": "INS-04",
  "frente": "2. Instrumentos",
  "sub": "Discussão Técnica",
  "atividade": "Agendas de debate e validação técnica dos instrumentos do Lote 2",
  "resp": "Sandra",
  "responsavel_id": ["sandra"],
  "prazo": "—",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [
   "INS-03"
  ],
  "cc": {
   "tipo": "no",
   "no": 6
  },
  "como": "Anny confirma a oficina UDT (convite saiu até 07/08). Antecipar com o time o que não depende da UDT (ex.: ALI IG) nas mesmas agendas.",
  "monitor": "Data da oficina cravada até 14/08; sem data → gatilho do Nó 6 (gerência aciona).",
  "ferramenta": "Convite Anny + gatilho Nó 6"
 },
 {
  "id": "INS-06",
  "frente": "2. Instrumentos",
  "sub": "Aprovação",
  "atividade": "Validação final do Lote 1 pelo Comitê antes da submissão",
  "resp": "Comitê",
  "responsavel_id": ["comite"],
  "prazo": "12/08",
  "prazo_iso": "2026-08-12",
  "status": "Não iniciado",
  "dep": [
   "INS-02"
  ],
  "cc": {
   "tipo": "no",
   "no": 3
  },
  "como": "Validação final do Lote 1 no Comitê em 12/08; se Fomento/Investimento não fecharem, aplicar fallback: Lote 1A (3 prontos) sobe dia 14, restante 21/08.",
  "monitor": "Decisão registrada em ata; status muda para Concluído no painel em 12/08.",
  "ferramenta": "Rito do Comitê + painel"
 },
 {
  "id": "INS-07",
  "frente": "2. Instrumentos",
  "sub": "Aprovação",
  "atividade": "Submissão do Lote 1 às unidades responsáveis",
  "resp": "JR./Gerência",
  "responsavel_id": ["jr","gerencia"],
  "prazo": "14/08",
  "prazo_iso": "2026-08-14",
  "status": "Não iniciado",
  "dep": [
   "INS-06"
  ],
  "cc": {
   "tipo": "no",
   "no": 4
  },
  "como": "Submeter ofícios/fichas às unidades em 14/08 (compromisso público do deck — não desliza). Distribuir a carga do dia com Sandra e Pova.",
  "monitor": "Protocolos de submissão anexados; Nó 4 verde no painel em 14/08.",
  "ferramenta": "Ofício/e-mail institucional + painel"
 },
 {
  "id": "INS-08",
  "frente": "2. Instrumentos",
  "sub": "Aprovação",
  "atividade": "Validação dos instrumentos do Lote 2 pelo Comitê",
  "resp": "Comitê",
  "responsavel_id": ["comite"],
  "prazo": "18/09",
  "prazo_iso": "2026-09-18",
  "status": "Não iniciado",
  "dep": [
   "INS-04"
  ],
  "cc": {
   "tipo": "cadeia",
   "no": 6
  },
  "como": "Validar Lote 2 no Comitê em 18/09, com insumos da oficina UDT (Nó 6).",
  "monitor": "Ata de validação; cadeia 6 em dia no painel.",
  "ferramenta": "Rito do Comitê"
 },
 {
  "id": "INS-09",
  "frente": "2. Instrumentos",
  "sub": "Aprovação",
  "atividade": "Submissão do Lote 2 às unidades responsáveis",
  "resp": "JR./Gerência",
  "responsavel_id": ["jr","gerencia"],
  "prazo": "25/09",
  "prazo_iso": "2026-09-25",
  "status": "Não iniciado",
  "dep": [
   "INS-08"
  ],
  "cc": {
   "tipo": "cadeia",
   "no": 6
  },
  "como": "Submeter Lote 2 em 25/09 às unidades responsáveis, mesmo rito do Lote 1.",
  "monitor": "Protocolos anexados; cadeia 6 concluída.",
  "ferramenta": "Ofício/e-mail institucional"
 },
 {
  "id": "INS-10",
  "frente": "2. Instrumentos",
  "sub": "Aprovação",
  "atividade": "Recebimento e incorporação das devolutivas das unidades (UASJUR/UGE/UGS) nas fichas dos instrumentos",
  "resp": "Jr. e gestores",
  "responsavel_id": ["jr","gestores"],
  "prazo": "set–out",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [
   "INS-07",
   "INS-09"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Consolidar devolutivas por instrumento numa tabela única (aceito · aceito com ajustes · não aceito) e incorporar às fichas.",
  "monitor": "Tabela de devolutivas preenchida; % de fichas ajustadas visível no boletim.",
  "ferramenta": "Planilha de devolutivas + boletim CG-01"
 },
 {
  "id": "INS-11",
  "frente": "2. Instrumentos",
  "sub": "Comunicação",
  "atividade": "Comunicação às UFs sobre a aprovação do Lote 1",
  "resp": "Sandra/Gerência",
  "responsavel_id": ["sandra","gerencia"],
  "prazo": "após devolutiva",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [
   "INS-10"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Comunicado às UFs sobre o Lote 1 aprovado: o que muda, a partir de quando, onde registrar.",
  "monitor": "Comunicado enviado; data registrada no painel.",
  "ferramenta": "Marketing Cloud / canal institucional"
 },
 {
  "id": "INS-12",
  "frente": "2. Instrumentos",
  "sub": "Comunicação",
  "atividade": "Comunicação às UFs sobre a aprovação do Lote 2",
  "resp": "Sandra/Gerência",
  "responsavel_id": ["sandra","gerencia"],
  "prazo": "após devolutiva",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [
   "INS-10"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Mesmo modelo do INS-11 para o Lote 2.",
  "monitor": "Comunicado enviado; data registrada no painel.",
  "ferramenta": "Marketing Cloud / canal institucional"
 },
 {
  "id": "CAN-01",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Metodologia",
  "atividade": "Elaboração e envio da proposta de encontros para a URC",
  "resp": "JR.",
  "responsavel_id": ["jr"],
  "prazo": "30/07",
  "prazo_iso": "2026-07-30",
  "status": "Concluído",
  "dep": [],
  "cc": {
   "tipo": null
  },
  "como": "Concluída. Proposta enviada à URC (Enio e Milva) com estrutura de 2 sessões × 3h por canal.",
  "monitor": "E-mail enviado em 30/07.",
  "ferramenta": "E-mail institucional"
 },
 {
  "id": "CAN-02",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Aprovação",
  "atividade": "Validação da grade de encontros pela URC",
  "resp": "URC",
  "responsavel_id": ["urc"],
  "prazo": "04/08",
  "prazo_iso": "2026-08-04",
  "status": "Em andamento",
  "dep": [
   "CAN-01"
  ],
  "cc": {
   "tipo": "no",
   "no": 1
  },
  "como": "Aguardar devolutiva da URC; silêncio até 12h de 05/08 já venceu → manter ligação gerência-a-gerência ativa. Qualquer contraproposta serve se o Ciclo 1 começar até ~18/08.",
  "monitor": "Nó 1: grade devolvida = verde. Cada dia sem resposta consome a folga de 26/08–04/09.",
  "ferramenta": "Gerência + gatilho Nó 1"
 },
 {
  "id": "CAN-03",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Comunicação",
  "atividade": "Apresentação do plano, dos objetivos das oficinas, do cronograma e das expectativas na reunião de equipe da Inovação",
  "resp": "Gerência",
  "responsavel_id": ["gerencia"],
  "prazo": "10/08",
  "prazo_iso": "2026-08-10",
  "status": "Não iniciado",
  "dep": [
   "CAN-02"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Gerência apresenta plano, objetivos das oficinas e cronograma na reunião de equipe de 10/08 (mesma agenda do CMT-03).",
  "monitor": "Apresentação realizada; presença dos coordenadores registrada.",
  "ferramenta": "Reunião de equipe + painel"
 },
 {
  "id": "CAN-04",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Comunicação",
  "atividade": "Divulgação do calendário aprovado, convites de agenda e material prévio por canal",
  "resp": "Sandra",
  "responsavel_id": ["sandra"],
  "prazo": "11/08",
  "prazo_iso": "2026-08-11",
  "status": "Não iniciado",
  "dep": [
   "CAN-02"
  ],
  "cc": {
   "tipo": "no",
   "no": 5
  },
  "como": "Com a grade validada, Sandra dispara calendário + convites de agenda + materiais em até 24h (meta 11/08, limite 13/08).",
  "monitor": "Convites aceitos por canal ≥ mínimo definido; página agenda do painel preenchida.",
  "ferramenta": "Outlook + painel (agenda)"
 },
 {
  "id": "CAN-05",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Governança",
  "atividade": "Indicação dos representantes dos projetos nas oficinas",
  "resp": "Comitê",
  "responsavel_id": ["comite"],
  "prazo": "07/08",
  "prazo_iso": "2026-08-07",
  "status": "Não iniciado",
  "dep": [
   "CAN-02"
  ],
  "cc": {
   "tipo": "no",
   "no": 2
  },
  "como": "Cada núcleo indica representante até 07/08; sem indicação, vale o fallback aprovado: o gestor da iniciativa é o representante.",
  "monitor": "5/5 núcleos com nome na página participantes (pendências ficam vermelhas).",
  "ferramenta": "Rito do Comitê + painel (participantes)"
 },
 {
  "id": "CAN-06",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Logística e Infraestrutura",
  "atividade": "Reserva dos locais para as oficinas presenciais",
  "resp": "Sandra",
  "responsavel_id": ["sandra"],
  "prazo": "07/08",
  "prazo_iso": "2026-08-07",
  "status": "Em andamento",
  "dep": [
   "CAN-02"
  ],
  "cc": {
   "tipo": "no",
   "no": 2
  },
  "como": "Sandra reserva salas para todos os encontros; sala indisponível → canal migra para online (DXP, 2h, é candidato natural — pré-acordar com a URC).",
  "monitor": "Encontros com local definido na agenda do painel; pendências visíveis.",
  "ferramenta": "Reserva de salas + painel (agenda)"
 },
 {
  "id": "CAN-07",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Logística e Infraestrutura",
  "atividade": "Criação do repositório de conteúdos para a IA apoiar o preenchimento do formulário de demandas",
  "resp": "Sandra",
  "responsavel_id": ["sandra"],
  "prazo": "11/08",
  "prazo_iso": "2026-08-11",
  "status": "Não iniciado",
  "dep": [],
  "cc": {
   "tipo": null
  },
  "como": "Montar repositório por canal (materiais da URC + fichas das iniciativas + Diretrizes v1.2) para alimentar o agente de IA.",
  "monitor": "Repositório com estrutura mínima por canal até 11/08.",
  "ferramenta": "SharePoint/Drive + link no painel"
 },
 {
  "id": "CAN-08",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Logística e Infraestrutura",
  "atividade": "Criação do agente de IA de apoio ao preenchimento do formulário de demandas da URC",
  "resp": "JR. e Pova",
  "responsavel_id": ["jr","pova"],
  "prazo": "12/08",
  "prazo_iso": "2026-08-12",
  "status": "Em andamento",
  "dep": [
   "CAN-07"
  ],
  "cc": {
   "tipo": null
  },
  "como": "JR. e Pova desenvolvem o agente de apoio ao preenchimento do formulário URC usando o repositório do CAN-07.",
  "monitor": "Agente responde às perguntas do formulário com dados de 1 iniciativa de teste.",
  "ferramenta": "Agente IA (Pova)"
 },
 {
  "id": "CAN-09",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Logística e Infraestrutura",
  "atividade": "Piloto interno do agente de IA com 1–2 iniciativas",
  "resp": "JR. e Pova",
  "responsavel_id": ["jr","pova"],
  "prazo": "14/08",
  "prazo_iso": "2026-08-14",
  "status": "Não iniciado",
  "dep": [
   "CAN-08"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Piloto com 1–2 iniciativas em 14/08. O agente está FORA do caminho crítico: o plano B (formulário estático) cobre o Ciclo 1.",
  "monitor": "Piloto rodado e ajustes listados; decisão go/no-go para uso no Ciclo 1.",
  "ferramenta": "Agente IA + formulário plano B"
 },
 {
  "id": "CAN-10",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Governança",
  "atividade": "Entrega dos formulários de demanda em até 5 dias úteis após cada oficina, com controle de entrega por iniciativa",
  "resp": "Gestores e IA",
  "responsavel_id": ["gestores","pova"],
  "prazo": "contínuo · C1 até 01/09 · C2 até 30/09",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [
   "CAN-04"
  ],
  "cc": {
   "tipo": "no",
   "no": 5
  },
  "como": "Cada projeto entrega o formulário (ou justificativa de não adoção) em até 5 d.u. após cada oficina. C1 até 01/09, C2 até 30/09.",
  "monitor": "Matriz de demandas do painel: célula muda de 'oficina' para 'formulário' dentro do prazo; checkpoint 19/08 (5 de 8 canais rodados).",
  "ferramenta": "Formulário URC + matriz do painel"
 },
 {
  "id": "CAN-11",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Monitoramento",
  "atividade": "Monitoramento de confirmação de presença, alimentação do repositório e cumprimento dos prazos dos formulários",
  "resp": "Sandra",
  "responsavel_id": ["sandra"],
  "prazo": "contínuo (ago–set)",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [],
  "cc": {
   "tipo": null
  },
  "como": "Sandra monitora confirmações de presença, alimenta o repositório e cobra pendências semanalmente (rotina fixa, ex.: sexta 10h).",
  "monitor": "Página agenda com % de confirmação por encontro; pendências nominais no boletim.",
  "ferramenta": "Painel (agenda) + boletim CG-01"
 },
 {
  "id": "CAN-12",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Governança",
  "atividade": "Definição dos critérios de priorização das demandas",
  "resp": "Comitê",
  "responsavel_id": ["comite"],
  "prazo": "21/08",
  "prazo_iso": "2026-08-21",
  "status": "Não iniciado",
  "dep": [],
  "cc": {
   "tipo": "cadeia",
   "no": 7
  },
  "como": "Comitê define critérios de priorização até 21/08; fallback barato: primeira pauta do Comitê após o início do ciclo.",
  "monitor": "Documento de critérios (1 página) aprovado em ata; sem ele, Nó 7 fica âmbar.",
  "ferramenta": "Rito do Comitê + docs/ no repo"
 },
 {
  "id": "CAN-13",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Governança",
  "atividade": "Priorização e encaminhamento das demandas do Ciclo 1 à URC",
  "resp": "Comitê",
  "responsavel_id": ["comite"],
  "prazo": "11/09",
  "prazo_iso": "2026-09-11",
  "status": "Não iniciado",
  "dep": [
   "CAN-10",
   "CAN-12"
  ],
  "cc": {
   "tipo": "no",
   "no": 7
  },
  "como": "Aplicar os critérios às demandas do Ciclo 1 e encaminhar lote priorizado à URC em 11/09 (Nó 7).",
  "monitor": "Lote enviado com nº de demandas por canal; células da matriz mudam para 'priorizado'.",
  "ferramenta": "Comitê + matriz do painel"
 },
 {
  "id": "CAN-14",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Governança",
  "atividade": "Priorização e encaminhamento das demandas do Ciclo 2 à URC",
  "resp": "Comitê",
  "responsavel_id": ["comite"],
  "prazo": "09/10",
  "prazo_iso": "2026-10-09",
  "status": "Não iniciado",
  "dep": [
   "CAN-10",
   "CAN-12"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Mesmo rito para o Ciclo 2, encaminhando até 09/10.",
  "monitor": "Lote 2 enviado; matriz atualizada.",
  "ferramenta": "Comitê + matriz do painel"
 },
 {
  "id": "CAN-15",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Metodologia",
  "atividade": "Consolidação das devolutivas por canal e do diagnóstico de adoção (potencial visto × não visto; lacuna de entendimento × oportunidade de melhoria do canal)",
  "resp": "JR. e Comitê",
  "responsavel_id": ["jr","comite"],
  "prazo": "16/10",
  "prazo_iso": "2026-10-16",
  "status": "Não iniciado",
  "dep": [
   "CAN-13",
   "CAN-14"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Consolidar devolutivas por canal + diagnóstico de aderência (adotado · em adoção · não adotado com justificativa) — insumo direto do RD/Adequação.",
  "monitor": "Relatório de aderência por canal publicado em 16/10.",
  "ferramenta": "Painel (matriz) + relatório"
 },
 {
  "id": "CAN-16",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Comunicação",
  "atividade": "Comunicação para os Estados quanto às demandas",
  "resp": "Gerência",
  "responsavel_id": ["gerencia"],
  "prazo": "out",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [
   "CAN-13",
   "CAN-14"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Gerência comunica aos Estados as demandas priorizadas e o que muda para as UFs.",
  "monitor": "Comunicado enviado em out; registrado no painel.",
  "ferramenta": "Canal institucional NA→UF"
 },
 {
  "id": "CAN-17",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Implantação",
  "atividade": "Cronograma de entrega das demandas da Inovação",
  "resp": "URC",
  "responsavel_id": ["urc"],
  "prazo": "out",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [
   "CAN-13",
   "CAN-14"
  ],
  "cc": {
   "tipo": "sla"
  },
  "como": "Negociar o SLA na própria devolutiva do Nó 1: URC devolve cronograma em até 10 d.u. após cada lote priorizado.",
  "monitor": "Cronograma da URC anexado; sem SLA, a linha fica âmbar permanente no painel.",
  "ferramenta": "Acordo URC (SLA) + painel"
 },
 {
  "id": "CAN-18",
  "frente": "3. Adoção aos Canais de Relacionamento",
  "sub": "Implantação",
  "atividade": "Monitoramento das entregas da URC e das pendências da UI",
  "resp": "Sandra",
  "responsavel_id": ["sandra"],
  "prazo": "contínuo (out–nov)",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [
   "CAN-17"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Sandra acompanha entregas da URC × pendências da UI em rotina quinzenal, alimentando a matriz (célula 'encaminhado').",
  "monitor": "Matriz com datas de entrega; desvios sobem para o Comitê.",
  "ferramenta": "Painel (matriz) + rito do Comitê"
 },
 {
  "id": "PTF-01",
  "frente": "4. Portfólio de Soluções",
  "sub": "Governança",
  "atividade": "Solicitação de 4 oficinas à unidade de Soluções (uma por núcleo com interação com o público final)",
  "resp": "JR./Gerência",
  "responsavel_id": ["jr","gerencia"],
  "prazo": "14/08",
  "prazo_iso": "2026-08-14",
  "status": "Não iniciado",
  "dep": [
   "CAN-02"
  ],
  "cc": {
   "tipo": "sla"
  },
  "como": "Enviar em 14/08 o pedido das 4 oficinas à Soluções já completo: proposta de formato junto (PTF-02) e datas sugeridas 28/09–09/10 (fora do fim do Ciclo 2).",
  "monitor": "Pedido protocolado em 14/08; resposta da Soluções com datas = SLA ok.",
  "ferramenta": "Ofício + painel (caminho crítico)"
 },
 {
  "id": "PTF-02",
  "frente": "4. Portfólio de Soluções",
  "sub": "Metodologia",
  "atividade": "Elaboração da proposta de formato das oficinas de Soluções (espelho do modelo URC — EAD, nacionalização, CSN)",
  "resp": "JR.",
  "responsavel_id": ["jr"],
  "prazo": "14/08",
  "prazo_iso": "2026-08-14",
  "status": "Não iniciado",
  "dep": [
   "PTF-01"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Elaborar a proposta de formato (espelhando a estrutura URC: apresentação + oficina + devolutiva macro) para anexar ao PTF-01.",
  "monitor": "Documento de formato anexado ao pedido de 14/08.",
  "ferramenta": "Documento (docs/) + ofício"
 },
 {
  "id": "PTF-03",
  "frente": "4. Portfólio de Soluções",
  "sub": "Comunicação",
  "atividade": "Apresentação do plano das oficinas de Soluções na reunião de equipe da Inovação",
  "resp": "JR./Gerência",
  "responsavel_id": ["jr","gerencia"],
  "prazo": "reunião de equipe de setembro",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [
   "PTF-02"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Apresentar o plano das oficinas de Soluções na reunião de equipe de setembro.",
  "monitor": "Apresentação realizada; registrada no painel.",
  "ferramenta": "Reunião de equipe"
 },
 {
  "id": "PTF-04",
  "frente": "4. Portfólio de Soluções",
  "sub": "Governança",
  "atividade": "Indicação dos representantes dos projetos nas oficinas",
  "resp": "Comitê",
  "responsavel_id": ["comite"],
  "prazo": "set",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [
   "PTF-01"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Comitê indica representantes (aproveitar a mesma lógica e nomes do CAN-05 quando fizer sentido).",
  "monitor": "Indicações completas na página participantes.",
  "ferramenta": "Rito do Comitê + painel"
 },
 {
  "id": "PTF-05",
  "frente": "4. Portfólio de Soluções",
  "sub": "Logística e Infraestrutura",
  "atividade": "Reserva dos locais para as oficinas presenciais",
  "resp": "Sandra",
  "responsavel_id": ["sandra"],
  "prazo": "set",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [
   "PTF-01"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Sandra reserva locais assim que a Soluções confirmar as datas.",
  "monitor": "Locais definidos na agenda do painel.",
  "ferramenta": "Reserva de salas + painel"
 },
 {
  "id": "PTF-06",
  "frente": "4. Portfólio de Soluções",
  "sub": "Governança",
  "atividade": "Formulários de demanda para criação/ajuste das soluções da Inovação",
  "resp": "Gestores e IA",
  "responsavel_id": ["gestores","pova"],
  "prazo": "5 dias úteis após cada oficina",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [
   "PTF-02"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Formulários de criação/ajuste de soluções entregues em até 5 d.u. após cada oficina (mesma régua do CAN-10).",
  "monitor": "Controle por núcleo no painel; pendências no boletim.",
  "ferramenta": "Formulário Soluções + painel"
 },
 {
  "id": "PTF-07",
  "frente": "4. Portfólio de Soluções",
  "sub": "Governança",
  "atividade": "Priorização e encaminhamento das demandas de soluções pelo Comitê",
  "resp": "Comitê",
  "responsavel_id": ["comite"],
  "prazo": "out",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [
   "PTF-06"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Comitê prioriza e encaminha as demandas de soluções em outubro, com os critérios do CAN-12 adaptados.",
  "monitor": "Lote encaminhado; registrado no painel.",
  "ferramenta": "Comitê"
 },
 {
  "id": "PTF-08",
  "frente": "4. Portfólio de Soluções",
  "sub": "Comunicação",
  "atividade": "Comunicação para os Estados quanto às demandas",
  "resp": "Gerência",
  "responsavel_id": ["gerencia"],
  "prazo": "out–nov",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [
   "PTF-07"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Gerência comunica aos Estados as demandas de portfólio.",
  "monitor": "Comunicado enviado out–nov.",
  "ferramenta": "Canal institucional NA→UF"
 },
 {
  "id": "PTF-09",
  "frente": "4. Portfólio de Soluções",
  "sub": "Implantação",
  "atividade": "Cronograma de entrega das demandas da Inovação",
  "resp": "Soluções",
  "responsavel_id": ["solucoes"],
  "prazo": "out–nov",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [
   "PTF-07"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Receber da Soluções o cronograma de entrega (SLA espelho do CAN-17).",
  "monitor": "Cronograma anexado; sem ele, âmbar no painel.",
  "ferramenta": "Acordo Soluções (SLA)"
 },
 {
  "id": "PTF-10",
  "frente": "4. Portfólio de Soluções",
  "sub": "Implantação",
  "atividade": "Monitoramento das entregas de Soluções e das pendências da UI",
  "resp": "Sandra",
  "responsavel_id": ["sandra"],
  "prazo": "contínuo",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [
   "PTF-09"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Sandra monitora entregas de Soluções × pendências da UI, rotina quinzenal.",
  "monitor": "Status por demanda no painel; desvios ao Comitê.",
  "ferramenta": "Painel + rito do Comitê"
 },
 {
  "id": "CG-01",
  "frente": "5. Comunicação e Gestão",
  "sub": "Monitoramento",
  "atividade": "Boletim mensal com o andamento das ações: instrumentos, adoção dos canais, portfólio e principais entregas",
  "resp": "Sandra",
  "responsavel_id": ["sandra"],
  "prazo": "1ª edição 31/08 · depois mensal",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [],
  "cc": {
   "tipo": null
  },
  "como": "Boletim mensal de 1 página: nós, entregas do mês, pendências nominais, próximos marcos. 1ª edição 31/08. Fonte: este painel (imprimir/exportar).",
  "monitor": "Boletim enviado todo fim de mês; taxa de abertura se via Marketing Cloud.",
  "ferramenta": "Painel + Marketing Cloud"
 },
 {
  "id": "CG-02",
  "frente": "5. Comunicação e Gestão",
  "sub": "Comunicação",
  "atividade": "Atualização do status do projeto em todas as reuniões de equipe",
  "resp": "Sandra",
  "responsavel_id": ["sandra"],
  "prazo": "contínuo",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [],
  "cc": {
   "tipo": null
  },
  "como": "Sandra atualiza o status do projeto em toda reunião de equipe usando o dashboard do painel projetado.",
  "monitor": "Item fixo de pauta cumprido; registrado em ata.",
  "ferramenta": "Painel (dashboard)"
 },
 {
  "id": "CG-03",
  "frente": "5. Comunicação e Gestão",
  "sub": "Monitoramento",
  "atividade": "Página web de monitoramento do plano de ação (projeto Vercel, página informativa)",
  "resp": "JR. e IA",
  "responsavel_id": ["jr","pova"],
  "prazo": "14/08",
  "prazo_iso": "2026-08-14",
  "status": "Não iniciado",
  "dep": [],
  "cc": {
   "tipo": null
  },
  "como": "Este projeto: publicar o painel no Vercel via repositório Git (deploy automático a cada commit) até 14/08.",
  "monitor": "URL pública ativa; versão e data de atualização no rodapé de todas as páginas.",
  "ferramenta": "Vercel + Git"
 },
 {
  "id": "CG-04",
  "frente": "5. Comunicação e Gestão",
  "sub": "Governança",
  "atividade": "Retrospectiva e lições aprendidas ao final do Ciclo 2",
  "resp": "Comitê",
  "responsavel_id": ["comite"],
  "prazo": "out",
  "prazo_iso": null,
  "status": "Não iniciado",
  "dep": [
   "CAN-15"
  ],
  "cc": {
   "tipo": null
  },
  "como": "Retrospectiva ao final do Ciclo 2: o que protegeu os nós, o que consumiu folga, o que muda para 2027.",
  "monitor": "Documento de lições aprendidas versionado no repo (docs/).",
  "ferramenta": "docs/retrospectiva.md"
 }
];
