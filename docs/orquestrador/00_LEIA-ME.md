# 00 · LEIA-ME — Pacote do Módulo Orquestrador

Este pacote leva o **módulo de orquestração de back-office (OS & Demandas)** do planejamento ao código, dentro do sistema de gestão que já existe (o do confinamento).

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `SPEC_orquestrador_v1.1.md` | A especificação completa (o "o quê" e o "porquê"). |
| `CLAUDE.md` | Constituição do projeto: decisões fechadas, convenções e guardrails que o Claude Code deve seguir sempre. |
| `DATA_MODEL.md` | Esquema de dados novo (SQL), aditivo ao confinamento. |
| `BUILD_PLAN.md` | As 7 fases quebradas em tarefas com critério de pronto. |
| `PROMPT_INICIAL.md` | O prompt para colar no Claude Code e iniciar a Fase M0. |
| `GROUNDING.md` | Norte do bot: taxonomia, few-shot e eval derivados do corpus real. |
| `SETUP_TELEGRAM.md` | Como subir o bot do Telegram (canal do MVP). |

## Onde colocar

- **Mesmo repositório do confinamento.** Este é um módulo do mesmo app, não um projeto novo.
- Coloque estes `.md` em `docs/orquestrador/`.
- Trabalhe num branch: `git checkout -b feat/orquestrador`.

## Regras de ouro (também no CLAUDE.md)

1. **Não alterar tabelas do confinamento** — só ler. Tabelas novas são aditivas.
2. **`tenant_id` + RLS em toda tabela nova** (single-tenant agora, multi-tenant depois).
3. **Antes de escrever migration, inspecionar o schema atual** para alinhar nomes/convenções.
4. **Humano no circuito** para aprovar, comprar e enviar mensagem. O sistema recomenda; a pessoa confirma.
5. **Nada de executar pagamento** — o sistema só gera a autorização estruturada.

## Primeiros passos

1. `git checkout -b feat/orquestrador`
2. Copie estes arquivos para `docs/orquestrador/`.
3. Abra o Claude Code na pasta do projeto.
4. Cole o conteúdo de `PROMPT_INICIAL.md`.
5. O Code vai **inspecionar o schema atual e propor o plano da Fase 0** — revise antes de aplicar.
