/* editor.html — helpers e caches genuinamente compartilhados entre as abas já extraídas
 * (Corsário, URC, Projetos, Pessoas, Plano) e as que ainda restam no inline.
 *
 * Fecha o círculo das 8 etapas de extração do inline de editor.html (ver BACKLOG.md,
 * "editor.html grande demais"): as 8 abas já viraram módulo próprio, mas 10 helpers +
 * EDITOR_PESSOAS_CACHE continuavam morando no IIFE de editor.html só porque nenhuma aba
 * sozinha era dona deles — expostos via window.X pras abas extraídas lerem, sem nenhum
 * consumidor dentro do próprio editor.html (D6.1 de PLANO_EXECUCAO_DEBITOS_TECNICOS.md).
 *
 * opts, avisoFallback, marcarLinhaStatus, marcarCelulaStatus, detErro,
 * normalizarNomePessoa, nomeExibicaoPessoa e NUCLEOS_VALIDOS são puros (sem estado
 * próprio) — mudar de arquivo não muda comportamento nenhum.
 *
 * nucleosPorNome() e projetoIdPorIniciativa() têm cache: nucleosAtual é privado deste
 * módulo (nenhuma outra aba precisava dele direto, só através da função). Já
 * projetoIdPorIniciativa() lê/escreve em window.EDITOR_PROJETOS_CACHE — que CONTINUA em
 * editor.html, ao lado da declaração de projetosAtual/projetosFallback/
 * projetosCarregando (ver js/editor-projetos.js) — em vez de fechar sobre a variável
 * direto como fazia antes: os dois moram em arquivos diferentes agora, então o
 * getter/setter (já a única porta de acesso de fora) vira também a porta de acesso
 * daqui. Efeito observável é o mesmo: mesma cache, mesma decisão de buscar de novo ou
 * não.
 *
 * EDITOR_PESSOAS_CACHE muda de dono nesta etapa: pessoasAtual/pessoasFallback eram a
 * variável original de editor.html, lida por várias abas (URC, Projetos, Pessoas,
 * Plano) só através do getter/setter — nenhum consumidor lia a variável direto — por
 * isso mover pra cá, junto do getter/setter, foi seguro.
 *
 * Precisa carregar depois de js/db-nucleos.js, js/db-projetos.js (usados sob demanda
 * por nucleosPorNome/projetoIdPorIniciativa) e js/supabase.js (detErro usa CC_SUPABASE
 * se disponível). Precisa carregar antes de qualquer aba que use estes globais — na
 * prática, antes das 8 abas extraídas e do IIFE de editor.html, todos scripts à parte
 * que não enxergam nada declarado dentro de outro IIFE sem passar por window
 * explicitamente.
 */
