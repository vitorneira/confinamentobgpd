import { createClient } from "@/lib/supabase/server";
import { ordenarPorBrinco } from "@/lib/brinco-sort";
import { compararCodigo } from "@/lib/format";

export type AnimalListado = {
  animalId: string;
  brinco: string;
  curralCodigo: string;
  categoriaNome: string;
  dataEntrada: string;
  pesoEntradaKg: number | null;
  pesoAtualKg: number | null;
  diasConfinado: number | null;
  gmdKgDia: number | null;
  arrobaViva: number | null;
  dataUltimaPesagem: string | null;
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
      "animal_id, brinco, curral_id, categoria_id, data_entrada, peso_entrada_kg, peso_atual_kg, dias_confinado, gmd_kg_dia, arroba_viva, data_ultima_pesagem, dias_desde_ultima_pesagem, alerta_pesagem, atingiu_meta_gmd",
    )
    .eq("fazenda_id", fazendaId);

  let animais: AnimalListado[] = (data ?? []).map((a) => ({
    animalId: a.animal_id as string,
    brinco: a.brinco as string,
    curralCodigo: curralNomeById.get(a.curral_id as string) ?? "?",
    categoriaNome: categoriaNomeById.get(a.categoria_id as string) ?? "?",
    dataEntrada: a.data_entrada,
    pesoEntradaKg: a.peso_entrada_kg,
    pesoAtualKg: a.peso_atual_kg,
    diasConfinado: a.dias_confinado,
    gmdKgDia: a.gmd_kg_dia,
    arrobaViva: a.arroba_viva,
    dataUltimaPesagem: a.data_ultima_pesagem,
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

export type IndicadoresAnimal = {
  pesoAtualKg: number | null;
  diasConfinado: number | null;
  gmdKgDia: number | null;
  arrobaViva: number | null;
  dataUltimaPesagem: string | null;
  diasDesdeUltimaPesagem: number | null;
  alertaPesagem: "ok" | "atencao" | "critico" | null;
  atingiuMetaGmd: boolean | null;
};

// Dado cadastral externo (base de registro genealógico / PO) — nunca indicador
// calculado. Ver supabase/migrations/0013_animais_dados_po.sql.
export type DadosPo = {
  conciliacaoStatus: string | null;
  conciliacaoObservacao: string | null;
  nomeCompleto: string | null;
  apelido: string | null;
  rgn: string | null;
  rgd: string | null;
  racaPo: string | null;
  gs: string | null;
  tipoReprodutivo: string | null;
  pai: string | null;
  rgnPai: string | null;
  rgdPai: string | null;
  mae: string | null;
  maeReceptora: string | null;
  avoPaterno: string | null;
  avoPaterna: string | null;
  avoMaterno: string | null;
  avoMaterna: string | null;
  dataNascimento: string | null;
  pesoNascimentoKg: number | null;
  pesoDesmameKg: number | null;
  dataDesmame: string | null;
  pesoPoUltimaKg: number | null;
  dataPesoPo: string | null;
  ceCm: number | null;
  statusPo: string | null;
  fazendaPo: string | null;
  localPo: string | null;
  loteReprodutivo: string | null;
  fornecedor: string | null;
  dataAquisicao: string | null;
};

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
  indicadores: IndicadoresAnimal | null;
  precoArrobaReferencia: number | null;
  dadosPo: DadosPo | null;
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

  const [{ data: curral }, { data: categoria }, { data: pesagens }, { data: indicadores }, { data: dadosPo }] =
    await Promise.all([
      supabase.from("currais").select("codigo").eq("id", animal.curral_id).single(),
      supabase.from("categorias").select("nome").eq("id", animal.categoria_id).single(),
      supabase
        .from("pesagens")
        .select("data, peso_kg, evento_obs")
        .eq("animal_id", animalId)
        .order("data"),
      supabase
        .from("v_animal_indicadores")
        .select(
          "peso_atual_kg, dias_confinado, gmd_kg_dia, arroba_viva, data_ultima_pesagem, dias_desde_ultima_pesagem, alerta_pesagem, atingiu_meta_gmd",
        )
        .eq("animal_id", animalId)
        .maybeSingle(),
      supabase.from("animais_dados_po").select("*").eq("animal_id", animalId).maybeSingle(),
    ]);

  const { data: parametros } = await supabase
    .from("parametros")
    .select("data_referencia, preco_arroba_referencia")
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
    indicadores: indicadores
      ? {
          pesoAtualKg: indicadores.peso_atual_kg,
          diasConfinado: indicadores.dias_confinado,
          gmdKgDia: indicadores.gmd_kg_dia,
          arrobaViva: indicadores.arroba_viva,
          dataUltimaPesagem: indicadores.data_ultima_pesagem,
          diasDesdeUltimaPesagem: indicadores.dias_desde_ultima_pesagem,
          alertaPesagem: indicadores.alerta_pesagem as "ok" | "atencao" | "critico" | null,
          atingiuMetaGmd: indicadores.atingiu_meta_gmd,
        }
      : null,
    precoArrobaReferencia: parametros?.preco_arroba_referencia ?? null,
    dadosPo: dadosPo
      ? {
          conciliacaoStatus: dadosPo.conciliacao_status,
          conciliacaoObservacao: dadosPo.conciliacao_observacao,
          nomeCompleto: dadosPo.nome_completo,
          apelido: dadosPo.apelido,
          rgn: dadosPo.rgn,
          rgd: dadosPo.rgd,
          racaPo: dadosPo.raca_po,
          gs: dadosPo.gs,
          tipoReprodutivo: dadosPo.tipo_reprodutivo,
          pai: dadosPo.pai,
          rgnPai: dadosPo.rgn_pai,
          rgdPai: dadosPo.rgd_pai,
          mae: dadosPo.mae,
          maeReceptora: dadosPo.mae_receptora,
          avoPaterno: dadosPo.avo_paterno,
          avoPaterna: dadosPo.avo_paterna,
          avoMaterno: dadosPo.avo_materno,
          avoMaterna: dadosPo.avo_materna,
          dataNascimento: dadosPo.data_nascimento,
          pesoNascimentoKg: dadosPo.peso_nascimento_kg,
          pesoDesmameKg: dadosPo.peso_desmame_kg,
          dataDesmame: dadosPo.data_desmame,
          pesoPoUltimaKg: dadosPo.peso_po_ultima_kg,
          dataPesoPo: dadosPo.data_peso_po,
          ceCm: dadosPo.ce_cm,
          statusPo: dadosPo.status_po,
          fazendaPo: dadosPo.fazenda_po,
          localPo: dadosPo.local_po,
          loteReprodutivo: dadosPo.lote_reprodutivo,
          fornecedor: dadosPo.fornecedor,
          dataAquisicao: dadosPo.data_aquisicao,
        }
      : null,
  };
}
