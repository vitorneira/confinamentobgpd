# SPEC.md — Especificação do produto

## Objetivo

Substituir as planilhas de confinamento (BG e PD) por um webapp de **gestão de
resultado**: gestores acompanham rebanho, desempenho zootécnico e custos, e a entrada
de dados (pesagens, guia de trato, compras) é simples e à prova de erro. Toda a
inteligência de cálculo das planilhas é preservada, com as melhorias já decididas na
revisão de KPIs (ver `CLAUDE.md` → "Decisões de domínio já fechadas").

## Papéis de usuário

Um mesmo usuário pode estar **vinculado a várias fazendas** (próprias ou arrendadas) —
relação muitos-para-muitos entre usuário e fazenda. O gestor que toca BG e PD é a
mesma pessoa, com **uma conta só**, e alterna entre as fazendas na seleção de fazenda.
O papel do usuário pode variar por fazenda.

- **Dono / Administrador**: vê todas as fazendas. Gerencia parâmetros, dietas,
  currais, usuários e vínculos. Acessa a tela de simulação.
- **Gestor**: vê e opera as fazendas às quais está vinculado (pode ser mais de uma).
  Lança pesagens, monta o guia de trato, registra compras; vê todos os indicadores;
  não altera parâmetros globais.
- **Somente-leitura** (opcional): vê dashboards e relatórios das fazendas vinculadas.

Acesso por fazenda é obrigatório e aplicado no banco (RLS): o usuário só enxerga as
fazendas às quais está vinculado.

## Telas / funcionalidades (MVP)

### 1. Login e seleção de fazenda

### 2. Dashboard da fazenda
Abre com um **painel de alertas** no topo (primeira coisa que o gestor vê):
- Currais/lotes com **pesagem atrasada** (≥ 21 dias; destaque ≥ 30).
- **Insumos acabando** (dias de estoque abaixo do limiar).
- Animais/lotes **abaixo da meta de GMD**.
Cada alerta leva à tela correspondente.

Abaixo, três blocos:
- **Rebanho**: total de animais, por categoria, peso vivo total, **@ vivas em estoque**
  (peso vivo total ÷ 30).
- **Desempenho**: GMD médio (só válidos), ganho acumulado, **@ vivas produzidas**,
  **% na meta de GMD** (excluindo pesagens vencidas).
- **Econômico**: custo dieta médio (R$/kg), custo ração/cab/dia, **custo por @
  produzida em duas visões** (só ração / total com fixo), e **valor de rebanho
  referencial** (arroba viva × preço de referência, com o preço exibido ao lado).

### 3. Animais
- Lista filtrável por curral/categoria: peso atual, dias confinado, GMD, arroba viva,
  **dias desde a última pesagem** (com o alerta 21/30), e sinal de meta de GMD.
- Ficha do animal individual: histórico de pesagens (gráfico de peso no tempo),
  curral, origem, dieta vigente.
- Suporta os **dois tipos**: individual (por brinco) e agregado por lote (mostra o
  lote como unidade: peso médio, GMD do lote).

### 4. Pesagens (evento — fonte da verdade nº 1)
- Lançamento manual rápido (data, curral, brinco+peso).
- **Importar planilha-modelo**: subir a planilha preenchida (via Cowork, a partir da
  folha de campo) e o sistema registra as pesagens após conferência. Brinco novo na
  importação pode virar cadastro (usando a pesagem como entrada), pedindo
  categoria/curral quando faltar.
- **Gerar folha de campo (PDF)** para imprimir: individual (brincos impressos e
  ordenados) ou agregado (linhas numeradas). Cabeçalho: fazenda, lote/curral, data.

### 5. Currais
Por curral: nº de cabeças, peso médio de entrada e atual (só válidos), peso total,
**@ viva total**, GMD médio, ganho total, dieta vigente e composição, e **dias desde
a última pesagem do lote** (alerta 21/30).

### 6. Guia de Trato (evento de custo — fonte da verdade nº 2)
- Entrada **manual do gerente**: total de ração/dia por curral + split
  (manhã/almoço/tarde), com ajuste fino por curral (% ou +kg).
- Cálculo de **vagões por horário com carga balanceada** (um vagão atende vários
  currais; sem vagão super lotado nem pela metade).
- Gera a **folha do guia** para o operador: nº de vagões por horário, kg por vagão e
  receita de ingredientes por vagão.
- Ao **confirmar** o guia do dia, registra os **tratos** (por curral) → alimentam os
  custos. Reconfirmar substitui (última alteração vence).

