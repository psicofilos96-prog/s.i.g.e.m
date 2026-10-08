# Frente BO — fechamento técnico acadêmico

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.
- Contagens (testes, arquivos, rotas, migrations, regras) são da data do registro; a contagem atual sai de `npm run verify`.


Base: HEAD `06e2602c3316c63d09801cdb7031051e51a87ddc` (migrations 0000–0193). Nenhuma alteração de código, migration, política ou dado.

## Decisão
**PARTIAL — BO_SYNTHETIC_AUTH_SESSION_PROVISIONING_UNAVAILABLE.** `PASS — BO_ACADEMIC_TECHNICAL_DEBT_CLOSED` não é declarado.

## Pré-gate (registrado)
- Suíte vitest iniciada; não concluiu dentro da janela de 280 s do executor (sem falhas observadas na saída parcial). Baseline completo: último verde registrado no Lote 5 NAE.8 (3.792/3.792).
- Papel técnico do sandbox: `select` limitado; `permission denied for schema auth`; sem EXECUTE em `end_engagement`; sem SELECT em `institutional_classes`; DML só em tabela temporária.
- Contagem verificável: 55 escolas.

## Bloqueio exato
1. Sessões sintéticas persistentes (itens 1, 3, 4, 5, 6): exigem criar usuário Auth sintético. O executor não tem acesso ao schema `auth` e a camada técnica 0100 não provisiona usuários Auth. Criar esse caminho exigiria nova capacidade privilegiada (service_role) — não executado nesta frente por exigir decisão explícita de desenho fail-closed antes de existir.
2. BD integrada (item 2): o executor não pode chamar writers canônicos nem ler tabelas acadêmicas; o orquestrador único não pode rodar sem a camada do item 1.
3. Escala acadêmica (item 7): massa sintética exige os mesmos writers; não medido.
4. Concorrência paralela (item 8): **tentado** — duas conexões psql independentes abertas simultaneamente (PIDs 410602 e 410603). Porém o papel não executa writers nem faz DML em tabelas canônicas; apenas tabela temporária. Mantido `PARALLEL_CONCURRENCY_UNPROVEN — ENVIRONMENT_LIMITATION`.

## Matriz
| Item | Estado |
|---|---|
| BD integrada 2027 | STILL_TECHNICAL |
| Sessões acadêmicas persistentes | STILL_TECHNICAL (provisionamento Auth sintético inexistente) |
| BF / BH E2E autenticado | STILL_TECHNICAL |
| BI a11y autenticada | STILL_TECHNICAL |
| BK mensagens por tela | STILL_TECHNICAL |
| Escala acadêmica | STILL_TECHNICAL |
| Concorrência paralela | ENVIRONMENT_LIMITATION |
| NAE sessão persistente | HUMAN_CONFIGURATION (inalterado) |
| Usabilidade | SUBJECTIVE_HUMAN_VALIDATION |

## Próximo passo técnico necessário
Camada de fixture BO: server route específica, guardada por `development_automation_enabled` e segredo técnico, que cria/remove apenas usuários Auth com namespace/hash BO, pessoa/atuação marcadas como teste e tipos já presentes na política v8, com trilha e prova de zero resíduos. Requer aprovação antes de implementar.

## Resíduos
Nenhum artefato criado: 0 usuários/pessoas/atuações/políticas BO; 2026 e 2027 não tocados.

---
## Continuação — camada de fixtures Auth (2026-10-06)

### Arquitetura
- Migration `0194`: `bo_fixture_accounts` (registro transitório, sem GRANT) + `bo_fixture_prepare/expire/cleanup/residue`, DEFINER `search_path=''`, EXECUTE só `service_role`, exigem `development_automation_enabled`, `operation_id ^bo-[0-9a-f]{12}$`, `source_hash` 64 hex, tipo na allowlist E com regra homologada vigente. Sem SQL/tabela/capability arbitrários; cleanup só apaga linhas com todos os marcadores (FK extra ⇒ falha inteira).
- Harness `scripts/bo-fixture-harness.mjs` (fora do bundle): service_role só cria/lista/apaga usuários Auth `@bo-fixture.invalid` (`sigem_fixture=BO`) e chama `bo_fixture_*`. Senhas efêmeras, nunca impressas. Usuário sintético autentica por senha e todas as chamadas de domínio usam o próprio JWT. Cleanup em `finally`.
- Smoke `scripts/bo-a11y-smoke.py`: sessões injetadas por arquivo temporário 0600 apagado ao final.

