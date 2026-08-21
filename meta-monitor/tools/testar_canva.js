/* Teste da camada de dados do canvas das oficinas (js/db-canva.js) — roda por node,
   sem navegador e sem tocar o Supabase. O que garante:

   - a regra do rodapé do .docx ("nenhuma linha sai da mesa sem responsável e prazo")
     segura a demanda no estado "incompleta" e ela NÃO é enviada;
   - o caderno sobrevive a recarregar a página (localStorage falso), com a mesma sessão
     enquanto ela tiver menos de 24h;
   - falha de REDE não vira "erro" pro gestor: volta pra "pendente" e o reenvio pega de
     onde parou — o cenário normal de sala de oficina com WiFi ruim;
   - recusa de CONTEÚDO (o {ok:false, erro} da função SQL) vira "erro" com a frase do
     banco, sem inventar uma segunda redação da mesma regra;
   - demanda já gravada é atualizada por cc_canva_editar (com id), não duplicada por
     cc_canva_gravar.

   O client do Supabase é falso (CC_SUPABASE abaixo): o contrato real das RPCs está
   coberto pelos SELECTs de verificação de tools/sql/2026-08_canva_demandas.sql. */
const path = require("path");

let erros = 0;
function checa(nome, cond) {
  if (cond) console.log("  ok:", nome);
  else { console.error("  FALHA:", nome); erros++; }
}

/* ---- ambiente de navegador de mentira, o mínimo que db-canva.js encosta ---- */
const loja = {};
global.localStorage = {
  getItem: (k) => (Object.prototype.hasOwnProperty.call(loja, k) ? loja[k] : null),
  setItem: (k, v) => { loja[k] = String(v); },
  removeItem: (k) => { delete loja[k]; },
};

// fila de respostas que o "banco" vai devolver, na ordem; cada item é {resposta} ou {erro}
let roteiro = [];
const chamadas = [];
global.CC_SUPABASE = {
  obterClienteEsm: async () => ({
    rpc: async (nome, args) => {
      chamadas.push({ nome, payload: args.p });
      const passo = roteiro.shift() || { resposta: { ok: true, id: 900 + chamadas.length } };
      if (passo.erro) throw passo.erro;
      return { data: passo.resposta, error: null };
    },
  }),
  // classificador real de js/supabase.js: é ele que separa "rede caiu" de "RLS negou"
  mensagemEscritaAmigavel: require(path.join(__dirname, "..", "js", "supabase.js")).mensagemEscritaAmigavel,
};

const DB = require(path.join(__dirname, "..", "js", "db-canva.js"));
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const DEPOIS_DO_DEBOUNCE = DB.DEBOUNCE_MS + 250;

const BASE = {
  canal: "empresa",
  servico: "Consumo da base filtrada",
  problema: "Não sabemos quais empresas atendidas cabem no edital",
  canal_proprio: "nao",
  responsavel: "Agnaldo",
  prazo: "2026-10-30",
};

