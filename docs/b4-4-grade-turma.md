# B4.4 — Grade semanal recorrente canônica da turma

**Status: B4.4 estrutural/read-only concluída; escrita institucional bloqueada.**

## Conceito
Grade = distribuição recorrente de blocos dentro da jornada. Grade ≠ jornada (B4.3) ≠ turno (B2.6) ≠ calendário (B4.6) ≠ aula ministrada (Diário).

## Modelo (migration 0020)
- `class_schedules` — identidade `csch-<uuid>`, uma por turma.
- `class_schedule_versions` — append-only, `constituicao|sucessao|retificacao`, cadeia linear, ato obrigatório, motivo fora da constituição, `recorded_by`/`recorded_by_person_id`/`created_at` (knownAt). A vigência precisa caber na turma.
- `class_schedule_blocks` — `block_key` estável na versão, weekday 1–7, `starts_at < ends_at`, `component_id` opcional, tipo/natureza opcional por scheme/value/version do catálogo (sem literais). É obrigatório informar componente OU tipo. A duração não é persistida.
- `class_schedule_block_engagements` — N:N bloco → atuação, sem papel (D8 aberta). Vários responsáveis no mesmo bloco não são conflito.
- Versão sem bloco é rejeitada no commit. Blocos e responsáveis só podem ser gravados na transação da versão. UPDATE e DELETE são bloqueados. authenticated não tem DML; anon e PUBLIC não têm acesso.
- Sobreposição entre blocos NÃO é proibida pela estrutura, porque isso seria uma decisão normativa. O reader a sinaliza.

## Reader `class_schedule_at(_class_id, _on, _known_at)`
SECURITY INVOKER, `search_path=''`, EXECUTE apenas para authenticated. Usa a mesma fronteira de leitura da jornada.
- `access-denied` (também para turma inexistente), `absent` ("Grade não registrada"), `block` (uma linha por bloco).
- `schedule_state`: `utilizavel` | `bloqueada:jornada-ausente` | `bloqueada:blocos-com-pendencia` | `inconsistente:sobreposicao-de-blocos`.
- `block_state`/`block_issues`: `bloqueada:jornada-ausente`, `bloqueada:componente-inexistente-ou-inativo`, `bloqueada:tipo-nao-homologado` (inexistente ou não homologado), `bloqueada:engagement-invalido` (fora da turma, fora da vigência ou com componente contraditório), `bloqueada:bloco-fora-da-jornada` (precisa caber num intervalo B4.3 do mesmo dia), `inconsistente:sobreposicao-de-blocos`.
- `coverage_state`: `comprovada` quando o componente está nos itens de alguma matriz efetivamente resolvida (B4.2.5), com `coverage_matrix_ids`; caso contrário `nao-comprovada`, `nao-comprovada:leitura-curricular-interrompida` ou `nao-aplicavel`. Nenhuma matriz dominante é escolhida e não há soma de carga (D7).
- Os minutos são derivados e descritivos; blocos simultâneos somam separadamente.
- Cadeia inválida, ambiguidade, grade fora da turma e exceções da jornada geram erro (fail-closed).
- `class_schedule_engagement_valid` é SECURITY DEFINER e devolve só um booleano (NULL para quem não lê a turma), porque atuações de terceiros não são legíveis pelo RLS. Não expõe pessoa nem cargo.

## Fonte antiga
`institutional_class_schedule_slots` foi marcada como DEPRECATED, com zero linhas e sem consumidor no app. Não foi apagada nem renomeada.

## TS / UI
- `src/features/student-life/class-schedule-source.ts` é a única porta. Exige validOn e knownAt; os estados formam uma união fechada; estado desconhecido gera erro.
- Diário (`institutional-teaching.ts`): com sessão, os blocos vêm só do reader. Apenas uma grade `utilizavel` gera blocos previstos, com rótulo neutro (componente, tipo ou "Bloco previsto"). Em qualquer outro caso não há bloco previsto. O laboratório sem sessão foi preservado.
- `/horarios`: com sessão, o layout mostra só `InstitutionalSchedulesPage` (turmas legíveis, data, jornada, grade, responsáveis pelo RLS existente; IDs só na auditoria). Sem sessão, o laboratório continua. As visões profissional e de unidade ficam para a B4.5.

## Writer / competência
As políticas v1 (108) e v2 (117) continuam em rascunho e não têm capability exata para grade. Nenhum writer foi criado. Continuam abertos: D3 (tipos de bloco), D7 (carga/composição), D8 (corresponsabilidade/substituição) e a competência de escrita.

## Testes
`supabase/tests/b4_4_class_schedule.sql` → `b44-tests-ok` (rollback). `src/features/student-life/class-schedule.test.tsx`.
