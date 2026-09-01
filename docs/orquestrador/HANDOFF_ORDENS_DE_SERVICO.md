# HANDOFF_ORDENS_DE_SERVICO.md

Instruções para implementar o módulo **Ordens de Serviço** no sistema de gestão (Next.js + Tailwind v4, tema escuro).

Referência visual: `Ordens de Servico.dc.html` (abrir no navegador). Nenhuma cor nova foi introduzida — tudo sai dos tokens já em uso no módulo de Confinamento.

**Escopo: MVP (fase M2).** O que não está descrito aqui não entra nesta versão. Ver §8.

---

## 1. Navegação — decisão

**Item de NÍVEL SUPERIOR no menu principal**, ao lado de "Confinamento", rótulo "Ordens de Serviço", ícone de caixa de entrada/checklist. Ao clicar, abre na **Fila**.

Rota: `/ordens-servico` (fora de `/[fazenda]/...`) — a fila é multi-fazenda por natureza, então o seletor de fazenda vira **filtro** dentro da tela, não pré-requisito na rota.

Alternativas avaliadas e descartadas:
- Aninhado por fazenda (`/[fazenda]/ordens-servico`): mata a visão consolidada das três fazendas, que é o principal valor da central.
- Só caixa de entrada no header: bom como *complemento* futuro (contador de pendências), insuficiente como casa do módulo — não sustenta detalhe nem triagem.

O item de nível superior fica ativo com `border-bottom: 2px solid var(--color-primary)` no cabeçalho, mesmo padrão do Confinamento.

---

## 2. Sistema de status — 8 estados

Diferenciados por **hue + preenchimento**, não só por cor: estados em andamento são *tint* (fundo escuro + texto colorido + borda), estados concluídos são *sólidos*. Isso mantém o ciclo legível mesmo sem depender de percepção de cor.

| status | texto | fundo | borda | tratamento |
|---|---|---|---|---|
| `aberta` | `#a1a1aa` | `#1e1e21` | `#3f3f46` | tint |
| `cotando` | `#6FA8E8` | `#14243A` | `#22406B` | tint |
| `aguardando_autorizacao` | `#F5A623` | `#241C09` | `#4D3B14` | tint |
| `aprovada` | `#D49A84` | `#2A140D` | `#5C2A18` | tint (bordô = decisão do dono) |
| `comprada` | `#ffffff` | `#B04227` | `#B04227` | **sólido** |
| `entregue` | `#22C55E` | `#0A1F10` | `#16542C` | tint |
| `conferida` | `#052e16` | `#22C55E` | `#22C55E` | **sólido** (terminal de sucesso) |
| `cancelada` | `#F87171` | `#2A0E0E` | `#5C1F1F` | tint |

Badge: `padding: 4px 11px; border-radius: 999px; font-size: 11.5px; font-weight: 700; white-space: nowrap;` (versão `sm` em tabelas: `3px 9px`, `10.5px`).

Rótulos exibidos em português com espaço, não com underscore: `aguardando_autorizacao` → "aguardando autorização".

> **São exatamente 8 estados — o banco se ajusta a esta lista.** O enum atual tem `autorizada` e `negada` a mais, e `aprovada_compra` no lugar de `aprovada`; uma migration nova alinha o enum ao conjunto acima. Uma compra recusada vai direto para `cancelada` — "negada" não é estado próprio. Não crie estados intermediários novos na UI.

---

## 3. Tela 1 — Fila unificada (`/ordens-servico`)

Tela inicial do módulo.

**Cabeçalho da página:** título "Fila" + linha de contexto (`14 abertas · 3 aguardando autorização · 2 chegando agora`) + botão primário "Nova OS" à direita.

**Barra superior do app:** logo + nome do sistema, divisor, e o **seletor de fazenda reaproveitado do Confinamento** com uma opção extra "Todas" (ativa por padrão nesta tela).

