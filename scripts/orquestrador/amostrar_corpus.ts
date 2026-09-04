// Fase M1 — prepara a amostra do corpus real (16.807 mensagens, ver
// dados_originais/orquestrador_corpus/) que vai virar o eval set do
// classificador. Lê os JSONs já extraídos em _bruto/ (gitignored, nunca
// comitar), troca remetente por papel, tenta redigir dado sensível (PIX,
// telefone, CPF, e-mail) e faz amostragem estratificada por categoria bruta +
// fazenda. Saída é só um CANDIDATO — ainda sem domínio/intenção da taxonomia
// do GROUNDING.md (isso é o próximo script, que usa a API do Claude).
//
// Uso: tsx scripts/orquestrador/amostrar_corpus.ts

import fs from "node:fs";
import path from "node:path";

const CORPUS_DIR = path.join(process.cwd(), "dados_originais", "orquestrador_corpus", "_bruto");
const OUT_PATH = path.join(process.cwd(), "scripts", "orquestrador", "_amostra_candidata.json");

const FAZENDAS = [
  { chave: "bg", fazenda: "BG" },
  { chave: "pd", fazenda: "PD" },
  { chave: "germano", fazenda: "ADMIN" }, // conversa com o financeiro, não é uma fazenda física
] as const;

// SPEC seção 2 (Personas e papéis) — confirmado com o dono (2026-09-01).
const REMETENTE_PARA_PAPEL: Record<string, string> = {
  "Vitor Miras Barra Grande": "orquestrador",
  "José Henrique Bg": "gerente_bg",
  "Divino PD": "gerente_pd",
  "CPD - GERMANO": "registrador",
};

// Categorias brutas (do dataset_intencoes.json, taxonomia diferente do
// GROUNDING.md) que carregam demanda — amostradas com peso maior. O resto
// (saudacao_social, vazio, outro) entra em menor proporção, só pra dar
// exemplo negativo de "não gera OS".
const PESO_CATEGORIA: Record<string, number> = {
  manutencao: 3,
  compra_insumo: 3,
  sanidade_animal: 3,
  logistica_transporte: 2,
  financeiro: 2,
  agenda_compromisso: 2,
  pessoal_rh: 3, // rara (28 no total) — pega quase todas as que existirem
  saudacao_social: 0.3,
  vazio: 0.15,
  outro: 0.5,
};

const ALVO_POR_FAZENDA = 50; // ~150 no total, dentro da faixa 80-120+ pedida pelo GROUNDING.md §5

// pessoal_rh é rara (~28 em 16.807) e, no corpus real, quase sempre fala de
// salário de um funcionário nomeado ("qual é o salário do Leonardo?") — nome
// inline dentro da frase, que a heurística de linha isolada (usada em
// financeiro) não pega. Risco alto, ganho baixo: exclui a categoria inteira
// da amostra. Cobertura do domínio rh_pessoal no eval fica com o exemplo já
// público do GROUNDING.md §2 ("Peguei folga hoje mas estou na escuta").
const CATEGORIAS_EXCLUIDAS = new Set(["pessoal_rh"]);

type MensagemBruta = {
  dt: string;
  date: string;
  time: string;
  sender: string;
  type: string;
  texto_final: string;
  categoria: string;
  is_demanda: boolean;
  itens_extraidos: string;
  file: string | null;
};

type MensagemCandidata = {
  origem: string; // 'BG' | 'PD' | 'ADMIN'
  dt: string;
  remetente_papel: string;
  tipo: string;
  texto: string;
  categoria_bruta: string;
  is_demanda_bruta: boolean;
  revisar_manual: boolean; // texto continha "pix"/"chave" — checar redação a mão
};

