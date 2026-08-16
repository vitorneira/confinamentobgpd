import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pdfkit lê as fontes .afm de dentro do próprio pacote via __dirname em
  // runtime. Empacotado (bundled) pelo Turbopack, __dirname vira um caminho
  // falso e o arquivo não é encontrado — por isso o pdfkit precisa ficar de
  // fora do bundle (require normal do Node), como módulo externo.
  serverExternalPackages: ["pdfkit"],
  // ainda precisa ir junto no deploy: sem empacotar, o rastreamento de
  // arquivos da Vercel também não pega esse require dinâmico sozinho.
  outputFileTracingIncludes: {
    "/api/folha-campo": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/venda-recibo": ["./node_modules/pdfkit/js/data/**/*"],
    "/api/guia-trato-folha": ["./node_modules/pdfkit/js/data/**/*"],
  },
};

export default nextConfig;
