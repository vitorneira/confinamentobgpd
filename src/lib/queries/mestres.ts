// Master data do Orquestrador (fornecedor / prestador de serviço) — telas de
// cadastro próprias (src/app/(app)/fornecedores, /prestadores). Cliente de
// sessão (RLS normal): leitura por tenant, escrita restrita a dono/gestor
// (orq_pode_editar_master_data(), ver 0014_orquestrador_fundacao.sql).
import { createClient } from "@/lib/supabase/server";
import type { Dominio } from "@/lib/orquestrador/tipos";

export type Fornecedor = {
  id: string;
  nome: string;
  whatsapp: string | null;
  categorias: Dominio[];
  origem: string | null;
  criado_em: string;
};

export async function getFornecedoresCompletos(): Promise<Fornecedor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fornecedor")
    .select("id, nome, whatsapp, categorias, origem, criado_em")
    .order("nome");
  if (error) throw new Error(`Falha ao listar fornecedores: ${error.message}`);
  return data ?? [];
}

export type Prestador = {
  id: string;
  nome: string;
  telefone: string | null;
  chave_pagamento: string | null;
  observacao: string | null;
  ativo: boolean;
  criado_em: string;
};

export async function getPrestadoresCompletos(): Promise<Prestador[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("prestador_servico")
    .select("id, nome, telefone, chave_pagamento, observacao, ativo, criado_em")
    .order("nome");
  if (error) throw new Error(`Falha ao listar prestadores: ${error.message}`);
  return data ?? [];
}
