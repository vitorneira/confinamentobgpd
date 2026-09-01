"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { erroAmigavel } from "@/lib/erros";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function ok(fazendaCodigo: string) {
  const base = `/${fazendaCodigo.toLowerCase()}`;
  revalidatePath(`${base}/vendas`);
  revalidatePath(`${base}/animais`);
  revalidatePath(`${base}/currais`);
  revalidatePath(`${base}/dashboard`);
}

function okVenda(fazendaCodigo: string, vendaLoteId: string) {
  ok(fazendaCodigo);
  const base = `/${fazendaCodigo.toLowerCase()}`;
  revalidatePath(`${base}/vendas/${vendaLoteId}`);
  revalidatePath(`${base}/vendas/${vendaLoteId}/editar`);
}

// Editar/excluir uma venda já fechada é restrito ao dono (pedido do dono:
// correção retroativa de registro financeiro fechado). A RLS de update/delete
// em venda_lote/venda_item já exige isso (0011_venda_edicao_dono.sql), mas
// adicionarItemVenda faz um INSERT em venda_item — a RLS de insert continua
// aberta a dono+gestor (não mexe no fluxo normal de fecharVenda) — por isso
// as 4 ações de edição abaixo checam o papel explicitamente aqui também.
async function exigirDono(supabase: SupabaseServerClient, fazendaId: string): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Sessão expirada. Faça login novamente.";

  const { data } = await supabase
    .from("usuarios_fazendas")
    .select("papel")
    .eq("fazenda_id", fazendaId)
    .eq("usuario_id", user.id)
    .maybeSingle();
  if (data?.papel !== "dono") return "Só o dono pode editar uma venda já fechada.";
  return null;
}

export type ItemSelecionado = {
  animalId: string;
  tipo: "individual" | "agregado";
  quantidadeVendida: number | null;
  valorNegociado: number | null;
};

