-- =====================================================================
-- 2026-11_projeto_id_ligacao.sql
-- Liga ao cadastro de projetos (meta_inovacao_projetos.id) as tabelas que ainda guardam
-- o projeto só pelo NOME (v0.36.0).
-- ORDEM: depois de 2026-11_projetos_visibilidade.sql e 2026-11_iniciativa_links.sql;
-- ORDEM: depois de 2026-10_fluxo_dados.sql e 2026-08_canva_demandas.sql;
-- ORDEM: depois de supabase/plano_acao_atividades.sql (as tabelas precisam existir).
--
-- Problema que resolve: renomear um projeto no editor (aba "Projetos & Representantes")
-- só levava o nome novo para corsario_status. Atividades, links de Sites/Painéis, rotas e
-- painéis do Fluxo de dados e demandas do Canva ficavam com o nome velho e sumiam da tela
-- do projeto.
--
-- O que faz:
--   1) Coluna projeto_id (FK para meta_inovacao_projetos) onde faltava:
--        plano_acao_atividades, fluxo_dados_rotas, fluxo_dados_paineis.
--      meta_inovacao_iniciativa_links já tinha a coluna (sem FK): ganha a FK.
--      meta_inovacao_canva_demandas já tinha coluna e FK: nada muda na estrutura.
--   2) Preenche projeto_id pelo nome (sem caixa e sem espaços nas pontas) nas 4 tabelas,
--      onde está nulo ou aponta para projeto removido.
--   3) Gatilho BEFORE INSERT/UPDATE nas 4 tabelas: linha gravada sem projeto_id, ou que
--      trocou de iniciativa sem trocar o projeto_id, tem o projeto_id resolvido pelo nome.
--      Assim toda porta de entrada (inclusive as que ainda só mandam o nome) grava o id.
--      Nome que não casa (texto livre, painel transversal) fica com projeto_id nulo.
--   4) Gatilho AFTER UPDATE em meta_inovacao_projetos: renomear um projeto leva o nome
--      novo para as 5 tabelas (as 4 acima + meta_inovacao_canva_demandas.projeto),
--      casando por projeto_id e, nas linhas sem id, pelo nome antigo. Roda como dono da
--      função (SECURITY DEFINER) porque o site não tem UPDATE direto no Canva (lá a escrita
--      é só pelas funções cc_canva_*). corsario_status fica de fora: o editor já propaga
--      para ele (DB_CORSARIO.atualizarIniciativa) e duplicar geraria auditoria em dobro.
--      Se o nome novo colidir com uma restrição única de alguma tabela (ex.: fluxo_dados_rotas
--      tem unique (iniciativa, tipo_dado, descricao)), o rename inteiro falha e nada muda.
--
-- O texto `iniciativa` / `projeto` NUNCA é apagado: continua como cópia legível e é o que
-- as views do Fluxo de dados agrupam (padrão "convivendo, nunca substituindo" de
-- PADRAO_TABELA.md). Nenhuma policy/GRANT muda.
--
-- O site funciona antes e depois deste script: sem a coluna, as telas casam pelo nome
-- como antes.
-- Idempotente. Atômico (begin/commit).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) colunas e FKs
-- ---------------------------------------------------------------------
alter table public.plano_acao_atividades
  add column if not exists projeto_id bigint references public.meta_inovacao_projetos(id);
alter table public.fluxo_dados_rotas
  add column if not exists projeto_id bigint references public.meta_inovacao_projetos(id);
alter table public.fluxo_dados_paineis
  add column if not exists projeto_id bigint references public.meta_inovacao_projetos(id);

-- iniciativa_links: a coluna existe desde 2026-11_iniciativa_links.sql, mas sem FK.
-- Antes de criar a FK, zera id que não aponta para projeto nenhum (o passo 2 repreenche).
update public.meta_inovacao_iniciativa_links l
   set projeto_id = null
 where l.projeto_id is not null
   and not exists (select 1 from public.meta_inovacao_projetos p where p.id = l.projeto_id);
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'meta_inovacao_iniciativa_links_projeto_id_fkey') then
    alter table public.meta_inovacao_iniciativa_links
      add constraint meta_inovacao_iniciativa_links_projeto_id_fkey
      foreign key (projeto_id) references public.meta_inovacao_projetos(id);
  end if;
end;
$$;

create index if not exists plano_acao_atividades_projeto_id_idx           on public.plano_acao_atividades (projeto_id);
create index if not exists fluxo_dados_rotas_projeto_id_idx               on public.fluxo_dados_rotas (projeto_id);
create index if not exists fluxo_dados_paineis_projeto_id_idx             on public.fluxo_dados_paineis (projeto_id);
create index if not exists meta_inovacao_iniciativa_links_projeto_id_idx  on public.meta_inovacao_iniciativa_links (projeto_id);

