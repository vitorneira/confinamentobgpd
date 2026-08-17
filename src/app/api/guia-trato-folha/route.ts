import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurraisComDietaVigente, getGuiaTrato } from "@/lib/queries/guia-trato";
import { getDietasComComposicao } from "@/lib/queries/insumos";
import type { CurralAjuste } from "@/lib/guia-trato/balanceamento";
import { montarFolhaImpressao, type ComposicaoDieta } from "@/lib/guia-trato/vagao-planilha";
import { gerarFolhaGuiaTratoPDF } from "@/lib/guia-trato/pdf-folha";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const fazendaCodigo = params.get("fazenda");
  const data = params.get("data");

  if (!fazendaCodigo || !data) {
    return NextResponse.json({ erro: "fazenda e data são obrigatórios" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: fazenda } = await supabase
    .from("fazendas")
    .select("id, codigo, nome")
    .ilike("codigo", fazendaCodigo)
    .maybeSingle();
  if (!fazenda) return NextResponse.json({ erro: "fazenda não encontrada" }, { status: 404 });

  const guia = await getGuiaTrato(fazenda.id, data);
  if (!guia) return NextResponse.json({ erro: `Sem plano salvo para ${data}` }, { status: 404 });

  const curraisComDieta = await getCurraisComDietaVigente(fazenda.id, data);
  const dietaPorCurral = new Map(curraisComDieta.map((c) => [c.curralId, c]));

  const entrada: CurralAjuste[] = [];
  for (const [curralId, plano] of guia.porCurral) {
    const dieta = dietaPorCurral.get(curralId);
    if (!dieta?.dietaId) continue;
    entrada.push({
      curralId,
      curralCodigo: dieta.curralCodigo,
      dietaId: dieta.dietaId,
      dietaNome: dieta.dietaNome ?? "?",
      totalDiaKg: plano.totalDiaKg,
      ajustePct: plano.ajustePct,
      ajusteKg: plano.ajusteKg,
    });
  }

  const split = { manha: guia.splitManha, almoco: guia.splitAlmoco, tarde: guia.splitTarde };

  const dietaIds = [...new Set(entrada.map((c) => c.dietaId))];
  const dietas = await getDietasComComposicao(fazenda.id);
  const composicaoPorDieta = new Map<string, ComposicaoDieta[]>(
    dietas.filter((d) => dietaIds.includes(d.id)).map((d) => [d.id, d.composicao]),
  );

  const folha = montarFolhaImpressao(entrada, split, guia.capacidadeVagao, composicaoPorDieta, fazenda.nome, data);
  const pdf = await gerarFolhaGuiaTratoPDF(folha);

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="guia-trato-${fazenda.codigo}-${data}.pdf"`,
    },
  });
}
