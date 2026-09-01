// Fase M1 — classificação de mensagem em domínio × intenção (docs/orquestrador/
// GROUNDING.md §1). Puro do ponto de vista do resto do sistema: recebe texto já
// transcrito (se veio de áudio) e devolve a classificação estruturada, sem
// tocar em banco. CLAUDE.md stack: Haiku 4.5 pro caso comum.
import Anthropic from "@anthropic-ai/sdk";
import { DOMINIOS, INTENCOES, type ClassificacaoMensagem } from "./tipos";
import { EXEMPLOS_GROUNDING, GLOSSARIO_JARGAO } from "./grounding";

const MODELO = "claude-haiku-4-5-20251001";

// Abaixo disso, CLAUDE.md manda marcar pra revisão manual em vez de agir —
// quem chama classificar() decide o que fazer com confiança baixa, esse
// módulo só reporta o número.
export const LIMIAR_CONFIANCA_BAIXA = 0.6;

const TOOL_SCHEMA = {
  name: "classificar_mensagem",
  description: "Classifica uma mensagem de WhatsApp/Telegram do back-office da fazenda em domínio × intenção.",
  input_schema: {
    type: "object" as const,
    properties: {
      dominio: { type: "string" as const, enum: [...DOMINIOS] },
      intencao: { type: "string" as const, enum: [...INTENCOES] },
      itens: {
        type: "array" as const,
        description: "Itens extraídos, cru (sem tentar casar com catálogo). Vazio se a mensagem não pede item nenhum.",
        items: {
          type: "object" as const,
          properties: {
            qtd: { type: ["string", "null"] as const },
            item: { type: "string" as const },
          },
          required: ["qtd", "item"],
        },
      },
      gera_os: {
        type: "boolean" as const,
        description: "true SOMENTE se intencao === 'abrir_demanda'. Todas as outras intenções são false.",
      },
      confianca: { type: "number" as const, description: "0 a 1." },
    },
    required: ["dominio", "intencao", "itens", "gera_os", "confianca"],
  },
};

function montarSystemPrompt(): string {
  const glossario = GLOSSARIO_JARGAO.map((g) => `- ${g.termo} (${g.dominio})`).join("\n");
  const exemplos = EXEMPLOS_GROUNDING.map(
    (e) => `Mensagem: "${e.texto}"\nClassificação: ${JSON.stringify(e.classificacao)}`,
  ).join("\n\n");

  return `Você classifica mensagens reais de WhatsApp/Telegram do back-office de duas fazendas de confinamento de gado (Barra Grande/BG, Pau D'Arco/PD). As mensagens são de gerentes de campo, do orquestrador e do financeiro — em português coloquial, às vezes transcrição de áudio com erros.

DOMÍNIO (escolha um): ${DOMINIOS.join(", ")}
INTENÇÃO (escolha um): ${INTENCOES.join(", ")}

Regras de ouro:
- Só "abrir_demanda" gera OS (gera_os: true). Todas as outras intenções são gera_os: false.
- "relatar_manejo" é relato de rotina do curral (pesagem, consumo) — não é pedido de nada.
- "financeiro" é fora de escopo (execução de pagamento) — classifique como financeiro mesmo que a mensagem não peça nada.
- "registrar_lancar" é lançamento administrativo (morte, movimentação de gado, documento) — não gera OS, mas é uma ação de registro.
- Mensagem vazia, saudação, ou papo sem conteúdo operacional: dominio "outro", intencao "informacao", gera_os false, confiança baixa é aceitável.
- Extraia itens SEMPRE crus (texto como veio, sem tentar corrigir ortografia nem casar com catálogo).

Glossário de jargão (termos que erram fácil):
${glossario}

Exemplos rotulados do corpus real:
${exemplos}

Responda SEMPRE usando a ferramenta classificar_mensagem.`;
}

export async function classificar(
  texto: string,
  opts?: { apiKey?: string },
): Promise<ClassificacaoMensagem> {
  const apiKey = opts?.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY não configurada (.env.local).");
  }
  const client = new Anthropic({ apiKey });

  const resposta = await client.messages.create({
    model: MODELO,
    max_tokens: 1024,
    system: montarSystemPrompt(),
    messages: [{ role: "user", content: texto }],
    tools: [TOOL_SCHEMA],
    tool_choice: { type: "tool", name: "classificar_mensagem" },
  });

  const blocoFerramenta = resposta.content.find((b) => b.type === "tool_use");
  if (!blocoFerramenta || blocoFerramenta.type !== "tool_use") {
    throw new Error("Claude não retornou classificação estruturada.");
  }

  return blocoFerramenta.input as ClassificacaoMensagem;
}