const RE_CPF = /\d{3}\.\d{3}\.\d{3}-\d{2}/g;
const RE_CNPJ = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;
const RE_EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
// telefone BR com DDD, sem DDD (formato local XXXXX-XXXX), ou sequência de
// dígito solta longa (8-11 dígitos) — prefere over-redact a vazar.
const RE_TELEFONE_COM_DDD = /\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/g;
const RE_TELEFONE_SEM_DDD = /\b\d{4,5}[-\s]\d{4}\b/g;
// 8-20 dígitos corridos: cobre telefone, CPF (11), CNPJ (14) usado cru como
// chave PIX etc. Roda ANTES dos regexes de telefone mais estreitos, pra
// consumir o bloco inteiro em vez de bater só num pedaço e deixar fragmento
// (caso real do corpus: CNPJ de 14 dígitos como chave pix).
const RE_DIGITOS_LONGOS = /\b\d{8,20}\b/g;
const RE_CHAVE_PIX = /(chave\s*pix|pix)\s*[:\-]?\s*(\S+)/gi;
// dado bancário (agência/conta/banco) — aparece fora da categoria "financeiro"
// também (caso real: uma mensagem de logistica_transporte com dados
// bancários completos de uma transportadora), por isso roda sempre, não só
// quando categoria === 'financeiro'.
const RE_DADO_BANCARIO = /\b(ag[êe]ncia|ag|cc|conta\s*corrente|conta)[\s/:.]*\d[\d.\-/]*\b/gi;
// heurística: linha isolada com 2+ palavras capitalizadas seguidas = provável
// nome de pessoa (favorecido de PIX, por ex.). Só aplicada em categoria
// "financeiro" (onde essa mensagem tende a aparecer) pra não redigir nome de
// lugar/curral em conversa normal (ex.: "Caminho do Lago", já público no
// GROUNDING.md).
const RE_LINHA_NOME_PROVAVEL = /^[A-ZÀ-Ú][a-zà-ú]+(?:\s+(?:d[aeo]s?|[A-ZÀ-Ú][a-zà-ú]+))+$/;
// placa brasileira (antiga ABC1234 ou Mercosul ABC1D23) — sinal forte de
// encaminhamento automático de oficina/concessionária (nome de terceiro +
// documento identificável), não é demanda real da fazenda. Descarta a
// mensagem inteira em vez de tentar redigir só a placa.
const RE_PLACA_VEICULO = /\b[A-Z]{3}[\s-]?\d[A-Z0-9]\d{2}\b/;

function redigir(textoOriginal: string, categoria: string): { texto: string; revisarManual: boolean } {
  const contemPixOuChave = /\bpix\b|\bchave\b/i.test(textoOriginal);

  let texto = textoOriginal
    .replace(RE_CPF, "[CPF]")
    .replace(RE_CNPJ, "[CNPJ]")
    .replace(RE_EMAIL, "[EMAIL]")
    .replace(RE_DIGITOS_LONGOS, "[NUMERO_REDIGIDO]") // bloco longo primeiro, inteiro
    .replace(RE_TELEFONE_COM_DDD, "[TELEFONE]")
    .replace(RE_TELEFONE_SEM_DDD, "[TELEFONE]")
    .replace(RE_DADO_BANCARIO, "[DADO_BANCARIO_REDIGIDO]")
    .replace(RE_CHAVE_PIX, (_m, prefixo) => `${prefixo} [CHAVE_PIX_REDIGIDA]`);

  // Detecta pelo FORMATO do conteúdo, não pela categoria bruta: registro de
  // pagamento (nome + CNPJ/e-mail + valor) aparece espalhado em várias
  // categorias no corpus real (a ferramenta original categorizava pelo item
  // comprado — "motor", "plantadeira" — não por ser um registro financeiro).
  // Regexes globais (flag "g") guardam posição entre chamadas de .test() —
  // por isso os testes de gatilho abaixo usam literais novos (sem "g"), nunca
  // as constantes RE_* compartilhadas de novo, senão o resultado depende de
  // quantas vezes a função já rodou antes (bug clássico de lastIndex).
  const modoForte =
    categoria === "financeiro" ||
    /sal[aá]rio|holerite|\bpix\b|cnpj|ag[êe]ncia|conta\s*corrente|r\$/i.test(texto) ||
    /\b\d{1,3}(\.\d{3})*,\d{2}\b/.test(texto) ||
    /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/.test(textoOriginal) ||
    /[\w.+-]+@[\w-]+\.[\w.-]+/.test(textoOriginal);

  if (modoForte) {
    texto = texto
      .split("\n")
      .map((linha) => (RE_LINHA_NOME_PROVAVEL.test(linha.trim()) ? "[NOME_REDIGIDO]" : linha))
      .join("\n");
    // formato de agência/conta/CNPJ em texto livre varia demais pra regex
    // específico dar conta (hífen, ponto, abreviação "Ag-"/"C.C-"...). Nesse
    // modo, a fidelidade numérica não importa pro propósito do eval — apaga
    // todo dígito remanescente em vez de arriscar deixar fragmento vazar.
    texto = texto.replace(/\d[\d.\-/]*/g, "[NUM]");
  }

  return { texto, revisarManual: contemPixOuChave };
}

