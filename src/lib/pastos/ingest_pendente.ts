// Recebe uma foto (do webhook do Telegram, ver route.ts) marcada como
// estoque por pasto (legenda começando com "estoque") e grava a extração
// como pendente, aguardando conferência humana em /[fazenda]/pastos — nunca
// grava direto em pasto_estoque_evento (mesmo princípio de "humano no
// circuito" usado no resto do sistema).
import { supabaseServico } from "@/lib/orquestrador/supabase-servico";
import type { EntradaImagem } from "@/lib/orquestrador/visao";
import { extrairEstoquePasto } from "./extracao";

export async function processarFotoEstoquePasto(params: {
  mensagemId: string;
  imagem: EntradaImagem;
  remetente: string;
  fazendaCodigoDetectada: "BG" | "PD" | null;
}): Promise<{ ok: true } | { ok: false; erro: string }> {
  const existente = await supabaseServico
    .from("pasto_estoque_pendente")
    .select("id")
    .eq("mensagem_id", params.mensagemId)
    .maybeSingle();
  if (existente.data) return { ok: true }; // já processado — idempotência

  const extracao = await extrairEstoquePasto(params.imagem);
  if (extracao.itens.length === 0) {
    return { ok: false, erro: "Nenhum item extraído da foto." };
  }

  let fazendaId: string | null = null;
  if (params.fazendaCodigoDetectada) {
    const { data } = await supabaseServico
      .from("fazendas")
      .select("id")
      .ilike("codigo", params.fazendaCodigoDetectada)
      .maybeSingle();
    fazendaId = (data?.id as string | undefined) ?? null;
  }

  const { error } = await supabaseServico.from("pasto_estoque_pendente").insert({
    mensagem_id: params.mensagemId,
    fazenda_id: fazendaId,
    remetente: params.remetente,
    itens: extracao.itens,
    data: extracao.dataDetectada ?? new Date().toISOString().slice(0, 10),
  });
  if (error) return { ok: false, erro: error.message };
  return { ok: true };
}
