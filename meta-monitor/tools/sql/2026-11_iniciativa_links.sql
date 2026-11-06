-- =====================================================================
-- 2026-11_iniciativa_links.sql
-- Páginas "Painéis" e "Sites" (menu Execução, v0.33.0).
--
-- Uma tabela só, uma linha por iniciativa e por tipo:
--   tipo = 'site'   → link da página da iniciativa + "tem formulário de captura de lead?"
--   tipo = 'painel' → link do painel + responsável pela manutenção (pessoa do golden record)
--
-- A lista de iniciativas NÃO mora aqui: as páginas leem núcleo + iniciativa de
-- corsario_status (a mesma lista do "O Caminho para o Corsário"). A linha desta tabela
-- só nasce quando alguém preenche algo pela primeira vez.
--
-- Responsável: padrão "convivendo, nunca substituindo" (PADRAO_TABELA.md) —
-- responsavel_pessoa_id (FK pra meta_inovacao_pessoas) + responsavel (nome, cópia em texto).
--
-- O token NÃO está neste arquivo. Ele é lido de uma policy "cc_token_insert" de outra
-- tabela (mesmo método de 2026-10_fluxo_dados_patch2.sql). Se não achar, o script para
-- sem alterar nada — cole o token em v_token (o mesmo de data/config.js: tokenEscrita).
--
-- Idempotente. Atômico (begin/commit).
-- =====================================================================

begin;

-- 1) Tabela
create table if not exists public.meta_inovacao_iniciativa_links (
  id                    bigint generated always as identity primary key,
  tipo                  text not null check (tipo in ('site', 'painel')),
  iniciativa            text not null,
  nucleo                text,
  projeto_id            bigint,
  nucleo_id             bigint,
  link                  text check (link is null or link ~* '^https?://'),
  captura_lead          boolean not null default false,   -- só usado em tipo = 'site'
  portal_sebrae         boolean not null default false,   -- só usado em tipo = 'site' (v0.40.0)
  responsavel_pessoa_id bigint references public.meta_inovacao_pessoas(id),  -- só em tipo = 'painel'
  responsavel           text,                              -- cópia em texto do nome
  deleted_at            timestamptz,                       -- soft delete — nunca DELETE físico
  updated_at            timestamptz not null default now(),
  updated_by            text,
  constraint meta_inovacao_iniciativa_links_tipo_iniciativa_uq unique (tipo, iniciativa)
);

-- 2) Trigger de updated_at
create or replace function public.cc_touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists cc_touch_updated_at_iniciativa_links on public.meta_inovacao_iniciativa_links;
create trigger cc_touch_updated_at_iniciativa_links
  before update on public.meta_inovacao_iniciativa_links
  for each row execute function public.cc_touch_updated_at();

-- 3) Auditoria (cc_audit já existe — 2026-08_auditoria.sql)
drop trigger if exists cc_audit_iniciativa_links on public.meta_inovacao_iniciativa_links;
create trigger cc_audit_iniciativa_links
  after insert or update or delete on public.meta_inovacao_iniciativa_links
  for each row execute function public.cc_audit();

-- 4) RLS — GRANT antes das policies; DELETE fica de fora (soft delete)
alter table public.meta_inovacao_iniciativa_links enable row level security;
grant select, insert, update on public.meta_inovacao_iniciativa_links to anon, authenticated;

do $$
declare
  -- Se a leitura automática falhar, cole o token aqui (o mesmo de data/config.js: tokenEscrita)
  v_token text := null;
  v_expr  text;
  r       record;
begin
  if v_token is null then
    select substring(p.with_check from '= ''([^'']+)''')
      into v_token
      from pg_policies p
     where p.schemaname = 'public'
       and p.policyname = 'cc_token_insert'
       and p.tablename <> 'meta_inovacao_iniciativa_links'
       and p.with_check like '%x-cc-token%'
     limit 1;
  end if;

  if v_token is null or length(v_token) < 8 then
    raise exception
      'Token nao encontrado em nenhuma policy cc_token_insert existente. Cole o token na variavel v_token deste script e rode de novo.';
  end if;

  v_expr := format(
    $f$current_setting('request.headers', true)::json->>'x-cc-token' = %L$f$, v_token);

  for r in select policyname from pg_policies
            where schemaname = 'public' and tablename = 'meta_inovacao_iniciativa_links' loop
    execute format('drop policy %I on public.meta_inovacao_iniciativa_links', r.policyname);
  end loop;

  execute 'create policy cc_select_publico on public.meta_inovacao_iniciativa_links for select to anon using (true)';
  execute format(
    'create policy cc_token_insert on public.meta_inovacao_iniciativa_links for insert to anon with check (%s)', v_expr);
  execute format(
    'create policy cc_token_update on public.meta_inovacao_iniciativa_links for update to anon using (%s) with check (%s)',
    v_expr, v_expr);
end;
$$;

commit;

-- 5) Verificação (deve mostrar 3 policies e 0 linhas na primeira vez)
select policyname, cmd from pg_policies
 where schemaname = 'public' and tablename = 'meta_inovacao_iniciativa_links'
 order by policyname;
select tipo, count(*) from public.meta_inovacao_iniciativa_links where deleted_at is null group by tipo;

-- Pra REVERTER (só logo depois de criar, antes de alguém preencher):
--   drop table if exists public.meta_inovacao_iniciativa_links;
