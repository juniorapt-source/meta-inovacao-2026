-- ============================================================================
-- Escrita autenticada (Supabase Auth) — substitui o token compartilhado
-- ============================================================================
--
-- ⚠️ ESTADO EM 21/08/2026 — LEIA ANTES DE RODAR ESTE ARQUIVO INTEIRO
-- Este script está PARCIALMENTE REVERTIDO em produção. A v0.30.0 (20/08) devolveu o
-- site ao token compartilhado: as policies de escrita por editor logado que a seção 3
-- cria NÃO valem mais — foram substituídas pelas cc_token_* de
-- tools/sql/2026-08_reverte_para_token_compartilhado.sql.
--
-- O que deste arquivo CONTINUA de pé e em uso hoje:
--   • a tabela  public.meta_inovacao_editores  (seção 1)
--   • a função  public.cc_eh_editor()          (seção 2)
--
-- As duas sustentam a leitura de meta_inovacao_canva_demandas
-- (tools/sql/2026-08_canva_demandas.sql, cuja seção 0 ABORTA se elas não existirem),
-- que é a única tabela do esquema fora do modelo de token. Foi por isso que este
-- arquivo foi resgatado do branch feature/escrita-auth para a main em 21/08: ele é a
-- ÚNICA fonte versionada desses dois objetos, e nove arquivos da main o citam.
--
-- Rodar este arquivo INTEIRO hoje REINTRODUZ o modelo que já foi revertido. Se o
-- objetivo é só recriar a allowlist e a função, rode apenas as seções 1 e 2.
--
-- E se um dia o login voltar, NÃO volta por senha. Regra do projeto em
-- docs/PLANO_CANVA_OFICINAS.md §6.6: identidade é código de 6 dígitos por e-mail
-- (OTP do Supabase Auth), nunca senha. A v0.30.0 aconteceu porque uma senha se perdeu
-- dezenove minutos depois de ter sido criada.
--
-- CONTEXTO
-- Hoje a escrita nas tabelas do site é liberada por um header compartilhado
-- (x-cc-token = UUID), validado pela RLS — ver tools/sql/2026-08_protecao_escrita.sql.
-- Esse token é entregue ao navegador em texto puro (data/config.js), então NÃO é
-- secreto: qualquer um com o link do site consegue extraí-lo e escrever. Este script
-- troca esse modelo por autenticação de verdade (Supabase Auth): só um EDITOR logado
-- (constante numa allowlist) consegue INSERT/UPDATE/DELETE. A LEITURA (SELECT) continua
-- pública, sem login — as 10 telas do painel não mudam em nada.
--
-- ⚠️ PROJETO COMPARTILHADO: este Supabase é usado por outros sites do Sebrae. Este
-- script só mexe nas POLICIES de escrita das tabelas que HOJE usam o x-cc-token
-- (auto-detectadas na seção 3) e cria 1 tabela + 1 função com prefixo próprio. Não
-- toca em tabela de outro site. Habilitar/gerir o Auth em si é feito no painel do
-- Supabase (ver runbook docs/SEGURANCA_ESCRITA_AUTH.md) — confirme lá a política de
-- signup ANTES de rodar, pra não afetar outro site do mesmo projeto.
--
-- ORDEM: rode DEPOIS que os scripts de token já foram aplicados (estado atual).
-- REVERSÍVEL: seção "COMO REVERTER" no fim recria o modelo de token.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Allowlist de editores — quem pode escrever
-- ---------------------------------------------------------------------------
-- Um usuário do Supabase Auth só vira "editor" se estiver aqui. Assim, mesmo que o
-- signup do projeto esteja aberto, uma conta nova qualquer NÃO escreve nada até o JR
-- inserir o user_id dela nesta tabela (feito no painel/SQL, nunca pelo site).
create table if not exists public.meta_inovacao_editores (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nome       text,
  criado_em  timestamptz not null default now()
);

alter table public.meta_inovacao_editores enable row level security;

-- Só o próprio editor logado enxerga a lista (nunca anon); ninguém escreve pelo site
-- (gestão da allowlist é no painel/SQL como service_role, que ignora RLS).
drop policy if exists "editores_select_auth" on public.meta_inovacao_editores;
create policy "editores_select_auth" on public.meta_inovacao_editores
  for select to authenticated
  using (user_id = auth.uid());


