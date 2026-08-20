import path from "node:path";
import { readFileSync } from "node:fs";
import { supabase } from "./lib";

/**
 * Anexa dado cadastral externo (base de registro genealógico / PO) aos touros
 * Bonsmara que JÁ existem em `animais` (currais 2 e 3 da BG) — casando por
 * brinco. Não cria animal novo: se um brinco do JSON não bater com nenhum
 * animal cadastrado, ele fica de fora e é reportado (nunca inventamos o
 * cadastro de entrada de um animal a partir de um dado externo).
 *
 * Uso: tsx scripts/import/seed-touros-bonsmara-po.ts
 */

type TouroPo = {
  brinco: string;
  curral: string;
  conciliacao?: { status?: string | null; observacao?: string | null };
  identificacao?: {
    nome_completo?: string | null;
    apelido?: string | null;
    rgn?: string | null;
    rgd?: string | null;
    raca_po?: string | null;
    gs?: string | null;
    tipo?: string | null;
  };
  genealogia?: {
    pai?: string | null;
    rgn_pai?: string | null;
    rgd_pai?: string | null;
    mae?: string | null;
    mae_receptora?: string | null;
    avo_paterno?: string | null;
    avo_paterna?: string | null;
    avo_materno?: string | null;
    avo_materna?: string | null;
  };
  nascimento_e_pesos?: {
    data_nascimento?: string | null;
    peso_nascimento_kg?: number | null;
    peso_desmame_kg?: number | null;
    data_desmame?: string | null;
    peso_po_ultima_kg?: number | null;
    data_peso_po?: string | null;
  };
  confinamento?: {
    lote_origem?: string | null;
    data_entrada?: string | null;
    peso_entrada_kg?: number | null;
  };
  outros_po?: {
    status_po?: string | null;
    fazenda?: string | null;
    local?: string | null;
    lote_reprodutivo?: string | null;
    fornecedor?: string | null;
    data_aquisicao?: string | null;
  };
};

function vazioParaNull(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = v.trim();
  return t === "" ? null : t;
}

