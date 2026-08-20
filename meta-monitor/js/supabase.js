/* Cliente Supabase centralizado — window.CC_SUPABASE (item 2.1 do plano de melhorias).
 *
 * Antes deste módulo, cada tela criava seu próprio client Supabase, cada uma com sua
 * própria função local: js/matriz-store.js (SDK clássica via <script> CDN,
 * window.supabase.createClient), plano-acao.html e minhas-acoes.html (SDK via import()
 * dinâmico do pacote ESM, cada uma com sua cópia de iniciarCliente()). As duas formas de
 * carregar a lib continuam existindo (trocar isso tocaria em mais coisa do que o
 * necessário), mas agora passam por AQUI — um lugar só decide como o client é montado.
 *
 * v0.28.0/v0.29.0 — escrita autenticada (Supabase Auth, tools/sql/2026-08_auth_escrita.sql
 * + 2026-08_auth_escrita_completa.sql): o token compartilhado (x-cc-token) saiu. Quem PODE
 * escrever agora é decidido pela SESSÃO do Supabase Auth (login de verdade, js/auth.js) +
 * allowlist meta_inovacao_editores no banco — os clients abaixo persistem a sessão
 * (auth.persistSession/autoRefreshToken) pra valer nas 5 telas de escrita sem precisar
 * logar de novo em cada uma. x-cc-editor (QUEM escreveu, abaixo) continua só um bônus
 * informativo pro trigger de auditoria — não é mais o que decide permissão.
 */
