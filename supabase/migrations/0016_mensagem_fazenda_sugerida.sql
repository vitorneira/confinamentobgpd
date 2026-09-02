-- Fase M3 (ajuste pós-live) — o classificador passa a tentar extrair a
-- fazenda citada na mensagem (BG/PD), pra pré-selecionar certo na tela de
-- Triagem em vez de sempre cair na primeira fazenda da lista (bug real
-- visto ao vivo: mensagem "fazenda Pau Darco" pré-selecionava Barra Grande).
-- Guarda o palpite; a fazenda de verdade só é gravada na OS quando o gestor
-- confirma a Triagem (mensagem.fazenda_sugerida não tem FK, é só sugestão).
alter table mensagem add column fazenda_sugerida text check (fazenda_sugerida in ('BG', 'PD'));
