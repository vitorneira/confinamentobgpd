# GROUNDING.md — Norte do Bot (derivado do corpus real)

Este documento traduz as **16.807 mensagens reais** (BG, PD, administrativo) em material que (a) **ensina o classificador** (few-shot + glossário + léxicos) e (b) serve de **conjunto de avaliação** para medir o acerto do agente. Alimenta o prompt do Claude na Fase M1.

---

## 1. Taxonomia (os dois eixos)

**Domínio:** `nutricao_confinamento` · `manutencao_mecanica` · `sanidade` · `defensivos` · `construcao_infra` · `logistica` · `documentos_contratos` · `movimentacao_gado` · `rh_pessoal` · `financeiro` · `outro`

**Intenção:** `abrir_demanda` · `confirmar_fechar` · `registrar_lancar` · `relatar_manejo` · `informacao`

**Fazenda (eixo auxiliar, não faz parte da taxonomia principal):** `BG` · `PD` · `null` — extraída só quando a mensagem citar a fazenda explicitamente (nome ou sigla); nunca adivinhada pelo número do curral, que se repete entre as duas fazendas. Alimenta o valor pré-selecionado na tela de Triagem; sem menção clara, o campo fica vazio pro gestor escolher.

Regras de ouro:
- Só `abrir_demanda` cria OS. `registrar_lancar` cria registro administrativo. `relatar_manejo` e `informacao` **não** geram OS.
- `financeiro` é **fora de escopo** (execução de pagamento) — não gera OS; se ligado a uma compra, vira `solicitacao_pagamento` anexa à OS.
- Mensagem que relata uma **compra concreta de insumo** (preço, quantidade ou fornecedor definidos) é `abrir_demanda` — mesmo em tom de aviso/relato, não só quando pede algo explicitamente. É uma compra real acontecendo, precisa virar OS pra ficar rastreável (custo, entrega, etc.), não só ficar arquivada como informação de bastidor. Diferente de um aviso de logística sem detalhe de compra (ex.: "caminhão carregando, sai em 40 min"), que continua `informacao`.

---

## 2. Exemplos reais rotulados (few-shot + semente do eval)

*Mensagens do corpus, levemente limpas. Formato: mensagem → {domínio, intenção, itens, gera_os}.*

**Sanidade / abrir_demanda**
- "Arruma pra nós por favor: 3 flumax, 2 pacotes de faixas, 6 spray prata" → {sanidade, abrir_demanda, itens:[3 flumax, 2 faixas, 6 spray prata], gera_os:true}
- "Trazer para Barra Grande: 36 atadura, 1 terramin, 4 ganadol" → {sanidade, abrir_demanda, itens:[36 atadura, 1 terramin, 4 ganadol], gera_os:true, fazenda:BG}

**Nutrição/confinamento / abrir_demanda**
- "Está acabando a ração do curral 2, precisa trazer mais" → {nutricao_confinamento, abrir_demanda, ativo:curral 2, gera_os:true}

**Nutrição/confinamento / relatar_manejo** *(NÃO gera OS)*
- "Lote 420kg: 38 animais, média 441,6 kg, consumo 6,6 kg" → {nutricao_confinamento, relatar_manejo, gera_os:false}

**Manutenção / abrir_demanda**
- "O misturador quebrou, precisa arrumar urgente" → {manutencao_mecanica, abrir_demanda, ativo:misturador, gera_os:true}
- "Dois biquinhos da bomba, pega lá com a Paula" → {manutencao_mecanica, abrir_demanda, itens:[2 biquinhos de bomba], gera_os:true}

**Defensivos / abrir_demanda**
- "Precisa comprar mais triclopyr e picloram pro drone" → {defensivos, abrir_demanda, itens:[triclopyr, picloram], gera_os:true}

**Defensivos / confirmar_fechar** *(entrega conferida, com contagem)*
- "Chegou o veneno aqui: cinco baldes e 14 frasquinhos do outro" → {defensivos, confirmar_fechar, gera_os:false, fecha_os:true}

**Nutrição/confinamento / abrir_demanda** *(compra relatada, tom de aviso — não é pedido, mas é compra real)*
- "Hoje vai comprar milho pra fazenda Pau D'Arco, o motorista é o Sr. Francisco e o produtor cobrou R$ 64,50 por saca, umas 35 toneladas ao todo" → {nutricao_confinamento, abrir_demanda, itens:[35 toneladas de milho], gera_os:true, fazenda:PD}

