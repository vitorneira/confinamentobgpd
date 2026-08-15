-- Etapa 2 — indicadores como views (nunca coluna). Regras vêm do CLAUDE.md
-- ("Decisões de domínio já fechadas"):
--   * arroba viva = peso vivo ÷ 30
--   * GMD por animal = (peso atual − peso entrada) / (data última pesagem − data entrada)
--   * "GMD válido" exige 2+ pesagens (evita animal só com a pesagem de entrada)
--   * médias de curral (peso médio, GMD médio) só consideram GMD válido; peso TOTAL
--     soma todos; "% na meta" exclui pesagem vencida
--   * custo é sempre real (dos tratos, preço já congelado na tabela) — nunca estimado

create or replace view v_animal_indicadores as
with pesagens_validas as (
  select
    animal_id,
    data,
    peso_kg,
    row_number() over (partition by animal_id order by data desc) as rn
  from pesagens
  where peso_kg is not null
),
ultima_pesagem as (
  select animal_id, data as data_ultima_pesagem, peso_kg as peso_atual
  from pesagens_validas
  where rn = 1
),
contagem as (
  select animal_id, count(*) as num_pesagens_validas
  from pesagens_validas
  group by animal_id
)
select
  a.id as animal_id,
  a.fazenda_id,
  a.curral_id,
  a.categoria_id,
  a.brinco,
  a.data_entrada,
  coalesce(a.peso_entrada_kg, a.peso_medio_entrada_kg) as peso_entrada_kg,
  coalesce(up.peso_atual, a.peso_entrada_kg, a.peso_medio_entrada_kg) as peso_atual_kg,
  up.data_ultima_pesagem,
  coalesce(cnt.num_pesagens_validas, 0) as num_pesagens_validas,
  (p.data_referencia - a.data_entrada) as dias_confinado,
  case when up.data_ultima_pesagem is not null
    then (p.data_referencia - up.data_ultima_pesagem)
  end as dias_desde_ultima_pesagem,
  case when up.data_ultima_pesagem is not null
    and (p.data_referencia - up.data_ultima_pesagem) >= p.alerta_pesagem_forte_dias
    then 'critico'
    when up.data_ultima_pesagem is not null
    and (p.data_referencia - up.data_ultima_pesagem) >= p.alerta_pesagem_atencao_dias
    then 'atencao'
    else 'ok'
  end as alerta_pesagem,
  (
    coalesce(cnt.num_pesagens_validas, 0) >= 2
    and up.data_ultima_pesagem > a.data_entrada
  ) as gmd_valido,
  case
    when coalesce(cnt.num_pesagens_validas, 0) >= 2 and up.data_ultima_pesagem > a.data_entrada
    then (up.peso_atual - coalesce(a.peso_entrada_kg, a.peso_medio_entrada_kg))
         / (up.data_ultima_pesagem - a.data_entrada)::numeric
  end as gmd_kg_dia,
  coalesce(up.peso_atual, a.peso_entrada_kg, a.peso_medio_entrada_kg) / 30.0 as arroba_viva,
  (
    coalesce(up.peso_atual, a.peso_entrada_kg, a.peso_medio_entrada_kg)
    - coalesce(a.peso_entrada_kg, a.peso_medio_entrada_kg)
  ) / 30.0 as ganho_arroba,
  case
    when coalesce(cnt.num_pesagens_validas, 0) >= 2 and up.data_ultima_pesagem > a.data_entrada
    then (
      (up.peso_atual - coalesce(a.peso_entrada_kg, a.peso_medio_entrada_kg))
      / (up.data_ultima_pesagem - a.data_entrada)::numeric
    ) >= p.gmd_meta
  end as atingiu_meta_gmd
from animais a
join parametros p on p.fazenda_id = a.fazenda_id
left join ultima_pesagem up on up.animal_id = a.id
left join contagem cnt on cnt.animal_id = a.id
where a.status = 'ativo';

create or replace view v_curral_custo_racao as
select
  t.curral_id,
  sum(t.trato_manha_kg + t.trato_almoco_kg + t.trato_tarde_kg) as consumo_racao_total_kg,
  sum((t.trato_manha_kg + t.trato_almoco_kg + t.trato_tarde_kg) * t.preco_dieta_congelado)
    as custo_racao_acumulado,
  count(distinct t.data) as dias_com_trato
from tratos_diarios t
group by t.curral_id;

