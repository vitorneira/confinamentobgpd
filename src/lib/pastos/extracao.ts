// Extrai contagem de animais por pasto/categoria de uma foto (planilha
// impressa, print de tela, anotação de campo) — diferente de
// src/lib/orquestrador/visao.ts (que só descreve texto solto pra Triagem):
// aqui a saída já é estruturada (tool use), porque o destino é uma tabela
// própria (pasto_estoque_evento via pasto_estoque_pendente), não a Triagem
// do Orquestrador. Usa Sonnet 5, não Haiku — a planilha real tem números
// densos por pasto/categoria, vale a precisão extra (custo ainda é
// irrelevante por foto, ver estimativa de custo discutida com o dono).
import Anthropic from "@anthropic-ai/sdk";
import type { EntradaImagem } from "@/lib/orquestrador/visao";

const MODELO = "claude-sonnet-5";

/** Foto (image/*) ou PDF exportado/impresso da planilha — os dois formatos que chegam pelo Telegram. */
export type EntradaArquivoEstoque = EntradaImagem | { bytes: Uint8Array; mediaType: "application/pdf" };

export type ItemEstoquePasto = {
  pasto: string;
  categoria: string;
  quantidade: number;
};

export type ResultadoExtracaoEstoquePasto = {
  itens: ItemEstoquePasto[];
  /** Data no formato YYYY-MM-DD, se visível na foto; null se não tiver. */
  dataDetectada: string | null;
};

const TOOL_SCHEMA = {
  name: "extrair_estoque_pasto",
  description:
    "Extrai a contagem de animais por pasto e categoria a partir de uma foto de planilha/anotação de estoque por pasto de uma fazenda.",
  input_schema: {
    type: "object" as const,
    properties: {
      itens: {
        type: "array" as const,
        description: "Uma linha por (pasto, categoria) com contagem > 0 visível na foto. Não inclua linhas zeradas.",
        items: {
          type: "object" as const,
          properties: {
            pasto: { type: "string" as const, description: "Nome do pasto exatamente como está escrito/impresso." },
            categoria: { type: "string" as const, description: "Categoria do animal exatamente como está escrita/impressa (ex.: Touro, Vaca, Novilha, Bezerro)." },
            quantidade: { type: "integer" as const },
          },
          required: ["pasto", "categoria", "quantidade"],
        },
      },
      data_detectada: {
        type: ["string", "null"] as const,
        description: "Data da contagem, formato YYYY-MM-DD, se estiver visível na foto (cabeçalho, coluna 'Data' etc.); null se não conseguir identificar.",
      },
    },
    required: ["itens", "data_detectada"],
  },
};

export async function extrairEstoquePasto(
  entrada: EntradaArquivoEstoque,
  opts?: { apiKey?: string },
): Promise<ResultadoExtracaoEstoquePasto> {
  const apiKey = opts?.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada (.env.local).");
  }
  const client = new Anthropic({ apiKey });

  const base64 = Buffer.from(entrada.bytes).toString("base64");
  const blocoArquivo: Anthropic.ContentBlockParam =
    entrada.mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
      : { type: "image", source: { type: "base64", media_type: entrada.mediaType, data: base64 } };

  const resposta = await client.messages.create({
    model: MODELO,
    max_tokens: 4096,
    system:
      "Você lê fotos/PDFs de planilhas/anotações de estoque de gado por pasto de uma fazenda de confinamento/pecuária (Brasil, português). Extraia SOMENTE o que está realmente visível e legível — nunca invente ou estime um número que não conseguir ler com certeza. Responda sempre usando a ferramenta extrair_estoque_pasto.",
    messages: [
      {
        role: "user",
        content: [
          blocoArquivo,
          { type: "text", text: "Extraia a contagem de animais por pasto e categoria visível neste arquivo." },
        ],
      },
    ],
    tools: [TOOL_SCHEMA],
    tool_choice: { type: "tool", name: "extrair_estoque_pasto" },
  });

  const bloco = resposta.content.find((b) => b.type === "tool_use");
  if (!bloco || bloco.type !== "tool_use") {
    throw new Error("Claude não retornou extração estruturada.");
  }
  const input = bloco.input as { itens: ItemEstoquePasto[]; data_detectada: string | null };
  return { itens: input.itens, dataDetectada: input.data_detectada };
}
