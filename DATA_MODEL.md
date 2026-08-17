# DATA_MODEL.md — Modelo de dados

Regra de ouro: **eventos são digitados; indicadores são views/consultas.** Os itens
_(calculado)_ nunca são colunas preenchidas à mão. Reflete todas as decisões da
revisão de KPIs (ver `CLAUDE.md`).

## Visão geral

```
fazenda 1───* curral 1──* dieta_vigencia *──1 dieta *──* dieta_ingrediente *─1 ingrediente 1─* compra_insumo
   │            │                                              
   │            *                                              
   │         animal (individual OU agregado) 1──* pesagem      
   │            │                                              
   │            └──(indicadores calculados: arroba viva, GMD, etc.)
   │
   ├──* guia_trato ──(ao confirmar)──> * trato_diario  (com preço da dieta CONGELADO)
   ├──1 parametros
   └──* venda_lote ──(baixa automática nos animais)
```

## Tabelas de EVENTO (digitadas — fonte da verdade)

### `pesagens`
`id, fazenda_id, data, animal_id (ou brinco), curral, peso_kg, evento_obs`.
Para animal **agregado**, a pesagem é do lote (peso médio ou peso total do lote na
data). Peso pode ser nulo (só movimentação).

### `tratos_diarios` (gerados pelo Guia de Trato ao confirmar)
`id, fazenda_id, data, curral, trato_manha_kg, trato_almoco_kg, trato_tarde_kg,
dieta_id (vigente na data), preco_dieta_congelado`.
- **Único por (curral, data)** — reconfirmar o guia faz **upsert** (última vence).
- `preco_dieta_congelado` é gravado no momento do registro e **nunca** recalculado.
- _total_dia_kg, custo_dia_ = _(calculado)_ a partir das colunas acima.

### `compras_insumos`
`id, fazenda_id, data, ingrediente_id, preco_kg, qtd_kg, fornecedor, obs`.
Lançada no sistema pelo backoffice. Alimenta preço do ingrediente **e** estoque.
_valor_total_ = _(calculado)_.

### `animais` — evento de entrada, com DOIS tipos
`id, fazenda_id, tipo ('individual'|'agregado'), categoria_id, curral_id,
lote_origem, data_entrada, status ('ativo'|'vendido')`
- **individual**: `brinco`, `peso_entrada_kg` (1 linha = 1 animal).
- **agregado**: `quantidade`, `peso_medio_entrada_kg` (1 linha = 1 lote; sem brinco).

### `venda_lote` + `venda_item` — evento de saída (generaliza a antiga `Venda_Nelore`)
`venda_lote`: `id, fazenda_id, curral/lote, tipo_venda ('abate'|'direta'), comprador,
frigorifico, nf, data_abate, data_saida, cabecas, preco_arroba, peso_carcaca_total,
rendimento_real, frete, comissao, deducoes`.
`venda_item`: liga a venda aos animais (lista de brincos) OU registra a quantidade
vendida de um lote agregado; `valor_negociado` guarda o preço combinado daquele item
quando `tipo_venda = 'direta'`. Ao gravar a venda, os animais recebem `status='vendido'`
(**baixa automática**); em lote agregado com venda parcial, a quantidade remanescente
mantém o peso médio e o custo de ração acumulado é rateado proporcionalmente.

`tipo_venda` distingue dois jeitos de apurar o valor bruto de um mesmo fechamento
(um fechamento inteiro é sempre um dos dois, nunca mistura):
- **abate** (frigorífico): `valor_bruto = (peso_carcaca_total / 15) × preco_arroba`,
  como sempre foi.
- **direta** (valor combinado — ex.: touros PO, ou qualquer animal vendido fora da
  lógica de abate, nas duas fazendas): `valor_bruto` = soma de `venda_item.valor_negociado`
  dos itens do lote — preço negociado **por animal**, não uniforme nem um total único,
  porque a avaliação muda de bicho pra bicho. `peso_carcaca_total`/`preco_arroba` ficam
  nulos nesse caso.

Em qualquer tipo, `valor_liquido = valor_bruto − frete − comissao − deducoes` (frete e
comissão são custos de entrega/intermediação que podem existir em qualquer venda, não
só na direta). Para "custo da @ produzida", vendas diretas (sem carcaça real) usam
arroba **viva** do ganho (ganho ÷ 30) no lugar de arrobas de carcaça — mesmo padrão do
resto do sistema para quem não tem rendimento de carcaça apurado.

## CONFIGURAÇÃO / CADASTRO

### `fazendas` — `id, codigo (BG/PD), nome, tipo_posse ('propria'|'arrendada')`.

### `usuarios_fazendas` (vínculo muitos-para-muitos)
`usuario_id, fazenda_id, papel ('dono'|'gestor'|'leitura')`.
Um usuário pode ter várias fazendas (próprias ou arrendadas) e uma fazenda pode
ter vários usuários. A RLS libera cada usuário para as fazendas em que tem vínculo.
O gestor de BG e PD é a mesma pessoa, com uma conta só.
`venda_lote`/`venda_item`: **criar** uma venda continua dono+gestor (evento normal);
**editar/excluir** uma venda já fechada exige `papel = 'dono'` (RLS em
`0011_venda_edicao_dono.sql`, mais checagem explícita nas server actions de edição).

