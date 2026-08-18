import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnimaisIndicadores } from "@/lib/queries/animais";
import { gerarExcel } from "@/lib/excel";

function arredondar(v: number | null, casas: number): number | null {
  if (v === null) return null;
  const fator = 10 ** casas;
  return Math.round(v * fator) / fator;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fazendaCodigo = params.get("fazenda");
  if (!fazendaCodigo) return NextResponse.json({ erro: "fazenda é obrigatória" }, { status: 400 });

  const supabase = await createClient();
  const { data: fazenda } = await supabase
    .from("fazendas")
    .select("id, codigo")
    .ilike("codigo", fazendaCodigo)
    .maybeSingle();
  if (!fazenda) return NextResponse.json({ erro: "fazenda não encontrada" }, { status: 404 });

  const animais = await getAnimaisIndicadores(fazenda.id, {
    curralCodigo: params.get("curral") ?? undefined,
    categoriaNome: params.get("categoria") ?? undefined,
    busca: params.get("q") ?? undefined,
  });

  const rotuloAlerta = { ok: "Ok", atencao: "Atenção", critico: "Crítico" } as const;

  const linhas = animais.map((a) => ({
    Brinco: a.brinco,
    Curral: a.curralCodigo,
    Categoria: a.categoriaNome,
    "Peso atual (kg)": a.pesoAtualKg,
    "Dias confinado": a.diasConfinado,
    "GMD (kg/dia)": arredondar(a.gmdKgDia, 3),
    "@ viva": arredondar(a.arrobaViva, 2),
    "Dias desde última pesagem": a.diasDesdeUltimaPesagem,
    "Alerta de pesagem": rotuloAlerta[a.alertaPesagem],
    "Atingiu meta de GMD": a.atingiuMetaGmd === null ? "" : a.atingiuMetaGmd ? "Sim" : "Não",
  }));

  const excel = gerarExcel([{ nome: "Animais", linhas }]);

  return new NextResponse(new Uint8Array(excel), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="animais-${fazenda.codigo}.xlsx"`,
    },
  });
}
