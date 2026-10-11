# Aceite do Lote 15 — fechamento e regressão final

Situação atual: Registro de lote (2026-10-11). Evidência executada nesta rodada; não é fonte normativa.

## Pipeline executado

| Etapa | Resultado |
|---|---|
| Typecheck (`tsgo --noEmit`) | limpo |
| Build de produção (`vite build`) | ok |
| Suíte completa (4 shards) | 562 arquivos, 5.135 testes passaram, 7 ignorados, 0 falhas |
| SQL `report_emissions_ab.sql` (rollback) | `AB_PASS` |
| SQL `sia_correction_lote8.sql` (rollback) | `L8_PASS 12` |
| SQL `lote9_meal_vertical_e2e.sql` | NÃO reexecutado; última execução (Lote 14) falhou em asserções posteriores — defeito aberto |
| Varredura de segurança | 28 achados (21 erro, 3 aviso, 4 info); erros = tabelas normativas/catálogo legíveis por qualquer conta logada — a revisar tabela a tabela, sem abrir/fechar RLS em lote |
| Rotas sem login (desktop 1280 e celular 390) | 10 rotas, nenhum "Carregando" preso, nenhum erro de página; protegidas mostram "Entre…" sem dados |
| Busca de chaves no código | só nomes de variáveis/padrões de teste; nenhum token |
| HEAD local × GitHub `main` | `d4d1a067` = `d4d1a067` (sincronizado, sem force-push) |

## E2E autenticado (contas sintéticas efêmeras `bo-fixture.invalid`, cleanup no fim)

Camada: "camada autenticada equivalente" + navegador headless com sessão da própria conta sintética (sessão da plataforma estava `signed_out`).

| Fluxo | Teste | Rota | Resultado | Limitação / defeito restante |
|---|---|---|---|---|
| Relatórios (emissão, PDF/XLSX, QR, reemissão, A/B) | `scripts/lote6-reports-e2e.mjs` + SQL A/B | `/relatorios`, `/verificar/relatorio/$codigo` | 8 PASS, cleanup ok | Original não é armazenado: reemitir relê dados atuais e compara hash |
| Folha Final (Lote 7) | `scripts/lote7-final-sheet-e2e.mjs` | `/diario/folha-final` | 6 PASS, cleanup ok | — |
| Diário positivo (regra autor×revisor, Folha/Boletim/Ficha, escola B recusada) | `scripts/lote12-diary-positive-e2e.mjs` | `/diario/regras-folha-final`, `/diario/folha-final` | 24 PASS, resíduo 0 | Sem lançamento de nota/frequência no navegador (não contaminar matrícula oficial); multisseriada não testada; PDF da Folha sem cabeçalho/brasão institucional |
| SIA correção | SQL `sia_correction_lote8.sql` | `/avaliacoes-do-professor/cartao-resposta` | 12 verificações | Sem E2E de navegador nem foto real; aprovação OP sem designação real |
| SIPE Quadro Permanente | `scripts/lote13-sipe-board-e2e.mjs` | `/quadro-permanente-op` | 11 PASS | PDF sem cabeçalho institucional; planejamento/anexos/compartilhamento sem E2E |
| Alimentação cadastros/contrato/inspetor | `scripts/lote14-meals-e2e.mjs` | `/alimentacao-escolar` | 21 PASS | Pedido→entrega→estoque só no banco; SQL vertical com falha aberta; Mapa de Compras não gerado no navegador; designação pede identificador digitado |

PDFs reais desta rodada (Folha A4 paisagem, Quadro A4 retrato) inspecionados a 50/100/200%: legíveis a 100/200%; a 50% só títulos.

## Permissões que exigem designação humana real (produção)

Executor técnico ≠ autoridade. As contas sintéticas recebem concessões temporárias (≤2h, invisíveis a contas reais, removidas no fim). Nenhuma conta real recebeu as capacidades abaixo; cada uma exige decisão do proprietário e designação por atuação vigente:

| Capacidade | Fluxo | Proposta (não aprovada) |
|---|---|---|
| escrever / homologar regra da Folha Final | Diário | gestão pedagógica da rede escreve; outra pessoa homologa (`docs/proposta-capacidades-diario-lote12.md`) |
| registrar / conferir / homologar Folha Final | Diário | secretaria escolar registra; segundo ator da escola homologa |
| aprovar instrumento SIA (OP) | SIA | Orientação Pedagógica da rede — aguarda decisão |
| manter Quadro Permanente | SIPE | OP da rede — aguarda decisão |
| `manter-referencias-contratuais-alimentacao`, `designar-inspetor-alimentacao`, conferência e homologação | Alimentação | aguarda decisão (três pessoas distintas exigidas pelo banco) |
| `exportar-auditoria`, `administrar-integracoes` | Auditoria/Integrações | sem atribuição por decisão |

## Defeitos restantes

1. `lote9_meal_vertical_e2e.sql` não passa integralmente.
2. PDFs da Folha e do Quadro não usam o cabeçalho/brasão do motor de relatórios.
3. 21 achados de leitura ampla em tabelas normativas a classificar (intencional × exposição).
4. Fluxos SIA/SIPE planejamento/Alimentação pedido→estoque sem E2E de navegador.
