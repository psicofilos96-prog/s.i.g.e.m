# Frente Z — Planejamento pedagógico 2027
Gate: U, Y (readers estáveis; conteúdo BNCC/SAEB BLOCKED_BY_OFFICIAL_SOURCE) e V (atribuições) utilizáveis. Reaproveita 0078; 0137 endurece.
- Níveis: identificador aberto (`level_value_id`) + período oficial opcional (`period_id`), nunca bimestre inventado.
- Contexto: só atribuição vigente do próprio usuário na data-alvo; acompanhamento por `can_read_teaching_plan_version`, sem autoria.
- Referências Y opcionais por ID (edição histórica preservada); ausência não bloqueia.
- Planejar nunca vira aula: ligação só por `link_lesson_to_plan` explícito.
- Teste DB `supabase/tests/z_teaching_planning.sql` ⇒ `z-plan-tests-ok`, sem resíduos.
- Pendente: positivo ponta-a-ponta (sem atribuições 2027 reais), regra humana de aprovação pedagógica, Advisor.
Status: PASS — READY_FOR_2027_HUMAN_PEDAGOGICAL_PLANNING (técnico); CONTENT REFERENCES — BLOCKED_BY_OFFICIAL_SOURCE.