### Defeito real corrigido
- `record_engagement` aceitava conceder atuação à própria pessoa (prova em transação revertida: `SELF_GRANT_ACCEPTED`). Migration `0195` recusa `engagement:self-grant`. Reexecução: self-grant recusado para todos os 10 perfis.

### Resultado do harness (op `bo-2e0c75bdc4c0`): 69/69
- 10 perfis v8 (admin geral, cadastro, CIECE auditoria/estatística, direção, gestão pedagógica, orientação, professor, RH, secretaria): sessão real, resolver v8 real com contagem exata de capabilities, escopo escola/turma correto, IDOR outra escola recusado, self-grant recusado, DML direto recusado, edição da política homologada recusada.
- Conta sem pessoa: 0 capabilities e não assina ato. CIECE sem identidade nominal de estudante; professor sem cadastro de rede.
- Revogação: mesmo JWT perde todas as capabilities após fim da vigência, sem logout.
- Preflight e pós: 0 usuários Auth BO, 0 pessoas/atuações/encerramentos/políticas BO.
- Limite: escopos escolares usam a 1ª escola/turma real (somente leitura, só contagens; nada impresso), porque escolas/turmas são imutáveis e uma escola sintética não poderia ser removida.

### Acessibilidade autenticada (48 combinações perfil×rota×tela)
27 PASS, 21 com achado objetivo: botões sem nome (`/auditoria`, `/diario`, `/diario/turmas`, `/documentos-escolares`), `/enturmacoes` sem h1, overflow de 115 px em `/auditoria` mobile, alvos < 24 px no mobile (inclui links de texto, critério do smoke mais estrito que WCAG). Sem vazamento de stack/SQL, sem erro de runtime, foco visível com Tab. **Não corrigidos nesta execução → STILL_TECHNICAL.**

### Concorrência paralela
Dois JWTs simultâneos (`Promise.all`) no writer `end_engagement`: ambos recusados por falta de capability. Paralelo real com escrita bem-sucedida não executado: todo writer oficial grava fato append-only imutável (ex.: `engagement_endings`), que não pode ser removido ⇒ resíduo permanente. **PARALLEL_CONCURRENCY_UNPROVEN — IMMUTABLE_FACT_RESIDUE** (causa exata, não mais ambiente).

### Ainda não executado (STILL_TECHNICAL)
BD integrada 2027 em cenário único; BK por tela; escala acadêmica; correção dos 21 achados de a11y; AEE e Família não testados; exportação/download por perfil.
Pelo mesmo motivo de imutabilidade, o caminho viável para BD/escala é um orquestrador em transação revertida (`supabase/tests/`), não sessão persistente.

### Gates desta execução
tsgo limpo; build OK; diff-check limpo. Suíte completa, invariantes profundas e Security Advisor pós-0194/0195 **não reexecutados**.

### Decisão
**PARTIAL — BO_SESSIONS_RESOLVED_BD_BK_SCALE_A11Y_FIXES_PENDING.** Não declarado PASS — BO_ACADEMIC_TECHNICAL_DEBT_CLOSED.

---
## BO.2 — 2026-10-06 (base `e7b0e9915da6ff4f2f3b22bc4661f33bf62442ac`)

### Decisão
**PARTIAL — BO2_BD_INTEGRATED_ORCHESTRATOR_AND_BK_NOT_EXECUTED.** Não declarado PASS — BO_ACADEMIC_TECHNICAL_DEBT_CLOSED.

