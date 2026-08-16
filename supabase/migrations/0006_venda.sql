-- Etapa 8 — Fechamento de lote / Venda (generaliza a antiga aba Venda_Nelore).
--
-- "Custo de entrada" não tinha onde ser guardado (animais não registra preço de
-- compra). Decisão com o dono: input no fechamento, replicando a fórmula
-- histórica (peso_entrada_total × 50% ÷ 15 × preço da @ pago na entrada).
alter table venda_lote add column preco_arroba_entrada numeric not null;

-- Ração e custo fixo do lote vendido são cortados em data_saida — trato
-- lançado depois que o lote já saiu não é custo desse lote — e rateados pela
-- participação dos vendidos no total de cabeças do curral no momento do
-- fechamento (um curral pode ter mais de uma venda ao longo do tempo, e pode
-- misturar animal individual com lote agregado; agregado conta pela
-- `quantidade`, não por linha). Isso é indicador (view), nunca persistido —
-- reflete o estado do curral quando a apuração é consultada, não fica
-- "congelado" como o preço da dieta no trato.
create or replace view v_venda_lote_participante as
select
  vi.id as venda_item_id,
  vi.venda_lote_id,
  vl.data_saida,
  a.id as animal_id,
  a.tipo,
  a.data_entrada,
  case when a.tipo = 'agregado' then vi.quantidade else 1 end as cabecas,
  case when a.tipo = 'agregado'
    then vi.quantidade * a.peso_medio_entrada_kg
    else a.peso_entrada_kg
  end as peso_entrada_kg,
  case when a.tipo = 'agregado'
    then vi.quantidade * coalesce(up.peso_kg, a.peso_medio_entrada_kg)
    else coalesce(up.peso_kg, a.peso_entrada_kg)
  end as peso_saida_kg,
  (case when a.tipo = 'agregado' then vi.quantidade else 1 end)
    * (vl.data_saida - a.data_entrada) as cab_dias
from venda_item vi
join venda_lote vl on vl.id = vi.venda_lote_id
join animais a on a.id = vi.animal_id
left join lateral (
  select p.peso_kg
  from pesagens p
  where p.animal_id = a.id and p.peso_kg is not null and p.data <= vl.data_saida
  order by p.data desc
  limit 1
) up on true;

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
    * (pt.cabecas::numeric / nullif(cca.cabecas_atual, 0)) as custo_racao_vendidos,
  p.custo_fixo_dia * pt.cab_dias_total as custo_fixo_vendidos
from venda_lote vl
join participantes pt on pt.venda_lote_id = vl.id
join curral_custo_ate_saida cc on cc.venda_lote_id = vl.id
left join curral_cabecas_atual cca on cca.curral_id = vl.curral_id
join parametros p on p.fazenda_id = vl.fazenda_id;

create or replace view v_venda_apuracao as
select
  b.*,
  (b.custo_entrada + b.custo_racao_vendidos + b.custo_fixo_vendidos) as custo_total,
  (b.custo_entrada + b.custo_racao_vendidos + b.custo_fixo_vendidos)
    / nullif(b.cabecas, 0) as custo_total_por_cab,
  (b.valor_liquido - (b.custo_entrada + b.custo_racao_vendidos + b.custo_fixo_vendidos))
    as lucro_lote,
  (b.valor_liquido - (b.custo_entrada + b.custo_racao_vendidos + b.custo_fixo_vendidos))
    / nullif(b.cabecas, 0) as lucro_por_cab,
  (b.valor_liquido - (b.custo_entrada + b.custo_racao_vendidos + b.custo_fixo_vendidos))
    / nullif(b.valor_liquido, 0) as margem,
  (b.valor_liquido - (b.custo_entrada + b.custo_racao_vendidos + b.custo_fixo_vendidos))
    / nullif(b.custo_entrada + b.custo_racao_vendidos + b.custo_fixo_vendidos, 0) as roi,
  b.custo_racao_vendidos / nullif(b.arrobas_carcaca_produzida, 0)
    as custo_arroba_so_racao,
  (b.custo_racao_vendidos + b.custo_fixo_vendidos) / nullif(b.arrobas_carcaca_produzida, 0)
    as custo_arroba_total
from v_venda_apuracao_base b;
