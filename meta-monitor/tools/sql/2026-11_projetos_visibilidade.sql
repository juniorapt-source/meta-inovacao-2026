-- =====================================================================
-- 2026-11_projetos_visibilidade.sql
-- Cadastro de projetos como fonte única (v0.35.0).
--
-- O que faz:
--   1) Cria em meta_inovacao_projetos uma coluna por tela onde o projeto aparece
--      (boolean, NOT NULL, default true):
--        exibir_corsario     O Caminho para o Corsário
--        exibir_sites        Sites
--        exibir_paineis      Painéis
--        exibir_fluxo_dados  Fluxo de dados
--        exibir_atividades   Atividades por iniciativa (plano-acao.html)
--        exibir_matriz       Matriz de demandas (demandas.html)
--        exibir_canva        Canva das oficinas (canva.html / canva-consolidado.html)
--      O Portfólio (projetos.html), a busca e a página inicial mostram sempre todos.
--   2) Só na primeira vez (quando as colunas ainda não existiam): exibir_corsario fica
--      false para projeto que hoje NÃO está no Corsário, para a tela não mudar de conteúdo.
--      As outras 6 ficam true (todas essas telas já listam o cadastro inteiro hoje).
--   3) Iniciativas que existem só no Corsário (criadas pelo antigo "+ Nova iniciativa",
--      sem projeto no cadastro) viram projetos: Corsário, Sites e Painéis ligados (onde
--      elas já apareciam), o resto desligado. Representantes ficam vazios.
--   4) Liga ao projeto (projeto_id) toda linha de corsario_status que ainda casava só
--      pelo nome.
--
-- Os status do Corsário (corsario_status) não são alterados, só ganham projeto_id.
-- Idempotente: rodar de novo não desfaz marcas mudadas no site. Atômico (begin/commit).
-- O site funciona antes e depois deste script: sem as colunas, cada tela segue como era.
-- =====================================================================

begin;

-- 1) e 2) colunas + preenchimento inicial do Corsário
do $$
declare
  v_primeira_vez boolean;
begin
  select not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'meta_inovacao_projetos' and column_name = 'exibir_corsario'
  ) into v_primeira_vez;

  alter table public.meta_inovacao_projetos
    add column if not exists exibir_corsario    boolean not null default true,
    add column if not exists exibir_sites       boolean not null default true,
    add column if not exists exibir_paineis     boolean not null default true,
    add column if not exists exibir_fluxo_dados boolean not null default true,
    add column if not exists exibir_atividades  boolean not null default true,
    add column if not exists exibir_matriz      boolean not null default true,
    add column if not exists exibir_canva       boolean not null default true;

  if v_primeira_vez then
    update public.meta_inovacao_projetos p
       set exibir_corsario = false,
           updated_by = 'script 2026-11_projetos_visibilidade'
     where p.deleted_at is null
       and not exists (
         select 1 from public.corsario_status s
          where s.projeto_id = p.id
             or (s.projeto_id is null and lower(btrim(s.iniciativa)) = lower(btrim(p.iniciativa)))
       );
    raise notice 'Colunas criadas; exibir_corsario preenchido a partir de corsario_status.';
  else
    raise notice 'Colunas já existiam; marcas atuais mantidas.';
  end if;
end;
$$;

-- 3) iniciativas só do Corsário viram projetos
--    "só do Corsário" = linha sem projeto válido (projeto_id nulo ou apontando para projeto
--    removido) e cujo nome não casa com nenhum projeto ativo.
with livres as (
  select lower(btrim(s.iniciativa)) as chave,
         min(btrim(s.iniciativa))   as iniciativa,
         max(s.nucleo)              as nucleo,
         max(s.nucleo_id)           as nucleo_id
    from public.corsario_status s
   where not exists (select 1 from public.meta_inovacao_projetos p
                      where p.id = s.projeto_id and p.deleted_at is null)
     and not exists (select 1 from public.meta_inovacao_projetos p
                      where p.deleted_at is null and lower(btrim(p.iniciativa)) = lower(btrim(s.iniciativa)))
   group by lower(btrim(s.iniciativa))
),
base as (select coalesce(max(ordem), 0) as ordem_max from public.meta_inovacao_projetos)
insert into public.meta_inovacao_projetos
  (nucleo, nucleo_id, iniciativa, representantes, ordem,
   exibir_corsario, exibir_sites, exibir_paineis,
   exibir_fluxo_dados, exibir_atividades, exibir_matriz, exibir_canva, updated_by)
select l.nucleo, l.nucleo_id, l.iniciativa, '{}', b.ordem_max + row_number() over (order by l.iniciativa),
       true, true, true,
       false, false, false, false, 'script 2026-11_projetos_visibilidade'
  from livres l cross join base b;

-- 4) toda linha do Corsário passa a apontar para o projeto (casando pelo nome quando
--    projeto_id está nulo ou aponta para projeto removido)
update public.corsario_status s
   set projeto_id = p.id
  from public.meta_inovacao_projetos p
 where p.deleted_at is null
   and lower(btrim(p.iniciativa)) = lower(btrim(s.iniciativa))
   and (s.projeto_id is null
        or not exists (select 1 from public.meta_inovacao_projetos q
                        where q.id = s.projeto_id and q.deleted_at is null));

commit;

-- a API (PostgREST) só enxerga as colunas novas depois disto
notify pgrst, 'reload schema';

-- 5) Conferência
-- 5a) quantos projetos aparecem em cada tela
select count(*)                                   as projetos_ativos,
       count(*) filter (where exibir_corsario)    as corsario,
       count(*) filter (where exibir_sites)       as sites,
       count(*) filter (where exibir_paineis)     as paineis,
       count(*) filter (where exibir_fluxo_dados) as fluxo_dados,
       count(*) filter (where exibir_atividades)  as atividades,
       count(*) filter (where exibir_matriz)      as matriz,
       count(*) filter (where exibir_canva)       as canva
  from public.meta_inovacao_projetos where deleted_at is null;

-- 5b) projetos criados agora a partir do Corsário (confira núcleo e nome)
select id, nucleo, iniciativa from public.meta_inovacao_projetos
 where updated_by = 'script 2026-11_projetos_visibilidade' and exibir_fluxo_dados = false
   and deleted_at is null
 order by iniciativa;

-- 5c) projetos que ficaram FORA do Corsário (confira se é isso mesmo)
select id, nucleo, iniciativa from public.meta_inovacao_projetos
 where deleted_at is null and not exibir_corsario
 order by nucleo, iniciativa;

-- 5d) linhas do Corsário sem projeto (deve dar 0)
select count(*) as corsario_sem_projeto
  from public.corsario_status s
 where not exists (select 1 from public.meta_inovacao_projetos p
                    where p.id = s.projeto_id and p.deleted_at is null);

-- Para REVERTER as colunas (os projetos criados no passo 3 ficam; remova-os pelo editor
-- se quiser):
--   alter table public.meta_inovacao_projetos
--     drop column exibir_corsario, drop column exibir_sites, drop column exibir_paineis,
--     drop column exibir_fluxo_dados, drop column exibir_atividades, drop column exibir_matriz,
--     drop column exibir_canva;
--   notify pgrst, 'reload schema';
