# Guia de Trato — documentação da feature

> Este arquivo documenta como a página/funcionalidade **Guia de Trato** funciona
> hoje no sistema (webapp de gestão de confinamento, fazendas BG e PD — Next.js
> + TypeScript + Supabase/Postgres). Serve como contexto para pedir mudanças
> nessa área em outra ferramenta/projeto.

## 1. O que é

O Guia de Trato é o **plano diário de ração** por curral e por horário
(manhã/almoço/tarde), com a divisão de carga por **vagão** (o veículo/reboque
que leva a ração até o cocho). É ferramenta de **planejamento do gerente**:

- A entrada é **manual e independente** — o gerente digita/ajusta o total de
  kg por curral e o split entre os 3 horários; o sistema **não** puxa isso do
  peso do rebanho.
- O operador (quem dirige o vagão) só **segue** a folha impressa; não lança
  nada de volta no sistema.
- Melhoria central do fluxo: **balanceamento de carga por horário** — em vez
  de "2 vagões lotados + 1 pela metade", o total de cada horário é dividido no
  **menor número de vagões com carga igual entre eles**.
- Ao **confirmar** o guia de um dia, o sistema grava os **tratos reais**
  daquele dia (por curral) → isso é o que **gera custo** no resto do sistema
  (custo de ração é sempre real, nunca estimado por % do peso vivo).

## 2. Fluxo do usuário (2 etapas)

### Etapa 1 — Planejar (`/{fazenda}/guia-trato`)

1. Gestor abre a página com `?data=YYYY-MM-DD` (padrão: hoje).
2. O sistema busca os currais com **dieta vigente** naquela data
   (`dieta_vigencia`, pega a vigência mais recente com `data_inicio <= data`).
3. Se já existe um guia salvo para o dia, pré-preenche com ele. Senão,
   pré-preenche com o **último guia salvo antes dessa data** (mensagem
   avisando que é sugestão, não confirmado).
4. Gestor edita:
   - Por curral: `total_dia_kg` (base), `ajuste_pct` (%), `ajuste_kg` (+/- kg
     fixo). Total ajustado = `total_dia_kg * (1 + ajuste_pct) + ajuste_kg`.
   - Global: `capacidade_vagao` (kg), e os splits `split_manha` /
     `split_almoco` / `split_tarde` (frações que devem somar 100%).
5. O balanceamento de vagões (seção "Viagens de vagão por horário")
   recalcula **em tempo real no navegador** a cada edição (não chama o
   servidor).
6. Botão **"Salvar plano do dia"**:
   - Valida splits somando 100% e capacidade > 0.
   - Grava (`upsert`) em `guia_trato` (chave `fazenda_id+data`) e
     `guia_trato_curral` (chave `guia_trato_id+curral_id`, um registro por
     curral).
   - **Não toca em `tratos_diarios` — não gera custo ainda.** É só o plano.

### Etapa 1b — Ajustar a divisão por vagão manualmente (opcional)

- Cada grupo "dieta × horário" com mais de 0 vagões mostra inputs pré-cheios
  com a sugestão balanceada (carga igual entre vagões).
- Gestor pode digitar cargas diferentes por viagem; o botão de salvar só
  libera quando a soma bate com o total devido daquele grupo (tolerância
  0,5 kg).
- Salvar grava em `guia_trato_vagao` (apaga tudo daquele
  `guia_trato_id+dieta_id+horario` e insere de novo — **delete + insert**,
  não é update linha a linha).
- Se o gestor mudar totais/ajustes/capacidade depois (o que muda quantos
  vagões são necessários), a edição manual antiga é descartada e a tela volta
  a mostrar a sugestão balanceada nova.
- **Sem edição manual, nada é salvo em `guia_trato_vagao`** — a folha impressa
  e o relatório usam a sugestão calculada na hora.

### Etapa 2 — Confirmar (`/{fazenda}/guia-trato/confirmacao`)

- Tela separada, com filtros por **curral**, **status** (Todos/Pendente/
  Confirmado) e **período de data** (padrão: últimos 14 dias até hoje).