export async function fecharVenda(
  fazendaCodigo: string,
  fazendaId: string,
  input: {
    curralId: string;
    tipoVenda: "abate" | "direta";
    comprador: string | null;
    frigorifico: string | null;
    nf: string | null;
    dataAbate: string | null;
    dataSaida: string;
    precoArroba: number | null;
    precoArrobaEntrada: number;
    pesoCarcacaTotal: number | null;
    frete: number;
    comissao: number;
    deducoes: number;
    itens: ItemSelecionado[];
  },
): Promise<{ ok: boolean; erro?: string; vendaLoteId?: string }> {
  if (input.itens.length === 0) return { ok: false, erro: "Selecione ao menos um animal ou lote." };
  if (input.precoArrobaEntrada <= 0) return { ok: false, erro: "Preço da @ de entrada deve ser maior que zero." };
  if (input.frete < 0) return { ok: false, erro: "Frete não pode ser negativo." };
  if (input.comissao < 0) return { ok: false, erro: "Comissão não pode ser negativa." };
  if (input.deducoes < 0) return { ok: false, erro: "Deduções não podem ser negativas." };

  if (input.tipoVenda === "abate") {
    if (!input.precoArroba || input.precoArroba <= 0) {
      return { ok: false, erro: "Preço da @ deve ser maior que zero." };
    }
  } else {
    if (input.itens.some((i) => !i.valorNegociado || i.valorNegociado <= 0)) {
      return { ok: false, erro: "Informe o valor combinado de cada animal/lote selecionado." };
    }
  }

  const supabase = await createClient();

  const animalIds = input.itens.map((i) => i.animalId);
  const { data: animais, error: animaisErr } = await supabase
    .from("animais")
    .select("id, tipo, status, quantidade, curral_id")
    .in("id", animalIds);
  if (animaisErr) return { ok: false, erro: erroAmigavel(animaisErr) };

  const animalPorId = new Map((animais ?? []).map((a) => [a.id as string, a]));

  let cabecas = 0;
  for (const item of input.itens) {
    const animal = animalPorId.get(item.animalId);
    if (!animal || animal.status !== "ativo" || animal.curral_id !== input.curralId) {
      return { ok: false, erro: "Um dos animais selecionados não está mais ativo nesse curral." };
    }
    if (item.tipo === "agregado") {
      const disponivel = (animal.quantidade as number) ?? 0;
      const vendida = item.quantidadeVendida ?? 0;
      if (vendida <= 0 || vendida > disponivel) {
        return { ok: false, erro: `Quantidade vendida inválida para o lote agregado (disponível: ${disponivel}).` };
      }
      cabecas += vendida;
    } else {
      cabecas += 1;
    }
  }

  const { data: vendaLote, error: vendaErr } = await supabase
    .from("venda_lote")
    .insert({
      fazenda_id: fazendaId,
      curral_id: input.curralId,
      tipo_venda: input.tipoVenda,
      comprador: input.comprador,
      frigorifico: input.frigorifico,
      nf: input.nf,
      data_abate: input.dataAbate,
      data_saida: input.dataSaida,
      cabecas,
      preco_arroba: input.tipoVenda === "abate" ? input.precoArroba : null,
      preco_arroba_entrada: input.precoArrobaEntrada,
      peso_carcaca_total: input.tipoVenda === "abate" ? input.pesoCarcacaTotal : null,
      frete: input.frete,
      comissao: input.comissao,
      deducoes: input.deducoes,
    })
    .select("id")
    .single();
  if (vendaErr) return { ok: false, erro: erroAmigavel(vendaErr) };
  const vendaLoteId = vendaLote.id as string;

  const { error: itensErr } = await supabase.from("venda_item").insert(
    input.itens.map((item) => ({
      venda_lote_id: vendaLoteId,
      animal_id: item.animalId,
      quantidade: item.tipo === "agregado" ? item.quantidadeVendida : null,
      valor_negociado: input.tipoVenda === "direta" ? item.valorNegociado : null,
    })),
  );
  if (itensErr) return { ok: false, erro: erroAmigavel(itensErr) };

  // Baixa automática: individual sai por inteiro; agregado abate a quantidade
  // vendida e só marca vendido quando a quantidade remanescente chega a zero.
  for (const item of input.itens) {
    if (item.tipo === "individual") {
      const { error } = await supabase.from("animais").update({ status: "vendido" }).eq("id", item.animalId);
      if (error) return { ok: false, erro: erroAmigavel(error) };
    } else {
      const animal = animalPorId.get(item.animalId)!;
      const restante = ((animal.quantidade as number) ?? 0) - (item.quantidadeVendida ?? 0);
      const { error } = await supabase
        .from("animais")
        .update(restante <= 0 ? { status: "vendido", quantidade: 0 } : { quantidade: restante })
        .eq("id", item.animalId);
      if (error) return { ok: false, erro: erroAmigavel(error) };
    }
  }

  ok(fazendaCodigo);
  return { ok: true, vendaLoteId };
}

export async function atualizarDadosVenda(
  fazendaCodigo: string,
  fazendaId: string,
  vendaLoteId: string,
  input: {
    comprador: string | null;
    frigorifico: string | null;
    nf: string | null;
    dataAbate: string | null;
    dataSaida: string;
    precoArroba: number | null;
    precoArrobaEntrada: number;
    pesoCarcacaTotal: number | null;
    frete: number;
    comissao: number;
    deducoes: number;
  },
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const erroPapel = await exigirDono(supabase, fazendaId);
  if (erroPapel) return { ok: false, erro: erroPapel };

  const { data: vendaLote } = await supabase
    .from("venda_lote")
    .select("tipo_venda")
    .eq("id", vendaLoteId)
    .maybeSingle();
  if (!vendaLote) return { ok: false, erro: "Venda não encontrada." };
  const tipoVenda = vendaLote.tipo_venda as "abate" | "direta";

  if (input.precoArrobaEntrada <= 0) return { ok: false, erro: "Preço da @ de entrada deve ser maior que zero." };
  if (input.frete < 0) return { ok: false, erro: "Frete não pode ser negativo." };
  if (input.comissao < 0) return { ok: false, erro: "Comissão não pode ser negativa." };
  if (input.deducoes < 0) return { ok: false, erro: "Deduções não podem ser negativas." };
  if (tipoVenda === "abate" && (!input.precoArroba || input.precoArroba <= 0)) {
    return { ok: false, erro: "Preço da @ deve ser maior que zero." };
  }

  const { error } = await supabase
    .from("venda_lote")
    .update({
      comprador: input.comprador,
      frigorifico: input.frigorifico,
      nf: input.nf,
      data_abate: input.dataAbate,
      data_saida: input.dataSaida,
      preco_arroba: tipoVenda === "abate" ? input.precoArroba : null,
      preco_arroba_entrada: input.precoArrobaEntrada,
      peso_carcaca_total: tipoVenda === "abate" ? input.pesoCarcacaTotal : null,
      frete: input.frete,
      comissao: input.comissao,
      deducoes: input.deducoes,
    })
    .eq("id", vendaLoteId);
  if (error) return { ok: false, erro: erroAmigavel(error) };

  okVenda(fazendaCodigo, vendaLoteId);
  return { ok: true };
}

