# DESIGN_BRIEFING.md — Contexto para o novo Design System

Este arquivo existe pra alimentar a ferramenta de design (Claude Design) com o estado
**real** da UI deste projeto — não uma descrição de intenção, mas o que de fato está
implementado hoje. Quando o design system voltar, o Code (eu) vai ler este arquivo +
o resultado da ferramenta e aplicar as mudanças no código real listado aqui.

## Produto e quem usa

Webapp de gestão de confinamento de gado (duas fazendas, BG e PD). Usuários: gestores
de fazenda, a maioria acompanhando **pelo celular, no campo** — mobile-first é
requisito, não only "responsivo depois". O dono acompanha as duas fazendas. Ferramenta
de trabalho (dados, números, formulários), não um produto de consumo — tom deve
continuar direto e denso em informação, não decorativo.

## Stack e restrições técnicas (o design system precisa respeitar isso)

- **Next.js App Router + TypeScript**, React Server Components por padrão.
- **Tailwind CSS v4** — tema configurado via `@theme` em `src/app/globals.css`
  (não existe `tailwind.config.js`). Qualquer token novo (cor, espaçamento, radius)
  precisa entrar nesse arquivo CSS, no formato do Tailwind v4.
- **Nenhuma biblioteca de componentes** (sem shadcn/Radix/MUI/etc.) e **nenhuma
  biblioteca de ícones** — tudo é HTML/Tailwind puro, texto em vez de ícone (ex.:
  "PDF ↓" em vez de um ícone de download). Se o design novo trouxer ícones, isso é
  uma decisão nova que precisa ser explícita, não implícita.
- Única exceção de biblioteca visual: **Recharts** (`src/components/WeightChart.tsx`,
  gráfico de peso do animal).
- **pdfkit** gera PDFs (folha de campo, recibo de venda, folha do guia de trato) —
  esses documentos são **impressos/PDF**, não seguem o design system da web; não
  precisam ser cobertos pela ferramenta de design.
- Todo componente já suporta **dark mode** via classes `dark:` do Tailwind, hoje
  disparado só por `prefers-color-scheme` (sem toggle manual, sem `data-theme`).

## O que já existe — inventário visual real

### Layout de página
Praticamente toda tela de fazenda segue:
```
<div className="mx-auto max-w-4xl space-y-{6-10} px-4 py-8">
```
Título da página: `<h1 className="text-xl font-semibold text-black dark:text-zinc-50">`.
Subtítulo/descrição opcional: `<p className="mt-1 text-sm text-zinc-500">`.
Seções dentro da página usam um label pequeno maiúsculo antes do conteúdo:
```
<h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-500">Título da seção</h2>
```
(variação um pouco menor usada em cards: `text-xs font-semibold uppercase tracking-wider text-zinc-500`).

### Navegação
`src/app/[fazenda]/layout.tsx` — barra horizontal fixa no topo, fundo branco/zinc-950,
borda inferior, links em `text-zinc-600 dark:text-zinc-400` com hover pra preto/branco.
Em mobile, a nav faz scroll horizontal (`overflow-x-auto`) — não colapsa em menu
hambúrguer hoje.

### Cores
Nenhuma cor de marca própria — é a paleta padrão do Tailwind, usada por convenção:
- **Neutros**: `zinc` (50/100/200/400/500/600/800/900/950) pra texto, bordas, fundos.
  Texto principal `text-black` / `dark:text-zinc-50`; texto secundário
  `text-zinc-500`/`text-zinc-600`.
- **Ação primária**: preto sólido no claro, branco sólido no escuro —
  `bg-black text-white dark:bg-white dark:text-black` (botões "Confirmar", "Salvar",
  "Fechar venda", "Baixar PDF" etc.) — nunca uma cor de destaque tipo azul/roxo.
