// Orquestra a ingestão de holerite/recibo/comprovante vindos do bot do
// Telegram (chamado por route.ts). Fluxo em duas mensagens (decidido na
// sessão de grilling, 2026-09-04): o(s) PDF(s) chegam primeiro e ficam em
// staging (estagiarUploadFuncionario); só quando o texto com a palavra-chave
// chega depois é que são reivindicados e processados
// (processarTextoFuncionario) — mesmo espírito de "humano no circuito" do
// resto do projeto, mas aqui quem "confirma o lote" ao escrever a legenda é
// o próprio dono, não uma tela.
import { supabaseServico } from "@/lib/orquestrador/supabase-servico";
import { extrairDocumentoFuncionario } from "./extracao";
import { recortarPaginas } from "./pdf";
import { casarFuncionarioPorNome, type FuncionarioParaCasamento } from "./casamento";
import type { TipoDocumento } from "@/lib/queries/funcionarios";

const BUCKET = "funcionario-documentos";
const JANELA_PADRAO_MINUTOS = 30;

export async function estagiarUploadFuncionario(params: { mensagemId: string; remetente: string; bytes: Uint8Array }): Promise<void> {
  const existente = await supabaseServico.from("funcionario_upload_bruto").select("id").eq("mensagem_id", params.mensagemId).maybeSingle();
  if (existente.data) return; // já staged — idempotência (Telegram pode reenviar o mesmo update)

  const caminho = `_pendente/${params.mensagemId}.pdf`;
  const { error: erroUpload } = await supabaseServico.storage.from(BUCKET).upload(caminho, params.bytes, { contentType: "application/pdf" });
  if (erroUpload) {
    console.error("funcionarios/ingest: falha ao subir PDF pro staging", params.mensagemId, erroUpload);
    return;
  }

  const { error } = await supabaseServico.from("funcionario_upload_bruto").insert({
    mensagem_id: params.mensagemId,
    remetente: params.remetente,
    storage_path: caminho,
    mime_type: "application/pdf",
  });
  if (error) console.error("funcionarios/ingest: falha ao gravar staging", params.mensagemId, error);
}

type LinhaFazenda = { codigo: string } | { codigo: string }[] | null;

function codigoDaFazenda(fazendas: LinhaFazenda): string {
  return (Array.isArray(fazendas) ? fazendas[0] : fazendas)?.codigo ?? "XX";
}

// Comprovante (recibo bancário) normalmente não imprime "competência", só a
// data do pagamento — e o pagamento sempre sai no mês seguinte ao trabalhado
// (5º dia útil, confirmado pelo dono). Holerite já imprime a competência
// direto; essa derivação vale só pra comprovante.
function competenciaAPartirDoPagamento(dataPagamento: string): string {
  const [ano, mes] = dataPagamento.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 2, 1)); // mês do pagamento (mes-1, 0-based) menos 1 mês
  return data.toISOString().slice(0, 10);
}

function resolverCompetencia(tipo: TipoDocumento, competencia: string | null, dataPagamento: string | null): string | null {
  if (competencia) return competencia;
  if (tipo === "comprovante" && dataPagamento) return competenciaAPartirDoPagamento(dataPagamento);
  return null;
}

