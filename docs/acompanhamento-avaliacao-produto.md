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
| D6. Heatmap habilidade × unidade | PENDENTE | — |
| G. BNCC ↔ SAEB | sem mapeamento homologado no código: não inventado | DECISÃO/FONTE PENDENTE |
| H. Relatórios PDF/XLSX com metodologia | PENDENTE (usar report-engine) | — |
| J. Conta avalia@ real | exige aprovação de sessão | BLOQUEADO |

Governança: nenhum score, previsão ou decisão automática sobre estudante.