**Logística / informação**
- "O caminhão está carregando na indústria, daqui uns 40 min sai" → {logistica, informacao, gera_os:false}

**Logística / abrir_demanda (reposição)**
- "Está acabando o adubo, o caminhão chega que horas?" → {logistica, abrir_demanda, gera_os:true}

**Construção/infra / abrir_demanda**
- "Boias de bebedouro, ver onde tem" → {construcao_infra, abrir_demanda, itens:[boias de bebedouro], gera_os:true}

**Movimentação de gado / registrar_lancar** *(canal administrativo)*
- "Lança as mortes do Caminho do Lago: 3 cabeças" → {movimentacao_gado, registrar_lancar, gera_os:false, gera_registro:true}
- "Lança no ClickUp a saída do lote 2, 38 animais" → {movimentacao_gado, registrar_lancar, gera_registro:true}

**Documentos/contratos / abrir_demanda**
- "Precisa mandar o contrato de arrendamento pro cartório" → {documentos_contratos, abrir_demanda, gera_os:true}

**RH/pessoal / informação**
- "Peguei folga hoje mas estou na escuta" → {rh_pessoal, informacao, gera_os:false}

**Financeiro / FORA DE ESCOPO**
- "Paga R$ 200 pro fulano, chave PIX ..." → {financeiro, informacao, gera_os:false, fora_escopo:true}
- "A Constanza fez os pagamentos hoje?" → {financeiro, informacao, fora_escopo:true}

**Confirmações genéricas / confirmar_fechar**
- "Já achei, comprei" · "Beleza, positivo" · "Peguei os trens lá no torneiro" → {confirmar_fechar, fecha_os:true}

---

## 3. Léxicos (sinais de intenção)

**Aberturas de demanda:** comprar · manda · precisa/preciso · traz/trazer · arruma · acabou · falta/faltou · pode · organiza · vê se · separa · providencia

**Confirmação/fechamento:** já achei · achei · chegou · comprei · comprado · peguei · beleza · positivo · pronto · entregue · feito

**Lançar/registrar (administrativo):** lança/lançar · registra · dá baixa · morreu/mortes · saiu/saída · entrada · atualiza

---

## 4. Glossário de jargão (para transcrição + classificação)

O modelo `small` erra estes termos; alimentar o STT (`initial_prompt`/glossário) e o classificador com eles.

| Termo | O que é | Domínio |
|---|---|---|
| flumax | anti-inflamatório/antibiótico bovino | sanidade |
| terramin (terramicina) | antibiótico | sanidade |
| ganadol | fortificante vitamínico | sanidade |
| higiene casco | produto para casco | sanidade |
| unguento / spray prata | cicatrizantes | sanidade |
| partomicina · umbicura · triatox · cidental | medicamentos/carrapaticida | sanidade |
| triclopyr (triclopir) · picloram · tordon · calaris · metsulfuron | herbicidas | defensivos |
| adubo (adupa) · ureia | insumos | nutrição/lavoura |
| cocho · curral · piquete · lote · arroba · GMD | manejo/confinamento | nutrição_confinamento |
| misturador (vagão) · biquinho de bomba · rolamento · roseta | peças/mecânica | manutenção |
| GTA · brinco · desmama · apartar | manejo de gado | movimentacao_gado |

---

## 5. Como usar para VALIDAR o agente

1. Rotular à mão ~80–120 mensagens reais (usar as da Seção 2 como semente e ampliar a partir do corpus, cobrindo os 11 domínios e as 5 intenções, incluindo casos-limite: relato de manejo, financeiro, confirmação).
2. Rodar cada uma pelo classificador (Claude Haiku) com estes exemplos como few-shot.
3. Medir acerto de **domínio**, de **intenção** e de **gera_os** (o erro mais caro é confundir `relatar_manejo`/`financeiro` com `abrir_demanda`).
4. Iterar o prompt e o glossário até estabilizar. Só então ligar o Telegram ao vivo (M3).

*Meta prática: acertar `gera_os` e `intenção` na grande maioria; itens podem ser revisados no painel.*
