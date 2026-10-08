# Reconciliação Censo Escolar 2026 — Frente G

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Este documento contém apenas agregados e códigos INEP de escola, que são dados públicos. Não há nome, CPF, data de nascimento nem identificador de aluno ou de profissional.

## Natureza
- A reconciliação é uma **projeção derivada e determinística**. Nada foi persistido e não houve migration.
- O classificador é `src/features/census-reconciliation/reconcile.ts`. A entrada é só agregada, por escola, extraída das fontes num pipeline efêmero, mais os agregados da Cloud lidos no mesmo instante.
- **Idempotência:** duas execuções, inclusive com a entrada em ordem invertida, deram a mesma impressão digital, `17f4508a`, para 1.882 comparações.
- **Cloud antes = depois:** 7 operações técnicas, 0 linhas em staging, 10.295 vínculos e 9.811 matrículas. Como nada é gravado, não se aplicam automação técnica, ledger nem rollback. O controle é não haver escrita.
- **Semântica temporal:**
  - A emissão de turmas e alunos (31/07) e a referência da Situação das Escolas (31/08) são `knownAt` de cada comparação.
  - Nenhuma delas vira início de vigência.
  - Diferença entre snapshots não é tratada como movimento.

## Fontes (sha256, primeiros 16 hex)
| Arquivo | sha256 | Papel |
|---|---|---|
| Situacao_Escolas_Matriculas_municipais.xlsx / _conveniadas.xlsx | b7aa8abcbd7161bc / 53bf5e4edda10f7d | Agregados por escola e etapa, referência 31/08 |
| Todas_as_turmas.xlsx ≡ Consolidado_-_Dados_das_Turmas.xlsx | 43b79beb6a331cb8 | Turmas, emissão 31/07. Uma só evidência |
| Todos_os_alunos.xlsx ≡ Consolidado_-_Dados_dos_Alunos.xlsx | 11cdd65a8c6e9749 | Vínculos individuais, emissão 31/07. Uma só evidência |
| Todas_as_jornadas.xlsx | e7f33aa1cdf1d2b8 | Jornada Escolar do Aluno, emissões em 31/07 e 31/08 |
| Todos_os_prof.xlsx | 0e7ff5940f3ec8d2 | Declarações censitárias de profissionais |
| Aspectos_Infraestrutura_municipais.xlsx / _conveniadas.xlsx | 5b82d0194573572b / db804fad43d61277 | Infraestrutura, 54 atributos |
| Matriz_Escolas_Itaperuna_Censo2026_PREENCHIDA.xlsx | e90925860f0dfc51 | Levantamento de Educação Infantil (alunos e turmas de creche/pré). A data de referência não é declarada |
| Censo_Escolar_2026_Preliminar_Itaperuna.xlsx | bc9dde5b3c940489 | Resultado preliminar por rede (municipal e conveniada) |
| Relacao_Servidores_por_Escola_Ago-Set_2026.xlsx, Relacao_Funcionarios_SEMED_por_Setor.xlsx | cb2305b4ef79046d, c5b34518dca29b12 | Sem CPF, portanto **não comparáveis** por pessoa (casar por nome é proibido). Fora da reconciliação |

## Resultado por dimensão
| Dimensão | EXACT | EXPLAINED | DIVERGENCE | CAN_MISSING | SRC_MISSING | NOT_COMP |
|---|---|---|---|---|---|---|
| escolas (INEP em 9 fontes, dependência, funcionamento, fechamento) | 494 | 0 | 0 | 0 | 1 | 55 |
| infraestrutura (atributos e atributos informados) | 110 | 0 | 0 | 0 | 0 | 0 |
| turmas (quantidade, alunos declarados, EI, sem Etapa Agregada) | 220 | 0 | 0 | 0 | 0 | 0 |
| alunos (vínculos, alunos distintos, matrícula escolar, início) | 165 | 0 | 0 | 0 | 0 | 55 |
| matrículas agregadas 31/08 (total, curricular, AEE, AC) | 208 | 12 | 0 | 0 | 0 | 0 |
| etapas 31/08 (creche, pré, EF AI, EF AF, EJA) | 220 | 55 | 0 | 0 | 0 | 0 |
| jornada do aluno | 53 | 1 | 0 | 0 | 0 | 0 |
| profissionais (declarações, pessoas) | 110 | 0 | 0 | 0 | 0 | 0 |
| matriz de Educação Infantil (alunos e turmas EI) | 99 | 0 | 11 | 0 | 0 | 0 |
| rede × Censo preliminar | 12 | 0 | 0 | 0 | 0 | 0 |
| participação/alocação | 0 | 0 | 0 | 1 | 0 | 0 |

