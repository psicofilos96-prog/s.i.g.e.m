# NDATA.3 — Auditoria somente leitura dos dados oficiais (2026-10-08)

## Situação atual
- Classe: **Registro de lote**. Instantâneo de 2026-10-08; a coluna 2026-10-08 deste relatório é o baseline vigente de contagens (substitui o de `qualidade-integridade-dados-oficiais.md`, que segue como referência dos contratos de verificação).
- Somente leitura: nenhum fato corrigido, nenhuma gravação. Consultas: `docs/ndata1/auditoria-somente-leitura.sql` (consulta técnica) + bloco "turmas/calendários" abaixo (consulta de auditoria do backend, porque a conta técnica não lê `institutional_classes`).

## Comparação de contagens (NDATA.1 → NDATA.3)
| Item | 2026-10-07 | 2026-10-08 | Variação |
|---|---|---|---|
| Escolas | 55 | 55 | = |
| Pessoas | 10.822 | 10.822 | = |
| Atuações institucionais | 2 | 2 | = |
| Alunos | 9.763 | 9.763 | = |
| Matrículas (versões) | 9.811 | 9.811 | = |
| Turmas | 698 | 698 | = |
| Enturmações / participações / composições / posições | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | = |
| Regências (atribuições docentes) | — | 0 | novo item |
| Vínculos funcionais (DP) | 551 | 551 | = |
| Calendários (identidades / versões / homologações) | — / 7 / — | 3 / 9 / 7 | +2 versões |
| Políticas de capacidade | 8 | 8 | = |

## Achados e classificação
| Verificação | Resultado | Classe |
|---|---|---|
| Referências: aluno sem pessoa, matrícula com aluno/escola inexistente, atuação sem pessoa, turma sem escola, turma sem versão cadastral | 0 em todas | ESPERADO |
| Escopo: enturmação ou atuação em escola diferente da turma | 0 / 0 | ESPERADO |
| Vigências: fim antes do início (atuação, participação, encerramento), matrícula com data impossível | 0 | ESPERADO |
| Duplicidade: INEP repetido, sem INEP, formato inválido; turma com 2+ identificadores; enturmação aberta múltipla | 0 | ESPERADO |
| Matrículas sem `logical_id` (cadeia de versões não identificável) | 9.811 de 9.811 | DADO_A_REVISAR (inalterado; backfill só por lote explícito) |
| Matrícula sem enturmação | 9.811 | AUSENCIA_CONFIGURACAO (enturmação 2026 não realizada) |
| Turma sem composição declarada | 698 | AUSENCIA_CONFIGURACAO |
| Posições curriculares individuais | 0 | AUSENCIA_CONFIGURACAO (dependem de enturmação) |
| Regências | 0 | AUSENCIA_CONFIGURACAO (atribuição docente não registrada) |
| Vínculo funcional sem lotação | 551 de 551 | DADO_A_REVISAR (inalterado) |
| Pessoa sem atuação nem vínculo de aluno | 1.057 | DADO_A_REVISAR (inalterado; cruzar com DP) |
| Calendários 2027: 3 calendários com versão homologada vigente no mesmo ano | 3 | DADO_A_REVISAR: só não bloqueia se a aplicabilidade homologada separar os públicos (Regular, EJA etc.); não verificado aqui |
| Calendário `cal-a3222d81…`: versões 3 e 4 (retificação de 2026-10-08) sem decisão | 2 | ESPERADO (em elaboração; não vigoram até homologação) |
| Consultas da conta técnica sobre turmas | permissão recusada | ERRO_TECNICO de acesso da conta de auditoria, não do dado; contornado pela consulta do backend |

## Baseline novo
As contagens da coluna 2026-10-08 passam a ser o baseline. Mudança fora delas em rodada futura deve ser explicada por ato registrado.

## Consulta de turmas e calendários (backend, somente leitura)
```sql
select (select count(*) from institutional_classes) turmas,
 (select count(*) from institutional_classes c where not exists(select 1 from class_composition_versions v where v.class_id=c.id)) turmas_sem_composicao,
 (select count(*) from class_enrollment_episodes e join institutional_classes c on c.id=e.class_id where c.school_id<>e.school_id) ep_escola_difere,
 (select count(*) from school_enrollments where logical_id is null) matr_sem_logical,
 (select count(*) from teaching_assignment_versions) regencias;
select v.calendar_id, v.version, v.change_kind,
 (select string_agg(h.decision, ';' order by h.sequence) from calendar_version_homologations h where h.calendar_version_id=v.id) decisoes
from calendar_versions v order by 1, 2;
```

## Pendências
- DEPENDE_DECISAO: backfill de `logical_id` das matrículas; lotações do DP; confirmar se os 3 calendários 2027 têm aplicabilidade disjunta.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: conferência pela tela `/qualidade-dos-dados` com login real.
