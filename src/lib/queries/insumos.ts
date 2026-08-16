import { createClient } from "@/lib/supabase/server";

export type CompraListada = {
  id: string;
  data: string;
  ingredienteNome: string;
  precoKg: number;
  qtdKg: number | null;
  fornecedor: string | null;
};

export async function getCompras(fazendaId: string, limite = 20): Promise<CompraListada[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("compras_insumos")
    .select("id, data, preco_kg, qtd_kg, fornecedor, ingredientes(nome)")
    .eq("fazenda_id", fazendaId)
    .order("data", { ascending: false })
    .limit(limite);
  return (data ?? []).map((c) => ({
    id: c.id as string,
    data: c.data as string,
    ingredienteNome: (c.ingredientes as unknown as { nome: string } | null)?.nome ?? "?",
    precoKg: c.preco_kg as number,
    qtdKg: c.qtd_kg,
    fornecedor: c.fornecedor,
  }));
}

export type IngredienteEstoque = {
  id: string;
  nome: string;
  precoAtual: number | null;
  estoqueAtualKg: number | null;
  diasDeEstoque: number | null;
};

export async function getIngredientesComEstoque(fazendaId: string): Promise<IngredienteEstoque[]> {
  const supabase = await createClient();
  const { data: ingredientes } = await supabase
    .from("ingredientes")
    .select("id, nome")
    .eq("fazenda_id", fazendaId)
    .order("nome");

  const { data: precos } = await supabase
    .from("v_ingrediente_preco_atual")
    .select("ingrediente_id, preco_atual")
    .in("ingrediente_id", (ingredientes ?? []).map((i) => i.id));

  const { data: estoques } = await supabase
    .from("v_ingrediente_estoque_completo")
    .select("ingrediente_id, estoque_atual_kg, dias_de_estoque")
    .eq("fazenda_id", fazendaId);

  const precoPorId = new Map((precos ?? []).map((p) => [p.ingrediente_id as string, p.preco_atual as number]));
  const estoquePorId = new Map(
    (estoques ?? []).map((e) => [e.ingrediente_id as string, { atual: e.estoque_atual_kg, dias: e.dias_de_estoque }]),
  );

  return (ingredientes ?? []).map((i) => ({
    id: i.id as string,
    nome: i.nome as string,
    precoAtual: precoPorId.get(i.id as string) ?? null,
    estoqueAtualKg: estoquePorId.get(i.id as string)?.atual ?? null,
    diasDeEstoque: estoquePorId.get(i.id as string)?.dias ?? null,
  }));
}

export type DietaComComposicao = {
  id: string;
  nome: string;
  custoPorKg: number | null;
  composicao: Array<{ ingredienteId: string; ingredienteNome: string; proporcao: number }>;
};

export async function getDietasComComposicao(fazendaId: string): Promise<DietaComComposicao[]> {
  const supabase = await createClient();
  const { data: dietas } = await supabase.from("dietas").select("id, nome").eq("fazenda_id", fazendaId).order("nome");

  const { data: composicoes } = await supabase
    .from("dieta_ingredientes")
    .select("dieta_id, ingrediente_id, proporcao, ingredientes(nome)")
    .in("dieta_id", (dietas ?? []).map((d) => d.id));

  const { data: custos } = await supabase
    .from("v_dieta_custo_vitrine")
    .select("dieta_id, custo_por_kg")
    .in("dieta_id", (dietas ?? []).map((d) => d.id));
  const custoPorDieta = new Map((custos ?? []).map((c) => [c.dieta_id as string, c.custo_por_kg as number]));

  return (dietas ?? []).map((d) => ({
    id: d.id as string,
    nome: d.nome as string,
    custoPorKg: custoPorDieta.get(d.id as string) ?? null,
    composicao: (composicoes ?? [])
      .filter((c) => c.dieta_id === d.id)
      .map((c) => ({
        ingredienteId: c.ingrediente_id as string,
        ingredienteNome: (c.ingredientes as unknown as { nome: string } | null)?.nome ?? "?",
        proporcao: c.proporcao as number,
      })),
  }));
}

export type CurralComVigencias = {
  curralId: string;
  curralCodigo: string;
  dietaAtualNome: string | null;
  historico: Array<{ dietaNome: string; dataInicio: string }>;
};

export async function getCurraisComVigencias(fazendaId: string): Promise<CurralComVigencias[]> {
  const supabase = await createClient();
  const { data: currais } = await supabase.from("currais").select("id, codigo").eq("fazenda_id", fazendaId).order("codigo");
  const curralIds = (currais ?? []).map((c) => c.id);

  const { data: vigencias } = await supabase
    .from("dieta_vigencia")
    .select("curral_id, data_inicio, dietas(nome)")
    .in("curral_id", curralIds)
    .order("data_inicio", { ascending: false });

  return (currais ?? []).map((c) => {
    const historico = (vigencias ?? [])
      .filter((v) => v.curral_id === c.id)
      .map((v) => ({
        dietaNome: (v.dietas as unknown as { nome: string } | null)?.nome ?? "?",
        dataInicio: v.data_inicio as string,
      }));
    return {
      curralId: c.id as string,
      curralCodigo: c.codigo as string,
      dietaAtualNome: historico[0]?.dietaNome ?? null,
      historico,
    };
  });
}
