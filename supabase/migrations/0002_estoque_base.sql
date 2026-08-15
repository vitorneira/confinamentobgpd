-- Etapa 2 — a fórmula de estoque (DATA_MODEL.md: "estoque atual = base + compras -
-- consumo") depende de um saldo inicial ("base") que não tinha coluna própria.
-- No Excel original isso é a célula "Estoque na data-base" — só a PD preencheu,
-- para 2 dos 5 insumos (Farelo de Soja e Milho Moído); os demais ficam sem base
-- (estoque calculado como indisponível até uma compra completa servir de base).

alter table ingredientes
  add column estoque_base_kg numeric,
  add column estoque_base_data date;

update ingredientes i
set estoque_base_kg = 5000, estoque_base_data = '2026-08-04'
from fazendas f
where i.fazenda_id = f.id and f.codigo = 'PD' and i.nome = 'Farelo de Soja';

update ingredientes i
set estoque_base_kg = 38200, estoque_base_data = '2026-07-27'
from fazendas f
where i.fazenda_id = f.id and f.codigo = 'PD' and i.nome = 'Milho Moído';
