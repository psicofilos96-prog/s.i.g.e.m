# Frente NAE.0 — Núcleo de Alimentação Escolar (reabertura controlada)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


## Estado anterior encontrado
- Migrations 0074 (cardápio, previsão, execução, restrição), 0170 (unidades de preparo, publicação, estoque por ledger, visão de rede), 0171 (correção da visão de rede/família). Rota `/alimentacao-escolar`. Tudo append-only, writers SECURITY DEFINER com `search_path=''`, sem DML direto.
- Defeitos: `meal_grant`/`meal_network_grant` autorizavam por `CURRENT_DATE` em writers de fato datado; os 4 writers de 0074 não exigiam pessoa natural.

## Hardening (migration 0181)
- `meal_grant_on(cap, escola, data)` e `meal_network_grant_on(cap, data)` resolvem a atuação vigente **na data do fato**.
- Data do fato: cardápio = início; previsão/execução = dia servido; restrição = início da vigência; unidade/vínculo = início (encerramento: fim); estoque = data do movimento.
- Os 7 writers de fato exigem pessoa natural (`af_natural_person`): conta técnica não pratica ato do Núcleo.
- `CURRENT_DATE` permanece só onde "agora" é o objeto: publicação (ato presente), readers de consulta atual e bloqueio de execução/movimento futuro.
- `meal_grant`/`meal_network_grant` antigos seguem só para readers.

## Contrato de domínio (categorias epistemológicas)
| Categoria | Exemplos | Tratamento |
|---|---|---|
| Regra documentada | fluxo planejamento → pedido → autorização → consolidação → recebimento → estoque → execução → fechamento; papéis | arquitetura, não valor |
| Observação de arquivo | fórmulas de planilhas, adesão = refeições/alunos (pode passar de 100%), entrega semanal da agricultura familiar | nunca vira regra |
| Proposta | catálogo de capabilities, estágios separados | entregue como estrutura |
| A confirmar | prazo do pedido (15/20/23:59:59 do dia 20), teto/per capita, saldo usado, restrições por categoria, alçadas, conversões | BLOCKED |

## Perfil/setor
"Núcleo de Alimentação Escolar" é **domínio de atuação**, não login nem papel único: pessoas naturais recebem atuações e a política homologada atribui capabilities. Nutricionista e Coordenação têm conjuntos diferentes. Nenhuma regra foi concedida.

## Capabilities (ver `src/features/school-meals/nae-foundation.ts`)
Existentes reaproveitadas: registrar-estoque-alimentar, registrar-execucao-alimentacao, acompanhar-alimentacao-rede, publicar-cardapio-escolar, consultar-restricao-alimentar (+ manter-cardapio-escolar, registrar-restricao-alimentar, consultar-alimentacao-escolar, manter-unidades-de-alimentacao).
Novas no catálogo (sem writer até NAE.1): manter-planejamento-nutricional, manter-catalogo-tecnico-alimentar, manter-parametros-nutricionais, administrar-janela-de-pedido-alimentar, submeter-pedido-alimentar, analisar-pedido-alimentar, autorizar-pedido-alimentar, consolidar-demanda-alimentar, registrar-programacao-de-entrega-alimentar, conferir-recebimento-alimentar, registrar-nao-conformidade-alimentar, gerir-documentos-alimentacao, exportar-relatorios-alimentacao.

## Matriz de acesso (proposta, a homologar)
| Ator | Leitura | Escrita | Escopo | Sensível |
|---|---|---|---|---|
| Núcleo (geral) | rede | — (por subperfil) | rede | restrição só com capability própria |
| Nutricionista | rede | planejamento, catálogo técnico, parâmetros, cardápio, restrição | rede | sim |
| Coordenação | rede | janelas, análise, autorização, consolidação, programação de entrega, unidades, documentos, exportação | rede | não por padrão |
| Direção/Inspetor | própria escola | pedido, recebimento, não conformidade, estoque, execução | escola | restrição mínima |
| Cozinha | própria escola | execução, estoque delegados | escola | manejo mínimo |
| Auditor autorizado | conforme concessão | nenhuma | concessão | só se concedido |

Escola registra a realidade operacional; não altera parâmetros centrais.

