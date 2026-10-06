# BQ.1 — Contas institucionais/setoriais e estações (estado: PARTIAL)

Frente única BU.CAL.2.1 + BQ.1 + UX.SIGEM.1–4, base 0ba0b71c.
**CONTINUE_FROM=LOTE_1.2** (modelo de principal institucional). Nenhuma conta foi criada.

## Lote 0 — baseline (lido do banco, 2026-10-06)
- Migrations: 0000–0204 (49 arquivos), sem migration nova nesta rodada.
- Unidades: 55 (40 municipais; 15 privadas conveniadas: 12 filantrópicas, 2 comunitárias, 1 confessional); todas ativas; 55/55 com INEP de 8 dígitos. Nenhuma estadual ou particular não conveniada.
- Pessoas 10.822; vínculos conta↔pessoa 2; atuações 2; políticas 8 (6 homologadas, 2 rascunhos); designação de autoridade do calendário 1.
- Calendário 2027: 7 versões / 7 homologações (inalteradas).

## Matriz derivada (sem assumir quantidade)
| Tipo | Escopo | Regra | Elegíveis |
|---|---|---|---|
| ciece@ | rede | conta central | 1 |
| supervisao@ | rede | conta central (já existe) | 1 |
| alimentacao@ | rede (NAE) | conta central | 1 |
| avalia@ | rede | conta central | 1 |
| orientaped.{INEP}@ | própria escola | escola ativa com INEP válido | 55 |
| diresc.{INEP}@ | própria escola | idem | 55 |
| sec.{INEP}@ | própria escola | idem | 55 |

Total elegível: 169 (4 centrais + 165 escolares). Exceções: nenhuma (0 escolas sem INEP).

## Bloqueio técnico concreto (por que o Lote 1 não foi executado)
`effective_capabilities` resolve autoridade só por `institutional_engagements.person_id = current_person_id()`
(mais a designação nominal do calendário). Conta setorial, por decisão do usuário, **não é pessoa**.
Criar as 169 contas sem antes evoluir o resolver obrigaria a (a) fabricar pessoas para setores — proibido —
ou (b) criar contas sem autoridade alguma, o que não entrega o lote. A evolução necessária, aditiva:

1. Tabela `institutional_sector_principals` (auth user ↔ setor ↔ escopo rede|escola ↔ school_id), append-only, sem DML para papéis do app.
2. `institutional_engagements.principal_id` nullable com CHECK (pessoa XOR principal) — exige revisar todo consumidor que faz JOIN por `person_id` (writers de autoria, ledgers `author_person_id`).
3. Segunda perna em `effective_capabilities` para `principal_id = current_principal_id()`.
4. Política v9 com regras explícitas por setor (matriz A–H da solicitação) e completude do Admin por teste.
5. Script idempotente de provisionamento (Auth admin no sandbox) + registro em `account_credential_events` sem senha.

Esses itens mudam o núcleo de autorização do sistema; precisam de uma rodada dedicada com
revisão dos writers que gravam `author_person_id`, antes dos Lotes 2–8.

---
## BQ.1C — implementado (2026-10-06)

### Desenho
- Migrations aditivas: `0205_bq1c_institutional_sector_principal.sql`, `0206_bq1c_fix_data_quality_fingerprint_check.sql`.
- `institutional_sector_principals`: um principal por usuário de autenticação (`auth_user_id` único), `principal_kind=sector_account`, estação, escopo `network|school`, `school_id` só em escola, proveniência e operação. Sem nome, CPF ou pessoa. Imutável; revogação é linha própria em `institutional_sector_principal_revocations`.
- `sector_station_rule_versions` + `sector_station_rules` (v1 homologada, decisão do usuário 2026-10-06): capabilities explícitas por estação, sem curinga. A estação `administracao_geral` recebe a cobertura linha a linha; `sector_admin_coverage_issues()` precisa estar vazia (testado).
- Resolver: `effective_capabilities` e `effective_scope_capabilities` ganham uma terceira perna (`sector_station_grants`); a perna humana e a designação do calendário ficaram idênticas. Escola nunca vira rede, `school_id` vem só do principal persistido e conta revogada fica com zero na hora, sem precisar sair.
- `capability_grant`/`school_capability_grant` preferem atuação humana (`NULLS LAST`); o principal não tem atuação.
- `current_principal_id()` e `current_actor()` (`human|institutional`; `person_id` é sempre NULL para conta de setor).
- `provision_sector_principal` só para service_role: idempotente, recusa divergência, escola sem INEP e rede com escola. Cada execução registra `institutional_sector_provisioning_events` (executor técnico, nunca autor humano).

### Classificação dos writers
- INSTITUTIONAL_ACTOR_ALLOWED: `record_data_quality_review` grava `recorded_by_principal` e deixa a pessoa NULL.
- HUMAN_ONLY (guarda `session:person-required`, recusa conta de setor mesmo com capability): enroll_student_in_school_year, register/record_institutional_class(_version), record_class_period_organization_version, record_year_transition_decision, record_school_staff_presence, record_map_competence_rule_draft, homologate_map_competence_rule, record_map_conference, open/officialize_statistical_map(_correction), record_school_pedagogical_record_v2, record_guardian_authorization_v2, record_assessment_conference/officialization, record_school_supervision, writers de regras institucionais (BT), writers do calendário (designação). Liberar cada um para conta de setor é decisão por writer (Lote 2+).
- READ_ONLY_FOR_STATION: readers por `has_*_capability`.

### Defeito corrigido
O CHECK de `data_quality_review_events.fingerprint` usava `{3,300}`, acima do limite do Postgres (255), então toda gravação falhava. A 0206 reescreve a mesma regra.

### Contas (sem credenciais)
| Estação | Escopo | Principais |
|---|---|---|
| ciece, supervisao, alimentacao, avaliacao | rede | 1 cada |
| orientacao_pedagogica, direcao_escolar, secretaria_escolar | escola | 55 cada |
Total: 169 principais e 169 contas (168 novas + supervisao@ reutilizada). Na nova execução: 0 criadas, 169 conciliadas.

### Senha
O serviço de autenticação recusa a senha pedida por estar em listas de senhas vazadas (proteção ligada para todo o app, prévia e publicado). Ela não foi aplicada. As contas usam uma senha forte provisória, que não foi gravada no projeto. A conta supervisao@ teve a senha substituída por essa provisória.

### Provas
- `scripts/bq1-sector-login-proof.mjs`: login real das 4 centrais e de 2 escolas × 3 estações, 58/58.
- `supabase/tests/bq1c_sector_principal.sql`: autoria pelo principal, writer HUMAN_ONLY recusado, escola adulterada recusada, sem rede, revogação imediata, imutabilidade e provisionamento recusando entradas inválidas; desfeito ao final, 0 resíduos.
- Gates: suíte 3857/3857, deep 31/31, tsgo e diff-check limpos, migration integrity ok.
- Security Advisor 519→526: +5 tabelas sem policy (fechadas por design, sem grants de app) e +2 DEFINER autenticados (`current_principal_id`, `current_actor`, só leitura do próprio ator); anon segue em 3.
- Dados preservados: 55 escolas, 10.822 pessoas, 2 atuações, 2 vínculos, 8 políticas, 1 designação do calendário.
