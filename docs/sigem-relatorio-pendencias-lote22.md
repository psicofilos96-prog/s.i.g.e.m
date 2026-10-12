# Relatório de pendências — Fechamento do Lote corretivo 22 (2026-10-12)

Situação atual: Registro de lote. Substitui como foto vigente `docs/sigem-relatorio-pendencias-lote18.md` e incorpora os lotes corretivos 01–21. Não é fonte normativa nem homologação; nenhuma decisão, aprovação ou autoria foi registrada em nome de pessoa. Ordem recebida não conta como entrega: só há "C" com evidência executada nesta rodada ou citada com SHA.

## 1. Revalidação executada nesta rodada

| Verificação | Comando / fonte | Resultado |
|---|---|---|
| GitHub sync | API pública `commits/main` | `main` remoto = HEAD local `b5241a3f` → sincronizado |
| CI | API `actions/runs` | `ecd46f3b` success (run 38292596116), `5945ef4a` success; `b5241a3f` (Lote 21) em execução no momento da coleta — não declarado verde |
| Suíte rápida | `bunx vitest run` | 991 arquivos, 7334 passaram, 7 pulados, 0 falhas, 227,4 s |
| E2E autenticado | `scripts/lote12-authenticated-e2e.mjs` | 29/29 PASS, 0 resíduos |
| Concorrência | `scripts/lote16-concurrency-e2e.mjs` | 2 PASS, 0 FAIL, 2 BLOQUEADO |
| E2E Desenvolvimento | `scripts/lote20-development-e2e.mjs` | 19/19 PASS, 0 resíduos |
| Linha completa | `src/test/invariants/pendency-report-lote22.test.ts` | toda linha da tabela §2 tem as 7 colunas preenchidas |

## 2. Pendências — uma linha por pendência

Classes: **C** concluído com evidência · **P** parcial · **B** bloqueado · **V** aguarda decisão humana · **X** não verificável aqui. "—" só quando o campo não se aplica e está explicado.