export async function adicionarItemVenda(
  fazendaCodigo: string,
  fazendaId: string,
  vendaLoteId: string,
  item: ItemSelecionado,
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const erroPapel = await exigirDono(supabase, fazendaId);
  if (erroPapel) return { ok: false, erro: erroPapel };

  const { data: vendaLote } = await supabase
    .from("venda_lote")
    .select("id, curral_id, tipo_venda, cabecas")
    .eq("id", vendaLoteId)
    .maybeSingle();
  if (!vendaLote) return { ok: false, erro: "Venda não encontrada." };

  if (vendaLote.tipo_venda === "direta" && (!item.valorNegociado || item.valorNegociado <= 0)) {
    return { ok: false, erro: "Informe o valor combinado do animal." };
  }

  const { data: animal, error: animalErr } = await supabase
    .from("animais")
    .select("id, tipo, status, quantidade, curral_id")
    .eq("id", item.animalId)
    .maybeSingle();
  if (animalErr) return { ok: false, erro: erroAmigavel(animalErr) };
  if (!animal || animal.status !== "ativo" || animal.curral_id !== vendaLote.curral_id) {
    return { ok: false, erro: "Esse animal não está mais ativo nesse curral." };
  }

  let cabecasItem = 1;
  if (item.tipo === "agregado") {
    const disponivel = (animal.quantidade as number) ?? 0;
    const vendida = item.quantidadeVendida ?? 0;
    if (vendida <= 0 || vendida > disponivel) {
      return { ok: false, erro: `Quantidade vendida inválida (disponível: ${disponivel}).` };
    }
    cabecasItem = vendida;
  }

  const { error: itemErr } = await supabase.from("venda_item").insert({
    venda_lote_id: vendaLoteId,
    animal_id: item.animalId,
    quantidade: item.tipo === "agregado" ? item.quantidadeVendida : null,
    valor_negociado: vendaLote.tipo_venda === "direta" ? item.valorNegociado : null,
  });
  if (itemErr) return { ok: false, erro: erroAmigavel(itemErr) };

  if (item.tipo === "individual") {
    const { error } = await supabase.from("animais").update({ status: "vendido" }).eq("id", item.animalId);
    if (error) return { ok: false, erro: erroAmigavel(error) };
  } else {
    const restante = ((animal.quantidade as number) ?? 0) - cabecasItem;
    const { error } = await supabase
      .from("animais")
      .update(restante <= 0 ? { status: "vendido", quantidade: 0 } : { quantidade: restante })
      .eq("id", item.animalId);
    if (error) return { ok: false, erro: erroAmigavel(error) };
  }

  await supabase
    .from("venda_lote")
    .update({ cabecas: ((vendaLote.cabecas as number) ?? 0) + cabecasItem })
    .eq("id", vendaLoteId);

  okVenda(fazendaCodigo, vendaLoteId);
  return { ok: true };
}

