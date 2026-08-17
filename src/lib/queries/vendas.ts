import { createClient } from "@/lib/supabase/server";
import { ordenarPorBrinco } from "@/lib/brinco-sort";

export type CurralComAtivos = {
  curralId: string;
  curralCodigo: string;
  cabecasAtivas: number;
};

export async function getCurraisComAtivos(fazendaId: string): Promise<CurralComAtivos[]> {
  const supabase = await createClient();
  const [{ data: currais }, { data: animais }] = await Promise.all([
    supabase.from("currais").select("id, codigo").eq("fazenda_id", fazendaId).order("codigo"),
    supabase.from("animais").select("curral_id, tipo, quantidade").eq("fazenda_id", fazendaId).eq("status", "ativo"),
  ]);

  const cabecasPorCurral = new Map<string, number>();
  for (const a of animais ?? []) {
    const curralId = a.curral_id as string;
    const soma = a.tipo === "agregado" ? ((a.quantidade as number) ?? 0) : 1;
    cabecasPorCurral.set(curralId, (cabecasPorCurral.get(curralId) ?? 0) + soma);
  }

  return (currais ?? []).map((c) => ({
    curralId: c.id as string,
    curralCodigo: c.codigo as string,
    cabecasAtivas: cabecasPorCurral.get(c.id as string) ?? 0,
  }));
}

export type AnimalAtivoSelecao = {
  animalId: string;
  tipo: "individual" | "agregado";
  brinco: string | null;
  categoriaNome: string;
  quantidadeDisponivel: number | null;
  pesoEntradaKg: number;
  pesoAtualKg: number;
};

export async function getAnimaisAtivosDoCurral(fazendaId: string, curralId: string): Promise<AnimalAtivoSelecao[]> {
  const supabase = await createClient();
  const { data: animais } = await supabase
    .from("animais")
    .select("id, tipo, brinco, categoria_id, peso_entrada_kg, quantidade, peso_medio_entrada_kg, categorias(nome)")
    .eq("fazenda_id", fazendaId)
    .eq("curral_id", curralId)
    .eq("status", "ativo");

  const { data: indicadores } = await supabase
    .from("v_animal_indicadores")
    .select("animal_id, peso_atual_kg")
    .eq("fazenda_id", fazendaId)
    .eq("curral_id", curralId);
  const pesoAtualPorId = new Map((indicadores ?? []).map((i) => [i.animal_id as string, i.peso_atual_kg as number]));

  const resultado: AnimalAtivoSelecao[] = (animais ?? []).map((a) => ({
    animalId: a.id as string,
    tipo: a.tipo as "individual" | "agregado",
    brinco: a.brinco,
    categoriaNome: (a.categorias as unknown as { nome: string } | null)?.nome ?? "?",
    quantidadeDisponivel: a.tipo === "agregado" ? (a.quantidade as number) : null,
    pesoEntradaKg: (a.tipo === "agregado" ? a.peso_medio_entrada_kg : a.peso_entrada_kg) as number,
    pesoAtualKg: pesoAtualPorId.get(a.id as string) ?? ((a.tipo === "agregado" ? a.peso_medio_entrada_kg : a.peso_entrada_kg) as number),
  }));

  return ordenarPorBrinco(
    resultado.filter((a) => a.tipo === "individual"),
    (a) => a.brinco ?? "",
  ).concat(resultado.filter((a) => a.tipo === "agregado"));
}

export type VendaLoteEditavel = {
  vendaLoteId: string;
  curralId: string;
  tipoVenda: "abate" | "direta";
  comprador: string | null;
  frigorifico: string | null;
  nf: string | null;
  dataAbate: string | null;
  dataSaida: string;
  precoArroba: number | null;
  precoArrobaEntrada: number;
  pesoCarcacaTotal: number | null;
  frete: number;
  comissao: number;
  deducoes: number;
};

