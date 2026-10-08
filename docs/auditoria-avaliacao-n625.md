# N6.2.5 — Auditoria final da estação Avaliação

**Situação atual:** Registro de lote (2026-10-08).

Nenhum gap técnico já decidido foi encontrado; nenhum código de negócio mudou.

| Requisito | Situação | Evidência |
|---|---|---|
| Home | OK — só conta fatos; revogada não conta; aponta política ausente | `performance-station.ts` `stationHome`, `station-sections.tsx` |
| Ciclo da edição | OK — vive na Inteligência Educacional (`/acompanhamento-avaliacao`, migration 0227) | `assessment-cycle.ts`, `assessment-cycle-panel.tsx` |
| Importação | OK — adaptador `resultado-avaliacao-institucional` | `performance-station.ts` `IMPORT_ADAPTER_ID` |
| Heatmap | OK — célula mostra o valor em texto (não só cor); sem dado ≠ zero | `performance-model.ts` `heatmap`, `HEATMAP_REPORT` |
| Evolução | OK — só com 3+ edições, ordem cronológica; fórmula diferente rompe o passo | `evolutionSeries` |
| Comparação | OK — exige mesma fórmula, população e chave | `compareTemporal`/`compareSeries` |
| Drill-down | OK — registros de origem | `performance-page.tsx` |
| Relatórios/exports | OK — CSV/PDF só pelo `report-engine`; bloqueado sem política de divulgação | `exportHeatmap`, `exportEvolution` |
| Cobertura | OK — base/ausentes/não aplicados, nunca zero | `Coverage` |
| Metodologia | OK — fórmula e fonte ao lado de cada métrica | `FORMULA_LABEL` |
| Acessibilidade | OK — um h1 por tela, `caption`, `scope`, gráfico com `aria-label`, sem botões só-ícone; sem rolagem lateral no celular | screenshots `n625-screenshots/` |
| BNCC↔SAEB | DEPENDE_DADO — catalogado sem formato de exportação | `avaliacao-bncc-saeb` |

Exports de teste (dados sintéticos, marcados "teste"): `n625-exports/` (heatmap e evolução, CSV + PDF A4 de 1 página). Regressão: `src/features/performance/station-n625.test.ts`.

Pendências: INTERACTIVE_BROWSER_VALIDATION_PENDING (sem login a estação mostra só o pedido de entrada); ASSIGNMENT_PENDING (política v8 sem perfil da Avaliação); DEPENDE_DADO (BNCC↔SAEB); REVISAR (atalho do ciclo da edição a partir de `/avaliacao-desempenho` é decisão de produto).
