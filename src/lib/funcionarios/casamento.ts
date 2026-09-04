// Casa o nome lido pela IA (extracao.ts) contra o cadastro de funcionário
// (nome_completo / apelido). Dois níveis: (1) nome completo exato (após
// normalizar acento/maiúscula/pontuação/palavra de ligação); (2) se nenhum
// bater exato, primeiro nome igual + pelo menos um outro nome em comum
// (pedido do dono, 2026-09-04 — com poucas pessoas cadastradas o risco de
// falso positivo é baixo; ex.: "Marcio F Assuncao" casa com "Marcio Felix
// Assunção" pelo "assuncao" em comum, mesmo sem "felix"/"f" baterem). Se
// mais de um funcionário bater em qualquer nível, ou nenhum bater, vai pra
// pendência em vez de arriscar gravar no funcionário errado (dado de
// salário) — abreviação forte demais (ex.: "Kleyjunior M", só uma inicial)
// ainda exige revisão manual.
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

function tokens(nome: string): string[] {
  return normalizar(nome).split(" ").filter(Boolean);
}

export function casarFuncionarioPorNome(nomeExtraido: string, funcionarios: FuncionarioParaCasamento[]): ResultadoCasamento {
  const alvo = normalizar(nomeExtraido);
  const exatos = funcionarios.filter((f) => normalizar(f.nome_completo) === alvo || (!!f.apelido && normalizar(f.apelido) === alvo));

  if (exatos.length === 1) return { status: "unico", funcionarioId: exatos[0].id };
  if (exatos.length > 1) return { status: "ambiguo" };

  const tokensAlvo = tokens(nomeExtraido);
  if (tokensAlvo.length < 2) return { status: "nenhum" };
  const [primeiroAlvo, ...restoAlvo] = tokensAlvo;

  const parciais = funcionarios.filter((f) => {
    const tokensCandidato = tokens(f.nome_completo);
    if (tokensCandidato.length < 2 || tokensCandidato[0] !== primeiroAlvo) return false;
    const restoCandidato = tokensCandidato.slice(1);
    return restoAlvo.some((t) => restoCandidato.includes(t));
  });

  if (parciais.length === 0) return { status: "nenhum" };
  if (parciais.length > 1) return { status: "ambiguo" };
  return { status: "unico", funcionarioId: parciais[0].id };
}
