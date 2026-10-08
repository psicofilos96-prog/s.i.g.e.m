# NCONC.1 — Concorrência e cabeça esperada (stale-head)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico** (NDOCS.3, 2026-10-08). Superado por `concorrencia-nconc2.md (NCONC.2)`; não use como instrução vigente.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Estado: **PASS técnico (estático + contrato)**; lote **PARTIAL**.

## Método
- Leitura da versão vigente de cada writer crítico nas migrations (última `CREATE OR REPLACE`).
- Verificação: trava (consultiva ou `FOR UPDATE`) adquirida **antes** da comparação com a cabeça esperada; código de conflito próprio.
- Análise de ordem de travas em todas as funções: nenhuma inversão de par (9 pares, 0 inversões) ⇒ sem deadlock evitável por ordem.
- Guarda permanente: `src/test/invariants/concurrency-nconc1.test.ts`.

## Writers auditados
| Domínio | Writer | Trava | Recusa de versão antiga |
|---|---|---|---|
| Matrícula/enturmação | `sec_allocate_core`, `secretariat_reassign_class`, `secretariat_end_class_episode`, `secretariat_record_exit` | `af-alloc` → `af-class-cap` | `base-superseded` |
| Matrícula guiada | `enrollment_draft_save`/`_complete` | `enrollment-draft`, `person-id` (cpf antes de inep) | `draft:stale-head` |
| Turma | `secretariat_create_class` | `class-create` | criação; versões por writers com cabeça |
| Atribuição docente / jornada | `record_teaching_assignment_version_v2`, `record_class_journey_version` | `assignment:`/`journey:` por turma | `stale-head` |
| Calendário | `homologate_calendar_version`, `record_calendar_external_profile` | por versão / perfil | `base-superseded` |
| Mapa | conferência, ajuste, devolução, oficialização | `map-version` → `map-rule` | `map:stale-head`, digest |
| Regras institucionais | `register_capability_policy_draft_expected`, `homologate_capability_policy_expected` | `policy-logical` (0242) + `FOR UPDATE` | `policy:stale-head` |
| Documentos | `emit_school_document_v3`/`v2`, cancelamento, modelo | `sde-idem` → `sde`/`sdn`, `sdt` | `base-superseded`, idempotência |
| Avaliações | `register_assessment_results_v2`, `record_period_closing_act_v2`, `register_academic_standings_v2` | lock por instrumento/escopo | fechamento/último evento esperado |

## Correções
1. **Migration 0242**: a primeira versão de uma política lógica não tinha linha para travar; duas sessões chegavam ao `UNIQUE` com erro bruto. Agora há trava por política lógica e a segunda recebe `policy:stale-head`. Nada sobrescrevia antes (o `UNIQUE` já impedia), mas a mensagem era técnica.
2. **Mensagens**: `duplicate key`, `deadlock detected` e falhas de serialização passam a ser "conflito" ("O registro mudou desde que você abriu a tela…"), não falha técnica.

## Pendências
- **PENDENTE**: execução real com duas sessões simultâneas gravando. Todo writer crítico grava em ledger append-only e imutável; uma gravação aceita por conta temporária não pode ser removida no cleanup, o que alteraria dado oficial. Requer banco de teste isolado ou provas SQL transacionais (`supabase/tests/*`, que terminam em RAISE e já cobrem stale-head por domínio) executadas com acesso privilegiado.
- **INTERACTIVE_BROWSER_VALIDATION_PENDING**: duas abas com login real editando o mesmo registro e conferindo a mensagem de conflito.