- **Semânticas fixas** (`src/components/StatusBadge.tsx`, ver CLAUDE.md — "nunca
  reutilizar essas cores pra outra coisa"):
  - `ok` → verde (`green-100`/`green-800` claro, `green-950`/`green-400` escuro)
  - `atencao` → âmbar (`amber-100`/`amber-800` · `amber-950`/`amber-400`)
  - `critico` → vermelho (`red-100`/`red-800` · `red-950`/`red-400`)
- **Resultado financeiro** (lucro/prejuízo, `src/lib/format.ts::corResultado`):
  verde (`text-green-700 dark:text-green-400`) se ≥0, vermelho
  (`text-red-600 dark:text-red-400`) se negativo. Usado em texto **e** em banners
  inteiros com fundo tingido (`bg-green-50 border-green-200` / `bg-red-50 border-red-200`,
  ver recibo de venda e simulação).
- **Acento de gráfico** (só o `WeightChart`): roxo `#4a3aa7` claro / `#9085e9` escuro —
  não é usado em mais nada, é território isolado do Recharts.

### Tipografia
`font-family: Arial, Helvetica, sans-serif` está hardcoded em `globals.css` no `body`
— **isso é uma inconsistência a corrigir**: o projeto já importa e configura a fonte
Geist (`Geist`/`Geist_Mono` do `next/font/google`, variáveis `--font-geist-sans`/
`--font-geist-mono` registradas em `@theme inline`), mas o `body` nunca usa
`var(--font-sans)` — está preso na fonte padrão do sistema. Se o design novo definir
tipografia, aproveitar pra fechar esse gap (ou decidir explicitamente manter Arial).

Escala em uso hoje (sem tokens nomeados, só classes Tailwind diretas):
título de página `text-xl font-semibold`; número grande de destaque (stat cards,
banner de resultado) `text-2xl`/`text-3xl font-bold`; corpo `text-sm`; legendas/labels
`text-xs`. Números sempre com `tabular-nums`.

### Cards / blocos
Padrão universal de "card":
```
rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900
```
Variação "elevada" (usada nas telas mais novas — vendas, recibo, simulação):
```
rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900
```
Não há uma regra clara ainda de quando usar `rounded-lg` sem sombra vs. `rounded-xl`
com `shadow-sm` — foi evoluindo tela a tela. Vale o design system decidir **uma**
convenção e eu aplico em tudo.

`src/components/StatCard.tsx` é o card de estatística padrão do dashboard (label
maiúsculo pequeno + valor grande + sublabel opcional) — reaproveitado em várias telas
via grid `grid-cols-2 sm:grid-cols-4`.

### Tabelas
Padrão em quase toda tela de listagem (animais, insumos, vendas, guia de trato):
```
<div className="overflow-x-auto rounded-lg border ...">
  <table className="w-full text-sm">
    <thead className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
```
Linhas com `divide-y divide-zinc-100 dark:divide-zinc-800`, hover
`hover:bg-zinc-50 dark:hover:bg-zinc-800/50`. Como as tabelas costumam ter mais
colunas do que cabe num celular, existe `src/components/ScrollHint.tsx` — um aviso
de texto pequeno ("deslize pro lado para ver mais →") que só aparece em `sm:hidden`,
mostrado logo acima de toda tabela larga. Isso é uma solução de UX barata pro
problema de tabela-larga-em-mobile — o design system pode propor algo melhor (ex.:
esconder colunas secundárias, ou um layout de cards em vez de tabela no mobile).

### Formulários
Inputs: `rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900`
(ou `bg-zinc-950` dentro de card já branco). Label acima do campo, pequeno e cinza:
```
<label className="text-sm"><span className="mb-1 block text-zinc-500">Nome do campo</span>...
```
Formulários simples usam `<form method="get">` de verdade (filtros, sem JS) — só
formulários que gravam dado usam Server Actions + `useTransition` num client
component. Erro de validação aparece como `<p className="text-sm text-red-600">`
logo abaixo do botão; sucesso como `text-green-700 dark:text-green-400`.

### Botões
- Primário: `rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-black`.
- Secundário/outline (ex. "PDF ↓", "editar"): `rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium ... hover:bg-zinc-100`.
- Link-estilo-botão de baixa ênfase: texto sublinhado (`underline`), sem fundo.

### Alertas e banners
`src/components/AlertList.tsx` — alerta de dashboard: barra com ícone de texto
(▲ atenção, ■ crítico) + mensagem + link "ver", cor de fundo tingida por severidade.
Zero alertas mostra uma barra verde "Nenhum alerta no momento."

Banner de resultado financeiro (recibo de venda, simulação): bloco grande
`rounded-xl border p-5`, label pequeno maiúsculo, número gigante colorido
(`text-3xl font-bold`), linha de contexto abaixo em cinza.

Aviso amarelo genérico (dieta faltando, sem dado suficiente pra simular etc.):
`rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400`.

### Páginas de sistema (login / 404 / erro)
`src/app/login/page.tsx`, `src/app/not-found.tsx`, `src/app/error.tsx`,
`src/app/global-error.tsx` — todas seguem o mesmo esqueleto: tela cheia centralizada,
card branco `max-w-sm rounded-lg border p-8 shadow-sm text-center`, título
`text-xl font-semibold`, corpo `text-sm text-zinc-500`, botão preto padrão.

## Inventário de componentes compartilhados (`src/components/`)
- `StatCard.tsx` — card de estatística (label/valor/sublabel).
- `StatusBadge.tsx` — pílula ok/atenção/crítico.
- `AlertList.tsx` — lista de alertas do dashboard.
- `ScrollHint.tsx` — aviso de scroll horizontal em tabelas no mobile.
- `WeightChart.tsx` — gráfico de peso (Recharts) na ficha do animal.

A maioria das telas, porém, **não** usa componente compartilhado — repete as mesmas
classes Tailwind inline em cada arquivo (cards, tabelas, formulários). Isso é
propositalmente simples hoje, mas é exatamente o tipo de coisa que um design system
bem aplicado deveria consolidar em componentes reais.

## Inventário de telas (pra ferramenta de design saber a superfície toda)
`/login` · `/` (seleção de fazenda) · `/[fazenda]/dashboard` · `/[fazenda]/animais`
(+ `/[id]` ficha) · `/[fazenda]/pesagens` · `/[fazenda]/currais` ·
`/[fazenda]/guia-trato` (+ `/confirmacao`) · `/[fazenda]/insumos` ·
`/[fazenda]/vendas` (+ `/[id]` recibo) · `/[fazenda]/simulacao`.

## O que eu preciso que a ferramenta de design devolva

Pra eu conseguir aplicar o resultado de forma efetiva no código real (não regravar a
mão cada tela, mas atualizar tokens + poucos componentes centrais), o ideal é receber:

1. **Tokens de cor** mapeados pros mesmos papéis semânticos já em uso — neutro
   (fundo/texto/borda em N níveis), ação primária, ok/atenção/crítico, resultado
   positivo/negativo — cada um com valor claro E escuro. Se a ferramenta quiser
   introduzir uma cor de marca/acento nova (hoje não existe nenhuma), deixar isso
   explícito, não implícito.
2. **Escala tipográfica** nomeada (tamanho/peso pra: título de página, título de
   seção, número de destaque, corpo, legenda) — decidir também a fonte (resolver o
   gap do Arial vs. Geist acima).
3. **Espaçamento/raio de borda** como sistema (hoje é ad hoc: `rounded`/`rounded-lg`/
   `rounded-xl` misturados sem regra) — uma convenção única por "nível" de elemento
   (card, input, botão, pílula).
4. **Especificação dos componentes que já existem** (a lista acima) — não é preciso
   inventar do zero; é redesenhar em cima do que já está funcionando.
5. Se possível, **mockup ou exemplo concreto de 2-3 telas reais** deste app (dashboard,
   uma tabela, um formulário) — muito mais fácil eu aplicar fielmente do que só
   receber tokens soltos.
6. Confirmação explícita se dark mode continua **só** via `prefers-color-scheme` ou
   se a ferramenta quer propor um toggle manual (mudaria a estrutura do layout raiz).
7. Confirmação se ícones entram no design ou se o app continua 100% textual.

Fora de escopo pra essa rodada: os PDFs gerados (folha de campo, recibo de venda,
folha do guia de trato) — esses seguem convenção de documento impresso, não da UI web.
