// Fase M3 — recebe updates do bot do Telegram e alimenta o pipeline de
// ingestão (src/lib/orquestrador/ingest.ts), já testado nas Fases M1/M2.
// Roda como rota do Next.js (não Edge Function do Supabase — o pipeline já
// existe em Node/TS, rodar aqui evita reescrever tudo em Deno pra um
// deployment separado; ver docs/orquestrador/BUILD_PLAN.md M3).
//
// Segurança: Telegram manda o segredo configurado no setWebhook de volta no
// header X-Telegram-Bot-Api-Secret-Token — só aceitamos update se bater
// (CLAUDE.md: nunca confiar em request não autenticado por padrão).
//
// Sempre responde 200 (mesmo em erro interno) pra não entrar em loop de
// retry do Telegram; erro genuíno é logado no servidor, não repassado.
import { NextRequest, NextResponse } from "next/server";
import { ingest } from "@/lib/orquestrador/ingest";
import { processarFotoEstoquePasto } from "@/lib/pastos/ingest_pendente";

const TELEGRAM_API = "https://api.telegram.org";

type TelegramUpdate = {
  message?: {
    message_id: number;
    date: number;
    chat: { id: number; type: string; title?: string };
    from?: { id: number; username?: string; first_name?: string };
    text?: string;
    caption?: string;
    voice?: { file_id: string };
    audio?: { file_id: string };
    document?: { file_id: string; file_name?: string; mime_type?: string };
    photo?: { file_id: string; width: number }[];
  };
};

// Telegram só manda mime_type em `document` (fotos enviadas como "foto"
// comprimida são sempre JPEG); demais tipos de imagem chegam como documento
// com mime_type image/*.
const MEDIA_TYPES_IMAGEM = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type MediaTypeImagem = (typeof MEDIA_TYPES_IMAGEM)[number];

function inferirMediaTypeImagem(mimeType: string | undefined): MediaTypeImagem | null {
  if (!mimeType) return null;
  return (MEDIA_TYPES_IMAGEM as readonly string[]).includes(mimeType) ? (mimeType as MediaTypeImagem) : null;
}

// Roteamento explícito por legenda (decisão do dono, 2026-09-02): mais
// confiável que deixar a IA adivinhar se a foto é estoque por pasto ou uma
// lista/estoque qualquer. "estoque" no começo da legenda, opcionalmente
// seguido do código da fazenda (ex.: "estoque BG").
function ehLegendaEstoquePasto(caption: string | undefined): boolean {
  return !!caption && caption.trim().toLowerCase().startsWith("estoque");
}

function extrairFazendaDaLegenda(caption: string | undefined): "BG" | "PD" | null {
  if (!caption) return null;
  const upper = caption.toUpperCase();
  if (/\bBG\b/.test(upper)) return "BG";
  if (/\bPD\b/.test(upper)) return "PD";
  return null;
}

function nomeRemetente(msg: NonNullable<TelegramUpdate["message"]>): string {
  const nome = msg.from?.username ?? msg.from?.first_name ?? "desconhecido";
  return msg.chat.type !== "private" && msg.chat.title ? `${nome} (${msg.chat.title})` : nome;
}

async function baixarArquivoTelegram(fileId: string, botToken: string): Promise<{ bytes: Uint8Array; nomeArquivo: string }> {
  const infoResp = await fetch(`${TELEGRAM_API}/bot${botToken}/getFile?file_id=${fileId}`);
  if (!infoResp.ok) throw new Error(`getFile falhou: ${infoResp.status}`);
  const info = await infoResp.json();
  const filePath: string = info.result.file_path;

  const arquivoResp = await fetch(`${TELEGRAM_API}/file/bot${botToken}/${filePath}`);
  if (!arquivoResp.ok) throw new Error(`download de arquivo falhou: ${arquivoResp.status}`);
  const bytes = new Uint8Array(await arquivoResp.arrayBuffer());
  return { bytes, nomeArquivo: filePath.split("/").pop() ?? "audio.ogg" };
}

export async function POST(request: NextRequest) {
  const segredoEsperado = process.env.TELEGRAM_WEBHOOK_SECRET;
  const segredoRecebido = request.headers.get("x-telegram-bot-api-secret-token");
  if (!segredoEsperado || segredoRecebido !== segredoEsperado) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    console.error("telegram-webhook: TELEGRAM_BOT_TOKEN não configurada");
    return NextResponse.json({ ok: true }); // 200 pro Telegram não ficar retentando por config faltando
  }

  const update = (await request.json()) as TelegramUpdate;
  const msg = update.message;
  if (!msg) return NextResponse.json({ ok: true }); // edited_message, callback_query etc. — ignorado por ora

  const mensagemId = `telegram-${msg.chat.id}-${msg.message_id}`;
  const remetente = nomeRemetente(msg);

  try {
    if (msg.text) {
      await ingest({ id: mensagemId, canal: "telegram", remetente, tipo: "texto", conteudoBruto: msg.text });
    } else if (msg.voice || msg.audio) {
      const fileId = (msg.voice ?? msg.audio)!.file_id;
      const audio = await baixarArquivoTelegram(fileId, botToken);
      await ingest({ id: mensagemId, canal: "telegram", remetente, tipo: "audio", audio });
    } else if (msg.photo || inferirMediaTypeImagem(msg.document?.mime_type)) {
      // Fase M3 (ajuste) — foto: duas rotas.
      // - Legenda "estoque..." -> fluxo estruturado próprio (src/lib/pastos),
      //   gera pendência em pasto_estoque_pendente pra conferência em
      //   /[fazenda]/pastos (não passa pelo Orquestrador).
      // - Qualquer outra foto (lista de compras etc.) -> descreve via visão
      //   genérica (visao.ts) e cai no mesmo pipeline de classificação do
      //   texto/Triagem. Pesagem por foto/PDF é escopo futuro — não passa
      //   por nenhuma das duas rotas ainda.
      const fileId = msg.photo ? msg.photo[msg.photo.length - 1].file_id : msg.document!.file_id;
      const mediaType = msg.photo ? "image/jpeg" : inferirMediaTypeImagem(msg.document!.mime_type)!;
      const { bytes } = await baixarArquivoTelegram(fileId, botToken);

      if (ehLegendaEstoquePasto(msg.caption)) {
        const resultado = await processarFotoEstoquePasto({
          mensagemId,
          imagem: { bytes, mediaType },
          remetente,
          fazendaCodigoDetectada: extrairFazendaDaLegenda(msg.caption),
        });
        if (!resultado.ok) {
          console.error("telegram-webhook: falha ao processar estoque por pasto", mensagemId, resultado.erro);
        }
      } else {
        await ingest({
          id: mensagemId,
          canal: "telegram",
          remetente,
          tipo: "imagem",
          conteudoBruto: msg.caption,
          imagem: { bytes, mediaType },
        });
      }
    } else if (msg.document) {
      // Documento não-imagem (PDF etc.) — sem extração ainda (pesagem por
      // PDF é fase futura). Grava a mensagem (com legenda, se tiver) pra não
      // perder o registro; sem texto pra classificar, o ingest() só arquiva.
      await ingest({
        id: mensagemId,
        canal: "telegram",
        remetente,
        tipo: "documento",
        conteudoBruto: msg.caption,
      });
    }
  } catch (err) {
    console.error("telegram-webhook: falha ao processar update", mensagemId, err);
  }

  return NextResponse.json({ ok: true });
}
