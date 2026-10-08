# Auditoria final da Alimentação Escolar — NAE.9

Situação atual: Registro de lote (2026-10-08). NAE.0–8 preservados; nenhuma regra nutricional ou decisão institucional alterada.

## Corrigido (gap técnico)
- Situação de pedido, planejamento, não conformidade e classe de movimento de estoque passam por `knownLabel` (antes indexadas direto; valor novo do banco aparecia vazio ou como código cru).
- Tabelas da trilha de auditoria, visão da rede e previsto×servido ganharam `caption` e `th scope="col"`.
- Teste: `src/features/school-meals/nae9-audit.test.ts`.

## Conferido sem alteração
Cores só por tokens; exports só pelo `report-engine`; saldo desconhecido = "não disponível", nunca zero.
10 relatórios (`REPORTING_REPORTS`) exportados em CSV e PDF de teste: 1 página A4 cada, sem célula cortada, ausência = "não disponível". Screenshots desktop/mobile sem rolagem lateral, um h1 por página.

## Pendências
- INTERACTIVE_BROWSER_VALIDATION_PENDING: sem login a estação mostra só "Entre para acessar"; home alimentacao@, cozinha, estoque e fechamento com dados reais exigem sessão.
- ASSIGNMENT_PENDING: perfil de Alimentação ausente na política v8.
- REVISAR: "Gerado em" em formato técnico no rodapé (motor de relatórios, transversal).
