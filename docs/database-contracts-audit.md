# Auditoria de contratos do banco (NDB.1, 2026-10-07)

## Integridade
- 235 migrations (0000–0234), `check-migrations`: ok; manifesto congelado por `invariants:freeze-migrations` (nenhum hash reescrito).

## Writers versionados (v1/v2/v3)
| Função antiga | Atual | Estado após NDB.1 |
|---|---|---|
| apply_assessment_instrument, create_assessment_instrument, emit_school_document, record_assessment_item_version, record_attendance_version, record_inclusion_term_review, record_lesson_version, record_period_closing_act, record_teacher_instrument_version, record_teaching_plan_version, register_academic_standings | `_v2` | já sem EXECUTE e com DEPRECATED |
| record_school_pedagogical_record, record_teaching_assignment_version, register_assessment_results | `_v2` | sem EXECUTE; comentário DEPRECATED ausente (dívida cosmética, não corrigida) |
| record_guardian_authorization (v1) | v3 | já sem EXECUTE |
| record_guardian_authorization_v2 | v3 | **0234**: EXECUTE revogado + DEPRECATED (0 chamadas no app) |
| record_curricular_reference_edition / relation / simplification (v1) | `_v2` | **0234**: EXECUTE revogado + DEPRECATED (0 chamadas; AGENTS já exigia v2) |

## Não auditado nesta rodada (pendente NDB.1.1)
- índices redundantes/ausentes, FKs, triggers append-only por tabela, constraints temporais, readers sem uso, deep/build/security scan.
