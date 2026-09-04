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
              description: "Mês/ano de referência do pagamento, formato YYYY-MM-01, se estiver impresso; null se não conseguir ler.",
            },
          },
          required: ["nome_no_documento", "pagina_inicio", "pagina_fim", "competencia"],
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
      "página(s) (1-based) os dados dela aparecem, e a competência (mês/ano de referência do pagamento) se estiver " +
      "legível. Nunca invente um nome ou uma competência que não estiver realmente visível — se não conseguir ler a " +
      "competência, retorne null nesse campo. Responda sempre usando a ferramenta extrair_documento_funcionario.",
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
    pessoas: { nome_no_documento: string; pagina_inicio: number; pagina_fim: number; competencia: string | null }[];
  };
  return input.pessoas.map((p) => ({
    nomeNoDocumento: p.nome_no_documento,
    paginaInicio: p.pagina_inicio,
    paginaFim: p.pagina_fim,
    competencia: p.competencia,
  }));
}
