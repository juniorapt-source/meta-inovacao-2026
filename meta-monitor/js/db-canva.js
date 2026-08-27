/* Camada de dados do CANVAS DE DEMANDAS das oficinas (item 2 do plano "canvas
 * preenchido direto no site") — window.DB_CANVA. Consumida por canva.html (item 3).
 *
 * Difere de todos os outros js/db-*.js deste projeto em duas coisas, e as duas vêm da
 * mesma decisão de produto (link aberto, sem login, preenchido na sala da oficina):
 *
 *   1. NÃO faz SELECT nem INSERT na tabela. A tabela meta_inovacao_canva_demandas não
 *      dá GRANT nenhum pro anon (tools/sql/2026-08_canva_demandas.sql, exceção 2) — a
 *      única porta é o par de RPCs cc_canva_gravar/cc_canva_editar. Consequência
 *      prática pra quem mexer aqui: nada de encadear .select() nas chamadas, o retorno
 *      da RPC já traz o id gerado.
 *   2. O que o gestor preencheu é lido do localStorage, não do banco — ele não tem
 *      permissão de leitura, e é ele mesmo quem acabou de digitar. Chave
 *      "cc_canva_<projeto_slug>_<sessao_id>" (§6.5 do plano).
 *
 * Sala de oficina com WiFi ruim é o cenário normal, não a exceção: toda demanda é
 * gravada PRIMEIRO no localStorage e só depois enviada. Se o envio falhar (offline,
 * rede corporativa bloqueando, 4G oscilando), a demanda continua na fila local e é
 * reenviada sozinha na próxima tentativa — nada de "enviar tudo" no fim, porque alguém
 * vai fechar a aba antes.
 *
 * ESTADOS de uma demanda (o que a tela mostra em cada cartão):
 *   "incompleta" → falta responsável ou prazo. NÃO é enviada — a regra do rodapé do
 *                  .docx ("nenhuma linha sai da mesa sem responsável e prazo"), que no
 *                  banco é CHECK constraint e aqui é botão desabilitado com o motivo.
 *   "pendente"   → completa, esperando envio (ou esperando o debounce).
 *   "salvando"   → chamada em voo.
 *   "salva"      → o banco confirmou e devolveu o id.
 *   "erro"       → o banco recusou por conteúdo (frase pronta em .erro, mostrar pro
 *                  gestor). Só sai desse estado quando ele corrigir e salvar de novo.
 * Falha de REDE não vira "erro": volta pra "pendente" e tenta de novo — o gestor não
 * tem o que corrigir quando o problema é o WiFi.
 *
 * Carrega DEPOIS de js/config.js e js/supabase.js. Usa obterClienteEsm() (import()
 * dinâmico) porque canva.html é página de destino de QR e não carrega o <script> do CDN
 * clássico — mesmo caminho de plano-acao.html/minhas-acoes.html.
 */
