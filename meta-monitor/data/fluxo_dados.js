/* Snapshot estático de fluxo_dados_* (Supabase) — SEED + fallback de fluxo-dados.html e da aba
 * "Fluxo de dados" do editor.html, no mesmo padrão dos outros data/*.js: a página lê do
 * Supabase primeiro (js/db-fluxo.js) e só cai aqui se a rede/tabela falhar. As 3 views
 * (matriz, rotas_lacunas, paineis_prontidao) vão junto, já calculadas, porque offline não há
 * quem as calcule. Gerado em 2026-10-16 a partir de leitura com a anon key; para atualizar,
 * regerar a partir do banco (não editar à mão). */
window.DB = window.DB || {};
window.DB.fluxo_dados = {
 "gerado_em": "2026-10-16",
 "fonte": "Supabase wdygbfrmewlaffjsfyoi (leitura anon)",
 "sistemas": [
  {
   "id": "4f653b35-a99d-4e7f-bb95-01e2a16fa4b2",
   "slug": "foco",
   "nome": "Foco (Salesforce)",
   "tipo": "crm",
   "mantenedor": "Sebrae Nacional",
   "observacao": "Destino institucional. Golden record da identidade do cliente.",
   "ativo": true,
   "criado_em": "2026-10-16T14:25:48.583042+00:00",
   "atualizado_em": "2026-10-16T14:25:48.583042+00:00"
  },
  {
   "id": "dcd9a2f3-9d98-487a-a7da-a2b746502358",
   "slug": "planilhao",
   "nome": "Planilhão",
   "tipo": "planilha",
   "mantenedor": null,
   "observacao": "Fonte do panorama hoje.",
   "ativo": true,
   "criado_em": "2026-10-16T14:25:48.583042+00:00",
   "atualizado_em": "2026-10-16T14:25:48.583042+00:00"
  },
  {
   "id": "0694a167-20b6-4747-ab97-1cfe78b95dbe",
   "slug": "planilhas_avulsas",
   "nome": "Planilhas avulsas das iniciativas",
   "tipo": "planilha",
   "mantenedor": null,
   "observacao": null,
   "ativo": true,
   "criado_em": "2026-10-16T14:25:48.583042+00:00",
   "atualizado_em": "2026-10-16T14:25:48.583042+00:00"
  },
  {
   "id": "6a4b5c3a-1d9b-47ef-ad28-110f6e3587d8",
   "slug": "plataforma_premio",
   "nome": "Plataforma do Prêmio",
   "tipo": "plataforma",
   "mantenedor": "Empresa terceirizada (nome a confirmar)",
   "observacao": "Sistema específico do Prêmio, cuidado por uma empresa externa.",
   "ativo": true,
   "criado_em": "2026-10-16T14:25:48.583042+00:00",
   "atualizado_em": "2026-10-16T14:25:48.583042+00:00"
  },
  {
   "id": "5e5b3ad3-67be-4784-a712-19fa42d6fc4e",
   "slug": "power_bi",
   "nome": "Power BI",
   "tipo": "bi",
   "mantenedor": null,
   "observacao": null,
   "ativo": true,
   "criado_em": "2026-10-16T14:25:48.583042+00:00",
   "atualizado_em": "2026-10-16T14:25:48.583042+00:00"
  },
  {
   "id": "f8fc1a6b-ab02-4346-8bc5-56d7d9500289",
   "slug": "banco_utic",
   "nome": "Banco de dados UTIC",
   "tipo": "banco",
   "mantenedor": "UTIC",
   "observacao": null,
   "ativo": true,
   "criado_em": "2026-10-16T14:25:48.583042+00:00",
   "atualizado_em": "2026-10-16T14:25:48.583042+00:00"
  },
  {
   "id": "6b6df104-07cf-4ba5-a4e9-781bec9d5af1",
   "slug": "dw",
   "nome": "DW",
   "tipo": "dw",
   "mantenedor": null,
   "observacao": null,
   "ativo": true,
   "criado_em": "2026-10-16T14:25:48.583042+00:00",
   "atualizado_em": "2026-10-16T14:25:48.583042+00:00"
  }
 ],
 "rotas": [
  {
   "id": "42d89ce1-6779-4f3d-822e-4ed8a048ee2f",
   "iniciativa": "Prêmio Startups",
   "tipo_dado": "cliente",
   "descricao": "Cadastro das empresas participantes",
   "sistema_origem_id": "6a4b5c3a-1d9b-47ef-ad28-110f6e3587d8",
   "quem_envia_hoje": "Plataforma do Prêmio (envia o cadastro ao Foco)",
   "quem_deveria_enviar": null,
   "sistema_destino_hoje_id": "4f653b35-a99d-4e7f-bb95-01e2a16fa4b2",
   "sistema_destino_alvo_id": "4f653b35-a99d-4e7f-bb95-01e2a16fa4b2",
   "mecanismo_hoje": "a_definir",
   "mecanismo_alvo": "a_definir",
   "frequencia": null,
   "chega_completo": "parcial",
   "perda": "Colocação e edições posteriores não chegam ao Foco. Chega só o que a plataforma envia, como de qualquer outra startup.",
   "existe_outra_fonte": "nao_sabe",
   "risco_divergencia": "Pergunta aberta: algum dado de cliente do Prêmio pode ser atualizado no sistema da empresa terceirizada e não chegar à plataforma do Prêmio?",
   "identificacao_no_foco": "A confirmar: campanha, membro de campanha e grupo de clientes.",
   "golden_hoje_id": "6a4b5c3a-1d9b-47ef-ad28-110f6e3587d8",
   "golden_alvo_id": "4f653b35-a99d-4e7f-bb95-01e2a16fa4b2",
   "status": "entendimento",
   "validado_com": null,
   "validado_em": null,
   "observacao": "Perguntas abertas: como se identifica, na plataforma, quem é do Prêmio? O que a empresa terceirizada controla dentro da plataforma?",
   "ativo": true,
   "criado_em": "2026-10-16T14:25:48.583042+00:00",
   "atualizado_em": "2026-10-16T14:25:48.583042+00:00",
   "outras_fontes": []
  },
  {
   "id": "40483e2b-8cf1-4e35-b773-bfccb5d525c9",
   "iniciativa": "Prêmio Startups",
   "tipo_dado": "atendimento",
   "descricao": "Participação e interações no Prêmio",
   "sistema_origem_id": "6a4b5c3a-1d9b-47ef-ad28-110f6e3587d8",
   "quem_envia_hoje": null,
   "quem_deveria_enviar": null,
   "sistema_destino_hoje_id": null,
   "sistema_destino_alvo_id": "4f653b35-a99d-4e7f-bb95-01e2a16fa4b2",
   "mecanismo_hoje": "nenhum",
   "mecanismo_alvo": "a_definir",
   "frequencia": null,
   "chega_completo": "nao",
   "perda": "Segundo a planilha, o dado de atendimento do Prêmio não está no Foco.",
   "existe_outra_fonte": "nao_sabe",
   "risco_divergencia": null,
   "identificacao_no_foco": null,
   "golden_hoje_id": "6a4b5c3a-1d9b-47ef-ad28-110f6e3587d8",
   "golden_alvo_id": "4f653b35-a99d-4e7f-bb95-01e2a16fa4b2",
   "status": "entendimento",
   "validado_com": null,
   "validado_em": null,
   "observacao": "Motivo do alvo: cruzar a participação no Prêmio com a de outras iniciativas. Participantes de 2025 e 2026 hoje são consultados no ambiente da plataforma. O panorama é lido do planilhão.",
   "ativo": true,
   "criado_em": "2026-10-16T14:25:48.583042+00:00",
   "atualizado_em": "2026-10-16T14:25:48.583042+00:00",
   "outras_fontes": []
  }
 ],
 "rota_destinos": [
  {
   "rota_id": "42d89ce1-6779-4f3d-822e-4ed8a048ee2f",
   "sistema_id": "4f653b35-a99d-4e7f-bb95-01e2a16fa4b2",
   "momento": "hoje",
   "criado_em": "2026-10-16T14:25:48.583042+00:00"
  },
  {
   "rota_id": "42d89ce1-6779-4f3d-822e-4ed8a048ee2f",
   "sistema_id": "4f653b35-a99d-4e7f-bb95-01e2a16fa4b2",
   "momento": "alvo",
   "criado_em": "2026-10-16T14:25:48.583042+00:00"
  },
  {
   "rota_id": "40483e2b-8cf1-4e35-b773-bfccb5d525c9",
   "sistema_id": "4f653b35-a99d-4e7f-bb95-01e2a16fa4b2",
   "momento": "alvo",
   "criado_em": "2026-10-16T14:25:48.583042+00:00"
  }
 ],
 "paineis": [
  {
   "id": "2f27cda7-10d7-4179-98ec-a4a6959d26c9",
   "nome": "Panorama de participantes do Prêmio",
   "iniciativa": "Prêmio Startups",
   "sistema_fonte_hoje_id": "dcd9a2f3-9d98-487a-a7da-a2b746502358",
   "sistema_fonte_alvo_id": "4f653b35-a99d-4e7f-bb95-01e2a16fa4b2",
   "responsavel": null,
   "status": "entendimento",
   "observacao": "Hoje o número é buscado no ambiente da plataforma. Panorama usa o planilhão como fonte.",
   "ativo": true,
   "criado_em": "2026-10-16T14:25:48.583042+00:00",
   "atualizado_em": "2026-10-16T14:25:48.583042+00:00",
   "link_painel": null
  }
 ],
 "painel_rotas": [
  {
   "painel_id": "2f27cda7-10d7-4179-98ec-a4a6959d26c9",
   "rota_id": "42d89ce1-6779-4f3d-822e-4ed8a048ee2f",
   "criado_em": "2026-10-16T14:25:48.583042+00:00"
  },
  {
   "painel_id": "2f27cda7-10d7-4179-98ec-a4a6959d26c9",
   "rota_id": "40483e2b-8cf1-4e35-b773-bfccb5d525c9",
   "criado_em": "2026-10-16T14:25:48.583042+00:00"
  }
 ],
 "encaminhamentos": [
  {
   "id": "db04c889-aa68-487f-bb82-e64c0aee5ada",
   "rota_id": "42d89ce1-6779-4f3d-822e-4ed8a048ee2f",
   "painel_id": "2f27cda7-10d7-4179-98ec-a4a6959d26c9",
   "acao": "Enviar os dados do Prêmio de 2025",
   "responsavel": "Bernardo",
   "prazo": null,
   "status": "a_fazer",
   "depende_de_id": null,
   "observacao": null,
   "concluido_em": null,
   "ativo": true,
   "criado_em": "2026-10-16T14:25:48.583042+00:00",
   "atualizado_em": "2026-10-16T14:25:48.583042+00:00"
  },
  {
   "id": "8c51ba14-7724-4fc0-8da1-3ebf1a5ef82d",
   "rota_id": "42d89ce1-6779-4f3d-822e-4ed8a048ee2f",
   "painel_id": "2f27cda7-10d7-4179-98ec-a4a6959d26c9",
   "acao": "Importar os dados do Prêmio de 2025 para o Foco",
   "responsavel": "José (JR)",
   "prazo": null,
   "status": "a_fazer",
   "depende_de_id": "db04c889-aa68-487f-bb82-e64c0aee5ada",
   "observacao": null,
   "concluido_em": null,
   "ativo": true,
   "criado_em": "2026-10-16T14:25:48.583042+00:00",
   "atualizado_em": "2026-10-16T14:25:48.583042+00:00"
  },
  {
   "id": "8dc7d69f-5dda-456a-8119-c28611cd6cff",
   "rota_id": "42d89ce1-6779-4f3d-822e-4ed8a048ee2f",
   "painel_id": "2f27cda7-10d7-4179-98ec-a4a6959d26c9",
   "acao": "Apresentar o resultado do piloto de importação",
   "responsavel": "José (JR)",
   "prazo": null,
   "status": "a_fazer",
   "depende_de_id": "8c51ba14-7724-4fc0-8da1-3ebf1a5ef82d",
   "observacao": null,
   "concluido_em": null,
   "ativo": true,
   "criado_em": "2026-10-16T14:25:48.583042+00:00",
   "atualizado_em": "2026-10-16T14:25:48.583042+00:00"
  },
  {
   "id": "7d412a8c-bf71-46da-bcda-a94e43cc6640",
   "rota_id": "42d89ce1-6779-4f3d-822e-4ed8a048ee2f",
   "painel_id": "2f27cda7-10d7-4179-98ec-a4a6959d26c9",
   "acao": "Analisar a composição dos dados de contato",
   "responsavel": "José (JR)",
   "prazo": null,
   "status": "a_fazer",
   "depende_de_id": "8c51ba14-7724-4fc0-8da1-3ebf1a5ef82d",
   "observacao": null,
   "concluido_em": null,
   "ativo": true,
   "criado_em": "2026-10-16T14:25:48.583042+00:00",
   "atualizado_em": "2026-10-16T14:25:48.583042+00:00"
  },
  {
   "id": "95dae118-dc74-42e8-b204-e82a315af157",
   "rota_id": "42d89ce1-6779-4f3d-822e-4ed8a048ee2f",
   "painel_id": "2f27cda7-10d7-4179-98ec-a4a6959d26c9",
   "acao": "Verificar se o que está no planilhão já existe no Foco (membro de campanha e grupo de clientes)",
   "responsavel": null,
   "prazo": null,
   "status": "a_fazer",
   "depende_de_id": null,
   "observacao": null,
   "concluido_em": null,
   "ativo": true,
   "criado_em": "2026-10-16T14:25:48.583042+00:00",
   "atualizado_em": "2026-10-16T14:25:48.583042+00:00"
  }
 ],
 "matriz": [
  {
   "iniciativa": "Prêmio Startups",
   "camada": "cliente",
   "qtd": 1,
   "status_pior": "entendimento"
  },
  {
   "iniciativa": "Prêmio Startups",
   "camada": "painel",
   "qtd": 1,
   "status_pior": "entendimento"
  },
  {
   "iniciativa": "Prêmio Startups",
   "camada": "atendimento",
   "qtd": 1,
   "status_pior": "entendimento"
  }
 ],
 "rotas_lacunas": [
  {
   "id": "40483e2b-8cf1-4e35-b773-bfccb5d525c9",
   "iniciativa": "Prêmio Startups",
   "tipo_dado": "atendimento",
   "descricao": "Participação e interações no Prêmio",
   "origem": "Plataforma do Prêmio",
   "destino_hoje": null,
   "destino_alvo": "Foco (Salesforce)",
   "golden_hoje": "Plataforma do Prêmio",
   "golden_alvo": "Foco (Salesforce)",
   "quem_envia_hoje": null,
   "quem_deveria_enviar": null,
   "mecanismo_hoje": "nenhum",
   "mecanismo_alvo": "a_definir",
   "chega_completo": "nao",
   "status": "entendimento",
   "alvo_definido": false,
   "lacuna_destino": true,
   "lacuna_golden": true,
   "lacuna_mecanismo": true,
   "lacuna_remetente": true
  },
  {
   "id": "42d89ce1-6779-4f3d-822e-4ed8a048ee2f",
   "iniciativa": "Prêmio Startups",
   "tipo_dado": "cliente",
   "descricao": "Cadastro das empresas participantes",
   "origem": "Plataforma do Prêmio",
   "destino_hoje": "Foco (Salesforce)",
   "destino_alvo": "Foco (Salesforce)",
   "golden_hoje": "Plataforma do Prêmio",
   "golden_alvo": "Foco (Salesforce)",
   "quem_envia_hoje": "Plataforma do Prêmio (envia o cadastro ao Foco)",
   "quem_deveria_enviar": null,
   "mecanismo_hoje": "a_definir",
   "mecanismo_alvo": "a_definir",
   "chega_completo": "parcial",
   "status": "entendimento",
   "alvo_definido": false,
   "lacuna_destino": false,
   "lacuna_golden": true,
   "lacuna_mecanismo": true,
   "lacuna_remetente": true
  }
 ],
 "paineis_prontidao": [
  {
   "id": "2f27cda7-10d7-4179-98ec-a4a6959d26c9",
   "nome": "Panorama de participantes do Prêmio",
   "iniciativa": "Prêmio Startups",
   "fonte_hoje": "Planilhão",
   "fonte_alvo": "Foco (Salesforce)",
   "status": "entendimento",
   "rotas_ligadas": 2,
   "rotas_ok": 0,
   "rotas_pendentes": 2,
   "pronto_para_reapontar": false
  }
 ]
};
