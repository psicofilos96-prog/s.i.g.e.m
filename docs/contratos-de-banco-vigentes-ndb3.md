# NDB.3 — Mapa final de contratos de banco (RPCs versionadas) (2026-10-08)

## Situação atual
Classe: Registro de lote. Complementa `security-definer-function-inventory.md` (NSEC.2).

## Método
Para cada função com sucessora `_vN`: busca de chamadas em `src/`, `scripts/`, `supabase/tests/` (exceto `types.ts`), busca no corpo de outras funções do banco (`pg_get_functiondef`) e conferência de `EXECUTE` para `anon`/`authenticated`.

## Contratos vigentes (o app chama só estes)
| Contrato vigente | Legado(s) | EXECUTE do legado por contas | Uso residual do legado |
|---|---|---|---|
| apply_assessment_instrument_v2 | apply_assessment_instrument | não | nenhum |
| create_assessment_instrument_v2 | create_assessment_instrument | não | nenhum |
| emit_school_document_v3 | emit_school_document; emit_school_document_v2 | não; **não (revogado em `0248`)** | v2 chamada internamente pela v3; provas SQL privilegiadas |
| record_assessment_item_version_v2 | record_assessment_item_version | não | teste de contrato lê o SQL da migration |
| record_attendance_version_v2 | record_attendance_version | não | teste garante que telas não o chamam |
| record_curricular_reference_edition_v2 / _relation_v2 / _simplification_v2 | v1 de cada | não | nenhum |
| record_guardian_authorization_v3 | v1; v2 | não; não | v2 chamada internamente pela v3; prova SQL |
| record_inclusion_term_review_v2 | v1 | não | nenhum |
| record_lesson_version_v2 | v1 | não | teste garante ausência; provas SQL |
| record_period_closing_act_v2 | v1 | não | prova SQL |
| record_school_pedagogical_record_v2 | v1 | não | prova SQL |
| record_teacher_instrument_version_v2 | v1 | não | teste de contrato lê o SQL |
| record_teaching_assignment_version_v2 | v1 | não | rótulo do cenário migrado para v2 (NDB.3); provas SQL |
| record_teaching_plan_version_v2 | v1 | não | provas SQL e teste de contrato |
| register_academic_standings_v2 | v1 | não | só comentário |
| register_assessment_results_v2 | v1 | não | v1 chamada pela v2; script de simulação e provas SQL privilegiados |

## Mudanças deste lote
- `0248_ndb3_revoke_superseded_emit_school_document_v2`: EXECUTE retirado de PUBLIC/anon/authenticated e função marcada DEPRECATED; nada apagado.
- `scenario-model.ts`: o destino de promoção de regência aponta `record_teaching_assignment_version_v2`.
- Nenhuma migration antiga editada; nenhum dado oficial tocado. Funções legadas permanecem (são etapa interna ou estão citadas em provas), apenas sem EXECUTE para contas.

## Pendências
- PROVAS_SQL_PENDENTES: `supabase/tests/*.sql` que chamam legados só rodam com acesso privilegiado.
