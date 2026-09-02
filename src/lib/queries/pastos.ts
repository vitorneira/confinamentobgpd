import { createClient } from "@/lib/supabase/server";
import { compararCodigo } from "@/lib/format";

export type PastoEstoqueAtual = {
  pasto_id: string;
  pasto_nome: string;
  hectares: number | null;
  categoria: string;
  quantidade: number;
  data_evento: string;
};

export async function getEstoqueAtual(fazendaId: string): Promise<PastoEstoqueAtual[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_pasto_estoque_atual")
    .select("pasto_id, pasto_nome, hectares, categoria, quantidade, data_evento")
    .eq("fazenda_id", fazendaId);
  return [...(data ?? [])].sort((a, b) => compararCodigo(a.pasto_nome, b.pasto_nome));
}

export async function getPastosDaFazenda(fazendaId: string): Promise<{ id: string; nome: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pastos")
    .select("id, nome")
    .eq("fazenda_id", fazendaId)
    .eq("ativo", true);
  return [...(data ?? [])].sort((a, b) => compararCodigo(a.nome, b.nome));
}

export type PendenciaEstoquePasto = {
  id: string;
  fazenda_id: string | null;
  remetente: string | null;
  itens: { pasto: string; categoria: string; quantidade: number }[];
  data: string;
  criado_em: string;
};

/** Pendências de qualquer fazenda (não identificada ainda) + as desta fazenda. */
export async function getPendenciasEstoquePasto(fazendaId: string): Promise<PendenciaEstoquePasto[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pasto_estoque_pendente")
    .select("id, fazenda_id, remetente, itens, data, criado_em")
    .eq("confirmado", false)
    .or(`fazenda_id.is.null,fazenda_id.eq.${fazendaId}`)
    .order("criado_em", { ascending: true });
  return data ?? [];
}
