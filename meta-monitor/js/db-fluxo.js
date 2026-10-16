/* Camada de dados da frente "Fluxo de dados" (Projeto Corso) — window.DB_FLUXO.
 *
 * Lê as 5 tabelas fluxo_dados_* e as 3 views (matriz, rotas_lacunas, paineis_prontidao) do
 * Supabase; cai pro seed local (window.DB.fluxo_dados, data/fluxo_dados.js) se a rede ou
 * alguma tabela falhar, no mesmo espírito de js/db-base.js (modo de teste ?semrede=1/
 * CC_FORCAR_FALLBACK incluso).
 *
 * Por que NÃO usa DB_BASE.criarWrapper: a fábrica assume `deleted_at` (soft delete) e
 * `updated_by`; estas tabelas desativam por `ativo = false`, não têm essas colunas, e são
 * 8 fontes lidas juntas (uma falha derruba o conjunto, pra nunca mostrar matriz de uma
 * versão com painéis de outra). Só reaproveita DB_BASE.forcarFallback e as mensagens de
 * modo de teste.
 *
 * Regras de escrita (decisão do projeto): NUNCA DELETE — desativar é `ativo = false`. A
 * única exceção é fluxo_dados_painel_rotas (desvincular).
 */
(function (root) {
  "use strict";

  // no navegador raiz === root (window); em Node (testes) `this` do módulo é module.exports, então
  // quem testa define global.window e é de lá que saem DB/CC_SUPABASE/CC_FORCAR_FALLBACK.
  const raiz = (typeof window !== "undefined" && window) || root;
  const BASE = root.DB_BASE || (typeof globalThis !== "undefined" && globalThis.DB_BASE);
  if (!BASE) throw new Error("js/db-fluxo.js: js/db-base.js precisa ser carregado antes deste arquivo.");

  const TABELAS = {
    sistemas: "fluxo_dados_sistemas",
    rotas: "fluxo_dados_rotas",
    paineis: "fluxo_dados_paineis",
    painel_rotas: "fluxo_dados_painel_rotas",
    encaminhamentos: "fluxo_dados_encaminhamentos",
  };
  const VIEWS = {
    matriz: "fluxo_dados_matriz",
    rotas_lacunas: "fluxo_dados_rotas_lacunas",
    paineis_prontidao: "fluxo_dados_paineis_prontidao",
  };

  // ---- vocabulário (valores aceitos pelo banco, com rótulo de tela) ----
  const TIPOS_DADO = ["cliente", "atendimento", "processo"];
  const ROTULO_TIPO_DADO = { cliente: "Cliente", atendimento: "Atendimento", processo: "Processo", painel: "Painel" };
  // ordem = do pior pro melhor (é a ordem em que "status_pior" escolhe)
  const STATUS = ["entendimento", "a_iniciar", "andamento", "ok", "nao_se_aplica"];
  const ROTULO_STATUS = { entendimento: "Em entendimento", a_iniciar: "A iniciar", andamento: "Em andamento", ok: "Ok", nao_se_aplica: "Não se aplica" };
  const MECANISMOS = ["nenhum", "manual", "planilha", "importacao", "integracao", "a_definir"];
  const ROTULO_MECANISMO = { nenhum: "Nenhum", manual: "Manual", planilha: "Planilha", importacao: "Importação", integracao: "Integração", a_definir: "A definir" };
  const CHEGA_COMPLETO = ["sim", "parcial", "nao", "nao_sabe"];
  const ROTULO_CHEGA = { sim: "Sim", parcial: "Parcial", nao: "Não", nao_sabe: "Não sabe" };
  const OUTRA_FONTE = ["sim", "nao", "nao_sabe"];
  const ROTULO_OUTRA = { sim: "Sim", nao: "Não", nao_sabe: "Não sabe" };
  const STATUS_ENC = ["a_fazer", "andamento", "feito", "bloqueado", "cancelado"];
  const ROTULO_ENC = { a_fazer: "A fazer", andamento: "Em andamento", feito: "Feito", bloqueado: "Bloqueado", cancelado: "Cancelado" };
  const TIPOS_SISTEMA_SUGERIDOS = ["crm", "planilha", "plataforma", "bi", "banco", "dw", "outro"];

  function forcarFallback() { return BASE.forcarFallback(raiz); }

  function seed() {
    const s = (raiz.DB && raiz.DB.fluxo_dados) || {};
    const copia = {};
    Object.keys(TABELAS).concat(Object.keys(VIEWS)).forEach((k) => { copia[k] = (s[k] || []).slice(); });
    return copia;
  }

  async function cliente() { return await raiz.CC_SUPABASE.obterClienteEsm(); }

  async function lerTudo() {
    if (!raiz.CC_SUPABASE) throw new Error("js/supabase.js não carregado.");
    const supa = await cliente();
    const nomes = Object.keys(TABELAS).concat(Object.keys(VIEWS));
    const fontes = Object.assign({}, TABELAS, VIEWS);
    const resp = await Promise.all(nomes.map((k) => supa.from(fontes[k]).select("*")));
    const dados = {};
    resp.forEach((r, i) => {
      if (r.error) { const e = r.error; e.tabela = fontes[nomes[i]]; throw e; }
      dados[nomes[i]] = r.data || [];
    });
    return dados;
  }

  let promessa = null;
  async function carregar(opts) {
    if (promessa && !(opts && opts.recarregar)) return promessa;
    promessa = (async () => {
      if (forcarFallback()) return { dados: seed(), usandoFallback: true, motivoFallback: BASE.MOTIVO_MODO_TESTE };
      try {
        return { dados: await lerTudo(), usandoFallback: false, motivoFallback: null };
      } catch (err) {
        console.error("db-fluxo: falha ao carregar do Supabase, caindo pro seed local (data/fluxo_dados.js)", err);
        return { dados: seed(), usandoFallback: true, motivoFallback: mensagemErro(err) };
      }
    })();
    return promessa;
  }

  function bloquearEscritaEmTeste() {
    if (forcarFallback()) throw new Error(BASE.ERRO_ESCRITA_EM_TESTE);
  }

  // ---- escrita ----
  function tabelaValida(chave) {
    if (!TABELAS[chave] || chave === "painel_rotas") throw new Error("db-fluxo: tabela editável inválida: " + chave);
    return TABELAS[chave];
  }
  function limpar(campos) {
    const o = {};
    Object.keys(campos).forEach((k) => { const v = campos[k]; o[k] = (v === "" || v === undefined) ? null : v; });
    return o;
  }

  async function criar(chave, campos) {
    bloquearEscritaEmTeste();
    const supa = await cliente();
    const { data, error } = await supa.from(tabelaValida(chave)).insert(limpar(campos)).select().single();
    if (error) { error.tabela = TABELAS[chave]; error.operacao = "INSERT"; throw error; }
    return data;
  }
  async function salvar(chave, id, campos) {
    bloquearEscritaEmTeste();
    const supa = await cliente();
    const { data, error } = await supa.from(tabelaValida(chave)).update(limpar(campos)).eq("id", id).select().single();
    if (error) { error.tabela = TABELAS[chave]; error.operacao = "UPDATE"; throw error; }
    return data;
  }
  // desativar = ativo=false. Nunca DELETE.
  async function desativar(chave, id) { return salvar(chave, id, { ativo: false }); }
  async function reativar(chave, id) { return salvar(chave, id, { ativo: true }); }

  async function vincularPainelRota(painelId, rotaId) {
    bloquearEscritaEmTeste();
    const supa = await cliente();
    const { error } = await supa.from(TABELAS.painel_rotas).insert({ painel_id: painelId, rota_id: rotaId });
    if (error) { error.tabela = TABELAS.painel_rotas; error.operacao = "INSERT"; throw error; }
  }
  // única exceção ao "nunca DELETE"
  async function desvincularPainelRota(painelId, rotaId) {
    bloquearEscritaEmTeste();
    const supa = await cliente();
    const { error } = await supa.from(TABELAS.painel_rotas).delete().eq("painel_id", painelId).eq("rota_id", rotaId);
    if (error) { error.tabela = TABELAS.painel_rotas; error.operacao = "DELETE"; throw error; }
  }

  // ---- erro legível ----
  // 401/403/42501 aqui NÃO quer dizer necessariamente "token errado": as tabelas fluxo_dados_*
  // foram criadas à mão no SQL Editor, e um GRANT esquecido pra role anon dá exatamente o
  // mesmo sintoma de uma sessão sem permissão (já custou caro com a v0.29.0/P10).
  function mensagemErro(err) {
    if (!err) return "Erro desconhecido.";
    const S = raiz.CC_SUPABASE;
    const tab = err.tabela ? " na tabela " + err.tabela : "";
    const op = err.operacao ? " (" + err.operacao + ")" : "";
    const cod = String(err.code || "");
    const status = err.status || err.statusCode;
    const ehPerm = (S && S.ehErroDePermissao && S.ehErroDePermissao(err)) || (S && S.ehZeroLinhasEmEscrita && S.ehZeroLinhasEmEscrita(err));
    if (ehPerm || status === 401 || status === 403 || cod === "42501") {
      return "Sem permissão" + tab + op + ". Pode ser o token/modo de edição, mas também pode ser GRANT faltando para a role anon"
        + " (ou RLS sem policy) — confira os GRANTs dessa tabela no Supabase antes de investigar autenticação.";
    }
    if (cod === "PGRST205" || cod === "PGRST204" || /schema cache/i.test(String(err.message || ""))) {
      return "O banco ainda não enxerga" + (err.tabela ? " " + err.tabela : " essa tabela/coluna")
        + " (cache de schema da API). Recarregue o cache do PostgREST no Supabase.";
    }
    if (cod === "23505") return "Já existe um registro igual (valor repetido em campo único).";
    if (cod === "23514" || cod === "23502" || cod === "23503") return "O banco recusou os valores" + tab + ": " + (err.message || cod);
    return (err.message || String(err));
  }

  // ---- derivados puros (usados pelas telas e pelo teste) ----
  const ORDEM_PIOR = STATUS.slice(); // entendimento é o pior; "nao_se_aplica" nunca puxa pra baixo
  function piorStatus(lista) {
    const vistos = (lista || []).filter((s) => s && s !== "nao_se_aplica");
    if (!vistos.length) return (lista || []).length ? "nao_se_aplica" : null;
    return vistos.sort((a, b) => ORDEM_PIOR.indexOf(a) - ORDEM_PIOR.indexOf(b))[0];
  }
  // rota com status "ok" mas sem alvo definido = contradição (aviso, não erro)
  function rotasOkSemAlvo(dados) {
    return (dados.rotas_lacunas || []).filter((r) => r.status === "ok" && r.alvo_definido === false);
  }
  // encaminhamento fica "travado" enquanto a ação de que depende não está feita
  function encaminhamentoTravado(enc, porId) {
    if (!enc.depende_de_id) return false;
    const dep = porId[enc.depende_de_id];
    return !!dep && dep.status !== "feito" && dep.status !== "cancelado";
  }

  root.DB_FLUXO = {
    TABELAS: TABELAS, VIEWS: VIEWS,
    TIPOS_DADO: TIPOS_DADO, ROTULO_TIPO_DADO: ROTULO_TIPO_DADO,
    STATUS: STATUS, ROTULO_STATUS: ROTULO_STATUS,
    MECANISMOS: MECANISMOS, ROTULO_MECANISMO: ROTULO_MECANISMO,
    CHEGA_COMPLETO: CHEGA_COMPLETO, ROTULO_CHEGA: ROTULO_CHEGA,
    OUTRA_FONTE: OUTRA_FONTE, ROTULO_OUTRA: ROTULO_OUTRA,
    STATUS_ENC: STATUS_ENC, ROTULO_ENC: ROTULO_ENC,
    TIPOS_SISTEMA_SUGERIDOS: TIPOS_SISTEMA_SUGERIDOS,
    carregar: carregar, seed: seed,
    criar: criar, salvar: salvar, desativar: desativar, reativar: reativar,
    vincularPainelRota: vincularPainelRota, desvincularPainelRota: desvincularPainelRota,
    mensagemErro: mensagemErro,
    piorStatus: piorStatus, rotasOkSemAlvo: rotasOkSemAlvo, encaminhamentoTravado: encaminhamentoTravado,
    emModoTeste: forcarFallback,
  };
  if (typeof globalThis !== "undefined" && globalThis !== root) globalThis.DB_FLUXO = root.DB_FLUXO;
})(this);