### A11y autenticada — corrigida e revalidada
- Antes (BO.1): 27/48. Depois: 47/48 com critério objetivo; 1 inconclusivo (professor mobile `/diario/turmas`: heurística de sessão `signed=False`, demais métricas OK).
- Correções: `/auditoria` tabela em região rolável `relative` (o rótulo `sr-only` absoluto escapava do contêiner e criava 83–115 px de overflow), quebra de referências longas, cabeçalho de ações nomeado; `/enturmacoes` ganhou página-índice com h1 (antes era tela vazia); Checkbox compartilhado com área de toque ampliada (`after:-inset-1`).
- Falsos positivos do smoke BO.1 descartados com justificativa: botões `aria-hidden` + `tabindex=-1` (fora da árvore de acessibilidade), skip-link `sr-only`, links inline (exceção WCAG 2.5.8) e alvos < 24 px sem outro alvo no círculo de 24 px (exceção de espaçamento).
- Não cobertos: dialogs/ESC/retorno de foco, erros associados a campos e double-submit na UI.

### Escala acadêmica — gargalo comprovado e corrigido (0196–0198)
Medição em transação revertida, sessão sintética, rede real só para contagem/tempo:
| Leitura | Antes | Depois |
|---|---|---|
| Estudantes, sessão de rede (9.763) | 33.982 ms | 120 ms |
| Estudantes, Secretaria 1 escola (327) | 17.327 ms | 20 ms |
| Vínculos observados, rede (10.295) | ~16.500 ms | 7 ms |
| `effective_capabilities` admin (76.780 linhas) | 144 ms | — |
| `class_at` × 698 turmas (chamada por turma) | 7.155 ms (~10 ms/turma; N+1 se a tela chamar por turma) | não alterado |
| `network_indicators_at` | 548 ms | — |
| `teaching_plans_overview_at` × 55 | 119 ms (0 planos) | — |
Causa: policies RLS chamavam funções de capacidade por linha. 0196/0197/0198 trocam por conjuntos avaliados uma vez (`roster_readable_classes`, `school_capability_schools`, `capability_classes`), mesma semântica (Secretaria: 327 = 327 esperados; sem pessoa = 0; professor sem episódios = 0).
Limites: `class_enrollment_episodes` está vazia (0 linhas), então frequência/diário/avaliação não têm volume real para medir; massa sintética desses fatos não foi gerada.

### Não executado (STILL_TECHNICAL)
- Orquestrador único BD 2027 em transação revertida (cadeia completa com writers oficiais).
- BK por tela (mapeamento código → mensagem nas telas).
- Família pelo mecanismo próprio, AEE (sem tipo de atuação AEE na política v8 ⇒ HUMAN_CONFIGURATION se exigido) e export/download por perfil.
- Concorrência: PARALLEL_CONCURRENCY_UNPROVEN — IMMUTABLE_FACT_RESIDUE (duas transações que só revertem provam serialização de lock, não o resultado canônico; exige ambiente descartável).

### Gates após a última alteração
- Suíte em 4 partes: 3.792 testes; 3.791 na primeira rodada + `report-engine` (timeout de 46 s sob carga paralela) passou isolado 9/9.
- Invariantes profundas 31/31; manifesto de migrations atualizado com 0194–0198; tsgo limpo; build OK; diff-check limpo.
- Harness de perfis 69/69 (incluindo self-grant, revogação sem logout, DML/política recusados).
- Security Advisor: 498 (antes 494). +1 INFO `bo_fixture_accounts` sem policy (intencional, sem GRANT); +3 DEFINER para authenticated (helpers que só devolvem o escopo do próprio chamador). Sem regressão.
- Integridade: 0 usuários Auth BO, 0 pessoas/atuações/encerramentos/políticas BO, 0 objetos; 55 escolas, 698 turmas, 9.763 alunos, 2 atuações, 8 políticas; 2026/2027 não tocados.

---

## BO.3 — resultado (preserva o histórico acima)

**Resultado: PARTIAL — BO3_BD_FAMILY_SCALE_DONE_BK_EXPORT_A11Y_DIALOGS_PENDING.** Não se declara `BO_ACADEMIC_TECHNICAL_DEBT_CLOSED`.