| ID | Classe | Pendência | Arquivo | Rota | Teste | Bloqueio | Evidência | Próximo passo |
|---|---|---|---|---|---|---|---|---|
| P0-01 | P | CI verde no SHA mais recente | `.github/workflows/ci.yml` | n/a (pipeline) | job `test` + `deep` | run de `b5241a3f` ainda em execução | `ecd46f3b` success run 38292596116 | conferir run 38293294394 |
| P0-02 | C | 11 invariantes falhando | `src/test/invariants/` | n/a | suíte rápida | nenhum | 0 falhas em 991 arquivos (L01 `d138021f`) | manter |
| P0-03 | C | suíte < 5 min | `vitest.config.ts` | n/a | suíte rápida | nenhum | 227,4 s nesta rodada | manter |
| P0-04 | C | `.env` sem segredo | `.gitignore` | n/a | teste de auditoria NSEC.ENV1 | nenhum | `docs/auditoria-env-nsec-env1.md` | manter |
| P1-01 | P | PERF.LOADING.1 com sessão | `src/features/authority/session-read-gate.ts` | 12 rotas principais | `session-read-gate-console.test.ts` | sem sessão logada injetada | 0 leituras antes da sessão (L05 `3e72483d`, L18) | medir com conta logada |
| P1-02 | V | 262 capacidades sem titular | `src/features/institutional-admin/capability-matrix.ts` | `/central-de-acessos` | `capability-matrix.test.ts` | decisão institucional | inventário 262 (L11 `60e5cd8b`) | autoridade atribuir titulares |
| P1-03 | B | E2E de caminhos positivos | `scripts/lote12-authenticated-e2e.mjs` | n/a | E2E 29/29 + 19/19 | P1-02 e dados reais | só recusas provadas | repetir após atribuições |
| P1-04 | P | Matrículas: escolha por nome e protocolo na tela | `src/features/enrollments/enrollment-lookups.ts` | `/matriculas/operacao` | `enrollment-lookups.test.ts` | P1-02 (gravação recusada) | L21 `b5241a3f` | testar no navegador logado |
| P1-05 | P | Portal da Família | `src/routes/publico.acompanhar-inscricao.tsx` | `/publico/acompanhar-inscricao` | `family-application-tracking` testes | sem campanha publicada | L07 `6064db54`, comprovante imprimível | publicar campanha real |
| P1-06 | P | Tecnologia operacional | `src/components/sigem/operations-console.tsx` | `/tecnologia/operacao` | `route-visual-inventory.test.ts` | P1-02 | L08 `a25760d6` | atribuir `solicitar-tecnologia` |
| P1-07 | P | Exportações auditadas | `src/features/reports/audited-export.ts` | `/relatorios-de-tecnologia` | `audited-export.test.ts` | 22 relatórios de Matrículas e t01–t22 sem leitor de linhas | L10 `e116ba1d` | ligar leitores às telas |
| P1-08 | B | Acervo sem espaços e sem antivírus | `src/features/document-archive/archive-admin.tsx` | acervo | testes do acervo | `acv_spaces` = 0; política de verificação ausente | L09 `e1956163` | decidir espaços e antivírus |
| P1-09 | P | Telas de leitura de projeções | `docs/data/sector-evidence-matrix.json` | por setor | `sector-evidence-matrix.test.ts` | volume (Mediador 17, Desenv. 19, Rede 37, Pessoas 26, Secretaria 22) | matriz L17 `b767756d` | telas de leitura por setor |
| P1-10 | X | Teste no navegador com conta logada | n/a | todas as telas novas | nenhum | sem sessão injetada nesta sessão | não executado | rodar Playwright com sessão |
| P1-11 | P | Desenvolvimento operacional e integrações | `src/features/professional-development/development-flow.ts` | `/sigem-desenvolvimento/operacao` | `development-flow.test.ts` | P1-02; sem cursos/rubricas reais | L19 `ff0b1277`, L20 `54ac060e`, E2E 19/19 | cadastrar curso real após titulares |
| P2-01 | V | 7 decisões de Tecnologia | `src/features/technology/tech-decisions.ts` | `/tecnologia/decisoes` | `tech-decisions.test.ts` | valores por decisão institucional | L13 `7a00c942` | autoridade propor e outra aprovar |
| P2-02 | V | 5 parâmetros de Matrículas | `src/features/enrollments/enrollment-parameters.ts` | `/matriculas/parametros` | `enrollment-parameters.test.ts` | ato assinado ausente | L14 `8dcaab7d` | assinar atos e cadastrar |
| P2-03 | B | Numeração e reservas sob concorrência | `scripts/lote16-concurrency-e2e.mjs` | n/a | concorrência 2 PASS/2 BLOQ. | sem regra de numeração; sem quadro de vagas | nesta rodada | aprovar regra e quadro |
| P2-04 | B | Especificação Tecnologia 49 seções/18 critérios | `src/features/technology/tech-closure.ts` | n/a | `tech-closure` testes | documento não está no projeto | `mapped: false` (L13) | enviar o documento |
| P2-05 | V | Ato verificável × regra "nunca exigir ato" | `drizzle/migrations/0501_enr14_official_parameters.sql` | `/matriculas/parametros` | `enrollment-parameters.test.ts` | conflito de diretriz | L14 | proprietário decidir |
| P2-06 | P | Cadastros de Tecnologia | `src/features/technology/tech-registry.ts` | `/tecnologia/cadastros` | `tech-registry.test.ts` | P1-02; dados reais ausentes | L15 `de5e5ed2` | cadastrar com fonte real |
| P3-01 | P | Módulos sem teste | `docs/data/sector-evidence-matrix.json` | n/a | matriz | Docente 35, Família 13 | matriz L17 | escrever testes por módulo |
| P3-02 | X | View `admin_case_events_safe` com privilégio do criador | `drizzle/migrations/0389*` | n/a | `doc24_documents_rls.sql` | confirmação de intenção | linter L18 | confirmar redação intencional |
| P3-03 | P | 183 tabelas com RLS sem política | migrations | n/a | linter | acesso só por função (fechado por padrão) | linter L18 | revisar caso a caso |

## 3. Totais

C 3 · P 12 · B 4 · V 4 · X 2 — total 25. P0: 3 C + 1 P. Nenhum item marcado concluído por ordem recebida.

## 4. Ordem por dependência

1. P0-01 → 2. P1-02 (titulares) → 3. P2-02/P2-05/P2-01/P2-03 (atos, valores, regras) → 4. P1-03, P1-04, P1-05, P1-06, P1-11, P2-06 (caminhos positivos) → 5. P1-10/P1-01 (navegador logado) → 6. P1-07, P1-09, P3-01 → 7. P1-08, P2-04, P3-02, P3-03.
