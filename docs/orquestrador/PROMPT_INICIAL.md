# PROMPT_INICIAL.md — Para colar no Claude Code

Copie o bloco abaixo no Claude Code, com os arquivos do pacote já em `docs/orquestrador/` e no branch `feat/orquestrador`.

---

```
Você vai me ajudar a construir o MVP do Módulo Orquestrador de Back-Office como uma
nova aba do sistema de gestão que já existe neste repositório (o do confinamento).

Foco: SOMENTE o MVP ("da mensagem à OS visível"), com o canal no TELEGRAM.
Sem autorização do dono, sem pagamento, sem reconciliação e SEM migração do
ClickUp (isso fica para o fim). WhatsApp fica para fase futura.

Contexto obrigatório — leia antes de qualquer coisa:
- docs/orquestrador/CLAUDE.md   (constituição: decisões, convenções, guardrails)
- docs/orquestrador/SPEC_orquestrador_v1.1.md
- docs/orquestrador/DATA_MODEL.md
- docs/orquestrador/BUILD_PLAN.md   (siga a PARTE 1 — MVP)
- docs/orquestrador/GROUNDING.md     (taxonomia, few-shot e eval derivados do corpus real)
- docs/orquestrador/SETUP_TELEGRAM.md (canal do MVP)

Regras que não podem ser violadas:
- NÃO alterar tabelas do confinamento — apenas ler. Toda tabela nova é aditiva.
- tenant_id + RLS em toda tabela nova. Nunca hardcodar tenant.
- Reaproveitar as tabelas já existentes de fazenda, usuário e o junction de acesso
  usuário<->fazenda — referenciar, não recriar.
- Ações consequentes exigem confirmação humana. O sistema NUNCA executa pagamento.

Sua primeira tarefa (Fase M0, sem escrever migration ainda):
1. Inspecione o schema atual do Supabase e me liste os nomes reais das tabelas e
   colunas de: fazenda, usuário, acesso usuário<->fazenda, e as tabelas do
   confinamento que vamos ler depois (consumo, preço de dieta, curral, lote).
2. Compare com o DATA_MODEL.md e me aponte onde os nomes precisam ser ajustados
   (os marcados com "CONFIRMAR"), considerando SÓ as tabelas do MVP
   (os, mensagem, registro_admin, fornecedor, ativo, local, item_catalogo).
3. Me proponha o plano da Fase M0 (tabelas a criar, ordem, estratégia de RLS).
   Nada de ClickUp nesta fase.

Não aplique nada ainda. Mostre o plano e espere meu OK.
```

---

Depois do seu OK, o Code aplica a M0 e seguimos pela PARTE 1 do `BUILD_PLAN.md` (M1 -> M2 -> M3), uma fase por vez.
