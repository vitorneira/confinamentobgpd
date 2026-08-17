import { createClient } from "@/lib/supabase/server";
import type { CurralIndicadores, IngredienteEstoque, Parametros } from "@/lib/kpi/types";

export async function getFazendaByCodigo(codigo: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fazendas")
    .select("id, codigo, nome")
    .ilike("codigo", codigo)
    .maybeSingle();
  return data;
}

export type Papel = "dono" | "gestor" | "leitura";

export async function getPapelUsuario(fazendaId: string): Promise<Papel | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("usuarios_fazendas")
    .select("papel")
    .eq("fazenda_id", fazendaId)
    .eq("usuario_id", user.id)
    .maybeSingle();
  return (data?.papel as Papel | undefined) ?? null;
}

export async function getParametros(fazendaId: string): Promise<Parametros | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("parametros")
    .select(
      "preco_arroba_referencia, pct_materia_seca, custo_fixo_dia, gmd_meta, peso_abate_alvo, data_referencia, alerta_pesagem_atencao_dias, alerta_pesagem_forte_dias, alerta_estoque_dias",
    )
    .eq("fazenda_id", fazendaId)
    .maybeSingle();
  return data;
}

export async function getCurraisIndicadores(fazendaId: string): Promise<CurralIndicadores[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_curral_indicadores_completo")
    .select("*")
    .eq("fazenda_id", fazendaId)
    .order("codigo");
  return data ?? [];
}

export async function getIngredienteEstoque(fazendaId: string): Promise<IngredienteEstoque[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_ingrediente_estoque_completo")
    .select("ingrediente_id, fazenda_id, nome, estoque_base_kg, estoque_base_data, estoque_atual_kg, dias_de_estoque")
    .eq("fazenda_id", fazendaId)
    .order("nome");
  return data ?? [];
}

export async function getDietaAtualPorCurral(
  fazendaId: string,
  dataReferencia: string,
): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data: currais } = await supabase.from("currais").select("id").eq("fazenda_id", fazendaId);
  const curralIds = (currais ?? []).map((c) => c.id as string);
  if (curralIds.length === 0) return new Map();

  const { data } = await supabase
    .from("dieta_vigencia")
    .select("curral_id, data_inicio, dietas(nome)")
    .in("curral_id", curralIds)
    .lte("data_inicio", dataReferencia)
    .order("data_inicio", { ascending: false });

  const mapa = new Map<string, string>();
  for (const row of data ?? []) {
    if (mapa.has(row.curral_id as string)) continue; // primeira ocorrência = vigência mais recente
    const nome = (row.dietas as unknown as { nome: string } | null)?.nome;
    if (nome) mapa.set(row.curral_id as string, nome);
  }
  return mapa;
}

export async function getCategoriasResumo(
  fazendaId: string,
): Promise<Array<{ nome: string; numCabecas: number }>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("animais")
    .select("categorias(nome)")
    .eq("fazenda_id", fazendaId)
    .eq("status", "ativo");

  const contagem = new Map<string, number>();
  for (const row of data ?? []) {
    const nome = (row.categorias as unknown as { nome: string } | null)?.nome ?? "(sem categoria)";
    contagem.set(nome, (contagem.get(nome) ?? 0) + 1);
  }
  return [...contagem.entries()]
    .map(([nome, numCabecas]) => ({ nome, numCabecas }))
    .sort((a, b) => b.numCabecas - a.numCabecas);
}
