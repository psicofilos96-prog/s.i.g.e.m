# B4.5 — Horário do profissional como projeção

Status: **estrutural/read-only concluída**. Nenhuma tabela, writer, capability ou policy criada. B4.6 não iniciada.

## Princípio
`pessoa → atuações vigentes → blocos B4.4 (class_schedule_at) → horários/conflitos potenciais`.
Jornada e grade continuam pertencendo à turma; a pessoa não tem grade persistida.

## Auditoria inicial
- Policies v1 = 108 e v2 = 117 regras, ambas `draft`. Nenhuma capability de horário/agenda/grade/jornada; nada exato para consultar horário de terceiros.
- `class_schedule_engagement_valid` (B4.4, SECURITY DEFINER, EXECUTE authenticated) respondia sobre QUALQUER UUID de atuação contra uma turma legível — oracle de vínculo/componente/vigência. Corrigido aditivamente em `0021`: só responde TRUE para atuação referenciada por bloco da grade daquela turma (conhecido em knownAt) com o mesmo componente. `class_schedule_at` inalterado; regressão `b44-tests-ok`.
- `institutional_class_schedule_slots` continua com 0 linhas e sem consumidor.

## Reader `person_schedule_at(_person_id, _on, _known_at)` (0022)
SECURITY INVOKER, `search_path=''`, EXECUTE só authenticated. Linhas tipadas por `result_kind`:
- `access-denied`: alvo ≠ `current_person_id()`, conta sem pessoa ou alvo nulo — linha única sem PII/contagens.
- `absent`: própria pessoa, nenhum bloco nem fonte indisponível.
- `summary`: blocos confirmados, não confirmados, minutos descritivos e conflitos.
- `block`: um por bloco B4.4 com ≥1 atuação vigente própria; `own_engagement_ids` só contém as atuações da pessoa (duas atuações no mesmo bloco ⇒ uma linha). `operational` = grade `utilizavel` e bloco `utilizavel`.
- `conflict`: par canônico (`block_id < other_block_id`) de blocos operacionais distintos, mesmo dia, intervalos sobrepostos; `conflito-temporal-potencial`, sem gravidade, prevalência ou regra de resolução.
- `source-unavailable`: turma ligada à pessoa cuja grade não pôde ser lida (`turma-nao-legivel` ou `erro-de-leitura` com o código `schedule:*`/`journey:*`); nenhum bloco é fabricado.

Turmas candidatas: `class_id` das atuações vigentes da própria pessoa e `institutional_engagement_scope_classes`. Atuação de escopo escola não é candidata (B4.4 só valida atuação de turma/turmas).
Sobreposição dentro da mesma turma torna a grade B4.4 `inconsistente` ⇒ blocos não operacionais e sem conflito automático.
Minutos e contagens são descritivos; não são carga horária contratual/docente.

## Source / UI
- `src/features/schedules/person-schedule-source.ts`: validOn obrigatório, knownAt único por carregamento, ID da pessoa só de `current_person_id`, estados fechados (desconhecido ⇒ erro visível), nomes de turma via `class_at` e de escola via registro escolar autorizado; nenhum nome de outra pessoa.
- `/horarios/profissionais` com sessão: "Meu horário" (`my-schedule-page.tsx`), sem seletor de terceiros e sem ações. Sem sessão: laboratório inalterado.
- Diário continua lendo B4.4 por turma.

## Testes
- `supabase/tests/b4_5_person_schedule.sql` → `b45-tests-ok` (rollback).
- `supabase/tests/b4_4_class_schedule.sql` → `b44-tests-ok` após o hardening.
- `src/features/schedules/person-schedule.test.tsx`.

## Bloqueios institucionais
Visibilidade gerencial do horário de terceiros (escola/rede); competência de escrita de jornada/grade; D3, D6, D7, D8.