## Bloqueios
BLOCKED_BY_HOMOLOGATED_RULE: prazo do pedido, teto/per capita/embalagem, saldo de estoque do pedido, restrições por categoria, fórmula de adesão, baixa observada × teórica, conversões.
BLOCKED_BY_OFFICIAL_SOURCE: alçadas/compra/fornecedor/empenho, frequência de entrega por contrato, cardápios/itens normalizados.
Nada foi semeado. REAL_ROLE_ASSIGNMENT_PENDING.

---
# NAE.1 — Base mestra, planejamento nutricional e documentos (migration 0182)

- `meal_master_records`: registro mestre append-only por espécie (18 espécies em `meal_master_spec`: item, unidade, apresentação/embalagem, especificação, fator de conversão, público, per capita, elegibilidade, necessidade especial, receita/ficha técnica, cardápio planejado geral/especial, fornecedor, referência contratual, marca, programação de entrega, designação/treinamento de inspetor, documento técnico).
- Cadeia: registro/retificação → **rascunho**; conferência (`conferir-conteudo-tecnico-alimentar`, outra pessoa) → **conferida**; homologação (`homologar-conteudo-tecnico-alimentar`, outra pessoa) → **homologada**; retirada com motivo. Base esperada obrigatória (stale). Nutricionista e Coordenação recebem capabilities distintas pela política; nada é concedido.
- Referências tipadas só a registros **homologados e vigentes**: embalagem/per capita sem unidade homologada são recusados; conversão só existe se registrada e homologada (nunca inversa implícita); nenhum valor padrão.
- Cardápio especial exige necessidade homologada e recusa identificação de estudante/diagnóstico. Instrução de restrição mínima por `dietary_restriction_instructions` com finalidade e trilha `meal_sensitive_access_events`. Anexo médico: não implementado (área sensível futura).
- Inspetores: designação por escola com pessoa institucional existente; validação funcional (vedação de merendeiro) retorna `FUNCTIONAL_SOURCE_REQUIRED` — nunca inferida de cargo.
- Documentos: metadados + hash + natureza (modelo | normativo | evidencia), vigência, autor/aprovador e substituição pela cadeia; o arquivo vive no armazenamento central (referência), sem repositório paralelo.
- Carga de conteúdo: `stage_meal_content` (idempotente por espécie+contexto+hash; outro hash pendente no mesmo contexto = `staging-conflict`) → conferência por outra pessoa → aplicação cria **só rascunhos** pelo writer. Sem OCR/parser.
- UI: seção "Planejamento Nutricional" em `/alimentacao-escolar` (Catálogos, Cardápios, Fichas Técnicas, Parâmetros, Especiais, Inspetores, Documentos, Pendências de Homologação), visível só com capability de rede de planejamento.

Estado: MENU_CONTENT — AWAITING_OFFICIAL_NORMALIZED_SOURCE · UNIT_CONVERSIONS/PER_CAPITA/ITEM_RESTRICTIONS — BLOCKED_BY_HOMOLOGATED_RULES · FUNCTIONAL_SOURCE_REQUIRED (inspetores) · REAL_ROLE_ASSIGNMENT_PENDING.

---
# NAE.2 — Pedido → análise → autorização → consolidação (migration 0183)

- Janela (`meal_order_windows`): ato versionado do Núcleo (`administrar-janela-de-pedido-alimentar`), por competência e escopo de escolas, com instantes `opens_at/closes_at` e fuso explícitos; base `abertura-explicita` (Coordenação) ou `regra-homologada` (exige documento homologado). Reabertura/encerramento/retificação exigem base esperada e motivo. Nenhum dia fixo (15/20/23:59:59).
- Pedido (`meal_order_versions`): cada transição é nova versão congelada com a janela de referência. rascunho → submetido → em-analise → devolvido | autorizado-total | autorizado-parcial | rejeitado; cancelado; retificado (após autorização, com motivo). Escola usa `submeter-pedido-alimentar` na própria escola (escola vem da base, nunca da requisição); análise `analisar-pedido-alimentar`; autorização/rejeição/retificação `autorizar-pedido-alimentar`; ajuste de quantidade exige justificativa. Parecer técnico da Nutricionista (`meal_order_opinions`) não muda estado.
- Linhas: item/unidade (e apresentação/contrato, se informados) só homologados; quantidade ≥ 0; zero permitido com motivo opcional (saldo-suficiente/não-aplicável/outro); item com regra homologada "vedado" exige público e recusa o público vedado.
- Necessidade/teto: motor puro `computeCeiling` (`order-model.ts`) só com regra homologada, manifesto de insumos (regra, per capita, público, dias, saldo, conversões, unidade); sem regra, conversão, público, dias ou saldo ⇒ UNKNOWN com razão; `ceilingVerdict` nunca diz "dentro" sem teto. O banco não grava nem afirma teto.
- Anomalias: só por regra configurada e homologada, com explicação textual.
- Consolidação: `meal_demand_consolidation_at` soma só cabeças autorizadas com quantidade > 0, por item+unidade+apresentação+contrato, com destino por escola; `record_meal_demand_consolidation` congela o mapa (sequência esperada). Nada é enviado ao fornecedor.
- Relatórios: `pedidos-alimentacao` e `consolidado-demanda-alimentacao` no registro único, alimentados pelos mesmos readers da tela.

