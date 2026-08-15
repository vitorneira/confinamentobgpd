# CLAUDE.md — Regras do projeto (Sistema de Gestão de Confinamento)

Este arquivo é lido automaticamente pelo Claude Code. Ele define como trabalhar
neste repositório. Leia também `SPEC.md`, `DATA_MODEL.md` e `BUILD_PLAN.md`.

## O que é este projeto

Webapp para gestão de confinamento de gado de duas fazendas (Barra Grande / "BG" e
Pau D'Arco / "PD"), substituindo planilhas Excel. É uma ferramenta de **gestão de
resultado** — não de formulação nutricional (a dieta é definida por um zootecnista
externo; o sistema registra e mede custo e desempenho). Usuários finais: gestores
que acompanham rebanho, custos e desempenho, vários pelo celular, em campo. O dono
acompanha todas as fazendas. Um mesmo usuário pode estar vinculado a VÁRIAS
fazendas (próprias ou arrendadas) — o gestor de BG e PD, por exemplo, é a mesma
pessoa e usa uma conta só.

## Princípio de arquitetura mais importante

**Eventos são a fonte da verdade; indicadores são derivados.**

- Tabelas de **evento** (digitadas): `pesagens`, `tratos_diarios` (gerados pelo Guia
  de Trato), `compras_insumos`, e os eventos de entrada/venda de animais.
- Todo o resto — peso atual, GMD, dias confinado, arroba viva, custos, conversão
  alimentar, dashboard — é **calculado** a partir dos eventos, via views/consultas.
  Não persista indicadores como se fossem digitados, e não reimplemente as fórmulas
  do Excel célula a célula.

## Decisões de domínio já fechadas (NÃO reabrir sem o dono pedir)

Estas decisões foram revisadas KPI a KPI com o dono. Trate-as como requisito.

### Arroba e valor
- A métrica de acompanhamento é **arroba VIVA** = peso vivo ÷ 30 (NÃO usar
  peso × rendimento ÷ 15 no dia a dia).
- O **rendimento de carcaça** só é conhecido de verdade **após o abate**. No dia a
  dia usa-se o **padrão de 50%** apenas onde carcaça for necessária; nunca fixar
  rendimento por lote. Cenários com rendimento/preço diferentes vivem só na **tela
  de simulação** (não alteram dado salvo).
- O sistema **não** ancora valor em preço de mercado nos cálculos automáticos. O
  único lugar com R$ estimado é o **valor de rebanho referencial** do dashboard,
  que usa arroba viva × **preço de referência** e SEMPRE exibe o preço usado ao lado
  (ex.: "Valor de referência: R$ X — @ a R$ 320"). Dinheiro "de verdade" só nos
  custos (reais) e no fechamento de venda (receita real).

### Pesagem e GMD
- GMD por animal = (peso atual − peso entrada) / (data última pesagem − data entrada).
- Indicador **"dias desde a última pesagem"** com alerta escalonado: **atenção ≥ 21
  dias, destaque forte ≥ 30 dias**. Limiares configuráveis nos parâmetros.
- Médias de curral/rebanho (GMD, peso médio) consideram **só animais com GMD válido**
  (2+ pesagens). Peso TOTAL soma todos (é fato de kg).
- **"% na meta de GMD" exclui** animais com pesagem vencida (> limiar de dias).

### Custo
- **Só custo REAL.** Nada de "consumo estimado por % do peso vivo". O custo vem dos
  **tratos** (que saem do Guia de Trato).
- Cada trato guarda o **preço da dieta CONGELADO na data** em que foi registrado. O
  custo acumulado e a diária por lote são a **média real** desses tratos históricos
  (não reaplicar o preço de hoje sobre o passado).
- Preço "de vitrine" (planejamento / custo da dieta exibido) = **preço da última
  compra** de cada ingrediente.
- Custo por @ produzida em **duas visões**: só ração, e total (ração + custo fixo).
  O custo fixo (parâmetro, R$/cab/dia) entra no custo/cab/dia e no custo/@.
- @ produzidas = **arroba viva** do ganho (ganho ÷ 30).
- **Conversão alimentar** (kg de ração ÷ kg de ganho) é KPI de primeira classe.

### Guia de Trato / Vagão
- Ferramenta de **planejamento do gerente**, **independente e com entrada manual**
  (o gerente digita/ajusta os totais por curral e o split; não puxa do peso do
  rebanho). O operador só segue o guia; não lança valores de volta.
- Melhoria central: **balanceamento de carga por horário**. Um vagão atende vários
  currais; o total de cada horário é dividido no menor nº de vagões com carga
  **equilibrada** entre eles (acaba com "2 vagões lotados + 1 pela metade").
- Ao **confirmar** o guia de um dia, o sistema **registra os tratos** daquele dia
  (por curral) automaticamente → alimenta os custos. **Última alteração vence**
  (upsert por curral/dia, nunca duplica).
- O guia planejado **é** o trato real para fins de custo (sem conferência posterior).
  Divergências de cocho aparecem indiretamente no GMD e na conversão alimentar.

### Dieta
- Sistema de gestão de resultado; a dieta vem do zootecnista externo.
- Composição por **categoria** (BG) ou por **fase** (PD) — o modelo suporta ambos.
- Validação: a soma dos % de uma dieta deve dar **100%**.
- **Histórico de dieta por curral/lote com data de vigência** (permite ler custo e
  GMD "por fase da dieta").
- **Matéria natural** é a base operacional; matéria seca é informação secundária.

### Animais: dois tipos
- **Individual**: 1 brinco por animal, pesagem e GMD por cabeça.
- **Agregado por lote**: categoria + peso médio + quantidade, sem brinco; pesagem e
  GMD no nível do lote. Alertas e % meta funcionam por lote nesse caso.
- **Entrada** aceita os dois modos. **Venda** aceita por lista de brincos ou por
  quantidade. Venda parcial de lote agregado: remanescentes mantêm peso médio; custo
  de ração acumulado é rateado proporcionalmente entre vendidos e remanescentes.

### Fechamento de lote / Venda
- Generaliza a apuração da antiga aba `Venda_Nelore` para qualquer lote das duas
  fazendas: valor líquido, custo de entrada, ração real (preço congelado), custo
  fixo, lucro/lote, lucro/cab, margem, ROI, custo da @ produzida.
- **Baixa automática**: animais vendidos saem do rebanho ativo e ficam no histórico.

### Entrada de dados de campo (substitui o antigo "Histórico de KPIs", que foi removido)
- O sistema **gera uma folha de campo** (PDF) para o pessoal imprimir e anotar peso
  à mão. Cabeçalho enxuto: **fazenda, lote/curral, data** (sem conferência de total).
  Layout multi-coluna para aproveitar a página, com espaço largo para o peso.
  - Individual: brincos impressos e **ordenados** (ver regra abaixo).
  - Agregado: linhas numeradas em branco (uma por animal do lote).
- O campo devolve em PDF → convertido (via Cowork) para a **planilha-modelo de
  importação** → subida no sistema. A planilha-modelo tem duas abas: **Pesagens** e
  **Cadastro_Animais** (compras de insumo são lançadas direto no sistema pelo
  backoffice, não entram na planilha).
- **Regra de ordenação de brinco**: prefixo em ordem **alfabética**; dentro do mesmo
  prefixo, número como **número** ("BBG 998" antes de "BBG 1004"). Brincos só
  numéricos com sufixo de ano (ex.: "897/24") ordenam pelo número antes da barra e
  vêm **depois** dos com prefixo textual.
- Há um script/protótipo desses artefatos em `dados_originais/geradores/`
  (`gerar_modelo_importacao.py`, `gerar_folha_campo.py`) — o app deve reproduzir esse
  comportamento; a ordenação canônica está lá.

## Stack (padrão recomendado — confirmar com o dono antes de fixar)

- **Next.js (App Router) + TypeScript** para front e back.
- **Supabase** (Postgres + Auth + Row-Level Security) — a RLS resolve o acesso por
  fazenda de forma nativa.
- **Vercel** para deploy. Estilização com Tailwind. Mobile-first.

Não troque uma peça da stack por conta própria no meio de uma etapa; discuta antes.

## Como trabalhamos

1. Uma **etapa do `BUILD_PLAN.md` por vez**. Não pule etapas.
2. Antes de codar uma etapa, **proponha um plano curto** e espere aprovação.
3. Toda etapa termina com **algo testável** e cujos números **batem com as planilhas
   originais** (teste de regressão).
4. Escreva **testes** para a lógica de cálculo (GMD, custos, arroba viva, conversão
   alimentar, apuração de venda).
5. Commits pequenos e descritivos.

## Convenções de código

- TypeScript estrito. Sem `any` sem justificativa.
- Tabelas/colunas em `snake_case`, em português quando fizer sentido ao domínio.
- Lógica de KPI em módulos testáveis, fora dos componentes de tela.
- Datas em UTC no banco; formatar pt-BR só na exibição.
- Dinheiro e pesos como `numeric` no Postgres (nunca `float`).

## Guardrails (segurança e dados)

- Nunca expor a chave de serviço do Supabase no front.
- Todo acesso a dados passa por **RLS**: o usuário vê as fazendas às quais está
  vinculado (relação muitos-para-muitos usuário↔fazenda). O dono vê todas.
- Migrações de banco versionadas em arquivos.
- Confirmar antes de qualquer operação destrutiva.
- `dados_originais/` é somente-leitura de referência; o import lê, nunca altera.

## Glossário

- **Brinco**: id do animal (texto; pode ter prefixo "BBG 3339" ou sufixo de ano
  "897/24").
- **Curral**: divisão física (BG: 2,3,4,4-TN,5; PD: 1..10).
- **GMD**: ganho médio diário (kg/dia).
- **Arroba viva (@)**: peso vivo ÷ 30 (métrica de acompanhamento padrão).
- **Conversão alimentar**: kg de ração consumida ÷ kg de ganho de peso.
- **Guia de Trato**: plano diário de ração por curral/horário e por vagão; ao ser
  confirmado, vira os tratos do dia.
- **Trato**: fornecimento de ração a um curral (manhã/almoço/tarde), em kg.
