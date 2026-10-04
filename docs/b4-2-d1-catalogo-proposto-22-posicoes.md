# B4.2 — Pacote de homologação D1: catálogo proposto de 22 posições individuais

**Status do documento: PROPOSTA, NÃO HOMOLOGADA.** Pacote somente documental. Nada aqui foi cadastrado em catálogo, banco, política ou código; nenhum dado foi semeado; nenhum deploy. Os IDs técnicos abaixo são **sugestões** para a autoridade do catálogo e não constituem norma aprovada.

## 1. Fonte

- Deliberação CME nº 3/2026 (Itaperuna), arts. 1º–2º, Anexos I–V.
- PDF-fonte preservado no acervo do projeto e conferido novamente em 2026-10-04: SHA-256 `d8f46e61a655f515d758c58ccb7715d3976c5ee347efc9a0d7e7e3f385fe0b02`.
- Localização: p. 1 = ato; p. 2 = Anexo I; p. 3 = Anexo II; p. 4 = Anexo III; p. 5 = Anexo IV; p. 6 = Anexo V.
- A transcrição literal controlada dos quadros está em `docs/data/deliberacao-cme-3-2026-matrizes-source.json`, marcada explicitamente como **não homologada**; `bun run audit:curriculum-source` confere estrutura, 22 posições, largura das linhas, hash da fonte e mantém publicação/vigência como pendentes.

**Data do ato:** 1º de abril de 2026, confirmada na p. 1. **Vigência:** não declarada neste pacote. O art. 2º vincula a vigência à **publicação**, e a data de publicação **não foi comprovada**. Portanto, 1º de abril é `act_date`, não `valid_from`. Fica pendente a prova da publicação (veículo, data, edição).

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
| 5 | `1-ano` | 1º ano *(rótulo proposto; fonte: “1º”)* | II | 3 |
| 6 | `2-ano` | 2º ano *(rótulo proposto; fonte: “2º”)* | II | 3 |
| 7 | `3-ano` | 3º ano *(rótulo proposto; fonte: “3º”)* | II | 3 |
| 8 | `4-ano` | 4º ano *(rótulo proposto; fonte: “4º”)* | II | 3 |
| 9 | `5-ano` | 5º ano *(rótulo proposto; fonte: “5º”)* | II | 3 |
| 10 | `6-ano` | 6º ano *(rótulo proposto; fonte: “6º”)* | III | 4 |
| 11 | `7-ano` | 7º ano *(rótulo proposto; fonte: “7º”)* | III | 4 |
| 12 | `8-ano` | 8º ano *(rótulo proposto; fonte: “8º”)* | III | 4 |
| 13 | `9-ano` | 9º ano *(rótulo proposto; fonte: “9º”)* | III | 4 |
| 14 | `fase-i` | Fase I | IV | 5 |
| 15 | `fase-ii` | Fase II | IV | 5 |
| 16 | `fase-iii` | Fase III | IV | 5 |
| 17 | `fase-iv` | Fase IV | IV | 5 |
| 18 | `fase-v` | Fase V | IV | 5 |
| 19 | `fase-vi` | Fase VI | V | 6 |
| 20 | `fase-vii` | Fase VII | V | 6 |
| 21 | `fase-viii` | Fase VIII | V | 6 |
| 22 | `fase-ix` | Fase IX | V | 6 |

Total 4 + 5 + 4 + 5 + 4 = **22**. Os IDs não carregam etapa/modalidade de propósito (ver seção 2). Os rótulos de Berçário, Maternal, períodos e fases seguem a fonte. Nos Anexos II–III, a fonte imprime apenas “1º” … “9º” no cabeçalho; “1º ano” … “9º ano” acima são rótulos humanos **propostos**, não transcrição literal.

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
| F5 | Decisão R2 (derivação via correspondência, proposta aqui) | decisão técnica/institucional | leitura de etapa/modalidade |
| F6 | Decisão R3 (jornada na EI) | institucional | correspondência do Anexo I |
| F7 | Matrizes B4.1 dos Anexos I–V construídas pela Supervisão e homologadas (E1) | ato + dado | correspondência E3 |
| F8 | R5: Supervisão Escolar constrói e homologa E1–E4 | **RESOLVIDO** em 2026-10-04 | implementação dos writers/v4 draft em andamento |
| F9 | Perfil E2 homologado declarando o esquema na chave | dado homologado | resolução |
| F10 | Correspondências E3 (22 chaves → matriz + coluna) homologadas | dado homologado | aplicação automática |

Até as faltas institucionais restantes, o sistema permanece fail-closed: sem valores, sem perfil, sem correspondências; ausência sinalizada, nunca default.


## 6. Estado operacional pós-B1.4

R5 foi resolvido em 2026-10-04: a Supervisão Escolar (`gestao-pedagogica-da-rede`) constrói e homologa E1–E4; ver `docs/r5-competencia-e1-e4.md`. A política v3 está homologada com 199 regras. A capability
`manter-matrizes-curriculares` existe em rede para
`gestao-pedagogica-da-rede` (Supervisão Escolar) e para o Administrador Geral,
por regra explícita. Isso resolve a autoridade de **construção da matriz B4.1**. R5 agora também está institucionalmente resolvido, mas a materialização técnica ainda exige writers E1–E4 e uma nova política v4. A v3 não será alterada; a v4 permanecerá draft até homologação com ato institucional real.

A Cloud continua sem valores de catálogo, componentes, matrizes, perfis,
correspondências ou associações específicas. A transcrição-fonte adicionada
nesta etapa não grava nenhum desses fatos.
