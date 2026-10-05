# Frente N — Secretaria / Vida escolar

**Status: PARTIAL.**

- Pessoa (`institutional_persons`) ≠ aluno (`institutional_students`) ≠ matrícula escolar (`school_enrollments`) ≠ inscrição letiva/participação (`cycle_participations`) ≠ alocação — writers SECURITY DEFINER separados (B3), readers bitemporais INVOKER.
- Movimento só por `record_student_movement` com tipo homologado; divergência 31/07×31/08 não gerou nenhuma transferência.
- Documentos escolares são projeções (`school_document_emissions`) e não criam fatos.
- Escopo por escola via `has_school_capability`; IDOR/histórico/retificação cobertos pela suíte B3.

Estado real: 9.763 alunos, 9.811 matrículas observadas (`opened_on` NULL), 0 participações, 0 alocações, 0 movimentações. Bloqueio: início efetivo não declarado em nenhuma fonte.
