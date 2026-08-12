/* Cliente da matriz de demandas no Supabase. Namespacing por objeto global (mesmo padrão de
   window.CALC / window.EDITOR_IO), sem módulos ES — script simples via <script src>. */
(function (root) {
  "use strict";

  const TABELA = "meta_inovacao_matriz_demandas";
  const CACHE_MS = 30000;

  let cliente = null;
  function getClient() {
    if (cliente) return cliente;
    if (!root.supabase || !root.supabase.createClient) throw new Error("supabase-js não carregado (confira o <script> do CDN).");
    if (!root.APP_CONFIG) throw new Error("js/config.js não carregado antes de matriz-store.js.");
    cliente = root.supabase.createClient(root.APP_CONFIG.SUPABASE_URL, root.APP_CONFIG.SUPABASE_ANON_KEY);
    return cliente;
  }

  let cache = { linhas: null, ts: 0 };

  const matrizStore = {
    TABELA: TABELA,

    /* busca todas as linhas, ordenadas por iniciativa. Usa cache de até 30s a menos que forcar=true. */
    async load(forcar) {
      const agora = Date.now();
      if (!forcar && cache.linhas && (agora - cache.ts) < CACHE_MS) return cache.linhas;
      const { data, error } = await getClient().from(TABELA).select("*").order("iniciativa", { ascending: true });
      if (error) throw error;
      cache = { linhas: data, ts: agora };
      return data;
    },

    invalidar() { cache = { linhas: null, ts: 0 }; },

    async saveCell(id, campo, valor, usuario) {
      const patch = {}; patch[campo] = valor; patch.atualizado_por = usuario || null;
      const { data, error } = await getClient().from(TABELA).update(patch).eq("id", id).select().single();
      if (error) throw error;
      if (cache.linhas) { const i = cache.linhas.findIndex((l) => l.id === id); if (i > -1) cache.linhas[i] = data; }
      return data;
    },

    async addRow(dados, usuario) {
      const payload = Object.assign({}, dados, { atualizado_por: usuario || null });
      const { data, error } = await getClient().from(TABELA).insert(payload).select().single();
      if (error) throw error;
      if (cache.linhas) cache.linhas.push(data);
      return data;
    },

    async deleteRow(id) {
      const { error } = await getClient().from(TABELA).delete().eq("id", id);
      if (error) throw error;
      if (cache.linhas) cache.linhas = cache.linhas.filter((l) => l.id !== id);
      return true;
    },

    /* assina mudanças em tempo real. onChange recebe o payload do Supabase Realtime.
       Não lança: se o realtime falhar (canal indisponível, etc.), retorna null e loga um aviso —
       quem chama trata null como "sem realtime, segue no polling". */
    subscribeRealtime(onChange) {
      try {
        return getClient()
          .channel("realtime:" + TABELA)
          .on("postgres_changes", { event: "*", schema: "public", table: TABELA }, (payload) => {
            matrizStore.invalidar();
            onChange(payload);
          })
          .subscribe();
      } catch (e) {
        console.warn("matriz-store: realtime indisponível —", e);
        return null;
      }
    }
  };

  root.matrizStore = matrizStore;
})(this);
