# Frente BH — Controles técnicos de privacidade (fechamento da AS)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Histórico**. Registro de etapa encerrada; não descreve o estado atual.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


## Inventário
Varredura do schema atual buscou colunas de estudante, responsável, CPF, contato, nascimento e saúde. Encontrei 11 tabelas com referência direta a estudante fora do inventário. Elas entraram em `DATA_INVENTORY` como `pessoal-crianca`: collegial_deliberations, infant_experience_versions, inst_assessment_results, institutional_student_persons, notification_events, school_communication_receipts, student_attendance_occurrences, student_class_bond_observations, student_registration_events, student_school_day_observations e year_transition_decisions. A autoria de atos (`person_id`/`engagement_id` de autor) passou a ser uma categoria própria (`autoria`).

## E2E reexecutado (rollback, zero resíduos)
Família (`ac2_family_e2e.sql`, versão BH): `bh-family-ok`.
- Busca de responsável só por CPF exato; CPF inválido é recusado.
- Responsável vê só o próprio educando e só as seções concedidas.
- “Sem acesso” e “não existe” devolvem o mesmo erro (`family:not-authorized`).
- Outra pessoa e outra escola são negadas; versão superada é recusada.
- Revogação corta o acesso futuro e a história fica preservada (3 versões).
- Tabela direta, anon e service_role são negados.

Não reexecutados nesta frente: AEE/mediação, professor, Secretaria, Supervisão. Os E2E salvos (`ah_`, `af_`, `al_`, `aa2_`) seguem válidos só pela última execução registrada.

## Controles verificados por teste (`privacy-hardening`, `privacy-leak`)
CPF fora dos relatórios por padrão (`sensitive`); telemetria redige PII; armazenamento no navegador só nas telas da allowlist; URL assinada de 60 s.

## Pendências não técnicas
- `DATA_RETENTION_POLICY_PENDING`, `LEGAL_BASIS_POLICY_PENDING` e `DISPOSAL_POLICY_PENDING`: nenhuma exclusão, anonimização ou cron. Sem decisão, os dados são retidos.
- `SECURITY_GOVERNANCE_REVIEW_PENDING`: 26 tabelas normativas/contato institucional da unidade legíveis por autenticados, sem PII de estudante (ver BF).
- `HUMAN_VALIDATION_PENDING`.