(async function () {
  /* --- 1. incompleta não sobe --- */
  console.log("1) responsável e prazo obrigatórios");
  let caderno = DB.carregarCaderno("Embrapii");
  DB.definirAutor(caderno, "Agnaldo");
  const semPrazo = DB.salvarDemanda(caderno, Object.assign({}, BASE, { prazo: "" }));
  checa("sem prazo fica incompleta", semPrazo.estado === "incompleta");
  checa("estaCompleta() concorda", DB.estaCompleta(semPrazo) === false);
  const semResp = DB.salvarDemanda(caderno, Object.assign({}, BASE, { responsavel: "  " }));
  checa("sem responsável fica incompleta", semResp.estado === "incompleta");
  await espera(DEPOIS_DO_DEBOUNCE);
  checa("nenhuma das duas foi enviada", chamadas.length === 0);
  checa("resumo conta 2 incompletas", DB.resumo(caderno).incompletas === 2);
  checa("problemas() aponta o prazo", DB.problemas(semPrazo).some((p) => p.campo === "prazo"));

  /* --- 2. completa sobe, com debounce, e vira "salva" --- */
  console.log("2) demanda completa é enviada e confirmada");
  roteiro = [{ resposta: { ok: true, id: 41, projeto_novo: false, nucleo: "Tecnologias Portadoras de Futuro" } }];
  const boa = DB.salvarDemanda(caderno, BASE);
  checa("fica pendente na hora, sem esperar rede", boa.estado === "pendente");
  checa("ainda não chamou o banco (debounce)", chamadas.length === 0);
  await espera(DEPOIS_DO_DEBOUNCE);
  checa("chamou cc_canva_gravar", chamadas.length === 1 && chamadas[0].nome === DB.RPC_GRAVAR);
  checa("estado virou salva", boa.estado === "salva");
  checa("guardou o id devolvido pela RPC", boa.id === 41);
  checa("guardou o núcleo do golden record", caderno.nucleo === "Tecnologias Portadoras de Futuro");
  checa("payload leva a sessão", !!chamadas[0].payload.sessao_id);
  checa("payload leva o honeypot vazio", chamadas[0].payload.empresa_site === "");
  checa("payload leva o projeto e o autor", chamadas[0].payload.projeto === "Embrapii" && chamadas[0].payload.autor_nome === "Agnaldo");

  /* --- 3. releitura: o caderno sobrevive a recarregar a aba --- */
  console.log("3) o caderno sobrevive ao F5");
  const relido = DB.carregarCaderno("Embrapii");
  checa("mesma sessão (menos de 24h)", relido.sessao_id === caderno.sessao_id);
  checa("as 3 demandas voltaram", relido.demandas.length === 3);
  checa("a salva voltou com id", relido.demandas.some((d) => d.id === 41 && d.estado === "salva"));
  checa("chave do localStorage é cc_canva_<slug>_<sessao>",
    DB.chaveDoCaderno("Embrapii", relido.sessao_id) === "cc_canva_embrapii_" + relido.sessao_id);

  /* --- 4. rede fora não vira "erro" pro gestor --- */
  console.log("4) WiFi da oficina caindo");
  chamadas.length = 0;
  roteiro = [{ erro: new TypeError("Failed to fetch") }];
  const offline = DB.salvarDemanda(caderno, Object.assign({}, BASE, { canal: "portal", servico: "Banner com QR" }));
  await espera(DEPOIS_DO_DEBOUNCE);
  checa("tentou uma vez", chamadas.length === 1);
  checa("continua pendente, não vira erro", offline.estado === "pendente");
  checa("marcada como offline pra tela avisar", offline.offline === true);
  checa("não mostra frase de erro pro gestor", !offline.erro);

  console.log("   ... e o reenvio pega de onde parou");
  roteiro = [{ resposta: { ok: true, id: 42 } }];
  await DB.enviarAgora(caderno);
  checa("agora salvou", offline.estado === "salva" && offline.id === 42);
  checa("não duplicou: 2 chamadas no total", chamadas.length === 2);

  /* --- 5. recusa de conteúdo do banco vira erro com a frase do banco --- */
  console.log("5) recusa de conteúdo");
  chamadas.length = 0;
  roteiro = [{ resposta: { ok: false, erro: "Prazo fora da janela — use uma data entre 30 dias atrás e 2 anos à frente.", campo: "prazo" } }];
  const recusada = DB.salvarDemanda(caderno, Object.assign({}, BASE, { canal: "cnr", servico: "Fila do CNR", prazo: "2031-01-01" }));
  await espera(DEPOIS_DO_DEBOUNCE);
  checa("estado vira erro", recusada.estado === "erro");
  checa("mostra a frase que veio do banco", /Prazo fora da janela/.test(recusada.erro));
  checa("sabe qual campo culpar", recusada.campo_erro === "prazo");

  /* --- 6. editar uma demanda já gravada usa cc_canva_editar, não regrava --- */
  console.log("6) correção de typo depois de salva");
  chamadas.length = 0;
  roteiro = [{ resposta: { ok: true, id: 41 } }];
  DB.salvarDemanda(caderno, { chave_local: boa.chave_local, servico: "Consumo da base filtrada (corrigido)" });
  await espera(DEPOIS_DO_DEBOUNCE);
  checa("chamou cc_canva_editar", chamadas.length === 1 && chamadas[0].nome === DB.RPC_EDITAR);
  checa("mandou o id da linha", chamadas[0].payload.id === 41);
  checa("não criou demanda nova", caderno.demandas.filter((d) => d.id === 41).length === 1);

  /* --- 7. mini-matriz do gestor: contagem por canal --- */
  console.log("7) contagem por canal (a mini-matriz)");
  const porCanal = DB.contarPorCanal(caderno);
  checa("os 10 canais aparecem, mesmo zerados", Object.keys(porCanal).length === 10);
  checa("empresa tem 3 (1 completa + 2 incompletas)", porCanal.empresa === 3);
  checa("portal tem 1", porCanal.portal === 1);
  checa("foco tem 0 — a pergunta silenciosa", porCanal.foco === 0);

  /* --- 8. honeypot: ok sem id não pode virar erro eterno --- */
  console.log("8) honeypot");
  chamadas.length = 0;
  roteiro = [{ resposta: { ok: true, id: null, ignorado: true } }];
  const hp = DB.salvarDemanda(caderno, Object.assign({}, BASE, { canal: "loja", servico: "Loja", empresa_site: "http://spam" }));
  await espera(DEPOIS_DO_DEBOUNCE);
  checa("passa o campo escondido adiante", chamadas[0].payload.empresa_site === "http://spam");
  checa("ok sem id conta como salva (não trava o humano)", hp.estado === "salva");

  console.log(erros ? `\nFALHOU — ${erros} checagem(ns)` : "\nCANVA OK — todas as checagens passaram");
  process.exit(erros ? 1 : 0);
})();