-- ---------------------------------------------------------------------
-- 3) gatilho que resolve projeto_id pelo nome na gravação
--    (criado antes do preenchimento: o UPDATE do passo 2 já passa por ele)
-- ---------------------------------------------------------------------
create or replace function public.cc_projeto_id_por_nome(p_nome text)
returns bigint
language sql stable
set search_path = public
as $$
  select p.id
    from public.meta_inovacao_projetos p
   where p.deleted_at is null
     and lower(btrim(p.iniciativa)) = lower(btrim(p_nome))
   order by p.id
   limit 1;
$$;

create or replace function public.cc_resolver_projeto_id()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.projeto_id is null
     or (tg_op = 'UPDATE'
         and new.iniciativa is distinct from old.iniciativa
         and new.projeto_id is not distinct from old.projeto_id) then
    new.projeto_id := public.cc_projeto_id_por_nome(new.iniciativa);
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array['plano_acao_atividades', 'fluxo_dados_rotas', 'fluxo_dados_paineis', 'meta_inovacao_iniciativa_links'] loop
    execute format('drop trigger if exists cc_resolver_projeto_id on public.%I', t);
    execute format(
      'create trigger cc_resolver_projeto_id before insert or update of iniciativa, projeto_id on public.%I
         for each row execute function public.cc_resolver_projeto_id()', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 2) preenchimento pelo nome (linhas sem id, ou com id de projeto removido)
-- ---------------------------------------------------------------------
update public.plano_acao_atividades x
   set projeto_id = p.id
  from public.meta_inovacao_projetos p
 where p.deleted_at is null
   and lower(btrim(p.iniciativa)) = lower(btrim(x.iniciativa))
   and (x.projeto_id is null
        or not exists (select 1 from public.meta_inovacao_projetos q where q.id = x.projeto_id and q.deleted_at is null));

update public.fluxo_dados_rotas x
   set projeto_id = p.id
  from public.meta_inovacao_projetos p
 where p.deleted_at is null
   and lower(btrim(p.iniciativa)) = lower(btrim(x.iniciativa))
   and (x.projeto_id is null
        or not exists (select 1 from public.meta_inovacao_projetos q where q.id = x.projeto_id and q.deleted_at is null));

update public.fluxo_dados_paineis x
   set projeto_id = p.id
  from public.meta_inovacao_projetos p
 where p.deleted_at is null
   and lower(btrim(p.iniciativa)) = lower(btrim(x.iniciativa))
   and (x.projeto_id is null
        or not exists (select 1 from public.meta_inovacao_projetos q where q.id = x.projeto_id and q.deleted_at is null));

update public.meta_inovacao_iniciativa_links x
   set projeto_id = p.id
  from public.meta_inovacao_projetos p
 where p.deleted_at is null
   and lower(btrim(p.iniciativa)) = lower(btrim(x.iniciativa))
   and (x.projeto_id is null
        or not exists (select 1 from public.meta_inovacao_projetos q where q.id = x.projeto_id and q.deleted_at is null));

-- ---------------------------------------------------------------------
-- 4) renomear projeto leva o nome novo para as tabelas ligadas
-- ---------------------------------------------------------------------
create or replace function public.cc_propagar_nome_projeto()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- linhas ligadas pelo id, e linhas antigas sem id que ainda tinham o nome velho
  -- (estas ganham o id junto)
  update public.plano_acao_atividades
     set iniciativa = new.iniciativa, projeto_id = new.id
   where (projeto_id = new.id and iniciativa is distinct from new.iniciativa)
      or (projeto_id is null and lower(btrim(iniciativa)) = lower(btrim(old.iniciativa)));

  update public.meta_inovacao_iniciativa_links
     set iniciativa = new.iniciativa, projeto_id = new.id
   where (projeto_id = new.id and iniciativa is distinct from new.iniciativa)
      or (projeto_id is null and lower(btrim(iniciativa)) = lower(btrim(old.iniciativa)));

  update public.fluxo_dados_rotas
     set iniciativa = new.iniciativa, projeto_id = new.id
   where (projeto_id = new.id and iniciativa is distinct from new.iniciativa)
      or (projeto_id is null and lower(btrim(iniciativa)) = lower(btrim(old.iniciativa)));

  update public.fluxo_dados_paineis
     set iniciativa = new.iniciativa, projeto_id = new.id
   where (projeto_id = new.id and iniciativa is distinct from new.iniciativa)
      or (projeto_id is null and lower(btrim(iniciativa)) = lower(btrim(old.iniciativa)));

  -- Canva: só as demandas já ligadas ao projeto. As da fila "projeto novo" (sem id)
  -- guardam o texto digitado e são ligadas à mão em canva-consolidado.html.
  update public.meta_inovacao_canva_demandas
     set projeto = new.iniciativa
   where projeto_id = new.id and projeto is distinct from new.iniciativa;

  return new;
end;
$$;

