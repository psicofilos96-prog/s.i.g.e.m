# Matriz única de pendências do SIGEM 2.0 (Lote 23, atualizada no Lote 37, 2026-10-12)

Situação atual: Registro de lote. Substitui `docs/sigem-relatorio-pendencias-lote22.md` como foto vigente. SHA analisado `5a95d945` (L37/L38); evidências L37 e `docs/lote-38-vinculos-folha-agosto-2026.md`; evidências L37 em `docs/lote-37-saneamento-evidencias-2026-10.md`. "Executado L37" = rodado nesta rodada; demais evidências são referência a rodadas antigas. Nenhuma aprovação humana registrada.

Situações: CONCLUÍDO E VALIDADO · IMPLEMENTADO SEM VALIDAÇÃO · PARCIAL · BLOQUEADO · NÃO INICIADO.

| ID | Situação | Pendência | Arquivo | Rota | Teste | Bloqueio | Evidência | Próximo passo |
|---|---|---|---|---|---|---|---|---|
| P0-01 | CONCLUÍDO E VALIDADO | CI verde no SHA mais recente | `.github/workflows/ci.yml` | n/a (pipeline) | job `test` + `deep` | nenhum | CI success em `8026fe24` e `b5241a3f` (L23) | manter |
| P0-02 | CONCLUÍDO E VALIDADO | 11 invariantes falhando | `src/test/invariants/` | n/a | suíte rápida | nenhum | 0 falhas em 991 arquivos (L01 `d138021f`) | manter |
| P0-03 | CONCLUÍDO E VALIDADO | suíte < 5 min | `vitest.config.ts` | n/a | suíte rápida | nenhum | 227,4 s nesta rodada | manter |
| P0-04 | CONCLUÍDO E VALIDADO | `.env` sem segredo | `.gitignore` | n/a | teste de auditoria NSEC.ENV1 | nenhum | `docs/auditoria-env-nsec-env1.md` | manter |
| P1-01 | PARCIAL | PERF.LOADING.1 com sessão | `src/features/authority/session-read-gate.ts` | 12 rotas principais | `session-read-gate-console.test.ts` | sem sessão logada injetada | 0 leituras antes da sessão (L05 `3e72483d`, L18) | medir com conta logada |
| P1-02 | BLOQUEADO (decisão humana) | 262 capacidades sem titular | `src/features/institutional-admin/capability-matrix.ts` | `/central-de-acessos` | `capability-matrix.test.ts` | decisão institucional | inventário 262 (L11 `60e5cd8b`) | autoridade atribuir titulares |
| P1-03 | BLOQUEADO | E2E de caminhos positivos | `scripts/lote12-authenticated-e2e.mjs` | n/a | Executado L37: 29/29 + 19/19, resíduo 0 | P1-02 e dados reais | só recusas provadas | repetir após atribuições |
| P1-04 | PARCIAL | Matrículas: escolha por nome e protocolo na tela | `src/features/enrollments/enrollment-lookups.ts` | `/matriculas/operacao` | `enrollment-lookups.test.ts` | P1-02 (gravação recusada) | L21 `b5241a3f` | testar no navegador logado |
| P1-05 | PARCIAL | Portal da Família | `src/routes/publico.acompanhar-inscricao.tsx` | `/publico/acompanhar-inscricao` | `family-application-tracking` testes | sem campanha publicada | L07 `6064db54`, comprovante imprimível | publicar campanha real |
| P1-06 | PARCIAL | Tecnologia operacional | `src/components/sigem/operations-console.tsx` | `/tecnologia/operacao` | `route-visual-inventory.test.ts` | P1-02 | L08 `a25760d6` | atribuir `solicitar-tecnologia` |
| P1-07 | PARCIAL | Exportações auditadas | `src/features/reports/audited-export.ts` | `/relatorios-de-tecnologia` | `audited-export.test.ts` | 22 relatórios de Matrículas e t01–t22 sem leitor de linhas | L10 `e116ba1d` | ligar leitores às telas |
| P1-08 | BLOQUEADO | Acervo sem espaços e sem antivírus | `src/features/document-archive/archive-admin.tsx` | acervo | testes do acervo | `acv_spaces` = 0; política de verificação ausente | L09 `e1956163` | decidir espaços e antivírus |
| P1-09 | PARCIAL | Telas de leitura de projeções | `docs/data/sector-evidence-matrix.json` | por setor | `sector-evidence-matrix.test.ts` | volume (Mediador 17, Desenv. 19, Rede 37, Pessoas 26, Secretaria 22) | matriz L17 `b767756d` | telas de leitura por setor |
| P1-10 | IMPLEMENTADO SEM VALIDAÇÃO | Teste no navegador com conta logada | n/a | todas as telas novas | nenhum | sem sessão injetada nesta sessão | não executado | rodar Playwright com sessão |
| P1-11 | PARCIAL | Desenvolvimento operacional e integrações | `src/features/professional-development/development-flow.ts` | `/sigem-desenvolvimento/operacao` | `development-flow.test.ts` | P1-02; sem cursos/rubricas reais | L19 `ff0b1277`, L20 `54ac060e`, E2E 19/19 | cadastrar curso real após titulares |
| P2-01 | BLOQUEADO (decisão humana) | 7 decisões de Tecnologia | `src/features/technology/tech-decisions.ts` | `/tecnologia/decisoes` | `tech-decisions.test.ts` | valores por decisão institucional | L13 `7a00c942` | autoridade propor e outra aprovar |
| P2-02 | BLOQUEADO (decisão humana) | 5 parâmetros de Matrículas | `src/features/enrollments/enrollment-parameters.ts` | `/matriculas/parametros` | `enrollment-parameters.test.ts` | ato assinado ausente | L14 `8dcaab7d` | assinar atos e cadastrar |
| P2-03 | BLOQUEADO | Numeração e reservas sob concorrência | `scripts/lote16-concurrency-e2e.mjs` | n/a | concorrência 2 PASS/2 BLOQ. | sem regra de numeração; sem quadro de vagas | nesta rodada | aprovar regra e quadro |
| P2-04 | BLOQUEADO | Especificação Tecnologia 49 seções/18 critérios | `src/features/technology/tech-closure.ts` | n/a | `tech-closure` testes | documento não está no projeto | `mapped: false` (L13) | enviar o documento |
| P2-05 | BLOQUEADO (decisão humana) | Ato verificável × regra "nunca exigir ato" | `drizzle/migrations/0501_enr14_official_parameters.sql` | `/matriculas/parametros` | `enrollment-parameters.test.ts` | conflito de diretriz | L14 | proprietário decidir |
| P2-06 | PARCIAL | Cadastros de Tecnologia | `src/features/technology/tech-registry.ts` | `/tecnologia/cadastros` | `tech-registry.test.ts` | P1-02; dados reais ausentes | L15 `de5e5ed2` | cadastrar com fonte real |
| P3-01 | PARCIAL | Módulos sem teste | `docs/data/sector-evidence-matrix.json` | n/a | matriz | Docente 35, Família 13 | matriz L17 | escrever testes por módulo |
| P3-02 | IMPLEMENTADO SEM VALIDAÇÃO | View `admin_case_events_safe` com privilégio do criador | `drizzle/migrations/0389*` | n/a | `doc24_documents_rls.sql` | confirmação de intenção | linter L18 | confirmar redação intencional |
| P3-03 | PARCIAL | 183 tabelas com RLS sem política | migrations | n/a | linter | acesso só por função (fechado por padrão) | linter L18 | revisar caso a caso |
| P1-12 | CONCLUÍDO E VALIDADO | Reconciliação banco × migrations e Censo (L24–L25) | `docs/homologacao-tecnica-lotes-24-31-2026-10.md` | n/a | consultas L24/L25 | nenhum | 55 escolas, 0 divergências com recibos | manter |
| P1-13 | PARCIAL | Vínculos funcionais da folha (L38) | `payroll_functional_registrations` | n/a | `scripts/lote38-payroll-checks.py` 13/13 | ligação a pessoa exige decisão humana e titular de `manter-registro-funcional` | 2.037 vínculos registrados, 0 rejeitados; 213/219 SEMED casam; 0 pessoas ligadas | atribuir titular e revisar ligações; DP conferir 6 matrículas |
| P1-14 | CONCLUÍDO E VALIDADO | Infraestrutura oficial INEP 2026 (L33) | `docs/data/lote37-infraestrutura-por-escola.json` | n/a | Executado L37 | nenhum (sem fonte concorrente para comparar) | 2.970 observações, 55 escolas × 54 atributos, 0 vazias | manter |
| P2-07 | BLOQUEADO | Jornadas escolares (L33) | `class_journeys` | n/a | consulta L37 | nenhuma fonte de jornada | 0 jornadas, 0 declarações de horário | enviar fonte oficial |
| P2-08 | BLOQUEADO | Concorrência de numeração/reservas | `scripts/lote16-concurrency-e2e.mjs` | n/a | Executado L37: 2 PASS/0 FAIL/2 BLOQ. | P2-03 | resíduo 0 | ver P2-03 |

## Totais

CONCLUÍDO E VALIDADO 6 · PARCIAL 11 · BLOQUEADO (decisão humana) 4 · BLOQUEADO 6 · IMPLEMENTADO SEM VALIDAÇÃO 2 · NÃO INICIADO 0 — total 29.

## Sequência recomendada

1. P1-13 titular de `manter-registro-funcional` + revisão das ligações vínculo→pessoa → 2. P1-02 atribuição de titulares (decisão institucional) → 3. P2-01/P2-02/P2-03/P2-05 (valores, atos, regras) → 4. L25–L30 caminhos positivos por setor → 5. P1-10/P1-01 navegador logado → 6. P1-07, P1-09, P3-01 → 7. P1-08, P2-04, P3-02, P3-03 → 8. L31 homologação técnica.
