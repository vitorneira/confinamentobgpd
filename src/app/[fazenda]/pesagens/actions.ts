"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parsePlanilhaImportacao } from "@/lib/pesagens/parser";
import {
  validarAnimaisNovos,
  validarPesagens,
  type AnimalValidado,
  type PesagemValidada,
  type ReferenciaCadastro,
} from "@/lib/pesagens/validacao";

async function carregarReferencia(fazendaId: string): Promise<ReferenciaCadastro> {
  const supabase = await createClient();
  const [{ data: currais }, { data: categorias }, { data: animais }] = await Promise.all([
    supabase.from("currais").select("id, codigo").eq("fazenda_id", fazendaId),
    supabase.from("categorias").select("id, nome").eq("fazenda_id", fazendaId),
    supabase.from("animais").select("id, brinco").eq("fazenda_id", fazendaId).not("brinco", "is", null),
  ]);
  return {
    curralIdPorCodigo: new Map((currais ?? []).map((c) => [c.codigo as string, c.id as string])),
    categoriaIdPorNome: new Map((categorias ?? []).map((c) => [c.nome as string, c.id as string])),
    animalIdPorBrinco: new Map((animais ?? []).map((a) => [(a.brinco as string).trim(), a.id as string])),
  };
}

export async function previewImportacao(
  fazendaId: string,
  file: File,
): Promise<{ pesagens: PesagemValidada[]; animaisNovos: AnimalValidado[] }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const { pesagens, animais } = parsePlanilhaImportacao(buffer);
  const ref = await carregarReferencia(fazendaId);

  return {
    pesagens: validarPesagens(pesagens, ref),
    animaisNovos: validarAnimaisNovos(animais, ref),
  };
}

export async function confirmarImportacao(
  fazendaCodigo: string,
  fazendaId: string,
  pesagens: PesagemValidada[],
  animaisNovos: AnimalValidado[],
): Promise<{ ok: boolean; erro?: string; pesagensGravadas?: number; animaisCriados?: number }> {
  const supabase = await createClient();

  // 1) cadastra os animais novos vindos da aba Cadastro_Animais
  const brincoParaAnimalId = new Map<string, string>();
  if (animaisNovos.length > 0) {
    const { data: inseridos, error } = await supabase
      .from("animais")
      .insert(
        animaisNovos.map((a) => ({
          fazenda_id: fazendaId,
          tipo: a.tipoEntrada,
          categoria_id: a.categoriaId,
          curral_id: a.curralId,
          lote_origem: a.loteOrigem,
          data_entrada: a.dataEntrada,
          brinco: a.tipoEntrada === "individual" ? a.brinco : null,
          peso_entrada_kg: a.tipoEntrada === "individual" ? a.pesoEntradaKg : null,
          quantidade: a.tipoEntrada === "agregado" ? a.quantidade : null,
          peso_medio_entrada_kg: a.tipoEntrada === "agregado" ? a.pesoEntradaKg : null,
        })),
      )
      .select("id, brinco");
    if (error) return { ok: false, erro: `Erro cadastrando animais: ${error.message}` };
    for (const a of inseridos ?? []) {
      if (a.brinco) brincoParaAnimalId.set((a.brinco as string).trim(), a.id as string);
    }
  }

  // 2) pesagens com brinco novo (não coberto pela aba Cadastro_Animais) viram
  // cadastro automático, usando a própria pesagem como entrada
  const pesagensParaCriarAnimal = pesagens.filter(
    (p) => p.novoAnimal && !brincoParaAnimalId.has(p.brinco.trim()),
  );
  if (pesagensParaCriarAnimal.length > 0) {
    const { data: criados, error } = await supabase
      .from("animais")
      .insert(
        pesagensParaCriarAnimal.map((p) => ({
          fazenda_id: fazendaId,
          tipo: "individual",
          categoria_id: p.categoriaId,
          curral_id: p.curralId,
          data_entrada: p.data,
          brinco: p.brinco,
          peso_entrada_kg: p.pesoKg,
        })),
      )
      .select("id, brinco");
    if (error) return { ok: false, erro: `Erro cadastrando animais (via pesagem): ${error.message}` };
    for (const a of criados ?? []) {
      if (a.brinco) brincoParaAnimalId.set((a.brinco as string).trim(), a.id as string);
    }
  }

  // 3) grava as pesagens
  const rows = pesagens.map((p) => ({
    fazenda_id: fazendaId,
    animal_id: p.animalId ?? brincoParaAnimalId.get(p.brinco.trim()),
    data: p.data,
    curral_id: p.curralId,
    peso_kg: p.pesoKg,
    evento_obs: "Importação planilha",
  }));

  const { error: pesagemErr } = await supabase.from("pesagens").insert(rows);
  if (pesagemErr) return { ok: false, erro: `Erro gravando pesagens: ${pesagemErr.message}` };

  const base = `/${fazendaCodigo.toLowerCase()}`;
  revalidatePath(`${base}/dashboard`);
  revalidatePath(`${base}/animais`);
  revalidatePath(`${base}/currais`);

  return { ok: true, pesagensGravadas: rows.length, animaisCriados: brincoParaAnimalId.size };
}

export async function lancarPesagemManual(
  fazendaCodigo: string,
  fazendaId: string,
  input: { data: string; curralCodigo: string; brinco: string; pesoKg: number },
): Promise<{ ok: boolean; erro?: string }> {
  const supabase = await createClient();

  const { data: curral } = await supabase
    .from("currais")
    .select("id")
    .eq("fazenda_id", fazendaId)
    .eq("codigo", input.curralCodigo)
    .maybeSingle();
  if (!curral) return { ok: false, erro: `Curral "${input.curralCodigo}" não encontrado` };

  const { data: animal } = await supabase
    .from("animais")
    .select("id")
    .eq("fazenda_id", fazendaId)
    .eq("brinco", input.brinco.trim())
    .maybeSingle();
  if (!animal) return { ok: false, erro: `Brinco "${input.brinco}" não encontrado nesta fazenda` };

  if (input.pesoKg <= 0) return { ok: false, erro: "Peso deve ser maior que zero" };

  const { error } = await supabase.from("pesagens").insert({
    fazenda_id: fazendaId,
    animal_id: animal.id,
    data: input.data,
    curral_id: curral.id,
    peso_kg: input.pesoKg,
    evento_obs: "Lançamento manual",
  });
  if (error) return { ok: false, erro: error.message };

  const base = `/${fazendaCodigo.toLowerCase()}`;
  revalidatePath(`${base}/dashboard`);
  revalidatePath(`${base}/animais`);
  revalidatePath(`${base}/currais`);

  return { ok: true };
}