- Cada linha = um par (curral, data) planejado em `guia_trato_curral`.
- **"Confirmado" não é uma coluna** — é inferido só pela **existência de um
  registro em `tratos_diarios`** para aquele curral+data.
- Gestor pode editar o kg antes de confirmar (vem pré-preenchido com o
  planejado, ou com o já confirmado se for reconfirmar).
- Botão Confirmar/Reconfirmar → grava (`upsert`, chave
  `fazenda_id+curral_id+data`) em `tratos_diarios`:
  - `trato_manha_kg = total * split_manha` (idem almoço/tarde), usando os
    splits gravados no `guia_trato` daquele dia.
  - `dieta_id` = dieta vigente do curral naquela data.
  - `preco_dieta_congelado` = custo por kg da dieta **no momento da
    confirmação** — nunca recalculado depois, mesmo que o preço dos
    ingredientes mude no futuro.
- **Pendentes acumulam**: todo plano salvo sem confirmação correspondente
  continua aparecendo como pendente pra sempre nos filtros de data — nada
  expira/some sozinho.
- **Última alteração vence**: reconfirmar o mesmo curral+data **sobrescreve**
  o trato anterior (upsert), nunca duplica.

## 3. Algoritmo de balanceamento de vagão

Arquivo: `src/lib/guia-trato/balanceamento.ts` — lógica pura (sem banco),
usada tanto no formulário (recalcula a cada tecla) quanto na geração do PDF.

Ordem do agrupamento: **curral → dieta → horário → vagão**. Um vagão nunca
mistura duas dietas diferentes na mesma viagem.

```ts
totalAjustado(totalDiaKg, ajustePct, ajusteKg) =
  totalDiaKg * (1 + ajustePct) + ajusteKg

// Para cada grupo (uma dieta, dentro de um horário):
numVagoes     = ceil(totalKg / capacidadeVagao)
cargaPorVagao = totalKg / numVagoes          // <- carga IGUAL entre os vagões
aproveitamento = cargaPorVagao / capacidadeVagao
```

Passo a passo de `calcularBalanceamento(currais, splits, capacidadeVagao)`:
1. Soma `totalAjustado` de cada curral, agrupando por `dietaId`.
2. Divide o total de cada dieta em 3 baldes: `total * splitManha`,
   `total * splitAlmoco`, `total * splitTarde`.
3. Para cada horário, roda a fórmula acima em cada dieta com `totalKg > 0`.
4. `numVagoesTotal` de um horário = soma de `numVagoes` de todas as dietas
   daquele horário (quantas viagens a fazenda inteira precisa fazer).

## 4. Modelo de dados

```sql
-- Plano do dia (1 por fazenda+data)
create table guia_trato (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  data date not null,
  capacidade_vagao numeric not null,
  split_manha numeric not null,
  split_almoco numeric not null,
  split_tarde numeric not null,
  unique (fazenda_id, data)
);

-- Total planejado por curral dentro de um guia_trato
create table guia_trato_curral (
  id uuid primary key default gen_random_uuid(),
  guia_trato_id uuid not null references guia_trato (id) on delete cascade,
  curral_id uuid not null references currais (id) on delete restrict,
  total_dia_kg numeric not null,
  ajuste_pct numeric not null default 0,
  ajuste_kg numeric not null default 0,
  unique (guia_trato_id, curral_id)
);

-- Divisão manual de carga por vagão (só existe se o gestor editou a sugestão)
create table guia_trato_vagao (
  id uuid primary key default gen_random_uuid(),
  guia_trato_id uuid not null references guia_trato (id) on delete cascade,
  dieta_id uuid not null references dietas (id) on delete restrict,
  horario text not null check (horario in ('manha', 'almoco', 'tarde')),
  vagao_index int not null check (vagao_index >= 0),
  carga_kg numeric not null check (carga_kg >= 0),
  unique (guia_trato_id, dieta_id, horario, vagao_index)
);

-- Trato REAL do dia — só existe depois de confirmado. Único por curral+data;
-- reconfirmar faz upsert (última alteração vence).
create table tratos_diarios (
  id uuid primary key default gen_random_uuid(),
  fazenda_id uuid not null references fazendas (id) on delete cascade,
  data date not null,
  curral_id uuid not null references currais (id) on delete restrict,
  trato_manha_kg numeric not null default 0,
  trato_almoco_kg numeric not null default 0,
  trato_tarde_kg numeric not null default 0,
  dieta_id uuid not null references dietas (id) on delete restrict,
  preco_dieta_congelado numeric not null,
  obs text,
  unique (fazenda_id, curral_id, data)
);

-- Qual dieta vale em cada curral, a partir de qual data (histórico)
create table dieta_vigencia (
  id uuid primary key default gen_random_uuid(),
  curral_id uuid not null references currais (id) on delete cascade,
  dieta_id uuid not null references dietas (id) on delete restrict,
  data_inicio date not null,
  data_fim date,
  unique (curral_id, data_inicio)
);
```

