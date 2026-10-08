# Frente M — Necessidade de professor

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Revisão NDOCS.2 (2026-10-08): corrigido — "DP externo" → "DP" (fronteira N12.1).


**Status: BLOCKED_BY_SOURCE (modelo PASS).**

`src/features/staffing/staffing-model.ts` separa carga contratual, disponibilidade, regência, aulas ofertadas e aulas cobertas, e só calcula quando matriz/carga e regência existem; fórmula de déficit é regra homologável, não código (relatório catalogado com `dependency`).

Estado real: 0 matrizes, 0 grades, 0 regências, 0 lotações, jornada profissional ausente (Frente E). Portanto **nenhum déficit nominal ou excedência é publicado**; a tela mostra o impedimento por extenso. Os 551 vínculos e 2.403 declarações censitárias não são carga horária nem regência.

## Frente V (0129–0132)
- Carga atribuída é projeção (`school_teaching_load_at`) de atribuições × blocos; minutos de bloco ≠ hora-aula normativa.
- Carga contratual não tem fonte funcional canônica: `contractual_load_state` = não informada e o saldo é "não calculável". O cálculo final continua bloqueado.

## Frente X (2026-10-05) — sem migration
- Engine `src/features/staffing/teacher-need.ts`: sete grandezas separadas (necessárias, ofertadas, cobertas, descobertas, carga atribuída, carga contratual, saldo), cada uma `{value|null, reason}`; desconhecido nunca vira 0.
- Demanda: matriz homologada aplicável (`class_curricular_matrices_at` + `curricular_matrix_items_at`); quantidade/unidade literal; conversão para aulas semanais só por `UnitRule` homologada (hoje nenhuma ⇒ não calculável). Turma com >1 matriz aplicável não soma matrizes.
- Oferta/cobertura: grade V (`class_schedule_at`), responsáveis derivados de atribuições/substituições; substituição válida cobre no intervalo.
- Carga atribuída por VÍNCULO (`school_teaching_schedule_at`), nunca somada entre vínculos; conflitos contados.
- Carga contratual: estados known/unknown/incompatible-unit/not-applicable; sem fonte funcional canônica ⇒ unknown, saldo não calculável.
- Cenário: `applyScenario` copia, rotula SIMULAÇÃO, não grava; o Simulador existente continua sendo a superfície.
- ACL: só readers INVOKER/RLS existentes; nenhuma escrita nova.
- Fontes ausentes: carga contratual (planilha do DP), regra de conversão de unidade, matrizes/grades/atribuições 2027 (0 registros).
- Status: PASS — READY_FOR_2027_TEACHER_NEED_ANALYSIS; CONTRACTUAL_BALANCE — BLOCKED_BY_FUNCTIONAL_SOURCE.
