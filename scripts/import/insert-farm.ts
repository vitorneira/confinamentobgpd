import { supabase, insertAll, toStr } from "./lib";
import type { ParsedFarm } from "./types";

export type ImportCounts = {
  currais: number;
  categorias: number;
  ingredientes: number;
  dietas: number;
  dietaVigencias: number;
  animais: number;
  pesagens: number;
  tratos: number;
  compras: number;
};

function idMapFrom(rows: Record<string, unknown>[], keyField: string): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows) m.set(toStr(r[keyField]), r.id as string);
  return m;
}

/** Escolhe, entre as vigências <= data, a de data_inicio mais recente. */
function resolveDietaId(
  vigenciasPorCurral: Map<string, Array<{ dataInicio: string; dietaId: string }>>,
  curralCodigo: string,
  data: string,
): string {
  const lista = vigenciasPorCurral.get(curralCodigo) ?? [];
  const candidatas = lista.filter((v) => v.dataInicio <= data);
  if (candidatas.length === 0) {
    throw new Error(`Nenhuma dieta vigente para curral "${curralCodigo}" na data ${data}`);
  }
  return candidatas.reduce((a, b) => (b.dataInicio > a.dataInicio ? b : a)).dietaId;
}

export async function insertFarm(parsed: ParsedFarm): Promise<ImportCounts> {
  const [fazenda] = await insertAll("fazendas", [
    { codigo: parsed.codigo, nome: parsed.nome, tipo_posse: parsed.tipoPosse },
  ]);
  const fazendaId = fazenda.id as string;

  await insertAll("parametros", [
    {
      fazenda_id: fazendaId,
      preco_arroba_referencia: parsed.parametros.precoArrobaReferencia,
      pct_materia_seca: parsed.parametros.pctMateriaSeca,
      custo_fixo_dia: parsed.parametros.custoFixoDia,
      gmd_meta: parsed.parametros.gmdMeta,
      peso_abate_alvo: parsed.parametros.pesoAbateAlvo,
      data_referencia: parsed.parametros.dataReferencia,
    },
  ]);

  const curraisInseridos = await insertAll(
    "currais",
    parsed.currais.map((c) => ({ fazenda_id: fazendaId, codigo: c.codigo, descricao: c.descricao })),
  );
  const curralIdByCodigo = idMapFrom(curraisInseridos, "codigo");

  const categoriasInseridas = await insertAll(
    "categorias",
    parsed.categorias.map((nome) => ({ fazenda_id: fazendaId, nome })),
  );
  const categoriaIdByNome = idMapFrom(categoriasInseridas, "nome");

  const ingredientesInseridos = await insertAll(
    "ingredientes",
    parsed.ingredientes.map((nome) => ({ fazenda_id: fazendaId, nome })),
  );
  const ingredienteIdByNome = idMapFrom(ingredientesInseridos, "nome");

  const dietasInseridas = await insertAll(
    "dietas",
    parsed.dietas.map((d) => ({ fazenda_id: fazendaId, nome: d.nome })),
  );
  const dietaIdByNome = idMapFrom(dietasInseridas, "nome");

  const dietaIngredientesRows = parsed.dietas.flatMap((d) =>
    d.composicao.map((c) => ({
      dieta_id: dietaIdByNome.get(d.nome)!,
      ingrediente_id: ingredienteIdByNome.get(c.ingrediente)!,
      proporcao: c.proporcao,
    })),
  );
  await insertAll("dieta_ingredientes", dietaIngredientesRows);

  const vigenciasInseridas = await insertAll(
    "dieta_vigencia",
    parsed.vigencias.map((v) => ({
      curral_id: curralIdByCodigo.get(v.curralCodigo)!,
      dieta_id: dietaIdByNome.get(v.dietaNome)!,
      data_inicio: v.dataInicio,
    })),
  );
  const vigenciasPorCurral = new Map<string, Array<{ dataInicio: string; dietaId: string }>>();
  for (const row of vigenciasInseridas) {
    const curralId = row.curral_id as string;
    const curralCodigo = [...curralIdByCodigo.entries()].find(([, id]) => id === curralId)?.[0];
    if (!curralCodigo) continue;
    const lista = vigenciasPorCurral.get(curralCodigo) ?? [];
    lista.push({ dataInicio: row.data_inicio as string, dietaId: row.dieta_id as string });
    vigenciasPorCurral.set(curralCodigo, lista);
  }

  const animaisInseridos = await insertAll(
    "animais",
    parsed.animais.map((a) => ({
      fazenda_id: fazendaId,
      tipo: "individual",
      categoria_id: categoriaIdByNome.get(a.categoria)!,
      curral_id: curralIdByCodigo.get(a.curralCodigo)!,
      lote_origem: a.loteOrigem,
      data_entrada: a.dataEntrada,
      brinco: a.brinco,
      peso_entrada_kg: a.pesoEntradaKg,
    })),
  );
  const animalIdByBrinco = idMapFrom(animaisInseridos, "brinco");

  const pesagensRows = parsed.pesagens.flatMap((p) => {
    const animalId = animalIdByBrinco.get(p.brinco);
    if (!animalId) {
      console.warn(`  aviso: pesagem sem animal cadastrado para brinco "${p.brinco}" — ignorada`);
      return [];
    }
    return [
      {
        fazenda_id: fazendaId,
        animal_id: animalId,
        data: p.data,
        curral_id: curralIdByCodigo.get(p.curralCodigo)!,
        peso_kg: p.pesoKg,
        evento_obs: p.obs,
      },
    ];
  });
  await insertAll("pesagens", pesagensRows);

  const tratosRows = parsed.tratos.map((t) => ({
    fazenda_id: fazendaId,
    data: t.data,
    curral_id: curralIdByCodigo.get(t.curralCodigo)!,
    trato_manha_kg: t.manhaKg,
    trato_almoco_kg: t.almocoKg,
    trato_tarde_kg: t.tardeKg,
    dieta_id: resolveDietaId(vigenciasPorCurral, t.curralCodigo, t.data),
    preco_dieta_congelado: t.precoDietaCongelado,
    obs: t.obs,
  }));
  await insertAll("tratos_diarios", tratosRows);

  const comprasRows = parsed.compras.map((c) => ({
    fazenda_id: fazendaId,
    data: c.data,
    ingrediente_id: ingredienteIdByNome.get(c.ingrediente)!,
    preco_kg: c.precoKg,
    qtd_kg: c.qtdKg,
    fornecedor: c.fornecedor,
    obs: c.obs,
  }));
  await insertAll("compras_insumos", comprasRows);

  return {
    currais: curraisInseridos.length,
    categorias: categoriasInseridas.length,
    ingredientes: ingredientesInseridos.length,
    dietas: dietasInseridas.length,
    dietaVigencias: vigenciasInseridas.length,
    animais: animaisInseridos.length,
    pesagens: pesagensRows.length,
    tratos: tratosRows.length,
    compras: comprasRows.length,
  };
}
