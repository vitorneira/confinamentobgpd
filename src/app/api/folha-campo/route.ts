import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gerarFolhaCampoPDF } from "@/lib/pesagens/pdf-folha-campo";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fazendaCodigo = params.get("fazenda");
  const curralCodigo = params.get("curral");
  const modo = params.get("modo") === "agregado" ? "agregado" : "individual";
  const quantidade = Number(params.get("quantidade") ?? "0");

  if (!fazendaCodigo || !curralCodigo) {
    return NextResponse.json({ erro: "fazenda e curral são obrigatórios" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: fazenda } = await supabase
    .from("fazendas")
    .select("id, codigo")
    .ilike("codigo", fazendaCodigo)
    .maybeSingle();
  if (!fazenda) return NextResponse.json({ erro: "fazenda não encontrada" }, { status: 404 });

  const { data: curral } = await supabase
    .from("currais")
    .select("id, codigo")
    .eq("fazenda_id", fazenda.id)
    .eq("codigo", curralCodigo)
    .maybeSingle();
  if (!curral) return NextResponse.json({ erro: "curral não encontrado" }, { status: 404 });

  let brincos: string[] = [];
  if (modo === "individual") {
    const { data: animais } = await supabase
      .from("animais")
      .select("brinco")
      .eq("fazenda_id", fazenda.id)
      .eq("curral_id", curral.id)
      .eq("status", "ativo")
      .not("brinco", "is", null);
    brincos = (animais ?? []).map((a) => a.brinco as string);
  }

  try {
    const pdf = await gerarFolhaCampoPDF({
      fazenda: fazenda.codigo,
      curral: curral.codigo,
      modo,
      brincos,
      quantidade,
    });

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="folha-campo-${fazenda.codigo}-${curral.codigo}.pdf"`,
      },
    });
  } catch (err) {
    // DEBUG TEMPORÁRIO — remover depois de descobrir a causa do 500 na Vercel
    return NextResponse.json(
      {
        erro: "falha ao gerar PDF",
        mensagem: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      },
      { status: 500 },
    );
  }
}