### 7. Insumos e estoque
- **Compras** (evento — fonte da verdade nº 3): data, insumo, preço/kg, quantidade,
  fornecedor. Lançadas direto no sistema pelo backoffice. Cada compra atualiza o
  **preço** do insumo (custo da dieta "de vitrine") e o **estoque** de uma vez.
- **Estoque atual** e **dias de estoque** por insumo (consumo vem dos tratos reais ×
  composição da dieta), com **alerta** por limiar geral configurável.
- **Dietas**: composição por categoria (BG) ou fase (PD); custo da dieta pela última
  compra; **histórico de dieta por curral com vigência**.

### 8. Custos
- Custo de nutrição por lote/curral e **custo/cab/dia**, sempre **reais** (dos
  tratos, com preço congelado por trato → média real do lote).
- **Custo por @ produzida** (só ração / total com fixo).
- **Conversão alimentar** por lote e por rebanho.

### 9. Fechamento de lote / Venda
- Dois tipos de fechamento (`tipo_venda`, escolhido por fechamento, não por animal):
  - **Abate**: registrar frigorífico, NF, cabeças, preço @, peso de carcaça,
    rendimento **real** — como antes.
  - **Venda direta** (valor combinado — ex. touros PO da BG, ou qualquer animal das
    duas fazendas vendido fora da lógica de abate): registrar comprador e o valor
    combinado **por animal** (a avaliação muda de bicho pra bicho, não é preço
    uniforme nem total único do lote).
- Em qualquer tipo: **frete** e **comissão** são custos que podem existir na venda,
  abatidos do valor bruto junto com as demais deduções.
- Apura receita líquida, custo total (entrada + ração real + fixo), **lucro/lote,
  lucro/cab, margem, ROI, custo da @ produzida** (venda direta usa arroba viva do
  ganho no lugar da arroba de carcaça, que não existe nesse caso).
- **Venda parcial**: por lista de brincos (individual) ou por quantidade (agregado /
  boi de ponta). **Baixa automática** no rebanho ativo; animais ficam no histórico.
- **Editar uma venda já fechada** (corrigir animal esquecido, ajustar valores/frete/
  comissão, adicionar ou remover animal) é restrito ao papel **dono** — gestor só
  fecha vendas novas, não edita as já gravadas (reforçado por RLS, não só na UI).
- O relatório de uma venda fechada mostra **composição por categoria** (quantas
  cabeças de cada categoria saíram) e, quando há animal individual na venda, o
  **brinco + valor financeiro de saída** de cada um (útil pros touros PO da venda
  direta, onde cada animal tem preço próprio).

### 10. Simulação (só dono)
Cenários com parâmetros diferentes (rendimento de carcaça, preço da @, GMD alvo, peso
de abate) — projeta valor/resultado **sem alterar dados salvos**. É o único lugar
onde o proprietário "brinca" com rendimento e preço. Objetivo: comparar CENÁRIOS pra
decidir segurar ou vender o boi — não é só uma calculadora de números.

**Critérios de aceite:**
- **Validação de GMD**: GMD assumido `< 0` ou `> 2,5` kg/dia dispara alerta visível
  ("GMD fora da faixa esperada — verifique as pesagens deste curral"), mas **não
  bloqueia** o cálculo; o campo continua editável pra sobrescrever.
- **Lote já no peso alvo** (peso médio atual ≥ peso de abate alvo): a tela troca de
  modo — sinaliza que a decisão é **vender agora**, mostra o resultado da venda
  imediata (dia 0) e esconde a comparação de horizontes e o ponto ótimo de abate
  (não fazem sentido pra quem já está no alvo).
- **Dois resultados lado a lado, sem ambiguidade**:
  - *Contribuição do confinamento* = receita de abate − custo real de ração − custo
    fixo (**sem** o custo de entrada/compra do lote).
  - *Resultado cheio* = contribuição − custo de entrada. O custo de entrada **não
    existe no sistema** pra um lote ainda não vendido (só é digitado no fechamento
    da venda) — a tela pede o **preço da @ pago na entrada (R$)** como campo opcional
    e calcula `peso de entrada total × 50% ÷ 15 × preço informado` (mesma fórmula do
    fechamento real). Sem esse valor, mostra "—" em vez de estimar.
  - O cálculo incremental (contribuição) nunca é rotulado "margem"/"ROI" sozinho —
    aparece como **"margem sobre custo de operação"** (contribuição ÷ custo de
    operação). **ROI** só existe atrelado ao resultado cheio (resultado cheio ÷
    (custo de operação + custo de entrada)).
