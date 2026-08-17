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
onde o proprietário "brinca" com rendimento e preço.

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
