-- =====================================================================
-- 2026-10_fluxo_dados_patch3.sql
-- Fluxo de dados: vários destinos por rota e várias "outras fontes".
--
-- 1. fluxo_dados_rotas.outras_fontes (text[]): lista de fontes em texto,
--    uma por item. Substitui, na tela, o campo sim/nao/nao_sabe
--    existe_outra_fonte (a coluna antiga fica, sem uso, para não perder dado).
-- 2. fluxo_dados_rota_destinos: um destino por linha, com o momento
--    ('hoje' ou 'alvo'). Substitui, na tela, sistema_destino_hoje_id e
--    sistema_destino_alvo_id (colunas antigas ficam, sem uso).
-- 3. A view fluxo_dados_rotas_lacunas passa a ler os destinos da nova tabela.
--
-- O token de escrita é lido de uma policy cc_token_insert existente
-- (mesmo método do patch2). Se não achar, o script para sem alterar nada.
--
-- Ordem: depois do patch2. Idempotente. Atômico.
-- =====================================================================

begin;

-- 1. Outras fontes, em texto, uma por item
alter table fluxo_dados_rotas
  add column if not exists outras_fontes text[] not null default '{}';

comment on column fluxo_dados_rotas.outras_fontes is
  'Outras fontes do dado, uma por item. Substitui existe_outra_fonte.';
comment on column fluxo_dados_rotas.existe_outra_fonte is
  'DEPRECADO: usar outras_fontes. Mantida só para não perder dado.';

-- 2. Destinos: vários por rota
create table if not exists fluxo_dados_rota_destinos (
  rota_id    uuid not null references fluxo_dados_rotas(id) on delete cascade,
  sistema_id uuid not null references fluxo_dados_sistemas(id),
  momento    text not null check (momento in ('hoje','alvo')),
  criado_em  timestamptz not null default now(),
  primary key (rota_id, sistema_id, momento)
);

create index if not exists fluxo_dados_rota_destinos_rota_idx
  on fluxo_dados_rota_destinos (rota_id);

comment on column fluxo_dados_rotas.sistema_destino_hoje_id is
  'DEPRECADO: usar fluxo_dados_rota_destinos (momento = hoje).';
comment on column fluxo_dados_rotas.sistema_destino_alvo_id is
  'DEPRECADO: usar fluxo_dados_rota_destinos (momento = alvo).';

-- Copia o que já existe (não duplica se rodar de novo)
insert into fluxo_dados_rota_destinos (rota_id, sistema_id, momento)
select id, sistema_destino_hoje_id, 'hoje'
  from fluxo_dados_rotas where sistema_destino_hoje_id is not null
on conflict do nothing;

insert into fluxo_dados_rota_destinos (rota_id, sistema_id, momento)
select id, sistema_destino_alvo_id, 'alvo'
  from fluxo_dados_rotas where sistema_destino_alvo_id is not null
on conflict do nothing;

-- 3. RLS e GRANT no padrão do repo (leitura pública, escrita com x-cc-token)
alter table fluxo_dados_rota_destinos enable row level security;
grant select, insert, delete on fluxo_dados_rota_destinos to anon, authenticated;

do $$
declare
  v_token text := null;  -- se a leitura automática falhar, cole o token aqui
  v_expr  text;
  r       record;