- **KPI heroi**: custo da @ produzida (@ **viva**, peso/30) nas duas visões do
  resto do sistema — só ração e total com fixo — comparado ao preço da @ de venda.
  Fica **vermelho** quando `custo da @ produzida ≥ preço da @ de venda`. Traz também
  a **conversão alimentar** projetada (kg ração ÷ kg ganho), de primeira classe como
  no resto do sistema.
- **Cenários**: comparação lado a lado de horizontes configuráveis — "vender agora"
  (dia 0) vs. +N dias vs. +M dias (padrão 30/60) — nas mesmas métricas (peso
  projetado, @ viva produzida, custo da @, contribuição, resultado cheio).
- **Sensibilidade ao preço da @**: mini-tabela do resultado (cheio, ou contribuição
  se a compra não foi informada) a preço base −20/−10/base/+10/+20 (R$/@), no
  cenário do peso alvo (ou de vender agora, se já no alvo).
- **Ponto ótimo de abate** — fórmula: compara o valor de +1 dia de trato (ganho do
  dia × rendimento ÷ 15 × preço da @ carcaça, pra toda a boiada) com o custo de +1
  dia (ração real + fixo, por cabeça × cabeças). Como o sistema assume GMD e custo
  diário **constantes** (sem curva de desaceleração de GMD por peso), essa margem
  diária não varia com o dia — o resultado é sempre um dos extremos: **manter até o
  peso alvo** (margem diária > 0) ou **vender agora** (margem diária ≤ 0). Um ponto
  ótimo genuinamente intermediário exigiria uma curva de GMD por peso, fora do
  escopo atual. Implementação: `src/lib/kpi/simulacao.ts::calcularPontoOtimo`.
- **Break-even**: linha em destaque "abaixo de R$ ___/@ este curral dá prejuízo (com
  a compra)" — `preço break-even = (custo total projetado + custo de entrada) ÷
  arrobas de carcaça projetadas` (receita é linear no preço, então é álgebra direta;
  sem custo de entrada informado, mostra o break-even sem a compra e pede o preço
  de entrada pro break-even completo). Implementação: `calcularBreakEven`.
- **Nomenclatura**: o campo de preço é rotulado **"Preço da @ carcaça (R$)"** (com
  tooltip explicando) — a receita de abate usa arroba de carcaça, mas o resto do
  sistema rastreia arroba **viva**; a 50% de rendimento os números coincidem
  (peso/30 = peso×0,5/15), no que se apoia a comparação acima — em outro rendimento
  hipotético, deixam de ser a mesma unidade.
- Lógica de cálculo pura e testável em `src/lib/kpi/simulacao.ts`, sem componente de
  tela; regressão em `scripts/test/simulacao_check.ts` (`npm run test:simulacao`).

### 11. Parâmetros (por fazenda, só admin)
Preço da @ de referência, % matéria seca, custo fixo diário, GMD meta, peso de abate
alvo, data de referência, **limiares do alerta de pesagem (21/30)** e **limiar de
dias de estoque**.

## Artefatos de entrada de dados (já prototipados)
- **Folha de campo (PDF)**: gerada pelo sistema; individual (brincos ordenados) e
  agregado (linhas numeradas). Cabeçalho fazenda/lote/data; multi-coluna; espaço
  largo para o peso.
- **Planilha-modelo de importação (.xlsx)**: abas **Pesagens** e **Cadastro_Animais**,
  com listas suspensas (fazenda/categoria/curral) e validações. Preenchida pelo
  Cowork a partir do PDF do campo.

## Fora do MVP
- Sanidade/protocolo vacinal por animal.
- Integração com balança/bastão eletrônico.
- App nativo (webapp mobile-first cobre o começo).
- Preço médio ponderado de estoque (usamos última compra + custo congelado por trato).
- Ligar o "total sugerido" do guia ao peso do rebanho (por ora é manual).

## Critérios de aceite gerais
- Os números batem com as planilhas originais para os mesmos dados (regressão).
- Um gestor de PD nunca vê/edita dados de BG (e vice-versa).
- Lançar uma pesagem atualiza sozinho peso, GMD, arroba viva, custos, alertas e
  dashboard.
- Confirmar um guia de trato registra os tratos e atualiza os custos, sem digitar
  em dois lugares.
- Fechar uma venda apura o lucro e dá baixa automática nos animais.
