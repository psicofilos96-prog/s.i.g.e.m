# Mapa de compras da Alimentação — layout

Situação atual: Referência vigente (2026-10-11, SIGEM 2.0 — F).

- Fonte única: `meal_demand_consolidation_at` (pedidos autorizados/retificados vigentes). Nenhuma outra leitura gera linha.
- Relatório `mapa-compras-alimentacao` v1 (`src/features/school-meals/purchase-map.ts`), exportado só pelo `report-engine`.
- Colunas, nesta ordem: Fornecedor · Contrato (natureza + número) · Empenho · Item · Unidade · Total · Destinos (escola: quantidade; …).
- Ordenação estável: fornecedor → contrato → item (pt-BR).
- Fornecedor/contrato/empenho vêm só da referência contratual homologada; ausência aparece como "não informado", nunca vazio nem zero.
- Item/unidade sem cadastro homologado aparecem como "item não identificado"/"unidade não identificada"; total não numérico = célula vazia (não apurado), nunca 0.
- O mapa não cria pedido, empenho, compra nem estoque.