-- ---------------------------------------------------------------------------
-- 2) Função helper: o usuário logado é editor?
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER pra poder ler a allowlist mesmo com a RLS restritiva acima.
create or replace function public.cc_eh_editor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.meta_inovacao_editores where user_id = auth.uid()
  );
$$;

revoke all on function public.cc_eh_editor() from public;
grant execute on function public.cc_eh_editor() to authenticated;


-- ---------------------------------------------------------------------------
-- 3) Troca as policies de escrita: token  ->  editor autenticado
-- ---------------------------------------------------------------------------
-- Auto-detecta TODA tabela public cuja policy de escrita hoje referencia o
-- 'x-cc-token' e, pra cada uma: remove as policies de INSERT/UPDATE/DELETE atuais e
-- cria as novas (role `authenticated` + cc_eh_editor()). Como as novas policies são
-- só pro role `authenticated`, o `anon` deixa de ter QUALQUER policy de escrita —
-- escrita anônima fica bloqueada por completo. SELECT não é tocado (segue público).
do $$
declare
  t   text;
  pol record;
  alvos text[];
begin
  select array_agg(distinct tablename) into alvos
  from pg_policies
  where schemaname = 'public'
    and cmd in ('INSERT','UPDATE','DELETE')
    and (coalesce(qual,'') like '%x-cc-token%' or coalesce(with_check,'') like '%x-cc-token%');

  if alvos is null then
    raise notice 'Nenhuma tabela com policy de escrita por x-cc-token encontrada — nada a migrar.';
    return;
  end if;

  raise notice 'Tabelas a migrar: %', alvos;

  foreach t in array alvos loop
    -- remove policies de escrita atuais (por token), qualquer que seja o nome
    for pol in
      select policyname from pg_policies
      where schemaname='public' and tablename=t and cmd in ('INSERT','UPDATE','DELETE')
    loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy "escrita_editor_insert" on public.%I for insert to authenticated with check (public.cc_eh_editor())', t);
    execute format(
      'create policy "escrita_editor_update" on public.%I for update to authenticated using (public.cc_eh_editor()) with check (public.cc_eh_editor())', t);
    execute format(
      'create policy "escrita_editor_delete" on public.%I for delete to authenticated using (public.cc_eh_editor())', t);
  end loop;
end $$;


-- ---------------------------------------------------------------------------
-- 4) Verificação — rode e confira à mão
-- ---------------------------------------------------------------------------
-- (a) As policies de escrita agora devem ser todas "escrita_editor_*", role
--     {authenticated}, e NENHUMA deve mencionar x-cc-token.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname='public' and cmd in ('INSERT','UPDATE','DELETE')
order by tablename, cmd;

-- (b) Não pode sobrar nenhuma policy citando o token:
select tablename, policyname
from pg_policies
where schemaname='public'
  and (coalesce(qual,'') like '%x-cc-token%' or coalesce(with_check,'') like '%x-cc-token%');
-- ^ deve vir VAZIO.


-- ============================================================================
-- COMO CADASTRAR UM EDITOR (depois de criar o usuário no painel Auth)
-- ============================================================================
--   insert into public.meta_inovacao_editores (user_id, nome)
--   values ('<uuid-do-usuario-em-Authentication>', 'Nome do editor');
-- Pra descobrir o uuid: painel Supabase > Authentication > Users (coluna UID), ou
--   select id, email from auth.users order by created_at desc;


-- ============================================================================
-- COMO REVERTER (volta pro modelo de token compartilhado)
-- ============================================================================
-- Basta rerodar tools/sql/2026-08_protecao_escrita.sql (e os demais *_token* de cada
-- tabela), que recriam as policies por x-cc-token. Opcional, limpar o que este script
-- criou:
--   drop function if exists public.cc_eh_editor();
--   drop table if exists public.meta_inovacao_editores;
-- E no site: reverter data/config.js (tokenEscrita) e js/supabase.js pro header.
-- ============================================================================
