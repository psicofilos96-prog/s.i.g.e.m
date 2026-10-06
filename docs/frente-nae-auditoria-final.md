# Frente NAE — Auditoria final do Núcleo de Alimentação Escolar (NAE.7)

Data: 2026-10-06. Registro de continuidade, não fonte normativa.

## Status
- PASS — NUCLEO_ALIMENTACAO_ESCOLAR_TECHNICAL_FOUNDATION_COMPLETE (com ressalva E2E-SQL abaixo)
- PASS — READY_FOR_CONTROLLED_HUMAN_CONFIGURATION
- REAL_MENU/CATALOG_DATA — AWAITING_OFFICIAL_NORMALIZED_SOURCE
- INSTITUTIONAL_RULES — BLOCKED_BY_HOMOLOGATED_RULES (lista na seção D)
- HISTORICAL_MIGRATION — NOT_STARTED_BY_DESIGN
- HUMAN_UI_VALIDATION_PENDING
- E2E_SQL_WITH_SESSION — PENDING_ENVIRONMENT: o papel técnico do ambiente não executa funções do banco; o cenário integrado foi provado sobre os modelos puros que espelham writers/readers (`src/features/school-meals/nae7-integrated.test.ts`), sem gravar nada.

## Gates executados
| Gate | Resultado |
|---|---|
| Suíte completa | 306/306 arquivos aprovados (inclui 14 testes NAE.7) |
| Invariantes profundas | 4/4 arquivos aprovados |
| Typecheck (tsgo) | limpo |
| Build | OK |
| diff-check | limpo |
| Migrations 0181–0187 | 7 presentes; nenhum GRANT de DML direto em `meal_*`; nenhum seed fora de função |
| Funções DEFINER `meal_*`/`record_meal_*` | 64, todas com `search_path=''`; nenhuma executável por anon |
| Security Advisor | 485 achados: 118 INFO (RLS sem policy = tabelas só por writer, intencional); 3 WARN anon DEFINER (`public_portal_list`, `public_portal_get`, `verify_school_document` — portal público intencional); 364 WARN authenticated DEFINER (writers/readers canônicos com checagem de capability interna, padrão do projeto) |
| Smoke de rotas | `/`, `/alimentacao-escolar`, `/relatorios`, `/simulador` → 200 |
| Resíduos sintéticos | 0 linhas em tabelas `meal_*` |
| 2026 | único ano operacional registrado = `historico-importado` |
| 2027 real | não alterado |
| Escolas | 55 intactas |
| Ambiente | Lovable Cloud do projeto (canônico) |

`CURRENT_DATE` aparece em autorização apenas para atos presentes sem data de fato (conferência de base mestra, parâmetros, consolidação); writers de fato datado autorizam pela data do fato — fixado por teste.

