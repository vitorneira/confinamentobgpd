# BUILD_PLAN.md — Plano de Construção (v2 · MVP primeiro)

Foco: entregar e validar o **MVP** antes de tudo. Autorização, pagamento, reconciliação e **migração do ClickUp** ficam para depois. Mostrar o plano antes de codar cada fase.

---

# PARTE 1 — MVP: "da mensagem à OS visível"

**Objetivo do MVP:** provar que uma mensagem de WhatsApp (voz ou texto) vira uma OS ou registro estruturado, visível e gerenciável num painel. Sem aprovação, pagamento, reconciliação ou ClickUp.

## Fase M0 — Fundação mínima
1. Inspecionar o schema atual e **reaproveitar** fazenda, usuário e o junction de acesso (não recriar).
2. Criar apenas as tabelas do MVP (aditivas, `tenant_id` + RLS): `os`, `mensagem`, `registro_admin`, e o master data `fornecedor`, `ativo`, `local`, `item_catalogo` — **com FKs opcionais** (uma OS pode nascer sem fornecedor/ativo).
3. Sequência de IDs `BG/PD-####` por fazenda (numeração nova por ora; conciliar com o ClickUp só na migração).
4. **Sem importação do ClickUp.** Master data semeado manualmente com poucos registros ou criado sob demanda.

**Pronto quando:** as tabelas existem, a RLS funciona por fazenda, dá para criar uma OS manualmente.

## Fase M1 — Pipeline de ingestão + classificação (validável offline)
1. Função que recebe uma mensagem (texto ou áudio). No MVP, entrada por **input manual** (colar texto / subir áudio) e/ou **reprocessar o corpus já transcrito** que temos.
2. Transcrição (Groq/Whisper `medium` + glossário de jargão).
3. Classificação via Claude (Haiku): domínio × intenção + extração de itens ("quantidade + item cru").
4. Cria `os` (se `abrir_demanda`) ou `registro_admin` (se `registrar_lancar`). Idempotência por id de mensagem.
5. **Validar a qualidade** contra as mensagens reais (ver `GROUNDING.md`): usar os exemplos rotulados como few-shot e o conjunto de avaliação para medir acerto de domínio/intenção/gera_os.

**Pronto quando:** um áudio real vira OS estruturada; um texto administrativo vira registro; a classificação acerta a maioria no corpus real; nada duplica.

## Fase M2 — Painel do orquestrador (leitura + estado básico)
1. Fila unificada, filtrável por fazenda / status / domínio / responsável.
2. Criar/editar OS também pelo painel (não só por mensagem).
3. Ciclo de vida **simples** no MVP: `aberta -> conferida` / `cancelada`.

**Pronto quando:** dá para ver, filtrar e fechar OS no painel.

## Fase M3 — Telegram ao vivo
1. Criar o bot (@BotFather) e apontar o webhook para a Edge Function do Supabase (ver `SETUP_TELEGRAM.md`).
2. Conectar o pipeline da M1 ao canal real; baixar áudios/arquivos pela API do Telegram; ligar botões inline para ações.
3. Adicionar o bot ao grupo de notas fiscais (privacy mode off) — o Telegram lê grupos, ao contrário do WhatsApp.

**Pronto quando:** uma mensagem real chega pelo Telegram e vira OS/registro no painel. **<- fim do MVP.**

*(WhatsApp não está descartado — entra em fase futura via os dois modos de ingestão; por ora, tudo no Telegram.)*

---

# PARTE 2 — Pós-MVP (incrementos, um por vez)

## P1 — Ciclo de OS completo + documentos
Máquina de estados completa; confirmação de entrega amarrada ao item (foto + contagem); detector de pendências reais; upload de documentos (Supabase Storage), incluindo o fluxo do "grupo" de notas.

## P2 — Autorização do dono
Checkbox "Autorização do dono" + `dono_designado`; push via template do WhatsApp; **cadeia de escalonamento** (sócio escolhido -> outro sócio -> orquestrador; prazo ~4h úteis/etapa, configurável); trilha auditável.

## P3 — Solicitação de pagamento (handoff ao Connecterra)
Geração de `solicitacao_pagamento` (`favorecido / chave PIX / valor / descrição`) a partir da OS aprovada; envio ao registrador/Connecterra (mensagem estruturada; API se houver); status `pago` de volta; RLS restrita + logs para o dado sensível. **Não executa pagamento.**

## P4 — Registro administrativo completo
Estruturar mortes, movimentações, documentos e contratos; separação automática financeiro (fora) x registro (dentro); ligações com rebanho/áreas.

## P5 — Reconciliação + reposição
Alertas lendo o confinamento (preço na faixa? estoque x consumo?); estoque mínimo -> sugestão de reposição; sugestão automática de marcar "Autorização do dono" quando foge do padrão.

