"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { erroAmigavel } from "@/lib/erros";
import type { CampoFuncionario } from "../actions";

const BUCKET = "funcionario-documentos";

type LinhaFazenda = { codigo: string } | { codigo: string }[] | null;
function codigoDaFazenda(fazendas: LinhaFazenda): string {
  return (Array.isArray(fazendas) ? fazendas[0] : fazendas)?.codigo ?? "XX";
}

async function vincularArquivo(params: {
  pendenciaId: string;
  funcionarioId: string;
  competencia: string; // "AAAA-MM"
}): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();

  const { data: pendencia, error: erroPendencia } = await supabase
    .from("funcionario_documento_pendente")
    .select("id, tipo, storage_path_original, storage_path_individual")
    .eq("id", params.pendenciaId)
    .maybeSingle();
  if (erroPendencia || !pendencia) return { ok: false, erro: "Pendência não encontrada." };

  const { data: funcionario, error: erroFuncionario } = await supabase
    .from("funcionario")
    .select("id, fazendas(codigo)")
    .eq("id", params.funcionarioId)
    .maybeSingle();
  if (erroFuncionario || !funcionario) return { ok: false, erro: "Funcionário não encontrado." };
  const codigo = codigoDaFazenda((funcionario as unknown as { fazendas: LinhaFazenda }).fazendas);

  const competencia = `${params.competencia}-01`;
  const { data: existentes } = await supabase
    .from("funcionario_documento")
    .select("versao")
    .eq("funcionario_id", params.funcionarioId)
    .eq("tipo", pendencia.tipo)
    .eq("competencia", competencia)
    .order("versao", { ascending: false })
    .limit(1);
  const versao = (existentes?.[0]?.versao ?? 0) + 1;
  const caminhoFinal = `${codigo}/${params.funcionarioId}/${pendencia.tipo}_${params.competencia}_v${versao}.pdf`;

  const { error: erroMove } = await supabase.storage.from(BUCKET).move(pendencia.storage_path_individual, caminhoFinal);
  if (erroMove) return { ok: false, erro: erroAmigavel({ message: erroMove.message }) };

  const { error: erroInsert } = await supabase.from("funcionario_documento").insert({
    funcionario_id: params.funcionarioId,
    tipo: pendencia.tipo,
    competencia,
    storage_path_original: pendencia.storage_path_original,
    storage_path_individual: caminhoFinal,
    versao,
    origem: "telegram",
  });
  if (erroInsert) return { ok: false, erro: erroAmigavel(erroInsert) };

  await supabase.from("funcionario_documento_pendente").update({ resolvido: true }).eq("id", params.pendenciaId);

  revalidatePath("/funcionarios/pendencias");
  revalidatePath(`/funcionarios/${params.funcionarioId}`);
  return { ok: true };
}

export async function vincularPendencia(pendenciaId: string, funcionarioId: string, competencia: string): Promise<{ ok: boolean; erro?: string }> {
  if (!funcionarioId) return { ok: false, erro: "Selecione o funcionário." };
  if (!competencia) return { ok: false, erro: "Informe a competência (mês/ano)." };
  return vincularArquivo({ pendenciaId, funcionarioId, competencia });
}

export async function cadastrarEVincularPendencia(
  pendenciaId: string,
  camposFuncionario: CampoFuncionario,
  competencia: string,
): Promise<{ ok: boolean; erro?: string }> {
  if (!camposFuncionario.nomeCompleto.trim()) return { ok: false, erro: "Informe o nome completo do funcionário." };
  if (!camposFuncionario.fazendaId) return { ok: false, erro: "Selecione a fazenda." };
  if (!competencia) return { ok: false, erro: "Informe a competência (mês/ano)." };

  const supabase = await createClient();
  const { data: novo, error: erroCriar } = await supabase
    .from("funcionario")
    .insert({
      fazenda_id: camposFuncionario.fazendaId,
      nome_completo: camposFuncionario.nomeCompleto.trim(),
      apelido: camposFuncionario.apelido?.trim() || null,
      tipo: camposFuncionario.tipo,
      cargo: camposFuncionario.cargo?.trim() || null,
      data_admissao: camposFuncionario.dataAdmissao || null,
    })
    .select("id")
    .single();
  if (erroCriar || !novo) return { ok: false, erro: erroAmigavel(erroCriar) };

  const resultado = await vincularArquivo({ pendenciaId, funcionarioId: novo.id, competencia });
  if (resultado.ok) revalidatePath("/funcionarios");
  return resultado;
}

export async function descartarPendencia(pendenciaId: string): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("funcionario_documento_pendente").update({ resolvido: true }).eq("id", pendenciaId);
  if (error) return { ok: false, erro: erroAmigavel(error) };
  revalidatePath("/funcionarios/pendencias");
  return { ok: true };
}

export async function getUrlPendencia(caminho: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 600);
  if (error) return null;
  return data.signedUrl;
}
