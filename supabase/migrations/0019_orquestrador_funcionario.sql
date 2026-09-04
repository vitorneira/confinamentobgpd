-- Orquestrador — Etapa B, fase FB1 (2026-09-04): cadastro de funcionário +
-- armazenamento de documentos de pagamento (holerite/recibo/comprovante).
-- Desenhado numa sessão de grilling com o dono — ver
-- docs/orquestrador/BUILD_PLAN.md ("Cadastro de Funcionário + Documentos de
-- Pagamento"). Distinto de `fornecedor`/`prestador_servico` por pedido
-- explícito do dono (ver comentário de 0018).
--
-- Primeira tabela do projeto a usar Supabase Storage de verdade — até aqui
-- fotos enviadas ao bot eram extraídas e descartadas, nunca guardadas.
--
-- Reenvio nunca sobrescreve (mantém versões); guardamos tanto o arquivo
-- original (lote/fazenda como chegou) quanto o recorte individual do
-- funcionário — no upload manual (esta fase) os dois caminhos apontam pro
-- mesmo arquivo, já que não há split a fazer; a separação por IA (fase FB2)
-- é que vai gerar caminhos diferentes.
--
-- RLS: SELECT liberado pra dono e gestor da fazenda do funcionário (dado de
-- salário é mais sensível que estoque/OS — sem acesso pra papel 'leitura').
-- Escrita (cadastro e upload) restrita ao dono por enquanto, já que só ele
-- envia documentos nesta fase (Q3/Q4 da sessão de grilling).

create type funcionario_tipo as enum ('fixo', 'diarista');
create type documento_tipo as enum ('holerite', 'recibo', 'comprovante');

create table funcionario (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default orq_tenant_atual() references orq_tenants (id),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  nome_completo text not null,   -- como aparece no holerite/recibo — usado pro casamento por IA (FB2)
  apelido text,                  -- nome usual; ajuda o casamento e é o que mais aparece na tela
  tipo funcionario_tipo not null default 'fixo',
  cargo text,
  ativo boolean not null default true,
  data_admissao date,
  criado_em timestamptz not null default now()
);

create index on funcionario (fazenda_id);

alter table funcionario enable row level security;
create policy funcionario_select on funcionario
  for select using (papel_na_fazenda(fazenda_id) in ('dono', 'gestor'));
create policy funcionario_write on funcionario
  for all using (eh_dono_fazenda(fazenda_id)) with check (eh_dono_fazenda(fazenda_id));

create table funcionario_documento (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default orq_tenant_atual() references orq_tenants (id),
  funcionario_id uuid not null references funcionario (id) on delete cascade,
  tipo documento_tipo not null,
  competencia date not null,               -- sempre dia 1 do mês de referência, extraído do documento
  storage_path_original text not null,     -- PDF/lote como chegou (por fazenda, ou cobrindo as duas)
  storage_path_individual text not null,   -- recorte/arquivo deste funcionário especificamente
  versao int not null default 1,
  origem text not null default 'manual',   -- 'manual' | 'telegram'
  enviado_em timestamptz not null default now()
);

create index on funcionario_documento (funcionario_id, competencia desc);

alter table funcionario_documento enable row level security;
create policy funcionario_documento_select on funcionario_documento
  for select using (
    papel_na_fazenda((select fazenda_id from funcionario where id = funcionario_id)) in ('dono', 'gestor')
  );
create policy funcionario_documento_write on funcionario_documento
  for all using (
    eh_dono_fazenda((select fazenda_id from funcionario where id = funcionario_id))
  ) with check (
    eh_dono_fazenda((select fazenda_id from funcionario where id = funcionario_id))
  );

-- ---------------------------------------------------------------------------
-- STORAGE — bucket privado. Caminho: "<codigo_fazenda>/<funcionario_id>/...",
-- o 1º segmento é o que a policy abaixo usa pra checar o papel na fazenda
-- (mesmo espírito de tem_acesso_fazenda/eh_dono_fazenda, sem reimplementar).
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'funcionario-documentos', 'funcionario-documentos', false, 20971520,
  array['application/pdf', 'image/jpeg', 'image/png']
);

create policy funcionario_documentos_select on storage.objects
  for select using (
    bucket_id = 'funcionario-documentos'
    and papel_na_fazenda((select id from fazendas where codigo = (storage.foldername(name))[1])) in ('dono', 'gestor')
  );

create policy funcionario_documentos_write on storage.objects
  for all using (
    bucket_id = 'funcionario-documentos'
    and eh_dono_fazenda((select id from fazendas where codigo = (storage.foldername(name))[1]))
  ) with check (
    bucket_id = 'funcionario-documentos'
    and eh_dono_fazenda((select id from fazendas where codigo = (storage.foldername(name))[1]))
  );
