# Turmas EducaCenso 2026: contrato de staging e carga canônica (Frente C)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


## Estado
**Carga real BLOQUEADA POR FONTE AUSENTE, não por login.** O ambiente do agente não recebeu os bytes de:
- Todas as turmas.xlsx
- Consolidado - Dados das Turmas.xlsx
- Censo_Escolar_2026_Preliminar_Itaperuna.xlsx

Nenhuma turma foi criada e nenhum valor foi inventado.

## Contrato de staging (`src/features/classes/educacenso-class-staging.ts`)
| Campo-fonte (mapeado após profiling) | Fato canônico |
|---|---|
| INEP da escola | `institutional_classes.school_id = inep-<INEP>` (precisa existir) |
| código da turma EducaCenso | identificador externo `educacenso-turma` (nunca PK) |
| nome da turma | `name`, sem parsing semântico |
| ano letivo | `academic_year_id` canônico existente (não criado pelo importador) |
| turno | `class_shift_versions` via catálogo homologado |
| etapa / modalidade | eixos de `class_offering_versions` via catálogo homologado; ausência = NULL |
| tipos de atendimento | conjunto composto (AEE, atividade complementar, escolarização...), nunca enum único |
| multisseriada | boolean ou NULL (não informado) |
| matrículas | inteiro ou NULL; 0 ≠ ausente; apenas para reconciliação, nunca cria aluno |

- Colunas pessoais (CPF, nomes de aluno/profissional, nascimento, contato) são descartadas pelo perfil. Mapear uma delas é recusado.
- Erros por linha: INEP inválido, escola inexistente, nome ausente, código EducaCenso duplicado, valor booleano/inteiro inválido.
- `reconcileSources` lista turmas só em uma das fontes e campos divergentes, sem escolher vencedora.
- `lineage` mostra se as duas fontes são o mesmo arquivo (hash), se têm conteúdo equivalente (derivada) ou se são fontes distintas.

## Lacunas canônicas antes da carga técnica (achadas nesta auditoria)
1. `institutional_class_record_versions`, `class_offering_versions` e `class_shift_versions` exigem `recorded_by` (pessoa) NOT NULL. Executor técnico não pode preenchê-lo sem falsificar autoria. A carga precisa de migration aditiva: `technical_operation_id` + CHECK "autoria humana XOR operação técnica". Ela relaxa o NOT NULL, o que é uma mudança que pede confirmação.
2. Só existe um ano letivo canônico na Cloud. A correspondência "2026 da fonte" → ano canônico precisa ser declarada, e o importador não cria ano.
3. Catálogos homologados de turno, etapa, modalidade e atendimento precisam conter os valores reais da fonte. Valor fora do catálogo é recusado, nunca convertido.
4. Matriz curricular, professor e aluno não são criados.

Quando as planilhas chegarem: profiling → mapeamento → staging PII-free em `docs/data/` → migration aditiva (item 1) e operação técnica `technical_import_educacenso_2026_classes` sobre a camada 0100, com núcleo comum ao writer humano → carga → prova na Cloud (totais por escola, turno, localização e oferta, com as divergências).