export async function processarTextoFuncionario(params: {
  tipo: TipoDocumento;
  remetente: string;
  fazendaSugerida: "BG" | "PD" | null;
}): Promise<{ processados: number }> {
  const desde = new Date(Date.now() - JANELA_PADRAO_MINUTOS * 60_000).toISOString();

  const { data: pendentes, error: erroPendentes } = await supabaseServico
    .from("funcionario_upload_bruto")
    .select("id, storage_path")
    .eq("remetente", params.remetente)
    .eq("reivindicado", false)
    .gte("recebido_em", desde)
    .order("recebido_em", { ascending: true });
  if (erroPendentes) throw erroPendentes;
  if (!pendentes || pendentes.length === 0) return { processados: 0 };

  // Reivindica já, pra não processar duas vezes se o Telegram reenviar o update do texto.
  await supabaseServico
    .from("funcionario_upload_bruto")
    .update({ reivindicado: true })
    .in(
      "id",
      pendentes.map((p) => p.id),
    );

  let queryFuncionarios = supabaseServico.from("funcionario").select("id, nome_completo, apelido, fazenda_id, fazendas(codigo)");
  if (params.fazendaSugerida) {
    const { data: fazenda } = await supabaseServico.from("fazendas").select("id").eq("codigo", params.fazendaSugerida).maybeSingle();
    if (fazenda) queryFuncionarios = queryFuncionarios.eq("fazenda_id", fazenda.id);
  }
  const { data: funcionariosRaw } = await queryFuncionarios;
  const funcionarios = (funcionariosRaw ?? []) as unknown as (FuncionarioParaCasamento & { fazendas: LinhaFazenda })[];

  const prefixoOriginal = params.fazendaSugerida ? `${params.fazendaSugerida}/_lotes` : "_ambas";

  let processados = 0;
  for (const pendente of pendentes) {
    const { data: arquivo, error: erroDownload } = await supabaseServico.storage.from(BUCKET).download(pendente.storage_path);
    if (erroDownload || !arquivo) {
      console.error("funcionarios/ingest: falha ao baixar PDF staged", pendente.storage_path, erroDownload);
      continue;
    }
    const bytes = new Uint8Array(await arquivo.arrayBuffer());

    let pessoas;
    try {
      pessoas = await extrairDocumentoFuncionario(bytes);
    } catch (erroExtracao) {
      console.error("funcionarios/ingest: falha na extração", pendente.storage_path, erroExtracao);
      continue;
    }
    if (pessoas.length === 0) continue;

    const caminhoOriginal = `${prefixoOriginal}/${pendente.id}.pdf`;
    const { error: erroUploadOriginal } = await supabaseServico.storage.from(BUCKET).upload(caminhoOriginal, bytes, { contentType: "application/pdf" });
    if (erroUploadOriginal) {
      // Sem o original salvo, tanto o registro final quanto a pendência
      // ficariam apontando pra um arquivo inexistente (referência órfã) —
      // melhor pular o pendente inteiro do que gravar um caminho quebrado.
      console.error("funcionarios/ingest: falha ao subir PDF original", caminhoOriginal, erroUploadOriginal);
      continue;
    }

    for (const pessoa of pessoas) {
      const recorte = await recortarPaginas(bytes, pessoa.paginaInicio, pessoa.paginaFim);
      const casamento = casarFuncionarioPorNome(pessoa.nomeNoDocumento, funcionarios);
      const competencia = resolverCompetencia(params.tipo, pessoa.competencia, pessoa.dataPagamento);

      if (casamento.status === "unico" && competencia) {
        const funcionario = funcionarios.find((f) => f.id === casamento.funcionarioId)!;
        const codigo = codigoDaFazenda(funcionario.fazendas);

        const { data: existentes } = await supabaseServico
          .from("funcionario_documento")
          .select("versao")
          .eq("funcionario_id", funcionario.id)
          .eq("tipo", params.tipo)
          .eq("competencia", competencia)
          .order("versao", { ascending: false })
          .limit(1);
        const versao = (existentes?.[0]?.versao ?? 0) + 1;
        const caminhoIndividual = `${codigo}/${funcionario.id}/${params.tipo}_${competencia.slice(0, 7)}_v${versao}.pdf`;

        const { error: erroUploadIndividual } = await supabaseServico.storage.from(BUCKET).upload(caminhoIndividual, recorte, { contentType: "application/pdf" });
        if (erroUploadIndividual) {
          console.error("funcionarios/ingest: falha ao subir recorte individual", caminhoIndividual, erroUploadIndividual);
          continue;
        }
        const { error: erroInsert } = await supabaseServico.from("funcionario_documento").insert({
          funcionario_id: funcionario.id,
          tipo: params.tipo,
          competencia,
          storage_path_original: caminhoOriginal,
          storage_path_individual: caminhoIndividual,
          versao,
          origem: "telegram",
        });
        if (erroInsert) console.error("funcionarios/ingest: falha ao gravar documento", pessoa.nomeNoDocumento, erroInsert);
      } else {
        // Prioriza reportar o problema de nome (mais fundamental — sem saber
        // de quem é, a competência não ajuda) sobre o de competência.
        const motivo =
          casamento.status === "ambiguo" ? "nome_ambiguo" : casamento.status === "nenhum" ? "nome_nao_encontrado" : "competencia_nao_lida";
        const caminhoIndividual = `_pendente/${pendente.id}_p${pessoa.paginaInicio}.pdf`;

        const { error: erroUploadIndividual } = await supabaseServico.storage.from(BUCKET).upload(caminhoIndividual, recorte, { contentType: "application/pdf" });
        if (erroUploadIndividual) {
          console.error("funcionarios/ingest: falha ao subir recorte individual", caminhoIndividual, erroUploadIndividual);
          continue;
        }
        const { error: erroInsert } = await supabaseServico.from("funcionario_documento_pendente").insert({
          upload_bruto_id: pendente.id,
          tipo: params.tipo,
          nome_extraido: pessoa.nomeNoDocumento,
          competencia_extraida: competencia,
          fazenda_sugerida: params.fazendaSugerida,
          storage_path_original: caminhoOriginal,
          storage_path_individual: caminhoIndividual,
          motivo,
        });
        if (erroInsert) console.error("funcionarios/ingest: falha ao gravar pendência", pessoa.nomeNoDocumento, erroInsert);
      }
    }
    processados++;
  }

  return { processados };
}

const PALAVRA_CHAVE_TIPO: { regex: RegExp; tipo: TipoDocumento }[] = [
  { regex: /^\s*holerites?\b/i, tipo: "holerite" },
  { regex: /^\s*recibos?\b/i, tipo: "recibo" },
  { regex: /^\s*comprovantes?\b/i, tipo: "comprovante" },
];

export function detectarTipoDocumentoFuncionario(texto: string): TipoDocumento | null {
  const encontrado = PALAVRA_CHAVE_TIPO.find((p) => p.regex.test(texto));
  return encontrado?.tipo ?? null;
}
