-- Etapa extra (a pedido do dono, 2026-08-20) — dados de registro genealógico (PO)
-- para touros Bonsmara reprodutores. Isso NÃO é um evento de entrada novo: os
-- animais já existem em `animais` (entraram pelo fluxo normal, têm pesagens e
-- indicadores calculados igual a qualquer outro). Esta tabela só anexa dado
-- cadastral externo (base PO) que o fluxo de entrada não capta — por isso é
-- satélite (1 linha por animal, FK pra `animais`), nunca colunas soltas nem
-- indicador calculado (arroba/GMD/etc. continuam só na view).

create table animais_dados_po (
  animal_id uuid primary key references animais (id) on delete cascade,

  -- Conciliação (como o registro PO foi casado com o brinco do confinamento)
  conciliacao_status text,
  conciliacao_observacao text,

  -- Identificação (base PO)
  nome_completo text,
  apelido text,
  rgn text,
  rgd text,
  raca_po text,
  gs text,
  tipo_reprodutivo text,

  -- Genealogia (base PO)
  pai text,
  rgn_pai text,
  rgd_pai text,
  mae text,
  mae_receptora text,
  avo_paterno text,
  avo_paterna text,
  avo_materno text,
  avo_materna text,

  -- Nascimento e pesos (base PO — distinto das pesagens do confinamento)
  data_nascimento date,
  peso_nascimento_kg numeric,
  peso_desmame_kg numeric,
  data_desmame date,
  peso_po_ultima_kg numeric,
  data_peso_po date,

  -- Andrológico — não existe em nenhuma base hoje; fica editável na ficha.
  ce_cm numeric,

  -- Outros (base PO)
  status_po text,
  fazenda_po text,
  local_po text,
  lote_reprodutivo text,
  fornecedor text,
  data_aquisicao date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mesmo padrão de RLS de `venda_item` (tabela sem fazenda_id direto: sobe até
-- a fazenda via join). Leitura pra quem tem acesso à fazenda do animal;
-- escrita (inclui editar o CE andrológico) pra dono+gestor, igual aos outros
-- eventos de cadastro do animal.
alter table animais_dados_po enable row level security;
create policy animais_dados_po_select on animais_dados_po
  for select using (tem_acesso_fazenda((select fazenda_id from animais where id = animal_id)));
create policy animais_dados_po_write on animais_dados_po
  for all
  using (pode_editar_fazenda((select fazenda_id from animais where id = animal_id)))
  with check (pode_editar_fazenda((select fazenda_id from animais where id = animal_id)));
