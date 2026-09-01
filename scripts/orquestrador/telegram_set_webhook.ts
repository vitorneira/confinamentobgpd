// Registra a URL do webhook na API do Telegram — roda uma vez, depois que a
// URL pública (preview/produção da Vercel) estiver acessível. Precisa de
// TELEGRAM_BOT_TOKEN e TELEGRAM_WEBHOOK_SECRET no .env.local (o segredo é
// inventado por você, um texto aleatório qualquer — é o que a rota do
// webhook confere no header pra saber que o update é legítimo).
//
// Uso: tsx scripts/orquestrador/telegram_set_webhook.ts https://seu-preview.vercel.app
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

  const webhookUrl = `${baseUrl.replace(/\/$/, "")}/api/telegram-webhook`;

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
