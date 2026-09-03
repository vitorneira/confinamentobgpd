import { createClient } from "@/lib/supabase/server";
import { compararCodigo } from "@/lib/format";

export type PastoCadastro = { id: string; nome: string; hectares: number | null };

export async function getPastosDaFazenda(fazendaId: string): Promise<PastoCadastro[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pastos")
    .select("id, nome, hectares")
    .eq("fazenda_id", fazendaId)
    .eq("ativo", true);
  return [...(data ?? [])].sort((a, b) => compararCodigo(a.nome, b.nome));
}

/**
 * Histórico bruto (não só o mais recente) — necessário pra derivar "vazio/
 * ocupado há N dias" via src/lib/pastos/linha-do-tempo.ts, que precisa saber
 * quando o estado atual COMEÇOU, não só qual é.
 */
export async function getHistoricoEstoque(fazendaId: string): Promise<{
  pasto_id: string;
  categoria: string;
  quantidade: number;
  data: string;
}[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pasto_estoque_evento")
    .select("pasto_id, categoria, quantidade, data")
    .eq("fazenda_id", fazendaId)
    .order("data", { ascending: true })
    .order("criado_em", { ascending: true });
  return data ?? [];
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
