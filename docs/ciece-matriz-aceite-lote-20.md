# CIECE — Matriz de aceite técnico (Lote 20)

**Situação atual:** Registro de lote. Base: commit `42ff6099` + Lotes 15–20 (2026-10-12).

A especificação de 41 seções **não está nos uploads**; a matriz segue os 20 lotes recebidos. Nenhuma homologação institucional humana foi feita ou é alegada aqui.

| Lote | Escopo | Núcleo | Teste | Tela | Status |
|---|---|---|---|---|---|
| 01 | Governança e linhagem | `ciece-governance.ts` | sim | — | PASS (camada pura) |
| 02 | Observatório/território | `observatory.ts` | sim + aceite | `/ciece` Central | PASS; mapa BLOQUEADO (0/55 coordenadas) |
| 03 | Cadeia temporal | `temporal-chain.ts` | sim | — | PASS; 9.811 matrículas sem início |
| 04 | Turmas e pessoal | `classes-staff-panel.ts` | sim | — | PASS; 0 oferta/turno/capacidade |
| 05 | Dicionário/indicadores | `data-dictionary.ts` | sim | — | PASS |
| 06 | Auditor de qualidade | `quality-auditor.ts` | sim + aceite | `/ciece` Inconsistências | PASS |
| 07 | Central de correções | `correction-desk.ts` | sim + aceite | — | PASS; sem tabela/writer |
| 08 | Ciclos do Censo | `census-cycles.ts` | sim | `/ciece` Fluxo (bloqueado) | PASS; datas oficiais ausentes |
| 09 | Conferência MI | `initial-enrollment-conference.ts` | sim | — | BLOQUEADO: 0 leiautes registrados |
| 10 | Situação do Aluno | `student-situation-conference.ts` | sim | — | BLOQUEADO: 0 resultados/regras |
| 11 | Fotografias | `historical-snapshots.ts` | sim + aceite | — | PASS; 0 snapshots no banco |
| 12 | Educacenso/GPE | `external-formats.ts` | sim | `/educacenso` (existente) | BLOQUEADO: leiaute não confrontado; GPE sem contrato |
| 13 | Relatórios oficiais | `official-report-library.ts` | sim | — | PASS; sem dados |
| 14 | Gerador avançado | `advanced-report-builder.ts` | sim | `/relatorios/personalizado` (existente) | PASS; editor CIECE não ligado |
| 15 | Séries/painéis | `indicator-series.ts` | sim + aceite | — | PASS; sem períodos declarados |
| 16 | Projeções | `projections.ts` | sim + aceite | — | PASS; histórico < 3 anos |
| 17 | Solicitações/GED/agenda | `requests-documents.ts` | sim + aceite | — | PASS; sem tabela/writer |
| 18 | Segurança/integração | `security-integration.ts` | sim + aceite | ações por `pathAllowed` | PASS; política não homologada |
| 19 | Interface | `surface/ciece-central.tsx` + `ciece-overview.functions.ts` | sim | `/ciece` | PASS sem login; com login NÃO VERIFICADO |
| 20 | Aceite integrado | `ciece-acceptance.test.ts` | 6 testes | — | PASS (camada pura) |

## Camadas provadas
- **TS puro:** 31 arquivos de teste do CIECE, 205 testes — PASS.
- **Build/typecheck:** OK.
- **SQL/RLS autenticado e E2E entre escolas:** NÃO EXECUTADO — `SIGEM_TEST_HARNESS=1` ausente; nenhuma conta do app corresponde ao usuário.
- **Migrations:** nenhuma neste ciclo (L15–L20 sem mudança de banco).

## Bloqueios reais
1. Capacidades CIECE (`consultar-ciece`, `exportar-ciece`, `consultar-nominal-censo`, `atender-solicitacao-ciece`, `conferir-entrega-ciece`) sem política homologada nem titular.
2. Leiaute Educacenso 2026 não confrontado com INEP; GPE sem contrato; recibos verificáveis só para o que já foi importado.
3. Datas oficiais de MI/SA 2026–2027 sem documento de origem.
4. Dados de origem: 9.811 matrículas sem início, 55 escolas sem coordenada/código de distrito, 551 vínculos sem início, 0 lotações/atribuições, 0 turmas com oferta.
5. Limiar de divulgação de grupos pequenos não homologado.
6. Tabelas/writers para casos de correção, solicitações e acervo CIECE a definir.
7. PERF.LOADING.1 ainda aberto.
