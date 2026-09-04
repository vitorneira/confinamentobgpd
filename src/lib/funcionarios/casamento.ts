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

// Palavras de ligação de nome próprio em português — sem identidade própria,
// mas cuja presença/ausência varia entre documentos (ex.: holerite imprime
// "José Henrique DE Souza", um comprovante bancário do mesmo pagamento
// mostrou só "Jose Henrique Souza"). Removidas dos dois lados antes de
// comparar; abreviação de nome do meio (ex.: "Marcio F" por "Marcio Felix")
// continua exigindo revisão manual — não é o mesmo tipo de variação.
const PALAVRAS_DE_LIGACAO = new Set(["de", "da", "do", "das", "dos"]);

function normalizar(nome: string): string {
  const semAcento = nome
    .normalize("NFD")
    .replace(MARCAS_DIACRITICAS, "")
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return semAcento
    .split(" ")
    .filter((palavra) => !PALAVRAS_DE_LIGACAO.has(palavra))
    .join(" ");
}

export function casarFuncionarioPorNome(nomeExtraido: string, funcionarios: FuncionarioParaCasamento[]): ResultadoCasamento {
  const alvo = normalizar(nomeExtraido);
  const candidatos = funcionarios.filter((f) => normalizar(f.nome_completo) === alvo || (!!f.apelido && normalizar(f.apelido) === alvo));

  if (candidatos.length === 0) return { status: "nenhum" };
  if (candidatos.length > 1) return { status: "ambiguo" };
  return { status: "unico", funcionarioId: candidatos[0].id };
}
