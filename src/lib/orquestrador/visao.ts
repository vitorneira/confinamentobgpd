// Fase M3 (ajuste pós-live) — descreve o conteúdo de uma foto (lista de
// compras, estoque de animais por pasto) em texto corrido, pra alimentar o
// mesmo pipeline de classificação já usado pra texto/áudio (classificar.ts).
// Não tenta estruturar nada aqui — só transcreve fielmente o que está
// escrito/visível, como se fosse a própria mensagem da pessoa; a
// estruturação (domínio, intenção, itens) continua sendo trabalho do
// classificar(). Pesagem por foto/PDF é escopo futuro (precisa de conferência
// com a foto original ao lado, que ainda não existe) — não usar este módulo
// pra isso.
import Anthropic from "@anthropic-ai/sdk";

const MODELO = "claude-haiku-4-5-20251001";

export type MediaTypeImagem = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export type EntradaImagem = {
  bytes: Uint8Array;
  mediaType: MediaTypeImagem;
};

export type ResultadoDescricaoImagem = {
  texto: string;
};

export async function descreverImagem(
  entrada: EntradaImagem,
  opts?: { apiKey?: string },
): Promise<ResultadoDescricaoImagem> {
  const apiKey = opts?.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada (.env.local).");
  }
  const client = new Anthropic({ apiKey });

  const base64 = Buffer.from(entrada.bytes).toString("base64");

  const resposta = await client.messages.create({
    model: MODELO,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: entrada.mediaType, data: base64 },
          },
          {
            type: "text",
            text:
              "Transcreva fielmente o que está escrito ou visível nesta foto do back-office de uma fazenda de confinamento de gado (ex.: lista de compras escrita à mão, contagem de animais por pasto). Não interprete nem estruture — descreva/transcreva em texto corrido, como se fosse a própria mensagem da pessoa. Se não conseguir ler algo com certeza, diga isso explicitamente em vez de adivinhar.",
          },
        ],
      },
    ],
  });

  const bloco = resposta.content.find((b) => b.type === "text");
  if (!bloco || bloco.type !== "text") {
    throw new Error("Claude não retornou descrição em texto.");
  }
  return { texto: bloco.text.trim() };
}
