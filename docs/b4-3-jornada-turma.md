# B4.3 — Jornada canônica da turma

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


**Status: B4.3 estrutural/read-only concluída; escrita institucional bloqueada.**

## Conceito
Jornada é o funcionamento semanal recorrente da turma. Jornada ≠ turno (B2.6) ≠ grade/horário (B4.4) ≠ calendário (B4.6) ≠ aula ministrada (Diário). Nenhuma relação automática com turno, matriz, calendário ou carga horária.

## Modelo (migrations 0018 + 0019)
- `class_journeys` — identidade lógica `cj-<uuid>`, uma por turma canônica (`class_id` único).
- `class_journey_versions` — append-only; `constituicao | sucessao | retificacao`; cadeia linear (`supersedes_id` único, versão = predecessora + 1, mesma jornada); sucessão começa depois da predecessora; motivo obrigatório fora da constituição; ato obrigatório; `recorded_by`, `recorded_by_person_id`, `created_at` (knownAt).
- `class_journey_intervals` — primitivas: `weekday` 1–7, `starts_at < ends_at`; vários por dia; sem sobreposição no mesmo dia (adjacência permitida); gaps são interrupções sem nome. Sem enum de tipo de intervalo e sem duração persistida.
- Versão sem intervalo é rejeitada no commit (constraint trigger diferida). Intervalo só pode ser gravado na mesma transação que criou a versão (marcador transacional do guard; a 0019 corrigiu a 0018, que usava `xmin` e falhava em subtransação).
- A vigência da versão precisa caber na existência da turma (`class_at`, por pontos de segmento) no instante da gravação; o reader revalida na data/knownAt consultados.
- UPDATE/DELETE bloqueados (`forbid_mutation`); authenticated sem INSERT/UPDATE/DELETE; anon/PUBLIC sem acesso.

## Reader
`class_journey_at(_class_id, _on, _known_at)` — SECURITY INVOKER, STABLE, `search_path=''`, EXECUTE só authenticated. Fronteira de leitura = a mesma do turno da turma (`can_read_institutional_class` OU `consultar-matricula-e-movimentacao` na escola).
- `access-denied`: linha única sem dados (também para turma inexistente — não revela existência).
- `absent`: turma legível sem jornada efetiva na data/knownAt ("Jornada não registrada").
- `interval`: uma linha por intervalo, ordem dia/início, com proveniência da versão e derivados descritivos `day_first_start`, `day_last_end`, `day_minutes`, `week_minutes`.
- Retificação conhecida oculta a retificada; sucessão encerra a anterior na véspera; correção posterior não reescreve leitura anterior por knownAt.
- Cadeia inválida (`journey:invalid-chain`), >1 versão efetiva (`journey:ambiguous-temporal-state`) e jornada fora da turma (`journey:outside-class-validity`) são exceção, nunca ausência.

## Derivados
Início, fim e minutos são descritivos. Não são carga horária normativa, não geram conformidade e não são comparados com matriz ou calendário.

## Writer / competência
Auditadas as políticas v1 (108) e v2 (117), ambas rascunho: não existe capability semanticamente exata para manter jornada. Capabilities próximas (`manter-turno-da-turma`, `manter-cadastro-de-turmas`, `manter-organizacao-de-periodos-da-turma`) NÃO foram reutilizadas. Nenhum writer foi criado. Abertos: competência institucional para construir/manter jornada, D6 (publicação formal), obrigatoriedade de jornada por turma, durações normativas.

## TS / UI
- `src/features/student-life/class-journey-source.ts` — única porta TS; validOn/knownAt obrigatórios; knownAt capturado uma vez por carregamento; result_kind desconhecido ou várias versões ⇒ erro.
- `class-journey-panel.tsx` — painel somente leitura em Matrícula → Enturmações (sessão institucional). IDs só no detalhe de auditoria.
- `/horarios`: desde a B4.4, com sessão mostra só a página institucional (jornada + grade canônicas); sem sessão, laboratório.

## Testes
- `supabase/tests/b4_3_class_journey.sql` → `b43-tests-ok` (rollback, zero resíduos).
- `src/features/student-life/class-journey.test.tsx`.
