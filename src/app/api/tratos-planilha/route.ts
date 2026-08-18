import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getTratosParaExportacao } from "@/lib/queries/guia-trato";
import { gerarExcel } from "@/lib/excel";
import { formatData } from "@/lib/format";

export async function GET(request: NextRequest) {
  const fazendaCodigo = request.nextUrl.searchParams.get("fazenda");
  if (!fazendaCodigo) return NextResponse.json({ erro: "fazenda é obrigatória" }, { status: 400 });

  const supabase = await createClient();
  const { data: fazenda } = await supabase
    .from("fazendas")
    .select("id, codigo")
    .ilike("codigo", fazendaCodigo)
    .maybeSingle();
  if (!fazenda) return NextResponse.json({ erro: "fazenda não encontrada" }, { status: 404 });

  const tratos = await getTratosParaExportacao(fazenda.id);

  const linhas = tratos.map((t) => ({
    Data: formatData(t.data),
    Curral: t.curralCodigo,
    Dieta: t.dietaNome,
    "Trato manhã (kg)": t.tratoManhaKg,
    "Trato almoço (kg)": t.tratoAlmocoKg,
    "Trato tarde (kg)": t.tratoTardeKg,
    "Total do dia (kg)": t.totalDiaKg,
    "Preço da dieta congelado (R$/kg)": t.precoDietaCongelado,
    "Custo do dia (R$)": Math.round(t.custoDia * 100) / 100,
    Observação: t.obs,
  }));

  const excel = gerarExcel([{ nome: "Tratos", linhas }]);

  return new NextResponse(new Uint8Array(excel), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="tratos-${fazenda.codigo}.xlsx"`,
    },
  });
}
