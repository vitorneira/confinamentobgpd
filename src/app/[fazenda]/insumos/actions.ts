"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { erroAmigavel } from "@/lib/erros";

function ok(fazendaCodigo: string) {
  const base = `/${fazendaCodigo.toLowerCase()}`;
  revalidatePath(`${base}/insumos`);
  revalidatePath(`${base}/dashboard`);
  revalidatePath(`${base}/currais`);
  revalidatePath(`${base}/guia-trato`);
}

export async function registrarCompra(
  fazendaCodigo: string,
  fazendaId: string,
  input: { data: string; ingredienteId: string; precoKg: number; qtdKg: number | null; fornecedor: string | null },
): Promise<{ ok: boolean; erro?: string }> {
  if (input.precoKg <= 0) return { ok: false, erro: "Preço deve ser maior que zero" };
  if (input.qtdKg !== null && input.qtdKg < 0) return { ok: false, erro: "Quantidade não pode ser negativa" };

  const supabase = await createClient();
  const { error } = await supabase.from("compras_insumos").insert({
    fazenda_id: fazendaId,
    data: input.data,
    ingrediente_id: input.ingredienteId,
    preco_kg: input.precoKg,
    qtd_kg: input.qtdKg,
    fornecedor: input.fornecedor,
  });
  if (error) return { ok: false, erro: erroAmigavel(error) };

  ok(fazendaCodigo);
  return { ok: true };
}

export async function criarIngrediente(
  fazendaCodigo: string,
  fazendaId: string,
  nome: string,
): Promise<{ ok: boolean; erro?: string; id?: string }> {
  if (!nome.trim()) return { ok: false, erro: "Nome vazio" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ingredientes")
    .insert({ fazenda_id: fazendaId, nome: nome.trim() })
    .select("id")
    .single();
  if (error) return { ok: false, erro: erroAmigavel(error) };
  ok(fazendaCodigo);
  return { ok: true, id: data.id as string };
}

export async function salvarComposicaoDieta(
  fazendaCodigo: string,
  fazendaId: string,
  input: { dietaId: string | null; nome: string; composicao: Array<{ ingredienteId: string; proporcao: number }> },
): Promise<{ ok: boolean; erro?: string }> {
  const soma = input.composicao.reduce((acc, c) => acc + c.proporcao, 0);
  if (Math.abs(soma - 1) > 0.005) {
    return { ok: false, erro: `A soma das proporções tem que dar 100% (está em ${(soma * 100).toFixed(1)}%).` };
  }

  const supabase = await createClient();
  let dietaId = input.dietaId;

  if (!dietaId) {
    if (!input.nome.trim()) return { ok: false, erro: "Nome da dieta vazio" };
    const { data, error } = await supabase
      .from("dietas")
      .insert({ fazenda_id: fazendaId, nome: input.nome.trim() })
      .select("id")
      .single();
    if (error) return { ok: false, erro: erroAmigavel(error) };
    dietaId = data.id as string;
  }

  const { error: delErr } = await supabase.from("dieta_ingredientes").delete().eq("dieta_id", dietaId);
  if (delErr) return { ok: false, erro: erroAmigavel(delErr) };

  const { error: insErr } = await supabase.from("dieta_ingredientes").insert(
    input.composicao.map((c) => ({
      dieta_id: dietaId,
      ingrediente_id: c.ingredienteId,
      proporcao: c.proporcao,
    })),
  );
  if (insErr) return { ok: false, erro: erroAmigavel(insErr) };

  ok(fazendaCodigo);
  return { ok: true };
}

export async function definirVigencia(
  fazendaCodigo: string,
  input: { curralId: string; dietaId: string; dataInicio: string },
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("dieta_vigencia").insert({
    curral_id: input.curralId,
    dieta_id: input.dietaId,
    data_inicio: input.dataInicio,
  });
  if (error) return { ok: false, erro: erroAmigavel(error) };

  ok(fazendaCodigo);
  return { ok: true };
}
