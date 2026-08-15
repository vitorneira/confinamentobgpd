-- Etapa 5 — "preço de vitrine" da dieta (DATA_MODEL.md: preço do ingrediente =
-- última compra; custo da dieta de vitrine = Σ proporção × preço última compra).
-- Adiantado da Etapa 7 porque o Guia de Trato precisa congelar esse preço no
-- trato no momento da confirmação.

create or replace view v_ingrediente_preco_atual as
select distinct on (c.ingrediente_id)
  c.ingrediente_id,
  c.preco_kg as preco_atual,
  c.data as data_ultima_compra
from compras_insumos c
order by c.ingrediente_id, c.data desc;

create or replace view v_dieta_custo_vitrine as
select
  di.dieta_id,
  sum(di.proporcao * coalesce(p.preco_atual, 0)) as custo_por_kg
from dieta_ingredientes di
left join v_ingrediente_preco_atual p on p.ingrediente_id = di.ingrediente_id
group by di.dieta_id;
