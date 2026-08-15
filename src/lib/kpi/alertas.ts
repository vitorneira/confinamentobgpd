import type { CurralIndicadores, IngredienteEstoque, Parametros } from "./types";

export type Alerta = {
  tipo: "pesagem" | "estoque" | "meta_gmd";
  severidade: "atencao" | "critico";
  mensagem: string;
  href?: string;
};

/** Deriva o painel de alertas dos indicadores já calculados. Pura — sem I/O. */
export function calcularAlertas(
  fazendaCodigo: string,
  currais: CurralIndicadores[],
  ingredientes: IngredienteEstoque[],
  parametros: Parametros,
): Alerta[] {
  const alertas: Alerta[] = [];

  for (const c of currais) {
    const dias = c.dias_desde_ultima_pesagem;
    if (dias === null) continue;
    if (dias >= parametros.alerta_pesagem_forte_dias) {
      alertas.push({
        tipo: "pesagem",
        severidade: "critico",
        mensagem: `Curral ${c.codigo}: ${dias} dias sem pesagem`,
        href: `/${fazendaCodigo}/animais?curral=${encodeURIComponent(c.codigo)}`,
      });
    } else if (dias >= parametros.alerta_pesagem_atencao_dias) {
      alertas.push({
        tipo: "pesagem",
        severidade: "atencao",
        mensagem: `Curral ${c.codigo}: ${dias} dias sem pesagem`,
        href: `/${fazendaCodigo}/animais?curral=${encodeURIComponent(c.codigo)}`,
      });
    }
  }

  for (const i of ingredientes) {
    if (i.dias_de_estoque === null) continue;
    if (i.dias_de_estoque < parametros.alerta_estoque_dias) {
      alertas.push({
        tipo: "estoque",
        severidade: i.dias_de_estoque < parametros.alerta_estoque_dias / 2 ? "critico" : "atencao",
        mensagem: `${i.nome}: ${i.dias_de_estoque.toFixed(1)} dias de estoque`,
      });
    }
  }

  for (const c of currais) {
    if (c.num_nao_vencidos > 0 && c.num_na_meta < c.num_nao_vencidos) {
      const faltando = c.num_nao_vencidos - c.num_na_meta;
      alertas.push({
        tipo: "meta_gmd",
        severidade: "atencao",
        mensagem: `Curral ${c.codigo}: ${faltando} de ${c.num_nao_vencidos} animais abaixo da meta de GMD`,
        href: `/${fazendaCodigo}/animais?curral=${encodeURIComponent(c.codigo)}`,
      });
    }
  }

  const ordem = { critico: 0, atencao: 1 } as const;
  return alertas.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);
}
