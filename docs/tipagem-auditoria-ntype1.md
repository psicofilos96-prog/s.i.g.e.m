# Auditoria de tipagem — NTYPE.1

**Situação atual:** Registro de lote (2026-10-08).

Escopo: importações, relatórios, calendário, autoridade (sem testes). Contagem: `any` 2 (calendário), `!` 42 (calendário 37, importações 3, relatórios 1, autoridade 1).

## Corrigido (risco real)
- `calendar-browser-import.ts` `buildDaysPayload`: dia com tipo fora do plano dava TypeError (`mapping[code]!`); agora falha fechada com problema legível. Teste adicionado.
- `calendar-image-shrink.ts`: navegador sem canvas 2D dava TypeError; agora mensagem humana.
- `institutional-calendar-composed.ts` `deepFrozenClone`: `any` → `unknown`.

## Mantido (guardado antes do uso)
- `composition-engine` `homologation!`: `validateNorm` recusa null antes.
- `session-authority` `user!.id`: query só roda com `enabled: Boolean(user)`.
- Índices `arr[0]!`/`arr[len-1]!` após checagem de tamanho; `DAY_TYPES[t]!` sobre tipo fechado.
- `calendar-pages.tsx` `to as any`: genérico de rota do TanStack (link de demonstração do laboratório).
- Estados/resultados já discriminados (`DaysPayloadResult`, `DayState`, `ImportStatus`).
