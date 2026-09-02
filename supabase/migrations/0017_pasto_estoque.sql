-- Estoque por Pasto — novo domínio (rebanho a pasto, fora do confinamento),
-- pedido pelo dono depois de revisar as planilhas de estoque por pasto de
-- BG/PD (dados_originais/estoque fazendas/). Mesmo princípio do resto do
-- sistema: evento é a fonte da verdade, "estoque atual" é sempre derivado
-- (view), nunca uma coluna digitada.
--
-- Escopo desta etapa (decisão do dono, 2026-09-02): só BG/PD (outras
-- propriedades citadas nas planilhas — Aurora, Boi Brasil, Tesla, Chuva de
-- Manga — ficam de fora por ora); sem UA/hectare, capim, estado da
-- pastagem; sem "Movimentações" entre propriedades. Só cabeça por
-- categoria/pasto, atual + histórico.

create table pastos (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  nome text not null,
  hectares numeric,
  ativo boolean not null default true,
  unique (fazenda_id, nome)
);

alter table pastos enable row level security;
create policy pastos_select on pastos for select using (tem_acesso_fazenda(fazenda_id));
create policy pastos_write on pastos
  for all using (pode_editar_fazenda(fazenda_id)) with check (pode_editar_fazenda(fazenda_id));

-- Categoria como texto livre (não FK) — BG e PD usam conjuntos diferentes
-- (Touro/Vaca/Garrote/Novilha/Bezerros/Tropa vs Vaca Parida/Vaca/Novilha/
-- Novilhota/Garrote/Bez(O/A)/Touro/Tropa) — mesmo padrão já usado pra
-- `lote_origem` em `animais`.
create table pasto_estoque_evento (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  pasto_id uuid not null references pastos (id) on delete restrict,
  categoria text not null,
  quantidade int not null check (quantidade >= 0),
  data date not null,
  obs text,
  origem text not null default 'manual' check (origem in ('manual', 'bot_foto')),
  criado_em timestamptz not null default now()
);

alter table pasto_estoque_evento enable row level security;
create policy pasto_estoque_evento_select on pasto_estoque_evento
  for select using (tem_acesso_fazenda(fazenda_id));
create policy pasto_estoque_evento_write on pasto_estoque_evento
  for all using (pode_editar_fazenda(fazenda_id)) with check (pode_editar_fazenda(fazenda_id));

create index on pasto_estoque_evento (pasto_id, categoria, data desc);

-- "Estoque atual" = linha mais recente por pasto+categoria. Nunca digitado
-- diretamente — só existe pesagem/evento novo, igual pesagens/tratos.
create view v_pasto_estoque_atual with (security_invoker = on) as
select distinct on (pe.pasto_id, pe.categoria)
  pe.fazenda_id,
  pe.pasto_id,
  p.nome as pasto_nome,
  p.hectares,
  pe.categoria,
  pe.quantidade,
  pe.data as data_evento
from pasto_estoque_evento pe
join pastos p on p.id = pe.pasto_id
order by pe.pasto_id, pe.categoria, pe.data desc, pe.criado_em desc;

-- Fila de extrações do bot (foto do Telegram com legenda "estoque...")
-- aguardando conferência humana antes de virar pasto_estoque_evento de
-- verdade — mesmo princípio de "humano no circuito" do Orquestrador, mas
-- aqui o destino final é uma tabela do confinamento, não uma OS. Decoupled
-- da tabela `mensagem` do Orquestrador de propósito (módulos independentes);
-- `mensagem_id` só serve de guarda de idempotência (mesma foto reenviada
-- pelo Telegram nunca duplica a pendência).
create table pasto_estoque_pendente (
  id uuid primary key default gen_random_uuid(),
  mensagem_id text not null unique,
  fazenda_id uuid references fazendas (id) on delete cascade,
  remetente text,
  itens jsonb not null, -- [{ pasto: string, categoria: string, quantidade: number }]
  data date not null,
  confirmado boolean not null default false,
  criado_em timestamptz not null default now()
);

-- fazenda_id pode ser null (bot não identificou a fazenda pela legenda) —
-- mesma situação da Triagem do Orquestrador, reusa o mesmo stopgap
-- (dono/gestor de qualquer fazenda pode ver/confirmar a fila toda; ver
-- comentário de orq_pode_editar_master_data em 0014).
alter table pasto_estoque_pendente enable row level security;
create policy pasto_estoque_pendente_select on pasto_estoque_pendente
  for select using (orq_pode_editar_master_data());
create policy pasto_estoque_pendente_write on pasto_estoque_pendente
  for all using (orq_pode_editar_master_data()) with check (orq_pode_editar_master_data());