create or replace view v_curral_indicadores as
select
  c.id as curral_id,
  c.fazenda_id,
  c.codigo,
  c.descricao,
  count(ai.animal_id) as num_cabecas,
  sum(ai.peso_atual_kg) as peso_total_atual_kg,
  sum(ai.peso_atual_kg - ai.peso_entrada_kg) as ganho_total_kg,
  sum(ai.peso_atual_kg) / 30.0 as arroba_viva_total,
  sum(ai.peso_atual_kg - ai.peso_entrada_kg) / 30.0 as arroba_produzida,
  avg(ai.peso_entrada_kg) filter (where ai.gmd_valido) as peso_medio_entrada_kg,
  avg(ai.peso_atual_kg) filter (where ai.gmd_valido) as peso_medio_atual_kg,
  avg(ai.gmd_kg_dia) filter (where ai.gmd_valido) as gmd_medio,
  count(*) filter (where ai.gmd_valido) as num_gmd_validos,
  count(*) filter (where ai.gmd_valido and ai.alerta_pesagem = 'ok') as num_nao_vencidos,
  count(*) filter (where ai.gmd_valido and ai.alerta_pesagem = 'ok' and ai.atingiu_meta_gmd)
    as num_na_meta,
  (count(*) filter (where ai.gmd_valido and ai.alerta_pesagem = 'ok' and ai.atingiu_meta_gmd))::numeric
    / nullif(count(*) filter (where ai.gmd_valido and ai.alerta_pesagem = 'ok'), 0)
    as pct_na_meta_gmd,
  max(ai.dias_desde_ultima_pesagem) as dias_desde_ultima_pesagem,
  min(ai.data_entrada) as data_entrada_mais_antiga,
  coalesce(cr.consumo_racao_total_kg, 0) as consumo_racao_total_kg,
  coalesce(cr.custo_racao_acumulado, 0) as custo_racao_acumulado,
  coalesce(cr.dias_com_trato, 0) as dias_com_trato,
  coalesce(cr.custo_racao_acumulado, 0)
    / nullif(sum(ai.peso_atual_kg - ai.peso_entrada_kg) / 30.0, 0) as custo_racao_por_arroba,
  coalesce(cr.consumo_racao_total_kg, 0)
    / nullif(sum(ai.peso_atual_kg - ai.peso_entrada_kg), 0) as conversao_alimentar,
  coalesce(cr.custo_racao_acumulado, 0)
    / nullif(coalesce(cr.dias_com_trato, 0) * count(ai.animal_id), 0) as custo_cab_dia_medio_racao
from currais c
left join v_animal_indicadores ai on ai.curral_id = c.id
left join v_curral_custo_racao cr on cr.curral_id = c.id
group by c.id, c.fazenda_id, c.codigo, c.descricao, cr.consumo_racao_total_kg,
  cr.custo_racao_acumulado, cr.dias_com_trato;

-- Custo/@ "total" (ração + custo fixo) e custo/cab/dia total precisam do parâmetro
-- custo_fixo_dia da fazenda, então ficam numa view separada que junta com parametros.
create or replace view v_curral_indicadores_completo as
select
  ci.*,
  p.custo_fixo_dia,
  (p.data_referencia - ci.data_entrada_mais_antiga) as dias_conf_curral,
  ci.custo_racao_acumulado
    + p.custo_fixo_dia * ci.num_cabecas * greatest(p.data_referencia - ci.data_entrada_mais_antiga, 0)
    as custo_total_acumulado,
  (ci.custo_racao_acumulado
    + p.custo_fixo_dia * ci.num_cabecas * greatest(p.data_referencia - ci.data_entrada_mais_antiga, 0))
    / nullif(ci.arroba_produzida, 0) as custo_total_por_arroba,
  (ci.custo_racao_acumulado
    + p.custo_fixo_dia * ci.num_cabecas * greatest(p.data_referencia - ci.data_entrada_mais_antiga, 0))
    / nullif(ci.dias_com_trato * ci.num_cabecas, 0) as custo_cab_dia_medio_total
from v_curral_indicadores ci
join parametros p on p.fazenda_id = ci.fazenda_id;

-- estoque_base_data é o dia em que a contagem física foi feita, antes do consumo
-- daquele dia acontecer — por isso o consumo do próprio dia da base conta como
-- "depois" (>=), mas uma compra do mesmo dia já está embutida na base (>).
create or replace view v_ingrediente_estoque as
select
  i.id as ingrediente_id,
  i.fazenda_id,
  i.nome,
  i.estoque_base_kg,
  i.estoque_base_data,
  (
    select coalesce(sum(c.qtd_kg), 0)
    from compras_insumos c
    where c.ingrediente_id = i.id and c.data > i.estoque_base_data
  ) as compras_apos_base_kg,
  (
    select coalesce(sum((t.trato_manha_kg + t.trato_almoco_kg + t.trato_tarde_kg) * di.proporcao), 0)
    from tratos_diarios t
    join dieta_ingredientes di on di.dieta_id = t.dieta_id and di.ingrediente_id = i.id
    where t.data >= i.estoque_base_data
  ) as consumo_apos_base_kg,
  -- taxa de consumo "atual": média real dos últimos 7 dias com trato na fazenda
  -- (não a média histórica inteira, que misturaria fases de dieta já superadas).
  (
    select coalesce(sum((t.trato_manha_kg + t.trato_almoco_kg + t.trato_tarde_kg) * di.proporcao), 0)
      / nullif(count(distinct t.data), 0)
    from tratos_diarios t
    join dieta_ingredientes di on di.dieta_id = t.dieta_id and di.ingrediente_id = i.id
    where t.data >= (select max(t2.data) from tratos_diarios t2 where t2.fazenda_id = i.fazenda_id) - 6
  ) as consumo_dia_medio_kg
from ingredientes i;

create or replace view v_ingrediente_estoque_completo as
select
  e.*,
  case when e.estoque_base_kg is null then null
    else e.estoque_base_kg + e.compras_apos_base_kg - e.consumo_apos_base_kg
  end as estoque_atual_kg,
  case when e.estoque_base_kg is null then null
    else (e.estoque_base_kg + e.compras_apos_base_kg - e.consumo_apos_base_kg)
      / nullif(e.consumo_dia_medio_kg, 0)
  end as dias_de_estoque
from v_ingrediente_estoque e;
