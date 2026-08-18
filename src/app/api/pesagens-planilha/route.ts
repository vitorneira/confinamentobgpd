import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPesagensParaExportacao } from "@/lib/queries/pesagens";
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

  const pesagens = await getPesagensParaExportacao(fazenda.id);

  const linhas = pesagens.map((p) => ({
    Data: formatData(p.data),
    Curral: p.curralCodigo,
    Tipo: p.tipo === "individual" ? "Individual" : "Agregado",
    "Brinco / Lote": p.identificacao,
    "Peso (kg)": p.pesoKg,
    Observação: p.obs,
  }));

  const excel = gerarExcel([{ nome: "Pesagens", linhas }]);

  return new NextResponse(new Uint8Array(excel), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="pesagens-${fazenda.codigo}.xlsx"`,
    },
  });
}
