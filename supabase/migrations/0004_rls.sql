-- Etapa 3 — RLS por fazenda. Acesso = ter vínculo em usuarios_fazendas (qualquer
-- papel enxerga os dados da fazenda vinculada). Escrita: 'dono' gerencia cadastro/
-- parâmetros/dietas/vínculos; 'dono' e 'gestor' lançam eventos (animais, pesagens,
-- guia de trato, tratos, compras, vendas); 'leitura' nunca escreve.
-- As funções são security definer para não recursar a própria RLS de
-- usuarios_fazendas ao serem chamadas de dentro de outras policies.

create or replace function public.tem_acesso_fazenda(p_fazenda_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from usuarios_fazendas uf
    where uf.usuario_id = auth.uid() and uf.fazenda_id = p_fazenda_id
  );
$$;

create or replace function public.papel_na_fazenda(p_fazenda_id uuid)
returns text
language sql security definer stable set search_path = public
as $$
  select papel from usuarios_fazendas uf
  where uf.usuario_id = auth.uid() and uf.fazenda_id = p_fazenda_id
  limit 1;
$$;

create or replace function public.pode_editar_fazenda(p_fazenda_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select papel_na_fazenda(p_fazenda_id) in ('dono', 'gestor');
$$;

create or replace function public.eh_dono_fazenda(p_fazenda_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select papel_na_fazenda(p_fazenda_id) = 'dono';
$$;

-- fazendas: só leitura pelos vinculados. Criar/editar fazenda é operação de
-- backoffice (fora do app, com a service role) — sem policy de escrita aqui.
alter table fazendas enable row level security;
create policy fazendas_select on fazendas for select using (tem_acesso_fazenda(id));

alter table usuarios_fazendas enable row level security;
create policy usuarios_fazendas_select on usuarios_fazendas
  for select using (usuario_id = auth.uid() or eh_dono_fazenda(fazenda_id));
create policy usuarios_fazendas_write on usuarios_fazendas
  for all using (eh_dono_fazenda(fazenda_id)) with check (eh_dono_fazenda(fazenda_id));

-- Cadastro/config: leitura para todos os vinculados; escrita só para o dono.
do $$
declare
  t text;
begin
  foreach t in array array['parametros', 'currais', 'categorias', 'ingredientes', 'dietas']
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I_select on %I for select using (tem_acesso_fazenda(fazenda_id))', t, t
    );
    execute format(
      'create policy %I_write on %I for all using (eh_dono_fazenda(fazenda_id)) with check (eh_dono_fazenda(fazenda_id))',
      t, t
    );
  end loop;
end $$;

alter table dieta_ingredientes enable row level security;
create policy dieta_ingredientes_select on dieta_ingredientes
  for select using (tem_acesso_fazenda((select fazenda_id from dietas where id = dieta_id)));
create policy dieta_ingredientes_write on dieta_ingredientes
  for all
  using (eh_dono_fazenda((select fazenda_id from dietas where id = dieta_id)))
  with check (eh_dono_fazenda((select fazenda_id from dietas where id = dieta_id)));

alter table dieta_vigencia enable row level security;
create policy dieta_vigencia_select on dieta_vigencia
  for select using (tem_acesso_fazenda((select fazenda_id from currais where id = curral_id)));
create policy dieta_vigencia_write on dieta_vigencia
  for all
  using (eh_dono_fazenda((select fazenda_id from currais where id = curral_id)))
  with check (eh_dono_fazenda((select fazenda_id from currais where id = curral_id)));

-- Eventos: leitura para todos os vinculados; escrita para dono e gestor.
do $$
declare
  t text;
begin
  foreach t in array array[
    'animais', 'pesagens', 'guia_trato', 'tratos_diarios', 'compras_insumos', 'venda_lote'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I_select on %I for select using (tem_acesso_fazenda(fazenda_id))', t, t
    );
    execute format(
      'create policy %I_write on %I for all using (pode_editar_fazenda(fazenda_id)) with check (pode_editar_fazenda(fazenda_id))',
      t, t
    );
  end loop;
end $$;

alter table guia_trato_curral enable row level security;
create policy guia_trato_curral_select on guia_trato_curral
  for select using (tem_acesso_fazenda((select fazenda_id from guia_trato where id = guia_trato_id)));
create policy guia_trato_curral_write on guia_trato_curral
  for all
  using (pode_editar_fazenda((select fazenda_id from guia_trato where id = guia_trato_id)))
  with check (pode_editar_fazenda((select fazenda_id from guia_trato where id = guia_trato_id)));

alter table venda_item enable row level security;
create policy venda_item_select on venda_item
  for select using (tem_acesso_fazenda((select fazenda_id from venda_lote where id = venda_lote_id)));
create policy venda_item_write on venda_item
  for all
  using (pode_editar_fazenda((select fazenda_id from venda_lote where id = venda_lote_id)))
  with check (pode_editar_fazenda((select fazenda_id from venda_lote where id = venda_lote_id)));
