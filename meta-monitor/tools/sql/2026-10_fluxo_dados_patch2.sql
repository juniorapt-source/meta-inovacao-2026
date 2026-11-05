-- =====================================================================
-- 2026-10_fluxo_dados_patch2.sql
-- Endurece as policies das tabelas fluxo_dados_* no padrão do repo
-- (PADRAO_TABELA.md): leitura pública, escrita só com o header x-cc-token.
--
-- Antes: as policies criadas no script principal eram abertas
-- (using true / with check true) e qualquer pessoa com a anon key
-- conseguiria gravar.
--
-- O token NÃO está neste arquivo. Ele é lido de uma policy
-- "cc_token_insert" de uma tabela existente do Corso (a mesma que as
-- outras abas do editor já usam). Se não achar, o script para sem
-- alterar nada, e você pode colar o token na variável v_token abaixo.
--
-- Ordem de execução: 2026-10_fluxo_dados.sql, patch1, este patch2.
-- Idempotente. Atômico (begin/commit).
-- =====================================================================

begin;

do $$
declare
  -- Se a leitura automática falhar, cole o token aqui (o mesmo de data/config.js: tokenEscrita)
  v_token   text := null;
  v_expr    text;
  t         text;
  r         record;
begin
  -- 1. Descobre o token a partir de uma policy existente de outra tabela
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

  -- 2. Policies novas, tabela por tabela
  foreach t in array array[
    'fluxo_dados_sistemas','fluxo_dados_rotas','fluxo_dados_paineis',
    'fluxo_dados_painel_rotas','fluxo_dados_encaminhamentos'
  ] loop
    -- remove qualquer policy pré-existente (inclusive a aberta do script principal)
    for r in select policyname from pg_policies
              where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', r.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy cc_select_publico on public.%I for select to anon using (true)', t);

    execute format(
      'create policy cc_token_insert on public.%I for insert to anon with check (%s)', t, v_expr);

    -- a tabela de ligação não tem updated_at nem UPDATE útil, mas mantém o padrão
    execute format(
      'create policy cc_token_update on public.%I for update to anon using (%s) with check (%s)',
      t, v_expr, v_expr);
  end loop;

  -- 3. A tabela de ligação é a única com DELETE (desvincular painel x rota)
  execute format(
    'create policy cc_token_delete on public.fluxo_dados_painel_rotas for delete to anon using (%s)',
    v_expr);
end;
$$;

commit;

-- ---------------------------------------------------------------------
-- Conferência (rodar depois). Deve listar 3 policies por tabela
-- (select, insert, update) e 4 na fluxo_dados_painel_rotas (+ delete).
-- O token não aparece aqui de propósito.
-- ---------------------------------------------------------------------
-- select tablename, policyname, cmd, roles
--   from pg_policies
--  where tablename like 'fluxo\_dados\_%'
--  order by tablename, cmd;
