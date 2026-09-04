# CLAUDE.md — Constituição do Módulo Orquestrador

> Leia junto com `SPEC_orquestrador_v1.1.md`, `DATA_MODEL.md` e `BUILD_PLAN.md`. Em conflito, a SPEC vence; se a SPEC for omissa, siga este arquivo.

## O que é

Módulo de orquestração do back-office da fazenda: captura demandas e registros vindos do WhatsApp (voz e texto), estrutura como Ordens de Serviço (OS) e registros administrativos, roteia entre os participantes e gera autorizações de pagamento para o sistema financeiro externo. É **mais uma aba** do sistema de gestão existente (confinamento), no **mesmo repositório e mesmo Supabase**.

## Princípio norteador

O sistema **amplifica o orquestrador** (o Vitor), não o substitui. Move memória e roteamento para o sistema; mantém o humano no circuito das decisões consequentes.

## Decisões fechadas (não reabrir sem avisar)

- **Dois modos de ingestão:** voz→OS (campo), texto/documento→registro (administrativo).
- **Classificação em dois eixos:** domínio × intenção. Só `abrir_demanda` cria OS.
- **Ciclo de vida da OS:** aberta → cotando → [autorização do dono, se marcada] → aprovada_compra → comprada → (solicitação de pagamento) → entregue → conferida. `cancelada` é terminal. `pago` vem de fora.
- **Aprovação simplificada:** padrão é do círculo compras+financeiro (orquestrador/registrador). Só sobe ao dono quando o **checkbox "Autorização do dono"** está marcado na OS.
- **Escalonamento da autorização:** sócio escolhido → (sem resposta) outro sócio → (sem resposta) orquestrador assume. Prazo default ~4h úteis/etapa, configurável.
- **Canal do MVP:** Telegram (bot). WhatsApp fica para fase futura; a arquitetura de dois modos de ingestão já o comporta.
- **Solicitação de pagamento:** o sistema gera o bloco `favorecido / chave PIX / valor / descrição` e encaminha ao financeiro (Connecterra). **Não executa pagamento.**
- **ClickUp:** substituído. Migrar dados + documentos; upload próprio via Supabase Storage.
- **Fronteira de escopo:** dentro = OS, registros administrativos, master data, autorização de pagamento. Fora = execução financeira e emissão fiscal.

## Convenções

- **ID de OS:** `BG-####` / `PD-####` (sequencial por fazenda), mantendo o padrão do ClickUp.
- **`tenant_id` em toda tabela nova** + RLS. Single-tenant agora; nunca hardcodar tenant.
- **Papéis por função** (orquestrador, gerente_fazenda, dono_aprovador, registrador, executor) — nunca por pessoa.
- **Migrations aditivas.** Não alterar tabelas do confinamento; apenas ler (consumo, preço de dieta, curral, lote).
- **Reaproveitar o que já existe:** tabelas de fazenda, usuário e o junction de acesso usuário↔fazenda já existem no confinamento — referenciar, não recriar. Inspecionar o schema antes.
- Stack: Supabase (Postgres, RLS, Storage, Edge Functions) + Next.js/React na Vercel + **Telegram Bot API** (canal do MVP; WhatsApp fica para fase futura) + STT (Groq/Whisper `medium` + glossário) + Claude API (Haiku 4.5 para classificação; Sonnet em casos difíceis).

## Guardrails

- **Ações consequentes exigem confirmação humana:** aprovar, marcar como comprado, enviar mensagem no canal (Telegram), gerar solicitação de pagamento.
- **Antes de gravar/enviar:** validar item, valor e fornecedor contra o master data. Nunca inventar fornecedor.
- **Dados sensíveis** (chave PIX, dados do favorecido): RLS restrita + logs de acesso. **Nunca** armazenar credenciais bancárias da fazenda nem executar transferências.
- **Transcrição:** medir confiança; abaixo do limiar, marcar para revisão manual em vez de agir.
- **Idempotência na ingestão:** a mesma mensagem do WhatsApp não pode gerar OS duplicada (usar o id da mensagem).

## Estilo de trabalho

- Antes de codar uma fase, **mostrar o plano** (arquivos, tabelas, endpoints) e esperar OK.
- Migrations e mudanças de schema: propor o SQL, explicar, aplicar só após revisão.
- Commits pequenos e descritivos; trabalhar em `feat/orquestrador`.
