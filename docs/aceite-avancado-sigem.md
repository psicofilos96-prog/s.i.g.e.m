# Reaceite avançado do SIGEM — núcleo + camadas inteligentes (2026-10-05)

Nenhum dado real foi importado. Evidências: `bunx vitest run` (252 arquivos, 3.354 testes; 1 FAIL técnico corrigido e verificado de novo), `tsgo --noEmit` limpo, e uma nova suíte transversal `src/test/invariants/advanced-layers.test.ts` (7 testes estáticos adversariais).

## Resultado por requisito

| # | Requisito | Status | Evidência |
|---|---|---|---|
| 1 | Central de Qualidade não altera fatos sem aviso | PASS | `quality-model.test.ts` (18); invariante: a única gravação é `record_data_quality_review`, sem DML de tabela |
| 2 | Workflows sem bypass | PASS | `workflow-model.test.ts` (14): transição exige capability, seq otimista, idempotência; definição só se homologada |
| 3 | Bulk revalida por item | PASS | `bulk-engine.test.ts` (9): writer por item, prévia com impressão digital, seleção alterada recusada |
| 4 | Simulador não contamina produção | PASS | `scenario-model.test.ts` (7); invariante: `scenarios/` não grava nada (sem insert/update/writers) |
| 5 | Otimizador só propõe | PASS | `optimizer-model.test.ts` (7); invariante: só readers (`class_schedule_at`, `teaching_assignments_at`) |
| 6 | API/webhooks: scopes, idempotência, minimização | PASS | `integration.test.ts` (14): scope insuficiente, replay, HMAC inválido, rate limit, IDOR, payload por allowlist |
| 7 | Integrações não expõem segredos | PASS | `institutional-registry.test.ts` (10): só nome do segredo; credencial recusada na tela e no banco; privilégio só em `.server`/`.functions` após verificação (invariante) |
| 8 | IA read-only não amplia acesso | PASS | `assistant.test.ts` (15): broker por capability, RLS do próprio usuário, sem cliente privilegiado (invariante) |
| 9 | Ações assistidas exigem confirmação e writer revalida | PASS | `proposals.test.ts` (8): gerar não grava; confirmar exige mesma impressão digital, revalida escopo; tipos proibidos fechados |
| 10 | Injeção no prompt/documento não gera ação privilegiada | PASS | `sanitizeRetrieved`, `sanitizePayload`, `kb-core.test.ts` (injeção documental), recusa antes da IA |
| 11 | Anomalias não viram decisão | PASS | `anomaly-core.test.ts` (7); invariante: sem gravação nem leitura de pessoa; descartar é só local |
| 12 | Busca semântica preserva ACL por chunk | PASS | `kb-core.test.ts` (9); RLS `kb_can_read_version` por chunk; `kb_search` INVOKER |
| 13 | Tarefas não substituem fatos | PASS | `task-model.test.ts` (8): tarefa derivada só encerra por transição real; invariante: sem gravação em tabelas de domínio |
| 14 | Nenhuma chamada externa sem provedor configurado | PASS | Invariante: fetch externo só em `assistant.server` (exige chave) e entrega de webhook (exige assinatura cadastrada); adaptadores de integração nascem vazios |
| 15 | Custo/latência/falha de IA com alternativa segura | PASS | Sem chave ou com falha ⇒ modo extrativo local; `store: false`; sem repetição automática |
| 16 | Camadas avançadas podem falhar sem parar o essencial | PASS | Todas são rotas próprias, sem gravação em tabelas do núcleo; nenhum writer do núcleo depende delas |
| 17 | Acessibilidade das novas telas | FAIL → PASS | `a11y.test.tsx`: 3 telas novas tinham um segundo `<main>`; corrigido e verificado de novo |
| 18 | Jornada E2E com contas reais por perfil | BLOCKED | Não há contas reais de Secretaria/Direção/Docente, nem nenhuma com `gerir-tarefas-operacionais`/`gerir-base-de-conhecimento`/`administrar-integracoes` |
| 19 | Restauração de backup real | BLOCKED | Não testada na plataforma |
| 20 | Varredura de segurança da plataforma | BLOCKED (herdado) | 241 avisos do aceite anterior ainda sem revisão individual |

## Como desligar as camadas avançadas
Cada camada é uma rota e um módulo isolados. Sem a capability, a chave de IA ou um adaptador, ela fica fechada. Os fluxos do núcleo (Diário, matrícula, calendário, documentos) continuam funcionando.

## Conclusão
**NÃO PRONTO**, com bloqueadores mínimos:
1. Cadastrar contas reais por perfil e conceder as capabilities avançadas, para executar a jornada E2E autenticada.
2. Testar uma restauração real de backup.

A parte técnica das camadas avançadas passou nos testes (PASS). Os pontos bloqueados dependem de ações operacionais, não de código.
