# BUILD_PLAN.md — Plano de construção em etapas

Uma etapa por vez, cada uma com **critério de verificação**. Só avança após o dono
aprovar. Reflete as decisões da revisão de KPIs (ver `CLAUDE.md`).

## Etapa 0 — Fundação
- Next.js + TypeScript + Tailwind; conectar Supabase; deploy "hello world" na Vercel.
- **Verificação:** URL da Vercel no ar.

## Etapa 1 — Banco e importação dos dados reais
- Migrações do schema do `DATA_MODEL.md` (eventos, config, cadastro, dois tipos de
  animal). Sem indicadores como coluna.
- Script que lê `dados_originais/*.xlsx` e popula fazendas, parâmetros, currais,
  categorias, ingredientes, dietas, vigências, e os eventos (pesagens, tratos,
  compras, animais) das DUAS fazendas.
- **Verificação:** contagens batem — BG 385 animais / 731 pesagens; PD 646 / 646;
  compras e tratos conferem.

## Etapa 2 — Indicadores como views + testes de regressão
- Views: por animal/lote (arroba viva, GMD, dias desde última pesagem), por curral/
  rebanho (médias só de válidos; % meta excluindo vencidos), custos reais (preço
  congelado por trato; custo/@ nas duas visões; conversão alimentar), estoque.
- Testes comparando com as planilhas: GMD de um animal conhecido; custo/@ do lote
  Nelore da BG; @ viva do rebanho.
- **Verificação:** testes passam e batem com o Excel (dentro de arredondamento).

## Etapa 3 — Autenticação e acesso por fazenda (RLS)
- Supabase Auth; papéis dono/gestor/leitura; RLS por fazenda.
- **Verificação:** logado como gestor de PD, não vejo dados de BG.

## Etapa 4 — Dashboard e telas de leitura
- Dashboard: painel de alertas (pesagem 21/30, estoque, meta) + blocos Rebanho,
  Desempenho, Econômico (com valor referencial e preço da @ exibido).
- Lista de Animais (individual e agregado) + ficha com gráfico de peso.
- Resumo por Curral (com alerta de pesagem do lote).
- **Verificação:** números batem com as planilhas; alertas aparecem corretamente.

## Etapa 5 — Guia de Trato (planejamento + geração de tratos)
- Entrada manual (totais por curral, split, ajustes). **Balanceamento de vagões por
  horário**. Folha do guia para o operador (vagões, kg/vagão, ingredientes/vagão).
- Ao confirmar o dia → cria/atualiza `tratos_diarios` (upsert por curral/dia,
  preço da dieta congelado) → custos se atualizam.
- **Verificação:** confirmo um guia e vejo os tratos e o custo/cab/dia surgirem;
  reconfirmar substitui sem duplicar; vagões saem equilibrados.

## Etapa 6 — Pesagens: folha de campo + importação
- **Gerar folha de campo (PDF)**: individual (brincos ordenados pela regra canônica)
  e agregado (linhas numeradas); cabeçalho fazenda/lote/data; multi-coluna.
- **Planilha-modelo de importação** (abas Pesagens e Cadastro_Animais, com validações)
  e o fluxo de subir a planilha preenchida → conferência → grava pesagens/cadastros.
- Lançamento manual de pesagem também.
- **Verificação:** gero a folha ordenada certa; subo uma planilha-modelo e as
  pesagens entram, atualizando GMD/arroba viva/dashboard.

## Etapa 7 — Insumos, estoque e dietas
- Tela de **compras** (backoffice) que atualiza preço + estoque.
- **Estoque** e **dias de estoque** (consumo dos tratos reais), com alerta por limiar.
- **Dietas** com composição (validação 100%) e **histórico de vigência por curral**.
- **Verificação:** uma compra muda o custo da dieta e o estoque; trocar a dieta de um
  curral com data reflete no custo dos tratos seguintes; alerta de estoque dispara.

## Etapa 8 — Fechamento de lote / Venda
- Venda por lista de brincos ou por quantidade (parcial), com rendimento real;
  apuração de lucro/cab, margem, ROI, custo da @ produzida; **baixa automática**.
- **Verificação:** fecho o lote Nelore da BG e o lucro/cab bate com o Excel; os
  animais somem do rebanho ativo e ficam no histórico; venda parcial rateia custo.

## Etapa 9 — Simulação e acabamento
- Tela de **simulação** (rendimento, preço @, GMD, peso de abate) sem gravar dados.
- Revisão mobile, mensagens de erro amigáveis, criação dos gestores reais, checklist
  de segurança (chaves, RLS, backups), domínio (opcional).
- **Verificação:** a simulação projeta cenários sem alterar nada; os gestores logam
  nos celulares e usam de verdade.

---

### Como revisar cada etapa (papel do dono)
1. Pedir ao Code "o que fez e como testar".
2. Testar pela verificação da etapa.
3. Só então aprovar a próxima.
Se algo não bater com as planilhas, é bug de cálculo — resolver antes de seguir.
