# Alimentação Escolar — matriz de aceite (Lote 15)

Situação atual: Registro de lote.

O documento de 35 seções não está nos arquivos do projeto; a matriz segue os 15 lotes pedidos.
Camada provada: núcleos puros com perfis sintéticos (`meals-acceptance.test.ts`). RLS no banco e E2E autenticado ficam BLOQUEADOS (sem `SIGEM_TEST_HARNESS=1`). Nenhuma homologação humana ocorreu.

| Lote | Tela | Fonte/writer | Permissão | Teste | Status |
|---|---|---|---|---|---|
| 01 Perfis | — | NAE_CAPABILITIES | decide() | meals-competences, aceite | núcleo; perfis da rede pendentes |
| 02 Painel | /alimentacao-escolar (existente) | readers NAE | escopo escola/rede | meals-panel | núcleo sem tela nova |
| 03 Fichas | — | record_meal_master | registro profissional | technical-sheet | núcleo |
| 04 Cardápio | publicações (existente) | meal_menu_publications | nutricionista | menu-plan | núcleo; editor visual pendente |
| 05 Abastecimento | — | leituras | — | supply-planner | simulação |
| 06 Contratos | mapa de compras (existente) | referencia-contratual | — | contracts-ledger | núcleo |
| 07 Estoque | estoque (existente) | record_meal_stock_* | almoxarifado | stock-lots, aceite | núcleo |
| 08 Remessas | — | record_meal_stock_transfer | logística/cozinha | shipments, aceite | núcleo |
| 09 Produção | cozinha (existente) | record_meal_execution | cozinha da escola | daily-production, aceite | núcleo |
| 10 Dieta/sanitário | saúde declarada (existente) | dietary_restrictions | consultar-restricao-alimentar | special-diet-safety, aceite | núcleo |
| 11 Visitas/protocolos | — | demand-center | nutricionista | visits-education-requests | núcleo |
| 12 Custos | relatórios (existente) | baixas × preço | — | costs-indicators | núcleo |
| 13 GED/PNAE/CAE | relatórios (existente) | ged-core, report-engine | CAE só leitura | ged-reports-pnae | núcleo; PDF via report-engine |
| 14 Integrações | painel "Setores integrados" | MEALS_INTEGRATIONS | pathAllowed | meals-integrations | em tela |
| 15 Aceite | — | — | — | meals-acceptance | PASS (camada pura) |

Bloqueios: harness de contas sintéticas ausente; RT nutricionista e perfis não designados; nenhuma capability de alimentação homologada.
