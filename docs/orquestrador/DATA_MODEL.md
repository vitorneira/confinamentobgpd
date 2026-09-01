# DATA_MODEL.md — Esquema de Dados (aditivo ao confinamento)

> **Antes de aplicar:** inspecionar o schema atual do Supabase. As tabelas de **fazenda**, **usuário** e o **junction de acesso usuário↔fazenda** já existem no confinamento — as FKs abaixo devem apontar para elas, com os nomes reais. Ajuste os nomes marcados com `-- CONFIRMAR`. Todas as tabelas novas levam `tenant_id` e RLS.

## Enums

```sql
create type os_status as enum (
  'aberta','cotando','aguardando_autorizacao','autorizada','negada',
  'aprovada_compra','comprada','entregue','conferida','cancelada'
);
create type os_dominio as enum (
  'nutricao_confinamento','manutencao_mecanica','sanidade','defensivos',
  'construcao_infra','logistica','documentos_contratos','movimentacao_gado','rh_pessoal','outro'
);
create type os_intencao as enum (
  'abrir_demanda','confirmar_fechar','registrar_lancar','relatar_manejo','informacao'
);
create type autorizacao_decisao as enum (
  'pendente','autorizada','negada','expirada','assumida_orquestrador'
);
create type pagamento_status as enum ('gerada','enviada','pago','cancelada');
create type ativo_criticidade as enum ('critico','normal');
create type registro_tipo as enum ('morte','movimentacao','documento','contrato');
```

## Master data

```sql
create table fornecedor (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nome text not null,
  whatsapp text,
  categorias os_dominio[] default '{}',
  origem text,                       -- 'contato_whatsapp' | 'clickup' | 'manual'
  criado_em timestamptz default now()
);

create table ativo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  fazenda_id uuid not null references fazendas(id),   -- CONFIRMAR nome da tabela
  nome text not null,
  tipo text,                         -- 'maquina' | 'benfeitoria' | 'implemento'
  criticidade ativo_criticidade default 'normal',
  custo_acumulado numeric(14,2) default 0,
  criado_em timestamptz default now()
);

create table local (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  fazenda_id uuid not null references fazendas(id),   -- CONFIRMAR
  nome text not null,
  tipo text                          -- 'pasto' | 'curral' | 'piquete' | 'benfeitoria'
);

create table item_catalogo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  nome text not null,
  aliases text[] default '{}',
  categoria os_dominio,
  unidade text,
  estoque_minimo numeric,
  fornecedor_padrao_id uuid references fornecedor(id)
);
```

## Ordens de serviço e fluxo

```sql
create table os (
  id text primary key,               -- 'BG-1234' / 'PD-1234' (sequencial por fazenda)
  tenant_id uuid not null,
  fazenda_id uuid not null references fazendas(id),   -- CONFIRMAR
  solicitante_id uuid references usuarios(id),        -- CONFIRMAR
  responsavel_id uuid references usuarios(id),        -- CONFIRMAR
  dominio os_dominio,
  intencao os_intencao,
  descricao text,
  itens jsonb default '[]',          -- [{qtd, item, catalogo_id?}]
  comprar_produto boolean default false,
  contratar_servico boolean default false,
  autorizacao_dono boolean default false,   -- checkbox que faz subir ao dono
  dono_designado_id uuid references usuarios(id),     -- CONFIRMAR
  fornecedor_id uuid references fornecedor(id),
  ativo_destino_id uuid references ativo(id),
  valor_estimado numeric(14,2),
  status os_status default 'aberta',
  canal_origem text,                 -- 'whatsapp' | 'painel'
  criado_em timestamptz default now(),
  concluido_em timestamptz
);

create table autorizacao (
  id uuid primary key default gen_random_uuid(),
  os_id text not null references os(id),
  dono_designado_id uuid references usuarios(id),     -- CONFIRMAR
  encaminhado_para_id uuid references usuarios(id),    -- CONFIRMAR (2º sócio)
  decisao autorizacao_decisao default 'pendente',
  canal text,
  criado_em timestamptz default now(),
  decidido_em timestamptz
);

create table solicitacao_pagamento (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  os_id text not null references os(id),
  favorecido text not null,
  chave_pix text not null,           -- dado sensível: RLS restrita + log de acesso
  valor numeric(14,2) not null,
  descricao text,                    -- fazenda · maquinário/destino · motivo
  status pagamento_status default 'gerada',
  criado_em timestamptz default now()
);
```

## Registro administrativo, ingestão e anexos

```sql
create table registro_admin (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  fazenda_id uuid references fazendas(id),            -- CONFIRMAR
  tipo registro_tipo not null,
  dados jsonb not null,              -- estrutura varia por tipo
  origem text,
  criado_em timestamptz default now()
);

create table mensagem (
  id text primary key,               -- id da mensagem do WhatsApp (idempotência)
  tenant_id uuid not null,
  canal text,
  remetente text,
  tipo text,                         -- 'audio' | 'texto' | 'documento'
  conteudo_bruto text,
  transcricao text,
  confianca_transcricao numeric,
  dominio os_dominio,
  intencao os_intencao,
  os_id text references os(id),
  registro_id uuid references registro_admin(id),
  timestamp timestamptz default now()
);

create table anexo (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  tipo text,                         -- 'nota_fiscal' | 'comprovante' | 'foto' | 'planilha'
  url text not null,                 -- Supabase Storage
  os_id text references os(id),
  registro_id uuid references registro_admin(id),
  origem text,
  criado_em timestamptz default now()
);
```

## RLS (padrão)

Reaproveitar o mesmo mecanismo do confinamento (acesso usuário↔fazenda). Em cada tabela:

```sql
alter table <tabela> enable row level security;

-- Exemplo: acesso restrito às fazendas às quais o usuário tem vínculo.
create policy <tabela>_por_fazenda on <tabela>
  for all
  using (fazenda_id in (select fazenda_id from acesso_usuario_fazenda   -- CONFIRMAR nome
                        where usuario_id = auth.uid()));
```

- `solicitacao_pagamento`: política **mais restrita** (só orquestrador/registrador/donos), por conter chave PIX.
- Tabelas sem `fazenda_id` (ex.: `item_catalogo`, `fornecedor`): política por `tenant_id`.

## Índices sugeridos

```sql
create index on os (status);
create index on os (fazenda_id, status);
create index on os (responsavel_id);
create index on mensagem (timestamp);
create index on anexo (os_id);
```

## Sequência de IDs de OS

Gerar `BG-####`/`PD-####` por fazenda (sequência ou contador transacional por `fazenda_id`), preservando a continuidade com os números já usados no ClickUp na migração.
