# CAL.COUNT.1 — Reconciliação do total de dias letivos de 2027

**Situação atual:** Registro de lote (2026-10-08).

**Resultado: PASS — CALENDAR_SCHOOL_DAY_TOTAL_RECONCILED**

| Fonte | Total 2027 | Datas duplicadas |
|---|---|---|
| Fonte do projeto (`calendar-fixtures`, regra `countsAsSchoolDay` do tipo) | 200 | 0 |
| Banco: 7 versões em 3 calendários (`school_day_effect` do tipo versionado) | 200 em cada versão | 0 |
| Soma mensal = contagem dia a dia = anual (`cal-count-1.test.ts`) | 200 | — |
| Períodos (Regular e EJA Fase I: 67 + 67 + 66; EJA semestral: 52 + 48 + 49 + 51) | 200 | — |
| PDFs externos Panorâmico e Mosaico (CAL.EXT.3.1, 6 folhas) | 200 | — |

- A regra de dia letivo é só o efeito declarado do tipo do dia; cor, símbolo ou nome não entram.
- O "198" era uma proposta de outubro que o usuário decidiu NÃO aplicar. Nenhuma data oficial foi alterada.
- Pendência: INTERACTIVE_BROWSER_VALIDATION_PENDING (conferência do total na tela com login).