Estado: ORDER_WINDOW_POLICY — CONFIGURABLE / HUMAN_CONFIGURATION_PENDING · QUANTITY_LIMIT, UNIT_CONVERSION, ITEM_ELIGIBILITY — BLOCKED_BY_HOMOLOGATED_RULE · E2E com sessão real pendente.

## NAE.3 — Entrega, recebimento, não conformidade e documento fiscal (migration 0184)
- Programação: N entregas por linha autorizada, soma ≤ autorizado, reprogramação/cancelamento versionados com motivo; frequência só por `programacao-de-entrega` homologada (a planilha com até 2 entregas é OBSERVAÇÃO DE ARQUIVO).
- Recebimento: rascunho (autosave) → confirmado → retificado; aceito + rejeitado = entregue; checklist por item via `checklist-de-recebimento` homologado (sem checklist nada é exigido, inclusive temperatura).
- Estoque: só o aceito gera UMA entrada (`source_receipt_version_id` único), data = data real do aceite no fuso declarado; retificação retifica/anula o mesmo movimento; competência do pedido intacta. Item/unidade mestre precisam de `item_estoque_value_id`/`unidade_estoque_value_id` homologados, senão `INVENTORY_CATALOG_PENDING`.
- Não conformidade: aberta→comunicada→providência→resolvida→encerrada, evidência só acumulada. `NONCONFORMITY_DEADLINE — BLOCKED_BY_HOMOLOGATED_RULE` (24h/dia útil não calculado).
- Documento fiscal: metadados+hash+vínculo; recebido ≠ conferido ≠ aceite ≠ pagamento. `FINANCIAL_WORKFLOW — OUTSIDE_SCOPE / INTEGRATION_PENDING`.
- Pendente: E2E transacional com sessão/rollback, upload binário no storage central, `REAL_ROLE_ASSIGNMENT_PENDING`, `HUMAN_UI_VALIDATION_PENDING`.

## NAE.4 — Estoque, lotes, inventário físico e conciliação (migration 0185)
- Mesmo ledger; classes: entrada-aceite (só via recebimento), consumo-observado, perda, devolução, transferência (só com `politica-transferencia-estoque` homologada), ajuste-inventario (contagem conferida/aprovada + motivo + `ajustar-estoque-alimentar`). Retificação/anulação são eventos novos.
- Saldo derivado por data/lote; ajuste legado sem direção ⇒ saldo não disponível (nunca zero). Unidade divergente para o mesmo item é recusada; conversão só por fator homologado (`UNIT_CONVERSIONS — BLOCKED_BY_HOMOLOGATED_RULE` onde faltar).
- Consumo teórico é cálculo analítico (`stock-model.ts`), nunca movimento. PVPS só ordena/sugere.
- Fechamento mensal: manifesto de ids + saldos com sha256; refechamento = nova versão com motivo.
- `STOCK_BASIS_POLICY — BLOCKED_BY_HOMOLOGATED_RULE` (dia 20 × fim de mês não escolhido). `MINIMUM_STOCK — NOT_CONFIGURED`. Saldo negativo: bloqueio só por política; sem ela exige motivo e gera alerta.
- Corrigido defeito de NAE.3: não conformidade por atuação de rede era sempre recusada.
- Pendente: E2E transacional com sessão/rollback, telas de contagem/ajuste/transferência, relatórios de inventário/lotes/origem, `REAL_ROLE_ASSIGNMENT_PENDING`, `HUMAN_UI_VALIDATION_PENDING`.
