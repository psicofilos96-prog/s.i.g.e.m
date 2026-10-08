# Frente AB.2 — Acompanhamento pedagógico e ficha longitudinal

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Status: **PASS — READY_FOR_HUMAN_PEDAGOGICAL_FOLLOW_UP**; **ALERTS — BLOCKED_BY_HOMOLOGATED_RULES**; **HUMAN_UI_VALIDATION_PENDING**.

## Migrations (aditivas)
- `0153` — `student_trajectory_at` (DEFINER, `search_path=''`, só `authenticated`): timeline por domínio com proveniência (`source`, `source_id`, `known_at`), filtros ano/período/domínio, `knownAt`; estado por domínio `nao-solicitado|nao-autorizado|com-fatos|sem-fatos-legiveis`; aluno sem fato legível ⇒ `access-denied` uniforme (sem revelar existência). `school_followup_grant_on` autoriza pela data do fato.
- `0154` — frequência/avaliação/fechamento longitudinais exigem `consultar-acompanhamento-pedagogico`; professor vê só alocações, aulas e instrumentos das próprias atribuições.
- `0155` — **defeito real corrigido**: os writers comparavam `status='homologado'`, valor proibido pelo CHECK (`homologada`); nenhuma intervenção podia ser registrada. v2 passa a autorizar por `occurred_on`.
- `0156` — **defeito real corrigido**: v2 falhava quando a situação (opcional) era omitida.

## Escopo por papel
Orientação/Direção: própria escola (capacidade explícita); Supervisão: rede conforme capacidade; Professor: só próprias atribuições; Secretaria: só matrícula/turma/movimentação. Nenhuma política real concede ainda `consultar/registrar-acompanhamento-pedagogico` — fail-closed até homologação.

## Tela e exportação
`/ficha-longitudinal/$id` (`student-trajectory-page.tsx`), filtros por data e assunto, pendente ≠ falta, zero real ≠ sem resultado, alertas desativados. Exportação `ficha-longitudinal-aluno` no catálogo comum, sem nome nem texto livre.

## E2E
`supabase/tests/ab2_followup_e2e.sql` (rollback; dublê transacional de capacidade): multi-escola, transferência, aula/chamada, zero real, intervenção + retificação, stale-head, catálogo/situação não homologados, aluno de outra escola, IDOR uniforme, professor fora da atribuição, Secretaria, Direção de outra escola, Supervisão, knownAt, anon/service_role/legado. Zero resíduos; 2027 sem estado.

## Gates
3.548 testes (1 corrigido após a suíte e reconferido), tsgo, build, freeze, invariantes 31/31, auditoria SQL, diff-check; Advisor 351→352 (`student_trajectory_at`, validação interna).