drop trigger if exists cc_propagar_nome_projeto on public.meta_inovacao_projetos;
create trigger cc_propagar_nome_projeto
  after update of iniciativa on public.meta_inovacao_projetos
  for each row
  when (old.iniciativa is distinct from new.iniciativa)
  execute function public.cc_propagar_nome_projeto();

commit;

-- a API (PostgREST) só enxerga as colunas novas depois disto
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- 5) Conferência
-- ---------------------------------------------------------------------
-- 5a) por tabela: total de linhas, ligadas a projeto ativo, sem projeto
--     (sem projeto = nome que não casa com nenhum projeto; ver 5b)
select 'plano_acao_atividades' as tabela, count(*) as total,
       count(*) filter (where p.id is not null) as com_projeto,
       count(*) filter (where p.id is null)     as sem_projeto
  from public.plano_acao_atividades x
  left join public.meta_inovacao_projetos p on p.id = x.projeto_id and p.deleted_at is null
 where x.deleted_at is null
union all
select 'meta_inovacao_iniciativa_links', count(*),
       count(*) filter (where p.id is not null), count(*) filter (where p.id is null)
  from public.meta_inovacao_iniciativa_links x
  left join public.meta_inovacao_projetos p on p.id = x.projeto_id and p.deleted_at is null
 where x.deleted_at is null
union all
select 'fluxo_dados_rotas', count(*),
       count(*) filter (where p.id is not null), count(*) filter (where p.id is null)
  from public.fluxo_dados_rotas x
  left join public.meta_inovacao_projetos p on p.id = x.projeto_id and p.deleted_at is null
 where x.ativo
union all
select 'fluxo_dados_paineis (com iniciativa)', count(*),
       count(*) filter (where p.id is not null), count(*) filter (where p.id is null)
  from public.fluxo_dados_paineis x
  left join public.meta_inovacao_projetos p on p.id = x.projeto_id and p.deleted_at is null
 where x.ativo and x.iniciativa is not null
union all
select 'meta_inovacao_canva_demandas (fora da fila)', count(*),
       count(*) filter (where p.id is not null), count(*) filter (where p.id is null)
  from public.meta_inovacao_canva_demandas x
  left join public.meta_inovacao_projetos p on p.id = x.projeto_id and p.deleted_at is null
 where x.deleted_at is null and not x.projeto_novo;

-- 5b) nomes que não casaram com projeto nenhum (deve dar 0 linhas; se der, é nome
--     órfão de um rename antigo ou digitado à mão — corrija com o modelo abaixo)
select 'plano_acao_atividades' as tabela, x.iniciativa, count(*) as linhas
  from public.plano_acao_atividades x
 where x.deleted_at is null and x.projeto_id is null
 group by x.iniciativa
union all
select 'meta_inovacao_iniciativa_links', x.iniciativa, count(*)
  from public.meta_inovacao_iniciativa_links x
 where x.deleted_at is null and x.projeto_id is null
 group by x.iniciativa
union all
select 'fluxo_dados_rotas', x.iniciativa, count(*)
  from public.fluxo_dados_rotas x
 where x.ativo and x.projeto_id is null
 group by x.iniciativa
union all
select 'fluxo_dados_paineis', x.iniciativa, count(*)
  from public.fluxo_dados_paineis x
 where x.ativo and x.iniciativa is not null and x.projeto_id is null
 group by x.iniciativa
order by 1, 2;

-- Modelo para ligar um nome órfão ao projeto certo (troque os dois valores; o id está na
-- 1ª coluna de: select id, iniciativa from meta_inovacao_projetos where deleted_at is null):
--   update public.plano_acao_atividades
--      set projeto_id = <ID>, iniciativa = (select iniciativa from public.meta_inovacao_projetos where id = <ID>)
--    where projeto_id is null and iniciativa = '<NOME ÓRFÃO>';
--   (repita em meta_inovacao_iniciativa_links, fluxo_dados_rotas e fluxo_dados_paineis)

-- 5c) gatilhos criados (deve dar 5 linhas)
select event_object_table as tabela, trigger_name
  from information_schema.triggers
 where trigger_name in ('cc_resolver_projeto_id', 'cc_propagar_nome_projeto')
 group by 1, 2
 order by 1;

-- Para REVERTER (as colunas projeto_id podem ficar; sem os gatilhos, o site volta a
-- casar pelo nome):
--   drop trigger if exists cc_propagar_nome_projeto on public.meta_inovacao_projetos;
--   drop trigger if exists cc_resolver_projeto_id on public.plano_acao_atividades;
--   drop trigger if exists cc_resolver_projeto_id on public.fluxo_dados_rotas;
--   drop trigger if exists cc_resolver_projeto_id on public.fluxo_dados_paineis;
--   drop trigger if exists cc_resolver_projeto_id on public.meta_inovacao_iniciativa_links;
--   drop function if exists public.cc_propagar_nome_projeto();
--   drop function if exists public.cc_resolver_projeto_id();
--   drop function if exists public.cc_projeto_id_por_nome(text);
