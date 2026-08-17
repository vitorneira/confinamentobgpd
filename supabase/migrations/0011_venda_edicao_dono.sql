-- Fechar uma venda nova continua sendo dono+gestor (lançamento de evento,
-- igual a qualquer outro evento) — só INSERT continua com pode_editar_fazenda.
-- Mas EDITAR/EXCLUIR uma venda já fechada (corrigir animal esquecido, ajustar
-- valores) passa a exigir dono — pedido do dono: correções retroativas em
-- registro financeiro já fechado ficam restritas ao login de dono.
drop policy if exists venda_lote_write on venda_lote;
create policy venda_lote_insert on venda_lote
  for insert with check (pode_editar_fazenda(fazenda_id));
create policy venda_lote_update on venda_lote
  for update using (eh_dono_fazenda(fazenda_id)) with check (eh_dono_fazenda(fazenda_id));
create policy venda_lote_delete on venda_lote
  for delete using (eh_dono_fazenda(fazenda_id));

drop policy if exists venda_item_write on venda_item;
create policy venda_item_insert on venda_item
  for insert with check (pode_editar_fazenda((select fazenda_id from venda_lote where id = venda_lote_id)));
create policy venda_item_update on venda_item
  for update
  using (eh_dono_fazenda((select fazenda_id from venda_lote where id = venda_lote_id)))
  with check (eh_dono_fazenda((select fazenda_id from venda_lote where id = venda_lote_id)));
create policy venda_item_delete on venda_item
  for delete using (eh_dono_fazenda((select fazenda_id from venda_lote where id = venda_lote_id)));

-- Nota: adicionar um item a uma venda JÁ fechada (nova ação no app) ainda é um
-- INSERT em venda_item, então essa policy de insert sozinha não distingue
-- "fechando uma venda nova" de "editando uma venda antiga" — quem faz essa
-- distinção é a checagem de papel explícita dentro da própria server action
-- (exigirDono, em src/app/[fazenda]/vendas/actions.ts).
