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