### Concluído e provado
- **Orquestrador BD** `supabase/tests/bo3_bd_integrated_2027_e2e.sql`: uma transação, `SET LOCAL ROLE authenticated` + `request.jwt.claims`, writers/readers oficiais, sem dublê de `effective_scope_capabilities`, sem política/regra/capability de teste; termina na sentinela `bo3-bd-e2e-ok` (rollback). Cobre diário (idempotência, base desatualizada, roster), frequência, avaliação (stale, conferência), ZERO ≠ ausente/BLOQUEADO, planejamento v1→v2, readers do diário/planejamento reconciliando com os fatos, `class_at` knownAt antes=0/agora=1, `record_engagement`/`end_engagement` (capacidades pós-revogação = 0), conta sem pessoa recusada, correção bloqueada sem política de correção homologada, orientação recusada (`registrar-acompanhamento-pedagogico` não concedida pela v8), indicadores de rede.
- **Família**: reader canônico (`family_students`/`family_student_summary`) — só o estudante autorizado, campos minimizados, outro estudante recusado, sem escrita acadêmica, revogação torna invisível. O writer `record_guardian_authorization_v3` é recusado com `capability:manter-autorizacao-de-responsavel` porque nenhuma regra v8 concede essa capacidade ⇒ **HUMAN_CONFIGURATION / INSTITUTIONAL_MODEL_PENDING**; a autorização usada no reader é pré-condição inserida dentro da transação revertida (documentada no cabeçalho do teste).
- **AEE**: sem tipo de atuação v8 ⇒ HUMAN_CONFIGURATION / INSTITUTIONAL_MODEL_PENDING.
- **N+1 de turmas (produção)**: `listInstitutionalClasses` fazia 2×N RPCs (698 turmas ⇒ 1.396 chamadas). Causa medida: RLS por linha (sem RLS, `class_at`×698 = 90 ms; com RLS = 7,5 s). Migration **0199** `classes_with_period_link_at` (DEFINER, `search_path=''`, ACL idêntica às políticas avaliada uma vez por turma, reutiliza `class_at`/`class_period_organization_at`). Medido em rollback: antigo 7.578 ms → novo 1.787 ms, 698/698 turmas, **0 divergências**; 1 chamada em vez de 1.396.
- Diário (`institutional-teaching.ts`) e grade (`person-schedule-source.ts`) também fazem leitura por turma, mas limitada às turmas visíveis ao usuário (professor: poucas); não alterado sem gargalo comprovado.

### Pendente (não executado nesta fase)
- Identidade Auth BO no próprio cenário BD (o cenário usa UUID sintético nas claims, não uma conta Auth provisionada).
- BK por tela (mapper `src/features/help/block-codes.ts` → componentes), export/download ACL por perfil, a11y de dialogs/erros/double-submit e o 1/48 inconclusivo (professor/phone `/diario/turmas`), benchmarks de volume sintético de matrícula/frequência/avaliação.
- Concorrência: **PARALLEL_CONCURRENCY_UNPROVEN — IMMUTABLE_FACT_RESIDUE**.

### Gates após a última alteração
tsgo OK; suíte particionada 1.971 + 1.661 + 160 = **3.792/3.792**; invariantes profundas 31/31; hashes de migration congelados com 0199. Integridade: 55 escolas, 698 turmas, 9.763 alunos, 2 atuações, 8 políticas, 0 fixtures/Auth/pessoas BO, 0 autorizações familiares; 2026/2027 não tocados.

## BO.4 — 2026-10-06 (parcial, em andamento)

