# Alimentação Escolar / NAE — produto final (NFOOD.FINAL.1)

Situação atual: Registro de lote (2026-10-09). Não declara PASS — SCHOOL_MEALS_FULLY_OPERATIONAL.

## Estado do banco (conferido)
meal_master_records 0 · meal_kitchens 0 · meal_inventory_movements 0 · meal_menu_publications 0 · dietary_restrictions 0.
Sem catálogos homologados (gêneros, unidades, apresentações), sem unidades de preparo e sem atribuição de capabilities de alimentação a atuações, os writers recusam por construção.

## Matriz requisito → implementação → gap
| Requisito | Implementação atual | Gap |
|---|---|---|
| Cardápio/planejamento | `record_meal_menu`, publicação `meal_menu_publications` (AI) | sem catálogo homologado de preparação |
| Catálogo de gêneros | `meal_master_records` + `record_meal_master` (NAE.1) | nenhum registro; carga pelo staging aguarda arquivo do acervo |
| Pedidos/solicitações | `record_meal_order` + janela (NAE.2) | nenhuma janela configurada |
| Atendimento/programação | `record_meal_delivery_schedule` (NAE.3) | depende de pedido autorizado |
| Recebimento/NF/NC | NAE.3 + evidências (NAE.8 L2) | sem dado |
| Estoque/movimentos/contagem/fechamento | NAE.4 + Cozinha (NAE.8 L3) | INVENTORY_CATALOG_PENDING |
| Restrição individual (escola) | `record_dietary_restriction` com capability própria | sem atribuição |
| Orientação coletiva (rede) | `meal_master_records` espécie de orientação | sem atribuição |
| Bloco “Alimentação da escola” na Direção | bloco de leitura em `management-panel.ts` | faltam atalhos de solicitação/restrição/entregas (DIRECAO_MEAL_ACTIONS_PENDING) |
| PDFs (solicitação, pedido, recebimento, estoque, movimentação, NC, fechamento, restrições) | relatórios NAE.8 L4 pelo report-engine; Document Studio tem Não Conformidade como rascunho | demais modelos-base não criados (MEAL_DOC_TEMPLATES_PENDING) |
| Gerador universal | 5 pacotes prontos (REPORT.PRO.2) | séries temporais, consumo e fechamento sem dado |
| Nutrição/adequação | bloqueado por regra (correto) | regra/fonte oficial |

## Bloqueios que exigem decisão
1. REAL_ROLE_ASSIGNMENT_PENDING — homologar quais atuações recebem as capabilities de alimentação (central, Direção, cozinha).
2. Catálogos de gêneros/unidades — fonte oficial ou autorização para carga do acervo como rascunho para homologação.
3. Unidades de preparo e vínculos escola↔unidade.
4. Testes autenticados (central, Direção A/B) — ambiente sem login.
