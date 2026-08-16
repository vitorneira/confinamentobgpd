-- Guia de Trato: fluxo em duas etapas.
--   1) "Salvar plano" grava guia_trato/guia_trato_curral (kg planejado por
--      curral), sem criar custo.
--   2) Confirmação (por curral/data, podendo acumular pendentes e ter
--      filtros) é o que de fato grava/atualiza tratos_diarios — aí sim vira
--      custo real, preço da dieta congelado, como já era. "Confirmado" não
--      precisa de coluna própria: é só existir (ou não) o trato daquele
--      curral/data — eventos continuam sendo a fonte da verdade.
--
-- guia_trato_vagao guarda a divisão de kg por vagão quando o gestor edita
-- manualmente a sugestão balanceada (por dieta, horário e índice do vagão
-- naquele dia) — só existe linha aqui se ele mexeu; sem edição, a folha usa
-- a sugestão calculada (balanceamento.ts) na hora.
create table guia_trato_vagao (
  id uuid primary key default gen_random_uuid(),
  guia_trato_id uuid not null references guia_trato (id) on delete cascade,
  dieta_id uuid not null references dietas (id) on delete restrict,
  horario text not null check (horario in ('manha', 'almoco', 'tarde')),
  vagao_index int not null check (vagao_index >= 0),
  carga_kg numeric not null check (carga_kg >= 0),
  unique (guia_trato_id, dieta_id, horario, vagao_index)
);

alter table guia_trato_vagao enable row level security;
create policy guia_trato_vagao_select on guia_trato_vagao
  for select using (tem_acesso_fazenda((select fazenda_id from guia_trato where id = guia_trato_id)));
create policy guia_trato_vagao_write on guia_trato_vagao
  for all
  using (pode_editar_fazenda((select fazenda_id from guia_trato where id = guia_trato_id)))
  with check (pode_editar_fazenda((select fazenda_id from guia_trato where id = guia_trato_id)));
