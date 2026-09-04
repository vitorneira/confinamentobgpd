// Casa o nome lido pela IA (extracao.ts) contra o cadastro de funcionário
// (nome_completo / apelido). Só casamento EXATO (após normalizar acento/
// maiúscula/espaço) conta como confiável — qualquer dúvida (nome não
// encontrado, ou batendo com mais de um funcionário) vai pra pendência em
// vez de arriscar gravar no funcionário errado (dado de salário).
export type FuncionarioParaCasamento = {
  id: string;
  nome_completo: string;
  apelido: string | null;
};

export type ResultadoCasamento =
  | { status: "unico"; funcionarioId: string }
  | { status: "nenhum" }
  | { status: "ambiguo" };

const MARCAS_DIACRITICAS = new RegExp("[\\u0300-\\u036f]", "g");

function normalizar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(MARCAS_DIACRITICAS, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function casarFuncionarioPorNome(nomeExtraido: string, funcionarios: FuncionarioParaCasamento[]): ResultadoCasamento {
  const alvo = normalizar(nomeExtraido);
  const candidatos = funcionarios.filter((f) => normalizar(f.nome_completo) === alvo || (!!f.apelido && normalizar(f.apelido) === alvo));

  if (candidatos.length === 0) return { status: "nenhum" };
  if (candidatos.length > 1) return { status: "ambiguo" };
  return { status: "unico", funcionarioId: candidatos[0].id };
}
