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

## NAE.8 Lote 3 — Estoque, Estação Cozinha e fechamento (2026-10-06)

- Pré-gate: `vite build` do HEAD anterior (Lote 2) executado e lido — sucesso (`built in 2.82s`), sem correção necessária.
- Fluxo integrado upload→visualização de evidência com sessão autenticada: **AUTHENTICATED_EVIDENCE_UI_E2E_PENDING_FOR_LOTE5** (preview sem sessão: `LOVABLE_BROWSER_AUTH_STATUS=signed_out` e nenhuma conta real com capability de alimentação; a camada SQL e o storage seguem provados separadamente no Lote 2).
- Migration `0191_nae8_kitchen_and_competence_readers.sql` — dois leitores `STABLE SECURITY DEFINER SET search_path=''`, sem DML, sem EXECUTE para anon; nenhuma capability nova (Cozinha reutiliza `registrar-execucao-alimentacao`).
- UI: `stock-section.tsx` (Saldo | Ficha e histórico com filtros item/classe/lote/situação | Registrar saída | Contagem física com aprovação e ajuste vinculado | Transferência governada), `closing-section.tsx` (checklist de 9 áreas + fechamento/reemissão versionada), `kitchen-station.tsx` + rota `/alimentacao-escolar/cozinha` (mobile-first). Modelo puro `operations-l3-model.ts` + 13 testes.
- Prova SQL `supabase/tests/nae8_lote3_stock_kitchen_closing_e2e.sql` executada no banco canônico, terminada por RAISE (rollback): sentinela `nae8-l3-ok: anon,sem-sessao,dml-direto;perda,devolucao,consumo,saldo-derivado,ficha,lote-ausente-null;transferencia-bloqueada;contagem,justificativa,aprovador-distinto,stale,final,ajuste-vinculado;cozinha-propria,outra-escola,minimo-pii,sem-estoque-sem-cap,desvio,refeicoes≠alunos,duplicidade,stale-retificacao,ator-tecnico;leitura-sem-escrita;fechamento-atual-recusado,checklist-unknown≠zero,manifesto-reproduzivel,reemissao-versionada;revogacao-cozinha;`. Fixtures do proprietário só para duas entradas de aceite e uma programação (writer de aceite provado no Lote 1).
- Resíduos após a prova: 0 pessoas/valores NAE8, 0 movimentos, 0 contagens, 0 fechamentos, 0 execuções, 0 programações, 0 evidências, 0 objetos no bucket; 55 escolas; 1 estado operacional de ano (inalterado); 2027 real intocado.
- Gates após a última alteração: tsgo limpo; suíte completa 3.782/3.784 (2 timeouts de 20 s sob carga em cadastro de profissional/aluno, fora do domínio, passam isolados 43/43); invariantes profundas 31/31; `vite build` OK; diff-check limpo; manifesto de migrations congelado; 0 funções meal DEFINER sem `search_path=''`; 0 funções meal com EXECUTE para anon; smoke HTTP 200 sem overflow horizontal em desktop/tablet/celular para `/alimentacao-escolar` e `/alimentacao-escolar/cozinha` (sem sessão).
- Bloqueios mantidos: `TRANSFER_POLICY`, `STOCK_BASIS_POLICY`, `MINIMUM_STOCK`, `UNIT_CONVERSIONS`, `ADHESION_METRIC`, `THEORETICAL_STOCK_DEBIT`, `LABEL_TEMPLATE — NOT_CONFIGURED`, `EVIDENCE_REQUIREMENT_NOT_HOMOLOGATED`, `SCHOOL_DAYS_CALENDAR_UNRESOLVED`.
- Observação de ACL: a Cozinha registra consumo no estoque só se a atuação também tiver `registrar-estoque-alimentar` (recusa provada); a combinação de capacidades é configuração humana.
- Status: **PASS — NAE8_LOTE_3_STOCK_KITCHEN_CLOSING_COMPLETE**, com AUTHENTICATED_UI_SMOKE_PENDING_FOR_LOTE5 e HUMAN_UI_VALIDATION_PENDING.

