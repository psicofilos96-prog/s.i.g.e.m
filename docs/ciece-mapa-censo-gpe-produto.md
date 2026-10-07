# CIECE / Mapa / Censo / GPE — matriz de produto (Lote N4)

Fontes: código de src/features/statistical-map, ciece, census-*, data-import; AGENTS.md por diretório; memórias setoriais em docs/.

| Requisito | Implementação | Teste | Situação |
|---|---|---|---|
| B. Painel da rede: andamento, filtro por situação | network-projection-page.tsx (Oficializado/Aguardando, barra de progresso, filtro) | statistical-map (64) | PASS parcial |
| D. "De onde veio este valor" | painel lateral com registros que compõem cada número | idem | PASS |
| B. Fluxo enviado/devolvido/reenviado/aprovado/retificação | DECIDIDO; `projectWorkflow` projeta da cadeia persistida | map-structures.test | PARTIAL: devolução como ato próprio da Estatística exige migration (N4.3) |
| C. Seis estruturas I–VI | `groupByStructure` + índice fixo na tela | map-structures.test | PASS |
| E. PDF institucional dedicado | `renderMapDocument` A4, atual e por revisão | map-structures.test | PASS (sem inspeção visual autenticada) |
| Override calculado × efetivo | não persistido | — | PENDENTE N4.3 |
| F. Censo — qualidade | /censo-escolar (ciclo, fotografia, comparação) | census tests | existente, sem redesenho |
| G. GPE | EXTERNAL_INTEGRATION_UNDEFINED: sem leiaute real | — | BLOQUEADO por leiaute |
| Remanejamento (peso) | não inventado; não bloqueia as demais estruturas | — | DECISÃO PENDENTE |
| I. Testes autenticados (CIECE, 2 Secretarias, Direção) | — | — | exige aprovação de sessão |
