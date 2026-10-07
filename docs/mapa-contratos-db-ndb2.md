# NDB.2 — Mapa final de contratos do banco (2026-10-07)

Situação: **PASS técnico**. Migrations congeladas intocadas; uma migration nova (`0238`).

## Contratos atuais chamados pelo app (versão vigente)
| Domínio | Contrato atual | Antigo (sem EXECUTE para sessões) |
|---|---|---|
| Diário | `record_lesson_version_v2`, `record_attendance_version_v2`, `applicable_diary_policy_on` | `record_lesson_version`, `record_attendance_version`, `applicable_diary_policy` (revogado agora) |
| Fechamento / situação | `record_period_closing_act_v2`, `register_academic_standings_v2` | versões sem sufixo |
| Avaliação | `create_assessment_instrument_v2`, `apply_assessment_instrument_v2`, `register_assessment_results_v2`, `record_assessment_item_version_v2`, `record_teacher_instrument_version_v2` | versões sem sufixo |
| Planejamento / regência | `record_teaching_plan_version_v2`, `record_teaching_assignment_version_v2` | `record_teaching_plan_version`, `teaching_assignment_grant` |
| Referência curricular | `record_curricular_reference_edition_v2`, `_relation_v2`, `_simplification_v2` | versões sem sufixo, `reference_grant` |
| Mapa | `record_map_conference(uuid,text,jsonb)`, `officialize_statistical_map(6 args)`, `open_statistical_map_correction(3 args)` | sobrecargas com `_actor` (0119) e sem snapshot (0124) |
| Secretaria / documentos | `emit_school_document_v2`, `record_school_pedagogical_record_v2` | `emit_school_document`, `register_student_with_exact_identity` |
| Família | `record_guardian_authorization_v3` | `_v1`, `_v2` |
| Inclusão | `record_inclusion_term_review_v2` | sem sufixo |
| Calendário | writers atuais | `record_calendar_version_with_applicability` |
| Instalação | `activate_sigem_reviewed` | `install_sigem_reviewed` (3 assinaturas; uma mantida com EXECUTE por compatibilidade declarada em B1.3 — não revogada) |

## Achados
- Antigos ainda chamados pelo app: **0**. Citações restantes estão só em testes que verificam o texto da função ou proíbem o uso.
- `applicable_diary_policy(text,boolean)`: DEPRECATED, mas com EXECUTE residual para sessões; sem uso no app, em regras de acesso ou testes; só chamadores internos do próprio banco → **revogado** (`0238`).
- Views em `public`: 0. Gatilhos duplicados (mesma tabela e definição): 0. Grants de tabela para anônimo em `public`: 0.
- `install_sigem_reviewed` (assinatura com ato externo): mantida — o comentário a declara porta de compatibilidade (REVISAR com o proprietário antes de revogar).
- Funções `_v2` atuais sem comentário DEPRECATED: correto (são o contrato vigente).

## Gates
Integridade de migrations OK; suíte completa 379 arquivos; invariantes profundas 36/36; varredura de segurança rerodada (achados = catálogos normativos legíveis por quem está logado, já conhecidos).

## Pendente
- Remover fisicamente funções antigas: não feito (migration aplicada é história; remoção exige decisão).
- 7 índices não usados (NDB.1.1): mantidos até medição com uso real (INTERACTIVE_BROWSER_VALIDATION_PENDING).
