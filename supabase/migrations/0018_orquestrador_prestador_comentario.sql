-- Orquestrador — pedido do dono (2026-09-03): compra de motosserra feita por
-- um prestador de serviço em PD precisa ficar linkada a ele (a compra será
-- descontada do pagamento do prestador) e ao fornecedor; e a OS precisa de um
-- jeito de registrar observação além do texto original da demanda.
--
-- 1. `prestador_servico` — cadastro simples (nome/contato/dado de pagamento),
--    mesmo padrão de `fornecedor` (master data sem fazenda_id, RLS por
--    tenant + orq_pode_editar_master_data()). Distinto de "funcionário"
--    (cadastro próprio, maior, com holerite/recibo/comprovante — fase
--    futura) por pedido explícito do dono.
-- 2. `os.prestador_id` + `os.descontar_do_prestador` — link + flag. Só
--    registra a intenção; a dedução em si continua fora do sistema (gerar
--    solicitação de pagamento é P3, ainda não existe).
-- 3. `os_comentario` — log de comentários (autor + texto + data), mesmo
--    padrão de `os_status_historico` mas escrito pelo app (não por trigger).

create table prestador_servico (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default orq_tenant_atual() references orq_tenants (id),
  nome text not null,
  telefone text,
  chave_pagamento text,        -- PIX ou outra referência de pagamento, texto livre
  observacao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

alter table prestador_servico enable row level security;
create policy prestador_servico_select on prestador_servico
  for select using (tenant_id = orq_tenant_atual());
create policy prestador_servico_write on prestador_servico
  for all using (orq_pode_editar_master_data()) with check (orq_pode_editar_master_data());

alter table os add column prestador_id uuid references prestador_servico (id) on delete set null;
alter table os add column descontar_do_prestador boolean not null default false;

create index on os (prestador_id);

create table os_comentario (
  id uuid primary key default gen_random_uuid(),
  os_id text not null references os (id) on delete cascade,
  autor_id uuid references auth.users (id),
  texto text not null,
  criado_em timestamptz not null default now()
);

create index on os_comentario (os_id);

alter table os_comentario enable row level security;
create policy os_comentario_select on os_comentario
  for select using (tem_acesso_fazenda((select fazenda_id from os where id = os_id)));
create policy os_comentario_insert on os_comentario
  for insert with check (pode_editar_fazenda((select fazenda_id from os where id = os_id)));
-- sem policy de update/delete: comentário é um log, não se edita/apaga (igual
-- os_status_historico) — se precisar corrigir, comenta de novo.
