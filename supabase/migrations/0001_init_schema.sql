-- Etapa 1 — schema inicial (DATA_MODEL.md).
-- Eventos (pesagens, tratos_diarios, compras_insumos, animais, venda_lote/venda_item)
-- são digitados; todo indicador (GMD, arroba viva, custos, etc.) é view/consulta,
-- nunca coluna aqui.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- CONFIGURAÇÃO / CADASTRO
-- ---------------------------------------------------------------------------

create table fazendas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nome text not null,
  tipo_posse text not null check (tipo_posse in ('propria', 'arrendada')),
  created_at timestamptz not null default now()
);

create table usuarios_fazendas (
  usuario_id uuid not null references auth.users (id) on delete cascade,
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  papel text not null check (papel in ('dono', 'gestor', 'leitura')),
  primary key (usuario_id, fazenda_id)
);

create table parametros (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null unique references fazendas (id) on delete cascade,
  preco_arroba_referencia numeric not null,
  pct_materia_seca numeric not null,
  custo_fixo_dia numeric not null,
  gmd_meta numeric not null,
  peso_abate_alvo numeric,
  data_referencia date not null,
  alerta_pesagem_atencao_dias int not null default 21,
  alerta_pesagem_forte_dias int not null default 30,
  alerta_estoque_dias numeric not null default 7
);

create table currais (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  codigo text not null,
  descricao text,
  unique (fazenda_id, codigo)
);

create table categorias (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  nome text not null,
  unique (fazenda_id, nome)
);

create table ingredientes (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  nome text not null,
  unique (fazenda_id, nome)
);

create table dietas (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  nome text not null,
  unique (fazenda_id, nome)
);

create table dieta_ingredientes (
  id uuid primary key default gen_random_uuid(),
  dieta_id uuid not null references dietas (id) on delete cascade,
  ingrediente_id uuid not null references ingredientes (id) on delete restrict,
  proporcao numeric not null check (proporcao >= 0 and proporcao <= 1),
  unique (dieta_id, ingrediente_id)
);

-- Vigência por curral: cada trato usa a dieta vigente na sua data (custo congelado
-- casa com a vigência). Na PD, a troca de fase costuma acontecer no mesmo dia em
-- todos os currais; na BG a dieta é fixa por curral (1 vigência sem data_fim).
create table dieta_vigencia (
  id uuid primary key default gen_random_uuid(),
  curral_id uuid not null references currais (id) on delete cascade,
  dieta_id uuid not null references dietas (id) on delete restrict,
  data_inicio date not null,
  data_fim date,
  unique (curral_id, data_inicio)
);

-- ---------------------------------------------------------------------------
-- EVENTOS (digitados — fonte da verdade)
-- ---------------------------------------------------------------------------

-- Animal: dois tipos. individual usa brinco + peso_entrada_kg (1 linha = 1 animal).
-- agregado usa quantidade + peso_medio_entrada_kg (1 linha = 1 lote, sem brinco).
create table animais (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  tipo text not null check (tipo in ('individual', 'agregado')),
  categoria_id uuid not null references categorias (id) on delete restrict,
  curral_id uuid not null references currais (id) on delete restrict,
  lote_origem text,
  data_entrada date not null,
  status text not null default 'ativo' check (status in ('ativo', 'vendido')),
  brinco text,
  peso_entrada_kg numeric,
  quantidade int,
  peso_medio_entrada_kg numeric,
  created_at timestamptz not null default now(),
  constraint animais_individual_tem_brinco_peso check (
    tipo <> 'individual' or (brinco is not null and peso_entrada_kg is not null)
  ),
  constraint animais_agregado_tem_qtd_peso_medio check (
    tipo <> 'agregado' or (quantidade is not null and peso_medio_entrada_kg is not null)
  )
);

-- Brinco único por fazenda (nova pesagem do mesmo animal é esperada, não duplicata).
create unique index animais_fazenda_brinco_unique
  on animais (fazenda_id, brinco)
  where brinco is not null;

-- Pesagem de animal agregado é do lote (peso médio/total do lote na data).
-- Peso pode ser nulo (só movimentação, ex.: troca de curral).
create table pesagens (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  animal_id uuid not null references animais (id) on delete cascade,
  data date not null,
  curral_id uuid not null references currais (id) on delete restrict,
  peso_kg numeric check (peso_kg is null or peso_kg > 0),
  evento_obs text
);

-- Planejamento do gerente (entrada manual, independente do peso do rebanho).
create table guia_trato (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  data date not null,
  capacidade_vagao numeric not null,
  split_manha numeric not null,
  split_almoco numeric not null,
  split_tarde numeric not null,
  unique (fazenda_id, data)
);

create table guia_trato_curral (
  id uuid primary key default gen_random_uuid(),
  guia_trato_id uuid not null references guia_trato (id) on delete cascade,
  curral_id uuid not null references currais (id) on delete restrict,
  total_dia_kg numeric not null,
  ajuste_pct numeric not null default 0,
  ajuste_kg numeric not null default 0,
  unique (guia_trato_id, curral_id)
);

-- Gerado pelo Guia de Trato ao confirmar. Único por (curral, data) — reconfirmar
-- faz upsert (última alteração vence). preco_dieta_congelado nunca é recalculado.
create table tratos_diarios (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  data date not null,
  curral_id uuid not null references currais (id) on delete restrict,
  trato_manha_kg numeric not null default 0,
  trato_almoco_kg numeric not null default 0,
  trato_tarde_kg numeric not null default 0,
  dieta_id uuid not null references dietas (id) on delete restrict,
  preco_dieta_congelado numeric not null,
  obs text,
  unique (fazenda_id, curral_id, data)
);

-- Lançada pelo backoffice; alimenta preço do ingrediente e estoque de uma vez.
create table compras_insumos (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  data date not null,
  ingrediente_id uuid not null references ingredientes (id) on delete restrict,
  preco_kg numeric not null check (preco_kg >= 0),
  qtd_kg numeric check (qtd_kg is null or qtd_kg >= 0),
  fornecedor text,
  obs text
);

-- Generaliza a antiga aba Venda_Nelore para qualquer lote das duas fazendas.
create table venda_lote (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  curral_id uuid references currais (id) on delete set null,
  frigorifico text,
  nf text,
  data_abate date,
  data_saida date,
  cabecas int not null,
  preco_arroba numeric not null,
  peso_carcaca_total numeric,
  rendimento_real numeric,
  deducoes numeric not null default 0
);

-- Liga a venda aos animais (brincos) ou registra quantidade vendida de um lote
-- agregado (venda parcial: remanescentes mantêm peso médio e ração rateada).
create table venda_item (
  id uuid primary key default gen_random_uuid(),
  venda_lote_id uuid not null references venda_lote (id) on delete cascade,
  animal_id uuid references animais (id) on delete restrict,
  quantidade int,
  constraint venda_item_animal_ou_quantidade check (
    (animal_id is not null) or (quantidade is not null)
  )
);
