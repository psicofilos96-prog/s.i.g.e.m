# Frente NAE.0 — Núcleo de Alimentação Escolar (reabertura controlada)

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
