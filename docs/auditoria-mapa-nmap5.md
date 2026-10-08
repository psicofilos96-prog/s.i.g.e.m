# NMAP.5 — Auditoria funcional e visual do Mapa Estatístico I–VI

**Situação atual:** Registro de lote (2026-10-08). Compara `src/features/statistical-map/` com as memórias do acervo SIGEM 1.0/2.0 (`docs/sigem-memoria-fontes-historicas.md`, `docs/sigem-memoria-setorial-e-auditoria.md`).

| Requisito | Situação | Evidência |
|---|---|---|
| Seis estruturas I–VI | Implementado | `map-structures.ts` (`MAP_STRUCTURES`, `structureOf`); testes `map-structures`, `map-nmap5` |
| Fontes só canônicas | Implementado | `statistical-map.functions.ts` (escolas, turmas, `teaching_assignments_at`, lotação, visitas, motor 14.2); total nunca editável |
| Ajuste manual de célula | Implementado; depende de regra que declare células ajustáveis | ledger `statistical_map_cell_adjustments`; PDF mostra calculado + motivo (`map-nmap5`) |
| Devolução / reenvio / aprovação | Implementado | `projectWorkflow`; devolução após aprovação ignorada (`map-nmap5`); segregação conferente ≠ oficializador (`map-segregation`) |
| Próxima competência | Implementado, falha fechada | `canOpenNext`; anterior devolvida bloqueia (`map-nmap5`) |
| Mediadores | Implementado (contagem); carência DEPENDE_DECISAO | `map_mediation_projection_at`; nota "aguardando regra institucional" |
| PDF oficial A4 | Implementado | `renderMapDocument`; ausência nunca vira zero (`map-nmap5`); NPDF.3: 5 páginas no caso extremo |
| Histórico / versões | Implementado | `statistical_map_versions` encadeadas, digest gravado na conferência (0124) |
| Isolamento por escola | Implementado | todas as leituras filtram `school_id`; regra por `coveredSchoolIds` |
| Peso estatístico de remanejados | DEPENDE_DECISAO (mantido separado) | o motor conta origem/destino genéricos; excluir ou pesar remanejamento é norma, não código |

**Correções técnicas:** nenhuma necessária: não há gap técnico já decidido que esteja aberto.

**Telas (sem login):** `/mapa-estatistico` e `/mapa-estatistico-rede` no computador e no celular, sem rolagem lateral; fotos em `nmap5-screenshots/` (Files).

**Pendências:**
- HOMOLOGACAO: há 0 regras de competência do Mapa no banco, então nenhuma competência real de 2027 abre.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: fluxo com login (CIECE/Secretaria).
- PROVAS_SQL_PENDENTES: `supabase/tests/t_map_rule_guard.sql`, `t1_map_open_officialize_binding.sql`.
- REVISAR: as duas telas não têm título principal (h1); o nome no topo é texto comum. Isso vale para todo o app (como em /alunos), então fica fora deste lote.