function amostrarFazenda(mensagens: MensagemBruta[], origem: string): MensagemCandidata[] {
  const porCategoria = new Map<string, MensagemBruta[]>();
  for (const m of mensagens) {
    if (!m.texto_final || m.type === "vazia") continue; // sem texto não dá pra classificar
    if (RE_PLACA_VEICULO.test(m.texto_final)) continue; // provável encaminhamento de oficina, descarta
    if (CATEGORIAS_EXCLUIDAS.has(m.categoria)) continue;
    const lista = porCategoria.get(m.categoria) ?? [];
    lista.push(m);
    porCategoria.set(m.categoria, lista);
  }

  const pesoTotal = [...porCategoria.keys()].reduce(
    (soma, cat) => soma + (PESO_CATEGORIA[cat] ?? 0.3),
    0,
  );

  const amostra: MensagemCandidata[] = [];
  for (const [categoria, lista] of porCategoria) {
    const peso = PESO_CATEGORIA[categoria] ?? 0.3;
    const qtd = Math.max(1, Math.round((peso / pesoTotal) * ALVO_POR_FAZENDA));
    const embaralhada = [...lista].sort(() => Math.random() - 0.5);
    for (const m of embaralhada.slice(0, qtd)) {
      const { texto, revisarManual } = redigir(m.texto_final, m.categoria);
      amostra.push({
        origem,
        dt: m.dt,
        remetente_papel: REMETENTE_PARA_PAPEL[m.sender] ?? "desconhecido",
        tipo: m.type,
        texto,
        categoria_bruta: m.categoria,
        is_demanda_bruta: m.is_demanda,
        revisar_manual: revisarManual,
      });
    }
  }
  return amostra;
}

function main() {
  const candidatos: MensagemCandidata[] = [];

  for (const { chave, fazenda } of FAZENDAS) {
    const arquivo = path.join(CORPUS_DIR, chave, "dataset_intencoes.json");
    if (!fs.existsSync(arquivo)) {
      console.error(`Faltando ${arquivo} — rode o unzip de analise_conversa_${chave}.zip em _bruto/${chave}/ primeiro.`);
      process.exit(1);
    }
    const mensagens: MensagemBruta[] = JSON.parse(fs.readFileSync(arquivo, "utf8"));
    const amostra = amostrarFazenda(mensagens, fazenda);
    candidatos.push(...amostra);
    console.log(`${fazenda}: ${amostra.length} mensagens amostradas de ${mensagens.length} totais`);
  }

  const semNomeReal = candidatos.filter((c) => c.remetente_papel === "desconhecido");
  if (semNomeReal.length > 0) {
    console.error(`ATENÇÃO: ${semNomeReal.length} mensagens com remetente não mapeado — não deveria acontecer.`);
  }

  const paraRevisar = candidatos.filter((c) => c.revisar_manual);
  console.log(`\nTotal amostrado: ${candidatos.length}`);
  console.log(`Marcadas pra revisão manual (continham "pix"/"chave"): ${paraRevisar.length}`);

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(candidatos, null, 2), "utf8");
  console.log(`\nEscrito em ${path.relative(process.cwd(), OUT_PATH)} (gitignored, ainda sem domínio/intenção).`);
}

main();
