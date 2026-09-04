"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { erroAmigavel } from "@/lib/erros";
import type { TipoDocumento, TipoFuncionario } from "@/lib/queries/funcionarios";

const BUCKET = "funcionario-documentos";

export type CampoFuncionario = {
  fazendaId: string;
  nomeCompleto: string;
  apelido?: string | null;
  tipo: TipoFuncionario;
  cargo?: string | null;
  dataAdmissao?: string | null;
  ativo?: boolean;
};

export async function criarFuncionario(campos: CampoFuncionario): Promise<{ ok: boolean; erro?: string }> {
  if (!campos.nomeCompleto.trim()) return { ok: false, erro: "Informe o nome completo do funcionário." };
  if (!campos.fazendaId) return { ok: false, erro: "Selecione a fazenda." };
  const supabase = await createClient();
  const { error } = await supabase.from("funcionario").insert({
    fazenda_id: campos.fazendaId,
    nome_completo: campos.nomeCompleto.trim(),
    apelido: campos.apelido?.trim() || null,
    tipo: campos.tipo,
    cargo: campos.cargo?.trim() || null,
    data_admissao: campos.dataAdmissao || null,
  });
  if (error) return { ok: false, erro: erroAmigavel(error) };
  revalidatePath("/funcionarios");
  return { ok: true };
}

export async function editarFuncionario(id: string, campos: CampoFuncionario): Promise<{ ok: boolean; erro?: string }> {
  if (!campos.nomeCompleto.trim()) return { ok: false, erro: "Informe o nome completo do funcionário." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("funcionario")
    .update({
      nome_completo: campos.nomeCompleto.trim(),
      apelido: campos.apelido?.trim() || null,
      tipo: campos.tipo,
      cargo: campos.cargo?.trim() || null,
      data_admissao: campos.dataAdmissao || null,
      ...(campos.ativo !== undefined && { ativo: campos.ativo }),
    })
    .eq("id", id);
  if (error) return { ok: false, erro: erroAmigavel(error) };
  revalidatePath("/funcionarios");
  revalidatePath(`/funcionarios/${id}`);
  return { ok: true };
}

export async function removerFuncionario(id: string): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("funcionario").delete().eq("id", id);
  if (error) return { ok: false, erro: erroAmigavel(error) };
  revalidatePath("/funcionarios");
  return { ok: true };
}

export async function enviarDocumento(formData: FormData): Promise<{ ok: boolean; erro?: string }> {
  const funcionarioId = String(formData.get("funcionarioId") ?? "");
  const tipo = String(formData.get("tipo") ?? "") as TipoDocumento;
  const competenciaMes = String(formData.get("competencia") ?? ""); // "AAAA-MM", do <input type="month">
  const arquivo = formData.get("arquivo");

  if (!funcionarioId || !tipo || !competenciaMes) {
    return { ok: false, erro: "Preencha o tipo e a competência do documento." };
  }
  if (!(arquivo instanceof File) || arquivo.size === 0) {
    return { ok: false, erro: "Escolha um arquivo (PDF, JPG ou PNG)." };
  }

  const supabase = await createClient();

  const { data: funcionario, error: erroFuncionario } = await supabase
    .from("funcionario")
    .select("id, fazendas(codigo)")
    .eq("id", funcionarioId)
    .maybeSingle();
  if (erroFuncionario || !funcionario) return { ok: false, erro: "Funcionário não encontrado." };
  const fazendaInfo = funcionario as unknown as { fazendas: { codigo: string } | { codigo: string }[] | null };
  const codigoFazenda = (Array.isArray(fazendaInfo.fazendas) ? fazendaInfo.fazendas[0] : fazendaInfo.fazendas)?.codigo ?? "XX";

  const competencia = `${competenciaMes}-01`;
  const { data: existentes } = await supabase
    .from("funcionario_documento")
    .select("versao")
    .eq("funcionario_id", funcionarioId)
    .eq("tipo", tipo)
    .eq("competencia", competencia)
    .order("versao", { ascending: false })
    .limit(1);
  const versao = (existentes?.[0]?.versao ?? 0) + 1;

  const extensao = arquivo.name.split(".").pop()?.toLowerCase() || "pdf";
  const caminho = `${codigoFazenda}/${funcionarioId}/${tipo}_${competenciaMes}_v${versao}.${extensao}`;

  const bytes = new Uint8Array(await arquivo.arrayBuffer());
  const { error: erroUpload } = await supabase.storage
    .from(BUCKET)
    .upload(caminho, bytes, { contentType: arquivo.type || "application/octet-stream" });
  if (erroUpload) return { ok: false, erro: erroAmigavel({ message: erroUpload.message }) };

  // Upload manual: não há lote pra separar, então original e individual são o mesmo arquivo.
  const { error: erroInsert } = await supabase.from("funcionario_documento").insert({
    funcionario_id: funcionarioId,
    tipo,
    competencia,
    storage_path_original: caminho,
    storage_path_individual: caminho,
    versao,
    origem: "manual",
  });
  if (erroInsert) return { ok: false, erro: erroAmigavel(erroInsert) };

  revalidatePath(`/funcionarios/${funcionarioId}`);
  return { ok: true };
}

export async function getUrlDocumento(caminho: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(caminho, 600);
  if (error) return null;
  return data.signedUrl;
}
