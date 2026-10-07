# Acompanhamento e Avaliação — matriz de produto (Lote N6)

Fontes: src/features/performance (0075), educational-intelligence (0179–0180), AGENTS.md dos dois módulos.

| Requisito | Estado | Teste |
|---|---|---|
| D/E. Gráfico de barras por grupo (escola/turma/habilidade), com base no tooltip, sem ranking | FEITO (performance-page.tsx) | performance (10) |
| I. "Quem entrou na conta": base, ausentes, não aplicados; ausência ≠ zero | FEITO | idem |
| Comparação temporal só com mesma fórmula/população | existente | performance |
| Supressão de grupo pequeno só com política registrada | existente | performance |
| A. Home da avaliação (rede, tendências, cobertura, pendências) | PENDENTE | — |
| B. Situação planejada/em aplicação/…/publicada | PENDENTE — sem ciclo de estados no schema | — |
| D6. Heatmap habilidade × escola | N6.2: `heatmap`/`heatBand` + tabela acessível (texto em cada célula, base visível, "sem dado" ≠ 0, supressão pela política); filtros componente/ano/período e eixo etapa PENDENTES | performance (12) |
| G. BNCC ↔ SAEB | sem mapeamento homologado no código: não inventado | DECISÃO/FONTE PENDENTE |
| H. Relatórios PDF/XLSX com metodologia | PENDENTE (usar report-engine) | — |
| J. Conta avalia@ real | exige aprovação de sessão | BLOQUEADO |

Governança: nenhum score, previsão ou decisão automática sobre estudante.

## N6.2 — PARTIAL (CONTINUE_FROM=N6.2.1)
Entregue só o heatmap. Home, ciclo de estados (exige migration), evolução/barras de diferença, drill-down, relatórios, integração de importação e conta avalia@ seguem pendentes. BNCC↔SAEB: sem fonte homologada, sem equivalência.