> **O seletor é dirigido pelos dados.** Monte as opções a partir da tabela `fazendas` (`"Todas"` + uma por registro existente), nunca de uma lista fixa no código. Hoje existem duas fazendas, ambas de posse própria: `BG` (Barra Grande) e `PD` (Pau D'Arco) — o mockup mostra só essas duas porque são as que existem, não porque o número é dois. Se uma fazenda arrendada for cadastrada depois, ela aparece sozinha, sem redesenho e sem caso especial. O mesmo vale para o **prefixo do ID da OS**: deriva do código da fazenda no banco (`BG-####`, `PD-####`, e o que vier), não de um enum no front. As cores de chip por fazenda saem de uma paleta cíclica de tokens existentes, atribuída por índice — assim uma fazenda nova já nasce com cor válida.

**Filtros (duas linhas):**
1. Campo de busca (`flex: 1`, placeholder "Buscar por ID, título ou solicitante") + dropdowns: Fazenda, Domínio, Responsável.
2. Chips de status: "Todos · 31" (ativo, preenchido bordô) + um chip por status, cada um com o texto na cor do próprio status e borda neutra — assim a paleta do ciclo de vida já se ensina no filtro.

**Faixa de triagem** (acima da tabela, só aparece quando há itens pendentes): banner âmbar (`#241C09` / borda `#4D3B14`) com bolinha, texto "N mensagens classificadas esperando confirmação — revise domínio e itens antes de virarem OS" e link "Revisar" que leva à tela de triagem.

**Tabela** — 8 colunas, grid com scroll horizontal:
```
grid-template-columns: 96px 1.9fr 1.05fr 1fr 1fr 96px 0.95fr 176px;
/* ID · Título · Domínio · Solicitante · Responsável · Fazenda · Valor est. · Status */
```
- Wrapper: `overflow-x: auto` + inner `min-width: 1075px` — em viewport médio a tabela **rola**, não comprime.
- Célula de texto: `padding: 11px 14px; font-size: 12.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`
- Células de **badge** (Fazenda e Status) usam estilo próprio **sem** `overflow: hidden`/`text-overflow` — senão a pílula é fatiada ao meio. Importante: a trilha de Status é fixa em `176px` porque "aguardando autorização" é o rótulo mais largo.
- ID em bordô claro `#D49A84`, peso 700, `tabular-nums`. Formato `<CÓDIGO DA FAZENDA>-####`, com o código vindo do banco.
- Zebra: linhas ímpares com `background: #0f0f11`.
- Valor estimado alinhado à direita, `tabular-nums`.
- Rodapé: "Mostrando 9 de 31 ordens" + link "Carregar mais".

**Estado vazio (fila sem resultados):** ícone placeholder, "Nenhuma ordem com esses filtros", subtexto que **nomeia os filtros ativos** ("Você está vendo Barra Grande + status aguardando autorização") e diz quantas ordens existem sem filtro. Dois botões: "Limpar filtros" (secundário) e "Nova OS" (primário).

---

## 4. Tela 2 — Detalhe da OS (`/ordens-servico/[id]`)

**Cabeçalho:** ID (`BG-0247`, bordô claro, tabular) + badge de status + chip de fazenda na mesma linha; título da OS abaixo em 19px/800. À direita: "Cancelar OS" (secundário) e "Autorizar" (primário).

**Corpo em 2 colunas** (`grid-template-columns: 1.55fr 1fr; gap: 30px`):

**Coluna esquerda:**
- *Dados da ordem* — grid de 4 colunas com 8 campos: Solicitante, Responsável, Domínio, Fornecedor, Curral vinculado (**link cruzado para o Confinamento**, em bordô claro com `↗`), Aberta em, Prazo pedido (em âmbar quando próximo), Valor estimado. Rótulo em uppercase 10.5px `#52525b`, valor 13.5px/600.
- *Intenção declarada* — bloco `#18181b` com o texto original da mensagem entre aspas + nota de como foi classificado. Preserva a fala do solicitante, não só o campo estruturado.
- *Itens* — tabela de 4 colunas (Qtd · Item · Valor unit. · Total) com linha de total ao pé, fundo levemente distinto (`#141416`).
- *Autorização do dono* — caixa com borda **tracejada** (`1px dashed #3f3f46`), checkbox, título e a ressalva explícita: "Campo registrado, sem fluxo automático nesta versão — marcar aqui não dispara notificação nem libera compra." A borda tracejada sinaliza "campo sem automação" sem parecer erro.

**Coluna direita:**
- *Anexos* — **visual apenas nesta versão, sem upload funcional.** A seção existe (lista de linhas com badge de extensão JPG/PDF/NF + nome + metadados tamanho · data; item pendente em cinza `#52525b`) e a drop zone tracejada existe, mas **nenhum arquivo é salvo** — Storage do Supabase e a RLS própria de anexo ficam para uma fase seguinte. Sinalize sem quebrar o layout: tag discreta "em breve" ao lado do rótulo da seção, drop zone com `opacity: 0.65` e o texto "Arraste foto, PDF ou NF aqui — upload em breve". A lista mostrada é de exemplo/placeholder; não construa a leitura de arquivos ainda.
- *Timeline* — coluna vertical de bolinhas + linha conectora. Concluído: bolinha verde + linha `#16542C`. Atual: bolinha âmbar com `box-shadow: 0 0 0 4px #241C09` (halo) e título em âmbar. Futuro: bolinha vazada com borda `#3f3f46`, título em `#52525b`. Cada etapa mostra data/hora + autor; a etapa atual mostra há quanto tempo está parada ("3 dias parada").

---

## 5. Tela 3 — Triagem (item recém-chegado)

Estado intermediário: a mensagem já foi classificada mas ainda não é OS. Tratada como **revisão**, não como formulário em branco — os campos vêm com o palpite do sistema e o usuário confirma ou corrige.

> **A confirmação humana é obrigatória para toda mensagem, não só para confiança baixa.** Toda mensagem classificada como `abrir_demanda` (ou `registrar_lancar`) passa por esta tela antes de virar OS/registro real — o pipeline de ingestão não cria OS sozinho. O indicador de confiança (`92%`, `certo`) serve para dirigir a atenção do usuário, não para pular a etapa.

**Card principal** (`flex: 1.5`): `border-left: 3px solid #F5A623` — a faixa âmbar à esquerda marca "não confirmado".
- Badge "chegando agora" (âmbar) + origem e tempo ("WhatsApp · há 4 min") + contador "1 de 2".
- Mensagem original em bloco `#141416`, entre aspas.
- *Classificação sugerida — confirme ou corrija*: grid 2×2 com Domínio, Fazenda, Solicitante, Ativo vinculado. Cada campo mostra o palpite + indicador de confiança à direita (`92%` em âmbar, `certo` em verde). Campo não identificado usa **borda tracejada âmbar** e texto "não identificado — selecionar".
- *Itens extraídos*: linhas com checkbox marcado (verde), quantidade, nome e tag "extraído".
- Ações: "Confirmar e criar OS" (primário, `flex: 1`), "Editar" (secundário), "Descartar" (ghost).

**Card lateral** (`flex: 1`) — *Na fila de triagem*: lista das próximas mensagens, cada uma com barra vertical à esquerda (âmbar = pendente, verde = já confirmada, mostrando o ID gerado).

---

## 6. Tokens (todos já existentes)

```
Fundo app        #050505
Card             #0d0d0e   Card 2  #18181b   Card 3  #141416
Borda            #27272a   Borda 2 #3f3f46
Texto            #fafafa   muted #a1a1aa   muted2 #71717a   muted3 #52525b
Ação primária    #B04227   (tint #2A140D · claro #D49A84 · escuro #7A2410)
Sucesso          #22C55E   (tint #0A1F10 · borda #16542C)
Atenção          #F5A623   (tint #241C09 · borda #4D3B14)
Crítico          #F87171   (tint #2A0E0E · borda #5C1F1F)
Info             #6FA8E8   (tint #14243A · borda #22406B)
```
- Tipografia: Inter. Números sempre com `font-variant-numeric: tabular-nums` (IDs, valores, datas).
- Raios: card `16px` · card interno `12–14px` · input/botão `9–10px` · badge `999px`.
- Botões: primário `#B04227` fundo cheio texto branco; secundário transparente com borda `#3f3f46`; ghost só texto `#71717a`. Todos `padding: 10px 18px; border-radius: 9px; font-size: 13px; font-weight: 700`.

## 7. Responsivo
- Desktop é a tela principal (uso tipo caixa de entrada, densidade alta).
- Tabela da fila: `overflow-x: auto` com `min-width: 1075px` no inner — nunca comprimir colunas.
- Abaixo de ~700px: trocar as linhas da tabela por cards (ID + título + badge de status na primeira linha; solicitante/fazenda/valor na segunda) — mesmo padrão que o módulo de Animais usa no mobile.
- Detalhe da OS: as 2 colunas colapsam para 1 (dados → itens → anexos → timeline).

## 8. Fora de escopo nesta versão (MVP / fase M2)
- **Fluxo de pagamento** — nada de baixa, conciliação ou lançamento financeiro.
- **Aprovação completa** — sem notificação, alçada ou assinatura. O checkbox "Autorização do dono" é apenas campo persistido: marcar não dispara nada nem libera compra.
- **Upload real de anexo** — a seção é visual (§4); Storage + RLS de anexo vêm depois.

Mais funcionalidade entra em fases futuras — não antecipar no design nem na implementação agora.
