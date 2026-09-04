// Cadastro de Funcionário + Documentos de Pagamento (Orquestrador — Etapa B).
// Distinto de fornecedor/prestador de serviço (src/lib/queries/mestres.ts):
// cadastro próprio, com fazenda_id e documentos anexos em Storage. Ver
// docs/orquestrador/BUILD_PLAN.md.
import { createClient } from "@/lib/supabase/server";

export type TipoFuncionario = "fixo" | "diarista";
export type TipoDocumento = "holerite" | "recibo" | "comprovante";

export type Funcionario = {
  id: string;
  fazenda_id: string;
  fazenda_codigo: string;
  fazenda_nome: string;
  nome_completo: string;
  apelido: string | null;
  tipo: TipoFuncionario;
  cargo: string | null;
  ativo: boolean;
  data_admissao: string | null;
  criado_em: string;
};

type LinhaFuncionario = {
  id: string;
  fazenda_id: string;
  nome_completo: string;
  apelido: string | null;
  tipo: TipoFuncionario;
  cargo: string | null;
  ativo: boolean;
  data_admissao: string | null;
  criado_em: string;
  fazendas: { codigo: string; nome: string } | { codigo: string; nome: string }[] | null;
};

function achatarFazenda(linha: LinhaFuncionario): Funcionario {
  const fazenda = Array.isArray(linha.fazendas) ? linha.fazendas[0] : linha.fazendas;
  return {
    id: linha.id,
    fazenda_id: linha.fazenda_id,
    fazenda_codigo: fazenda?.codigo ?? "—",
    fazenda_nome: fazenda?.nome ?? "—",
    nome_completo: linha.nome_completo,
    apelido: linha.apelido,
    tipo: linha.tipo,
    cargo: linha.cargo,
    ativo: linha.ativo,
    data_admissao: linha.data_admissao,
    criado_em: linha.criado_em,
  };
}

const SELECT_FUNCIONARIO =
  "id, fazenda_id, nome_completo, apelido, tipo, cargo, ativo, data_admissao, criado_em, fazendas(codigo, nome)";

export async function getFuncionariosCompletos(): Promise<Funcionario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funcionario")
    .select(SELECT_FUNCIONARIO)
    .order("nome_completo");
  if (error) throw new Error(`Falha ao listar funcionários: ${error.message}`);
  return (data ?? []).map((linha) => achatarFazenda(linha as unknown as LinhaFuncionario));
}

export async function getFuncionario(id: string): Promise<Funcionario | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funcionario")
    .select(SELECT_FUNCIONARIO)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Falha ao buscar funcionário: ${error.message}`);
  return data ? achatarFazenda(data as unknown as LinhaFuncionario) : null;
}

export type DocumentoFuncionario = {
  id: string;
  tipo: TipoDocumento;
  competencia: string;
  storage_path_original: string;
  storage_path_individual: string;
  versao: number;
  origem: string;
  enviado_em: string;
};

export async function getDocumentosFuncionario(funcionarioId: string): Promise<DocumentoFuncionario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funcionario_documento")
    .select("id, tipo, competencia, storage_path_original, storage_path_individual, versao, origem, enviado_em")
    .eq("funcionario_id", funcionarioId)
    .order("competencia", { ascending: false })
    .order("versao", { ascending: false });
  if (error) throw new Error(`Falha ao listar documentos: ${error.message}`);
  return data ?? [];
}

export type MotivoPendencia = "nome_nao_encontrado" | "nome_ambiguo" | "competencia_nao_lida";

export type PendenciaDocumento = {
  id: string;
  tipo: TipoDocumento;
  nome_extraido: string | null;
  competencia_extraida: string | null;
  fazenda_sugerida: "BG" | "PD" | null;
  storage_path_original: string;
  storage_path_individual: string;
  motivo: MotivoPendencia;
  criado_em: string;
};

// RLS de funcionario_documento_pendente é só-dono (orq_eh_dono) — um gestor
// chamando isso recebe lista vazia, não erro; a tela trata isso como "sem
// pendências" (não precisa checar papel de novo aqui).
export async function getPendenciasFuncionario(): Promise<PendenciaDocumento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funcionario_documento_pendente")
    .select("id, tipo, nome_extraido, competencia_extraida, fazenda_sugerida, storage_path_original, storage_path_individual, motivo, criado_em")
    .eq("resolvido", false)
    .order("criado_em", { ascending: true });
  if (error) throw new Error(`Falha ao listar pendências: ${error.message}`);
  return data ?? [];
}
