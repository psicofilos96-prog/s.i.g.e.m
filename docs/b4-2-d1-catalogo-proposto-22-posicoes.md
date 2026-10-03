# B4.2 — Pacote de homologação D1: catálogo proposto de 22 posições individuais

**Status do documento: PROPOSTA, NÃO HOMOLOGADA.** Pacote somente documental. Nada aqui foi cadastrado em catálogo, banco, política ou código; nenhum dado foi semeado; nenhum deploy. Os IDs técnicos abaixo são **sugestões** para a autoridade do catálogo e não constituem norma aprovada.

## 1. Fonte

- Deliberação CME nº 3/2026 (Itaperuna), arts. 1º–2º, Anexos I–V.
- Arquivo conferido diretamente pelo **Codex** no PDF oficial fornecido pelo usuário: SHA-256 `d8f46e61a655f515d758c58ccb7715d3976c5ee347efc9a0d7e7e3f385fe0b02`.
- Localização (página do PDF): p. 2 = Anexo I; p. 3 = Anexo II; p. 4 = Anexo III; p. 5 = Anexo IV; p. 6 = Anexo V.
- O Lovable não abriu o PDF; a conferência textual é do Codex e **não equivale a homologação**.

**Vigência:** não declarada neste pacote. O art. 2º vincula a vigência à **publicação**, e a data de publicação **não foi comprovada**. A data 1/4 **não** deve ser usada como vigência. Fica pendente a prova da publicação (veículo, data, edição).

## 2. Esquema candidato único

| Item | Proposta |
|---|---|
| Esquema da posição individual | `posicao-curricular-individual` (candidato) |
| Onde é usado | eixo da posição curricular B3.3 da **alocação do estudante** |
| Regex do catálogo | `^[a-z0-9][a-z0-9-]*$` — todos os IDs abaixo conferem |
| Status | proposta, não homologada |

**Modalidade/segmento/etapa** não viram campo do esquema nem atributo inferido da turma. São **derivação versionada da correspondência E3** (posição → matriz lógica + coluna do anexo): o anexo de destino de cada correspondência homologada indica a etapa/modalidade, com ato e vigência próprios. Isso responde R2 como proposta técnica (derivação), sujeita a aprovação.

## 3. Os 22 valores propostos

Todos: **status = proposta, não homologada**; versão do valor sugerida = 1 quando cadastrado.

| # | ID técnico candidato | Rótulo exato | Anexo | Página PDF |
|---|---|---|---|---|
| 1 | `bercario` | Berçário | I | 2 |
| 2 | `maternal` | Maternal | I | 2 |
| 3 | `1-periodo` | 1º Período | I | 2 |
| 4 | `2-periodo` | 2º Período | I | 2 |
| 5 | `1-ano` | 1º ano | II | 3 |
| 6 | `2-ano` | 2º ano | II | 3 |
| 7 | `3-ano` | 3º ano | II | 3 |
| 8 | `4-ano` | 4º ano | II | 3 |
| 9 | `5-ano` | 5º ano | II | 3 |
| 10 | `6-ano` | 6º ano | III | 4 |
| 11 | `7-ano` | 7º ano | III | 4 |
| 12 | `8-ano` | 8º ano | III | 4 |
| 13 | `9-ano` | 9º ano | III | 4 |
| 14 | `fase-i` | Fase I | IV | 5 |
| 15 | `fase-ii` | Fase II | IV | 5 |
| 16 | `fase-iii` | Fase III | IV | 5 |
| 17 | `fase-iv` | Fase IV | IV | 5 |
| 18 | `fase-v` | Fase V | IV | 5 |
| 19 | `fase-vi` | Fase VI | V | 6 |
| 20 | `fase-vii` | Fase VII | V | 6 |
| 21 | `fase-viii` | Fase VIII | V | 6 |
| 22 | `fase-ix` | Fase IX | V | 6 |

Total 4 + 5 + 4 + 5 + 4 = **22**. Os IDs não carregam etapa/modalidade de propósito (ver seção 2). Os rótulos seguem a grafia indicada na conferência; a forma tipográfica final (ex.: "1º Ano" × "1º ano") deve ser confirmada contra o PDF no ato de homologação.

## 4. O que NÃO é valor deste esquema

- **TEC/multisseriada**: não é valor adicional. Cada estudante recebe uma das 22 posições; a turma reúne várias.
- **"EI unificada"**: rótulo operacional, não valor. Cada criança mantém Berçário, Maternal, 1º ou 2º Período.
- **AEE** e **atividade complementar**: naturezas da oferta/turma, **fora** do esquema de posição. AEE não é etapa. Oferta composta (ex.: curricular com atividade complementar, conforme Censo 2026) é tratada no eixo de natureza (E2), com tratamento institucional próprio se homologada.
- **Jornada parcial/integral (Anexo I)**: dimensão distinta, não valor deste esquema; decisão R3 pendente.
- Rótulos do Censo, diários ou nomes de turma não criam valores.

## 5. Faltas para homologar e cadastrar

| # | Falta | Tipo | Bloqueia |
|---|---|---|---|
| F1 | Comprovação da publicação da Deliberação (data, veículo) para fixar vigência | dado/ato documental | vigência de valores e correspondências |
| F2 | Ato de aprovação do esquema `posicao-curricular-individual` e dos 22 valores (R1), com IDs definitivos escolhidos pela autoridade do catálogo | ato institucional | cadastro |
| F3 | Cadastro pelo writer do catálogo B2.6 com `manter-catalogos-institucionais`, por quem detém a capability | operação autorizada | uso na B3.3 |
| F4 | Homologação da política de capacidades v2 (hoje draft) | ato institucional | qualquer escrita com sessão |
| F5 | Decisão R2 (derivação via correspondência, proposta aqui) | decisão técnica/institucional | leitura de etapa/modalidade |
| F6 | Decisão R3 (jornada na EI) | institucional | correspondência do Anexo I |
| F7 | Matrizes B4.1 dos Anexos I–V construídas pela Supervisão e homologadas (E1) | ato + dado | correspondência E3 |
| F8 | Competência para construir e homologar correspondências E3 e perfil E2 (R5) | institucional | writers E2/E3 |
| F9 | Perfil E2 homologado declarando o esquema na chave | dado homologado | resolução |
| F10 | Correspondências E3 (22 chaves → matriz + coluna) homologadas | dado homologado | aplicação automática |

Até F1–F10, o sistema permanece fail-closed: sem valores, sem perfil, sem correspondências; ausência sinalizada, nunca default.
