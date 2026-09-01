# BUILD_PLAN.md — Plano de Construção (v2 · MVP primeiro)

Foco: entregar e validar o **MVP** antes de tudo. Autorização, pagamento, reconciliação e **migração do ClickUp** ficam para depois. Mostrar o plano antes de codar cada fase.

---

# PARTE 1 — MVP: "da mensagem à OS visível"

**Objetivo do MVP:** provar que uma mensagem de WhatsApp (voz ou texto) vira uma OS ou registro estruturado, visível e gerenciável num painel. Sem aprovação, pagamento, reconciliação ou ClickUp.

## Fase M0 — Fundação mínima
1. Inspecionar o schema atual e **reaproveitar** fazenda, usuário e o junction de acesso (não recriar).
2. Criar apenas as tabelas do MVP (aditivas, `tenant_id` + RLS): `os`, `mensagem`, `registro_admin`, e o master data `fornecedor`, `ativo`, `local`, `item_catalogo` — **com FKs opcionais** (uma OS pode nascer sem fornecedor/ativo).
3. Sequência de IDs `BG/PD-####` por fazenda (numeração nova por ora; conciliar com o ClickUp só na migração).
4. **Sem importação do ClickUp.** Master data semeado manualmente com poucos registros ou criado sob demanda.

**Pronto quando:** as tabelas existem, a RLS funciona por fazenda, dá para criar uma OS manualmente.

## Fase M1 — Pipeline de ingestão + classificação (validável offline)
1. Função que recebe uma mensagem (texto ou áudio). No MVP, entrada por **input manual** (colar texto / subir áudio) e/ou **reprocessar o corpus já transcrito** que temos.
2. Transcrição (Groq/Whisper `medium` + glossário de jargão).
3. Classificação via Claude (Haiku): domínio × intenção + extração de itens ("quantidade + item cru").
4. Cria `os` (se `abrir_demanda`) ou `registro_admin` (se `registrar_lancar`). Idempotência por id de mensagem.
5. **Validar a qualidade** contra as mensagens reais (ver `GROUNDING.md`): usar os exemplos rotulados como few-shot e o conjunto de avaliação para medir acerto de domínio/intenção/gera_os.

**Pronto quando:** um áudio real vira OS estruturada; um texto administrativo vira registro; a classificação acerta a maioria no corpus real; nada duplica.

## Fase M2 — Painel do orquestrador (leitura + estado básico)
1. Fila unificada, filtrável por fazenda / status / domínio / responsável.
2. Criar/editar OS também pelo painel (não só por mensagem).
3. Ciclo de vida **simples** no MVP: `aberta -> conferida` / `cancelada`.

**Pronto quando:** dá para ver, filtrar e fechar OS no painel.

## Fase M3 — Telegram ao vivo
1. Criar o bot (@BotFather) e apontar o webhook para a Edge Function do Supabase (ver `SETUP_TELEGRAM.md`).
2. Conectar o pipeline da M1 ao canal real; baixar áudios/arquivos pela API do Telegram; ligar botões inline para ações.
3. Adicionar o bot ao grupo de notas fiscais (privacy mode off) — o Telegram lê grupos, ao contrário do WhatsApp.

**Pronto quando:** uma mensagem real chega pelo Telegram e vira OS/registro no painel. **<- fim do MVP.**

*(WhatsApp não está descartado — entra em fase futura via os dois modos de ingestão; por ora, tudo no Telegram.)*

---

# PARTE 2 — Pós-MVP (incrementos, um por vez)

## P1 — Ciclo de OS completo + documentos
Máquina de estados completa; confirmação de entrega amarrada ao item (foto + contagem); detector de pendências reais; upload de documentos (Supabase Storage), incluindo o fluxo do "grupo" de notas.

## P2 — Autorização do dono
Checkbox "Autorização do dono" + `dono_designado`; push via template do WhatsApp; **cadeia de escalonamento** (sócio escolhido -> outro sócio -> orquestrador; prazo ~4h úteis/etapa, configurável); trilha auditável.

## P3 — Solicitação de pagamento (handoff ao Connecterra)
Geração de `solicitacao_pagamento` (`favorecido / chave PIX / valor / descrição`) a partir da OS aprovada; envio ao registrador/Connecterra (mensagem estruturada; API se houver); status `pago` de volta; RLS restrita + logs para o dado sensível. **Não executa pagamento.**

## P4 — Registro administrativo completo
Estruturar mortes, movimentações, documentos e contratos; separação automática financeiro (fora) x registro (dentro); ligações com rebanho/áreas.

## P5 — Reconciliação + reposição
Alertas lendo o confinamento (preço na faixa? estoque x consumo?); estoque mínimo -> sugestão de reposição; sugestão automática de marcar "Autorização do dono" quando foge do padrão.

## P6 — Migração do ClickUp *(penúltima fase)*
Importar OS históricas, fornecedores e ativos (API/CSV) -> tabelas do sistema; documentos -> Storage. Conciliar a numeração `BG/PD-####`. Estratégia: ativo primeiro, histórico "frio" depois. Ao final, **desligar o ClickUp** como fonte da verdade.

## P7 — (Futuro) Produto
Multi-tenant ativo, onboarding self-service, configuração por cliente, LGPD. Só após validação com clientes reais.
