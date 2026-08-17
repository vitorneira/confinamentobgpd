"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { erroAmigavel } from "@/lib/erros";

function ok(fazendaCodigo: string) {
  const base = `/${fazendaCodigo.toLowerCase()}`;
  revalidatePath(`${base}/vendas`);
  revalidatePath(`${base}/animais`);
  revalidatePath(`${base}/currais`);
  revalidatePath(`${base}/dashboard`);
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
