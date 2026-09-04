"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { erroAmigavel } from "@/lib/erros";

export type CampoPrestador = {
  nome: string;
  telefone?: string | null;
  chavePagamento?: string | null;
  observacao?: string | null;
  ativo?: boolean;
};

export async function criarPrestador(campos: CampoPrestador): Promise<{ ok: boolean; erro?: string }> {
  if (!campos.nome.trim()) return { ok: false, erro: "Informe o nome do prestador." };
  const supabase = await createClient();
  const { error } = await supabase.from("prestador_servico").insert({
    nome: campos.nome.trim(),
    telefone: campos.telefone || null,
    chave_pagamento: campos.chavePagamento || null,
    observacao: campos.observacao || null,
  });
  if (error) return { ok: false, erro: erroAmigavel(error) };
  revalidatePath("/prestadores");
  return { ok: true };
}

export async function editarPrestador(id: string, campos: CampoPrestador): Promise<{ ok: boolean; erro?: string }> {
  if (!campos.nome.trim()) return { ok: false, erro: "Informe o nome do prestador." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("prestador_servico")
    .update({
      nome: campos.nome.trim(),
      telefone: campos.telefone || null,
      chave_pagamento: campos.chavePagamento || null,
      observacao: campos.observacao || null,
      ...(campos.ativo !== undefined && { ativo: campos.ativo }),
    })
    .eq("id", id);
  if (error) return { ok: false, erro: erroAmigavel(error) };
  revalidatePath("/prestadores");
  return { ok: true };
}

export async function removerPrestador(id: string): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("prestador_servico").delete().eq("id", id);
  if (error) return { ok: false, erro: erroAmigavel(error) };
  revalidatePath("/prestadores");
  return { ok: true };
}
