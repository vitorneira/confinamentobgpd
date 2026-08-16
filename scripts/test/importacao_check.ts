import * as XLSX from "xlsx";
import { parsePlanilhaImportacao } from "../../src/lib/pesagens/parser";
import { validarAnimaisNovos, validarPesagens, type ReferenciaCadastro } from "../../src/lib/pesagens/validacao";

function montarPlanilhaTeste(): Buffer {
  const wb = XLSX.utils.book_new();

  const pesagensAoa: unknown[][] = [
    ["MODELO"],
    ["nota"],
    [],
    ["Fazenda", "Data", "Brinco", "Categoria", "Curral", "Peso (kg)"],
    ["BG", "2026-08-15", "BBG-EXISTE-1", "Touro Bonsmara", "2", 560], // animal existente
    ["BG", "2026-08-15", "BBG-NOVO-1", "Touro Bonsmara", "2", 400], // brinco novo, categoria válida
    ["BG", "2026-08-15", "BBG-NOVO-2", "Categoria Inexistente", "2", 400], // brinco novo, categoria inválida -> erro
    ["BG", "2026-08-15", "BBG-EXISTE-1", "Touro Bonsmara", "CURRAL-FANTASMA", 560], // curral inexistente -> erro
    ["BG", "2026-08-15", "BBG-EXISTE-1", "Touro Bonsmara", "2", -5], // peso inválido -> erro
    ["BG", "2026-08-15", "", "Touro Bonsmara", "2", 560], // brinco vazio -> erro
  ];
  const wsPesagens = XLSX.utils.aoa_to_sheet(pesagensAoa);
  XLSX.utils.book_append_sheet(wb, wsPesagens, "Pesagens");

  const animaisAoa: unknown[][] = [
    ["MODELO"],
    ["nota"],
    [],
    [],
    ["Fazenda", "Tipo Entrada", "Data Entrada", "Brinco", "Categoria", "Curral", "Lote/Origem", "Qtd (agregado)", "Peso Entrada (kg)"],
    ["BG", "individual", "2026-08-15", "BBG-CADASTRO-1", "Touro Bonsmara", "2", "Retiro X", null, 500],
    ["BG", "individual", "2026-08-15", "BBG-EXISTE-1", "Touro Bonsmara", "2", "Retiro X", null, 500], // brinco já existe -> erro
    ["PD", "agregado", "2026-08-15", null, "Boi", "1", "Compra Y", 20, 380],
  ];
  const wsAnimais = XLSX.utils.aoa_to_sheet(animaisAoa);
  XLSX.utils.book_append_sheet(wb, wsAnimais, "Cadastro_Animais");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}

function main() {
  const buffer = montarPlanilhaTeste();
  const { pesagens, animais } = parsePlanilhaImportacao(buffer);
  console.log(`Linhas brutas: ${pesagens.length} pesagens, ${animais.length} cadastros`);

  const ref: ReferenciaCadastro = {
    curralIdPorCodigo: new Map([
      ["2", "curral-2-id"],
      ["1", "curral-1-id"],
    ]),
    categoriaIdPorNome: new Map([
      ["Touro Bonsmara", "cat-touro-id"],
      ["Boi", "cat-boi-id"],
    ]),
    animalIdPorBrinco: new Map([["BBG-EXISTE-1", "animal-existente-id"]]),
  };

  const pesagensValidadas = validarPesagens(pesagens, ref);
  console.log("\n=== Pesagens ===");
  for (const p of pesagensValidadas) {
    console.log(
      `  linha ${p.linha}: brinco="${p.brinco}" curral="${p.curralCodigo}" peso=${p.pesoKg} novo=${p.novoAnimal} -> ${p.erro ? "ERRO: " + p.erro : "OK"}`,
    );
  }

  const animaisValidados = validarAnimaisNovos(animais, ref);
  console.log("\n=== Cadastro_Animais ===");
  for (const a of animaisValidados) {
    console.log(
      `  linha ${a.linha}: tipo=${a.tipoEntrada} brinco="${a.brinco}" qtd=${a.quantidade} -> ${a.erro ? "ERRO: " + a.erro : "OK"}`,
    );
  }

  const esperadoErros = new Map([
    [5, false], // BBG-EXISTE-1 válido
    [6, false], // BBG-NOVO-1 válido (categoria ok)
    [7, true], // categoria inexistente
    [8, true], // curral fantasma
    [9, true], // peso negativo
    [10, true], // brinco vazio
  ]);
  let ok = true;
  for (const p of pesagensValidadas) {
    const esperaErro = esperadoErros.get(p.linha);
    if (esperaErro === undefined) continue;
    const teveErro = p.erro !== null;
    if (teveErro !== esperaErro) {
      ok = false;
      console.log(`  ✗ linha ${p.linha}: esperava erro=${esperaErro}, teve=${teveErro}`);
    }
  }
  console.log(`\nValidação de pesagens: ${ok ? "OK" : "FALHOU"}`);

  const animaisOk =
    animaisValidados.find((a) => a.brinco === "BBG-CADASTRO-1")?.erro === null &&
    animaisValidados.find((a) => a.brinco === "BBG-EXISTE-1")?.erro !== null &&
    animaisValidados.find((a) => a.tipoEntrada === "agregado")?.erro === null;
  console.log(`Validação de cadastro de animais: ${animaisOk ? "OK" : "FALHOU"}`);
}

main();
