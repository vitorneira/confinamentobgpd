// Fase M1/M2 — orquestra transcrição (se áudio) + classificação + gravação da
// mensagem. É a função que M3 (webhook do Telegram) vai reusar depois; hoje é
// chamada por script (scripts/orquestrador/ingest_manual.ts) e, futuramente,
// pela Edge Function do bot.
//
// Mudança da Fase M2 em relação à M1: esta função NUNCA cria `os`/`registro_admin`
// sozinha, nem em confiança alta. "Humano no circuito" (CLAUDE.md) passa a
// valer pra toda mensagem classificada como abrir_demanda/registrar_lancar —
// ela fica pendente na tela de Triagem (src/app/ordens-servico/triagem), que é
// quem de fato confirma e cria a OS/registro (ver actions.ts,
// confirmarTriagem). Guardrail de idempotência continua: mesma mensagem.id
// nunca duplica a linha em `mensagem`.
import { classificar } from "./classificar";
import { transcrever, type EntradaAudio } from "./transcrever";
import { supabaseServico } from "./supabase-servico";
import type { ClassificacaoMensagem, Dominio } from "./tipos";

export type MensagemEntrada = {
  /** Id da mensagem no canal de origem — chave de idempotência (PK de `mensagem`). */
  id: string;
  canal: string; // 'telegram' | 'whatsapp' | 'painel' | 'manual'
  remetente?: string;
  tipo: "texto" | "audio" | "documento";
  conteudoBruto?: string; // obrigatório se tipo === 'texto'
  /** obrigatório se tipo === 'audio' — caminho local (scripts) ou bytes em memória (webhook). */
  audio?: EntradaAudio;
};

export type ResultadoIngestao = {
  mensagemId: string;
  jaExistia: boolean;
  transcricao?: string;
  confiancaTranscricao?: number;
  classificacao?: ClassificacaoMensagem;
  motivoSemClassificacao?: string; // ex.: sem texto pra classificar
};

// Mapeamento dominio→registro_tipo é só pros dois domínios que casam limpo
// com o enum de registro_admin (morte|movimentacao|documento|contrato) — os
// demais domínios com intencao=registrar_lancar ficam sem sugestão de tipo
// na Triagem (usuário escolhe na mão). Registro administrativo completo é a
// Fase P4 do BUILD_PLAN.
export function inferirTipoRegistro(
  dominio: Dominio,
  texto: string,
): "morte" | "movimentacao" | "documento" | "contrato" | null {
  if (dominio === "movimentacao_gado") {
    return /\bmorte|morr(eu|eram)\b/i.test(texto) ? "morte" : "movimentacao";
  }
  if (dominio === "documentos_contratos") {
    return /\bcontrato\b/i.test(texto) ? "contrato" : "documento";
  }
  return null;
}

export async function ingest(msg: MensagemEntrada): Promise<ResultadoIngestao> {
  const existente = await supabaseServico
    .from("mensagem")
    .select("id, os_id, registro_id")
    .eq("id", msg.id)
    .maybeSingle();

  if (existente.error) throw new Error(`Falha ao checar idempotência: ${existente.error.message}`);
  if (existente.data) {
    return { mensagemId: msg.id, jaExistia: true };
  }

  let texto = msg.conteudoBruto ?? "";
  let confiancaTranscricao: number | undefined;

  if (msg.tipo === "audio") {
    if (!msg.audio) throw new Error("tipo 'audio' exige audio (caminho ou bytes).");
    const transcricao = await transcrever(msg.audio);
    texto = transcricao.texto;
    confiancaTranscricao = transcricao.confianca;
  }

  if (!texto.trim()) {
    // sem texto (transcrição vazia, documento sem OCR ainda) — grava a
    // mensagem crua e para por aqui, nada pra classificar.
    const { error } = await supabaseServico.from("mensagem").insert({
      id: msg.id,
      canal: msg.canal,
      remetente: msg.remetente,
      tipo: msg.tipo,
      conteudo_bruto: msg.conteudoBruto,
      transcricao: msg.tipo === "audio" ? texto : null,
      confianca_transcricao: confiancaTranscricao,
    });
    if (error) throw new Error(`Falha ao gravar mensagem: ${error.message}`);
    return { mensagemId: msg.id, jaExistia: false, confiancaTranscricao, motivoSemClassificacao: "sem texto pra classificar" };
  }

  const classificacao = await classificar(texto);

  const { error: erroMensagem } = await supabaseServico.from("mensagem").insert({
    id: msg.id,
    canal: msg.canal,
    remetente: msg.remetente,
    tipo: msg.tipo,
    conteudo_bruto: msg.conteudoBruto,
    transcricao: msg.tipo === "audio" ? texto : null,
    confianca_transcricao: confiancaTranscricao,
    dominio: classificacao.dominio,
    intencao: classificacao.intencao,
    itens: classificacao.itens,
    confianca_classificacao: classificacao.confianca,
  });
  if (erroMensagem) throw new Error(`Falha ao gravar mensagem: ${erroMensagem.message}`);

  return {
    mensagemId: msg.id,
    jaExistia: false,
    transcricao: msg.tipo === "audio" ? texto : undefined,
    confiancaTranscricao,
    classificacao,
  };
}
