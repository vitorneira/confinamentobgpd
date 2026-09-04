// Extrai, de um PDF de holerite/recibo/comprovante (pode ter várias pessoas,
// uma ou mais páginas cada), quem aparece em cada trecho — pra depois casar
// pelo nome contra o cadastro (casamento.ts) e recortar as páginas
// (pdf.ts). Mesmo padrão de src/lib/pastos/extracao.ts (Sonnet 5, tool use,
// nunca inventar o que não está legível).
import Anthropic from "@anthropic-ai/sdk";

const MODELO = "claude-sonnet-5";

export type PessoaExtraida = {
  nomeNoDocumento: string;
  paginaInicio: number;
  paginaFim: number;
  /** YYYY-MM-01, se a competência estiver legível no documento; null se não. */
  competencia: string | null;
  /**
   * YYYY-MM-DD, se houver uma data de pagamento/transferência impressa (comum
   * em comprovante bancário, que normalmente não imprime "competência" — só a
   * data); null se não tiver. Usado como respaldo pra derivar a competência
   * (pagamento sai no mês seguinte ao trabalhado, ver casamento.ts/ingest_pendente.ts).
   */
  dataPagamento: string | null;
  /**
   * Área aproximada (0 a 1, origem no canto superior esquerdo) do recibo/
   * trecho desta pessoa DENTRO da página — só quando mais de uma pessoa
   * divide a mesma página (comum em recibo, várias vias por folha). Null
   * quando a pessoa ocupa a página inteira sozinha (holerite normalmente) ou
   * quando os dados dela cobrem mais de uma página.
   */
  caixaDelimitadora: { x0: number; y0: number; x1: number; y1: number } | null;
};

const TOOL_SCHEMA = {
  name: "extrair_documento_funcionario",
  description:
    "Extrai, de um PDF de holerite/recibo/comprovante de pagamento de funcionários/diaristas de uma fazenda, uma entrada por pessoa cujo pagamento aparece no documento.",
  input_schema: {
    type: "object" as const,
    properties: {
      pessoas: {
        type: "array" as const,
        description:
          "Uma entrada por funcionário/diarista identificado no documento. Um documento pode ter uma pessoa por página, várias pessoas na mesma página, ou uma pessoa em várias páginas seguidas.",
        items: {
          type: "object" as const,
          properties: {
            nome_no_documento: { type: "string" as const, description: "Nome exatamente como impresso no documento." },
            pagina_inicio: { type: "integer" as const, description: "Página (1-based) onde os dados desta pessoa começam." },
            pagina_fim: {
              type: "integer" as const,
              description: "Última página (1-based) com dados desta pessoa; igual a pagina_inicio se for só uma página.",
            },
            competencia: {
              type: ["string", "null"] as const,
              description:
                "Mês/ano de referência do pagamento (competência), formato YYYY-MM-01, se estiver impresso (comum em holerite); null se não conseguir ler ou o documento não tiver esse campo.",
            },
            data_pagamento: {
              type: ["string", "null"] as const,
              description:
                "Data em que o pagamento/transferência foi realizado, formato YYYY-MM-DD, se estiver impressa (comum em comprovante bancário, que normalmente não tem 'competência' — só a data da transação); null se não tiver.",
            },
            caixa_delimitadora: {
              type: ["object", "null"] as const,
              description:
                "APENAS quando mais de uma pessoa divide a mesma página (comum em recibo, várias vias impressas numa folha só): a área retangular aproximada do recibo/trecho desta pessoa dentro da página, em fração de 0 a 1 com origem no canto SUPERIOR ESQUERDO da página (x cresce pra direita, y cresce pra baixo). Deixe null se a pessoa ocupa a página inteira sozinha, ou se pagina_inicio for diferente de pagina_fim.",
              properties: {
                x0: { type: "number" as const, description: "Borda esquerda, 0 a 1." },
                y0: { type: "number" as const, description: "Borda superior, 0 a 1." },
                x1: { type: "number" as const, description: "Borda direita, 0 a 1." },
                y1: { type: "number" as const, description: "Borda inferior, 0 a 1." },
              },
              required: ["x0", "y0", "x1", "y1"],
            },
          },
          required: ["nome_no_documento", "pagina_inicio", "pagina_fim", "competencia", "data_pagamento", "caixa_delimitadora"],
        },
      },
    },
    required: ["pessoas"],
  },
};

export async function extrairDocumentoFuncionario(pdfBytes: Uint8Array, opts?: { apiKey?: string }): Promise<PessoaExtraida[]> {
  const apiKey = opts?.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada (.env.local).");
  const client = new Anthropic({ apiKey });

  const base64 = Buffer.from(pdfBytes).toString("base64");

  const resposta = await client.messages.create({
    model: MODELO,
    max_tokens: 4096,
    system:
      "Você lê PDFs de holerite/recibo/comprovante de pagamento de funcionários e diaristas de uma fazenda no Brasil. " +
      "Para cada pessoa cujo pagamento aparece no documento, identifique o nome exatamente como impresso, em que " +
      "página(s) (1-based) os dados dela aparecem, a competência (mês/ano de referência do pagamento, comum em " +
      "holerite) se estiver legível, e a data de pagamento/transferência (comum em comprovante bancário, que " +
      "normalmente não tem competência impressa — só a data) se estiver legível. Se mais de uma pessoa dividir a " +
      "mesma página (comum em recibo, com várias vias impressas numa folha só), também estime a área retangular " +
      "(caixa_delimitadora) de cada uma dentro da página, pra permitir recortar só o trecho dela; deixe null quando " +
      "a pessoa ocupa a página inteira sozinha. Nunca invente um nome, competência ou data que não estiver realmente " +
      "visível — se não conseguir ler, retorne null nesse campo. Responda sempre usando a ferramenta " +
      "extrair_documento_funcionario.",
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
          { type: "text", text: "Extraia as pessoas, páginas e competência deste documento." },
        ],
      },
    ],
    tools: [TOOL_SCHEMA],
    tool_choice: { type: "tool", name: "extrair_documento_funcionario" },
  });

  const bloco = resposta.content.find((b) => b.type === "tool_use");
  if (!bloco || bloco.type !== "tool_use") throw new Error("Claude não retornou extração estruturada.");

  const input = bloco.input as {
    pessoas: {
      nome_no_documento: string;
      pagina_inicio: number;
      pagina_fim: number;
      competencia: string | null;
      data_pagamento: string | null;
      caixa_delimitadora: { x0: number; y0: number; x1: number; y1: number } | null;
    }[];
  };
  return input.pessoas.map((p) => ({
    nomeNoDocumento: p.nome_no_documento,
    paginaInicio: p.pagina_inicio,
    paginaFim: p.pagina_fim,
    competencia: p.competencia,
    dataPagamento: p.data_pagamento,
    // Só faz sentido recortar por região dentro de uma única página.
    caixaDelimitadora: p.pagina_inicio === p.pagina_fim ? p.caixa_delimitadora : null,
  }));
}
