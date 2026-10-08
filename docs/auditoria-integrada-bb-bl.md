# Auditoria integrada BB–BK (Frente BL) — 2026-10-06

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


HEAD auditado: `f814a452`. Este documento é registro canônico do fechamento da leva BB–BK.

## Resultado
**PARTIAL — NOT_READY_TO_EXIT_STRUCTURAL_CYCLE.** Os gates técnicos estão verdes, as regressões não aparecem e os dados estão preservados. Mesmo assim, ainda há software essencial sem prova completa: a simulação integrada BD, os testes de concorrência e escala (BJ) e os E2E por perfil (BF/BH). Por isso não se declara prontidão para configurar 2027.

## Gates no HEAD final (executados nesta auditoria)
| Gate | Resultado |
|---|---|
| Suíte completa | 3.681 testes / 297 arquivos, todos passando |
| Invariantes profundas (`test:deep`) | 31/31 (4 arquivos) |
| Typecheck (tsgo) | 0 erros |
| Build (vite) | OK |
| diff-check | limpo |
| Migrations | nenhuma alteração em migration histórica nos últimos 60 commits; congelamento verificado pelas invariantes |
| SQL | 0 tabelas sem RLS; 0 DEFINER sem search_path; 0 grants a anon; 0 INSERT/UPDATE/DELETE de `authenticated` em tabelas públicas |
| Security Advisor | 414 avisos, 3 tipos já conhecidos: 96 RLS sem policy (fechado por desenho), 3 DEFINER executáveis por anon, 315 DEFINER executáveis por autenticado (EXECUTE ≠ autorização; capability é revalidada) |
| Smoke | 200 em `/`, `/preparacao-2027`, `/secretaria`, `/ciece`, `/estacao-administrativa`, `/relatorios`, `/diagnostico`, `/ajuda`, `/paineis`, `/importacoes`, `/diario` |

Não executado: varredura `security--run_security_scan` separada. O Advisor cobre o mesmo escopo de banco.

## Regressões (todas confirmadas por consulta ou teste)
- 2026 continua `historico-importado`: é o único estado de ano. Foi gravado por `technical_provenance` com `recorded_by` nulo, ou seja, ato técnico não rotulado como humano.
- 2027 não tem estado nem abertura automática.
- A readiness de 2027 usa recorte anual (BB, testado).
- RH aparece só como identificador legado; DP externo com planilha governada, sem leiaute inventado.
- GPE = `EXTERNAL_INTEGRATION_UNDEFINED`, sem arquivo prometido (testes BC/BK).
- Nenhuma escrita direta por app role e nenhuma migration histórica reescrita.
- Zero resíduos: 55 escolas, 9.763 alunos, 698 turmas; 0 pessoas com nome sintético.
- Segredos e PII: nenhum segredo no repositório. Os números no formato de CPF são só máscaras ou do laboratório demonstrativo (`000.000.000-xx`).
- UNKNOWN ≠ ZERO (testes BB/BE). Nenhuma regra BNCC/SAEB, de avaliação, publicação, alerta, AEE, LGPD, capacidade ou supressão foi criada na leva.

## Matriz BB–BK
| Frente | Status | Entregas | Pendente de software | Bloqueio humano/documental/institucional |
|---|---|---|---|---|
| BB | PASS | readiness-probes com recorte anual, 19 etapas | — | abertura humana de 2027 |
| BC | PASS | DP externo, legado de RH, docs/dp-externo-arquitetura.md | — | DP_FILE_CONTRACT_PENDING |
| BD | **PARTIAL** | nenhuma | a simulação integrada não foi executada; parou na bateria da Família, que terminou em erro; os 12 cenários e o orquestrador não existem | — |
| BE | PASS técnico | CIECE em /paineis, CSV pelo report-engine | — | fontes BNCC/SAEB/território; MAX_CAPACITY; HUMAN_UI_VALIDATION_PENDING |
| BF | PARTIAL | por-que-pode, timeline, bf_admin_privilege_e2e.sql | o E2E cobre só self-grant; revogação, IDOR, vigência e conta sem pessoa não rodaram | GOVERNANCE_REVIEW_PENDING; SECURITY_GOVERNANCE_REVIEW_PENDING; REAL_ROLE_ASSIGNMENT_PENDING |
| BG | PASS técnico | bg_governed_import_e2e.sql (pipeline completo, com rollback) | — | DP/Educacenso; regra de pessoa natural para importar (GOVERNANCE_REVIEW_PENDING) |
| BH | PARTIAL | inventário +11 tabelas, E2E da Família | E2E de AEE, professor, Secretaria e Supervisão; IDOR em download/export por perfil | políticas de retenção, base legal e descarte |
| BI | PARTIAL | contraste, h1, smoke em 3 larguras | estados com login, diálogos/ESC, formulários, datas | HUMAN_USABILITY_VALIDATION_PENDING |
| BJ | PARTIAL | remedição 0178, governError em 3 telas, integridade em /diagnostico | escala, concorrência e governError nas demais telas | EXTERNAL_MONITORING_PROVIDER_PENDING |
| BK | PARTIAL | block-codes.ts, doc canônica, glossário | mensagens por tela e guias por perfil ainda não ligados ao registro | CONTENT_SOURCE_PENDING |

## BD — confirmação
A simulação integrada **não foi executada**. Não existe teste-orquestrador. A única tentativa, a bateria da Família, terminou em erro, e só a verificação de resíduos foi concluída. BD continua PARTIAL.

## Classificação final
**A) Software ainda incompleto**
- Simulação integrada BD com 12 cenários.
- E2E por perfil: BF (revogação, IDOR, vigência, conta sem pessoa) e BH (AEE, professor, Secretaria, Supervisão, downloads).
- Concorrência e escala dos writers (BJ).
- governError nas telas restantes (BJ).
- Acessibilidade de diálogos e formulários (BI).
- Mensagens por tela ligadas a `block-codes.ts` (BK).

**B) Configuração humana:** abertura de 2027 (REAL_2027_CONFIGURATION_PENDING); atribuição de papéis reais; calendário, matrizes, turmas, grades e atribuições de 2027; validação humana de telas e perfis.

**C) Fonte documental/arquivo externo:** planilha do DP (DP_FILE_CONTRACT_PENDING); leiaute do Educacenso; BNCC/SAEB; cardápios; dados territoriais; modelos oficiais.

**D) Regra institucional:** separação de poderes do Administrador Geral; leitura das 26 tabelas normativas; regras de avaliação, publicação e alertas; elegibilidade ao AEE; retenção, base legal e descarte (LGPD); parâmetro de capacidade.

**E) Serviço externo/plataforma:** provedor de envio; provedor de monitoramento; teste de restauração de backup.

## Conclusão
Ainda não é seguro sair do ciclo estrutural. O próximo passo técnico mínimo é executar BD de verdade e completar os E2E por perfil e de concorrência. Só depois disso a configuração controlada de 2027 pode começar sem afirmar prontidão falsa.