## P6 — Migração do ClickUp *(penúltima fase)*
Importar OS históricas, fornecedores e ativos (API/CSV) -> tabelas do sistema; documentos -> Storage. Conciliar a numeração `BG/PD-####`. Estratégia: ativo primeiro, histórico "frio" depois. Ao final, **desligar o ClickUp** como fonte da verdade.

## P7 — (Futuro) Produto
Multi-tenant ativo, onboarding self-service, configuração por cliente, LGPD. Só após validação com clientes reais.

---

# Cadastro de Funcionário + Documentos de Pagamento (Etapa B)

Trilha independente das P1-P7 (não bloqueia nem é bloqueada por elas). Cadastro
próprio de funcionários/diaristas das fazendas — **separado** de `fornecedor` e
`prestador_servico` (que continuam só para compras/serviços de OS). Objetivo:
receber holerite/recibo/comprovante de pagamento pelo bot do Telegram, a IA
separa por funcionário e arquiva; humano confirma o que a IA não reconhecer.
Desenhado numa sessão de grilling com o dono em 2026-09-04; decisões abaixo já
fechadas, não reabrir sem avisar.

**Decisões fechadas:**
- Só arquivamento — a IA **não** extrai valor em R$ dos documentos. Virar
  "custo de mão de obra" é decisão de domínio nova, fica para uma etapa futura
  deliberada à parte.
- Só o dono envia documentos ao bot por enquanto.
- Visibilidade: dono vê tudo; gestor de cada fazenda vê só os documentos dos
  funcionários da fazenda dele.
- Fluxo de envio no Telegram: **arquivo(s) primeiro, texto explicativo depois**
  (ex.: "holerites funcionários PD"), nunca legenda anexada ao arquivo —
  roteamento por palavra-chave no texto (holerite/recibo/comprovante), mesma
  lógica de janela-por-remetente já usada para agrupar áudio fragmentado.
- Formatos reais: holerite = 1 PDF por fazenda (várias páginas, 1 funcionário
  por página); recibo = 1 PDF cobrindo as duas fazendas; comprovante = 1 PDF
  por pessoa.
- Fazenda de cada documento: vem do texto quando o arquivo já é por fazenda
  (holerite); vem do cadastro do funcionário já casado por nome quando o
  arquivo mistura fazendas (recibo/comprovante).
- Competência (mês/ano) extraída pela IA de dentro do documento, nunca da data
  de envio; corrigível na tela de pendência.
- Reenvio do mesmo documento nunca sobrescreve — guarda as duas versões,
  mostra a mais recente em destaque.
- Storage guarda o PDF/lote original completo **e** o recorte individual por
  funcionário.
- Funcionário não reconhecido pela IA: a tela de pendência permite cadastrar
  na hora, sem sair da tela, e já vincular o documento.
- Upload manual pela web também é possível (mesmo formulário da tela de
  pendência), como alternativa se o bot falhar.

## FB1 — Cadastro de funcionário + Storage
- Tabela `funcionario`: nome_completo (para casamento por IA), apelido,
  fazenda_id, tipo (fixo/diarista), cargo, ativo, data_admissao. Tenant + RLS
  (dono vê tudo; gestor só da fazenda dele).
- Primeira integração real de Supabase Storage do projeto (hoje não existe
  nenhuma — fotos de pasto/estoque são descartadas após a extração). Bucket
  para documentos de funcionário, guardando original completo + recorte
  individual, nunca sobrescrevendo versões.
- Tela `/funcionarios`: lista (filtro por fazenda, busca por nome) → detalhe
  com histórico de documentos por mês/tipo. Formulário de upload manual.
- **Pronto quando:** cadastro um funcionário, subo um documento manual pela
  tela, e ele aparece no histórico dele.

## FB2 — Ingestão via Telegram
- Webhook ganha o padrão de agrupamento N-arquivos + 1-texto-depois, roteado
  por palavra-chave.
- Extração por IA (visão, mesma família de `pastos/extracao.ts`) separa o PDF
  por funcionário, casa pelo nome contra o cadastro, extrai a competência.
- Sem extração de valor em R$ nesta etapa.
- **Pronto quando:** mando um holerite real de teste pro bot e ele aparece
  vinculado ao funcionário certo com a competência certa (ou cai em
  pendência se não bater).

## FB3 — Tela de pendência
- Tela própria (não a Triagem de OS): nome não encontrado, competência não
  lida, ou ambiguidade. Permite cadastrar o funcionário ali mesmo e já
  vincular o documento pendente.
- **Pronto quando:** mando um documento de alguém não cadastrado e resolvo a
  pendência (cadastro + vínculo) sem sair da tela.
