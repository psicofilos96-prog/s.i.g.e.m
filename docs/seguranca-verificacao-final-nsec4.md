# Verificação final de segurança — NSEC.4 (2026-10-08)

## Situação atual
- Classe: **Registro de lote**. Regras vivem nos `AGENTS.md`; inventário DEFINER base em `security-definer-function-inventory.md` (NSEC.2) e leitura ampla em `seguranca-leitura-ampla-nsec3.md`.

Foco: só o que mudou depois do inventário. Nenhum acesso foi ampliado para silenciar aviso.

## Achado e correção
| Item | Antes | Depois | Prova |
|---|---|---|---|
| Privilégio de tabela para visitante sem login (`anon`) | 100 tabelas com leitura e 35 com gravação por privilégio de tabela (voltou por privilégio padrão do esquema; `security-hardening-final.md` registrava 0) | 0 | migration 0249 (`REVOKE ALL … FROM anon` + privilégio padrão revogado). Dado não estava exposto: nenhuma política para `anon`/`public` existe e todas as 100 tinham RLS ligada — a correção só reduz acesso |

## Conferido sem mudança
- Funções DEFINER: 615; 12 novas desde o inventário (`access_center_account_detail`, `emit_school_document_v3`, `family_student_cards`, `inclusion_clinical_records_for`, `record_inclusion_clinical`, `record_school_transport_fact`, `record_teacher_work_review`, `teacher_work_review_queue`, `teacher_work_reviewer`, `teacher_work_reviews_of`, `teacher_work_subject`, `temporal_field_unknown`) — todas com `search_path = ''` e sem EXECUTE para PUBLIC/anon.
- Executáveis sem login: só as 4 aceitas (`public_portal_list`, `public_portal_get`, `verify_school_document`, `verify_student_card`).
- Arquivos privados: 5 buckets, todos privados; políticas de storage só para `authenticated` (prefixo próprio/permissão).
- Varredura de segurança: 25 achados `RLS_EXPOSURE` (leitura por qualquer conta logada em catálogos/referências) — os mesmos do NAUD.3; decisão do proprietário, não alterados.
- Linter: 141 tabelas com RLS sem política (fechadas, acesso só por funções), 4 DEFINER anon (aceitas), 431 DEFINER autenticadas (inventariadas).
- Segredos no código: nenhum (padrões `sb_secret_`, JWT, `sgk_`, chave privada).

## Harness (contas temporárias)
114 testes estáticos + 64 checagens com contas reais da política v8: escopo por escola, IDOR para outra escola recusado, autoconcessão recusada, DML direto recusado, edição de política homologada recusada, conta sem pessoa = 0. A execução foi interrompida pelo limite de tempo antes do fim; resíduo conferido depois: 0 contas e 0 registros.

## Pendências
- Supervisão/Avaliação/Alimentação sem tipo de atuação na política v8: `ASSIGNMENT_PENDING`.
- Etapas finais do harness (revogação em sessão aberta, concorrência paralela) não concluídas nesta rodada.
- Tela com login real: `INTERACTIVE_BROWSER_VALIDATION_PENDING`.
