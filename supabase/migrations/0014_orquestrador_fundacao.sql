-- Orquestrador — Fase M0 (fundação). Módulo aditivo de back-office (Orquestrador/
-- CLAUDE.md, SPEC_orquestrador_v1.1.md, DATA_MODEL.md, BUILD_PLAN.md). Não altera
-- nenhuma tabela do confinamento — só lê `fazendas` e reaproveita `usuarios_fazendas`
-- + as funções de RLS de 0004_rls.sql (tem_acesso_fazenda, pode_editar_fazenda).
--
-- Ajustes feitos aqui em relação ao DATA_MODEL.md (marcados lá como CONFIRMAR):
--   - não existe tabela `usuarios` — pessoa é `auth.users` (Supabase Auth nativo).
--   - não existe `acesso_usuario_fazenda` — é `usuarios_fazendas`; reaproveitamos
--     as funções prontas em vez de reescrever a policy.
--   - `os_dominio` ganha o 11º valor `financeiro` (GROUNDING.md — mensagem pode ser
--     classificada como financeiro mesmo sem abrir OS; SPEC seção 4 tinha só 10).
--   - `registro_admin.fazenda_id` vira NOT NULL (DATA_MODEL.md deixava opcional; sem
--     fazenda não dá pra aplicar RLS por fazenda, e todo registro do MVP nasce
--     ligado a uma fazenda).
--   - Sem tabela de tenant no confinamento: criamos `orq_tenants` (single-tenant,
--     1 linha semeada) + `orq_tenant_atual()`, usada como default de `tenant_id`
--     em toda tabela nova — preparado pra multi-tenant sem hardcodar o id em cada
--     query/policy.
--
-- Fora desta migration (fases seguintes do BUILD_PLAN): autorizacao,
-- solicitacao_pagamento, anexo, e qualquer coisa de ClickUp.

-- ---------------------------------------------------------------------------
-- TENANT (single-tenant hoje; arquitetura multi-tenant-ready)
-- ---------------------------------------------------------------------------

create table orq_tenants (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

insert into orq_tenants (nome) values ('Bonsmara — Barra Grande / Pau D''Arco');

-- Único ponto que sabe qual é "o" tenant hoje. Multi-tenant futuro troca só aqui
-- (ex.: ler de um claim do JWT) em vez de em cada tabela/policy.
create or replace function public.orq_tenant_atual()
returns uuid
language sql stable
as $$
  select id from orq_tenants limit 1;
$$;

alter table orq_tenants enable row level security;
create policy orq_tenants_select on orq_tenants
  for select using (auth.uid() is not null);

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

create type os_status as enum (
  'aberta', 'cotando', 'aguardando_autorizacao', 'autorizada', 'negada',
  'aprovada_compra', 'comprada', 'entregue', 'conferida', 'cancelada'
);

create type os_dominio as enum (
  'nutricao_confinamento', 'manutencao_mecanica', 'sanidade', 'defensivos',
  'construcao_infra', 'logistica', 'documentos_contratos', 'movimentacao_gado',
  'rh_pessoal', 'financeiro', 'outro'
);

create type os_intencao as enum (
  'abrir_demanda', 'confirmar_fechar', 'registrar_lancar', 'relatar_manejo', 'informacao'
);

create type registro_tipo as enum ('morte', 'movimentacao', 'documento', 'contrato');

create type ativo_criticidade as enum ('critico', 'normal');

-- ---------------------------------------------------------------------------
-- RLS — helper pra master data sem fazenda_id (fornecedor, item_catalogo,
-- mensagem): escrita restrita a quem é dono/gestor em pelo menos uma fazenda do
-- tenant, igual ao espírito de pode_editar_fazenda mas sem fazenda específica.
-- ---------------------------------------------------------------------------

create or replace function public.orq_pode_editar_master_data()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from usuarios_fazendas uf
    where uf.usuario_id = auth.uid() and uf.papel in ('dono', 'gestor')
  );
$$;

-- ---------------------------------------------------------------------------
-- MASTER DATA
-- ---------------------------------------------------------------------------

create table fornecedor (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default orq_tenant_atual() references orq_tenants (id),
  nome text not null,
  whatsapp text,
  categorias os_dominio[] not null default '{}',
  origem text,                       -- 'contato_whatsapp' | 'clickup' | 'manual'
  criado_em timestamptz not null default now()
);

create table ativo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default orq_tenant_atual() references orq_tenants (id),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  nome text not null,
  tipo text,                         -- 'maquina' | 'benfeitoria' | 'implemento'
  criticidade ativo_criticidade not null default 'normal',
  custo_acumulado numeric(14, 2) not null default 0,
  criado_em timestamptz not null default now()
);

create table local (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default orq_tenant_atual() references orq_tenants (id),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  nome text not null,
  tipo text,                         -- 'pasto' | 'curral' | 'piquete' | 'benfeitoria'
  criado_em timestamptz not null default now()
);

