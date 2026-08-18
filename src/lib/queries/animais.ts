import { createClient } from "@/lib/supabase/server";
import { ordenarPorBrinco } from "@/lib/brinco-sort";
import { compararCodigo } from "@/lib/format";

export type AnimalListado = {
  animalId: string;
  brinco: string;
  curralCodigo: string;
  categoriaNome: string;
  pesoAtualKg: number | null;
  diasConfinado: number | null;
  gmdKgDia: number | null;
  arrobaViva: number | null;
  diasDesdeUltimaPesagem: number | null;
  alertaPesagem: "ok" | "atencao" | "critico";
  atingiuMetaGmd: boolean | null;
};

export async function getCurraisEcategorias(fazendaId: string) {
  const supabase = await createClient();
  const [{ data: currais }, { data: categorias }] = await Promise.all([
    supabase.from("currais").select("id, codigo").eq("fazenda_id", fazendaId),
    supabase.from("categorias").select("id, nome").eq("fazenda_id", fazendaId),
  ]);
  return {
    currais: [...(currais ?? [])].sort((a, b) => compararCodigo(a.codigo as string, b.codigo as string)),
    categorias: categorias ?? [],
  };
}

export async function getAnimaisIndicadores(
  fazendaId: string,
  filtros: { curralCodigo?: string; categoriaNome?: string; busca?: string },
): Promise<AnimalListado[]> {
  const supabase = await createClient();
  const { currais, categorias } = await getCurraisEcategorias(fazendaId);
  const curralNomeById = new Map(currais.map((c) => [c.id as string, c.codigo as string]));
  const categoriaNomeById = new Map(categorias.map((c) => [c.id as string, c.nome as string]));

  const { data } = await supabase
    .from("v_animal_indicadores")
    .select(
      "animal_id, brinco, curral_id, categoria_id, peso_atual_kg, dias_confinado, gmd_kg_dia, arroba_viva, dias_desde_ultima_pesagem, alerta_pesagem, atingiu_meta_gmd",
    )
    .eq("fazenda_id", fazendaId);

  let animais: AnimalListado[] = (data ?? []).map((a) => ({
    animalId: a.animal_id as string,
    brinco: a.brinco as string,
    curralCodigo: curralNomeById.get(a.curral_id as string) ?? "?",
    categoriaNome: categoriaNomeById.get(a.categoria_id as string) ?? "?",
    pesoAtualKg: a.peso_atual_kg,
    diasConfinado: a.dias_confinado,
    gmdKgDia: a.gmd_kg_dia,
    arrobaViva: a.arroba_viva,
    diasDesdeUltimaPesagem: a.dias_desde_ultima_pesagem,
    alertaPesagem: a.alerta_pesagem as "ok" | "atencao" | "critico",
    atingiuMetaGmd: a.atingiu_meta_gmd,
  }));

  if (filtros.curralCodigo) {
    animais = animais.filter((a) => a.curralCodigo === filtros.curralCodigo);
  }
  if (filtros.categoriaNome) {
    animais = animais.filter((a) => a.categoriaNome === filtros.categoriaNome);
  }
  if (filtros.busca) {
    const termo = filtros.busca.trim().toLowerCase();
    animais = animais.filter((a) => a.brinco.toLowerCase().includes(termo));
  }

  return ordenarPorBrinco(animais, (a) => a.brinco);
}

export type FichaAnimal = {
  animalId: string;
  brinco: string;
  curralCodigo: string;
  categoriaNome: string;
  loteOrigem: string | null;
  dataEntrada: string;
  pesoEntradaKg: number | null;
  dietaAtualNome: string | null;
  historicoPesagens: Array<{ data: string; pesoKg: number | null; obs: string | null }>;
};

export async function getFichaAnimal(fazendaId: string, animalId: string): Promise<FichaAnimal | null> {
  const supabase = await createClient();

  const { data: animal } = await supabase
    .from("animais")
    .select("id, brinco, lote_origem, data_entrada, peso_entrada_kg, curral_id, categoria_id")
    .eq("fazenda_id", fazendaId)
    .eq("id", animalId)
    .maybeSingle();
  if (!animal) return null;

  const [{ data: curral }, { data: categoria }, { data: pesagens }] = await Promise.all([
    supabase.from("currais").select("codigo").eq("id", animal.curral_id).single(),
    supabase.from("categorias").select("nome").eq("id", animal.categoria_id).single(),
    supabase
      .from("pesagens")
      .select("data, peso_kg, evento_obs")
      .eq("animal_id", animalId)
      .order("data"),
  ]);

  const { data: parametros } = await supabase
    .from("parametros")
    .select("data_referencia")
    .eq("fazenda_id", fazendaId)
    .maybeSingle();

  const { data: vigenciaAtual } = await supabase
    .from("dieta_vigencia")
    .select("dietas(nome), data_inicio")
    .eq("curral_id", animal.curral_id)
    .lte("data_inicio", parametros?.data_referencia ?? new Date().toISOString().slice(0, 10))
    .order("data_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    animalId: animal.id,
    brinco: animal.brinco,
    curralCodigo: curral?.codigo ?? "?",
    categoriaNome: categoria?.nome ?? "?",
    loteOrigem: animal.lote_origem,
    dataEntrada: animal.data_entrada,
    pesoEntradaKg: animal.peso_entrada_kg,
    dietaAtualNome: (vigenciaAtual?.dietas as unknown as { nome: string } | null)?.nome ?? null,
    historicoPesagens: (pesagens ?? []).map((p) => ({
      data: p.data,
      pesoKg: p.peso_kg,
      obs: p.evento_obs,
    })),
  };
}
