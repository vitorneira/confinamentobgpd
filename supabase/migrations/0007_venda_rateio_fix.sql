-- Etapa 8 (fix) — v_venda_apuracao_base rateava custo de ração pelas cabeças
-- ATUALMENTE ativas no curral. Quando a venda tira o curral inteiro (baixa
-- automática zera os ativos), o denominador vira 0/nulo e o NULL se propaga
-- pra custo_racao_vendidos, custo_total, lucro, margem, ROI e custo da @.
--
-- Fix: reconstrói quantas cabeças estavam no curral na data_saida de CADA
-- venda = cabeças ativas hoje + cabeças de toda venda desse curral com
-- data_saida >= a desta (quem já saiu depois ainda estava lá nessa data;
-- quem saiu antes, não). Isso também deixa o rateio correto se um curral
-- tiver mais de uma venda ao longo do tempo, não só o caso "esvaziou tudo".
create or replace view v_venda_apuracao_base as
with participantes as (
  select
    venda_lote_id,
    sum(cabecas) as cabecas,
    sum(peso_entrada_kg) as peso_entrada_total_kg,
    sum(peso_saida_kg) as peso_saida_total_kg,
    sum(cab_dias) as cab_dias_total
  from v_venda_lote_participante
  group by venda_lote_id
),
curral_cabecas_atual as (
  select
    a.curral_id,
    sum(case when a.tipo = 'agregado' then a.quantidade else 1 end) as cabecas_atual
  from animais a
  where a.status = 'ativo'
  group by a.curral_id
),
curral_cabecas_no_fechamento as (
  select
    vl.id as venda_lote_id,
    coalesce(cca.cabecas_atual, 0) + coalesce(sum(vl2.cabecas) filter (
      where vl2.data_saida >= vl.data_saida
    ), 0) as cabecas_no_curral
  from venda_lote vl
  left join curral_cabecas_atual cca on cca.curral_id = vl.curral_id
  left join venda_lote vl2 on vl2.curral_id = vl.curral_id
  group by vl.id, cca.cabecas_atual
),
curral_custo_ate_saida as (
  select
    vl.id as venda_lote_id,
    coalesce(sum(
      (t.trato_manha_kg + t.trato_almoco_kg + t.trato_tarde_kg) * t.preco_dieta_congelado
    ), 0) as custo_racao_curral_ate_saida
  from venda_lote vl
  left join tratos_diarios t
    on t.curral_id = vl.curral_id and t.data <= vl.data_saida
  group by vl.id
)
select
  vl.id as venda_lote_id,
  vl.fazenda_id,
  vl.curral_id,
  vl.frigorifico,
  vl.nf,
  vl.data_abate,
  vl.data_saida,
  vl.preco_arroba,
  vl.preco_arroba_entrada,
  vl.peso_carcaca_total,
  vl.deducoes,
  pt.cabecas,
  pt.peso_entrada_total_kg,
  pt.peso_saida_total_kg,
  pt.cab_dias_total,
  pt.peso_entrada_total_kg / nullif(pt.cabecas, 0) as peso_medio_entrada_kg,
  pt.peso_saida_total_kg / nullif(pt.cabecas, 0) as peso_medio_saida_kg,
  (pt.peso_saida_total_kg - pt.peso_entrada_total_kg) as ganho_total_kg,
  pt.cab_dias_total::numeric / nullif(pt.cabecas, 0) as dias_confinamento_medio,
  (pt.peso_saida_total_kg - pt.peso_entrada_total_kg)
    / nullif(pt.cab_dias_total, 0) as gmd_medio,
  vl.peso_carcaca_total / 15.0 as arrobas_carcaca,
  vl.peso_carcaca_total / nullif(pt.cabecas, 0) as carcaca_media_por_cab,
  vl.peso_carcaca_total / nullif(pt.peso_saida_total_kg, 0) as rendimento_calculado,
  (vl.peso_carcaca_total / 15.0) * vl.preco_arroba as valor_bruto,
  (vl.peso_carcaca_total / 15.0) * vl.preco_arroba - vl.deducoes as valor_liquido,
  (pt.peso_entrada_total_kg * 0.5 / 15.0) * vl.preco_arroba_entrada as custo_entrada,
  ((vl.peso_carcaca_total / 15.0) - (pt.peso_entrada_total_kg * 0.5 / 15.0))
    as arrobas_carcaca_produzida,
  cc.custo_racao_curral_ate_saida
    * (pt.cabecas::numeric / nullif(cf.cabecas_no_curral, 0)) as custo_racao_vendidos,
  p.custo_fixo_dia * pt.cab_dias_total as custo_fixo_vendidos
from venda_lote vl
join participantes pt on pt.venda_lote_id = vl.id
join curral_custo_ate_saida cc on cc.venda_lote_id = vl.id
join curral_cabecas_no_fechamento cf on cf.venda_lote_id = vl.id
join parametros p on p.fazenda_id = vl.fazenda_id;
