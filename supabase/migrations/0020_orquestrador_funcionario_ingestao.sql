-- Orquestrador — Etapa B, fase FB2 (2026-09-04): ingestão automática de
-- holerite/recibo/comprovante via Telegram. Bot separa por página, casa pelo
-- nome (exato, normalizado) contra o cadastro (0019) e extrai a
-- competência. Ver docs/orquestrador/BUILD_PLAN.md.
--
-- Fluxo (decidido na sessão de grilling): o(s) PDF(s) chegam primeiro e
-- ficam em staging (funcionario_upload_bruto, caminho temporário no bucket
-- já criado em 0019); só quando uma mensagem de texto com a palavra-chave
-- (holerite/recibo/comprovante) chega depois é que são reivindicados e
-- processados. Casamento por nome só é automático quando é EXATO — qualquer
-- dúvida (nome não encontrado, ambíguo, competência não lida) vai pra
-- funcionario_documento_pendente, revisada na FB3 (ainda não construída).

create or replace function public.orq_eh_dono()
returns boolean
language sql security definer stable set search_path = public
as $$
  select exists (
    select 1 from usuarios_fazendas where usuario_id = auth.uid() and papel = 'dono'
  );
$$;

-- Staging interno (só o webhook, via service role, mexe aqui) — sem policy
-- de acesso pra papel autenticado, RLS ligada só pra bloquear por padrão.
create table funcionario_upload_bruto (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default orq_tenant_atual() references orq_tenants (id),
  mensagem_id text not null unique,
  remetente text,
  storage_path text not null,   -- caminho temporário: "_pendente/<mensagem_id>.pdf"
  mime_type text not null,
  recebido_em timestamptz not null default now(),
  reivindicado boolean not null default false
);

alter table funcionario_upload_bruto enable row level security;

create table funcionario_documento_pendente (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null default orq_tenant_atual() references orq_tenants (id),
  upload_bruto_id uuid references funcionario_upload_bruto (id) on delete set null,
  tipo documento_tipo not null,
  nome_extraido text,           -- melhor palpite da IA, mesmo sem casar com ninguém
  competencia_extraida date,
  fazenda_sugerida text,        -- 'BG' | 'PD' | null (recibo cobre as duas, pode não saber)
  storage_path_original text not null,
  storage_path_individual text not null,
  motivo text not null,         -- 'nome_nao_encontrado' | 'nome_ambiguo' | 'competencia_nao_lida'
  resolvido boolean not null default false,
  criado_em timestamptz not null default now()
);

create index on funcionario_documento_pendente (resolvido, criado_em);

alter table funcionario_documento_pendente enable row level security;
create policy funcionario_documento_pendente_all on funcionario_documento_pendente
  for all using (orq_eh_dono()) with check (orq_eh_dono());

-- ---------------------------------------------------------------------------
-- STORAGE — dois prefixos além do "<codigo_fazenda>/..." já coberto em 0019:
-- "_pendente/..." (documento ainda não casado) e "_ambas/..." (recibo cobre
-- as duas fazendas no mesmo arquivo, sem um código único pra policy por
-- fazenda). Restritos ao dono — mais sensível (mistura fazendas, ou ainda
-- não identificado).
-- ---------------------------------------------------------------------------

create policy funcionario_documentos_select_dono_geral on storage.objects
  for select using (
    bucket_id = 'funcionario-documentos'
    and (storage.foldername(name))[1] in ('_pendente', '_ambas')
    and orq_eh_dono()
  );

create policy funcionario_documentos_write_dono_geral on storage.objects
  for all using (
    bucket_id = 'funcionario-documentos'
    and (storage.foldername(name))[1] in ('_pendente', '_ambas')
    and orq_eh_dono()
  ) with check (
    bucket_id = 'funcionario-documentos'
    and (storage.foldername(name))[1] in ('_pendente', '_ambas')
    and orq_eh_dono()
  );
