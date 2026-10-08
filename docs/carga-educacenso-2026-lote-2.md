# Carga EducaCenso 2026 — Lote 2 (correção temporal C + Frente F)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Este relatório traz apenas agregados. Não contém nomes, CPF, datas de nascimento nem identificadores individuais.

## 1. Correção C — PASS
O que foi neutralizado, sem apagar nada (migration 0108 + operação `technical_correct_educacenso_2026_temporal`):
- **Ano 2026:** a identidade "2026" foi mantida. Os limites 01/01–31/12 e o `valid_from` foram marcados como `nao-sustentado-pela-fonte` em `temporal_stand_in_neutralizations`, com 3 marcações.
  - `calendar_year_state_at` agora responde `ano-letivo-limites-oficiais-nao-informados`.
  - `b41_year_active_throughout` não afirma vigência.
  - A lacuna permanece até ser carregado o Calendário Escolar 2026.
- **Turmas:**
  - `valid_from` 31/08 foi neutralizado em 698 turmas, em 698 versões e em 9.169 declarações censitárias.
  - `class_source_observations` registra o `known_at` real de cada bloco da fonte de turmas: 698 observações, todas com emissão em 31/07/2026.
  - `class_at` devolve `valid_from = NULL` e só afirma a turma a partir da primeira observação da fonte.
  - A tela mostra "início não informado".
- **Reconciliação C refeita:** 698 turmas e 698 versões, os mesmos números de antes da correção.
- **Retry:** a operação é idempotente (o ledger devolve o mesmo id).

## 2. Frente F — PARTIAL
Foram carregados pessoa, papel de aluno, matrícula escolar e vínculo de turma observado. **Não foram constituídas** inscrição letiva, participação nem alocação. Essas entidades exigem início efetivo, e nenhuma fonte o declara. Preencher com 31/07, 31/08 ou 01/01 seria inventar data.

### Fontes e papéis
| Fonte | SHA-256 (prefixo) | Papel |
|---|---|---|
| Todos_os_alunos.xlsx ≡ Consolidado_-_Dados_dos_Alunos.xlsx | 11cdd65a… | Uma única evidência individual. São 55 blocos, todos emitidos em 31/07 (`known_at` por bloco). |
| Todas_as_jornadas.xlsx | e7f33aa1… | Reclassificada como **Jornada Escolar do Aluno**, fonte suplementar. São 54 blocos: 20 emitidos em 31/07 e 34 em 31/08. O `known_at` é preservado por bloco. |
| Situacao_Escolas_Matriculas_municipais/conveniadas.xlsx | b7aa8abc… / 53bf5e4e… | Agregados com Data de Referência 31/08. Usados só para reconciliação. |
| Todas_as_turmas.xlsx | 43b79beb… | Turmas canônicas e quantidade de alunos declarada por turma. |

### Classificação das colunas (fonte de alunos)
- **Usadas:**
  - Identificação única (12 dígitos): identificador externo `inep-pessoa`, não é PK.
  - CPF: só como HMAC interno, opcional.
  - Nome: só no banco, em `institutional_persons`/`institutional_students`.
  - Código da Matrícula: identificador externo contextual.
  - Código da turma, Etapa de ensino e Etapa de vínculo (turma multi): guardados como literais.
- **Sensíveis, não importadas:** data de nascimento, nacionalidade, naturalidade, cor/raça, povo indígena, sexo, deficiência/TEA/altas habilidades, transtornos, recursos Saeb, zona de residência, localização diferenciada, tipo de AEE, atendimento hospitalar/domiciliar, transporte (todas as colunas).
- **Ignoradas:**
  - Nome da turma: não é analisado.
  - Carga de curso técnico: não aplicável.
  - Ordem.

### Mapeamento canônico (migration 0109)
- **Pessoa:** `institutional_persons`.
- **Papel de aluno (StudentRole):** `institutional_students` + `institutional_student_persons`, com 1 aluno por pessoa.
- **Matrícula escolar:** `school_enrollments`, uma por aluno × escola × ano, com `opened_on = NULL`.
- **Vínculo de turma:** `student_class_bond_observations`, com `valid_from NULL` e `known_at` do bloco.
  - A natureza (curricular, AEE, atividade) vem da declaração da turma, não de um enum do aluno.
- **Jornada do aluno:** `student_school_day_observations`, com papel `vinculo-na-escola` ou `vinculo-adicional` e o tipo de vínculo literal.
- **Escrita:** só por `technical_import_educacenso_2026_students_enrollments`. A função é SECURITY DEFINER com `search_path=''` e é fail-closed: automação desligada, tipo de operação, hash, contagens, identidade, duplicidade e turma × escola são todos verificados.

