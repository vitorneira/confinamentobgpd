import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit lê as fontes .afm de dentro do próprio pacote em runtime — o
  // rastreamento de arquivos da Vercel não pega isso sozinho (require dinâmico),
  // então sem isso o /api/folha-campo quebra em produção com ENOENT.
  outputFileTracingIncludes: {
    "/api/folha-campo": ["./node_modules/pdfkit/js/data/**/*"],
  },
};

export default nextConfig;
