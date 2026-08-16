import { gerarFolhaCampoPDF } from "../../src/lib/pesagens/pdf-folha-campo";
import { ordenarPorBrinco } from "../../src/lib/brinco-sort";

// Mesmos brincos de exemplo do dados_originais/geradores/gerar_folha_campo.py
const brincosEx = [
  "BBG 3339", "BBG 3356", "BBG 998", "BBG 1004", "CAB 1227", "CAB 1231",
  "897/24", "930/24", "1615/24", "BGNE 5/24", "BBG 3440", "BBG 3454",
  "BBG 3455", "BBG 3502", "BBG 3384", "BBG 3390", "2004/24", "1892/24",
];

const esperado = [
  "BBG 998", "BBG 1004", "BBG 3339", "BBG 3356", "BBG 3384", "BBG 3390",
  "BBG 3440", "BBG 3454", "BBG 3455", "BBG 3502",
  "BGNE 5/24",
  "CAB 1227", "CAB 1231",
  "897/24", "930/24", "1615/24", "1892/24", "2004/24",
];

async function main() {
  const ordenados = ordenarPorBrinco(brincosEx, (b) => b);
  const bateOrdenacao = JSON.stringify(ordenados) === JSON.stringify(esperado);
  console.log(`Ordenação canônica de brinco: ${bateOrdenacao ? "OK" : "FALHOU"}`);
  if (!bateOrdenacao) {
    console.log("  atual:   ", ordenados.join(", "));
    console.log("  esperado:", esperado.join(", "));
  }

  const pdf = await gerarFolhaCampoPDF({ fazenda: "BG", curral: "2", modo: "individual", brincos: brincosEx });
  console.log(`PDF individual gerado: ${pdf.length > 0 ? "OK" : "FALHOU"} (${pdf.length} bytes)`);

  const pdfAgregado = await gerarFolhaCampoPDF({ fazenda: "PD", curral: "4", modo: "agregado", quantidade: 90 });
  console.log(`PDF agregado gerado: ${pdfAgregado.length > 0 ? "OK" : "FALHOU"} (${pdfAgregado.length} bytes)`);

  if (!bateOrdenacao) process.exit(1);
}
main();
