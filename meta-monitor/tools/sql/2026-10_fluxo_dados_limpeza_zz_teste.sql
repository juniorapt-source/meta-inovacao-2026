-- Limpeza do resíduo do teste de escrita da v0.32.0 (3 linhas zz_teste, já desativadas por
-- ativo = false; as policies não permitem DELETE a quem usa o token). Rodar à mão no SQL
-- Editor (projeto wdygbfrmewlaffjsfyoi). Só apaga linhas com o prefixo zz_teste.
begin;
delete from fluxo_dados_encaminhamentos where acao like 'zz\_teste%';
delete from fluxo_dados_paineis         where nome like 'zz\_teste%';
delete from fluxo_dados_rotas           where iniciativa = 'zz_teste';  -- cascata limpa rota_destinos
commit;
-- Conferência: deve voltar 0, 0, 0
-- select (select count(*) from fluxo_dados_rotas where iniciativa = 'zz_teste'),
--        (select count(*) from fluxo_dados_paineis where nome like 'zz\_teste%'),
--        (select count(*) from fluxo_dados_encaminhamentos where acao like 'zz\_teste%');
