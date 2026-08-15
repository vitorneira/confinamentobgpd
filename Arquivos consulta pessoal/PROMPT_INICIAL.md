# Prompt inicial — cole isto na PRIMEIRA mensagem do Claude Code

> Coloque antes `CLAUDE.md`, `SPEC.md`, `DATA_MODEL.md`, `BUILD_PLAN.md` na raiz do
> repositório, e em `dados_originais/` as três planilhas
> (`Confinamento_BG...`, `Confinamento_PD...`, `Guia_de_Trato_e_Vagao...`) mais a
> subpasta `geradores/` (scripts de referência da folha de campo e da planilha-modelo).

---

Você vai me ajudar a construir um sistema web de gestão de confinamento de gado.

Antes de escrever qualquer código, nesta ordem:

1. **Leia** `CLAUDE.md`, `SPEC.md`, `DATA_MODEL.md` e `BUILD_PLAN.md`. São a fonte da
   verdade. Preste atenção especial à seção "Decisões de domínio já fechadas" do
   `CLAUDE.md` — foram revisadas comigo KPI a KPI e não devem ser reabertas.
2. **Inspecione** as planilhas em `dados_originais/` para confirmar que o
   `DATA_MODEL.md` corresponde aos dados. Aponte divergências. Veja também
   `dados_originais/geradores/` para a regra de ordenação de brinco e o formato da
   folha de campo e da planilha-modelo de importação.
3. **Me faça as perguntas** que realmente bloqueiam o início (não peça o que já está
   nos documentos).
4. **Proponha um plano** para a **Etapa 1** do `BUILD_PLAN.md` apenas — arquivos,
   decisões de arquitetura e como vou verificar. **Não implemente ainda.** Espere eu
   aprovar.

Regras do projeto inteiro:

- Uma **etapa por vez**; só avança após eu aprovar a anterior.
- **Não recrie as fórmulas do Excel.** Eventos (pesagens, tratos, compras) são a
  fonte da verdade; os indicadores são calculados pelo banco a partir deles.
- Cada etapa termina com algo que eu **testo e vejo**, e cujos números **batem com as
  planilhas**.
- Se algo conflitar com boas práticas ou com os documentos, **me avise** em vez de
  seguir cegamente.
- Explique as decisões em português simples — não sou desenvolvedor.

Pode começar pelos passos 1 a 4.
