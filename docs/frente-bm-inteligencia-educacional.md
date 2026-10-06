# Frente BM.0–BM.1 — Inteligência Educacional e setor Acompanhamento e Avaliação

## BM.0 — Auditoria (o que já existia e foi reutilizado)
| Peça existente | Uso na BM |
|---|---|
| 0075 `inst_assessment_versions/results`, `performance_metric_versions`, `performance_goals`, `performance_disclosure_versions` | instrumento, resultado por aluno/item, métrica com fórmula, meta com fonte, supressão; **não duplicado** |
| `report-engine.ts` | exportação CSV/XLSX/PDF do resultado semântico (`toReportResult`) |
| `network-analytics.ts` / estados AVAILABLE/ZERO/UNKNOWN | mesmos estados na camada semântica |
| Pipeline de importação (0067, adaptador `resultado-avaliacao-institucional`) | importação governada de resultados: hash → staging → classificação → confirmação → writer `record_inst_assessment_result` (idempotente por `plan_key`) |
| Repositório curricular Y (`curricular_reference_editions`) | edição pode apontar a uma edição de referência existente; nenhuma correspondência criada |
| `effective_scope_capabilities` | gate de todas as funções novas |

Divergência registrada, não corrigida: o reader do 0075 checa capability por `CURRENT_DATE` (autorização de agora, não do fato) — comportamento correto para acesso.

## BM.1 — Entregue
- **Migration 0179**: `assessment_program_versions`, `assessment_edition_versions`, `assessment_metric_comparability`, `intelligence_dashboard_versions`, `assessment_analysis_definitions`. Todas append-only, RLS sem policy, sem DML para anon/authenticated/service_role (0180 corrigiu o privilégio padrão de service_role). Writers DEFINER com `search_path=''`, base esperada e pessoa natural. Readers com `knownAt`.
- **Camada semântica** `semantic-layer.ts` + catálogo `catalog.ts`.
- **Rota** `/acompanhamento-avaliacao` com 9 abas, lendo os readers reais com a sessão.
- **Testes**: `semantic-layer.test.ts` (7) e `supabase/tests/bm_intelligence_foundation_e2e.sql` (8/8, termina em RAISE).

## Não entregue nesta frente (software)
- Editor de painéis (posicionar/redimensionar, duplicar, restaurar padrão): só o modelo e o writer existem.
- Gerador de Relatórios com seleção livre de dimensões e medidas na tela; snapshot/manifesto institucional na tela.
- Prova E2E positiva com política sintética: só a recusa foi provada.
- Abas Evolução, Habilidades, Escolas, Alunos e Qualidade mostram contrato e bloqueios, sem gráfico real.
- Fixture de importação demonstrativa no pipeline 0067.

## Bloqueios
- ASSESSMENT_CONTENT — BLOCKED_BY_OFFICIAL_SOURCES: SAEB/IDEB, AVALIA RJ, CAEd, Saber Ler, matrizes e descritores.
- INSTITUTIONAL_METRICS/RULES — BLOCKED_BY_HOMOLOGATED_RULES: escalas, faixas, metas, comparabilidade e supressão.
- REAL_ROLE_ASSIGNMENT_PENDING: as cinco capabilities novas não estão em nenhuma política homologada.
