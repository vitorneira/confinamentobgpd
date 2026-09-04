"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { erroAmigavel } from "@/lib/erros";
import type { Dominio } from "@/lib/orquestrador/tipos";

export type CampoFornecedor = {
  nome: string;
  whatsapp?: string | null;
  categorias?: Dominio[];
};

export async function criarFornecedor(campos: CampoFornecedor): Promise<{ ok: boolean; erro?: string }> {
  if (!campos.nome.trim()) return { ok: false, erro: "Informe o nome do fornecedor." };
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedor").insert({
    nome: campos.nome.trim(),
    whatsapp: campos.whatsapp || null,
    categorias: campos.categorias ?? [],
    origem: "manual",
  });
  if (error) return { ok: false, erro: erroAmigavel(error) };
  revalidatePath("/fornecedores");
  return { ok: true };
}

export async function editarFornecedor(id: string, campos: CampoFornecedor): Promise<{ ok: boolean; erro?: string }> {
  if (!campos.nome.trim()) return { ok: false, erro: "Informe o nome do fornecedor." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("fornecedor")
    .update({
      nome: campos.nome.trim(),
      whatsapp: campos.whatsapp || null,
      categorias: campos.categorias ?? [],
    })
    .eq("id", id);
  if (error) return { ok: false, erro: erroAmigavel(error) };
  revalidatePath("/fornecedores");
  return { ok: true };
}

export async function removerFornecedor(id: string): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedor").delete().eq("id", id);
  if (error) return { ok: false, erro: erroAmigavel(error) };
  revalidatePath("/fornecedores");
  return { ok: true };
}
