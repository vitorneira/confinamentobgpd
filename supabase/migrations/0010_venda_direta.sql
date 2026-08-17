-- Etapa 8 (extensão) — venda direta (valor combinado), sem a lógica de abate.
--
-- Alguns animais (ex.: touros PO da BG, mas vale para as duas fazendas) não
-- são vendidos pelo frigorífico: o valor é combinado diretamente entre
-- comprador e vendedor, animal por animal (a avaliação muda de bicho pra
-- bicho — não é preço uniforme por cabeça nem um total fechado do lote).
-- Além disso a venda pode ter frete e comissão, em QUALQUER tipo de venda
-- (abate ou direta) — decisão confirmada com o dono.
--
-- `tipo_venda` fica no fechamento inteiro (venda_lote), não por item: cada
-- fechamento representa um evento de venda só (um comprador/frigorífico, uma
-- data), então não faz sentido misturar abate com venda direta no mesmo
-- fechamento.
-- `if not exists` em cada coluna: script é reexecutável com segurança caso uma
-- rodada anterior tenha parado no meio (ex.: falhou lá na frente, na view).
alter table venda_lote
  add column if not exists tipo_venda text not null default 'abate' check (tipo_venda in ('abate', 'direta')),
  add column if not exists comprador text,
  add column if not exists frete numeric not null default 0,
  add column if not exists comissao numeric not null default 0;

-- preco_arroba só é obrigatório em venda por abate; venda direta não usa preço
-- de @, usa o valor combinado por item (venda_item.valor_negociado). A
-- obrigatoriedade por tipo é validada no server action, não no banco.
alter table venda_lote alter column preco_arroba drop not null;

-- Valor combinado daquele item (animal individual, ou total daquela linha de
-- lote agregado) quando venda_lote.tipo_venda = 'direta'. Null em vendas por
-- abate.
alter table venda_item add column if not exists valor_negociado numeric;

-- `create or replace view` só aceita ADICIONAR colunas no final da lista —
-- não pode inserir/mover uma coluna no meio, senão o Postgres interpreta como
-- rename ("cannot change name of view column X to Y") e rejeita. Por isso as
-- colunas pré-existentes abaixo mantêm EXATAMENTE a mesma ordem de
-- `0007_venda_rateio_fix.sql`; tudo que é novo (tipo_venda, comprador, frete,
-- comissao, arrobas_produzidas) vai anexado no final do select.
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
negociado as (
  select venda_lote_id, sum(valor_negociado) as valor_negociado_total
  from venda_item
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
  (case
    when vl.tipo_venda = 'direta' then coalesce(ng.valor_negociado_total, 0)
    else (vl.peso_carcaca_total / 15.0) * vl.preco_arroba
  end) as valor_bruto,
  (case
    when vl.tipo_venda = 'direta' then coalesce(ng.valor_negociado_total, 0)
    else (vl.peso_carcaca_total / 15.0) * vl.preco_arroba
  end) - vl.frete - vl.comissao - vl.deducoes as valor_liquido,
  (pt.peso_entrada_total_kg * 0.5 / 15.0) * vl.preco_arroba_entrada as custo_entrada,
  ((vl.peso_carcaca_total / 15.0) - (pt.peso_entrada_total_kg * 0.5 / 15.0))
    as arrobas_carcaca_produzida,
  cc.custo_racao_curral_ate_saida
    * (pt.cabecas::numeric / nullif(cf.cabecas_no_curral, 0)) as custo_racao_vendidos,
  p.custo_fixo_dia * pt.cab_dias_total as custo_fixo_vendidos,
  vl.tipo_venda,
  vl.comprador,
  vl.frete,
  vl.comissao,
  -- Base de "arrobas produzidas" usada no custo da @: em abate é a mesma
  -- conta de sempre (arrobas_carcaca_produzida, preserva a regressão da
  -- Etapa 8); em venda direta não há carcaça real, então usa arroba VIVA do
  -- ganho (ganho ÷ 30), o padrão do resto do sistema para quem não tem
  -- rendimento de carcaça apurado (ver CLAUDE.md).
  (case
    when vl.tipo_venda = 'abate'
      then (vl.peso_carcaca_total / 15.0) - (pt.peso_entrada_total_kg * 0.5 / 15.0)
    else (pt.peso_saida_total_kg - pt.peso_entrada_total_kg) / 30.0
  end) as arrobas_produzidas
from venda_lote vl
join participantes pt on pt.venda_lote_id = vl.id
left join negociado ng on ng.venda_lote_id = vl.id
join curral_custo_ate_saida cc on cc.venda_lote_id = vl.id
join curral_cabecas_no_fechamento cf on cf.venda_lote_id = vl.id
join parametros p on p.fazenda_id = vl.fazenda_id;

-- Mesma restrição de ordem de colunas do CREATE OR REPLACE VIEW acima: aqui
-- não dá pra usar `b.*` (a posição das 5 colunas novas do base view — que
-- ficam no final do b.* — empurraria custo_total/etc. pra depois de onde
-- estavam, o que o Postgres também trata como rename). Por isso o select é
-- explícito, na ordem exata de `0007_venda_rateio_fix.sql`, com as colunas
-- novas anexadas no final.
create or replace view v_venda_apuracao as
select
  b.venda_lote_id,
  b.fazenda_id,
  b.curral_id,
  b.frigorifico,
  b.nf,
  b.data_abate,
  b.data_saida,
  b.preco_arroba,
  b.preco_arroba_entrada,
  b.peso_carcaca_total,
  b.deducoes,
  b.cabecas,
  b.peso_entrada_total_kg,
  b.peso_saida_total_kg,
  b.cab_dias_total,
  b.peso_medio_entrada_kg,
  b.peso_medio_saida_kg,
  b.ganho_total_kg,
  b.dias_confinamento_medio,
  b.gmd_medio,
  b.arrobas_carcaca,
  b.carcaca_media_por_cab,
  b.rendimento_calculado,
  b.valor_bruto,
  b.valor_liquido,
  b.custo_entrada,
  b.arrobas_carcaca_produzida,
  b.custo_racao_vendidos,
  b.custo_fixo_vendidos,
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
  b.custo_racao_vendidos / nullif(b.arrobas_produzidas, 0)
    as custo_arroba_so_racao,
  (b.custo_racao_vendidos + b.custo_fixo_vendidos) / nullif(b.arrobas_produzidas, 0)
    as custo_arroba_total,
  b.tipo_venda,
  b.comprador,
  b.frete,
  b.comissao,
  b.arrobas_produzidas
from v_venda_apuracao_base b;

-- create or replace view preserva reloptions existentes, mas reforça
-- explicitamente (mesmo padrão defensivo de 0008_views_security_invoker.sql)
-- para não depender desse comportamento implícito do Postgres.
alter view v_venda_apuracao_base set (security_invoker = on);
alter view v_venda_apuracao set (security_invoker = on);
