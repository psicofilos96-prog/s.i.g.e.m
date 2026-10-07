# CIECE / Mapa / Censo / GPE — matriz de produto (Lote N4)

Fontes: código de src/features/statistical-map, ciece, census-*, data-import; AGENTS.md por diretório; memórias setoriais em docs/.

| Requisito | Implementação | Teste | Situação |
|---|---|---|---|
| B. Painel da rede: andamento, filtro por situação | network-projection-page.tsx (Oficializado/Aguardando, barra de progresso, filtro) | statistical-map (64) | PASS parcial |
| D. "De onde veio este valor" | painel lateral com registros que compõem cada número | idem | PASS |
| B. Estados enviado/devolvido/reaprovado | o domínio só tem conferência, abertura de correção e oficialização; não há estado "enviado/devolvido" | — | DECISÃO PENDENTE: confirmar se "devolver" = abertura-correcao |
| C. Seis estruturas I–VI como seções | statistical-map-page.tsx (estrutura atual) | — | PENDENTE |
| E. PDF institucional dedicado | hoje impressão do navegador | — | PENDENTE |
| F. Censo — qualidade | /censo-escolar (ciclo, fotografia, comparação) | census tests | existente, sem redesenho |
| G. GPE | EXTERNAL_INTEGRATION_UNDEFINED: sem leiaute real | — | BLOQUEADO por leiaute |
| Remanejamento (peso) | não inventado | — | DECISÃO PENDENTE |
| I. Testes autenticados (CIECE, 2 Secretarias, Direção) | — | — | exige aprovação de sessão |