### Resultado (Cloud antes → depois)
| Item | Antes | Depois |
|---|---|---|
| Pessoas | 1.059 | 10.822 (+9.763 novas; 0 reaproveitadas) |
| Papéis de aluno | 0 | 9.763 |
| Matrículas escolares (início não informado) | 0 | 9.811 (48 alunos em duas escolas) |
| Vínculos de turma observados | 0 | 10.295 |
| Alunos com mais de um vínculo | — | 527 |
| Inscrições letivas, participações e alocações | 0 | 0 (não constituídas; ver bloqueador) |
| Linhas da jornada do aluno | 0 | 9.692 (9.176 principais + 516 adicionais) |
| Turmas com aluno | — | 698 de 698 (nenhuma turma sem aluno) |

Vínculos por tipo de turma declarado:
- Curricular: 8.579.
- Curricular com Atividade Complementar: 1.183.
- AEE: 351.
- Atividade complementar: 182.

### Recusas e divergências (agregadas)
- Identidade: 0 IDs inválidos, 0 IDs com nomes divergentes, 0 CPFs compartilhados entre pessoas e 0 conflitos com identificadores já no SIGEM.
- CPF ausente: 41 alunos. Foram carregados pela identificação única, sem CPF.
- Turmas: 0 turmas sem correspondência e 0 turmas de outra escola na fonte de alunos.
- Jornada: 28 linhas principais e 28 adicionais referem turma inexistente ou de outra escola. Não foram carregadas.
- Jornada sem aluno correspondente: 0.

### Reconciliação
- **Quantidade declarada por turma:** 698 de 698 iguais. O total declarado é 10.295, igual aos vínculos carregados.
- **Situação das Escolas, 31/08 (55 escolas, todas "Em atividade"; "Fechada" = fechamento censitário):**
  - Curricular: 9.762 declarados × 9.762 vínculos curriculares (8.579 + 1.183).
  - AEE: 351 × 351.
  - Atividade Complementar: 1.365 × 1.365 (182 + 1.183).
  - A soma bruta difere em 1.183 em 12 escolas porque o relatório conta o vínculo "curricular com atividade complementar" nas duas colunas. Não há divergência real.
- **Jornada Escolar do Aluno × fonte de alunos:**
  - 9.170 alunos na jornada, todos presentes na fonte de alunos.
  - 593 alunos sem linha na jornada.
  - 9.687 pares aluno × turma concordam.
  - 608 pares aparecem só na fonte de alunos; 0 pares aparecem só na jornada.
- **31/07 ↔ 31/08:** nenhum par da jornada de 31/08 diverge da fonte de 31/07. Nenhum movimento foi inferido, e nenhuma das fontes declara movimento com data.
- **Censo_Escolar_2026_Preliminar_Itaperuna.xlsx:** não reconciliado nesta rodada. A reconciliação por escola e modalidade já fecha com os relatórios de 31/08.

## 3. Migrations
- `0108_neutralize_class_temporal_stand_ins`
- `0109_educacenso_2026_students_enrollments`
- `0110_school_enrollments_revoke_direct_dml`: o `service_role` tinha DML direto legado em `school_enrollments` e foi revogado.

## 4. Checks
- Suíte completa: 258 arquivos, 3.388 testes.
- tsgo: OK.
- Migration integrity: OK, com manifesto atualizado.
- Audit SQL: nenhum DEFINER sem `search_path`.
- `git diff --check`: limpo.
- Security Advisor: 305 alertas, +2 do tipo "RLS sem policy" nas tabelas internas `institutional_student_persons` e `technical_operation_findings`. É intencional: são tabelas sem acesso para app roles.
- Prova `supabase/tests/educacenso_2026_f_temporal.sql`: executada na Cloud com rollback (OK). Com dados sintéticos, cobre:
  - privilégios negados a anon, authenticated e service_role;
  - stand-in não devolvido pelos readers;
  - 698 turmas inalteradas;
  - pessoa existente recebe papel sem duplicar a pessoa;
  - homônimos viram pessoas distintas;
  - vínculo principal + AEE adicional;
  - multietapa preservado como literal;
  - jornada sem correspondência registrada como achado;
  - reimportação idempotente;
  - payload diferente com o mesmo hash é recusado;
  - ID externo duplicado, turma inexistente ou de outra escola e código de matrícula repetido são recusados;
  - append-only;
  - automação desligada provoca recusa.
- Payload de transporte descartado (`technical_payload_staging` vazio). Os arquivos-fonte não foram alterados.

## 5. Bloqueadores materiais
1. **Inscrição letiva, participação e alocação:** nenhuma fonte declara o início efetivo. Ficam pendentes de uma fonte de ingresso individual ou de um modelo explícito de início desconhecido; o Calendário Escolar 2026 só fornece limites do ano, não a data de cada aluno. As telas do Diário continuam sem lista de alunos.
2. **Limites oficiais do ano 2026:** desconhecidos; a mesma dependência do item anterior.
3. **Frente E:** continua BLOCKED por falta de fonte de jornada profissional.