create table item_catalogo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default orq_tenant_atual() references orq_tenants (id),
  nome text not null,
  aliases text[] not null default '{}',
  categoria os_dominio,
  unidade text,
  estoque_minimo numeric,
  fornecedor_padrao_id uuid references fornecedor (id) on delete set null,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- SEQUÊNCIA DE ID DE OS (BG-#### / PD-####, por fazenda)
-- ---------------------------------------------------------------------------

create table os_contador (
  fazenda_id uuid primary key references fazendas (id) on delete cascade,
  proximo_numero int not null default 1
);

insert into os_contador (fazenda_id, proximo_numero)
select id, 1 from fazendas;

-- security definer: roda como dono da função (bypassa RLS de os_contador, que
-- não tem nenhuma policy — só esta função mexe na tabela).
create or replace function public.proximo_id_os(p_fazenda_id uuid)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_codigo text;
  v_numero int;
begin
  select codigo into v_codigo from fazendas where id = p_fazenda_id;
  if v_codigo is null then
    raise exception 'fazenda % não encontrada', p_fazenda_id;
  end if;

  update os_contador
    set proximo_numero = proximo_numero + 1
    where fazenda_id = p_fazenda_id
    returning proximo_numero - 1 into v_numero;

  if v_numero is null then
    insert into os_contador (fazenda_id, proximo_numero) values (p_fazenda_id, 2)
      returning proximo_numero - 1 into v_numero;
  end if;

  return v_codigo || '-' || lpad(v_numero::text, 4, '0');
end;
$$;

alter table os_contador enable row level security;

-- ---------------------------------------------------------------------------
-- OS, MENSAGEM, REGISTRO_ADMIN
-- ---------------------------------------------------------------------------

create table os (
  id text primary key,               -- 'BG-1234' / 'PD-1234', preenchido pelo trigger abaixo
  tenant_id uuid not null default orq_tenant_atual() references orq_tenants (id),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  solicitante_id uuid references auth.users (id),
  responsavel_id uuid references auth.users (id),
  dominio os_dominio not null,
  intencao os_intencao not null,
  descricao text,
  itens jsonb not null default '[]',          -- [{qtd, item, catalogo_id?}]
  comprar_produto boolean not null default false,
  contratar_servico boolean not null default false,
  autorizacao_dono boolean not null default false,
  dono_designado_id uuid references auth.users (id),
  fornecedor_id uuid references fornecedor (id) on delete set null,
  ativo_destino_id uuid references ativo (id) on delete set null,
  valor_estimado numeric(14, 2),
  status os_status not null default 'aberta',
  canal_origem text,                 -- 'whatsapp' | 'painel'
  criado_em timestamptz not null default now(),
  concluido_em timestamptz
);

-- id não pode ser DEFAULT direto (depende de outra coluna, fazenda_id) — trigger
-- preenche só quando não vier setado, pra permitir override manual (ex.: migração
-- do ClickUp reaproveitando numeração antiga, fase P6).
create or replace function public.os_set_id()
returns trigger
language plpgsql
as $$
begin
  if new.id is null then
    new.id := proximo_id_os(new.fazenda_id);
  end if;
  return new;
end;
$$;

create trigger os_set_id_trigger
  before insert on os
  for each row execute function os_set_id();

create table registro_admin (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default orq_tenant_atual() references orq_tenants (id),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  tipo registro_tipo not null,
  dados jsonb not null default '{}',  -- estrutura varia por tipo
  origem text,
  criado_em timestamptz not null default now()
);

create table mensagem (
  id text primary key,               -- id da mensagem do canal (Telegram/WhatsApp) — idempotência
  tenant_id uuid not null default orq_tenant_atual() references orq_tenants (id),
  canal text,                        -- 'telegram' | 'whatsapp' | 'painel'
  remetente text,
  tipo text,                         -- 'audio' | 'texto' | 'documento'
  conteudo_bruto text,
  transcricao text,
  confianca_transcricao numeric,
  dominio os_dominio,
  intencao os_intencao,
  os_id text references os (id) on delete set null,
  registro_id uuid references registro_admin (id) on delete set null,
  "timestamp" timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- fornecedor / item_catalogo: sem fazenda_id — leitura por tenant, escrita
-- restrita a dono/gestor (em qualquer fazenda do tenant).
alter table fornecedor enable row level security;
create policy fornecedor_select on fornecedor
  for select using (tenant_id = orq_tenant_atual());
create policy fornecedor_write on fornecedor
  for all using (orq_pode_editar_master_data()) with check (orq_pode_editar_master_data());

alter table item_catalogo enable row level security;
create policy item_catalogo_select on item_catalogo
  for select using (tenant_id = orq_tenant_atual());
create policy item_catalogo_write on item_catalogo
  for all using (orq_pode_editar_master_data()) with check (orq_pode_editar_master_data());

-- ativo / local / os / registro_admin: fazenda-scoped, mesmo padrão dos eventos
-- do confinamento (0004_rls.sql) — leitura pra quem tem acesso, escrita pra
-- dono+gestor da fazenda.
do $$
declare
  t text;
begin
  foreach t in array array['ativo', 'local', 'os', 'registro_admin']
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

-- mensagem: sem fazenda_id (log de ingestão bruto, pode chegar antes de saber a
-- fazenda) — leitura por tenant, escrita restrita a dono/gestor (a Edge Function
-- de ingestão usa a service role, que bypassa RLS).
alter table mensagem enable row level security;
create policy mensagem_select on mensagem
  for select using (tenant_id = orq_tenant_atual());
create policy mensagem_write on mensagem
  for all using (orq_pode_editar_master_data()) with check (orq_pode_editar_master_data());

-- ---------------------------------------------------------------------------
-- ÍNDICES
-- ---------------------------------------------------------------------------

create index on os (status);
create index on os (fazenda_id, status);
create index on os (responsavel_id);
create index on registro_admin (fazenda_id);
create index on mensagem ("timestamp");
