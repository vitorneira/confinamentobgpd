import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurraisComDietaVigente, getGuiaTrato, getVagoesSalvos } from "@/lib/queries/guia-trato";
import { getDietasComComposicao } from "@/lib/queries/insumos";
import { calcularBalanceamento, totalAjustado, type CurralAjuste } from "@/lib/guia-trato/balanceamento";
import { agruparVagoes, gerarFolhaGuiaTratoPDF, type CurralImpressao, type DietaImpressao } from "@/lib/guia-trato/pdf-folha";

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
  const balanceamento = calcularBalanceamento(entrada, split, guia.capacidadeVagao);
  const vagoesSalvos = await getVagoesSalvos(guia.id);
  const vagoesSalvosPorChave = new Map(vagoesSalvos.map((v) => [`${v.dietaId}|${v.horario}`, v.cargas]));

  const dietaIds = [...new Set(entrada.map((c) => c.dietaId))];
  const dietas = await getDietasComComposicao(fazenda.id);
  const composicaoPorDieta = new Map(dietas.filter((d) => dietaIds.includes(d.id)).map((d) => [d.id, d.composicao]));

  const currais: CurralImpressao[] = entrada.map((c) => {
    const total = totalAjustado(c.totalDiaKg, c.ajustePct, c.ajusteKg);
    return {
      curralCodigo: c.curralCodigo,
      dietaNome: c.dietaNome,
      manha: total * split.manha,
      almoco: total * split.almoco,
      tarde: total * split.tarde,
    };
  });

  const dietasImpressao: DietaImpressao[] = balanceamento.porDieta.map((d) => ({
    dietaNome: d.dietaNome,
    composicao: (composicaoPorDieta.get(d.dietaId) ?? []).map((c) => ({
      ingredienteNome: c.ingredienteNome,
      proporcao: c.proporcao,
    })),
    horarios: d.horarios.map((h) => {
      const chave = `${d.dietaId}|${h.horario}`;
      const salvos = vagoesSalvosPorChave.get(chave);
      const cargas = salvos && salvos.length === h.numVagoes ? salvos : h.vagoesSugeridos;
      return { horario: h.horario, totalKg: h.totalKg, vagoes: agruparVagoes(cargas) };
    }),
  }));

  const pdf = await gerarFolhaGuiaTratoPDF({
    fazendaNome: fazenda.nome,
    data,
    currais,
    dietas: dietasImpressao,
  });

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="guia-trato-${fazenda.codigo}-${data}.pdf"`,
    },
  });
}
