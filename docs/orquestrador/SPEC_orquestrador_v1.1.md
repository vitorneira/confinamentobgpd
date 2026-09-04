# SPEC — Módulo de Orquestração de Back-Office (Ordens de Serviço & Demandas)

*Versão 1.1 · deploy single-tenant (operação Barra Grande / Pau D'Arco) · arquitetura preparada para multi-tenant*

> **Novidades da v1.1:** modelo de aprovação simplificado (checkbox de autorização do dono + cadeia de escalonamento); ClickUp **substituído** (migração + upload de documentos próprio); entidade de **solicitação de pagamento** estruturada; integração de handoff com o sistema financeiro **Connecterra**.

---

## 0. Contexto e princípio norteador

O sistema captura a comunicação operacional que hoje acontece de forma informal no WhatsApp e a transforma em **demandas, ordens de serviço e registros estruturados**, rastreáveis e roteáveis a partir de um canal central.

**Princípio norteador:** o sistema não substitui o orquestrador — ele **amplifica** essa função, movendo para dentro do sistema o peso da *memória* e do *roteamento*, com o humano no circuito das decisões consequentes.

Integra-se ao módulo de confinamento já existente (mesmo projeto Supabase) e reaproveita suas entidades (curral, lote, brinco, consumo, preço de dieta).

---

## 1. Escopo

### Dentro
- Ingestão de demandas e registros por **voz e texto** via WhatsApp.
- Ciclo de vida de OS com **autorização opcional do dono** (checkbox).
- **Geração de solicitação de pagamento estruturada** (favorecido, PIX, valor, descrição) para handoff ao financeiro.
- Registro administrativo: **mortes, movimentações de gado, documentos, contratos**.
- **Master data**: fornecedores, ativos, pastos e benfeitorias.
- **Upload e gestão de documentos** (substitui o upload do ClickUp).
- Painel do orquestrador e ações via WhatsApp.
- Catálogo de itens recorrentes e reposição.

### Fora
- **Execução financeira**: efetivar pagamento (PIX/boleto), contabilidade, fluxo de caixa. Isso permanece no **Connecterra** (sistema financeiro da fazenda). O sistema **gera e encaminha a autorização**; não move dinheiro nem armazena credenciais bancárias da operação. O status "pago" retorna de fora.
- Emissão fiscal (NF-e).

**Regra de fronteira:** a exclusão é *funcional*. O registro administrativo que hoje trafega junto do financeiro (mortes, movimentações, documentos) **está** no escopo; apenas a *execução* do pagamento fica de fora.

---

## 2. Personas e papéis

| Papel | Hoje | Função |
|---|---|---|
| **Orquestrador** | Vitor | Hub. Recebe tudo, aprova o padrão, roteia, supervisiona. |
| **Gerente de Fazenda** | José (BG), Divino (PD) | Abre demandas (voz). |
| **Dono / Aprovador** | Marconi, João Francis | Autoriza pagamentos quando a OS pede. |
| **Registrador / Financeiro** | Germano | Lança registros; recebe as solicitações de pagamento. |
| **Executor** | Fernando, vaqueiros, torneiro… | Executa a OS. |
| **Admin do Sistema** | (futuro) | Configura tenant, papéis, prazos. |

Aprovação **padrão** fica com o círculo de **compras + financeiro** (orquestrador e registrador). Só sobe ao dono quando a OS é marcada para isso.

---

## 3. Arquitetura de ingestão — dois modos

**Modo A — Voz → Demanda/OS (campo):** áudio → transcrição (STT) → classificação (domínio × intenção) → extração de itens (inclusive "quantidade + item cru") → OS `aberta`, ligada a fazenda/ativo quando identificável.

**Modo B — Texto/Documento → Registro (administrativo):** texto/doc → classificação separa **financeiro (fora)** de **registro administrativo (dentro)** → registro estruturado com anexos. O padrão "lançar no ClickUp" vira criação automática de registro.

Ambos gravam mensagem bruta + transcrição + classificação para auditoria.

---

## 4. Modelo de classificação (dois eixos)

**Domínio:** `nutricao_confinamento`, `manutencao_mecanica`, `sanidade`, `defensivos`, `construcao_infra`, `logistica`, `documentos_contratos`, `movimentacao_gado`, `rh_pessoal`, `outro`.

**Intenção:** `abrir_demanda`, `confirmar_fechar`, `registrar_lancar`, `relatar_manejo`, `informacao`.

Só `abrir_demanda` inicia o ciclo de OS. `registrar_lancar` e `relatar_manejo` viram registro/atualização.

---

## 5. Ciclo de vida da OS (máquina de estados)

```
aberta → cotando → [se "Autorização do dono" marcada: aguardando_autorizacao → autorizada | negada]
        → aprovada_compra → comprada → (solicitacao_pagamento gerada) → entregue → conferida
                                                                       ↘ cancelada (terminal)
```

- **Aprovação padrão** (compras/financeiro): o orquestrador/registrador aprova a compra — não sobe a ninguém.
- **Autorização do dono**: só quando o **checkbox "Autorização do dono"** está marcado na OS. Aí passa por `aguardando_autorizacao` antes de seguir.
- **solicitacao_pagamento**: gerada quando a compra é aprovada e há pagamento a fazer (Seção 7).
- **pago**: status externo, refletido do Connecterra — o sistema não o gera.
- Confirmação de entrega **amarrada ao item** (aceita foto + contagem como prova).
- O sistema aponta **pendências reais** (sem avanço amarrado ao item), não heurística de tempo.

---

## 6. Aprovação e autorização (modelo simplificado)

Sem motor de alçada numérico. **A aprovação padrão é do círculo de compras + financeiro.** Quando uma compra/pagamento precisa do aval dos donos, marca-se o **checkbox "Autorização do dono"** na OS — da mesma família dos checkboxes já usados ("Comprar Produto?", "Contratar serviço?").

**Quando marcar o checkbox** (critério humano no MVP; sugerido pela IA no futuro):
- o dono originou o negócio (ele fez a compra/contratou o prestador e detém valores/prazos);
- compra grande/atípica para a categoria;
- foge do padrão e não se justifica sozinha.

As antigas "regras de defensabilidade" (origem, reconciliação, urgência) deixam de ser um portão que trava e viram **sugestões e alertas**: a reconciliação com o confinamento (preço na faixa? estoque bate com consumo?) vira **alerta** ("preço fora da faixa"), não bloqueio.

**Cadeia de escalonamento da autorização do dono:**
1. Roteia para **o sócio escolhido** na OS.
2. Sem resposta no prazo → **encaminha automaticamente ao outro sócio**.
3. Sem resposta de nenhum no prazo → **abre para o orquestrador dar seguimento**, a seu critério.

*Prazo default (configurável):* ~4 horas úteis por etapa; menor se a OS for marcada como urgente. Toda decisão grava trilha auditável (quem, canal, decisão, timestamp).

---

## 7. Solicitação de pagamento (handoff ao financeiro)

Quando uma compra aprovada exige pagamento, o sistema **monta automaticamente a solicitação no padrão atual da operação**, eliminando a digitação manual:

```
Favorecido: (nome/razão social)
Chave PIX:  (chave do favorecido)
Valor:      R$ ___
Descrição:  fazenda · maquinário/destino · motivo
```

- Vira a entidade **solicitacao_pagamento**, ligada à OS, encaminhada ao Germano/Connecterra.
- O sistema **estrutura e entrega**; a **execução acontece no Connecterra**. Retorno do status "pago" fecha o ciclo.
- **Segurança/escopo:** armazena os dados de pagamento do *favorecido* (para repasse), **não** executa transferências nem guarda credenciais bancárias da fazenda. Chave PIX é dado sensível → RLS restrita + logs de acesso.
- **Integração Connecterra:** MVP gera a mensagem/registro pronto para envio; integração direta por API fica condicionada ao que o Connecterra expuser (Seção 13).

---

## 8. Master data e documentos

- **Fornecedores**: importar dos contatos do WhatsApp + do ClickUp.
- **Ativos**: por fazenda, com **criticidade** (`critico`/`normal`); histórico de OS e custo acumulado por ativo.
- **Pastos / locais / benfeitorias**: referenciáveis pelo nome usado em campo.
- **Catálogo de itens**: nome + aliases + unidade + estoque mínimo + fornecedor padrão; reconhece "acabou X" e sugere reposição.
- **Documentos**: upload próprio (Supabase Storage), anexáveis a OS e registros — substitui o upload do ClickUp. Inclui o fluxo do "grupo" de notas fiscais.

---

## 9. Modelo de dados (entidades principais)

Todas com `tenant_id` (single-tenant agora, multi-tenant depois) e RLS.

- **fazenda** — `id, tenant_id, nome, tipo_posse`
- **usuario** + **papel_fazenda** (junção `usuario × fazenda × papel`)
- **fornecedor** — `id, tenant_id, nome, whatsapp, categorias[], origem`
- **ativo** — `id, tenant_id, fazenda_id, nome, tipo, criticidade, custo_acumulado`
- **local** — `id, tenant_id, fazenda_id, nome, tipo (pasto|curral|piquete|benfeitoria)`
- **item_catalogo** — `id, tenant_id, nome, aliases[], categoria, unidade, estoque_minimo, fornecedor_padrao_id`
- **os** — `id (BG/PD-####), tenant_id, fazenda_id, solicitante_id, responsavel_id, dominio, intencao, descricao, itens[], comprar_produto, contratar_servico, autorizacao_dono (bool), dono_designado_id, fornecedor_id, ativo_destino_id, valor_estimado, status, anexos[], canal_origem, criado_em, concluido_em`
- **autorizacao** — `id, os_id, dono_designado_id, encaminhado_para_id?, decisao (autorizada|negada|expirada|assumida_orquestrador), canal, criado_em, decidido_em`
- **solicitacao_pagamento** — `id, os_id, favorecido, chave_pix, valor, descricao, status (gerada|enviada|pago), criado_em` *(RLS restrita; dado sensível)*
- **registro_admin** — `id, tenant_id, fazenda_id, tipo (morte|movimentacao|documento|contrato), dados jsonb, anexos[], origem, criado_em`
- **mensagem** — log de ingestão/auditoria (`canal, remetente, tipo, conteudo_bruto, transcricao, dominio, intencao, os_id?, registro_id?, timestamp`)
- **anexo/documento** — `id, tipo, url (Storage), os_id?, registro_id?, origem`

---

## 10. Integrações

- **WhatsApp Business Cloud API** — número dedicado (WABA). Webhook de entrada; templates *utility* para push de autorização (respostas na janela de 24h são gratuitas).
- **Transcrição (STT)** — Groq/Whisper, modelo `medium` + **glossário de jargão**.
- **Claude API** — Haiku 4.5 para classificação/extração/roteamento; Sonnet para casos difíceis; prompt caching.
- **Supabase** — Postgres + RLS + Storage (documentos) + Edge Functions. Mesmo projeto do confinamento.
- **Módulo de confinamento** — leitura de consumo/preço para alertas de reconciliação.
- **Connecterra (financeiro)** — handoff da `solicitacao_pagamento`; integração direta por API a avaliar.
- **ClickUp** — **substituído**; migração de dados e documentos (Seção 14, Fase 0).

---

## 11. Stack e arquitetura

- **Frontend**: webapp existente (Next.js/React na Vercel) + **Painel do Orquestrador** (fila unificada por fazenda/status/responsável/domínio; visão de dono: aberto / aguardando autorização / atrasado).
- **Backend**: Supabase (Postgres, RLS, Edge Functions, Storage).
- **Fluxo**: WhatsApp webhook → Edge Function → (STT se áudio) → Claude (classifica/extrai) → grava OS/registro → roteia → (se marcado) push de autorização → (se compra) gera solicitação de pagamento.
- **Multi-tenant-ready**: `tenant_id` + RLS desde já.

---

## 12. Requisitos não-funcionais

- **Humano no circuito** para ações consequentes.
- **Guardrails antes de escrever/enviar**: validar item/valor/fornecedor contra master data.
- **Auditabilidade total**: mensagem → transcrição → classificação → OS → autorização → pagamento.
- **Dados sensíveis** (chave PIX, dados de favorecido): RLS restrita, logs de acesso, sem credenciais bancárias da fazenda no sistema.
- **Identidade de sistema**: bot em número próprio, sobrevive ao orquestrador offline.
- **LGPD**: isolamento por tenant, retenção, consentimento (base para produto).
- **Confiabilidade de transcrição**: medir erro em jargão; revisão manual quando confiança baixa.

---

## 13. Decisões em aberto

1. **Prazo de escalonamento** da autorização do dono (default proposto: ~4h úteis/etapa; menor se urgente) — confirmar.
2. **API do Connecterra**: existe integração programática, ou o handoff fica na mensagem estruturada?
3. **Profundidade da migração do ClickUp**: migrar todo o histórico ou só ativo + arquivar o frio.

*(As demais decisões anteriores — substituição do ClickUp, roteamento por sócio com escalonamento, modelo de aprovação — foram fechadas nesta versão.)*

---

## 14. Plano de build (faseado)

| Fase | Entrega | Valor |
|---|---|---|
| **0. Fundação + migração** | Master data + papéis + `tenant_id`/RLS; **importação do ClickUp** (dados + documentos → Storage) | Base + substituição do ClickUp |
| **1. Ingestão + classificação** | Webhook WhatsApp → STT → classificação → item estruturado; Painel do Orquestrador (leitura) | Para de perder demanda |
| **2. Ciclo de OS + documentos** | Máquina de estados + confirmação amarrada ao item + upload de documentos | Rastreamento real |
| **3. Autorização do dono** | Checkbox + cadeia de escalonamento + push no WhatsApp + trilha | Formaliza o aval |
| **4. Solicitação de pagamento** | Geração estruturada + handoff ao Connecterra | Elimina digitação manual do pagamento |
| **5. Registro administrativo** | Mortes/movimentações/documentos + separação do financeiro | Absorve "lançar no ClickUp" |
| **6. Reconciliação + reposição** | Alertas ligados ao confinamento + estoque mínimo | Compra assistida |
| **7. (Futuro) Produto** | Multi-tenant ativo, self-service, config por cliente | Vira negócio |

---

*v1.1 — consolida as decisões fechadas: ClickUp substituído, aprovação simplificada por checkbox com escalonamento entre sócios, solicitação de pagamento estruturada e handoff ao Connecterra. Deploy inicial single-tenant; arquitetura multi-tenant-ready.*
