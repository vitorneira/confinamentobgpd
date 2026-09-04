"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { erroAmigavel } from "@/lib/erros";

export type ItemConfirmacao = {
  pasto: string;
  pastoId: string | null;
  categoria: string;
  quantidade: number;
};

export async function confirmarPendenciaEstoquePasto(
  fazendaCodigo: string,
  fazendaId: string,
  pendenciaId: string,
  data: string,
  itens: ItemConfirmacao[],
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();

  // pastos novos (não casaram com nenhum cadastrado) — cadastra primeiro.
  const pastoIdPorNome = new Map<string, string>();
  const nomesNovos = [...new Set(itens.filter((i) => !i.pastoId).map((i) => i.pasto))];
  if (nomesNovos.length > 0) {
    const { data: inseridos, error } = await supabase
      .from("pastos")
      .insert(nomesNovos.map((nome) => ({ fazenda_id: fazendaId, nome })))
      .select("id, nome");
    if (error) return { ok: false, erro: `Erro cadastrando pasto novo: ${erroAmigavel(error)}` };
    for (const p of inseridos ?? []) pastoIdPorNome.set(p.nome as string, p.id as string);
  }

  const eventos = itens.map((item) => ({
    fazenda_id: fazendaId,
    pasto_id: item.pastoId ?? pastoIdPorNome.get(item.pasto),
    categoria: item.categoria,
    quantidade: item.quantidade,
    data,
    origem: "bot_foto" as const,
  }));

  if (eventos.some((e) => !e.pasto_id)) {
    return { ok: false, erro: "Falha ao resolver o pasto de uma ou mais linhas." };
  }

  const { error: erroEventos } = await supabase.from("pasto_estoque_evento").insert(eventos);
  if (erroEventos) return { ok: false, erro: `Erro gravando estoque: ${erroAmigavel(erroEventos)}` };

  const { error: erroPendencia } = await supabase
    .from("pasto_estoque_pendente")
    .update({ confirmado: true, fazenda_id: fazendaId })
    .eq("id", pendenciaId);
  if (erroPendencia) return { ok: false, erro: erroAmigavel(erroPendencia) };

  const base = `/${fazendaCodigo.toLowerCase()}`;
  revalidatePath(`${base}/pastos`);

  return { ok: true };
}

export async function descartarPendenciaEstoquePasto(pendenciaId: string): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("pasto_estoque_pendente").update({ confirmado: true }).eq("id", pendenciaId);
  if (error) return { ok: false, erro: erroAmigavel(error) };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function lancarEstoquePastoManual(
  fazendaCodigo: string,
  fazendaId: string,
  input: { pastoId: string; categoria: string; quantidade: number; data: string },
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();

  if (input.quantidade < 0) return { ok: false, erro: "Quantidade não pode ser negativa" };
  if (!input.categoria.trim()) return { ok: false, erro: "Categoria é obrigatória" };

  const { error } = await supabase.from("pasto_estoque_evento").insert({
    fazenda_id: fazendaId,
    pasto_id: input.pastoId,
    categoria: input.categoria.trim(),
    quantidade: input.quantidade,
    data: input.data,
    origem: "manual",
  });
  if (error) return { ok: false, erro: erroAmigavel(error) };

  const base = `/${fazendaCodigo.toLowerCase()}`;
  revalidatePath(`${base}/pastos`);

  return { ok: true };
}

export async function criarPasto(
  fazendaCodigo: string,
  fazendaId: string,
  input: { nome: string; hectares: number | null },
): Promise<{ ok: boolean; erro?: string; pastoId?: string }> {
  const supabase = await createClient();
  if (!input.nome.trim()) return { ok: false, erro: "Nome do pasto é obrigatório" };

  const { data, error } = await supabase
    .from("pastos")
    .insert({
      fazenda_id: fazendaId,
      nome: input.nome.trim(),
      hectares: input.hectares,
    })
    .select("id")
    .single();
  if (error) return { ok: false, erro: erroAmigavel(error) };

  const base = `/${fazendaCodigo.toLowerCase()}`;
  revalidatePath(`${base}/pastos`);

  return { ok: true, pastoId: data.id as string };
}