## NAE.8 Lote 4 — Central, relatórios, drill-down e handoff analítico (estado atual prevalece sobre a matriz NAE.7)

> A matriz NAE.7 acima é histórica. Para Central e Relatórios, prevalece esta seção.

| Área | Estado atual (HEAD pós-Lote 4) |
|---|---|
| Central do Núcleo | IMPLEMENTADO — `ReportingCenter` (`reporting-section.tsx`) sobre `meal_reporting_summary` |
| Datasets/readers | IMPLEMENTADO — 0192 (`meal_reporting_scope`/`_facts` internos, `_summary`, `_rows`) + 0193 (agregação em passada única, índices de sucessor) |
| Drill-down | IMPLEMENTADO — cada número abre `meal_reporting_rows` com o mesmo predicado; paginação 25, limite 500/página |
| Relatórios | IMPLEMENTADO — 10 `ReportDefinition` `nae-*` no `report-registry` e na Central `/relatorios`; CSV/XLSX/PDF só pelo `report-engine` |
| Handoff analítico | IMPLEMENTADO (contrato BM.1) — `MEAL_EXECUTION_SEMANTIC` (observado; refeições e alunos em escalas distintas) |
| Métricas normativas | BLOCKED — adesão, desperdício, estoque mínimo, prazo de NC, baixa teórica (`BLOCKED_BY_HOMOLOGATED_RULE`); custo (`OFFICIAL_SOURCE_PENDING`) |

**Datasets**: pedidos (solicitado × autorizado), entregas (integral/parcial/rejeitada/pendente), não conformidades (aberta/tratada), evidências (metadados; ativa/revogada), documentos fiscais, movimentos (entrada-aceite, consumo observado, perda, devolução, ajuste; lote/validade informados ou ausentes), inventários (divergente/sem divergência/pendente), execuções (seguido/desvio/não informado; refeições servidas e alunos presentes separados; soma sem valor informado = UNKNOWN), publicações de cardápio, fechamentos (emissão/reemissão). Sem pessoa, usuário, aluno, `storage_path` ou URL nas linhas.

**ACL**: rede inteira só com `acompanhar-alimentacao-rede`; uma escola com essa capability ou `consultar-alimentacao-escolar` da escola; `facts`/`scope` sem EXECUTE para ninguém; anon sem EXECUTE. Exportação usa o mesmo reader, então herda o mesmo ACL e o mesmo filtro.

**Prova** (`supabase/tests/nae8_lote4_reporting_e2e.sql`, rollback): `nae8-l4-ok: anon,sem-sessao,internos-fechados;escola-propria,outra-escola-idor,rede-exige-capability,rede-sem-writer;solicitado≠autorizado,entregas-4-estados,rejeitada-fora-do-estoque,classes-separadas,lote-ausente-null,inventario-divergente,planejado≠executado,refeicoes≠alunos,nc,evidencia-historica,reemissao;zero≠unknown≠blocked;drill-reconcilia,paginacao-total-estavel,limites;sem-pii,sem-storage-path,sem-url;leitura-sem-escrita,stable,revogacao-imediata;`. Fatos montados pelo proprietário só para a leitura (writers já provados nos Lotes 1/3).

**Performance observada** (massa sintética efêmera: 60.000 movimentos, 8.000 entregas, ~5.600 recebimentos, 15.000 execuções, 55 escolas, 90 dias; sem SLA): antes de 0193 resumo da rede 1.962 ms; depois 1.526 ms; resumo de uma escola 37 ms; drill movimentos/perda pág. 1 672 ms (total 15.000); entregas pendentes pág. 3 101 ms; execuções pág. 1 140 ms. O custo restante do resumo da rede é a montagem das linhas factuais do ledger de estoque; registrado como baseline, não corrigido sem nova evidência.

**Pendências legítimas**: AUTHENTICATED_UI_SMOKE_PENDING_FOR_LOTE5, AUTHENTICATED_EVIDENCE_UI_E2E_PENDING_FOR_LOTE5, HUMAN_UI_VALIDATION_PENDING; regras/fontes BLOCKED acima.