export async function getVendaLoteEditavel(fazendaId: string, vendaLoteId: string): Promise<VendaLoteEditavel | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("venda_lote")
    .select(
      "id, curral_id, tipo_venda, comprador, frigorifico, nf, data_abate, data_saida, preco_arroba, preco_arroba_entrada, peso_carcaca_total, frete, comissao, deducoes",
    )
    .eq("fazenda_id", fazendaId)
    .eq("id", vendaLoteId)
    .maybeSingle();
  if (!data) return null;

  return {
    vendaLoteId: data.id as string,
    curralId: data.curral_id as string,
    tipoVenda: data.tipo_venda as "abate" | "direta",
    comprador: data.comprador,
    frigorifico: data.frigorifico,
    nf: data.nf,
    dataAbate: data.data_abate,
    dataSaida: data.data_saida as string,
    precoArroba: data.preco_arroba,
    precoArrobaEntrada: data.preco_arroba_entrada as number,
    pesoCarcacaTotal: data.peso_carcaca_total,
    frete: data.frete as number,
    comissao: data.comissao as number,
    deducoes: data.deducoes as number,
  };
}

export type ItemVendaDetalhe = {
  vendaItemId: string;
  animalId: string;
  tipo: "individual" | "agregado";
  brinco: string | null;
  categoriaNome: string;
  quantidade: number | null;
  valorNegociado: number | null;
};

export async function getItensVenda(vendaLoteId: string): Promise<ItemVendaDetalhe[]> {
  const supabase = await createClient();
  const { data: itens } = await supabase
    .from("venda_item")
    .select("id, quantidade, valor_negociado, animais(id, tipo, brinco, categorias(nome))")
    .eq("venda_lote_id", vendaLoteId);

  return (itens ?? []).map((it) => {
    const animal = it.animais as unknown as {
      id: string;
      tipo: "individual" | "agregado";
      brinco: string | null;
      categorias: { nome: string } | null;
    } | null;
    return {
      vendaItemId: it.id as string,
      animalId: animal?.id ?? "",
      tipo: animal?.tipo ?? "individual",
      brinco: animal?.brinco ?? null,
      categoriaNome: animal?.categorias?.nome ?? "?",
      quantidade: it.quantidade,
      valorNegociado: it.valor_negociado,
    };
  });
}

export type VendaListada = {
  vendaLoteId: string;
  curralCodigo: string;
  tipoVenda: "abate" | "direta";
  dataSaida: string | null;
  frigorifico: string | null;
  comprador: string | null;
  cabecas: number;
  lucroLote: number | null;
  lucroPorCab: number | null;
};

export async function getVendasFechadas(fazendaId: string): Promise<VendaListada[]> {
  const supabase = await createClient();
  const { data: lotes } = await supabase
    .from("venda_lote")
    .select("id, curral_id, tipo_venda, data_saida, frigorifico, comprador, currais(codigo)")
    .eq("fazenda_id", fazendaId)
    .order("data_saida", { ascending: false });

  const ids = (lotes ?? []).map((l) => l.id as string);
  const { data: apuracao } = ids.length
    ? await supabase.from("v_venda_apuracao").select("venda_lote_id, cabecas, lucro_lote, lucro_por_cab").in("venda_lote_id", ids)
    : { data: [] as { venda_lote_id: string; cabecas: number; lucro_lote: number; lucro_por_cab: number }[] };
  const apuracaoPorId = new Map((apuracao ?? []).map((a) => [a.venda_lote_id as string, a]));

  return (lotes ?? []).map((l) => {
    const ap = apuracaoPorId.get(l.id as string);
    return {
      vendaLoteId: l.id as string,
      curralCodigo: (l.currais as unknown as { codigo: string } | null)?.codigo ?? "?",
      tipoVenda: l.tipo_venda as "abate" | "direta",
      dataSaida: l.data_saida,
      frigorifico: l.frigorifico,
      comprador: l.comprador,
      cabecas: ap?.cabecas ?? 0,
      lucroLote: ap?.lucro_lote ?? null,
      lucroPorCab: ap?.lucro_por_cab ?? null,
    };
  });
}

