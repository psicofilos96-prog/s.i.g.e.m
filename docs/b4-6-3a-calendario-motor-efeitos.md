# B4.6.3a — Calendário operacional: decisão de competência + motor de efeitos

Status: **motor e contrato prontos e testados; integração INSTITUCIONAL NÃO operacional.**

## Decisão do usuário (2026-10-04)
- O calendário anual personalizado deve ser fonte operacional real: feriados, férias, recesso,
  conselhos etc. repercutem em todos os consumidores pertinentes de datas.
- **Construir e aprovar/publicar o calendário da rede: Supervisão Escolar.**
- Isso NÃO aprova as políticas de capacidades v1/v2 (continuam `draft`) nem concede nada a usuários.

## Auditoria read-only (2026-10-04)
- 0 calendários, 0 versões, 0 tipos, 0 homologações; 0 regras de capacidade de calendário; todas as políticas `draft`.
- `calendar_at`/`calendar_day_at` devolvem só `access-denied`; `calendar_day_declarations` é privado.
- O esquema 0023 não tem aplicabilidade a escola/oferta (D5) nem marcação de categoria (conselho, férias, recesso) além de `school_day_effect`.

## Entregue
`src/features/calendar/institutional-calendar-effects.ts` — motor central puro:
- `resolveCalendarDay`: estados próprios (acesso negado, fonte indisponível/malformada, sem versão,
  B2.4 inválida, não homologado, revogado, aplicabilidade não declarada, não aplicável, não declarado,
  efeito não declarado, conflito, letivo, não letivo). Efeito só de `school_day_effect` (NULL ≠ false).
- `countSchoolDays`: número só com todos os dias determinados; senão `null` + pendências.
- `projectPlannedLessons`: grade recorrente × datas; não letivo ⇒ sem aula e sem ausência; domingo/sábado sem presunção.
- `councilAgenda`: só tipos configurados como conselho (por ID); informativa.
- `calendarImpact`: sinaliza datas alteradas e preserva registros existentes.
Provas: `institutional-calendar-effects.test.ts` (8).

## Blockers exatos para virar operacional
1. Capacidades `construir-calendario-da-rede` e `homologar-calendario-da-rede` (Supervisão) precisam entrar numa política e ela ser **homologada** pela instituição.
2. Writer transacional (versão + filhos + homologação) exigindo essas capacidades.
3. Decisão de leitura (quem consulta homologado; rascunho só Supervisão) e substituição de `access-denied` por leitura real.
4. D5: aplicabilidade escola/oferta/alocação no esquema.
5. Declaração de categoria por tipo (conselho, férias/recesso com escopo) — hoje só configurável por ID no consumidor.
6. Produtores: Diário (aulas previstas), frequência, fechamento e horários ainda não consomem o motor.
