# Auditoria final da Central de Auditoria — NAUD.3

Situação atual: Registro de lote (2026-10-08).

## Correções
- "Relacionados" no detalhe mostrava o código cru da ação; agora usa `actionLabel`.
- Estados entrar/carregando/erro ganharam título principal (sr-only), como a tela completa.

## Conferido sem mudança
- Filtros (data, área, tipo, natureza do ator, setor, escola, ator, registro exato, conhecido até) e busca local sobre o que a RLS devolveu; paginação de 25 com teto de 500 por fonte declarado como "Lista incompleta" na tela e no CSV.
- Ator pessoa × principal institucional: natureza só de `access_center_inventory()` (titular); demais veem "não visível".
- Payload minimizado (`minimizedDetail`, allowlist + `redact`); link ao fato só para telas que reaplicam a ACL.
- Exportação só com `exportar-auditoria` (não atribuída) e pelo motor de relatórios.

## Gates
- Suíte completa 4.590 PASS; profunda 82 PASS; typecheck OK.
- Harness institucional 102 PASS / 0 FAIL, escopo rede (cadastro institucional 13/13) e escola (direção só a própria escola); 0 resíduos.
- Varredura de segurança: 25 achados de leitura ampla por logado, todos em catálogos/normas/cadastro de unidades e instalação (leitura compartilhada por desenho); nenhum em trilhas de auditoria. Infraestrutura por escola segue DEPENDE_DECISAO.

## Pendências
- ASSIGNMENT_PENDING: `exportar-auditoria`.
- Desempenho real (500 eventos × fontes) e tela com login: INTERACTIVE_BROWSER_VALIDATION_PENDING.

Teste: `src/features/audit/naud3.test.ts`.