### `parametros` (1 por fazenda)
`preco_arroba_referencia, pct_materia_seca, custo_fixo_dia, gmd_meta,
peso_abate_alvo, data_referencia, alerta_pesagem_atencao_dias (=21),
alerta_pesagem_forte_dias (=30), alerta_estoque_dias (limiar geral)`.
> Rendimento de carcaça **não** é parâmetro fixo de uso diário: padrão 50% onde
> carcaça for necessária; valor real só na `venda_lote`; cenários só na simulação.

### `currais` — `id, fazenda_id, codigo, descricao`.
Nº de cabeças, pesos médios, GMD, ganho, @ viva do curral = _(calculado)_.

### `categorias` — `id, fazenda_id, nome` (configurável; diverge entre BG e PD).

### `ingredientes` — `id, fazenda_id, nome`.

### `dietas` + `dieta_ingredientes`
`dietas`: `id, fazenda_id, nome` (nome = categoria na BG, fase na PD).
`dieta_ingredientes`: `dieta_id, ingrediente_id, proporcao` (soma deve dar **100%**).
- preço do ingrediente = _(calculado)_ última compra.
- custo da dieta "de vitrine" = _(calculado)_ Σ(proporção × preço última compra).

### `dieta_vigencia` (histórico de dieta por curral/lote)
`id, curral_id (ou lote), dieta_id, data_inicio, data_fim`.
Cada trato usa a dieta **vigente na sua data** — casa com o custo congelado.

### `guia_trato` (planejamento do gerente)
`id, fazenda_id, data, capacidade_vagao, split_manha, split_almoco, split_tarde`,
e por curral: `total_dia_kg, ajuste_pct, ajuste_kg`.
Cálculo de vagões por horário com **carga balanceada** = _(calculado)_.
Ao confirmar → cria/atualiza os `tratos_diarios` do dia.

## Indicadores CALCULADOS (views)

### Por animal (individual) ou por lote (agregado)
- data última pesagem; **dias desde a última pesagem** (→ alerta 21/30).
- peso atual; ganho total; **GMD**; **arroba viva** (peso ÷ 30); ganho em @ viva.
- dias confinado (= data_ref − data_entrada).
- atingiu meta de GMD? (só se GMD válido).

### Por curral / rebanho
- nº cabeças; peso médio entrada/atual **(só válidos)**; peso total (todos);
  **@ viva total**; GMD médio **(só válidos)**; ganho total.
- **% na meta de GMD** = válidos na meta ÷ válidos **não vencidos**.
- dias desde a última pesagem do lote (→ alerta).

### Custos (todos REAIS, do trato)
- custo/dia, **custo/cab/dia** (com e sem fixo), custo acumulado por lote (média real
  com preço congelado por trato), **custo por @ produzida** (só ração / total).
- **conversão alimentar** = kg ração (dos tratos) ÷ kg ganho (das pesagens).

### Estoque
- estoque atual = base + compras − consumo (consumo = tratos reais × composição).
- consumo/dia; **dias de estoque** (→ alerta por limiar geral).

### Fechamento de venda
- arrobas de carcaça, carcaça média/cab, valor bruto/líquido, custo de entrada,
  ração real, custo fixo, custo total e /cab, **lucro/lote, lucro/cab, margem, ROI,
  custo da @ produzida**.
- Em venda **direta** (valor combinado, sem abate — ex. touros PO): os campos de
  carcaça/rendimento não se aplicam (ficam vazios); o restante da apuração
  (lucro, margem, ROI, custo da @ pela arroba viva do ganho) funciona igual.
- O relatório também mostra composição da venda: quantidade **por categoria** e,
  para itens individuais, **brinco + valor negociado** de cada um (agrupado em
  JS a partir de `venda_item`, não é view nova).

### Dashboard = agregações das views acima + painel de alertas.
### Simulação = recalcula @/valor/resultado com parâmetros do usuário, sem gravar.

## REMOVIDO
- **Histórico de KPIs** (snapshot manual/automático) — descartado. Substituído pelo
  fluxo de **folha de campo → planilha-modelo → importação**.
- **Custo estimado** por % do peso vivo (Calculadora de Trato como fonte de custo) —
  substituído pelo custo real do Guia de Trato.
- **@ de carcaça no dia a dia** e **valor a mercado embutido** — substituídos por
  arroba viva e valor referencial explícito.

## Regras/validações (que faltavam nas planilhas)
- Brinco único por fazenda (nova pesagem do mesmo animal é esperada, não é duplicata).
- Peso > 0; data não futura além da referência.
- Categoria/curral/dieta/ingrediente por relacionamento (não texto solto).
- Soma dos % da dieta = 100%.
- Sem faixas fixas de linha (o banco cresce sem o limite de 200/5000 do Excel).

## Ordenação canônica de brinco (para folha de campo e listagens)
Prefixo alfabético; dentro do prefixo, número como número ("BBG 998" < "BBG 1004").
Brincos só numéricos com sufixo de ano ("897/24") ordenam pelo número antes da barra
e vêm depois dos com prefixo textual. Implementação de referência em
`dados_originais/geradores/gerar_folha_campo.py`.
