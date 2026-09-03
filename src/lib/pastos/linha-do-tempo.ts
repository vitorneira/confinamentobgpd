// Deriva "vazio há N dias" / "ocupado há N dias" por pasto a partir do
// histórico bruto de pasto_estoque_evento — nunca persistido, sempre
// recalculado (mesmo princípio de GMD/dias_confinado: evento é a fonte da
// verdade). Ver design em "Estoque por Pasto — visão de vazios e tempo":
//
// - Estado atual = soma das categorias do lançamento mais recente de cada
//   uma. Total 0 ⇒ vazio.
// - "Vazio/ocupado há N dias" = desde o PRIMEIRO lançamento da sequência
//   atual (não o último) — reforçar o mesmo estado não reinicia a contagem,
//   só uma mudança de sinal (zero ⇄ não-zero) reinicia.
// - Pasto sem histórico do sinal oposto: não dá pra saber quando o estado
//   realmente começou, então marca `inferido` (a UI usa isso pra rotular
//   "120+ dias" em vez de fingir precisão que o dado não tem).

export type EventoEstoquePasto = {
  categoria: string;
  quantidade: number;
  data: string; // YYYY-MM-DD
};

export type CategoriaQuantidade = { categoria: string; quantidade: number };

export type EstadoPasto = {
  vazio: boolean;
  totalAtual: number;
  categorias: CategoriaQuantidade[]; // só > 0, desc por quantidade
  ultimoLancamento: string;
  diasNoEstado: number;
  desde: string;
  inferido: boolean;
};

function paraDiaUTC(data: string): number {
  const [ano, mes, dia] = data.split("-").map(Number);
  return Date.UTC(ano, mes - 1, dia);
}

function diffDias(hoje: string, desde: string): number {
  return Math.round((paraDiaUTC(hoje) - paraDiaUTC(desde)) / 86_400_000);
}

/** `eventos` pode vir em qualquer ordem; sempre de um único pasto. */
export function calcularEstadoPasto(eventos: EventoEstoquePasto[], hoje: string): EstadoPasto | null {
  if (eventos.length === 0) return null;

  const ordenados = [...eventos].sort((a, b) => a.data.localeCompare(b.data));
  const porData = new Map<string, EventoEstoquePasto[]>();
  for (const e of ordenados) {
    const lista = porData.get(e.data);
    if (lista) lista.push(e);
    else porData.set(e.data, [e]);
  }
  const datas = [...porData.keys()].sort();

  const categoriaAtual = new Map<string, number>();
  const timeline: { data: string; total: number }[] = [];
  for (const data of datas) {
    for (const e of porData.get(data)!) categoriaAtual.set(e.categoria, e.quantidade);
    const total = [...categoriaAtual.values()].reduce((soma, q) => soma + q, 0);
    timeline.push({ data, total });
  }

  const atual = timeline[timeline.length - 1];
  const vazio = atual.total === 0;

  let idx = timeline.length - 1;
  while (idx > 0 && (timeline[idx - 1].total === 0) === vazio) idx--;
  const inferido = idx === 0;
  const desde = timeline[idx].data;

  const categorias = [...categoriaAtual.entries()]
    .filter(([, quantidade]) => quantidade > 0)
    .map(([categoria, quantidade]) => ({ categoria, quantidade }))
    .sort((a, b) => b.quantidade - a.quantidade);

  return {
    vazio,
    totalAtual: atual.total,
    categorias,
    ultimoLancamento: atual.data,
    diasNoEstado: diffDias(hoje, desde),
    desde,
    inferido,
  };
}

/** Evita alegar precisão que o dado não tem quando o estado é inferido e antigo. */
export function labelDiasEstado(estado: EstadoPasto): string {
  if (estado.inferido && estado.diasNoEstado >= 120) return "120+";
  return String(estado.diasNoEstado);
}

// Escala de dias vazio — mesma progressão do "dias desde a última pesagem"
// (CLAUDE.md), adaptada: vazio pouco tempo é descanso normal (neutro), a
// cor só escala quando o vazio começa a virar capim ocioso.
export const BANDAS_VAZIO = [
  { max: 15, chave: "calmo" as const, faixa: "0–15 dias", significado: "descanso normal" },
  { max: 30, chave: "atencao" as const, faixa: "16–30 dias", significado: "começa a pesar" },
  { max: 60, chave: "laranja" as const, faixa: "31–60 dias", significado: "capim ocioso" },
  { max: Infinity, chave: "critico" as const, faixa: "60+ dias", significado: "revisar manejo" },
];

export function bandaVazio(dias: number) {
  return BANDAS_VAZIO.find((b) => dias <= b.max)!;
}