begin
  if v_token is null then
    select substring(p.with_check from '= ''([^'']+)''')
      into v_token
      from pg_policies p
     where p.schemaname = 'public'
       and p.policyname = 'cc_token_insert'
       and p.tablename not like 'fluxo\_dados\_%'
       and p.with_check like '%x-cc-token%'
     limit 1;
  end if;

  if v_token is null or length(v_token) < 8 then
    raise exception
      'Token nao encontrado em nenhuma policy cc_token_insert existente. Nada foi alterado. Cole o token na variavel v_token deste script e rode de novo.';
  end if;

  v_expr := format(
    $f$current_setting('request.headers', true)::json->>'x-cc-token' = %L$f$, v_token);

  for r in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'fluxo_dados_rota_destinos' loop
    execute format('drop policy %I on public.fluxo_dados_rota_destinos', r.policyname);
  end loop;

  create policy cc_select_publico on public.fluxo_dados_rota_destinos
    for select to anon using (true);
  execute format(
    'create policy cc_token_insert on public.fluxo_dados_rota_destinos for insert to anon with check (%s)', v_expr);
  execute format(
    'create policy cc_token_delete on public.fluxo_dados_rota_destinos for delete to anon using (%s)', v_expr);
end;
$$;

-- 4. View de lacunas lendo os destinos da tabela nova.
--    Mesmas colunas, mesma ordem e mesmos tipos de antes.
create or replace view fluxo_dados_rotas_lacunas
with (security_invoker = true) as
select
  r.id,
  r.iniciativa,
  r.tipo_dado,
  r.descricao,
  so.nome  as origem,
  (select string_agg(s.nome, ', ' order by s.nome)
     from fluxo_dados_rota_destinos d
     join fluxo_dados_sistemas s on s.id = d.sistema_id
    where d.rota_id = r.id and d.momento = 'hoje') as destino_hoje,
  (select string_agg(s.nome, ', ' order by s.nome)
     from fluxo_dados_rota_destinos d
     join fluxo_dados_sistemas s on s.id = d.sistema_id
    where d.rota_id = r.id and d.momento = 'alvo') as destino_alvo,
  gh.nome  as golden_hoje,
  ga.nome  as golden_alvo,
  r.quem_envia_hoje,
  r.quem_deveria_enviar,
  r.mecanismo_hoje,
  r.mecanismo_alvo,
  r.chega_completo,
  r.status,
  (exists (select 1 from fluxo_dados_rota_destinos d
            where d.rota_id = r.id and d.momento = 'alvo')
     and r.golden_alvo_id is not null
     and r.quem_deveria_enviar is not null
     and r.mecanismo_alvo <> 'a_definir')                            as alvo_definido,
  (coalesce((select array_agg(d.sistema_id order by d.sistema_id)
               from fluxo_dados_rota_destinos d
              where d.rota_id = r.id and d.momento = 'hoje'), '{}'::uuid[])
     is distinct from
   coalesce((select array_agg(d.sistema_id order by d.sistema_id)
               from fluxo_dados_rota_destinos d
              where d.rota_id = r.id and d.momento = 'alvo'), '{}'::uuid[])) as lacuna_destino,
  (r.golden_hoje_id is distinct from r.golden_alvo_id)                   as lacuna_golden,
  (r.mecanismo_hoje is distinct from r.mecanismo_alvo
     or r.mecanismo_alvo = 'a_definir')                                  as lacuna_mecanismo,
  (r.quem_deveria_enviar is null
     or r.quem_envia_hoje is distinct from r.quem_deveria_enviar)        as lacuna_remetente
from fluxo_dados_rotas r
left join fluxo_dados_sistemas so on so.id = r.sistema_origem_id
left join fluxo_dados_sistemas gh on gh.id = r.golden_hoje_id
left join fluxo_dados_sistemas ga on ga.id = r.golden_alvo_id
where r.ativo;

grant select on fluxo_dados_rotas_lacunas to anon, authenticated;

commit;

-- A API precisa saber da tabela e da coluna novas
notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------
-- Conferência (rodar depois)
-- ---------------------------------------------------------------------
-- select count(*) from fluxo_dados_rota_destinos;          -- esperado: 3 (Prêmio)
-- select tipo_dado, destino_hoje, destino_alvo, lacuna_destino
--   from fluxo_dados_rotas_lacunas;
-- select tablename, policyname, cmd from pg_policies
--  where tablename = 'fluxo_dados_rota_destinos' order by cmd;  -- DELETE, INSERT, SELECT
