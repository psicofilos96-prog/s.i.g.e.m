# B4.6.2a — Calendário: source institucional + fronteira das três rotas

Base auditada: B4.6.1 em `a7a8e70` (estrutura aceita tecnicamente; **não** é homologação institucional).
Esta etapa não alterou migrations 0000–0023, funções, policies (v1/v2 = 108/117 draft) nem capabilities. Também não criou writer, publicação ou B4.7.

## Source (`src/features/calendar/institutional-calendar-source.ts`)
- Lê só `calendar_at(_calendar_id, _on, _known_at)` e `calendar_day_at(_calendar_id, _date, _known_at)`. Não existe RPC de listagem; tabelas e helpers privados nunca são lidos.
- Contrato real: exatamente uma linha `{result_kind, valid_on, known_at}`. O único estado aceito é `access-denied`.
- Viram `InstitutionalCalendarShapeError` (erro visível):
  - `[]`, `null` ou linha extra;
  - estado desconhecido;
  - campo de conteúdo extra ou campo faltante;
  - `valid_on` diferente da data pedida;
  - `known_at` que não representa o mesmo instante (instantes equivalentes com outro fuso são aceitos).

  Nenhum desses casos vira "ausente", false ou zero.
- Parâmetros: data ISO estrita e real, e knownAt ISO com fuso. Parâmetro inválido não chama a RPC.
- Listagem chama `calendar_at` com `_calendar_id = NULL`: o contrato nega qualquer ID e não revela IDs nem contagens. Detalhe e documento usam só o ID da URL.
- Não adapta o resultado a `NetworkCalendar` e não alimenta seletor do laboratório. B2.4 continua sendo a fonte de anos e períodos.

## Matriz rotas × estados (`institutional-calendar-routes.tsx`, fronteira única `useSessionUser`)

| Rota | sessão incerta | sem sessão confirmada | com sessão |
|---|---|---|---|
| `/calendario-escolar` | "Verificando sessão…" | `CalendarListPage` (lab; `?perfil` vale) | consulta institucional (`calendar_at`, ID NULL) |
| `/calendario-escolar/$id` | idem | `CalendarWorkspacePage` (lab) | consulta institucional (`calendar_at`, ID da URL) |
| `/calendario-escolar/$id/documento` | idem | `CalendarPrintPage` (lab) | consulta institucional; sem folha, PDF ou impressão |

- **Sessão incerta:** o laboratório não é montado. Não há hydrate, list, get nem leitura de localStorage, e nenhuma RPC é chamada.
- **Com sessão:**
  - `?perfil` é ignorado.
  - Não há botão de editar, criar, homologar ou imprimir, nem seletor de ID.
  - Conta vinculada ou não vinculada recebe o mesmo `access-denied`. A mensagem é: "Consulta ao calendário institucional indisponível. A autorização de consulta ainda não foi definida." Ela nunca afirma que o calendário não existe ou não foi homologado, nem cita falta de vínculo.
- **Cache:** chave `["b462-calendar", userId, modo, calendarId, validOn, knownAt]`, com um knownAt por carga. Troca de conta remonta a página (`key=userId`). Mudança de data, ID ou rota gera chave nova. Durante carga ou erro, dados antigos não aparecem.
- **Metadados:** descrições neutras. Foram removidos "um calendário por ano e modalidade" e "homologado pela Supervisão de Ensino".

## Testes
`institutional-calendar.test.tsx` cobre:
- payload null, vazio, múltiplo, desconhecido, com campos extras, com data inválida e knownAt divergente;
- argumentos passados ao chamar a RPC; propagação de erro;
- as três rotas nos estados de sessão incerta, sem sessão e com sessão (+perfil);
- troca de conta no mesmo QueryClient;
- data e ID em mudança, com erro e sem dado antigo.

## Pendência concreta (B4.6.2b/B4.10)
Estes consumidores **ainda leem o calendário de laboratório** (`calendar-store`/`calendar-queries`/`calendar-engine`), inclusive com sessão. Esta etapa não os refatorou:
- `src/features/assessment/assessment-instruments.ts`
- `src/features/assessment/assessment-rule-model.ts` e `assessment-rule-pages.tsx`
- `src/features/assessment/cycle-configuration.ts`
- `src/features/assessment/recovery-journey-lab.ts`
- `src/features/cycle-closing/cycle-closing-pages.tsx`
- `src/features/diary/attendance-closing-pages.tsx`
- os demais caminhos internos de `src/features/calendar/`, como `diaryDateStatus` e `calendarIdForSchool`.

Não se afirma que a aplicação inteira deixou de usar o calendário de laboratório quando há sessão.

## Complemento SQL B4.6.1
O teste `b4_6_1_calendar_structure.sql` ganhou `year-inactive` e `organization-inactive`. Em cada um, uma subtransação insere a mudança B2.4 dentro da vigência de v3. Consultado antes de a mudança ser conhecida, o resultado é NULL; depois, o código esperado. A subtransação é desfeita em seguida.

Resultado real no Cloud: `b46-tests-ok` (rollback), com as 9 tabelas vazias depois. Nenhuma constraint ou norma foi ampliada.
