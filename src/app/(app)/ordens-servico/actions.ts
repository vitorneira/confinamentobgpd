"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { erroAmigavel } from "@/lib/erros";
import { inferirTipoRegistro } from "@/lib/orquestrador/ingest";
import type { Dominio, Intencao } from "@/lib/orquestrador/tipos";
import type { ItemOs, OsStatus } from "@/lib/queries/ordens-servico";

function revalidarOrdensServico(osId?: string) {
  revalidatePath("/ordens-servico");
  revalidatePath("/ordens-servico/triagem");
  if (osId) revalidatePath(`/ordens-servico/${osId}`);
}

export type CampoOs = {
  fazendaId: string;
  dominio: Dominio;
  intencao: Intencao;
  descricao: string;
  itens: ItemOs[];
  solicitanteId?: string | null;
  responsavelId?: string | null;
  fornecedorId?: string | null;
  ativoDestinoId?: string | null;
  curralId?: string | null;
  valorEstimado?: number | null;
  prazoPedido?: string | null;
  autorizacaoDono?: boolean;
  comprarProduto?: boolean;
  contratarServico?: boolean;
};

async function criarOs(campos: CampoOs): Promise<{ ok: boolean; erro?: string; osId?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("os")
    .insert({
      fazenda_id: campos.fazendaId,
      dominio: campos.dominio,
      intencao: campos.intencao,
      descricao: campos.descricao,
      itens: campos.itens,
      solicitante_id: campos.solicitanteId ?? null,
      responsavel_id: campos.responsavelId ?? null,
      fornecedor_id: campos.fornecedorId ?? null,
      ativo_destino_id: campos.ativoDestinoId ?? null,
      curral_id: campos.curralId ?? null,
      valor_estimado: campos.valorEstimado ?? null,
      prazo_pedido: campos.prazoPedido ?? null,
      autorizacao_dono: campos.autorizacaoDono ?? false,
      comprar_produto: campos.comprarProduto ?? false,
      contratar_servico: campos.contratarServico ?? false,
      canal_origem: "painel",
    })
    .select("id")
    .single();

  if (error) return { ok: false, erro: erroAmigavel(error) };
  return { ok: true, osId: data.id };
}

/** Pra "Nova OS" (criação manual, sem mensagem de origem). */
export async function criarOsManual(campos: CampoOs) {
  const resultado = await criarOs(campos);
  if (resultado.ok) revalidarOrdensServico(resultado.osId);
  return resultado;
}

export type ConfirmarTriagemPayload = CampoOs & {
  mensagemId: string;
  /** Só faz sentido quando intencao === 'registrar_lancar'. */
  tipoRegistro?: "morte" | "movimentacao" | "documento" | "contrato" | null;
};

/** Tela de Triagem — cria a OS (ou registro_admin) de verdade e liga de volta na mensagem. */
export async function confirmarTriagem(
  payload: ConfirmarTriagemPayload,
): Promise<{ ok: boolean; erro?: string; osId?: string; registroAdminId?: string }> {
  const supabase = await createClient();

  if (payload.intencao === "registrar_lancar") {
    const tipo = payload.tipoRegistro ?? inferirTipoRegistro(payload.dominio, payload.descricao);
    if (!tipo) {
      return { ok: false, erro: "Escolha o tipo de registro (morte, movimentação, documento ou contrato)." };
    }
    const { data, error } = await supabase
      .from("registro_admin")
      .insert({
        fazenda_id: payload.fazendaId,
        tipo,
        dados: { texto_origem: payload.descricao, itens: payload.itens },
        origem: "painel",
      })
      .select("id")
      .single();
    if (error) return { ok: false, erro: erroAmigavel(error) };

    const { error: erroMsg } = await supabase
      .from("mensagem")
      .update({ registro_id: data.id })
      .eq("id", payload.mensagemId);
    if (erroMsg) return { ok: false, erro: erroAmigavel(erroMsg) };

    revalidarOrdensServico();
    return { ok: true, registroAdminId: data.id };
  }

  const resultado = await criarOs(payload);
  if (!resultado.ok) return resultado;

  const { error: erroMsg } = await supabase
    .from("mensagem")
    .update({ os_id: resultado.osId })
    .eq("id", payload.mensagemId);
  if (erroMsg) return { ok: false, erro: erroAmigavel(erroMsg) };

  revalidarOrdensServico(resultado.osId);
  return { ok: true, osId: resultado.osId };
}

export async function descartarTriagem(mensagemId: string): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("mensagem").update({ descartada: true }).eq("id", mensagemId);
  if (error) return { ok: false, erro: erroAmigavel(error) };
  revalidarOrdensServico();
  return { ok: true };
}

export async function editarOs(
  osId: string,
  campos: Partial<CampoOs>,
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("os")
    .update({
      ...(campos.descricao !== undefined && { descricao: campos.descricao }),
      ...(campos.itens !== undefined && { itens: campos.itens }),
      ...(campos.responsavelId !== undefined && { responsavel_id: campos.responsavelId }),
      ...(campos.fornecedorId !== undefined && { fornecedor_id: campos.fornecedorId }),
      ...(campos.ativoDestinoId !== undefined && { ativo_destino_id: campos.ativoDestinoId }),
      ...(campos.curralId !== undefined && { curral_id: campos.curralId }),
      ...(campos.valorEstimado !== undefined && { valor_estimado: campos.valorEstimado }),
      ...(campos.prazoPedido !== undefined && { prazo_pedido: campos.prazoPedido }),
      ...(campos.autorizacaoDono !== undefined && { autorizacao_dono: campos.autorizacaoDono }),
    })
    .eq("id", osId);
  if (error) return { ok: false, erro: erroAmigavel(error) };
  revalidarOrdensServico(osId);
  return { ok: true };
}

/** Ciclo de vida simples do MVP — qualquer status pra qualquer status, sem
 * máquina de estados travando (isso é P1). O histórico é gravado sozinho
 * pelo trigger os_status_historico_trigger. */
export async function mudarStatusOs(osId: string, novoStatus: OsStatus): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const concluido = novoStatus === "conferida" || novoStatus === "cancelada";
  const { error } = await supabase
    .from("os")
    .update({ status: novoStatus, concluido_em: concluido ? new Date().toISOString() : null })
    .eq("id", osId);
  if (error) return { ok: false, erro: erroAmigavel(error) };
  revalidarOrdensServico(osId);
  return { ok: true };
}
