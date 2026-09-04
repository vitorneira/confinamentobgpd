# SETUP_TELEGRAM.md — Canal do MVP (Telegram)

O MVP usa o **Telegram Bot API** como canal. É gratuito, sem BSP, sem verificação, e resolve nativamente o grupo de NFs e o problema de responder pelo desktop. WhatsApp fica para uma fase futura (a arquitetura de dois modos de ingestão já o comporta).

## Por que Telegram no MVP

- **Gratuito e sem burocracia:** cria o bot no @BotFather em minutos; sem taxa por mensagem, sem janela de 24h.
- **Grupos funcionam:** o bot entra no grupo de notas fiscais e lê as mensagens (com privacy mode desligado ou como admin) — o que o WhatsApp não fazia.
- **Sem problema de desktop:** o bot é uma entidade na conversa, não um dispositivo vinculado; você responde de qualquer cliente (celular, Desktop, Web) e o bot enxerga.
- **UX de aprovação nativa:** botões inline ("✅ Aprovar / ❌ Reprovar") para o portão dos donos.
- **Voz e arquivos:** o bot baixa áudios/PDFs/fotos direto pela API (limite 20 MB por arquivo na API padrão; 2 GB com servidor local — áudios de conversa são pequenos).

## Passo a passo

1. **Criar o bot:** no Telegram, fale com **@BotFather** → `/newbot` → nome e @username → guarde o **token** (é a credencial da API; tratar como segredo).
2. **Configurar comportamento:**
   - `/setprivacy` → **Disable** (para o bot ler todas as mensagens de grupo, não só menções) — necessário para o grupo de NFs.
   - `/setjoingroups` → **Enable** (permitir adicionar o bot a grupos).
3. **Webhook:** apontar o bot para uma **Edge Function do Supabase** (`setWebhook` com a URL HTTPS da função). É o que faz as mensagens caírem no sistema.
4. **Ingestão:** a Edge Function recebe o update → se áudio, baixa o arquivo (`getFile`) e transcreve (Groq/Whisper `medium` + glossário do GROUNDING.md) → classifica (Claude) → cria OS ou registro.
5. **Grupos:** adicionar o bot ao(s) grupo(s) que devem ser lidos (ex.: o das notas fiscais). Como admin, se quiser capturar tudo.
6. **Ações de volta:** o bot responde no Telegram (mensagens + botões inline). O painel do orquestrador também envia pela API — é a sua tela de trabalho no lugar do WhatsApp Desktop.

## Observações

- **Segredo:** o token do bot fica em variável de ambiente, nunca no código versionado.
- **Histórico:** o bot só recebe mensagens **depois** de entrar na conversa/grupo — o fluxo daqui pra frente. O corpus histórico já transcrito serve para validar/treinar (ver GROUNDING.md), não para importação em tempo real.
- **Rate limits** (30 msg/s global, 20/min por grupo) são muito acima do volume de vocês.
- **Adoção:** o ponto sensível continua sendo levar os participantes ao Telegram. Comece pelo núcleo (você, donos, administrativo) e teste com um gerente de campo antes de generalizar.
