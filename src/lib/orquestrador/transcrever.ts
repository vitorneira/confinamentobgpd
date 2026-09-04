// Fase M1 — transcrição de áudio via Groq. CLAUDE.md/SPEC citam Whisper
// "medium", mas isso é nomenclatura do Whisper local/open-source — a API
// hospedada da Groq só tem whisper-large-v3 e whisper-large-v3-turbo. Uso o
// large-v3 (mais preciso; o turbo é mais barato/rápido mas com mais erro,
// e aqui precisão pesa mais que latência — não é um caso de uso em tempo
// real). Ajustável via env se o custo pesar na prática.
import fs from "node:fs";
import { GLOSSARIO_JARGAO } from "./grounding";

const MODELO = process.env.GROQ_WHISPER_MODEL || "whisper-large-v3";
const ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";

// Abaixo disso, CLAUDE.md manda marcar pra revisão manual em vez de agir —
// quem chama transcrever() decide o que fazer, esse módulo só reporta o número.
export const LIMIAR_CONFIANCA_TRANSCRICAO_BAIXA = 0.5;

export type ResultadoTranscricao = {
  texto: string;
  /** Heurística 0-1 derivada de avg_logprob/no_speech_prob por segmento (a API não dá uma confiança única). */
  confianca: number;
};

type SegmentoVerbose = {
  avg_logprob: number;
  no_speech_prob: number;
};

type RespostaVerboseJson = {
  text: string;
  segments?: SegmentoVerbose[];
};

function montarPromptGlossario(): string {
  // Campo "prompt" da API Whisper: vocabulário/contexto pra guiar a
  // transcrição, não uma instrução — mantém curto (a API ignora o excesso).
  return GLOSSARIO_JARGAO.map((g) => g.termo).join(", ");
}

function calcularConfianca(segments: SegmentoVerbose[] | undefined): number {
  if (!segments || segments.length === 0) return 1; // sem segmentos (áudio curto) — sem sinal de dúvida
  const porSegmento = segments.map((s) => {
    const confAvgLogprob = Math.max(0, Math.min(1, 1 + s.avg_logprob)); // avg_logprob tipicamente entre -1 e 0
    const confSilencio = 1 - s.no_speech_prob;
    return confAvgLogprob * confSilencio;
  });
  return porSegmento.reduce((soma, c) => soma + c, 0) / porSegmento.length;
}

export type EntradaAudio =
  | string // caminho de arquivo local (scripts/CLI)
  | { bytes: Uint8Array; nomeArquivo: string }; // em memória (webhook do Telegram — sem tocar disco)

export async function transcrever(
  entrada: EntradaAudio,
  opts?: { apiKey?: string },
): Promise<ResultadoTranscricao> {
  const apiKey = opts?.apiKey ?? process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY não configurada (.env.local).");
  }

  const { bytes, nomeArquivo } =
    typeof entrada === "string"
      ? { bytes: new Uint8Array(fs.readFileSync(entrada)), nomeArquivo: entrada.split(/[\\/]/).pop() ?? "audio.ogg" }
      : entrada;
  // BlobPart no lib.dom atual quer Uint8Array<ArrayBuffer> especificamente
  // (não ArrayBufferLike genérico) — bytes já é sempre um ArrayBuffer real
  // aqui (vem de fs.readFileSync ou de arrayBuffer()), só o tipo é largo.
  const arquivo = new Blob([bytes as Uint8Array<ArrayBuffer>]);

  const form = new FormData();
  form.append("file", arquivo, nomeArquivo);
  form.append("model", MODELO);
  form.append("language", "pt");
  form.append("prompt", montarPromptGlossario());
  form.append("response_format", "verbose_json");

  const resposta = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new Error(`Groq transcrição falhou (${resposta.status}): ${corpo}`);
  }

  const dados = (await resposta.json()) as RespostaVerboseJson;
  return {
    texto: dados.text.trim(),
    confianca: calcularConfianca(dados.segments),
  };
}