(function () {
"use strict";

/* precisa bater exatamente com NUCLEOS_VALIDOS de tools/validar_dados.py */
const NUCLEOS_VALIDOS = ["Inovação para Competitividade","Inovação Territorial","Startups","Tecnologias Portadoras de Futuro","Gestão do Conhecimento e Processos"];
window.NUCLEOS_VALIDOS = NUCLEOS_VALIDOS;

// cache de pessoas (golden record, meta_inovacao_pessoas) compartilhada entre as abas
// Pessoas, Projetos, URC e Plano — cada uma lê/escreve só pelo getter/setter abaixo,
// nunca pela variável direto (ver comentário no topo deste arquivo).
let pessoasAtual = null, pessoasFallback = false;
window.EDITOR_PESSOAS_CACHE = {
  obter: () => ({ lista: pessoasAtual, fallback: pessoasFallback }),
  definir: (lista, fallback) => { pessoasAtual = lista; pessoasFallback = fallback; },
};

// itens 5.5/5.7 do plano — mapa nome→nucleo_id do golden record (meta_inovacao_nucleos,
// Camada 0), carregado sob demanda e reaproveitado pelas duas portas de escrita que o
// item 5.1 achou em deriva: "Projetos & Representantes" (5.5, projeto novo/troca de
// núcleo) e "O Caminho para o Corsário" (5.7, iniciativa nova/linha de status nova).
// NUCLEOS_VALIDOS é o mesmo texto exato de meta_inovacao_nucleos.nome (conferido pela
// CONSULTA 0 da auditoria do 5.1 — nenhuma migração ficou pra trás), então casar por
// igualdade simples é seguro, sem precisar de régua de normalização.
let nucleosAtual = null;
async function nucleosPorNome(){
  if(!nucleosAtual){
    try { nucleosAtual = (await DB_NUCLEOS.carregar()).lista; }
    catch(err){
      console.error("editor: falha ao carregar núcleos (golden record) — nucleo_id não será gravado nesta sessão, texto continua indo normal",err);
      nucleosAtual = [];
    }
  }
  const m = {};
  nucleosAtual.forEach(n=>{ m[n.nome]=n.db_id; });
  return m;
}
window.nucleosPorNome = nucleosPorNome;

// item 5.7 — projeto_id pro Corsário, resolvido por igualdade exata de `iniciativa`
// contra o golden record (mesma régua do UPDATE original de
// tools/sql/2026-08_corsario_status_fk.sql). Reaproveita o MESMO cache
// (window.EDITOR_PROJETOS_CACHE, declarado em editor.html ao lado de projetosAtual) que
// a aba "Projetos & Representantes" usa — se ela já carregou antes nesta sessão, não
// busca de novo; se o Corsário é a primeira aba aberta, carrega aqui e a aba "Projetos"
// reaproveita depois. Iniciativa sem projeto golden correspondente (ex.: criada solta
// por aqui mesmo, sem passar por "+ Novo projeto") devolve null — nasce sem FK em vez
// de nascer com FK errada, mesmo princípio de criar()/criarIniciativa().
async function projetoIdPorIniciativa(nome){
  const cache = EDITOR_PROJETOS_CACHE.obter();
  if(!cache.lista && !cache.carregando){
    EDITOR_PROJETOS_CACHE.marcarCarregando(true);
    try {
      const r = await DB_PROJETOS.carregar();
      EDITOR_PROJETOS_CACHE.definir(r.lista, r.usandoFallback);
    } catch(err){
      console.error("editor: falha ao carregar projetos (golden record) — projeto_id não será gravado nesta sessão",err);
      EDITOR_PROJETOS_CACHE.definir([], false);
    }
    EDITOR_PROJETOS_CACHE.marcarCarregando(false);
  }
  const lista = EDITOR_PROJETOS_CACHE.obter().lista;
  const p = (lista||[]).find(x=>x.iniciativa===nome);
  return p ? p.db_id : null;
}
window.projetoIdPorIniciativa = projetoIdPorIniciativa;

function opts(lista, atual, rot){
  const l = lista.includes(atual)||atual===""&&lista.includes("") ? lista : [atual].concat(lista);
  return l.map(v=>'<option value="'+esc(v)+'"'+(v===atual?" selected":"")+'>'+esc(rot?(rot[v]!==undefined?rot[v]:v):(v||"—"))+'</option>').join("");
}
window.opts = opts;

// item 4.1 — mesma régua de tools/sql/2026-08_projeto_representantes.sql
// (public.cc_pessoa_normalizar): minúsculas, sem acento, sem ponto, trim. Usada só
// pra casar um token de representantes[] (texto legado) com a pessoa escolhida no
// seletor novo, ao sincronizar os dois — não é uma segunda régua de identidade.
function normalizarNomePessoa(txt){
  return String(txt||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\./g,"").trim();
}
window.normalizarNomePessoa = normalizarNomePessoa;
// rótulo de exibição de uma pessoa nos seletores/chips novos — mesma prioridade de
// docs/CAMADA1_DEDUPE_PESSOAS.md §3.3 (nome_completo > nome_exibicao > nome, porque
// 15 pessoas ainda não têm nome_completo preenchido).
function nomeExibicaoPessoa(p){
  return (p && (p.nome_completo||p.nome_exibicao||p.nome)) || "";
}
window.nomeExibicaoPessoa = nomeExibicaoPessoa;

// indicador por linha (mesma ideia de plano-acao.html's marcarRowStatus, adaptada pra uma
// <tr> de tabela em vez de uma .pa-row flex) — "salvando…" some sozinho ao virar "salvo"
// (1.5s), "falhou" fica até a próxima tentativa.
// `detalhe` (opcional) vira o title/tooltip da linha quando dá erro — o motivo técnico
// (ex.: "PGRST116: Results contain 0 rows") fica no hover pra quem for investigar, sem
// poluir o texto visível de negócio nem obrigar a abrir o console do navegador.
// Compartilhada por várias abas (Agenda, Pessoas, Projetos, URC).
function marcarLinhaStatus(tr, texto, detalhe){
  if(!tr) return;
  const el = tr.querySelector(".ed-row-status");
  if(!el) return;
  el.removeAttribute("title");
  if(texto==="salvando"){ el.textContent="salvando…"; el.style.color="var(--grafite)"; }
  else if(texto==="salvo"){
    el.textContent="salvo"; el.style.color="var(--verde)";
    setTimeout(()=>{ if(el.textContent==="salvo") el.textContent=""; },1500);
  } else if(texto){ el.textContent=texto; el.style.color="var(--critico)"; if(detalhe) el.title=detalhe; }
  else el.textContent="";
}
window.marcarLinhaStatus = marcarLinhaStatus;

// variante de marcarLinhaStatus() pra grid densa (conjunto "corsario"): a célula é
// estreita demais pra caber um texto "salvando…" do lado do select sem quebrar layout,
// então o feedback é visual no fundo da própria célula (ver .ed-cel-salvando/.ed-cel-erro).
function marcarCelulaStatus(td, estado, detalhe){
  if(!td) return;
  td.classList.remove("ed-cel-salvando","ed-cel-erro");
  td.removeAttribute("data-erro");
  td.removeAttribute("title");
  if(estado==="salvando" || estado==="salvo") td.classList.add("ed-cel-salvando");
  if(estado==="salvo") setTimeout(()=>td.classList.remove("ed-cel-salvando"),500);
  else if(estado && estado!=="salvando"){ td.classList.remove("ed-cel-salvando"); td.classList.add("ed-cel-erro"); td.title = detalhe ? (estado+" — "+detalhe) : estado; td.setAttribute("data-erro",""); }
}
window.marcarCelulaStatus = marcarCelulaStatus;

// motivo técnico de um erro de escrita, pro title/tooltip dos indicadores (hover), sem
// jamais ir pro texto visível — evita o beco sem saída do "falhou" cru, que obrigava a
// abrir o console do navegador pra descobrir a causa (foi assim no incidente do Corsário).
function detErro(err){
  return (window.CC_SUPABASE && CC_SUPABASE.detalheErro) ? CC_SUPABASE.detalheErro(err) : ((err&&err.message)||String(err));
}
window.detErro = detErro;

// aviso de fallback padrão (mesmo texto/estrutura de renderPlano/renderAgenda) — só
// muda o nome do arquivo de seed citado.
function avisoFallback(nomeArquivo){
  return '<div class="aviso" style="margin-bottom:12px"><b>Dados locais</b> — não foi possível atualizar os dados agora; estas são as informações da última versão salva. '+
    'As alterações não serão salvas enquanto isso; recarregue a página mais tarde.</div>';
}
window.avisoFallback = avisoFallback;
})();