**Permissões (RLS)**: leitura liberada pra qualquer usuário vinculado à
fazenda; escrita (criar/editar plano, vagões, confirmar) só para papel
`dono` ou `gestor` — nunca `leitura`. Isso é o que garante "o operador só
segue o guia; não lança valores de volta".

## 5. Arquivos do código

| Arquivo | Papel |
|---|---|
| `src/app/[fazenda]/guia-trato/page.tsx` | Página de planejamento (server component) |
| `src/app/[fazenda]/guia-trato/GuiaTratoForm.tsx` | Formulário completo (client) — tabela por curral + seção de viagens por vagão |
| `src/app/[fazenda]/guia-trato/actions.ts` | Server actions: `salvarPlano`, `salvarVagoes`, `confirmarTratoCurral` |
| `src/app/[fazenda]/guia-trato/confirmacao/page.tsx` | Página de confirmação (server component), com filtros |
| `src/app/[fazenda]/guia-trato/confirmacao/LinhaConfirmacao.tsx` | Uma linha da tabela de confirmação (client) |
| `src/lib/guia-trato/balanceamento.ts` | Algoritmo puro de balanceamento de vagões |
| `src/lib/guia-trato/pdf-folha.ts` | Geração do PDF da folha (usa `pdfkit`) |
| `src/app/api/guia-trato-folha/route.ts` | Endpoint que monta os dados e devolve o PDF |
| `src/lib/queries/guia-trato.ts` | Queries de leitura (currais com dieta vigente, guia existente, itens de confirmação, vagões salvos) |

## 6. Folha PDF para o operador (`/api/guia-trato-folha?fazenda=BG&data=...`)

Conteúdo do PDF (`gerarFolhaGuiaTratoPDF`):
- Cabeçalho: fazenda + data.
- Tabela **"KG por curral por trato"**: curral | dieta | manhã | almoço | tarde.
- Uma seção por horário (Manhã/Almoço/Tarde), cada viagem numerada mostrando:
  quantos kg, qual dieta, quais currais atende, e o kg de **cada ingrediente**
  daquela viagem (kg da viagem × proporção do ingrediente na dieta).
- Usa cargas manualmente salvas (`guia_trato_vagao`) quando existem e batem
  com o número de vagões atual; senão usa a sugestão balanceada.

## 7. Coisas importantes de lembrar ao pedir mudanças

- O Guia de Trato **é** o registro do trato real (não existe "conferência"
  posterior comparando planejado vs. executado no cocho — divergências
  aparecem indiretamente no GMD/conversão alimentar do animal).
- Preço da dieta **congela** no momento da confirmação — mudar essa regra
  quebraria a comparabilidade de custo histórico (`custo real` é um princípio
  central do projeto, ver `CLAUDE.md`).
- Um vagão nunca mistura duas dietas — qualquer mudança no algoritmo de
  balanceamento precisa respeitar isso.
- "Salvar plano" e "Confirmar" são propositalmente **duas etapas separadas**
  (mudança recente, a pedido do dono) — plano não gera custo, só confirmação
  gera.
- `guia_trato_vagao` só guarda algo quando o gestor edita manualmente a
  sugestão — o balanceamento "padrão" nunca é persistido, é recalculado toda
  vez (client e na geração do PDF).