### Item 1 — BD integrada com identidade Auth BO real: PASS
- `scripts/bo4-identity.mjs` cria pela camada 0194 duas contas Auth BO reais (Direção, 36 capabilities v8; Administração, 110), autentica por senha efêmera, confere `sub == uid` e `role=authenticated`, e grava só IDs não secretos.
- `supabase/tests/bo4_bd_integrated_auth_real.sql` recusa UUID inventado: exige `auth.users` + `bo_fixture_accounts`; confere as capabilities da sessão real antes do cenário; a Administração real concede à Direção real, pelo `record_engagement` oficial, uma atuação que cobre 2027 (a da fixture vale só ±1 dia). Essa atuação é encerrada por `end_engagement` dentro da mesma transação revertida.
- Resultado: sentinela `bo4-bd-e2e-ok(auth-real=<uid>)` com DIÁRIO, AVALIAÇÃO e CADEIA completos: relatório do diário = 2 = fatos, relatório de plano = 1, fechamento recusado (`rule-required`), knownAt 0→1, Família minimizada/IDOR/revogada, concessão familiar recusada (`capability:manter-autorizacao-de-responsavel`), acompanhamento recusado (`capability:registrar-acompanhamento-pedagogico`).
- Observação: `caps-auth-real-apos-revogacao(amanha)=1692` conta linhas, não capabilities distintas, e reflete a atuação da própria fixture (vigente até hoje+1), não a atuação revertida. A revogação sem logout da fixture já está provada no harness 69/69.
- Cleanup: as 2 contas foram removidas. Consulta externa: 0 Auth BO, 0 pessoas/turmas/alunos/aulas/planos/autorizações familiares/objetos BO, 0 endings, 0 estado 2027 e nenhum dublê vazado; 55 escolas, 698 turmas, 9.763 alunos, 2 atuações e 8 políticas.

### Itens 2–9: NÃO EXECUTADOS nesta rodada
BK por tela, ACL de export/download, a11y (professor/phone, dialogs, erros, double-submit), benchmarks restantes, Security Advisor finding a finding, reexecução do harness/smoke e gates finais. Classificação BO.4: **PARTIAL**. Não se declara PASS.

## BO.5 — itens 0–9 (encerramento técnico)
- 0. Checagem 1.692: 36 capabilities × 46 turmas = 1.656 linhas (expansão capability×escopo); atuação extra deixa de contribuir imediatamente após `end_engagement`, sem logout. Sem vazamento.
- 1. BK: `governed-errors.ts` (8 categorias, código canônico preservado para telemetria, mensagem pt-BR sem stack/SQL); 5 telas migradas para `userErrorText`; `bk-block-matrix.test.tsx` (23 testes).
- 2. Export/download ACL com 6 perfis Auth reais: 42/42 PASS (`scripts/bo5-export-acl.ts`); export == reader; sensível fora por padrão; IDOR recusado; storage só no próprio prefixo.
- 3. A11y: formulário de aula com aria-invalid/aria-describedby e bloqueio de dupla submissão; Dialog/AlertDialog (foco, ESC, retorno) — `bo5-a11y-forms-dialogs.test.tsx` 5/5. Cabeçalho deixou de exibir "Entrar" durante a leitura da sessão (falso negativo professor+phone). Smoke 33/33, incl. professor phone `/diario/turmas`.
- 4. Benchmarks em transação revertida: matrícula 0 ms; enturmação 11/4 ms; diário 15 ms; frequência 13/10 ms; planejamento 21 ms; relatórios 26 ms; avaliação (corpo do reader, 100k linhas, 10k retornadas) 97 ms. Defeito comprovado: `cycle_enrollments_at` recusava escolas com matrícula legada `logical_id NULL` → corrigido na migration 0200.
- 5. Advisor: 499 vs 498 (+1 INFO `bo_fixture_accounts` sem policy e sem GRANT; DEFINER authenticated só devolvem o escopo do chamador). Sem regressão.
- 6. Harness 69/69 (op bo-9ddaccdabbc0) + a11y 0 falhas; 0 Auth BO, 0 resíduos.
- 7. Gates: suíte 3820/3820 (311 arquivos), deep 31/31, tsgo limpo, build real OK, migration integrity ok (0200 no manifesto), diff --check limpo.
- 8. Integridade: 55 escolas, 698 turmas, 9.763 alunos, 2 atuações, 8 políticas, 0 endings/Família/objetos/fatos; FKs restauradas, 0 triggers desligadas; 2026 e 2027 intactos.
- Decisão: PASS — BO_ACADEMIC_TECHNICAL_DEBT_CLOSED. Permanecem classificações não técnicas (AEE, concessão Família, PARALLEL_CONCURRENCY_UNPROVEN). Gates 2027 não declarados.