async function main() {
  const jsonPath = path.join(process.cwd(), "src/data/touros_bonsmara_c2c3.json");
  const touros: TouroPo[] = JSON.parse(readFileSync(jsonPath, "utf-8"));

  const { data: fazenda, error: fazendaErr } = await supabase
    .from("fazendas")
    .select("id")
    .eq("codigo", "BG")
    .single();
  if (fazendaErr || !fazenda) throw new Error(`Fazenda BG não encontrada: ${fazendaErr?.message}`);

  const { data: animais, error: animaisErr } = await supabase
    .from("animais")
    .select("id, brinco, lote_origem")
    .eq("fazenda_id", fazenda.id)
    .not("brinco", "is", null);
  if (animaisErr) throw new Error(`Erro lendo animais: ${animaisErr.message}`);

  const animalPorBrinco = new Map(
    (animais ?? []).map((a) => [(a.brinco as string).trim(), a as { id: string; brinco: string; lote_origem: string | null }]),
  );

  // Touros do JSON sem animal correspondente: cadastra a entrada agora (com os
  // mesmos dados do JSON) em vez de deixar de fora — decidido com o dono
  // depois de confirmar que é uma entrada real (lote "Bela Vista", 2026-08-11)
  // que só ainda não tinha sido lançada.
  const semAnimal = touros.filter((t) => !animalPorBrinco.has(t.brinco.trim()));
  if (semAnimal.length > 0) {
    const curralCodigos = [...new Set(semAnimal.map((t) => t.curral))];
    const { data: currais, error: curraisErr } = await supabase
      .from("currais")
      .select("id, codigo")
      .eq("fazenda_id", fazenda.id)
      .in("codigo", curralCodigos);
    if (curraisErr) throw new Error(`Erro lendo currais: ${curraisErr.message}`);
    const curralIdPorCodigo = new Map((currais ?? []).map((c) => [c.codigo as string, c.id as string]));

    const { data: categoriaExistente } = await supabase
      .from("categorias")
      .select("id")
      .eq("fazenda_id", fazenda.id)
      .eq("nome", "Touro Bonsmara")
      .maybeSingle();
    let categoriaId = categoriaExistente?.id as string | undefined;
    if (!categoriaId) {
      const { data: novaCategoria, error: categoriaErr } = await supabase
        .from("categorias")
        .insert({ fazenda_id: fazenda.id, nome: "Touro Bonsmara" })
        .select("id")
        .single();
      if (categoriaErr) throw new Error(`Erro criando categoria "Touro Bonsmara": ${categoriaErr.message}`);
      categoriaId = novaCategoria.id as string;
    }

    const novosAnimais = semAnimal.map((t) => ({
      fazenda_id: fazenda.id,
      tipo: "individual",
      categoria_id: categoriaId,
      curral_id: curralIdPorCodigo.get(t.curral),
      lote_origem: vazioParaNull(t.confinamento?.lote_origem),
      data_entrada: t.confinamento?.data_entrada,
      brinco: t.brinco,
      peso_entrada_kg: t.confinamento?.peso_entrada_kg,
    }));

    const { data: criados, error: criarErr } = await supabase
      .from("animais")
      .insert(novosAnimais as never)
      .select("id, brinco");
    if (criarErr) throw new Error(`Erro cadastrando animais novos: ${criarErr.message}`);

    const loteOrigemPorBrinco = new Map(
      semAnimal.map((t) => [t.brinco.trim(), vazioParaNull(t.confinamento?.lote_origem)]),
    );
    for (const a of criados ?? []) {
      const brinco = (a.brinco as string).trim();
      animalPorBrinco.set(brinco, {
        id: a.id as string,
        brinco: a.brinco as string,
        lote_origem: loteOrigemPorBrinco.get(brinco) ?? null,
      });
    }
    console.log(`Cadastrados ${criados?.length ?? 0} touro(s) novo(s) em animais (${[...new Set(semAnimal.map((t) => t.curral))].map((c) => `curral ${c}`).join(", ")}).`);
  }

  const naoEncontrados: string[] = [];
  const linhas: Record<string, unknown>[] = [];
  const backfillLoteOrigem: Array<{ id: string; lote_origem: string }> = [];

  for (const t of touros) {
    const animal = animalPorBrinco.get(t.brinco.trim());
    if (!animal) {
      naoEncontrados.push(t.brinco);
      continue;
    }

    linhas.push({
      animal_id: animal.id,
      conciliacao_status: vazioParaNull(t.conciliacao?.status),
      conciliacao_observacao: vazioParaNull(t.conciliacao?.observacao),
      nome_completo: vazioParaNull(t.identificacao?.nome_completo),
      apelido: vazioParaNull(t.identificacao?.apelido),
      rgn: vazioParaNull(t.identificacao?.rgn),
      rgd: vazioParaNull(t.identificacao?.rgd),
      raca_po: vazioParaNull(t.identificacao?.raca_po),
      gs: vazioParaNull(t.identificacao?.gs),
      tipo_reprodutivo: vazioParaNull(t.identificacao?.tipo),
      pai: vazioParaNull(t.genealogia?.pai),
      rgn_pai: vazioParaNull(t.genealogia?.rgn_pai),
      rgd_pai: vazioParaNull(t.genealogia?.rgd_pai),
      mae: vazioParaNull(t.genealogia?.mae),
      mae_receptora: vazioParaNull(t.genealogia?.mae_receptora),
      avo_paterno: vazioParaNull(t.genealogia?.avo_paterno),
      avo_paterna: vazioParaNull(t.genealogia?.avo_paterna),
      avo_materno: vazioParaNull(t.genealogia?.avo_materno),
      avo_materna: vazioParaNull(t.genealogia?.avo_materna),
      data_nascimento: t.nascimento_e_pesos?.data_nascimento || null,
      peso_nascimento_kg: t.nascimento_e_pesos?.peso_nascimento_kg ?? null,
      peso_desmame_kg: t.nascimento_e_pesos?.peso_desmame_kg ?? null,
      data_desmame: t.nascimento_e_pesos?.data_desmame || null,
      peso_po_ultima_kg: t.nascimento_e_pesos?.peso_po_ultima_kg ?? null,
      data_peso_po: t.nascimento_e_pesos?.data_peso_po || null,
      status_po: vazioParaNull(t.outros_po?.status_po),
      fazenda_po: vazioParaNull(t.outros_po?.fazenda),
      local_po: vazioParaNull(t.outros_po?.local),
      lote_reprodutivo: vazioParaNull(t.outros_po?.lote_reprodutivo),
      fornecedor: vazioParaNull(t.outros_po?.fornecedor),
      data_aquisicao: t.outros_po?.data_aquisicao || null,
    });

    const loteOrigem = vazioParaNull(t.confinamento?.lote_origem);
    if (loteOrigem && !animal.lote_origem) {
      backfillLoteOrigem.push({ id: animal.id, lote_origem: loteOrigem });
    }
  }

  console.log(`${touros.length} touros no JSON, ${linhas.length} casaram com animal existente na BG.`);
  if (naoEncontrados.length > 0) {
    console.log(`\n${naoEncontrados.length} brinco(s) NÃO encontrados em animais (nada foi criado para eles):`);
    for (const b of naoEncontrados) console.log(`  - ${b}`);
  }

  if (linhas.length > 0) {
    const { error } = await supabase.from("animais_dados_po").upsert(linhas as never);
    if (error) throw new Error(`Erro gravando animais_dados_po: ${error.message}`);
    console.log(`\nOK: ${linhas.length} registro(s) gravados em animais_dados_po.`);
  }

  if (backfillLoteOrigem.length > 0) {
    for (const b of backfillLoteOrigem) {
      const { error } = await supabase.from("animais").update({ lote_origem: b.lote_origem }).eq("id", b.id);
      if (error) throw new Error(`Erro atualizando lote_origem: ${error.message}`);
    }
    console.log(`OK: lote_origem preenchido em ${backfillLoteOrigem.length} animal(is) que estavam sem.`);
  }
}

main().catch((err) => {
  console.error("Erro no seed de touros PO:", err);
  process.exit(1);
});
