# Pacote de prompt — Sistema de Gestão de Confinamento

Contexto estruturado para construir o webapp com o Claude Code seguindo boas práticas
(contexto em arquivos + plano antes de código + etapas verificáveis + revisão do dono).
Esta versão já incorpora **toda a revisão de KPIs** feita camada a camada.

## Como usar

1. Abra o **Claude Code** na pasta do projeto.
2. Coloque na **raiz** do projeto:
   - `CLAUDE.md`  ← o Code lê automaticamente
   - `SPEC.md`, `DATA_MODEL.md`, `BUILD_PLAN.md`
3. Crie `dados_originais/` e copie para lá:
   - `Confinamento_BG_-_Base_de_Dados.xlsx`
   - `Confinamento_PD_-_Base_de_Dados.xlsx`
   - `Guia_de_Trato_e_Vagao_-_Pau_DArco.xlsx`
   - a subpasta `geradores/` (scripts de referência da folha de campo e da
     planilha-modelo, com a ordenação canônica de brinco)
4. Copie o texto de `PROMPT_INICIAL.md` como a **primeira mensagem** no Code.
5. Trabalhe **uma etapa por vez** do `BUILD_PLAN.md`, revisando cada uma.

## Artefatos de entrada de dados (já prontos)
- `Modelo_Importacao_Confinamento.xlsx` — planilha que o Cowork preenche e você sobe
  no sistema (abas Pesagens e Cadastro_Animais, com validações).
- `Folha_Campo_Individual_exemplo.pdf` e `Folha_Campo_Agregado_exemplo.pdf` —
  exemplos da folha que o sistema vai gerar para o campo imprimir e anotar.
- `geradores/gerar_modelo_importacao.py` e `geradores/gerar_folha_campo.py` — os
  scripts que produzem os dois acima; servem de referência para o Code reproduzir o
  comportamento (inclusive a regra de ordenação de brinco).

## Os arquivos do pacote
| Arquivo | Para que serve |
|---|---|
| `PROMPT_INICIAL.md` | Texto para a 1ª mensagem do Code |
| `CLAUDE.md` | Regras do projeto + **decisões de domínio fechadas** (o Code carrega sozinho) |
| `SPEC.md` | Telas e funcionalidades |
| `DATA_MODEL.md` | Modelo de dados revisado |
| `BUILD_PLAN.md` | Ordem de construção em 10 etapas |

## Por que assim
- **Contexto em arquivos**: o Code relê as regras e não "esquece" as decisões.
- **Plano antes de código**: você revisa a direção antes de gastar tempo.
- **Etapas verificáveis**: cada uma bate com as planilhas originais (regressão).
- **Você no controle**: o Code só avança com sua aprovação.

> Ao mudar algo no futuro, edite `SPEC.md`/`CLAUDE.md` primeiro e peça ao Code para
> reler — a fonte da verdade fica nos arquivos, não perdida na conversa.