(function (root) {
  "use strict";

  // manda x-cc-editor (QUEM escreveu) — lido de window.EDITOR_ATUAL (js/editor_atual.js),
  // se essa página carregar o módulo; páginas só-leitura não precisam dele, e a função
  // continua funcionando normalmente sem o header extra (não é uma dependência
  // obrigatória, só um bônus quando disponível, usado pelo trigger de auditoria como
  // autor de último recurso — ver tools/sql/2026-08_auditoria.sql). O nome da função
  // ficou o mesmo (headersComToken, de quando também mandava x-cc-token) pra não quebrar
  // corsario.html/js/drawer.js, que já chamam ela pros fetches crus de leitura.
  function headersComToken() {
    const h = {};
    const nomeEditor = root.EDITOR_ATUAL && root.EDITOR_ATUAL.nomeAtual ? root.EDITOR_ATUAL.nomeAtual() : null;
    if (nomeEditor) h["x-cc-editor"] = nomeEditor;
    return h;
  }

  function exigirConfig() {
    if (!root.APP_CONFIG) throw new Error("js/config.js não carregado — falta window.APP_CONFIG.");
    return root.APP_CONFIG;
  }

  // opções de auth iguais nos dois clients — persiste a sessão do Supabase Auth em
  // localStorage (login vale nas 5 telas de escrita, sem pedir de novo por página) e
  // renova o token sozinho antes de expirar. detectSessionInUrl:false porque este site
  // não usa magic link/OAuth redirect (D2 do runbook, docs/SEGURANCA_ESCRITA_AUTH.md) —
  // só e-mail+senha via js/auth.js.
  const OPCOES_AUTH = { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } };

  let clienteClassico = null;
  // client via SDK clássica (CDN <script src=".../supabase-js@2">, window.supabase.createClient)
  // — usado por páginas que já carregam o CDN global (demandas.html, via js/matriz-store.js).
  function obterClienteClassico() {
    if (clienteClassico) return clienteClassico;
    if (!root.supabase || !root.supabase.createClient) throw new Error("supabase-js (CDN clássico) não carregado — confira o <script> do CDN.");
    const cfg = exigirConfig();
    clienteClassico = root.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, Object.assign(
      { global: { headers: headersComToken() } }, OPCOES_AUTH));
    return clienteClassico;
  }

  let promessaClienteEsm = null;
  // client via SDK ESM (import() dinâmico, sem <script> CDN clássico) — usado por
  // páginas que carregam a lib assim (plano-acao.html, minhas-acoes.html). Continua um
  // import() dentro de <script> clássico (não type="module"), mesmo motivo de sempre:
  // o arquivo permanece testável por node --check junto do resto do site.
  async function obterClienteEsm() {
    if (promessaClienteEsm) return promessaClienteEsm;
    promessaClienteEsm = (async () => {
      const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      const cfg = exigirConfig();
      return createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, Object.assign(
        { global: { headers: headersComToken() } }, OPCOES_AUTH));
    })();
    return promessaClienteEsm;
  }

  // Client "principal" da página para sessão (login/logout) e escrita autenticada: usa
  // o SDK clássico se a página carregou o CDN <script> (demandas.html), senão o ESM
  // (editor.html, plano-acao.html, minhas-acoes.html, plano.html) — assim há UM único
  // client de auth por página, sempre o mesmo que faz a escrita (js/auth.js usa este
  // pra login/logout/estado; as camadas DB_* usam obterClienteEsm/obterClienteClassico
  // diretamente pra escrita — é o MESMO client em cache, então a sessão é a mesma).
  function clientePrincipal() {
    if (root.supabase && root.supabase.createClient) return Promise.resolve(obterClienteClassico());
    return obterClienteEsm();
  }

  /* ---- erro de escrita amigável (item 2.4) ---- */
  // código de erro do PostgREST/Postgres, buscado sem depender de um único campo (o
  // client às vezes embrulha o erro original).
  function codigoErro(err) {
    return String((err && (err.code || (err.originalError && err.originalError.code))) || "");
  }

  // reconhece o formato de erro de RLS/permissão do PostgREST (RLS bloqueando por
  // token errado/ausente é o único jeito de escrita falhar por permissão hoje — não
  // tem usuário/senha por linha, só o token compartilhado) sem depender de um único
  // campo (status HTTP nem sempre chega até o objeto de erro do client): checa status
  // quando disponível, o código de erro do Postgres (42501 = insufficient_privilege) e,
  // por último, palavras-chave da mensagem que o PostgREST usa pra RLS.
  function ehErroDePermissao(err) {
    if (!err) return false;
    const status = err.status || err.statusCode || (err.originalError && err.originalError.status);
    if (status === 401 || status === 403) return true;
    if (codigoErro(err) === "42501") return true;
    const msg = String(err.message || "").toLowerCase();
    return msg.indexOf("row-level security") !== -1 || msg.indexOf("permission denied") !== -1 || msg.indexOf("jwt") !== -1;
  }

  // UPDATE/DELETE que não afetou NENHUMA linha. Sob a RLS deste projeto a policy de
  // escrita filtra EM SILÊNCIO (token errado no modelo antigo; sessão sem login ou sem
  // constar em meta_inovacao_editores no modelo atual, cc_eh_editor() — ver
  // tools/sql/2026-08_auth_escrita.sql) — em vez de devolver "permission denied", ela
  // simplesmente não enxerga a linha, o UPDATE afeta 0 registros e o `.select().single()`
  // estoura PGRST116 ("Results contain 0 rows"). Numa edição de uma linha que ACABOU de
  // ser carregada da própria tela (existe, não é id inventado), 0 linhas afetadas é, na
  // prática, bloqueio de escrita por sessão sem permissão — não "o registro sumiu". Sem
  // reconhecer isso, esse caso caía no "falhou" cru do editor, exatamente o sintoma que
  // mandava abrir o console pra descobrir a causa.
  function ehZeroLinhasEmEscrita(err) {
    if (codigoErro(err) === "PGRST116") return true;
    // fallback: alguns embrulhos de erro trazem só o status HTTP (406, o que o
    // `.select().single()` recebe do PostgREST quando o resultado tem 0 linhas) sem
    // preencher `code` — foi como o bug de edição do Corsário apareceu no console.
    const status = err && (err.status || err.statusCode || (err.originalError && err.originalError.status));
    return status === 406;
  }

  // cache de schema do PostgREST desatualizado depois de um ALTER TABLE (coluna nova que
  // a API ainda não enxerga) — PGRST204 "Could not find the '<coluna>' column ... in the
  // schema cache" (PGRST205 = tabela). Foi a causa raiz do incidente da v0.22.1 (edição
  // do Corsário); reconhecido aqui pra virar mensagem acionável em vez de "falhou".
  function ehErroDeCacheSchema(err) {
    const c = codigoErro(err);
    if (c === "PGRST204" || c === "PGRST205") return true;
    return String((err && err.message) || "").toLowerCase().indexOf("schema cache") !== -1;
  }

  const MENSAGEM_SEM_PERMISSAO = "Sem permissão de escrita — fale com o JR.";
  const MENSAGEM_SCHEMA = "Não foi possível salvar — o ambiente precisa de um ajuste. Fale com o JR.";
  // mensagem pronta pra tela quando a causa é reconhecível; null quando não é (quem chama
  // decide o que fazer com outros tipos de erro — rede fora do ar, etc. — que continuam
  // mostrando o err.message de sempre, informação operacional útil, não um stacktrace).
  function mensagemEscritaAmigavel(err) {
    if (ehErroDePermissao(err) || ehZeroLinhasEmEscrita(err)) return MENSAGEM_SEM_PERMISSAO;
    if (ehErroDeCacheSchema(err)) return MENSAGEM_SCHEMA;
    return null;
  }

  // detalhe técnico compacto pra `title`/tooltip e diagnóstico — "PGRST116: mensagem".
  // Nunca vai pro corpo visível da tela (linguagem de negócio, v0.27.0), só pro hover de
  // quem for investigar, pra não obrigar a abrir o console do navegador como no incidente
  // do Corsário.
  function detalheErro(err) {
    if (!err) return "";
    const cod = codigoErro(err);
    const msg = (err && err.message) || String(err);
    return (cod ? cod + ": " : "") + msg;
  }

  // item 3.4 (P13) — os dois clients ficam em cache (acima) com os headers já "assados"
  // desde a criação; se o nome do editor trocar no meio da sessão (rodapé "editando
  // como… trocar", js/editor_atual.js), o client em cache continuaria mandando o nome
  // ANTIGO em x-cc-editor. resetarClientes() limpa os dois caches — a próxima chamada a
  // obterClienteClassico()/obterClienteEsm() recria o client do zero, com o header
  // atualizado, sem precisar recarregar a página inteira.
  function resetarClientes() {
    clienteClassico = null;
    promessaClienteEsm = null;
  }

  const CC_SUPABASE = {
    obterClienteClassico: obterClienteClassico,
    obterClienteEsm: obterClienteEsm,
    clientePrincipal: clientePrincipal,
    headersComToken: headersComToken,
    resetarClientes: resetarClientes,
    ehErroDePermissao: ehErroDePermissao,
    ehZeroLinhasEmEscrita: ehZeroLinhasEmEscrita,
    ehErroDeCacheSchema: ehErroDeCacheSchema,
    mensagemEscritaAmigavel: mensagemEscritaAmigavel,
    detalheErro: detalheErro,
    MENSAGEM_SEM_PERMISSAO: MENSAGEM_SEM_PERMISSAO,
    MENSAGEM_SCHEMA: MENSAGEM_SCHEMA,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = CC_SUPABASE;
  else root.CC_SUPABASE = CC_SUPABASE;
})(this);
