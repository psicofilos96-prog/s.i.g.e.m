# Matriz de aceite — Secretaria Escolar (Lote complementar 10)

**Situação atual:** Registro de lote.

Evidência em 2026-10-11 21:35 UTC. Local = GitHub `main` = `b6922066` (mesma árvore `c6b86299`); CI run 38176981867 **em andamento** no momento da medição. Typecheck limpo. Secretaria + invariantes: 264/264 após regenerar o índice de docs (falha real encontrada e corrigida: índice desatualizado).

| Fluxo | Situação | Evidência / bloqueio |
|---|---|---|
| matrícula → enturmação → Diário | implementado sem E2E | writers existentes; E2E autenticado bloqueado (sem conta sintética) |
| atendimento → documento → protocolo → entrega | testado (núcleo puro) | `secretariat-flows.test.ts`, `service-desk.test.ts`; sem tela/banco |
| transferência → histórico | bloqueado por dados | 0 fechamentos/atas no banco; histórico recusado por `document-readiness` |
| conferência documental | testado (núcleo puro) | `document-checklist.test.ts`; checklists não configurados |
| fechamento → rematrícula | testado (núcleo puro) / decisão institucional | `year-closing-wizard.test.ts`; nenhuma regra homologada |
| comunicação com responsável | testado (núcleo puro) | `family-requests.test.ts`; sem provedor externo |
| busca ativa | testado (núcleo puro) | `admin-operations.test.ts`; limiar não homologado |
| livros e impressão em lote | testado (núcleo puro) | `registry-books.test.ts`; telas não criadas |
| agenda administrativa | testado (núcleo puro) | `admin-agenda.test.ts`; prazos não configurados |
| modelos legados | testado (inventário por nome) | `legacy-templates.test.ts`; 6 candidatos aguardam revisão humana |
| isolamento escola A/B | testado só em núcleo | E2E com RLS real bloqueado: `harness-gate` exige `SIGEM_TEST_HARNESS=1` e chave de serviço indisponível |
| migrations | sem migrations neste ciclo | aplicação não apurável pelo papel de leitura |

Não é 100%: nenhum fluxo foi provado em navegador autenticado ou contra RLS real com duas escolas.
