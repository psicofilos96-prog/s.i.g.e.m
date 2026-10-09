# CIECE — produto final (NCIECE.FINAL.1)

Situação atual: Registro de lote (2026-10-09). Não declara PASS — CIECE_FULLY_OPERATIONAL.

## Estado (conferido)
Base 2026: 55 escolas, 698 turmas, 9.763 alunos, 9.811 matrículas, 10.295 enturmações (convertidas em 2026-10-09), 55 recibos Educacenso + 1 painel. map_competence_rules 0 · movement_type_definitions 0 · census_cycles 0 · import_batches 0 · lotações 0.

## Módulos × situação
| Módulo | Existente | Bloqueio |
|---|---|---|
| Mapa I–VI + Remanejados | NMAP.FINAL.1 (`map-movements.ts`), fluxo enviar/devolver/aprovar, ajuste governado | MAP_RULE_PENDING; MOVEMENT_TYPES_PENDING (grupos 1–4 "sem regra"); Remanejados agora tem enturmações, mas 0 encerramentos ⇒ vazio real |
| Censo/Qualidade | recibos oficiais (0257), `census-reconciliation` (MATCH 55/55), `data-quality` | CIECE_QUALIDADE_INTEGRACAO_PENDENTE: Qualidade e CIECE não leem o snapshot oficial |
| Importações | `import-kernel.ts` (hash, idempotência, exceções, compensação) | carga 2026 feita pela camada técnica, não pelo kernel (import_batches 0) |
| Indicadores | motor 14.2 + `network_indicators_at` | enturmação 2026 tem início = fotografia 31/07; movimentação sem tipos; profissionais sem lotação |
| Correção cadastral | writers oficiais (`register_school_record_version` etc.) | principal CIECE sem atuação vigente com capability (atuações vigentes: 2) |
| Relatórios | pacotes CIECE: turmas por escola/etapa, escolas por dependência (prontos) | matrículas/movimentação/Mapa/Censo/qualidade bloqueados |
| Dry-run 2027 | `/preparacao-2027` + Referência 2026 | 2027 não aberto (decisão do proprietário) |

## Decisões necessárias
1. Homologar regra do Mapa (competências, células, fotografia) e tipos de movimentação.
2. Atuação/capabilities do principal CIECE na política homologada.
3. Integrar Qualidade ao snapshot Educacenso (desenvolvimento — próximo lote técnico).
4. Testes autenticados — ambiente sem login.
