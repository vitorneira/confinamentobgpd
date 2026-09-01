// Mostra o status atual do webhook (URL registrada, updates pendentes,
// último erro reportado pelo Telegram) — útil pra depurar sem ficar
// adivinhando. Uso: tsx scripts/orquestrador/telegram_webhook_info.ts
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("Falta TELEGRAM_BOT_TOKEN no .env.local");
    process.exit(1);
  }
  const resp = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
  console.log(JSON.stringify(await resp.json(), null, 2));
}

main();