## Matriz
| Domínio | Fonte | Writer | Reader | UI | Capability | E2E | Status | Blocker |
|---|---|---|---|---|---|---|---|---|
| Base mestra/catálogos | `meal_master_records` | `record_meal_master`, `stage_meal_content` | readers `*_at` | Planejamento | manter/conferir conteúdo técnico | modelo | PASS | conteúdo oficial |
| Unidade de preparo | `meal_kitchens` + versões/links | writers 0170 | readers 0170 | Operação | manter-unidades-de-alimentacao | modelo | PASS | — |
| Cardápio/publicação | `meal_menu_versions`, `meal_menu_publications` | `record_meal_menu`, publicação | `family_published_menus` | Planejamento | registrar cardápio | modelo | PASS | cardápios Word não revisados |
| Janela de pedido | `record_meal_order_window` | idem | `meal_order_window_for` | Pedidos | manter-parametros-nutricionais | modelo | PASS | prazo 15/20 |
| Pedido/autorização | cadeia `record_meal_order` | idem | readers pedido | Pedidos | solicitar/autorizar | modelo | PASS | teto/per capita |
| Consolidação | `meal_demand_consolidations` | consolidação | `meal_demand_consolidation_at` | Compras | consolidar-demanda-alimentar | modelo | PASS | — |
| Entrega/recebimento | `meal_delivery_schedules`, `meal_receipts` | `record_meal_delivery_schedule`, `record_meal_receipt` | readers 0184 | Entregas | programar/conferir recebimento | modelo | PASS | — |
| Não conformidade/NF | `meal_nonconformities`, `meal_fiscal_documents` | writers 0184 | readers 0184 | Não conformidades/Documentos | registrar-nao-conformidade-alimentar | modelo | PARTIAL | prazo; upload binário |
| Estoque | `meal_inventory_movements` | `record_meal_stock_*` | `meal_stock_lines` | Estoque | movimentar/contar estoque | modelo | PASS | base, mínimo, conversões |
| Execução diária | `meal_daily_executions`, consumos | `record_meal_execution` | `meal_executions_at` | Hoje/Execução | registrar-execucao-alimentacao | modelo | PARTIAL | adesão, baixa teórica, estação Cozinha |
| Controles operacionais | `meal_operational_records` | `record_meal_operational_record` | reader 0186 | Execução | idem | modelo | PARTIAL | modelos oficiais |
| Central do Núcleo | agregados 0187 | — (só leitura) | `meal_network_action_summary`, `_data_quality`, `meal_audit_trail_at` | Visão Geral | acompanhar-alimentacao-rede | modelo | PARTIAL | relatórios faltantes |
| Relatórios | `report-registry.ts` | — | mesmos readers | Relatórios | ACL da tela dona | modelo | PARTIAL | datasets pendentes |

## A) Software concluído
Cadeia pedido → autorização → consolidação → programação → recebimento → estoque → consumo → execução → fechamento → central/relatórios, append-only, writers DEFINER com `search_path=''`, ausência ≠ zero, blockers explícitos.

## B) Configuração humana
Atribuição real de engagements (Nutricionista, Coordenação, Direção/Inspetor, Cozinha) — REAL_ROLE_ASSIGNMENT_PENDING; homologação de catálogos item/unidade/apresentação; cadastro de unidades de preparo e vínculos escola↔unidade; janelas de pedido; modelos operacionais (checklists, etiquetas).

## C) Conteúdo/fonte oficial
Catálogo normalizado de itens/unidades/apresentações; fichas técnicas e cardápios revisados; contratos/fornecedores; tabela de conversões.

## D) Regras institucionais a homologar
Prazo de pedido (15/20); fórmula do teto e per capita; saldo usado no pedido (STOCK_BASIS_POLICY); restrição por categoria; adesão (ADHESION_METRIC); baixa teórica (THEORETICAL_STOCK_DEBIT); conversões (UNIT_CONVERSIONS); prazo de não conformidade; estoque mínimo (MINIMUM_STOCK); fluxo financeiro (fora do escopo). Cada um aparece com código explícito e não quebra módulos independentes (fixado em `nae7-integrated.test.ts`).

## E) Dados históricos não migrados — plano (não executado)
1. Inventário: 177 planilhas não auditadas linha a linha; listar por ano, unidade e tipo (pedido, estoque, cardápio, execução).
2. Diferenças: mapear divergência de colunas/unidades por ano e unidade antes de qualquer normalização.
3. Cardápios Word: revisão humana por nutricionista antes de virar rascunho de base mestra.
4. NF em PDF/imagem: só metadados + hash; reconciliação transacional não feita.
5. Amostragem: ao menos 1 arquivo por categoria × ano × unidade, conferido por duas pessoas.
6. Fluxo: staging (`stage_meal_content`) → diff → conferência → homologação por pessoa distinta; nada oficializado sem conferência.

## Próximo passo proposto com o setor
Reunião de coleta com o Núcleo para: (1) indicar as pessoas e funções reais; (2) entregar o catálogo de itens/unidades normalizado; (3) decidir, por escrito no próprio SIGEM, prazo de pedido, fórmula do teto e definição de adesão; (4) escolher a amostra de planilhas para o primeiro staging. Nenhuma carga ou decisão foi feita neste lote.