export type ApuracaoVenda = {
  vendaLoteId: string;
  curralCodigo: string;
  tipoVenda: "abate" | "direta";
  comprador: string | null;
  frigorifico: string | null;
  nf: string | null;
  dataAbate: string | null;
  dataSaida: string | null;
  cabecas: number;
  precoArroba: number | null;
  precoArrobaEntrada: number;
  pesoCarcacaTotal: number | null;
  frete: number;
  comissao: number;
  deducoes: number;
  pesoEntradaTotalKg: number;
  pesoSaidaTotalKg: number;
  pesoMedioEntradaKg: number;
  pesoMedioSaidaKg: number;
  ganhoTotalKg: number;
  diasConfinamentoMedio: number;
  gmdMedio: number | null;
  arrobasCarcaca: number | null;
  carcacaMediaPorCab: number | null;
  rendimentoCalculado: number | null;
  valorBruto: number | null;
  valorLiquido: number | null;
  custoEntrada: number;
  custoRacaoVendidos: number;
  custoFixoVendidos: number;
  custoTotal: number;
  custoTotalPorCab: number;
  lucroLote: number | null;
  lucroPorCab: number | null;
  margem: number | null;
  roi: number | null;
  custoArrobaSoRacao: number | null;
  custoArrobaTotal: number | null;
  porCategoria: { categoriaNome: string; quantidade: number }[];
  itensIndividuais: { brinco: string; valorNegociado: number | null }[];
};

export async function getApuracaoVenda(fazendaId: string, vendaLoteId: string): Promise<ApuracaoVenda | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_venda_apuracao")
    .select("*")
    .eq("fazenda_id", fazendaId)
    .eq("venda_lote_id", vendaLoteId)
    .maybeSingle();
  if (!data) return null;

  const [{ data: curral }, itens] = await Promise.all([
    supabase.from("currais").select("codigo").eq("id", data.curral_id).maybeSingle(),
    getItensVenda(vendaLoteId),
  ]);

  const porCategoriaMapa = new Map<string, number>();
  for (const it of itens) {
    const qtd = it.tipo === "agregado" ? (it.quantidade ?? 0) : 1;
    porCategoriaMapa.set(it.categoriaNome, (porCategoriaMapa.get(it.categoriaNome) ?? 0) + qtd);
  }

  return {
    vendaLoteId: data.venda_lote_id as string,
    curralCodigo: curral?.codigo ?? "?",
    tipoVenda: data.tipo_venda as "abate" | "direta",
    comprador: data.comprador,
    frigorifico: data.frigorifico,
    nf: data.nf,
    dataAbate: data.data_abate,
    dataSaida: data.data_saida,
    cabecas: data.cabecas,
    precoArroba: data.preco_arroba,
    precoArrobaEntrada: data.preco_arroba_entrada,
    pesoCarcacaTotal: data.peso_carcaca_total,
    frete: data.frete,
    comissao: data.comissao,
    deducoes: data.deducoes,
    pesoEntradaTotalKg: data.peso_entrada_total_kg,
    pesoSaidaTotalKg: data.peso_saida_total_kg,
    pesoMedioEntradaKg: data.peso_medio_entrada_kg,
    pesoMedioSaidaKg: data.peso_medio_saida_kg,
    ganhoTotalKg: data.ganho_total_kg,
    diasConfinamentoMedio: data.dias_confinamento_medio,
    gmdMedio: data.gmd_medio,
    arrobasCarcaca: data.arrobas_carcaca,
    carcacaMediaPorCab: data.carcaca_media_por_cab,
    rendimentoCalculado: data.rendimento_calculado,
    valorBruto: data.valor_bruto,
    valorLiquido: data.valor_liquido,
    custoEntrada: data.custo_entrada,
    custoRacaoVendidos: data.custo_racao_vendidos,
    custoFixoVendidos: data.custo_fixo_vendidos,
    custoTotal: data.custo_total,
    custoTotalPorCab: data.custo_total_por_cab,
    lucroLote: data.lucro_lote,
    lucroPorCab: data.lucro_por_cab,
    margem: data.margem,
    roi: data.roi,
    custoArrobaSoRacao: data.custo_arroba_so_racao,
    custoArrobaTotal: data.custo_arroba_total,
    porCategoria: [...porCategoriaMapa.entries()]
      .map(([categoriaNome, quantidade]) => ({ categoriaNome, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade),
    itensIndividuais: itens
      .filter((it) => it.tipo === "individual")
      .map((it) => ({ brinco: it.brinco ?? "?", valorNegociado: it.valorNegociado })),
  };
}