export async function removerItemVenda(
  fazendaCodigo: string,
  fazendaId: string,
  vendaLoteId: string,
  vendaItemId: string,
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const erroPapel = await exigirDono(supabase, fazendaId);
  if (erroPapel) return { ok: false, erro: erroPapel };

  const { data: item, error: itemErr } = await supabase
    .from("venda_item")
    .select("id, animal_id, quantidade")
    .eq("id", vendaItemId)
    .eq("venda_lote_id", vendaLoteId)
    .maybeSingle();
  if (itemErr) return { ok: false, erro: erroAmigavel(itemErr) };
  if (!item) return { ok: false, erro: "Item não encontrado." };

  const { data: animal } = await supabase
    .from("animais")
    .select("quantidade")
    .eq("id", item.animal_id)
    .maybeSingle();

  const cabecasItem = item.quantidade ?? 1;

  if (item.quantidade === null) {
    const { error } = await supabase.from("animais").update({ status: "ativo" }).eq("id", item.animal_id);
    if (error) return { ok: false, erro: erroAmigavel(error) };
  } else {
    const novaQuantidade = ((animal?.quantidade as number) ?? 0) + item.quantidade;
    const { error } = await supabase
      .from("animais")
      .update({ status: "ativo", quantidade: novaQuantidade })
      .eq("id", item.animal_id);
    if (error) return { ok: false, erro: erroAmigavel(error) };
  }

  const { error: delErr } = await supabase.from("venda_item").delete().eq("id", vendaItemId);
  if (delErr) return { ok: false, erro: erroAmigavel(delErr) };

  const { data: vendaLote } = await supabase.from("venda_lote").select("cabecas").eq("id", vendaLoteId).maybeSingle();
  if (vendaLote) {
    await supabase
      .from("venda_lote")
      .update({ cabecas: Math.max(0, ((vendaLote.cabecas as number) ?? 0) - cabecasItem) })
      .eq("id", vendaLoteId);
  }

  okVenda(fazendaCodigo, vendaLoteId);
  return { ok: true };
}

export async function atualizarItemVenda(
  fazendaCodigo: string,
  fazendaId: string,
  vendaLoteId: string,
  vendaItemId: string,
  input: { novaQuantidade: number | null; valorNegociado: number | null },
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();
  const erroPapel = await exigirDono(supabase, fazendaId);
  if (erroPapel) return { ok: false, erro: erroPapel };

  const { data: item, error: itemErr } = await supabase
    .from("venda_item")
    .select("id, animal_id, quantidade")
    .eq("id", vendaItemId)
    .eq("venda_lote_id", vendaLoteId)
    .maybeSingle();
  if (itemErr) return { ok: false, erro: erroAmigavel(itemErr) };
  if (!item) return { ok: false, erro: "Item não encontrado." };

  const update: Record<string, unknown> = {};
  let deltaCabecas = 0;

  if (input.novaQuantidade !== null) {
    if (item.quantidade === null) {
      return { ok: false, erro: "Esse item é individual — não tem quantidade a ajustar." };
    }
    if (input.novaQuantidade <= 0) return { ok: false, erro: "Quantidade deve ser maior que zero." };

    const { data: animal } = await supabase
      .from("animais")
      .select("quantidade")
      .eq("id", item.animal_id)
      .maybeSingle();
    const disponivelAntes = ((animal?.quantidade as number) ?? 0) + item.quantidade;
    if (input.novaQuantidade > disponivelAntes) {
      return { ok: false, erro: `Quantidade inválida (disponível: ${disponivelAntes}).` };
    }

    const novoRestante = disponivelAntes - input.novaQuantidade;
    const { error } = await supabase
      .from("animais")
      .update(
        novoRestante <= 0 ? { status: "vendido", quantidade: 0 } : { status: "ativo", quantidade: novoRestante },
      )
      .eq("id", item.animal_id);
    if (error) return { ok: false, erro: erroAmigavel(error) };

    deltaCabecas = input.novaQuantidade - item.quantidade;
    update.quantidade = input.novaQuantidade;
  }

  if (input.valorNegociado !== null) {
    if (input.valorNegociado <= 0) return { ok: false, erro: "Valor combinado deve ser maior que zero." };
    update.valor_negociado = input.valorNegociado;
  }

  if (Object.keys(update).length === 0) return { ok: true };

  const { error: updErr } = await supabase.from("venda_item").update(update).eq("id", vendaItemId);
  if (updErr) return { ok: false, erro: erroAmigavel(updErr) };

  if (deltaCabecas !== 0) {
    const { data: vendaLote } = await supabase.from("venda_lote").select("cabecas").eq("id", vendaLoteId).maybeSingle();
    if (vendaLote) {
      await supabase
        .from("venda_lote")
        .update({ cabecas: Math.max(0, ((vendaLote.cabecas as number) ?? 0) + deltaCabecas) })
        .eq("id", vendaLoteId);
    }
  }

  okVenda(fazendaCodigo, vendaLoteId);
  return { ok: true };
}
