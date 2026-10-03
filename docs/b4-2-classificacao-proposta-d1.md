# B4.2 — Proposta de classificação (D1) — PROPOSTA, NÃO NORMA HOMOLOGADA

Status: documento de análise. Nada aqui foi cadastrado em catálogo, banco ou código. Todo identificador abaixo é **candidato técnico sujeito a homologação** e não é ID oficial. Nenhum valor foi semeado.

Fonte normativa: Deliberação CME nº 3/2026 de Itaperuna, arts. 1º–2º, Anexos I–V, já discutida no histórico. A transcrição é estrutural, a partir do que foi registrado na B4.1.2; a homologação exige conferência do texto oficial.

## 1. Colunas de posição individual (22)
Cada coluna é uma posição possível do **estudante na alocação** (fato B3.3), não da turma.

| Anexo | Etapa/segmento (documento) | Modalidade | Colunas (posições) | Qtde | Jornada distinguida? |
|---|---|---|---|---|---|
| I | Educação Infantil | regular | Berçário, Maternal, 1º Período, 2º Período | 4 | **Sim** (carga parcial/integral) |
| II | EF 1º segmento | regular | 1º, 2º, 3º, 4º, 5º ano | 5 | Não |
| III | EF 2º segmento | regular | 6º, 7º, 8º, 9º ano | 4 | Não |
| IV | EJA 1º segmento | EJA | Fases I, II, III, IV, V | 5 | Não |
| V | EJA 2º segmento | EJA | Fases VI, VII, VIII, IX | 4 | Não |

Total: 4 + 5 + 4 + 5 + 4 = **22**.

## 2. Dimensões distintas (não confundir)
1. **Posição individual (ano/fase/agrupamento):** uma das 22 colunas. É um eixo da B3.3 por alocação.
2. **Etapa/segmento e modalidade:** são propriedades da coluna (de que anexo ela é). Proposta: um esquema próprio por dimensão, ou derivação declarada da coluna via tabela de correspondência homologada. As duas formas são equivalentes para o motor; a escolha é técnica, após homologação.
3. **Natureza da turma:** regular × AEE × atividade complementar. É fato da **turma** (candidato a eixo da Oferta B2.6). Turmas AEE ou complementares **ficam fora** da correspondência automática com os Anexos I–V. AEE **não é etapa** e pode coexistir com matrícula regular. A natureza da participação (B3) não basta, sozinha, para classificá-la.
4. **Jornada parcial/integral:** só é relevante onde o anexo distingue, hoje apenas o Anexo I. **Não** equivale a turno (B2.6 `class_shift_at`). A proposta é tratá-la como eixo individual da alocação na EI, por exemplo para estudante integral em turma mista. Isso é uma decisão pendente (quadro abaixo).

## 3. Fontes normativas × rótulos operacionais
- Só a deliberação cria colunas. Rótulos do Censo, dos diários ou de nomes de turma são **operacionais** e não criam posição.
- **Turmas TEC/multisseriadas:** não criam nova coluna. Cada estudante recebe uma das 22 posições, e a turma reúne várias.
- **"EI unificada"** (rótulo operacional): não é coluna da deliberação. Cada criança mantém sua posição: Berçário, Maternal, 1º ou 2º Período.
- **AEE:** não é etapa nem coluna; é natureza de turma ou atendimento.
- Nenhuma inferência é feita por nome, código ou etapa agregada da turma.

## 4. Identificadores técnicos candidatos (sujeitos a homologação)
| Esquema candidato | Valores candidatos | Observação |
|---|---|---|
| `cand:posicao-curricular` | `cand:ei-bercario`, `cand:ei-maternal`, `cand:ei-1-periodo`, `cand:ei-2-periodo`, `cand:ef-1-ano` … `cand:ef-9-ano`, `cand:eja-fase-1` … `cand:eja-fase-9` | 22 valores |
| `cand:jornada-escolar` | `cand:parcial`, `cand:integral` | só onde o anexo distingue |
| `cand:natureza-da-turma` (Oferta B2.6) | `cand:regular`, `cand:aee`, `cand:atividade-complementar` | exclusão da correspondência regular |

