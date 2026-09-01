-- Orquestrador — Fase M2 (Painel/Fila de Ordens de Serviço). Ajusta o schema da
-- M0 (0014) ao handoff de design revisado (scripts/orquestrador/HANDOFF_ORDENS_
-- DE_SERVICO retornado.md — não versionado, arquivo de trabalho local):
--   1. os_status simplificado pra 8 estados (era 10).
--   2. os.curral_id + os.prazo_pedido — campos novos que a tela de detalhe pede.
--   3. os_status_historico — alimenta a Timeline da tela de detalhe, escrita
--      sozinha por trigger (nunca por app direto).
--   4. mensagem.itens + mensagem.confianca_classificacao — carregam o resultado
--      da classificação até a tela de Triagem. Motivo: o pipeline de ingestão
--      (src/lib/orquestrador/ingest.ts) muda de comportamento nesta fase — para
--      de criar `os`/`registro_admin` sozinho (mesmo com confiança alta).
--      "Humano no circuito" (CLAUDE.md) passa a valer pra toda mensagem
--      classificada como abrir_demanda/registrar_lancar, não só confiança baixa.
--   5. usuarios_da_fazenda() — RPC pros dropdowns de Solicitante/Responsável;
--      auth.users não é selecionável direto pelo client autenticado.
--
-- Tabela `os` está vazia em produção (conferido antes de escrever isto) — a
-- troca de enum abaixo é segura, sem dado real pra migrar.

-- ---------------------------------------------------------------------------
-- 1. os_status: 10 → 8 estados
-- ---------------------------------------------------------------------------

alter type os_status rename value 'aprovada_compra' to 'aprovada';

create type os_status_novo as enum (
  'aberta', 'cotando', 'aguardando_autorizacao', 'aprovada',
  'comprada', 'entregue', 'conferida', 'cancelada'
);

alter table os alter column status drop default;
alter table os alter column status type os_status_novo using status::text::os_status_novo;
alter table os alter column status set default 'aberta';

drop type os_status;
alter type os_status_novo rename to os_status;

-- ---------------------------------------------------------------------------
-- 2. Campos novos em `os`
-- ---------------------------------------------------------------------------

alter table os add column curral_id uuid references currais (id) on delete set null;
alter table os add column prazo_pedido date;

-- ---------------------------------------------------------------------------
-- 3. Histórico de status (Timeline) — só o trigger escreve aqui
-- ---------------------------------------------------------------------------

create table os_status_historico (
  id uuid primary key default gen_random_uuid(),
  os_id text not null references os (id) on delete cascade,
  status os_status not null,
  autor_id uuid references auth.users (id),
  criado_em timestamptz not null default now()
);

create or replace function public.os_registrar_historico_status()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into os_status_historico (os_id, status, autor_id)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create trigger os_status_historico_trigger
  after insert or update on os
  for each row execute function os_registrar_historico_status();

create index on os_status_historico (os_id);

alter table os_status_historico enable row level security;
create policy os_status_historico_select on os_status_historico
  for select using (tem_acesso_fazenda((select fazenda_id from os where id = os_id)));
-- sem policy de insert/update/delete: só o trigger (security definer) escreve.

-- ---------------------------------------------------------------------------
-- 4. `mensagem`: carrega a classificação até a Triagem confirmar
-- ---------------------------------------------------------------------------

alter table mensagem add column itens jsonb;
alter table mensagem add column confianca_classificacao numeric;
-- botão "Descartar" da Triagem: tira da fila sem virar os/registro_admin.
alter table mensagem add column descartada boolean not null default false;

-- ---------------------------------------------------------------------------
-- 5. Dropdown de pessoa (Solicitante/Responsável) — auth.users não é
--    selecionável direto; função security definer expõe só id+email de quem
--    tem vínculo com a fazenda.
-- ---------------------------------------------------------------------------

create or replace function public.usuarios_da_fazenda(p_fazenda_id uuid)
returns table (id uuid, email text)
language sql security definer stable set search_path = public
as $$
  select u.id, u.email
  from usuarios_fazendas uf
  join auth.users u on u.id = uf.usuario_id
  where uf.fazenda_id = p_fazenda_id
    and tem_acesso_fazenda(p_fazenda_id) -- quem chama precisa ter acesso, senão devolve vazio
  order by u.email;
$$;