(function (root) {
  "use strict";

  const RPC_GRAVAR = "cc_canva_gravar";
  const RPC_EDITAR = "cc_canva_editar";
  const PREFIXO_CHAVE = "cc_canva_";
  const VALIDADE_SESSAO_MS = 24 * 60 * 60 * 1000;  // §6.4: linha só é editável por 24h
  const DEBOUNCE_MS = 1500;                        // §7 comportamento 2
  const MAX_CAMPO = 2000;                          // espelha o teto da função SQL (§6.3)
  const ESPERA_RETENTATIVA_MS = 8000;              // rede fora: espera antes de reenfileirar sozinho

  // Os 10 canais fixos. QUINTO lugar onde eles aparecem (data/canais.js, data/matriz.js,
  // dropdown de demandas.html, whitelist da função SQL) — mas aqui é só pra não mandar
  // pro banco o que a gente já sabe que ele vai recusar; a whitelist que MANDA continua
  // sendo a da função SQL. Canal novo: bater nos cinco.
  const CANAIS = ["foco", "cnr", "empresa", "portal", "mkt", "loja", "rede", "assessoria", "dxp", "contab"];

  /* ---------------------------------------------------------------- utilidades */

  function agora() { return Date.now(); }

  function texto(v) { return String(v == null ? "" : v).trim(); }

  // slug do projeto pra compor a chave do localStorage: minúsculas, sem acento, só
  // [a-z0-9-]. Mesma ideia da cc_canva_normalizar() do banco, mas aqui o resultado é
  // uma CHAVE de armazenamento local, não um casamento com o golden record — quem
  // decide se o projeto existe continua sendo a função SQL.
  function slug(nome) {
    return texto(nome)
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")  // tira os acentos que o NFD separou
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "sem-projeto";
  }

  function novoUuid() {
    try {
      if (root.crypto && root.crypto.randomUUID) return root.crypto.randomUUID();
    } catch (e) { /* segue pro fallback */ }
    // fallback pra navegador antigo ou contexto sem crypto (http:// puro, file://):
    // não precisa ser criptograficamente forte — sessao_id é dono-da-linha numa tela
    // sem login, não credencial. Precisa só não colidir na mesma sala.
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // localStorage pode não existir (modo privado restrito, iframe com storage bloqueado,
  // file://). Nesses casos a página continua funcionando NA MEMÓRIA desta carga — o
  // gestor preenche e envia igual, só perde o "recarregar e ver o que já mandei".
  const memoria = {};
  function lerChave(chave) {
    try {
      const bruto = root.localStorage && root.localStorage.getItem(chave);
      if (bruto) return JSON.parse(bruto);
    } catch (e) { /* corrompido ou indisponível — cai pra memória */ }
    return memoria[chave] || null;
  }
  function gravarChave(chave, valor) {
    memoria[chave] = valor;
    try {
      if (root.localStorage) root.localStorage.setItem(chave, JSON.stringify(valor));
    } catch (e) { /* cota estourada ou storage bloqueado — segue só em memória */ }
  }

  // mesmo mecanismo de teste dos outros db-*.js: ?semrede=1 (ou window.CC_FORCAR_FALLBACK)
  // deixa a tela funcionar inteira sem tocar o banco — indispensável pra ensaiar a
  // oficina, e pros testes headless não gravarem demanda de mentira em produção.
  function forcarFallback() {
    if (root.CC_FORCAR_FALLBACK) return true;
    try { return new URLSearchParams(root.location.search).get("semrede") === "1"; } catch (e) { return false; }
  }

  /* ------------------------------------------------------------------- sessão */

  // Uma sessão por projeto: o gestor que troca de projeto no meio começa uma lista
  // nova, e a lista antiga continua guardada (ele pode voltar). Se a sessão daquele
  // projeto tem menos de 24h, é reusada — assim recarregar a aba (ou o WiFi cair e
  // ele reabrir o QR) recupera o que já foi enviado, e as linhas continuam editáveis
  // pela regra dos 24h da cc_canva_editar.
  const CHAVE_SESSOES = PREFIXO_CHAVE + "sessoes";

  function sessaoDoProjeto(projeto) {
    const s = slug(projeto);
    const mapa = lerChave(CHAVE_SESSOES) || {};
    const atual = mapa[s];
    if (atual && atual.sessao_id && (agora() - (atual.criada_em || 0)) < VALIDADE_SESSAO_MS) {
      return atual.sessao_id;
    }
    const nova = { sessao_id: novoUuid(), criada_em: agora() };
    mapa[s] = nova;
    gravarChave(CHAVE_SESSOES, mapa);
    return nova.sessao_id;
  }

  function chaveDoCaderno(projeto, sessaoId) {
    return PREFIXO_CHAVE + slug(projeto) + "_" + sessaoId;
  }

  // item 3.1 (redesenho checklist) do plano de melhorias de navegação — hoje não existe
  // nenhuma chave persistindo "quais projetos o gestor marcou" (só existe "qual caderno
  // cada projeto tem", em CHAVE_SESSOES). Chave nova, mesmo padrão de PREFIXO_CHAVE.
  // Guarda a lista de NOMES de projeto (não slugs) que estão marcados no checklist,
  // pra F5 restaurar a seleção antes de a tela decidir quais cadernos carregar.
  const CHAVE_SELECAO = PREFIXO_CHAVE + "selecao";

  function salvarSelecaoProjetos(lista) {
    const nomes = (Array.isArray(lista) ? lista : [])
      .map(function (p) { return texto(p); })
      .filter(function (p) { return p.length > 0; });
    gravarChave(CHAVE_SELECAO, nomes);
    return nomes;
  }

  function carregarSelecaoProjetos() {
    const guardado = lerChave(CHAVE_SELECAO);
    return Array.isArray(guardado) ? guardado : [];
  }

  // item 3 do plano de melhorias de navegação (26/08) — "responder por mais de um
  // projeto": a tela já suportava trocar de projeto sem perder nada (sessão é por
  // PROJETO, comentário acima), só faltava mostrar isso. CHAVE_SESSOES já lista todo
  // projeto com sessão neste navegador; aqui só junta com o caderno de cada um e devolve
  // os que têm pelo menos 1 demanda — projeto aberto mas nunca preenchido não entra.
  function projetosRespondidosLocalmente() {
    const mapa = lerChave(CHAVE_SESSOES) || {};
    const resultado = [];
    Object.keys(mapa).forEach((slugProjeto) => {
      const sessaoId = mapa[slugProjeto] && mapa[slugProjeto].sessao_id;
      if (!sessaoId) return;
      const caderno = lerChave(PREFIXO_CHAVE + slugProjeto + "_" + sessaoId);
      const qtd = caderno && Array.isArray(caderno.demandas) ? caderno.demandas.length : 0;
      if (qtd > 0) resultado.push({ projeto: caderno.projeto, quantidade: qtd });
    });
    return resultado;
  }

  /* ------------------------------------------------------- caderno local (estado) */

  // "caderno" = tudo que este gestor preencheu neste projeto nesta sessão. É a fonte da
  // verdade da TELA; o banco é o destino. Estrutura:
  //   { projeto, sessao_id, autor_nome, projeto_novo, demandas: [ {...} ] }
  // Cada demanda tem uma "chave_local" (uuid) que nasce antes de existir id no banco —
  // é ela que liga o cartão da tela à linha, inclusive enquanto o envio não voltou.

  function cadernoVazio(projeto, sessaoId) {
    return { projeto: texto(projeto), sessao_id: sessaoId, autor_nome: "", projeto_novo: false, demandas: [] };
  }

  function carregarCaderno(projeto) {
    const sessaoId = sessaoDoProjeto(projeto);
    const guardado = lerChave(chaveDoCaderno(projeto, sessaoId));
    if (guardado && Array.isArray(guardado.demandas)) {
      guardado.sessao_id = sessaoId;          // a sessão manda, não o que estava salvo
      guardado.projeto = texto(projeto);
      return guardado;
    }
    return cadernoVazio(projeto, sessaoId);
  }

  function salvarCaderno(caderno) {
    gravarChave(chaveDoCaderno(caderno.projeto, caderno.sessao_id), caderno);
    return caderno;
  }

  /* --------------------------------------------------------------- validação local */

  // Espelha as recusas da função SQL que a tela consegue evitar ANTES de gastar uma
  // ida à rede — não substitui a validação do banco (essa é a que vale), evita o
  // vaivém. Devolve [] quando está tudo certo.
  function problemas(d) {
    const p = [];
    if (!texto(d.servico)) p.push({ campo: "servico", frase: "Falta o serviço apresentado." });
    if (!texto(d.problema)) p.push({ campo: "problema", frase: "Falta a dor que esse serviço endereça." });
    if (CANAIS.indexOf(texto(d.canal)) === -1) p.push({ campo: "canal", frase: "Escolha um dos 10 canais." });
    if (["sim", "nao", "nao_sei"].indexOf(texto(d.canal_proprio)) === -1) {
      p.push({ campo: "canal_proprio", frase: "Responda se o serviço já existe em canal próprio." });
    }
    if (texto(d.canal_proprio) === "sim" && !texto(d.canal_proprio_qual)) {
      p.push({ campo: "canal_proprio_qual", frase: "Diga qual é o canal próprio." });
    }
    // a regra do rodapé do .docx, por último de propósito: é a que a tela mostra no
    // selo "incompleta", e ler ela junto das outras confunde
    if (!texto(d.responsavel)) p.push({ campo: "responsavel", frase: "Nenhuma linha sai da mesa sem responsável." });
    if (!texto(d.prazo)) p.push({ campo: "prazo", frase: "Nenhuma linha sai da mesa sem prazo." });
    ["servico", "problema", "bloqueio", "responsavel", "canal_proprio_qual"].forEach(function (c) {
      if (texto(d[c]).length > MAX_CAMPO) p.push({ campo: c, frase: "Texto longo demais — resuma em até 2000 caracteres." });
    });
    return p;
  }

  // o que o selo "incompleta" checa, isolado: sem isso a tela teria que reimplementar
  // "tem responsável E tem prazo" e as duas regras iam divergir com o tempo.
  function estaCompleta(d) {
    return !!(texto(d && d.responsavel) && texto(d && d.prazo));
  }

  function podeEnviar(d) {
    return problemas(d).length === 0;
  }

  /* ------------------------------------------------------------------- ouvintes */

  const ouvintes = [];
  function assinar(fn) {
    if (typeof fn === "function") ouvintes.push(fn);
    return function cancelar() {
      const i = ouvintes.indexOf(fn);
      if (i !== -1) ouvintes.splice(i, 1);
    };
  }
  function notificar(caderno) {
    ouvintes.forEach(function (fn) { try { fn(caderno); } catch (e) { /* isola ouvinte */ } });
  }

  /* ----------------------------------------------------------------- chamada RPC */

  async function chamarRpc(nome, payload) {
    if (!root.CC_SUPABASE) throw new Error("js/supabase.js não carregado.");
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    // sem .select() encadeado, de propósito: quem responde é a função, não a tabela
    // (o anon não tem GRANT de leitura pra encadear nada).
    const { data, error } = await supa.rpc(nome, { p: payload });
    if (error) throw error;
    return data || {};
  }

  // Erro de REDE (offline, DNS, TLS, rede corporativa bloqueando o domínio) é diferente
  // de erro de CONTEÚDO: o primeiro se resolve tentando de novo, o segundo só se o
  // gestor corrigir. A função SQL nunca levanta exceção por conteúdo — ela devolve
  // {ok:false, erro}. Então qualquer exceção que chegue aqui é, por eliminação,
  // infraestrutura: rede, RLS ou cache de schema do PostgREST. Só os dois últimos são
  // permanentes, e CC_SUPABASE já sabe reconhecê-los.
  function ehFalhaDeRede(err) {
    if (root.CC_SUPABASE && root.CC_SUPABASE.mensagemEscritaAmigavel && root.CC_SUPABASE.mensagemEscritaAmigavel(err)) {
      return false;  // permissão ou cache de schema — tentar de novo não resolve
    }
    return true;
  }

  /* -------------------------------------------------------------- fila de envio */

  // uma fila por caderno, serial: duas gravações simultâneas da mesma sessão poderiam
  // furar o teto de 20 do banco por corrida, e o gestor não ganha nada com paralelismo
  // (ele preenche um cartão por vez).
  const timers = {};      // chave_local -> handle do debounce
  let rodando = false;

  function pendentes(caderno) {
    return caderno.demandas.filter(function (d) {
      return (d.estado === "pendente" || d.estado === "salvando") && podeEnviar(d);
    });
  }

  function payloadDe(caderno, d) {
    return {
      projeto: caderno.projeto,
      canal: d.canal,
      servico: d.servico,
      problema: d.problema,
      bloqueio: d.bloqueio || null,
      canal_proprio: d.canal_proprio,
      canal_proprio_qual: d.canal_proprio_qual || null,
      responsavel: d.responsavel,
      prazo: d.prazo,
      facilitador: d.facilitador || null,
      ciclo: d.ciclo || null,
      encontro_id: d.encontro_id || null,
      autor_nome: caderno.autor_nome,
      sessao_id: caderno.sessao_id,
      // honeypot (§6.6): a tela mantém um campo escondido por CSS chamado empresa_site.
      // Humano nunca preenche. Vai vazio daqui; se um bot preencher o input, a tela
      // passa o valor e a função responde "ok" sem gravar nada.
      empresa_site: d.empresa_site || "",
    };
  }

  // Envia (ou reenvia) tudo que está pendente, uma demanda por vez. Nunca lança: quem
  // chama é um debounce ou o "tentar de novo" da tela, e uma exceção solta aí viraria
  // unhandledrejection sem ninguém pra tratar. O resultado aparece no estado das
  // demandas e chega na tela pelos ouvintes.
  async function processarFila(caderno) {
    if (rodando) return caderno;
    rodando = true;
    try {
      if (forcarFallback()) {
        // modo de teste: marca como salva sem tocar a rede, pra ensaiar a oficina
        // inteira (e rodar teste headless) sem gravar demanda de mentira em produção.
        caderno.demandas.forEach(function (d) {
          if (d.estado === "pendente" && podeEnviar(d)) { d.estado = "salva"; d.erro = null; d.simulada = true; }
        });
        salvarCaderno(caderno); notificar(caderno);
        return caderno;
      }

      let fila = pendentes(caderno);
      while (fila.length) {
        const d = fila[0];
        d.estado = "salvando";
        d.erro = null;
        salvarCaderno(caderno); notificar(caderno);

        let resposta = null;
        try {
          resposta = d.id
            ? await chamarRpc(RPC_EDITAR, Object.assign(payloadDe(caderno, d), { id: d.id }))
            : await chamarRpc(RPC_GRAVAR, payloadDe(caderno, d));
        } catch (err) {
          if (ehFalhaDeRede(err)) {
            // não é culpa do gestor e não tem o que corrigir — fica pendente e a tela
            // mostra "sem conexão, vamos tentar de novo", não "erro".
            d.estado = "pendente";
            d.offline = true;
            d.erro = null;
            salvarCaderno(caderno); notificar(caderno);
            agendarRetentativa(caderno);
            return caderno;   // rede fora: não adianta varrer o resto da fila agora
          }
          d.estado = "erro";
          d.offline = false;
          d.erro = (root.CC_SUPABASE && root.CC_SUPABASE.mensagemEscritaAmigavel && root.CC_SUPABASE.mensagemEscritaAmigavel(err))
            || (err && err.message) || String(err);
          salvarCaderno(caderno); notificar(caderno);
          fila = pendentes(caderno);
          continue;
        }

        d.offline = false;
        if (resposta && resposta.ok) {
          // honeypot disparado: o banco responde ok e não grava. Do lado de cá isso
          // chega como ok:true sem id — tratar como salva mesmo assim, senão um humano
          // preso num autofill agressivo do navegador ficaria olhando "erro" pra
          // sempre sem entender o motivo.
          if (resposta.id) d.id = resposta.id;
          d.estado = "salva";
          d.erro = null;
          if (typeof resposta.projeto_novo === "boolean") caderno.projeto_novo = resposta.projeto_novo;
          if (resposta.nucleo) caderno.nucleo = resposta.nucleo;
        } else {
          // recusa de conteúdo: a frase já vem pronta pra tela, escrita no banco pra
          // não existirem duas redações da mesma regra.
          d.estado = "erro";
          d.erro = (resposta && resposta.erro) || "Não deu pra salvar esta demanda.";
          d.campo_erro = (resposta && resposta.campo) || null;
        }
        salvarCaderno(caderno); notificar(caderno);
        fila = pendentes(caderno);
      }
      return caderno;
    } finally {
      rodando = false;
    }
  }

  let timerRetentativa = null;
  function agendarRetentativa(caderno) {
    if (timerRetentativa) return;
    timerRetentativa = setTimeout(function () {
      timerRetentativa = null;
      processarFila(caderno);
    }, ESPERA_RETENTATIVA_MS);
  }

  /* --------------------------------------------------------------- API da tela */

  // Cria (ou atualiza) uma demanda no caderno e agenda o envio. É o ponto de entrada
  // único da tela: o cartão chama isto ao fechar/ao mudar campo, e o debounce de 1,5s
  // junta as digitações. Devolve a demanda (com chave_local) na hora, sem esperar rede.
  function salvarDemanda(caderno, dados) {
    const chave = dados.chave_local || novoUuid();
    let d = caderno.demandas.filter(function (x) { return x.chave_local === chave; })[0];
    if (!d) {
      d = { chave_local: chave, id: null, estado: "pendente", erro: null, criada_em: agora() };
      caderno.demandas.push(d);
    }
    ["canal", "servico", "problema", "bloqueio", "canal_proprio", "canal_proprio_qual",
     "responsavel", "prazo", "facilitador", "ciclo", "encontro_id", "empresa_site"].forEach(function (c) {
      if (Object.prototype.hasOwnProperty.call(dados, c)) d[c] = dados[c];
    });

    // uma demanda sem responsável ou sem prazo fica no caderno e NÃO vai pro banco —
    // o selo "incompleta" da tela sai daqui. Estado "erro" preservado só é limpo
    // quando o gestor mexe em algo, que é exatamente o caso aqui.
    // Nota: se ela JÁ tinha subido (tem d.id) e o gestor apagou o responsável agora, a
    // linha do banco fica com o conteúdo anterior até ele completar de novo. É o
    // comportamento honesto — o banco tem CHECK de responsável/prazo, não daria pra
    // gravar o estado incompleto nem se a gente quisesse.
    if (!estaCompleta(d)) {
      d.estado = "incompleta";
      d.erro = null;
      salvarCaderno(caderno); notificar(caderno);
      return d;
    }
    const faltando = problemas(d);
    if (faltando.length) {
      d.estado = "incompleta";
      d.erro = faltando[0].frase;
      salvarCaderno(caderno); notificar(caderno);
      return d;
    }

    d.estado = "pendente";
    d.erro = null;
    salvarCaderno(caderno); notificar(caderno);

    if (timers[chave]) clearTimeout(timers[chave]);
    timers[chave] = setTimeout(function () {
      delete timers[chave];
      processarFila(caderno);
    }, DEBOUNCE_MS);

    return d;
  }

  // "tentar de novo" do cartão em erro, e o botão de reenviar tudo. Força a fila agora,
  // sem esperar o debounce.
  function enviarAgora(caderno) {
    Object.keys(timers).forEach(function (k) { clearTimeout(timers[k]); delete timers[k]; });
    caderno.demandas.forEach(function (d) {
      if (d.estado === "erro" && podeEnviar(d)) d.estado = "pendente";
    });
    return processarFila(caderno);
  }

  // Remove uma demanda. Se ela já chegou no banco, o soft delete vai junto (a função
  // cc_canva_editar aceita apagar:true, com a mesma checagem de dono/24h/rascunho);
  // se ainda não chegou, some só daqui. Não lança se o banco recusar — a linha sai da
  // tela de qualquer jeito e fica pro editor descartar na consolidação, o que é melhor
  // do que travar o gestor num cartão que ele já decidiu que não quer.
  async function removerDemanda(caderno, chaveLocal) {
    const i = caderno.demandas.findIndex(function (d) { return d.chave_local === chaveLocal; });
    if (i === -1) return caderno;
    const d = caderno.demandas[i];
    caderno.demandas.splice(i, 1);
    salvarCaderno(caderno); notificar(caderno);
    if (d.id && !forcarFallback()) {
      try {
        await chamarRpc(RPC_EDITAR, { id: d.id, sessao_id: caderno.sessao_id, apagar: true, autor_nome: caderno.autor_nome });
      } catch (e) {
        console.warn("db-canva: não deu pra apagar a demanda no banco — fica pro editor descartar na consolidação.", e);
      }
    }
    return caderno;
  }

  function definirAutor(caderno, nome) {
    caderno.autor_nome = texto(nome);
    salvarCaderno(caderno); notificar(caderno);
    return caderno;
  }

  // Contagem por canal — é o que a mini-matriz do gestor (§7, passo 2) desenha em
  // "3 demandas" / "nenhuma demanda". Conta o que está no caderno, incluindo o que
  // ainda não subiu: pro gestor, o que ele acabou de escrever já conta.
  function contarPorCanal(caderno) {
    const mapa = {};
    CANAIS.forEach(function (c) { mapa[c] = 0; });
    (caderno.demandas || []).forEach(function (d) {
      if (mapa[d.canal] != null) mapa[d.canal] += 1;
    });
    return mapa;
  }

  // Resumo pro rodapé da tela ("2 salvas · 1 esperando · 1 incompleta").
  function resumo(caderno) {
    const r = { total: 0, salvas: 0, pendentes: 0, incompletas: 0, erros: 0, offline: false };
    (caderno.demandas || []).forEach(function (d) {
      r.total += 1;
      if (d.estado === "salva") r.salvas += 1;
      else if (d.estado === "incompleta") r.incompletas += 1;
      else if (d.estado === "erro") r.erros += 1;
      else r.pendentes += 1;
      if (d.offline) r.offline = true;
    });
    return r;
  }

  const DB_CANVA = {
    CANAIS: CANAIS,
    RPC_GRAVAR: RPC_GRAVAR,
    RPC_EDITAR: RPC_EDITAR,
    DEBOUNCE_MS: DEBOUNCE_MS,
    VALIDADE_SESSAO_MS: VALIDADE_SESSAO_MS,

    slug: slug,
    novoUuid: novoUuid,
    sessaoDoProjeto: sessaoDoProjeto,
    chaveDoCaderno: chaveDoCaderno,
    projetosRespondidosLocalmente: projetosRespondidosLocalmente,
    salvarSelecaoProjetos: salvarSelecaoProjetos,
    carregarSelecaoProjetos: carregarSelecaoProjetos,

    carregarCaderno: carregarCaderno,
    salvarCaderno: salvarCaderno,
    definirAutor: definirAutor,

    salvarDemanda: salvarDemanda,
    removerDemanda: removerDemanda,
    enviarAgora: enviarAgora,
    processarFila: processarFila,

    problemas: problemas,
    estaCompleta: estaCompleta,
    podeEnviar: podeEnviar,
    contarPorCanal: contarPorCanal,
    resumo: resumo,

    assinar: assinar,
  };

  // exportado como módulo também (igual js/supabase.js) pra dar pra testar a validação
  // e a máquina de estados por node, sem navegador — tools/testar_canva.js.
  if (typeof module !== "undefined" && module.exports) module.exports = DB_CANVA;
  else root.DB_CANVA = DB_CANVA;
// globalThis (e não `this`, como nos db-*.js mais antigos): no navegador dá exatamente
// no mesmo (globalThis === window), mas sob node `this` no topo do módulo é o
// module.exports, não o global — e aí root.CC_SUPABASE nunca seria encontrado e o
// módulo se comportaria como se estivesse offline pra sempre. Pego por
// tools/testar_canva.js, que só existe porque este arquivo é testável fora do browser.
})(typeof globalThis !== "undefined" ? globalThis : this);
