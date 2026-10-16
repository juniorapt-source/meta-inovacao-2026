-- =====================================================================
-- 2026-10_fluxo_dados.sql
-- Projeto Corso: arquitetura de fluxo de dados (reapontamento dos
-- painéis para o Foco).
--
-- Execução: colar inteiro no Supabase SQL Editor (a anon key não roda DDL).
-- Pode rodar mais de uma vez: tudo é idempotente.
--
-- Camadas:
--   1. fluxo_dados_sistemas          onde o dado pode viver (nós)
--   2. fluxo_dados_rotas             como o dado nasce e viaja (arestas)
--   3. fluxo_dados_paineis           de onde cada número é lido
--      fluxo_dados_painel_rotas      quais rotas alimentam cada painel
--   4. fluxo_dados_encaminhamentos   o que falta fazer (tabela irmã da
--                                    plano_acao_atividades)
--   + 3 views de leitura (matriz, rotas com lacunas, prontidão dos painéis)
--
-- Padrão seguido: PADRAO_TABELA (RLS + GRANT explícito para anon e
-- authenticated). Sem DELETE nas tabelas principais: desativar com
-- ativo = false.
-- ATENÇÃO: as policies criadas aqui são ABERTAS (sem x-cc-token). O
-- 2026-10_fluxo_dados_patch2.sql as substitui pelo padrão do repo e é
-- obrigatório. Ordem: este arquivo, patch1, patch2.
--
-- Dois pontos que dependem do que já existe no repo (não consegui ler
-- aqui): (a) a auditoria, bloco opcional no fim; (b) o nome exato dos
-- status em corsario_status. Aqui usei: entendimento, a_iniciar,
-- andamento, ok, nao_se_aplica.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Função de updated_at (própria deste módulo, não mexe nas outras)
-- ---------------------------------------------------------------------
create or replace function fluxo_dados_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. SISTEMAS: onde o dado pode viver
-- ---------------------------------------------------------------------
create table if not exists fluxo_dados_sistemas (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null unique,
  nome           text not null,
  tipo           text not null
                 check (tipo in ('crm','plataforma','planilha','bi','banco','dw','outro')),
  mantenedor     text,            -- quem cuida do sistema (área ou empresa)
  observacao     text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 2. ROTAS: uma linha por iniciativa x tipo de dado
--    cliente   = identidade (CNPJ, contato)
--    atendimento = interação registrada com o cliente
--    processo  = dado da própria iniciativa (colocação, nota, fase)
-- ---------------------------------------------------------------------
create table if not exists fluxo_dados_rotas (
  id                      uuid primary key default gen_random_uuid(),
  iniciativa              text not null,   -- mesmo nome usado nas outras tabelas do Corso
  tipo_dado               text not null
                          check (tipo_dado in ('cliente','atendimento','processo')),
  descricao               text not null,   -- nome curto da rota

  -- onde nasce e quem manda
  sistema_origem_id       uuid references fluxo_dados_sistemas(id),
  quem_envia_hoje         text,
  quem_deveria_enviar     text,

  -- para onde vai
  sistema_destino_hoje_id uuid references fluxo_dados_sistemas(id),
  sistema_destino_alvo_id uuid references fluxo_dados_sistemas(id),
  mecanismo_hoje          text not null default 'a_definir'
                          check (mecanismo_hoje in ('nenhum','manual','planilha','importacao','integracao','a_definir')),
  mecanismo_alvo          text not null default 'a_definir'
                          check (mecanismo_alvo in ('nenhum','manual','planilha','importacao','integracao','a_definir')),
  frequencia              text,            -- ex.: diária, por edição, sob demanda

  -- qualidade do caminho
  chega_completo          text not null default 'nao_sabe'
                          check (chega_completo in ('sim','parcial','nao','nao_sabe')),
  perda                   text,            -- o que se perde no caminho
  existe_outra_fonte      text not null default 'nao_sabe'
                          check (existe_outra_fonte in ('sim','nao','nao_sabe')),
  risco_divergencia       text,            -- o dado pode mudar na origem e não chegar?
  identificacao_no_foco   text,            -- como se sabe, no Foco, quem é da iniciativa

  -- golden record
  golden_hoje_id          uuid references fluxo_dados_sistemas(id),
  golden_alvo_id          uuid references fluxo_dados_sistemas(id),

  -- andamento
  status                  text not null default 'entendimento'
                          check (status in ('entendimento','a_iniciar','andamento','ok','nao_se_aplica')),
  validado_com            text,
  validado_em             date,
  observacao              text,

  ativo                   boolean not null default true,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now(),

  unique (iniciativa, tipo_dado, descricao)
);

create index if not exists fluxo_dados_rotas_iniciativa_idx on fluxo_dados_rotas (iniciativa);

-- ---------------------------------------------------------------------
-- 3. PAINÉIS: de onde cada número é lido
--    iniciativa nula = painel transversal
-- ---------------------------------------------------------------------
create table if not exists fluxo_dados_paineis (
  id                    uuid primary key default gen_random_uuid(),
  nome                  text not null,
  iniciativa            text,
  indicador             text,            -- o número que o painel entrega
  ferramenta            text,            -- Power BI, Qlik, planilha...
  sistema_fonte_hoje_id uuid references fluxo_dados_sistemas(id),
  sistema_fonte_alvo_id uuid references fluxo_dados_sistemas(id),
  responsavel           text,
  status                text not null default 'entendimento'
                        check (status in ('entendimento','a_iniciar','andamento','ok','nao_se_aplica')),
  observacao            text,
  ativo                 boolean not null default true,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  unique (nome, iniciativa)
);

-- Liga painel às rotas que o alimentam
create table if not exists fluxo_dados_painel_rotas (
  painel_id  uuid not null references fluxo_dados_paineis(id) on delete cascade,
  rota_id    uuid not null references fluxo_dados_rotas(id) on delete cascade,
  criado_em  timestamptz not null default now(),
  primary key (painel_id, rota_id)
);

-- ---------------------------------------------------------------------
-- 4. ENCAMINHAMENTOS: o que falta fazer
--    Toda ação aponta para uma rota, um painel, ou os dois.
-- ---------------------------------------------------------------------
create table if not exists fluxo_dados_encaminhamentos (
  id             uuid primary key default gen_random_uuid(),
  rota_id        uuid references fluxo_dados_rotas(id),
  painel_id      uuid references fluxo_dados_paineis(id),
  acao           text not null,
  responsavel    text,
  prazo          date,
  status         text not null default 'a_fazer'
                 check (status in ('a_fazer','andamento','feito','bloqueado','cancelado')),
  depende_de_id  uuid references fluxo_dados_encaminhamentos(id),
  observacao     text,
  concluido_em   date,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  check (num_nonnulls(rota_id, painel_id) >= 1)
);

create index if not exists fluxo_dados_enc_rota_idx   on fluxo_dados_encaminhamentos (rota_id);
create index if not exists fluxo_dados_enc_painel_idx on fluxo_dados_encaminhamentos (painel_id);

-- ---------------------------------------------------------------------
-- 5. Triggers de updated_at, RLS e GRANT (padrão do Corso)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  -- updated_at nas tabelas que têm a coluna
  foreach t in array array[
    'fluxo_dados_sistemas','fluxo_dados_rotas',
    'fluxo_dados_paineis','fluxo_dados_encaminhamentos'
  ] loop
    execute format('drop trigger if exists trg_%I_updated on %I', t, t);
    execute format(
      'create trigger trg_%I_updated before update on %I
         for each row execute function fluxo_dados_set_updated_at()', t, t);
  end loop;

  -- RLS + policy + GRANT em todas
  foreach t in array array[
    'fluxo_dados_sistemas','fluxo_dados_rotas','fluxo_dados_paineis',
    'fluxo_dados_painel_rotas','fluxo_dados_encaminhamentos'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I on %I', t || '_acesso', t);
    execute format(
      'create policy %I on %I for all to anon, authenticated using (true) with check (true)',
      t || '_acesso', t);
    execute format('grant select, insert, update on %I to anon, authenticated', t);
  end loop;
end;
$$;

-- A tabela de ligação precisa de DELETE para desfazer vínculos
grant delete on fluxo_dados_painel_rotas to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. VIEWS de leitura (security_invoker: respeitam o RLS de quem lê)
-- ---------------------------------------------------------------------

-- 6.1 Rotas com nomes legíveis e as quatro lacunas entre "hoje" e "alvo"
create or replace view fluxo_dados_rotas_lacunas
with (security_invoker = true) as
select
  r.id,
  r.iniciativa,
  r.tipo_dado,
  r.descricao,
  so.nome  as origem,
  sdh.nome as destino_hoje,
  sda.nome as destino_alvo,
  gh.nome  as golden_hoje,
  ga.nome  as golden_alvo,
  r.quem_envia_hoje,
  r.quem_deveria_enviar,
  r.mecanismo_hoje,
  r.mecanismo_alvo,
  r.chega_completo,
  r.status,
  -- alvo definido? Se não, a rota ainda está em "entendimento" de verdade
  (r.sistema_destino_alvo_id is not null
     and r.golden_alvo_id is not null
     and r.quem_deveria_enviar is not null
     and r.mecanismo_alvo <> 'a_definir')                            as alvo_definido,
  (r.sistema_destino_hoje_id is distinct from r.sistema_destino_alvo_id) as lacuna_destino,
  (r.golden_hoje_id          is distinct from r.golden_alvo_id)          as lacuna_golden,
  -- "a_definir" no alvo conta como lacuna: indefinido não é igual a resolvido
  (r.mecanismo_hoje is distinct from r.mecanismo_alvo
     or r.mecanismo_alvo = 'a_definir')                              as lacuna_mecanismo,
  (r.quem_deveria_enviar is null
     or r.quem_envia_hoje is distinct from r.quem_deveria_enviar)    as lacuna_remetente
from fluxo_dados_rotas r
left join fluxo_dados_sistemas so  on so.id  = r.sistema_origem_id
left join fluxo_dados_sistemas sdh on sdh.id = r.sistema_destino_hoje_id
left join fluxo_dados_sistemas sda on sda.id = r.sistema_destino_alvo_id
left join fluxo_dados_sistemas gh  on gh.id  = r.golden_hoje_id
left join fluxo_dados_sistemas ga  on ga.id  = r.golden_alvo_id
where r.ativo;

-- 6.2 Matriz iniciativa x camada (cliente, atendimento, processo, painel)
--     com o status da rota MENOS avançada. "nao_se_aplica" sai da conta,
--     como na regra do Corsário.
create or replace view fluxo_dados_matriz
with (security_invoker = true) as
with base as (
  select iniciativa, tipo_dado as camada, status
    from fluxo_dados_rotas
   where ativo
  union all
  select iniciativa, 'painel' as camada, status
    from fluxo_dados_paineis
   where ativo and iniciativa is not null
)
select
  iniciativa,
  camada,
  count(*) filter (where status <> 'nao_se_aplica') as qtd,
  (array['entendimento','a_iniciar','andamento','ok'])[
    min(case status
          when 'entendimento' then 1
          when 'a_iniciar'    then 2
          when 'andamento'    then 3
          when 'ok'           then 4
        end)
  ] as status_pior
from base
group by iniciativa, camada;

-- 6.3 Prontidão dos painéis: só dá para reapontar quando todas as
--     rotas que o alimentam estão ok.
create or replace view fluxo_dados_paineis_prontidao
with (security_invoker = true) as
select
  p.id,
  p.nome,
  p.iniciativa,
  p.indicador,
  sh.nome as fonte_hoje,
  sa.nome as fonte_alvo,
  p.status,
  count(pr.rota_id)                                            as rotas_ligadas,
  count(*) filter (where r.status = 'ok')                      as rotas_ok,
  count(*) filter (where r.status not in ('ok','nao_se_aplica')) as rotas_pendentes,
  (count(pr.rota_id) > 0
     and count(*) filter (where r.status not in ('ok','nao_se_aplica')) = 0) as pronto_para_reapontar
from fluxo_dados_paineis p
left join fluxo_dados_sistemas sh on sh.id = p.sistema_fonte_hoje_id
left join fluxo_dados_sistemas sa on sa.id = p.sistema_fonte_alvo_id
left join fluxo_dados_painel_rotas pr on pr.painel_id = p.id
left join fluxo_dados_rotas r on r.id = pr.rota_id
where p.ativo
group by p.id, p.nome, p.iniciativa, p.indicador, sh.nome, sa.nome, p.status;

grant select on fluxo_dados_rotas_lacunas      to anon, authenticated;
grant select on fluxo_dados_matriz             to anon, authenticated;
grant select on fluxo_dados_paineis_prontidao  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. SEED: sistemas (os cinco da planilha + o planilhão e a plataforma)
-- ---------------------------------------------------------------------
insert into fluxo_dados_sistemas (slug, nome, tipo, mantenedor, observacao) values
  ('foco',              'Foco (Salesforce)',                 'crm',        'Sebrae Nacional', 'Destino institucional. Golden record da identidade do cliente.'),
  ('planilhao',         'Planilhão',                         'planilha',   null,              'Fonte do panorama hoje.'),
  ('planilhas_avulsas', 'Planilhas avulsas das iniciativas', 'planilha',   null,              null),
  ('plataforma_premio', 'Plataforma do Prêmio',              'plataforma', 'Empresa terceirizada (nome a confirmar)', 'Sistema específico do Prêmio, cuidado por uma empresa externa.'),
  ('power_bi',          'Power BI',                          'bi',         null,              null),
  ('banco_utic',        'Banco de dados UTIC',               'banco',      'UTIC',            null),
  ('dw',                'DW',                                'dw',         null,              null)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- 8. SEED: Prêmio Startups, primeira iniciativa dissecada.
--    Só entra o que a planilha "integração com núcleo de dados" diz.
--    O que a planilha não responde fica nulo, de propósito.
-- ---------------------------------------------------------------------
insert into fluxo_dados_rotas (
  iniciativa, tipo_dado, descricao,
  sistema_origem_id, quem_envia_hoje, quem_deveria_enviar,
  sistema_destino_hoje_id, sistema_destino_alvo_id,
  chega_completo, perda, existe_outra_fonte, risco_divergencia, identificacao_no_foco,
  golden_hoje_id, golden_alvo_id, status, observacao
)
select
  'Prêmio Startups', 'cliente', 'Cadastro das empresas participantes',
  (select id from fluxo_dados_sistemas where slug = 'plataforma_premio'),
  'Plataforma do Prêmio (envia o cadastro ao Foco)',
  null,                                                                  -- a preencher
  (select id from fluxo_dados_sistemas where slug = 'foco'),
  (select id from fluxo_dados_sistemas where slug = 'foco'),
  'parcial',
  'Colocação e edições posteriores não chegam ao Foco. Chega só o que a plataforma envia, como de qualquer outra startup.',
  'nao_sabe',
  'Pergunta aberta: algum dado de cliente do Prêmio pode ser atualizado no sistema da empresa terceirizada e não chegar à plataforma do Prêmio?',
  'A confirmar: campanha, membro de campanha e grupo de clientes.',
  (select id from fluxo_dados_sistemas where slug = 'plataforma_premio'),
  (select id from fluxo_dados_sistemas where slug = 'foco'),             -- proposta: identidade do cliente é do Foco
  'entendimento',
  'Perguntas abertas: como se identifica, na plataforma, quem é do Prêmio? O que a empresa terceirizada controla dentro da plataforma?'
where not exists (
  select 1 from fluxo_dados_rotas
   where iniciativa = 'Prêmio Startups' and tipo_dado = 'cliente'
     and descricao = 'Cadastro das empresas participantes'
);

insert into fluxo_dados_rotas (
  iniciativa, tipo_dado, descricao,
  sistema_origem_id, quem_envia_hoje, quem_deveria_enviar,
  sistema_destino_hoje_id, sistema_destino_alvo_id, mecanismo_hoje,
  chega_completo, perda, existe_outra_fonte,
  golden_hoje_id, golden_alvo_id, status, observacao
)
select
  'Prêmio Startups', 'atendimento', 'Participação e interações no Prêmio',
  (select id from fluxo_dados_sistemas where slug = 'plataforma_premio'),
  null,                                                                  -- a preencher
  null,                                                                  -- a preencher
  null,                                                                  -- hoje não chega ao Foco
  (select id from fluxo_dados_sistemas where slug = 'foco'),
  'nenhum',
  'nao',
  'Segundo a planilha, o dado de atendimento do Prêmio não está no Foco.',
  'nao_sabe',
  (select id from fluxo_dados_sistemas where slug = 'plataforma_premio'),
  (select id from fluxo_dados_sistemas where slug = 'foco'),
  'entendimento',
  'Motivo do alvo: cruzar a participação no Prêmio com a de outras iniciativas. Participantes de 2025 e 2026 hoje são consultados no ambiente da plataforma. O panorama é lido do planilhão.'
where not exists (
  select 1 from fluxo_dados_rotas
   where iniciativa = 'Prêmio Startups' and tipo_dado = 'atendimento'
     and descricao = 'Participação e interações no Prêmio'
);

-- Painel do Prêmio e ligação com as duas rotas
insert into fluxo_dados_paineis (
  nome, iniciativa, indicador, sistema_fonte_hoje_id, sistema_fonte_alvo_id, observacao
)
select
  'Panorama de participantes do Prêmio', 'Prêmio Startups',
  'Número de participantes do Prêmio (2025 e 2026)',
  (select id from fluxo_dados_sistemas where slug = 'planilhao'),
  (select id from fluxo_dados_sistemas where slug = 'foco'),
  'Hoje o número é buscado no ambiente da plataforma. Panorama usa o planilhão como fonte.'
where not exists (
  select 1 from fluxo_dados_paineis
   where nome = 'Panorama de participantes do Prêmio' and iniciativa = 'Prêmio Startups'
);

insert into fluxo_dados_painel_rotas (painel_id, rota_id)
select p.id, r.id
  from fluxo_dados_paineis p
  join fluxo_dados_rotas r on r.iniciativa = p.iniciativa
 where p.nome = 'Panorama de participantes do Prêmio'
   and p.iniciativa = 'Prêmio Startups'
   and r.tipo_dado in ('cliente','atendimento')
on conflict do nothing;

-- Encaminhamentos do piloto (vieram da coluna "tarefas/responsáveis")
do $$
declare
  v_rota_cliente uuid;
  v_painel       uuid;
  v_envio        uuid;
  v_import       uuid;
begin
  select id into v_rota_cliente
    from fluxo_dados_rotas
   where iniciativa = 'Prêmio Startups' and tipo_dado = 'cliente'
     and descricao = 'Cadastro das empresas participantes';

  select id into v_painel
    from fluxo_dados_paineis
   where nome = 'Panorama de participantes do Prêmio' and iniciativa = 'Prêmio Startups';

  if v_rota_cliente is null
     or exists (select 1 from fluxo_dados_encaminhamentos where rota_id = v_rota_cliente) then
    return;  -- já semeado, não duplica
  end if;

  insert into fluxo_dados_encaminhamentos (rota_id, painel_id, acao, responsavel)
  values (v_rota_cliente, v_painel, 'Enviar os dados do Prêmio de 2025', 'Bernardo')
  returning id into v_envio;

  insert into fluxo_dados_encaminhamentos (rota_id, painel_id, acao, responsavel, depende_de_id)
  values (v_rota_cliente, v_painel, 'Importar os dados do Prêmio de 2025 para o Foco', 'José (JR)', v_envio)
  returning id into v_import;

  insert into fluxo_dados_encaminhamentos (rota_id, painel_id, acao, responsavel, depende_de_id)
  values
    (v_rota_cliente, v_painel, 'Apresentar o resultado do piloto de importação', 'José (JR)', v_import),
    (v_rota_cliente, v_painel, 'Analisar a composição dos dados de contato', 'José (JR)', v_import);

  insert into fluxo_dados_encaminhamentos (rota_id, painel_id, acao, responsavel)
  values (v_rota_cliente, v_painel,
          'Verificar se o que está no planilhão já existe no Foco (membro de campanha e grupo de clientes)',
          null);
end;
$$;

commit;

-- ---------------------------------------------------------------------
-- 9. AUDITORIA (opcional). Descomente depois de conferir a assinatura de
--    cc_audit() em tools/sql/2026-08_auditoria.sql e copiar o mesmo
--    padrão usado nas tabelas meta_inovacao_*.
-- ---------------------------------------------------------------------
-- create trigger trg_fluxo_dados_rotas_audit
--   after insert or update or delete on fluxo_dados_rotas
--   for each row execute function cc_audit();
-- create trigger trg_fluxo_dados_encaminhamentos_audit
--   after insert or update or delete on fluxo_dados_encaminhamentos
--   for each row execute function cc_audit();

-- ---------------------------------------------------------------------
-- 10. CONFERÊNCIA RÁPIDA (rodar depois)
-- ---------------------------------------------------------------------
-- select * from fluxo_dados_rotas_lacunas;
-- select * from fluxo_dados_matriz;
-- select * from fluxo_dados_paineis_prontidao;