## Diferenças e lacunas
- **Total da Situação × vínculos (12 escolas, EXPLAINED):** o relatório conta o vínculo "curricular com atividade complementar" nas colunas Curricular e AC. Em cada escola o delta é exatamente esse valor, 1.183 no total. Por coluna, curricular, AEE e AC são todos EXACT.
- **Etapas (55 comparações, EXPLAINED):** o relatório subdivide "EI unificada" e "EF multi", enquanto o literal individual não subdivide. O total de cada grupo confere em toda escola. Não houve inferência pelo nome da turma.
  - Totais da rede, Situação × canônico: creche 1.759 × 1.722; pré 1.642 × 1.583; AI 4.296 × 3.767; AF 1.794 × 1.588; EJA 271 × 271.
  - A diferença por etapa corresponde aos alunos de turmas unificadas ou multi.
- **Fechamento censitário (55, NOT_COMPARABLE):** "Fechada" é o estado da coleta, não o status da escola. As 55 escolas estão "Em atividade" e ativas na base.
- **Início da matrícula (55, NOT_COMPARABLE):** nenhuma fonte declara data de ingresso. Os 9.811 registros têm início não informado.
- **Jornada (1 SOURCE_MISSING):** a escola 33001936 não tem bloco na Jornada Escolar do Aluno.
- **Jornada (1 EXPLAINED):** a escola 33001863 tem 28 linhas cuja turma não existe nessa escola. Foram recusadas na carga F.
- **Matriz EI × turmas canônicas (11 SOURCE_DIVERGENCE):** a matriz declara uma turma a mais que a Etapa Agregada (por exemplo, 2 × 1). Hipótese: uma turma unificada contada em creche e em pré. A hipótese não foi aplicada, porque nenhuma fonte a declara. O número de alunos EI confere nas 55 escolas.
- **Participação/alocação (CANONICAL_MISSING):** há 10.295 vínculos declarados e 0 inscrições letivas, participações ou alocações. A lacuna vem da Frente F, porque falta o início efetivo.
- **Rede × Censo preliminar:** as 12 células (2 redes × creche, pré, AI, AF, EJA, AEE) conferem com a soma da Situação das Escolas.
  - O Censo preliminar não é comparado por etapa com os vínculos canônicos: as etapas unificadas/multi não têm subdivisão declarada.

## Checks
- Testes do classificador cobrem: exato, ausência ≠ zero nas duas direções, zero real, explicação só com delta exato, NOT_COMPARABLE, fontes duplicadas, snapshots distintos, idempotência e independência de ordem, etapa só pelo literal.
- Suíte completa: 259 arquivos, 3.398 testes.
- tsgo: OK.
- Migration integrity: OK.
- Audit SQL: nenhum DEFINER sem `search_path`.
- `git diff --check`: limpo.
- Security Advisor: dispensado, porque não houve alteração de banco.

## Bloqueadores
1. Limites do ano 2026: dependem do Calendário Escolar 2026. Participação/alocação: dependem de fonte de ingresso individual ou modelo explícito de início desconhecido (o calendário não fornece essa data).
2. Servidores e funcionários da SEMED: sem CPF não há reconciliação por pessoa.
3. Data de referência da matriz de Educação Infantil: não declarada, por isso a matriz é comparada sem `knownAt`.
4. Frente E: continua BLOCKED.