O prefixo `cand:` é apenas rótulo de proposta neste documento: esses identificadores **não são válidos** no catálogo existente, cujo writer (B2.6) exige esquema e valor em `^[a-z0-9][a-z0-9-]*$` — o `:` seria recusado. Os IDs técnicos reais, quando homologados, deverão usar somente `[a-z0-9-]` (começando por letra minúscula ou dígito) e serão escolhidos na homologação pelo responsável pelo catálogo (`manter-catalogos-institucionais`). Nada é cadastrado por este documento.

**Conferência com o texto oficial:** o texto da Deliberação CME nº 3/2026 não está disponível como arquivo neste projeto; a tabela de 22 colunas acima foi montada a partir da descrição dos Anexos I–V fornecida pelo usuário (I: Berçário, Maternal, 1º e 2º Período; II: 1º–5º ano; III: 6º–9º ano; IV: Fases I–V; V: Fases VI–IX), com a qual é consistente (4+5+4+5+4 = 22). A conferência contra o documento oficial não foi feita aqui e fica a cargo do usuário.

## 5. Conexão B3.3 / B2.6 / B4.1 (sem inferir etapa da turma)
```text
Oferta B2.6 (turma)  --natureza da turma--> exclui AEE/complementar da correspondência regular
Alocação B3 --> Posição B3.3 (estudante): coluna [+ jornada na EI]
Correspondência homologada (ato, vigência): coluna [+ jornada] --> matriz B4.1 (versão vigente)
Matrizes da turma na data = união das matrizes resolvidas para as posições presentes
```
- A B3.3 já grava a posição por alocação (eixos abertos, bitemporal, ausência explícita). Falta só homologar o esquema e os valores.
- A B2.6 guarda fatos da turma. A natureza da turma é eixo candidato da Oferta e **não** fornece etapa.
- Ambiguidade é avaliada por estudante × posição × data. Várias matrizes na mesma turma são válidas.

## 6. Fatos ainda faltantes
1. Esquema/valores homologados de posição (22), e de jornada na EI se aprovada.
2. Natureza da turma como fato homologado da Oferta (esquema, valores e designação do eixo).
3. Tabela de correspondência posição [+ jornada] → matriz, como dado versionado com ato e vigência.
4. Matrizes B4.1 efetivamente construídas pela Supervisão para os Anexos I–V e homologadas.
5. Homologação da política v2 (hoje draft).

## 7. Quadro de decisões restantes
Já respondidas e não repetidas aqui:
- a posição pertence à alocação;
- é versionada e admite posições sucessivas;
- a ausência é explícita;
- é aplicada automaticamente por enquadramento;
- várias matrizes podem coexistir na turma;
- AEE e complementar ficam fora da correspondência regular;
- a Supervisão (`gestao-pedagogica-da-rede`) constrói as matrizes.

| # | Decisão | Natureza | Opções |
|---|---|---|---|
| R1 | Aprovar as 22 posições da seção 1 como valores do catálogo de posição | institucional | aprovar / ajustar |
| R2 | Etapa/modalidade: esquema próprio ou derivação da coluna via correspondência | técnica (após R1) | — |
| R3 | Jornada na EI: fato individual da alocação ou da turma | institucional | alocação / turma |
| R4 | Natureza da turma: designar o eixo da Oferta B2.6 e seus valores | institucional | aprovar / ajustar |
| R5 | Quem homologa a correspondência posição→matriz e com qual ato | institucional | Supervisão / outro |
| R6 | Obrigatoriedade de posição para alocação regular, ou ausência apenas sinalizada | institucional | obrigatória / sinalizada |
| R7 | Obrigatoriedade de matriz para cada posição presente | institucional | obrigatória / sinalizada |
| R8 | Término da alocação anterior ao fim da posição: só ocultar (atual) ou exigir ajuste | institucional | ocultar / exigir |
