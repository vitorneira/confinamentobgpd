-- Fix de segurança (checklist da Etapa 9) — TODAS as views de indicadores
-- foram criadas sem `security_invoker`. Por padrão, uma view roda com o
-- privilégio de quem a criou (o dono do schema), não de quem consulta —
-- isso faz a view IGNORAR a RLS das tabelas por baixo. Na prática, qualquer
-- pessoa com a chave pública/anon (que fica exposta no bundle do navegador)
-- podia consultar essas views direto via PostgREST e ver dados de QUALQUER
-- fazenda, não só a que tem acesso — mesmo com a RLS das tabelas base
-- corretamente configurada em 0004_rls.sql.
--
-- `security_invoker = on` faz a view rodar com o privilégio de quem chama,
-- então a RLS de animais/pesagens/tratos_diarios/etc. volta a valer.
alter view v_animal_indicadores set (security_invoker = on);
alter view v_curral_custo_racao set (security_invoker = on);
alter view v_curral_indicadores set (security_invoker = on);
alter view v_curral_indicadores_completo set (security_invoker = on);
alter view v_ingrediente_estoque set (security_invoker = on);
alter view v_ingrediente_estoque_completo set (security_invoker = on);
alter view v_ingrediente_preco_atual set (security_invoker = on);
alter view v_dieta_custo_vitrine set (security_invoker = on);
alter view v_venda_lote_participante set (security_invoker = on);
alter view v_venda_apuracao_base set (security_invoker = on);
alter view v_venda_apuracao set (security_invoker = on);
