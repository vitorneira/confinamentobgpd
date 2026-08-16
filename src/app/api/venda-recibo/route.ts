import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getApuracaoVenda } from "@/lib/queries/vendas";
import { gerarReciboVendaPDF } from "@/lib/vendas/pdf-recibo";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fazendaCodigo = params.get("fazenda");
  const vendaLoteId = params.get("id");

  if (!fazendaCodigo || !vendaLoteId) {
    return NextResponse.json({ erro: "fazenda e id são obrigatórios" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: fazenda } = await supabase
    .from("fazendas")
    .select("id, codigo, nome")
    .ilike("codigo", fazendaCodigo)
    .maybeSingle();
  if (!fazenda) return NextResponse.json({ erro: "fazenda não encontrada" }, { status: 404 });

  const apuracao = await getApuracaoVenda(fazenda.id, vendaLoteId);
  if (!apuracao) return NextResponse.json({ erro: "venda não encontrada" }, { status: 404 });

  const pdf = await gerarReciboVendaPDF(apuracao, fazenda.nome);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="venda-${fazenda.codigo}-${apuracao.curralCodigo}-${apuracao.dataSaida}.pdf"`,
    },
  });
}
