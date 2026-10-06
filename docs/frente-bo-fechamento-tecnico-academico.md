# Frente BO — fechamento técnico acadêmico

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
