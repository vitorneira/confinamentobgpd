// Fase M1 — orquestra transcrição (se áudio) + classificação + gravação.
// É a função que M2 (painel, criação manual) e M3 (webhook do Telegram) vão
// reusar depois; hoje só é chamada por script (scripts/orquestrador/ingest_manual.ts).
//
// Guardrails do CLAUDE.md aplicados aqui:
// - Idempotência: mesma mensagem.id nunca gera OS/registro duplicado (confere
//   antes de gravar; se já existe, devolve o que já tinha sido criado).
// - Confiança baixa (transcrição OU classificação) → grava a mensagem pra
//   auditoria, mas NÃO cria OS/registro sozinho. Fica pendente de revisão
//   manual (consultável depois via `mensagem` com os_id/registro_id nulos).
import { classificar, LIMIAR_CONFIANCA_BAIXA } from "./classificar";
import { transcrever, LIMIAR_CONFIANCA_TRANSCRICAO_BAIXA } from "./transcrever";
import { supabaseServico } from "./supabase-servico";
import type { ClassificacaoMensagem, Dominio } from "./tipos";

export type MensagemEntrada = {
  /** Id da mensagem no canal de origem — chave de idempotência (PK de `mensagem`). */
  id: string;
  canal: string; // 'telegram' | 'whatsapp' | 'painel' | 'manual'
  remetente?: string;
  tipo: "texto" | "audio" | "documento";
  conteudoBruto?: string; // obrigatório se tipo === 'texto'
  caminhoAudio?: string; // obrigatório se tipo === 'audio'
  /**
   * Fazenda de origem. NOT NULL em `os`/`registro_admin` — sem isso, uma
   * classificação abrir_demanda/registrar_lancar fica só em `mensagem`
   * (mesmo comportamento de confiança baixa: registra, não age).
   */
  fazendaId?: string;
};

export type ResultadoIngestao = {
  mensagemId: string;
  jaExistia: boolean;
  transcricao?: string;
  confiancaTranscricao?: number;
  classificacao?: ClassificacaoMensagem;
  osId?: string;
  registroAdminId?: string;
  motivoSemAcao?: string; // preenchido quando não criou OS/registro (confiança baixa, sem fazenda, etc.)
};

// Mapeamento dominio→registro_tipo é só pros dois domínios que casam limpo
// com o enum de registro_admin (morte|movimentacao|documento|contrato) — os
// demais domínios com intencao=registrar_lancar ficam só em `mensagem` por
// enquanto. Registro administrativo completo é a Fase P4 do BUILD_PLAN.
function inferirTipoRegistro(dominio: Dominio, texto: string): "morte" | "movimentacao" | "documento" | "contrato" | null {
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
    return {
      mensagemId: msg.id,
      jaExistia: true,
      osId: existente.data.os_id ?? undefined,
      registroAdminId: existente.data.registro_id ?? undefined,
    };
  }

  let texto = msg.conteudoBruto ?? "";
  let confiancaTranscricao: number | undefined;

  if (msg.tipo === "audio") {
    if (!msg.caminhoAudio) throw new Error("tipo 'audio' exige caminhoAudio.");
    const transcricao = await transcrever(msg.caminhoAudio);
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
    return { mensagemId: msg.id, jaExistia: false, confiancaTranscricao, motivoSemAcao: "sem texto pra classificar" };
  }

  const classificacao = await classificar(texto);

  const transcricaoConfiancaBaixa =
    msg.tipo === "audio" && (confiancaTranscricao ?? 1) < LIMIAR_CONFIANCA_TRANSCRICAO_BAIXA;
  const classificacaoConfiancaBaixa = classificacao.confianca < LIMIAR_CONFIANCA_BAIXA;
  const semFazenda = !msg.fazendaId;

  let motivoSemAcao: string | undefined;
  if (transcricaoConfiancaBaixa) motivoSemAcao = "confiança de transcrição baixa — revisão manual";
  else if (classificacaoConfiancaBaixa) motivoSemAcao = "confiança de classificação baixa — revisão manual";
  else if (semFazenda && (classificacao.gera_os || classificacao.intencao === "registrar_lancar")) {
    motivoSemAcao = "fazenda não identificada — não dá pra criar OS/registro sem ela";
  }

  let osId: string | undefined;
  let registroAdminId: string | undefined;

  if (!motivoSemAcao && classificacao.gera_os && msg.fazendaId) {
    const { data, error } = await supabaseServico
      .from("os")
      .insert({
        fazenda_id: msg.fazendaId,
        dominio: classificacao.dominio,
        intencao: classificacao.intencao,
        descricao: texto,
        itens: classificacao.itens,
        canal_origem: msg.canal,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Falha ao criar OS: ${error.message}`);
    osId = data.id;
  } else if (!motivoSemAcao && classificacao.intencao === "registrar_lancar" && msg.fazendaId) {
    const tipoRegistro = inferirTipoRegistro(classificacao.dominio, texto);
    if (tipoRegistro) {
      const { data, error } = await supabaseServico
        .from("registro_admin")
        .insert({
          fazenda_id: msg.fazendaId,
          tipo: tipoRegistro,
          dados: { texto_origem: texto },
          origem: msg.canal,
        })
        .select("id")
        .single();
      if (error) throw new Error(`Falha ao criar registro_admin: ${error.message}`);
      registroAdminId = data.id;
    } else {
      motivoSemAcao = `registrar_lancar em domínio '${classificacao.dominio}' ainda não mapeia a um tipo de registro (Fase P4)`;
    }
  }

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
    os_id: osId,
    registro_id: registroAdminId,
  });
  if (erroMensagem) throw new Error(`Falha ao gravar mensagem: ${erroMensagem.message}`);

  return {
    mensagemId: msg.id,
    jaExistia: false,
    transcricao: msg.tipo === "audio" ? texto : undefined,
    confiancaTranscricao,
    classificacao,
    osId,
    registroAdminId,
    motivoSemAcao,
  };
}
