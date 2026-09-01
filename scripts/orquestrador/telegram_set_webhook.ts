// Registra a URL do webhook na API do Telegram — roda uma vez, depois que a
// URL pública (preview/produção da Vercel) estiver acessível. Precisa de
// TELEGRAM_BOT_TOKEN e TELEGRAM_WEBHOOK_SECRET no .env.local (o segredo é
// inventado por você, um texto aleatório qualquer — é o que a rota do
// webhook confere no header pra saber que o update é legítimo).
//
// Se a URL for uma preview protegida da Vercel (Deployment Protection),
// passa o bypass como 3º argumento — o Telegram não manda header
// customizado, só dá pra contornar via query string
// (x-vercel-protection-bypass), então ela entra na própria URL registrada.
//
// Uso: tsx scripts/orquestrador/telegram_set_webhook.ts https://seu-preview.vercel.app [bypass-da-vercel]
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const baseUrl = process.argv[2];
  if (!baseUrl) {
    console.error("Uso: tsx scripts/orquestrador/telegram_set_webhook.ts https://seu-preview.vercel.app");
    process.exit(1);
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token || !secret) {
    console.error("Faltam TELEGRAM_BOT_TOKEN e/ou TELEGRAM_WEBHOOK_SECRET no .env.local");
    process.exit(1);
  }

  const bypass = process.argv[3];
  let webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram-webhook`;
  if (bypass) {
    // NUNCA incluir x-vercel-set-bypass-cookie=true aqui: isso faz a Vercel
    // responder 307 (redireciona pra "limpar" a URL depois de setar o
    // cookie) — bom pra navegador, mas o Telegram não segue esse redirect e
    // marca o webhook como quebrado. Só o bypass puro responde 200 direto.
    webhookUrl += `?x-vercel-protection-bypass=${encodeURIComponent(bypass)}`;
  }

  const resp = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message"],
    }),
  });
  const dados = await resp.json();
  console.log(JSON.stringify(dados, null, 2));

  if (dados.ok) {
    console.log(`\nWebhook registrado em ${webhookUrl}`);
  } else {
    console.error("\nFalhou — confere o token e a URL.");
    process.exit(1);
  }
}

main();
