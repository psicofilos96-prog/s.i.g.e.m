# B4.5 — Horário do profissional como projeção

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


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

## B4.5.1 — Correção de contrato (TS, sem SQL)

- `mapPersonScheduleRows` é fail-closed: valida por `result_kind` campos obrigatórios, inteiros não negativos, weekday 1–7, início < fim, `block_minutes` = fim − início, proveniência (turma/grade/versão/bloco) e atuações próprias não vazias e únicas; `valid_on`/`known_at` devem coincidir com o snapshot pedido (instantes equivalentes aceitos). `access-denied`/`absent` só como linha única sem dados; payload nulo/vazio é erro. Resumo é conferido contra blocos/conflitos recebidos; conflitos exigem par canônico único de blocos existentes, distintos, operacionais, mesmo dia e interseção real. Ausência nunca vira zero; zero explícito é aceito.
- Nomes (`readPlaceNames`) usam o MESMO `(validOn, knownAt)` da carga: `class_at(_valid_on, _known_at)`; escola pela maior `version_number` com `valid_from ≤ validOn` e `registered_at ≤ knownAt` (não há reader `*_at` de escola; limite: o registro escolar não oferece bitemporalidade além disso). Falha de nomes é exibida como aviso próprio, com rótulo neutro e erro só no detalhe técnico.
- Cache isolado por conta: query keys incluem `userId`; a página é remontada por conta (`key`) e só exibe dados do snapshot atual, com estado "Consultando seu horário…" durante a carga.
- SQL (0021/0022), policies e capabilities intocados.

## B4.5.2 — Precisão TIME (TS)

- Horários aceitam a precisão do TIME do PostgreSQL (segundos, fração até microssegundos; `24:00:00` só como limite legal) e são comparados em microssegundos inteiros. `block_minutes` é validado pela fórmula real do SQL (`(extract(epoch…)/60)::integer`, metade arredonda para cima). A exibição mantém HH:MM quando segundos/fração são zero e mostra a precisão relevante quando não são. `valid_on` deve ser exatamente a data ISO pedida. O aviso de falha de nomes não afirma confirmação global.

## NHOR.2 — auditoria (2026-10-07)
- Já existentes: jornadas por escola (school-journey-panel), grade por turma, grade do professor, Meu horário, editor/revisão/publicação/versões/comparação, alterações pontuais, documento por turma/professor/escola (schedule-document-page / print-view), próxima aula no Meu Diário.
- Novo: `schedule-conflicts.ts` — conflito de pessoa/turma/sala só sobre blocos registrados; sala só quando declarada; blocos encostados não conflitam. 4 testes.
- Regras mantidas: horário nunca inferido de carga; "Todas as jornadas" não importado automaticamente; sem grade ⇒ "nenhuma aula prevista".
- Pendente: exibir conflitos do detector na tela institucional; testes com contas temporárias (revisão/publicação/isolamento) só pelo harness; PDF com login = INTERACTIVE_BROWSER_VALIDATION_PENDING; integração com Nova Turma não revisada.

### NHOR.2 — rodada 2 (2026-10-07)
- Conflitos já aparecem nas telas: "Meu horário" (conflitos calculados pelo banco sobre blocos registrados), detalhe do profissional e horário da unidade.
- Nova Turma → Horários: a página da turma institucional ganhou "Horário da turma" (/horarios/turmas/$turmaId); sem grade registrada a tela diz que não há horário, sem inferir carga.
- Pendente: testes com contas temporárias (revisão/publicação/isolamento) só pelo harness; PDFs com login = INTERACTIVE_BROWSER_VALIDATION_PENDING. Nenhuma planilha importada automaticamente.
