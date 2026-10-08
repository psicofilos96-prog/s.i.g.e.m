# Inventário das funções SECURITY DEFINER (NSEC.2)

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


Gerado em 2026-10-07 a partir do catálogo do banco (`pg_proc`, schema `public`, `prosecdef`) + varredura de `src/`, `scripts/`, políticas RLS, funções INVOKER, views e `supabase/tests`.

## Contagem
A auditoria anterior falava em 427 funções (nomes de então). Hoje são **603 assinaturas** (596 nomes, contando sobrecargas); **todas as 603 estão classificadas**.

| Classe | Qtde |
|---|---|
| REQUIRED_AUTHENTICATED | 417 |
| INTERNAL_ONLY | 151 |
| DEPRECATED/UNUSED | 27 |
| SERVICE_ONLY | 4 |
| PUBLIC_VERIFICATION | 4 |
| NEEDS_FIX | 0 |

## Fatos verificados
- Owner: `postgres` em 603/603. `search_path` fixo em 603/603 (526 `""`, 77 `public`); nenhuma sem search_path.
- `anon` executa só 4: `public_portal_get`, `public_portal_list`, `verify_school_document`, `verify_student_card` (verificação pública, só campos públicos).
- Funções de trigger (21): nenhuma executável por `authenticated`/`anon`.
- Harness `bo_fixture_*` (4): sem EXECUTE para anon/authenticated → SERVICE_ONLY.
- Writers executáveis por `authenticated` sem verificação de identidade/capacidade no corpo: **0**. O único caso aparente (`record_curricular_matrix_version`, 11 argumentos) delega ao writer de 10 argumentos, que verifica capacidade.
- Writers que recebem `_actor` validam com `act_as_verified_user`/`authorize_account_action` (ator = sessão), nunca confiam no cliente.
- DEPRECATED/UNUSED: 25 já sem EXECUTE para authenticated (writers substituídos: _v1/_v2, assinaturas antigas). Restam 2 executáveis: `applicable_diary_policy(text, boolean)` (ainda chamada por outra função privilegiada) e `install_sigem_reviewed` de 9 argumentos (comentário DEPRECATED). **Não revogadas:** a referência no app não pôde ser descartada com certeza; ficam como candidatas a NDB.1.1.

## Revogações
Nenhuma nova nesta rodada: tudo o que foi comprovadamente desnecessário já havia sido revogado em 0233 (anon) e 0234 (writers substituídos). Nenhum acesso foi ampliado.

## Pendências
- Abuse tests com contas temporárias (school_id alheio, actor falso, stale-head, exportação sem capacidade, função revogada): o banco deste ambiente é só leitura e não executa funções → **INTERACTIVE_BROWSER_VALIDATION_PENDING** (só pelo harness `scripts/harness-gate.mjs`).
- Heurística: autenticação/capacidade/expected-head detectadas por padrão no corpo; "delega" = protegida pela função chamada.

## Legenda das colunas
assinatura | tipo | search_path | grants | papel (writer/reader/helper/trigger) | uso (app, policy, invoker, view, sqltest, definer) | autenticação/capacidade interna | expected-head/lock | classe

| Função | Tipo | search_path | Grants | Papel | Uso | Guarda | Head | Classe |
|---|---|---|---|---|---|---|---|---|
| `aa_conference_state(_instrument text)` | DEFINER | `""` | nenhum | reader | app,definer | — | — | INTERNAL_ONLY |
| `aa_instrument_completeness_internal(_instrument text)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | — | sim | INTERNAL_ONLY |
| `aa_period_window(_period text, _known_at timestamp with time zone, OUT starts_on date, OUT ends_on date)` | DEFINER | `""` | nenhum | reader | app,definer | — | — | INTERNAL_ONLY |
| `ab_scope_allows(_capability text, _school text, _on date)` | DEFINER | `""` | nenhum | reader | app | sim | — | INTERNAL_ONLY |
| `access_center_authorize_reset(_users uuid[])` | DEFINER | `""` | authenticated,service_role | reader | app | — | — | REQUIRED_AUTHENTICATED |
| `access_center_holder()` | DEFINER | `""` | authenticated,service_role | reader | app,policy,definer | sim | — | REQUIRED_AUTHENTICATED |
| `access_center_inventory()` | DEFINER | `""` | authenticated,service_role | reader | app | — | — | REQUIRED_AUTHENTICATED |
| `access_center_record_reset(_users uuid[], _succeeded uuid[])` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `activate_sigem_reviewed(_policy_id uuid, _expected_fingerprint text, _confirm_all_rules_reviewed boolean)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `admin_account_overview()` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `aee_services_at(_school text, _student text, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `aee_sessions_at(_service_logical uuid, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `af_document_facts(_school text, _student text, _on date)` | DEFINER | `""` | nenhum | reader | app,definer | — | — | INTERNAL_ONLY |
| `af_enrollment_current(_id text)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | — | — | INTERNAL_ONLY |
| `af_episode_current(_id text)` | DEFINER | `""` | nenhum | reader | app,definer | — | — | INTERNAL_ONLY |
| `af_natural_person()` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `ah_engagement_active(_engagement uuid, _on date)` | DEFINER | `""` | nenhum | reader | app,definer | — | — | INTERNAL_ONLY |
| `ah_grant(_capability text, _school text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `ah_inclusion_records_guard()` | DEFINER | `""` | nenhum | trigger | — | — | — | INTERNAL_ONLY |
| `ah_mediation_guard()` | DEFINER | `""` | nenhum | trigger | — | — | — | INTERNAL_ONLY |
| `al_supervision_grant(_capability text, _school text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `am_designated_installer()` | DEFINER | `public` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `applicable_diary_policy(_family text, _closing_present boolean)` | DEFINER | `public` | authenticated,service_role | reader | app,definer | — | — | DEPRECATED/UNUSED |
| `apply_assessment_instrument(_instrument text, _expected_last_event_id uuid)` | DEFINER | `public` | nenhum | writer | app | sim | sim | DEPRECATED/UNUSED |
| `apply_assessment_instrument_v2(_instrument text, _expected_last_event_id uuid, _applied_on date)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `apply_workflow_transition(_instance uuid, _transition text, _expected_seq integer, _idempotency_key text, _comment text, _attachment_ref text, _due_on date)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `assessment_analysis_definitions_at(_known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `assessment_edition_cycle_at(_edition uuid, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `assessment_editions_at(_program uuid, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `assessment_instrument_completeness(_instrument text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `assessment_instrument_governance_state(_instrument text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `assessment_metric_comparability_at(_known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `assessment_programs_at(_known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `assign_class_designation(_class text, _expected_sequence integer, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `attendance_closing_covering(_lesson_logical text, _class text)` | DEFINER | `public` | authenticated,service_role | reader | app,definer | — | — | REQUIRED_AUTHENTICATED |
| `authorize_account_action(_actor uuid, _user uuid)` | DEFINER | `public` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `authorize_inclusion_attachment_access(_attachment uuid, _purpose text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `authorize_meal_evidence_access(_id uuid)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `b2_4_authorizing_engagement()` | DEFINER | `public` | authenticated,service_role | reader | app,sqltest,definer | sim | — | REQUIRED_AUTHENTICATED |
| `b3_allocation_ended_on(_logical text)` | DEFINER | `public` | service_role | reader | app,invoker,sqltest,definer | — | — | INTERNAL_ONLY |
| `b3_enrollment_ending_head(_logical text)` | DEFINER | `public` | service_role | reader | app,sqltest,definer | — | — | INTERNAL_ONLY |
| `b3_enrollment_head(_logical text)` | DEFINER | `public` | service_role | reader | app,sqltest,definer | — | — | INTERNAL_ONLY |
| `b3_participation_head(_logical text)` | DEFINER | `public` | service_role | reader | app,sqltest,definer | — | — | INTERNAL_ONLY |
| `b4_class_time_grant(_capability text, _school text)` | DEFINER | `""` | nenhum | reader | app,sqltest | sim | — | INTERNAL_ONLY |
| `bo_fixture_cleanup(_operation_id text)` | DEFINER | `""` | service_role | writer | app | — | — | SERVICE_ONLY |
| `bo_fixture_expire(_operation_id text, _user_id uuid)` | DEFINER | `""` | service_role | writer | app | — | — | SERVICE_ONLY |
| `bo_fixture_prepare(_operation_id text, _source_hash text, _user_id uuid, _kind text, _with_person boolean)` | DEFINER | `""` | service_role | writer | app | sim | — | SERVICE_ONLY |
| `bo_fixture_residue()` | DEFINER | `""` | service_role | reader | app | sim | — | SERVICE_ONLY |
| `calendar_applicability_options_at(_version_id uuid)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `calendar_at(_calendar_id text, _on date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `calendar_composed_days_at(_allocation text, _from date, _to date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `calendar_composition_norm_at(_on date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `calendar_council_agenda_at(_allocation text, _from date, _to date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `calendar_council_configuration_at(_version_id uuid, _on date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `calendar_day_at(_calendar_id text, _date date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `calendar_day_types_at(_known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `calendar_days_at(_calendar_id text, _from date, _to date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `calendar_designated_capabilities(_on date)` | DEFINER | `""` | authenticated,service_role | reader | app,policy,definer | sim | — | REQUIRED_AUTHENTICATED |
| `calendar_external_profile_at(_calendar_id text, _template_code text, _on date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `calendar_has_network_capability(_cap text)` | DEFINER | `""` | service_role | reader | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `calendar_list_at(_known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `calendar_network_grant(_cap text)` | DEFINER | `""` | service_role | reader | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `calendar_network_sources_at(_known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `calendar_pending_context_visible(_version_id uuid)` | DEFINER | `""` | authenticated,service_role | reader | app,policy | sim | — | REQUIRED_AUTHENTICATED |
| `calendar_presentation_at(_version_id uuid, _on date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `calendar_version_homologated_known(_version_id uuid, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app,definer | — | — | REQUIRED_AUTHENTICATED |
| `can_read_assessment_item(_author uuid, _status text, _visibility text, _school text)` | DEFINER | `""` | authenticated,service_role | reader | app,policy,definer | sim | — | REQUIRED_AUTHENTICATED |
| `can_read_attendance_closing(_class text, _period text)` | DEFINER | `public` | authenticated,service_role | reader | app,policy | sim | — | REQUIRED_AUTHENTICATED |
| `can_read_class_roster(_class text)` | DEFINER | `public` | authenticated,service_role | reader | app,policy,invoker | sim | — | REQUIRED_AUTHENTICATED |
| `can_read_closing(_class text, _period text)` | DEFINER | `public` | authenticated,service_role | reader | app,policy | sim | — | REQUIRED_AUTHENTICATED |
| `can_read_collegial(_class text)` | DEFINER | `public` | authenticated,service_role | reader | app,policy | sim | — | REQUIRED_AUTHENTICATED |
| `can_read_institutional_class(_class text, _school text)` | DEFINER | `public` | authenticated,service_role | reader | app,policy,definer | sim | — | REQUIRED_AUTHENTICATED |
| `can_read_offer_organization(_class_id text)` | DEFINER | `""` | authenticated | reader | app,policy,invoker,definer | sim | — | REQUIRED_AUTHENTICATED |
| `can_read_operational_task(_task uuid)` | DEFINER | `""` | authenticated,service_role | reader | app,policy | sim | — | REQUIRED_AUTHENTICATED |
| `can_read_teaching_plan_version(_author uuid, _status text, _school text)` | DEFINER | `""` | authenticated,service_role | reader | app,policy | sim | — | REQUIRED_AUTHENTICATED |
| `cancel_notification_event(_event uuid, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `cancel_school_document_emission(_emission_id uuid, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `canonical_reference_state(_id text)` | DEFINER | `public` | authenticated,service_role | reader | app,definer | — | — | REQUIRED_AUTHENTICATED |
| `capability_classes(_capability text)` | DEFINER | `""` | authenticated,service_role | reader | app,policy | sim | — | REQUIRED_AUTHENTICATED |
| `capability_grant(_capability text, _class text, _component text, _period text)` | DEFINER | `public` | authenticated,service_role | reader | app,sqltest,definer | sim | — | REQUIRED_AUTHENTICATED |
| `capability_policy_homologation_issues(_policy uuid, _valid_from date)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `census_advance_stage(_cycle text, _expected_seq integer, _stage text, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `census_can_read_network()` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `census_compare(_snapshot uuid, _import uuid)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `census_compose(_year text, _on date)` | DEFINER | `""` | nenhum | reader | app,definer | — | — | INTERNAL_ONLY |
| `census_confer_snapshot(_snapshot uuid, _fingerprint text, _note text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `census_cycles_overview()` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `census_live_preview(_cycle text)` | DEFINER | `""` | authenticated | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `census_natural_person()` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `census_open_cycle(_year text, _reference_date date, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `census_school_pending(_cycle text, _school text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `census_snapshot_content(_snapshot uuid)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `census_stage_source(_cycle text, _origin text, _edition_layout text, _parser_id text, _parser_version integer, _source_sha256 text, _rows jsonb)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `census_take_snapshot(_cycle text, _expected_head uuid, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `class_block_teaching_engagements(_class_id text, _matrix_version_id uuid, _item_key text, _on date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated | reader | app,invoker | — | — | REQUIRED_AUTHENTICATED |
| `class_composition_core(_class text, _expected_head uuid, _positions jsonb, _valid_from date, _valid_until date, _reason text)` | DEFINER | `""` | nenhum | writer | app,definer | sim | sim | INTERNAL_ONLY |
| `class_fact_context(_class_id text, _from date, _until date)` | DEFINER | `""` | authenticated,service_role | reader | app,definer | — | — | REQUIRED_AUTHENTICATED |
| `class_period_link_boundary(_old_org text, _new_org text, _on date)` | DEFINER | `""` | nenhum | reader | app,sqltest | — | — | INTERNAL_ONLY |
| `class_period_link_context(_class_id text, _organization_id text, _from date, _until date)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | — | — | INTERNAL_ONLY |
| `class_record_context(_school_id text, _academic_year_id text, _valid_from date, _valid_until date)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | — | — | INTERNAL_ONLY |
| `class_schedule_engagement_valid(_engagement uuid, _class text, _component text, _on date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `class_time_capability_grant(_capability text, _school text, _on date)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `class_time_sector_principal(_capability text, _school text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `class_time_writable_target(_class_id text, _valid_from date, _valid_until date, _domain text)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | — | — | INTERNAL_ONLY |
| `classes_with_period_link_at(_valid_on date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `close_collegial_minute(_session_id text, _expected_last_event_id uuid, _expected_minute_id text, _document jsonb, _plan_id text)` | DEFINER | `public` | authenticated | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `collegial_conduct_authority(_body text, _version integer, _class text)` | DEFINER | `public` | authenticated,service_role | reader | app,sqltest,definer | sim | — | REQUIRED_AUTHENTICATED |
| `comm_author_grant(_school text, _audience text, _class text, OUT engagement uuid, OUT capability text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `comm_student_in_class(_student text, _class text, _on date)` | DEFINER | `""` | nenhum | reader | app | — | — | INTERNAL_ONLY |
| `constitute_cycle_enrollment(_id text, _student text, _school text, _academic_year text, _opened_on date, _institutional_number text, _act_ref text, _supersedes text, _correction_reason text, _offer_value text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `create_assessment_instrument(_id text, _class text, _period text, _instrument_type text, _definition jsonb)` | DEFINER | `public` | nenhum | writer | app | sim | — | DEPRECATED/UNUSED |
| `create_assessment_instrument_v2(_id text, _assignment text, _period text, _instrument_type text, _definition jsonb, _planned_on date, _references uuid[])` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `create_operational_task(_school text, _title text, _description text, _priority text, _due_on date, _recurrence jsonb, _source_kind text, _source_ref text, _dedupe_key text, _assignee uuid)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `current_actor()` | DEFINER | `""` | authenticated,service_role | reader | app,invoker,sqltest,definer | sim | — | REQUIRED_AUTHENTICATED |
| `current_closing_for_instrument(_instrument text)` | DEFINER | `public` | authenticated,service_role | reader | app | — | — | REQUIRED_AUTHENTICATED |
| `current_closing_id(_scope_key text)` | DEFINER | `public` | authenticated,service_role | reader | app,definer | — | — | REQUIRED_AUTHENTICATED |
| `current_person_id()` | DEFINER | `public` | authenticated,service_role | reader | app,policy,invoker,definer | sim | — | REQUIRED_AUTHENTICATED |
| `current_principal_id(_on date)` | DEFINER | `""` | authenticated,service_role | reader | app,policy,sqltest,definer | sim | — | REQUIRED_AUTHENTICATED |
| `current_sector_rules_version(_on date)` | DEFINER | `""` | service_role | reader | app,definer | — | — | INTERNAL_ONLY |
| `data_quality_can_review(_school uuid)` | DEFINER | `""` | authenticated,service_role | reader | app,policy | sim | — | REQUIRED_AUTHENTICATED |
| `declare_cycle_participation(_logical text, _base_version_id uuid, _enrollment_logical text, _nature_value text, _nature_version integer, _valid_from date, _valid_until date, _act_ref text, _change_reason text, _annul boolean)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `designation_actor(OUT person_id uuid)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `designation_school_engagement(_school text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `designation_year_valid_on(_year text)` | DEFINER | `""` | nenhum | reader | app,sqltest | — | — | INTERNAL_ONLY |
| `designation_year_writable(_year text)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | — | — | INTERNAL_ONLY |
| `diary_holder_scope(_assignment text, _substitution text, _on date, OUT class_id text, OUT school_id text, OUT component_id text, OUT engagement_id uuid, OUT academic_year_id text)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `diary_period_at(_class text, _on date, _known_at timestamp with time zone)` | DEFINER | `""` | nenhum | reader | app,sqltest | — | — | INTERNAL_ONLY |
| `diary_roster_at(_assignment text, _substitution text, _on date)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `diary_school_day_issue(_school text, _on date, _known_at timestamp with time zone, OUT issue text, OUT calendar_id text, OUT calendar_version_id uuid)` | DEFINER | `""` | nenhum | reader | app,sqltest | — | — | INTERNAL_ONLY |
| `diary_school_overview_at(_school text, _from date, _to date)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `diary_teacher_actor(_assignment text, _substitution text, _on date, _capability text, OUT engagement_id uuid, OUT assignment_version_id uuid, OUT substitution_version_id uuid, OUT policy_id uuid, OUT policy_version integer, OUT class_id text, OUT school_id text, OUT academic_year_id text, OUT matrix_version_id uuid, OUT item_key text, OUT component_id text)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `dietary_restriction_instructions(_school text, _on date, _purpose text)` | DEFINER | `""` | authenticated | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `dietary_restrictions_at(_school text, _on date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `dispatch_notification_event(_event uuid)` | DEFINER | `""` | authenticated,service_role | writer | app,definer | sim | — | REQUIRED_AUTHENTICATED |
| `draft_class_designation_policy(_policy_key text, _expected_version integer, _criterion_type text, _criterion_params jsonb, _valid_from date, _valid_until date, _provenance_note text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `effective_capabilities(_on date)` | DEFINER | `public` | authenticated,service_role | reader | app,invoker,sqltest,definer | sim | — | REQUIRED_AUTHENTICATED |
| `effective_scope_capabilities(_on date)` | DEFINER | `public` | authenticated,service_role | reader | app,invoker,sqltest,definer | sim | — | REQUIRED_AUTHENTICATED |
| `ei_can_read()` | DEFINER | `""` | service_role | reader | app,definer | sim | — | INTERNAL_ONLY |
| `ei_grant(_capability text, _school text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `emit_notification_event(_event_key text, _kind text, _school text, _student text, _payload jsonb, _deep_link text, _expires timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `emit_school_document(_template_version_id uuid, _school_id text, _student_id text, _context jsonb, _snapshot jsonb, _reproduces_id uuid, _retifies_id uuid, _retification_reason text)` | DEFINER | `""` | nenhum | writer | app,sqltest | sim | — | DEPRECATED/UNUSED |
| `emit_school_document_v2(_template_version_id uuid, _school_id text, _student_id text, _valid_on date, _reproduces_id uuid, _retifies_id uuid, _retification_reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `end_engagement(_engagement uuid, _ended_on date, _act_ref text)` | DEFINER | `public` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `enroll_student_in_school_year(_student text, _school text, _year text, _declared_on date, _act_ref text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `enrollment_draft_abandon(_draft uuid, _expected integer, _reason text)` | DEFINER | `""` | authenticated | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `enrollment_draft_complete(_draft uuid, _expected integer, _year text, _declared_on date, _class text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `enrollment_draft_save(_draft uuid, _school text, _expected integer, _step integer, _payload jsonb, _cpf text, _inep text, _existing_student text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `enrollment_drafts_open(_school text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `enrollment_form_for_student(_school text, _student text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `enrollment_photo_bind(_draft uuid)` | DEFINER | `""` | authenticated | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `enrollment_wizard_class_options(_school text, _year text, _on date)` | DEFINER | `""` | authenticated | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `ew_head(_draft uuid)` | DEFINER | `""` | nenhum | reader | app | — | — | INTERNAL_ONLY |
| `ewd_head(_draft uuid)` | DEFINER | `""` | nenhum | reader | app,definer | — | — | INTERNAL_ONLY |
| `family_authorization(_student text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `family_communications(_student text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `family_published_menus(_student text, _on date)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `family_student_summary(_student text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `family_students()` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `functional_grant(_school text)` | DEFINER | `public` | authenticated,service_role | reader | app,definer | sim | — | REQUIRED_AUTHENTICATED |
| `general_admin_session()` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `guard_calendar_applicability_child()` | DEFINER | `""` | service_role | trigger | sqltest | — | — | INTERNAL_ONLY |
| `guard_calendar_applicability_window()` | DEFINER | `""` | service_role | trigger | sqltest | — | — | INTERNAL_ONLY |
| `guard_calendar_day_type_version()` | DEFINER | `""` | service_role | trigger | sqltest | — | — | INTERNAL_ONLY |
| `guard_calendar_homologation_chain()` | DEFINER | `""` | service_role | trigger | sqltest | — | — | INTERNAL_ONLY |
| `guard_calendar_version()` | DEFINER | `""` | service_role | trigger | sqltest | — | — | INTERNAL_ONLY |
| `guard_calendar_version_child()` | DEFINER | `""` | service_role | trigger | sqltest | — | — | INTERNAL_ONLY |
| `guard_class_journey_interval()` | DEFINER | `""` | nenhum | trigger | — | — | — | INTERNAL_ONLY |
| `guard_class_journey_version()` | DEFINER | `""` | nenhum | trigger | — | — | — | INTERNAL_ONLY |
| `guard_class_journey_version_has_intervals()` | DEFINER | `""` | nenhum | trigger | — | — | — | INTERNAL_ONLY |
| `guard_class_period_link_overlap()` | DEFINER | `""` | nenhum | trigger | sqltest | — | — | INTERNAL_ONLY |
| `guard_class_record_current_overlap()` | DEFINER | `""` | nenhum | trigger | sqltest | — | — | INTERNAL_ONLY |
| `guard_class_schedule_block()` | DEFINER | `""` | nenhum | trigger | — | — | — | INTERNAL_ONLY |
| `guard_class_schedule_block_engagement()` | DEFINER | `""` | nenhum | trigger | — | — | — | INTERNAL_ONLY |
| `guard_class_schedule_version()` | DEFINER | `""` | nenhum | trigger | — | — | — | INTERNAL_ONLY |
| `guard_class_schedule_version_has_blocks()` | DEFINER | `""` | nenhum | trigger | — | — | — | INTERNAL_ONLY |
| `guard_class_time_root()` | DEFINER | `""` | nenhum | trigger | — | — | — | INTERNAL_ONLY |
| `guard_teaching_assignment_version()` | DEFINER | `""` | nenhum | trigger | — | — | — | INTERNAL_ONLY |
| `guard_teaching_substitution_version()` | DEFINER | `""` | nenhum | trigger | — | — | — | INTERNAL_ONLY |
| `guardian_authorization_chain(_school text, _student text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `has_capability(_capability text, _class text, _period text)` | DEFINER | `public` | authenticated,service_role | reader | app,policy,invoker,sqltest,definer | sim | — | REQUIRED_AUTHENTICATED |
| `has_network_capability(_capability text)` | DEFINER | `public` | authenticated,service_role | reader | app,policy,invoker,sqltest,definer | sim | — | REQUIRED_AUTHENTICATED |
| `has_school_capability(_capability text, _school text)` | DEFINER | `public` | authenticated,service_role | reader | app,policy,invoker,sqltest,definer | sim | — | REQUIRED_AUTHENTICATED |
| `homologate_assessment_correction_policy(_logical_id text, _version integer, _reason text, _source_ref text)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `homologate_attendance_calculation_policy(_logical_id text, _version integer, _reason text, _source_ref text)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `homologate_attendance_occurrence_type(_logical_id text, _version integer, _reason text, _source_ref text)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `homologate_calendar_composition_norm(_version_id uuid, _expected_last_homologation_id uuid, _decision text, _effective_from date, _act_ref text, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `homologate_calendar_version(_calendar_version_id uuid, _expected_last_homologation_id uuid, _decision text, _effective_from date, _act_ref text, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `homologate_capability_policy(_policy uuid, _act_ref text, _valid_from date)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `homologate_capability_policy_expected(_policy uuid, _valid_from date, _act_ref text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `homologate_class_designation_policy(_policy_version_id uuid, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `homologate_class_specific_matrix_association_version(_version_id uuid, _expected_head_id uuid, _decision text, _effective_from date, _act_ref text, _reason text)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | sim | REQUIRED_AUTHENTICATED |
| `homologate_collegial_body_configuration(_logical_id text, _version integer, _reason text, _source_ref text)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `homologate_correspondence_profile_version(_version_id uuid, _expected_head_id uuid, _decision text, _effective_from date, _act_ref text, _reason text)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | sim | REQUIRED_AUTHENTICATED |
| `homologate_curricular_matrix_version(_version_id uuid, _expected_head_id uuid, _decision text, _effective_from date, _act_ref text, _reason text)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | sim | REQUIRED_AUTHENTICATED |
| `homologate_curricular_reference(_target_kind text, _target_id uuid, _decision text, _expected_head uuid, _reason text, _effective_on date)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `homologate_cycle_closing_policy(_logical_id text, _version integer, _reason text, _source_ref text)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `homologate_diary_correction_policy(_logical_id text, _version integer, _reason text, _source_ref text)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `homologate_map_competence_rule(_id text, _version integer, _source_ref text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `homologate_network_calendar(_version_id uuid, _expected_last_homologation_id uuid, _act_ref text, _reason text)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `homologate_position_matrix_correspondence_version(_version_id uuid, _expected_head_id uuid, _decision text, _effective_from date, _act_ref text, _reason text)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | sim | REQUIRED_AUTHENTICATED |
| `homologate_workflow_definition(_id uuid)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `import_batch_detail(_batch_id uuid)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `import_batches_list()` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `import_grant()` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `inclusion_access_trail(_attachment uuid)` | DEFINER | `""` | authenticated,service_role | reader | app | — | — | REQUIRED_AUTHENTICATED |
| `inclusion_attachments_for(_record_logical uuid)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `inclusion_grant(_capability text, _school text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `inclusion_mediations_at(_school text, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `inclusion_my_mediated_students(_on date)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `inclusion_my_mediation(_student text, _on date)` | DEFINER | `""` | nenhum | reader | app | sim | — | INTERNAL_ONLY |
| `inclusion_network_overview(_on date)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `inclusion_record_location(_record_logical uuid)` | DEFINER | `""` | authenticated,service_role | reader | app | — | — | REQUIRED_AUTHENTICATED |
| `inclusion_records_at(_school text, _student text, _known_at timestamp with time zone, _logical_id uuid)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `inclusion_require(_capability text, _school text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `inclusion_teaching_support_flags(_on date)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `inclusion_term_grant()` | DEFINER | `""` | service_role | reader | app,definer | sim | — | INTERNAL_ONLY |
| `inclusion_term_reviews_at(_known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `inst_assessment_result_history(_logical_id uuid)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `inst_assessment_results_at(_assessment uuid, _school text, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `inst_assessments_at(_known_at timestamp with time zone, _logical_id uuid)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `install_sigem(_act_ref text, _person_name text, _person_identifier text, _engagement_kind_id text, _position_label text, _policy_id uuid)` | DEFINER | `public` | service_role | writer | app,sqltest,definer | sim | sim | INTERNAL_ONLY |
| `install_sigem_reviewed(_act_ref text, _actor_nature text, _person_name text, _person_identifier text, _engagement_kind_id text, _position_label text, _policy_id uuid, _expected_fingerprint text, _confirm_all_rules_reviewed boolean)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | DEPRECATED/UNUSED |
| `install_sigem_reviewed(_act_ref text, _person_name text, _person_identifier text, _engagement_kind_id text, _position_label text, _policy_id uuid, _expected_fingerprint text, _confirm_all_rules_reviewed boolean)` | DEFINER | `""` | service_role | reader | app,sqltest | sim | sim | INTERNAL_ONLY |
| `install_sigem_reviewed(_act_ref text, _person_name text, _person_identifier text, _engagement_kind_id text, _position_label text, _policy_id uuid, _reviewed_rule_count integer, _confirm_all_rules_reviewed boolean)` | DEFINER | `""` | service_role | reader | app,sqltest | sim | — | DEPRECATED/UNUSED |
| `installation_review()` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `institutional_class_register_core(_school_id text, _academic_year_id text, _code text, _name text, _administrative_status text, _valid_from date, _valid_until date, _act_ref text, _recorded_by uuid, _person uuid, _engagement uuid, _policy uuid, _op uuid)` | DEFINER | `""` | nenhum | writer | app,sqltest,definer | delega | — | INTERNAL_ONLY |
| `institutional_class_register_principal(_school_id text, _academic_year_id text, _code text, _name text, _valid_from date, _valid_until date, _act_ref text, _principal uuid)` | DEFINER | `""` | nenhum | writer | app | sim | — | INTERNAL_ONLY |
| `institutional_integrations_overview()` | DEFINER | `""` | authenticated,service_role | reader | app | — | — | REQUIRED_AUTHENTICATED |
| `institutional_rule_engagement(_capability text)` | DEFINER | `""` | service_role | reader | app,definer | sim | — | INTERNAL_ONLY |
| `institutional_rule_homologate(_domain text, _logical text, _version integer, _reason text, _source_ref text)` | DEFINER | `""` | service_role | reader | app,definer | sim | — | INTERNAL_ONLY |
| `institutional_rule_homologate_core(_domain text, _logical text, _version integer, _reason text, _source_ref text, _actor uuid, _person uuid, _engagement uuid)` | DEFINER | `""` | service_role | writer | app,sqltest | sim | sim | INTERNAL_ONLY |
| `institutional_rule_payload_issue(_domain text, _p jsonb, _valid_from date, _valid_until date)` | DEFINER | `""` | service_role | reader | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `institutional_rule_record_draft(_domain text, _logical text, _expected integer, _valid_from date, _valid_until date, _payload jsonb, _reason text, _source_ref text)` | DEFINER | `""` | service_role | reader | app,sqltest,definer | sim | sim | INTERNAL_ONLY |
| `institutional_rule_record_draft_core(_domain text, _logical text, _expected integer, _valid_from date, _valid_until date, _payload jsonb, _reason text, _source_ref text, _actor uuid, _person uuid, _engagement uuid)` | DEFINER | `""` | service_role | writer | app,sqltest | sim | sim | INTERNAL_ONLY |
| `institutional_rule_target_head(_domain text, _logical text)` | DEFINER | `""` | service_role | reader | app,definer | — | — | INTERNAL_ONLY |
| `institutional_rule_versions_at(_domain text, _on date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `institutional_rule_versions_core(_domain text, _on date, _known_at timestamp with time zone)` | DEFINER | `""` | service_role | reader | app,sqltest | — | — | INTERNAL_ONLY |
| `integration_create_client(_name text, _scopes text[], _school_ids text[], _rate integer)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `integration_create_subscription(_client uuid, _url text, _events text[])` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `integration_issue_key(_client uuid)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `integration_overview()` | DEFINER | `""` | authenticated,service_role | reader | app | — | — | REQUIRED_AUTHENTICATED |
| `integration_replay_delivery(_delivery uuid)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `integration_require_admin()` | DEFINER | `""` | authenticated,service_role | reader | app,definer | sim | — | REQUIRED_AUTHENTICATED |
| `integration_revoke_key(_key uuid)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `integration_rotate_secret(_subscription uuid)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `integration_set_client_active(_client uuid, _active boolean)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `intelligence_dashboards_visible()` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `kb_can_read_version(_version uuid)` | DEFINER | `""` | authenticated,service_role | reader | app,policy | sim | — | REQUIRED_AUTHENTICATED |
| `link_institutional_account(_actor uuid, _user uuid, _person uuid, _login text)` | DEFINER | `public` | authenticated,service_role | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `link_lesson_to_plan(_lesson_logical_record_id text, _plan_version_id uuid, _revoke_link uuid)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `locate_guardian_person_exact(_school text, _kind text, _value text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `locate_professional_exact(_school text, _kind text, _value text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `locate_student_exact(_school text, _kind text, _value text, _year text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `locate_student_for_enrollment(_kind text, _value text)` | DEFINER | `public` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `map_mediation_projection_at(_school text, _on date)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `map_year_state_on(_on date)` | DEFINER | `""` | authenticated | reader | app,invoker,sqltest,definer | — | — | REQUIRED_AUTHENTICATED |
| `meal_audit_trail_at(_school text, _from timestamp with time zone, _to timestamp with time zone)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `meal_can_read_receiving(_school text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `meal_catalog_version(_scheme text, _value text)` | DEFINER | `""` | nenhum | reader | app,definer | — | — | INTERNAL_ONLY |
| `meal_competence_checklist_at(_school text, _competence text)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | sim | REQUIRED_AUTHENTICATED |
| `meal_content_stagings_list()` | DEFINER | `""` | authenticated | reader | app | — | — | REQUIRED_AUTHENTICATED |
| `meal_deliveries_at(_school text, _from date, _to date, _as_of date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated | reader | app | sim | sim | REQUIRED_AUTHENTICATED |
| `meal_demand_consolidation_at(_competence text)` | DEFINER | `""` | authenticated | reader | app,sqltest,definer | sim | — | REQUIRED_AUTHENTICATED |
| `meal_evidence_can_read(_kind text, _school text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `meal_evidence_for(_kind text, _target uuid)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `meal_evidence_slot(_kind text, _target uuid, _media text, _size integer)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `meal_evidence_target_school(_kind text, _target uuid)` | DEFINER | `""` | nenhum | reader | app,definer | — | — | INTERNAL_ONLY |
| `meal_executions_at(_school text, _from date, _to date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `meal_fiscal_documents_at(_school text)` | DEFINER | `""` | authenticated | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `meal_forecasts_at(_school text, _from date, _to date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `meal_grant(_capability text, _school text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `meal_grant_on(_capability text, _school text, _on date)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `meal_has_network(_caps text[])` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `meal_inventory_at(_school text, _from date, _to date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `meal_kitchen_day_at(_school text, _on date)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | sim | REQUIRED_AUTHENTICATED |
| `meal_kitchens_at(_on date)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `meal_master_at(_kind text, _on date, _known_at timestamp with time zone, _include_drafts boolean)` | DEFINER | `""` | authenticated | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `meal_master_history(_logical uuid)` | DEFINER | `""` | authenticated | reader | app | sim | sim | REQUIRED_AUTHENTICATED |
| `meal_menu_publications_at(_school text)` | DEFINER | `""` | authenticated | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `meal_menus_at(_school text, _from date, _to date, _known_at timestamp with time zone, _logical_id uuid)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `meal_network_action_summary(_on date, _competence text)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | sim | REQUIRED_AUTHENTICATED |
| `meal_network_data_quality(_on date)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `meal_network_grant(_capability text)` | DEFINER | `""` | nenhum | reader | app | sim | — | INTERNAL_ONLY |
| `meal_network_grant_on(_capability text, _on date)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `meal_network_overview(_from date, _to date)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `meal_nonconformities_at(_school text, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `meal_operational_records_at(_school text, _from date, _to date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `meal_order_history(_logical uuid)` | DEFINER | `""` | authenticated | reader | app | — | — | REQUIRED_AUTHENTICATED |
| `meal_order_windows_at(_competence text)` | DEFINER | `""` | authenticated | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `meal_orders_at(_competence text, _school text, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `meal_policy_on(_kind text, _on date)` | DEFINER | `""` | nenhum | reader | app,definer | — | — | INTERNAL_ONLY |
| `meal_reporting_facts(_dataset text, _school text, _from date, _to date)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | — | sim | INTERNAL_ONLY |
| `meal_reporting_rows(_dataset text, _school text, _from date, _to date, _filters jsonb, _limit integer, _offset integer)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `meal_reporting_scope(_school text, _from date, _to date)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `meal_reporting_summary(_school text, _from date, _to date)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `meal_services_at(_school text, _from date, _to date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `meal_stock_alerts_at(_school text, _on date, _expiry_window_days integer)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `meal_stock_balance_at(_school text, _on date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `meal_stock_basis_at(_school text, _competence text)` | DEFINER | `""` | authenticated | reader | app | — | — | REQUIRED_AUTHENTICATED |
| `meal_stock_closings_at(_school text)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `meal_stock_counts_at(_school text)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `meal_stock_ledger_at(_school text, _from date, _to date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `meal_stock_lines(_school text, _on date, _known timestamp with time zone)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | — | — | INTERNAL_ONLY |
| `meal_stock_read_guard(_school text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `meal_value_ok(_scheme text, _value text)` | DEFINER | `""` | nenhum | reader | app,definer | — | — | INTERNAL_ONLY |
| `my_diaries_at(_on date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `my_diary_lessons(_assignment text, _substitution text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `my_diary_slots_at(_assignment text, _substitution text, _on date)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `my_notifications(_limit integer, _before timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `my_unread_notification_count()` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `notif_capability_holders(_capability text, _school text, _on date)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `notif_grant(_capability text, _school text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `notif_guardians(_student text, _school text, _section text, _on date)` | DEFINER | `""` | nenhum | reader | app,definer | — | — | INTERNAL_ONLY |
| `notif_still_authorized(_delivery uuid)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `offer_capability_on(_school text, _on date)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `officialize_descriptive_report(_student text, _class text, _period text, _base_version_id uuid, _text text, _objective_ids text[], _reason text)` | DEFINER | `public` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `officialize_statistical_map(_actor uuid, _map uuid, _conference uuid, _fingerprint text, _snapshot jsonb, _snapshot_date date, _base_version uuid)` | DEFINER | `public` | nenhum | writer | app,sqltest | sim | sim | DEPRECATED/UNUSED |
| `officialize_statistical_map(_map uuid, _conference uuid, _fingerprint text, _snapshot jsonb, _snapshot_date date, _base_version uuid)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `open_notification(_delivery uuid)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `open_statistical_map(_school text, _year integer, _month integer)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `open_statistical_map_correction(_actor uuid, _map uuid, _base_version uuid, _reason text)` | DEFINER | `public` | nenhum | writer | app | sim | sim | DEPRECATED/UNUSED |
| `open_statistical_map_correction(_map uuid, _base_version uuid, _reason text)` | DEFINER | `""` | authenticated | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `operational_engagement_active(_engagement uuid, _school text)` | DEFINER | `""` | authenticated,service_role | reader | app,definer | — | — | REQUIRED_AUTHENTICATED |
| `operational_task_assignee(_task uuid)` | DEFINER | `""` | service_role | reader | app,definer | — | — | INTERNAL_ONLY |
| `password_change_required()` | DEFINER | `public` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `perf_grant(_capability text, _school text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `performance_disclosure_at(_known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `performance_goals_at(_metric_logical uuid, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `performance_metrics_at(_assessment uuid, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `plan_period_window(_class text, _period text, _on date, _known_at timestamp with time zone, OUT issue text, OUT starts_on date, OUT ends_on date)` | DEFINER | `""` | nenhum | reader | app,sqltest | — | — | INTERNAL_ONLY |
| `plan_periods_for_assignment(_assignment text, _on date)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `preview_capability_policy(_policy uuid, _valid_from date)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `preview_institutional_rule_draft(_domain text, _payload jsonb, _valid_from date, _valid_until date)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `professional_school_observations_2026(_school text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `provision_sector_principal(_auth_user uuid, _station text, _school text, _operation text)` | DEFINER | `""` | service_role | writer | app,sqltest | — | — | INTERNAL_ONLY |
| `public_portal_get(_slug text)` | DEFINER | `""` | anon,authenticated,service_role | reader | app | — | — | PUBLIC_VERIFICATION |
| `public_portal_list(_kind text)` | DEFINER | `""` | anon,authenticated,service_role | reader | app | — | — | PUBLIC_VERIFICATION |
| `r5_network_grant(_capability text)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `r5_record_homologation(_kind text, _target uuid, _expected_head uuid, _decision text, _effective_from date, _act_ref text, _reason text)` | DEFINER | `""` | nenhum | writer | app,sqltest,definer | sim | sim | INTERNAL_ONLY |
| `r5_version_step(_p text, _versions text, _owner_col text, _owner text, _base uuid, _change_kind text, _valid_from date, _valid_until date, _reason text)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | — | — | INTERNAL_ONLY |
| `record_academic_year_operational_state(_academic_year_id text, _state text, _expected_sequence integer, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_aee_service(_base_id uuid, _kind text, _school text, _student text, _responsible_engagement uuid, _valid_from date, _valid_to date, _slots jsonb, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_aee_session(_base_id uuid, _kind text, _service_logical uuid, _date date, _presence_scheme text, _presence_value text, _note text, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_ai_assisted_action(_kind text, _sha256 text, _writer text, _outcome text, _result_ref text, _school text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_allocation_curricular_position(_position_logical text, _base_version_id uuid, _allocation_logical text, _valid_from date, _valid_until date, _axes jsonb, _act_ref text, _reason text, _annul boolean)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_assessment_analysis_definition(_base_id uuid, _kind text, _algorithm text, _algorithm_version text, _parameters jsonb, _inputs jsonb, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_assessment_conference(_instrument text, _expected_head uuid, _expected_fingerprint text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_assessment_correction_policy_draft(_logical_id text, _expected_version integer, _valid_from date, _valid_until date, _payload jsonb, _reason text, _source_ref text)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | — | sim | REQUIRED_AUTHENTICATED |
| `record_assessment_edition(_base_id uuid, _kind text, _program uuid, _label text, _cycle text, _reference_date date, _instruments uuid[], _reference_edition text, _source text, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_assessment_edition_cycle_event(_edition uuid, _expected_seq integer, _to_state text, _note text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_assessment_item_media(_item_id text, _object_path text, _label text, _sha256 text, _mime text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_assessment_item_version(_item_id text, _expected_head uuid, _item_type_id text, _stem text, _options jsonb, _curricular_refs jsonb, _school_id text, _visibility text, _status text, _key_shared boolean, _answer jsonb, _criteria text, _copied_from uuid)` | DEFINER | `""` | nenhum | writer | app | sim | sim | DEPRECATED/UNUSED |
| `record_assessment_item_version_v2(_item_id text, _expected_head uuid, _item_type_id text, _stem text, _options jsonb, _curricular_refs jsonb, _school_id text, _visibility text, _status text, _key_shared boolean, _answer jsonb, _criteria text, _copied_from uuid, _reference_on date)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_assessment_officialization(_instrument text, _conference_id uuid)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `record_assessment_program(_base_id uuid, _kind text, _name text, _origin text, _application text, _correction text, _delivery text, _source text, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_attendance_calculation_policy_draft(_logical_id text, _expected_version integer, _valid_from date, _valid_until date, _payload jsonb, _reason text, _source_ref text)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | — | sim | REQUIRED_AUTHENTICATED |
| `record_attendance_closing_act(_scope_key text, _class text, _period text, _scope jsonb, _action text, _expected_last_event_id uuid, _expected_closing_id uuid, _detail text, _justification text, _record jsonb, _expected_attendance_version_ids uuid[], _plan_id text)` | DEFINER | `public` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_attendance_occurrence(_class text, _student text, _type_id text, _type_version integer, _from date, _until date, _document_ref text, _note text, _expected_version_id uuid, _annul boolean, _justification text, _plan_id text)` | DEFINER | `public` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_attendance_occurrence_type_draft(_logical_id text, _expected_version integer, _valid_from date, _valid_until date, _payload jsonb, _reason text, _source_ref text)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | — | sim | REQUIRED_AUTHENTICATED |
| `record_attendance_version(_lesson_logical text, _base_version_id uuid, _marks jsonb, _justification text, _plan_id text)` | DEFINER | `public` | nenhum | writer | app | sim | sim | DEPRECATED/UNUSED |
| `record_attendance_version_v2(_lesson_logical text, _base_version_id uuid, _marks jsonb, _justification text, _plan_id text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_attribute_value_version(_scheme text, _value text, _base_version integer, _label text, _status text, _valid_from date, _act_ref text, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_calendar_composition_norm_version(_norm_id text, _base_version_id uuid, _change_kind text, _valid_from date, _valid_until date, _act_ref text, _reason text, _multiplicity text, _dimension_rules jsonb, _effect_bindings jsonb)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_calendar_council_configuration(_version_id uuid, _roles jsonb, _act_ref text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `record_calendar_day_type_version(_day_type text, _base_version_id uuid, _change_kind text, _label text, _school_day_effect boolean, _act_ref text, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest,definer | sim | sim | REQUIRED_AUTHENTICATED |
| `record_calendar_external_profile(_calendar_id text, _template_code text, _expected_head uuid, _profile jsonb, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_calendar_presentation_snapshot(_version_id uuid, _source_kind text, _source_key text, _source_entry_id text, _source_digest text, _source_raw jsonb, _presentation jsonb, _declared_note text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `record_calendar_version(_calendar text, _base_version_id uuid, _change_kind text, _academic_year_id text, _period_organization_id text, _valid_from date, _valid_until date, _act_ref text, _reason text, _periods jsonb, _ranges jsonb, _events jsonb, _days jsonb)` | DEFINER | `""` | service_role | writer | app,sqltest,definer | sim | sim | INTERNAL_ONLY |
| `record_calendar_version_with_applicability(_calendar text, _base_version_id uuid, _change_kind text, _academic_year_id text, _period_organization_id text, _valid_from date, _valid_until date, _act_ref text, _reason text, _periods jsonb, _ranges jsonb, _events jsonb, _days jsonb, _applicability jsonb)` | DEFINER | `""` | service_role | writer | app,sqltest | sim | sim | DEPRECATED/UNUSED |
| `record_calendar_version_with_windowed_applicability(_calendar text, _base_version_id uuid, _change_kind text, _academic_year_id text, _period_organization_id text, _valid_from date, _valid_until date, _act_ref text, _reason text, _periods jsonb, _ranges jsonb, _events jsonb, _days jsonb, _applicability jsonb)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_class_allocation(_id text, _participation_logical text, _class text, _valid_from date, _act_ref text, _supersedes text, _correction_reason text, _ended_on date, _ending_reason text)` | DEFINER | `""` | authenticated,service_role | writer | app,invoker,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_class_allocation_ending(_allocation_logical text, _base_version_id uuid, _ended_on date, _reason text, _act_ref text, _correction_reason text, _annul boolean)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_class_capacity(_logical text, _base_version_id uuid, _class text, _reference_limit integer, _valid_from date, _valid_until date, _basis text, _act_ref text, _change_reason text, _annul boolean)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_class_composition(_class text, _expected_head uuid, _positions jsonb, _valid_from date, _valid_until date, _reason text)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | — | sim | REQUIRED_AUTHENTICATED |
| `record_class_designation_category(_class text, _category text, _expected_sequence integer, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_class_episode_ending(_episode text, _ended_on date, _reason text, _act_ref text)` | DEFINER | `public` | service_role | writer | app | sim | sim | INTERNAL_ONLY |
| `record_class_journey_version(_class_id text, _expected_head_id uuid, _change_kind text, _valid_from date, _valid_until date, _source_ref text, _reason text, _intervals jsonb)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_class_offering_version(_logical text, _base_version_id uuid, _class text, _axes jsonb, _valid_from date, _valid_until date, _correction_reason text, _act_ref text)` | DEFINER | `public` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_class_period_organization_version(_class_id text, _base_version_id uuid, _operation text, _organization_id text, _valid_from date, _valid_until date, _reason text, _act_ref text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_class_schedule_version(_class_id text, _expected_head_id uuid, _change_kind text, _valid_from date, _valid_until date, _source_ref text, _reason text, _blocks jsonb)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_class_shift_version(_logical text, _base_version_id uuid, _class text, _shift_value text, _shift_version integer, _valid_from date, _valid_until date, _correction_reason text, _act_ref text)` | DEFINER | `public` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_class_specific_matrix_association_version(_association text, _class_id text, _base_version_id uuid, _change_kind text, _valid_from date, _valid_until date, _reason text, _specific_act_ref text, _target_matrix_id text, _target_column_key text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_collegial_body_configuration_draft(_logical_id text, _expected_version integer, _valid_from date, _valid_until date, _payload jsonb, _reason text, _source_ref text)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | — | sim | REQUIRED_AUTHENTICATED |
| `record_collegial_deliberation(_session_id text, _expected_last_event_id uuid, _document jsonb, _plan_id text)` | DEFINER | `public` | authenticated | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_collegial_session_event(_session_id text, _kind text, _expected_last_event_id uuid, _document jsonb, _plan_id text)` | DEFINER | `public` | authenticated | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_correspondence_profile_version(_profile text, _base_version_id uuid, _change_kind text, _valid_from date, _valid_until date, _reason text, _act_ref text, _position_key_schemes text[], _nature_scheme_id text, _nature_gates jsonb, _applicability_rule jsonb)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_credential_reset(_actor uuid, _user uuid, _act_ref text)` | DEFINER | `public` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_curricular_matrix_version(_matrix text, _base_version_id uuid, _change_kind text, _official_name text, _valid_from date, _valid_until date, _reason text, _act_ref text, _items jsonb, _applicability jsonb)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_curricular_matrix_version(_matrix text, _base_version_id uuid, _change_kind text, _official_name text, _valid_from date, _valid_until date, _reason text, _act_ref text, _items jsonb, _applicability jsonb, _layout jsonb)` | DEFINER | `""` | authenticated | writer | app,sqltest | delega | sim | REQUIRED_AUTHENTICATED |
| `record_curricular_reference_edition(_source_id text, _source_label text, _authority text, _edition_label text, _published_on date, _valid_from date, _source_sha256 text, _source_ref text, _expected_head uuid, _items jsonb)` | DEFINER | `""` | nenhum | reader | app | — | — | DEPRECATED/UNUSED |
| `record_curricular_reference_edition_v2(_source_id text, _source_label text, _authority text, _edition_label text, _published_on date, _valid_from date, _source_sha256 text, _source_ref text, _expected_head uuid, _declared_item_count integer, _items jsonb)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_curricular_reference_glossary_term(_term_key text, _expected_head uuid, _term text, _definition text, _origin text, _edition uuid, _item uuid, _locator text, _reason text, _effective_on date)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_curricular_reference_keywords(_item uuid, _expected_head uuid, _terms text[], _reason text, _effective_on date)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_curricular_reference_no_correspondence(_item uuid, _target_source_id text, _expected_head uuid, _justification text, _criteria jsonb, _withdrawn boolean, _reason text, _effective_on date)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_curricular_reference_relation(_from uuid, _to uuid, _nature text, _confidence text, _provenance text, _revokes uuid, _reason text)` | DEFINER | `""` | nenhum | reader | app | — | — | DEPRECATED/UNUSED |
| `record_curricular_reference_relation_v2(_from uuid, _to uuid, _origin text, _nature text, _direction text, _justification text, _criteria jsonb, _official_locator text, _effective_on date)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `record_curricular_reference_simplification(_item uuid, _expected_head uuid, _text text, _reason text)` | DEFINER | `""` | nenhum | reader | app | — | — | DEPRECATED/UNUSED |
| `record_curricular_reference_simplification_v2(_item uuid, _expected_head uuid, _text text, _reason text, _effective_on date)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_cycle_closing(_class text, _cycle text, _operation text, _expected_closing_id uuid, _policy_id text, _policy_version integer, _snapshot jsonb, _justification text, _plan_id text)` | DEFINER | `public` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_cycle_closing_policy_draft(_logical_id text, _expected_version integer, _valid_from date, _valid_until date, _payload jsonb, _reason text, _source_ref text)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | — | sim | REQUIRED_AUTHENTICATED |
| `record_cycle_enrollment_ending(_enrollment_logical text, _base_version_id uuid, _ended_on date, _bond_status_value text, _bond_status_version integer, _reason text, _act_ref text, _correction_reason text, _annul boolean)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_data_quality_review(_fingerprint text, _evidence_sha256 text, _rule_id text, _rule_version integer, _school uuid, _state text, _reason text, _expected_head uuid)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_diary_correction_policy_draft(_logical_id text, _expected_version integer, _valid_from date, _valid_until date, _payload jsonb, _reason text, _source_ref text)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | — | sim | REQUIRED_AUTHENTICATED |
| `record_dietary_restriction(_base_id uuid, _kind text, _school text, _student text, _restriction text, _note text, _from date, _to date, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_engagement(_person uuid, _kind text, _scope_level text, _school text, _class_ids text[], _component text, _period text, _valid_from date, _valid_until date, _act_ref text, _position_label text)` | DEFINER | `public` | authenticated,service_role | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `record_family_communication_receipt(_student text, _version uuid, _kind text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `record_functional_event(_logical uuid, _base uuid, _link_logical uuid, _posting_logical uuid, _school text, _kind text, _kind_version integer, _occurred_on date, _act_ref text, _correction_reason text)` | DEFINER | `public` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_functional_link_version(_logical uuid, _base uuid, _person uuid, _registration text, _nature text, _nature_version integer, _position text, _position_version integer, _valid_from date, _valid_until date, _act_ref text, _correction_reason text, _authorizing_school text)` | DEFINER | `public` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_functional_process(_logical uuid, _base uuid, _link_logical uuid, _school text, _kind text, _kind_version integer, _opened date, _closed date, _related_event uuid, _source text, _correction_reason text, _revoke boolean)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_guardian_authorization(_base_id uuid, _kind text, _student text, _guardian_user uuid, _school text, _relation_scheme text, _relation_value text, _sections text[], _valid_from date, _valid_until date, _reason text, _source_ref text)` | DEFINER | `""` | nenhum | writer | app,sqltest | sim | sim | DEPRECATED/UNUSED |
| `record_guardian_authorization_v2(_base_id uuid, _kind text, _student text, _guardian_user uuid, _guardian_person uuid, _school text, _relation_scheme text, _relation_value text, _sections text[], _valid_from date, _valid_until date, _reason text, _source_ref text)` | DEFINER | `""` | nenhum | writer | app | sim | sim | DEPRECATED/UNUSED |
| `record_guardian_authorization_v3(_base_id uuid, _kind text, _student text, _guardian_person uuid, _school text, _relation_scheme text, _relation_value text, _sections text[], _valid_from date, _valid_until date, _reason text, _source_ref text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `record_import_event(_batch_id uuid, _row_id uuid, _kind text, _canonical_ref text, _detail text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `record_inclusion_mediation(_base_id uuid, _kind text, _school text, _student text, _class text, _mediator_engagement uuid, _valid_from date, _valid_to date, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_inclusion_record(_base_id uuid, _kind text, _record_type text, _school text, _student text, _category_scheme text, _category_value text, _purpose text, _body text, _valid_from date, _valid_to date, _share_with_mediation boolean, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_inclusion_term_review(_term uuid, _expected_seq integer, _original text, _origin text, _status text, _alias text, _category text, _note text)` | DEFINER | `""` | service_role | writer | app | sim | sim | DEPRECATED/UNUSED |
| `record_inclusion_term_review_v2(_term uuid, _expected_seq integer, _original text, _origin text, _status text, _alias text, _category text, _category_version integer, _note text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_inst_assessment(_base_id uuid, _kind text, _title text, _origin text, _source text, _from date, _to date, _population jsonb, _items jsonb, _scale jsonb, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_inst_assessment_result(_base_id uuid, _kind text, _assessment_version uuid, _school text, _student text, _class text, _item text, _status text, _raw text, _source text, _plan_key text, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_institutional_class_version(_class_id text, _base_version_id uuid, _operation text, _code text, _name text, _administrative_status text, _valid_from date, _valid_until date, _reason text, _act_ref text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_institutional_integration_version(_key text, _expected_version integer, _slot text, _provider text, _state text, _config jsonb, _secret_ref text, _mapping jsonb, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_intelligence_dashboard(_base_id uuid, _kind text, _visibility text, _audience text, _title text, _widgets jsonb, _filters jsonb, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_kb_document_event(_version uuid, _kind text, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_kb_document_version(_document text, _source_kind text, _title text, _classification text, _required_capability text, _original_sha256 text, _original_ref text, _expected_head uuid, _chunks jsonb)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_lesson_version(_logical text, _class text, _component text, _assignment text, _date date, _base_version_id uuid, _facts jsonb, _justification text, _changed_aspects text[], _plan_id text)` | DEFINER | `public` | nenhum | writer | app,sqltest | sim | sim | DEPRECATED/UNUSED |
| `record_lesson_version_v2(_logical text, _assignment text, _substitution text, _date date, _base_version_id uuid, _facts jsonb, _blocks uuid[], _references uuid[], _justification text, _changed_aspects text[], _plan_id text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_map_cell_adjustment(_map uuid, _cell text, _expected_head uuid, _calculated jsonb, _adjusted jsonb, _reason text, _annul boolean)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_map_competence_rule_draft(_id text, _expected_version integer, _valid_from date, _valid_until date, _definition jsonb)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_map_conference(_actor uuid, _map uuid, _fingerprint text)` | DEFINER | `public` | nenhum | writer | app,sqltest | sim | — | DEPRECATED/UNUSED |
| `record_map_conference(_map uuid, _fingerprint text)` | DEFINER | `""` | nenhum | writer | app,sqltest | sim | — | DEPRECATED/UNUSED |
| `record_map_conference(_map uuid, _fingerprint text, _snapshot jsonb)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `record_map_observations(_map uuid, _text text)` | DEFINER | `public` | authenticated | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_meal_delivery_schedule(_logical uuid, _expected_version integer, _action text, _order uuid, _item uuid, _unit uuid, _presentation uuid, _contract uuid, _frequency uuid, _quantity numeric, _expected_on date, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_demand_consolidation(_competence text, _expected_sequence integer, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_evidence(_logical uuid, _expected_version integer, _event text, _kind text, _target uuid, _path text, _sha256 text, _media text, _size integer, _label text, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_execution(_base_id uuid, _kind text, _school text, _on date, _slot text, _planned_menu uuid, _followed boolean, _preparation text, _deviation text, _deviation_reason text, _authorization uuid, _meals_total integer, _count_basis text, _breakdown jsonb, _students_present integer, _students_source text, _consumption jsonb, _tz text, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_fiscal_document(_logical uuid, _expected_version integer, _status text, _school text, _schedule uuid, _number text, _issuer uuid, _issued_on date, _sha256 text, _storage_ref text, _reason text)` | DEFINER | `""` | authenticated | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_forecast(_base_id uuid, _kind text, _school text, _on date, _slot text, _count integer, _basis text, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_inventory_movement(_base_id uuid, _kind text, _school text, _item text, _unit text, _movement text, _quantity numeric, _on date, _note text, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_kitchen(_kitchen uuid, _expected_version integer, _name text, _host_school text, _from date, _to date, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_kitchen_link(_base_id uuid, _kind text, _kitchen uuid, _school text, _from date, _to date, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_master(_kind text, _logical uuid, _expected_version integer, _action text, _payload jsonb, _school text, _from date, _to date, _reason text, _staging uuid)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_menu(_base_id uuid, _kind text, _school text, _group text, _starts date, _ends date, _entries jsonb, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_menu_publication(_menu_version uuid, _expected_sequence integer, _action text, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_nonconformity(_logical uuid, _expected_version integer, _status text, _receipt uuid, _motive text, _returned numeric, _evidence text[], _deadline_rule uuid, _note text, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_operational_record(_base_id uuid, _kind text, _school text, _model uuid, _on date, _slot text, _values jsonb, _reason text)` | DEFINER | `""` | authenticated | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_order(_logical uuid, _expected_version integer, _action text, _school text, _competence text, _lines jsonb, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_order_opinion(_order_version uuid, _opinion text)` | DEFINER | `""` | authenticated | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_meal_order_window(_logical uuid, _expected_version integer, _action text, _competence text, _school_ids text[], _opens timestamp with time zone, _closes timestamp with time zone, _tz text, _basis text, _rule uuid, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_receipt(_logical uuid, _expected_version integer, _action text, _schedule uuid, _received_at timestamp with time zone, _tz text, _delivered numeric, _accepted numeric, _rejected numeric, _lot text, _expires date, _brand text, _spec text, _condition text, _temperature numeric, _checklist jsonb, _fiscal uuid, _evidence text[], _note text, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_service(_base_id uuid, _kind text, _school text, _on date, _slot text, _offered integer, _served integer, _source text, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_stock_closing(_school text, _competence text, _expected_version integer, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_stock_count(_logical uuid, _expected_version integer, _status text, _school text, _counted_on date, _lines jsonb, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_stock_movement(_base_id uuid, _kind text, _school text, _class text, _item text, _unit text, _quantity numeric, _direction smallint, _on date, _tz text, _lot text, _expires date, _contract uuid, _schedule uuid, _source_doc uuid, _count uuid, _literal text, _note text, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_meal_stock_transfer(_from_school text, _to_school text, _item text, _unit text, _quantity numeric, _on date, _tz text, _lot text, _expires date, _note text, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `record_metric_comparability(_base_id uuid, _metric_a uuid, _metric_b uuid, _status text, _source text, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_movement_type_definition(_id text, _base_version integer, _label text, _status text, _valid_from date, _act_ref text)` | DEFINER | `public` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_notification_rule(_logical uuid, _base uuid, _kind text, _template text, _basis text, _cap text, _section text, _retire boolean, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_notification_template(_key text, _base uuid, _title text, _body text, _vars text[], _external text, _mandatory boolean, _retire boolean, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_operational_task_event(_task uuid, _kind text, _expected_seq integer, _idempotency_key text, _status text, _assignee uuid, _comment text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_own_password_change()` | DEFINER | `public` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_performance_disclosure(_base_id uuid, _kind text, _min integer, _source text, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_performance_goal(_base_id uuid, _kind text, _metric_version uuid, _school text, _target numeric, _comparator text, _source text, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_performance_metric(_base_id uuid, _kind text, _label text, _assessment uuid, _formula jsonb, _population_key text, _unit text, _source text, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_period_closing_act(_scope_key text, _period text, _scope jsonb, _action text, _expected_last_event_id uuid, _expected_closing_id uuid, _detail text, _justification text, _record jsonb)` | DEFINER | `public` | nenhum | writer | app,sqltest | sim | sim | DEPRECATED/UNUSED |
| `record_period_closing_act_v2(_scope_key text, _period text, _scope jsonb, _action text, _expected_last_event_id uuid, _expected_closing_id uuid, _detail text, _justification text, _record jsonb, _effective_on date)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_position_matrix_correspondence_version(_correspondence text, _profile_id text, _base_version_id uuid, _change_kind text, _valid_from date, _valid_until date, _reason text, _act_ref text, _target_matrix_id text, _target_column_key text, _keys jsonb)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_posting_version(_logical uuid, _base uuid, _link_logical uuid, _school text, _function text, _function_version integer, _status text, _status_version integer, _valid_from date, _valid_until date, _act_ref text, _correction_reason text)` | DEFINER | `public` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_professional_exercise(_logical uuid, _base uuid, _link_logical uuid, _posting_logical uuid, _school text, _function text, _function_version integer, _valid_from date, _valid_until date, _source text, _correction_reason text, _revoke boolean)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_professional_qualification(_logical uuid, _base uuid, _person uuid, _school text, _qualification text, _qualification_version integer, _valid_from date, _valid_until date, _source text, _correction_reason text, _revoke boolean)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_public_publication(_kind text, _slug text, _state text, _title text, _summary text, _body text, _reason text, _expected_version integer)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_school_communication_act(_communication uuid, _expected_sequence integer, _act text, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_school_communication_version(_communication uuid, _expected_version integer, _school text, _title text, _body text, _audience text, _class text, _requires_ack boolean, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_school_document_template_version(_template_id text, _document_kind text, _expected_head_id uuid, _title text, _blocks jsonb, _identity jsonb, _numbering jsonb, _public_fields text[], _source_ref text, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_school_enrollment_ending(_enrollment text, _ended_on date, _bond_status text, _reason text, _act_ref text)` | DEFINER | `public` | nenhum | writer | app | sim | sim | INTERNAL_ONLY |
| `record_school_infrastructure_attribute(_attribute text, _label text, _value_type text, _catalog_values text[], _unit_label text, _source_field text, _source_ref text)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_school_infrastructure_observation(_school text, _attribute text, _value jsonb, _valid_from date, _source_hash text, _source_ref text, _source_locator text)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `record_school_link(_logical uuid, _base uuid, _principal text, _linked text, _kind text, _kind_version integer, _valid_from date, _valid_until date, _act_ref text, _correction_reason text)` | DEFINER | `public` | authenticated,service_role | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `record_school_pedagogical_record(_base_id uuid, _kind text, _school text, _subject_kind text, _subject_id text, _category_value text, _body text, _visibility text, _occurred_on date, _reason text)` | DEFINER | `""` | nenhum | writer | app,sqltest | sim | sim | INTERNAL_ONLY |
| `record_school_pedagogical_record_v2(_base_id uuid, _kind text, _school text, _subject_kind text, _subject_id text, _category_value text, _body text, _visibility text, _occurred_on date, _reason text, _referral text, _responsible_person_id uuid, _period_id text, _return_on date, _status_value text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_school_staff_presence(_link uuid, _school text, _year text, _status text, _expected_sequence integer, _declared_on date, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_school_supervision(_base_id uuid, _kind text, _school text, _modality text, _subject text, _occurred_on date, _referral text, _responsible_label text, _return_on date, _status_value text, _school_visible boolean, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_student_card(_public_id text, _expected_version integer, _kind text, _student text, _school text, _year text, _valid_until date, _student_name text, _school_name text, _class_label text, _reason text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_student_document_pendency(_pendency uuid, _expected_version integer, _enrollment text, _description text, _status text, _due_on date, _note text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `record_student_identity_version(_student text, _base_version_id uuid, _civil_name text, _social_name text, _birth_date date, _sex_value text, _sex_version integer, _correction_reason text, _act_ref text)` | DEFINER | `public` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_student_movement(_logical text, _base_version_id uuid, _student text, _enrollment text, _type text, _type_version integer, _effective_on date, _origin jsonb, _destination jsonb, _reason_code text, _reason_text text, _act_ref text, _correction_reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_teacher_instrument_version(_instrument_id text, _expected_head uuid, _assignment_id text, _period_id text, _title text, _instructions text, _items jsonb, _randomization jsonb, _status text, _results_instrument_id text)` | DEFINER | `""` | nenhum | writer | app | sim | sim | DEPRECATED/UNUSED |
| `record_teacher_instrument_version_v2(_instrument_id text, _expected_head uuid, _assignment_id text, _period_id text, _title text, _instructions text, _items jsonb, _randomization jsonb, _status text, _results_instrument_id text, _reference_on date)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_teaching_assignment_version(_class_id text, _assignment_id text, _expected_head_id uuid, _change_kind text, _valid_from date, _valid_until date, _engagement_id uuid, _matrix_version_id uuid, _item_key text, _role_scheme_id text, _role_value_id text, _role_value_version integer, _source_ref text, _reason text)` | DEFINER | `""` | nenhum | reader | app,sqltest | — | — | INTERNAL_ONLY |
| `record_teaching_assignment_version_v2(_class_id text, _assignment_id text, _expected_head_id uuid, _change_kind text, _valid_from date, _valid_until date, _engagement_id uuid, _functional_link_logical_id uuid, _matrix_version_id uuid, _item_key text, _role_scheme_id text, _role_value_id text, _role_value_version integer, _source_ref text, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_teaching_plan_attachment(_plan_id text, _object_path text, _label text, _sha256 text, _revoke uuid)` | DEFINER | `""` | authenticated | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_teaching_plan_version(_plan_id text, _expected_head uuid, _assignment_id text, _title text, _level_value_id text, _covers_from date, _covers_until date, _blocks jsonb, _curricular_refs jsonb, _status text, _copied_from uuid, _change_reason text)` | DEFINER | `""` | nenhum | writer | app,sqltest | sim | sim | DEPRECATED/UNUSED |
| `record_teaching_plan_version_v2(_plan_id text, _expected_head uuid, _assignment_id text, _title text, _level_value_id text, _target_date date, _period_id text, _covers_from date, _covers_until date, _blocks jsonb, _curricular_refs jsonb, _status text, _copied_from uuid, _change_reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_teaching_substitution_version(_assignment_id text, _substitution_id text, _expected_head_id uuid, _change_kind text, _valid_from date, _valid_until date, _substitute_engagement_id uuid, _functional_link_logical_id uuid, _withdrawn boolean, _source_ref text, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `record_visit_version(_logical uuid, _base uuid, _school text, _visited_on date, _kind text, _kind_version integer, _identification text, _origin text, _additional jsonb, _annul boolean, _act_ref text, _correction_reason text)` | DEFINER | `public` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `record_year_transition_decision(_school text, _student text, _from_year text, _to_year text, _decision text, _expected_sequence integer, _declared_on date, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `reference_actor(_cap text, _on date)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `reference_grant()` | DEFINER | `""` | nenhum | reader | app | — | — | DEPRECATED/UNUSED |
| `register_academic_period_version(_period text, _organization text, _base_version_id uuid, _official_name text, _starts_on date, _ends_on date, _is_active boolean, _valid_from date, _reason text, _act_ref text)` | DEFINER | `public` | authenticated,service_role | writer | app,sqltest,definer | sim | sim | REQUIRED_AUTHENTICATED |
| `register_academic_standings(_plan_id text, _class text, _cycle text, _operations jsonb)` | DEFINER | `public` | nenhum | writer | app | sim | sim | DEPRECATED/UNUSED |
| `register_academic_standings_v2(_plan_id text, _class text, _cycle text, _operations jsonb, _effective_on date)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `register_academic_year_version(_year text, _base_version_id uuid, _official_name text, _starts_on date, _ends_on date, _is_active boolean, _valid_from date, _reason text, _act_ref text)` | DEFINER | `public` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `register_assessment_norm_version(_norm_kind text, _logical_id text, _expected_supersedes_id uuid, _academic_year_id text, _stage_ids text[], _class_ids text[], _valid_from date, _valid_until date, _definition jsonb, _homologation_act_ref text)` | DEFINER | `public` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `register_assessment_results(_instrument text, _plan_id text, _configuration_id text, _configuration_version integer, _expected_closing_id uuid, _operations jsonb)` | DEFINER | `public` | nenhum | writer | app,sqltest | sim | sim | INTERNAL_ONLY |
| `register_assessment_results_v2(_instrument text, _plan_id text, _configuration_id text, _configuration_version integer, _expected_closing_id uuid, _operations jsonb)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `register_capability_policy_draft(_logical text, _supersedes uuid, _rules jsonb)` | DEFINER | `public` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `register_capability_policy_draft_expected(_logical text, _expected_head uuid, _rules jsonb)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `register_class_enrollment_episode(_id text, _enrollment text, _class text, _valid_from date, _act_ref text, _supersedes text, _correction_reason text)` | DEFINER | `public` | nenhum | writer | app,sqltest | sim | sim | INTERNAL_ONLY |
| `register_curricular_component_version(_component text, _base_version_id uuid, _official_name text, _short_name text, _is_active boolean, _valid_from date, _reason text, _act_ref text)` | DEFINER | `public` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `register_inclusion_attachment(_record_logical uuid, _classification text, _purpose text, _storage_path text, _sha256 text, _media_type text, _size bigint)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `register_infant_experience(_logical text, _base_version_id uuid, _class text, _component text, _assignment text, _date date, _record jsonb, _lesson_logical text, _lesson_facts jsonb, _justification text, _plan_id text)` | DEFINER | `public` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `register_institutional_class(_school_id text, _academic_year_id text, _code text, _name text, _administrative_status text, _valid_from date, _valid_until date, _act_ref text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `register_operational_task_priority(_id text, _label text, _ordinal integer)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `register_period_organization_version(_organization text, _year text, _base_version_id uuid, _official_name text, _is_active boolean, _valid_from date, _reason text, _act_ref text)` | DEFINER | `public` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `register_person(_display_name text, _identifier text)` | DEFINER | `public` | authenticated,service_role | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `register_school_enrollment(_id text, _student text, _school text, _cycle text, _opened_on date, _institutional_number text, _act_ref text, _supersedes text, _correction_reason text)` | DEFINER | `public` | service_role | writer | app,sqltest | sim | sim | INTERNAL_ONLY |
| `register_school_record_version(_school text, _base_version_id uuid, _official_name text, _address text, _district text, _location_kind text, _active boolean, _valid_from date, _justification text, _act_ref text, _inep text, _network_code text, _phone text, _email text, _own_building boolean, _hard_access boolean, _classroom_count integer, _administrative_dependency text, _private_school_category text, _partnership_public_authority text, _clear_administrative text[])` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `register_student(_civil_name text, _social_name text, _birth_date date, _sex_value text, _sex_version integer, _identifiers jsonb, _act_ref text)` | DEFINER | `public` | authenticated,service_role | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `register_student_for_school(_school text, _display_name text, _cpf text, _inep text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `register_student_with_exact_identity(_display_name text, _cpf text, _inep text)` | DEFINER | `""` | nenhum | writer | app,sqltest | sim | — | DEPRECATED/UNUSED |
| `register_workflow_definition(_key text, _title text, _scope text, _definition jsonb, _expected_version integer)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `return_statistical_map(_map uuid, _expected_conference uuid, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `review_meal_content_staging(_staging uuid, _action text, _valid_from date, _reason text)` | DEFINER | `""` | authenticated | writer | app | sim | sim | REQUIRED_AUTHENTICATED |
| `revoke_curricular_reference_relation(_relation uuid, _reason text, _effective_on date)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `roster_readable_classes()` | DEFINER | `""` | authenticated,service_role | reader | app,policy | sim | — | REQUIRED_AUTHENTICATED |
| `s_active_enrollment(_student text, _year text)` | DEFINER | `""` | nenhum | reader | app,definer | — | — | INTERNAL_ONLY |
| `s_current_person()` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `s_enroll_core(_student text, _school text, _year text, _declared_on date, _act_ref text)` | DEFINER | `""` | nenhum | writer | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `s_lookup_guard(_purpose text, _school text, _kind text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `s_year_open_for_operation(_year text)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | — | — | INTERNAL_ONLY |
| `save_network_calendar(_source_key text, _expected_base_version_id uuid, _payload jsonb)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | sim | REQUIRED_AUTHENTICATED |
| `school_capability_grant(_capability text, _school text)` | DEFINER | `public` | authenticated,service_role | reader | app,definer | sim | — | REQUIRED_AUTHENTICATED |
| `school_capability_schools(_capability text)` | DEFINER | `""` | authenticated,service_role | reader | app,policy | sim | — | REQUIRED_AUTHENTICATED |
| `school_communication_history(_communication uuid)` | DEFINER | `""` | authenticated | reader | app,sqltest | — | — | REQUIRED_AUTHENTICATED |
| `school_communications_at(_school text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `school_document_author(_capability text, _school text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `school_document_facts(_school text, _student text, _on date)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `school_document_grant(_capability text, _school text)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `school_document_templates_list()` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `school_engagements_of_kinds(_school text, _on date, _kinds text[])` | DEFINER | `public` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `school_followup_grant(_capability text, _school text)` | DEFINER | `""` | nenhum | reader | app | sim | — | INTERNAL_ONLY |
| `school_followup_grant_on(_capability text, _school text, _on date)` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `school_infrastructure_attribute_core(_attribute text, _label text, _value_type text, _catalog_values text[], _unit_label text, _source_field text, _source_ref text, _author_user uuid, _author_person uuid, _engagement uuid, _op uuid)` | DEFINER | `""` | nenhum | writer | app,definer | delega | — | INTERNAL_ONLY |
| `school_infrastructure_observation_core(_school text, _attribute text, _value jsonb, _valid_from date, _source_hash text, _source_ref text, _source_locator text, _author_user uuid, _author_person uuid, _engagement uuid, _op uuid)` | DEFINER | `""` | nenhum | writer | app,sqltest,definer | delega | — | INTERNAL_ONLY |
| `school_pedagogical_records_at(_school text, _subject_kind text, _subject_id text, _known_at timestamp with time zone, _logical_id uuid)` | DEFINER | `""` | authenticated | reader | app,invoker,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `school_record_version_core(_school text, _base_version_id uuid, _official_name text, _address text, _district text, _location_kind text, _active boolean, _valid_from date, _justification text, _act_ref text, _inep text, _network_code text, _phone text, _email text, _own_building boolean, _hard_access boolean, _classroom_count integer, _administrative_dependency text, _private_school_category text, _partnership_public_authority text, _clear_administrative text[], _author_user uuid, _author_person uuid, _engagement uuid, _policy_id uuid, _policy_version integer)` | DEFINER | `""` | nenhum | writer | app,sqltest,definer | sim | sim | INTERNAL_ONLY |
| `school_supervision_records_at(_school text, _known_at timestamp with time zone, _logical_id uuid)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `school_teaching_schedule_at(_school_id text, _on date, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated | reader | app,invoker,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `sec_actor()` | DEFINER | `""` | nenhum | reader | app,definer | sim | — | INTERNAL_ONLY |
| `sec_allocate_core(_enrollment text, _class text, _valid_from date, _reason text)` | DEFINER | `""` | nenhum | writer | app,definer | sim | — | INTERNAL_ONLY |
| `sec_class_capacity_on(_class text, _on date)` | DEFINER | `""` | nenhum | reader | app,definer | — | — | INTERNAL_ONLY |
| `sec_class_occupancy_on(_class text, _on date)` | DEFINER | `""` | nenhum | reader | app,definer | — | — | INTERNAL_ONLY |
| `secretariat_allocate_to_class(_enrollment text, _class text, _valid_from date, _reason text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `secretariat_assignment_elements(_class text, _on date)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `secretariat_class_vacancies_at(_school text, _year text, _on date)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `secretariat_create_class(_school text, _year text, _code text, _name text, _valid_from date, _valid_until date, _composition jsonb, _shift jsonb, _capacity integer, _source_ref text)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `secretariat_create_class_with_journey(_school text, _year text, _code text, _name text, _valid_from date, _valid_until date, _composition jsonb, _shift jsonb, _capacity integer, _source_ref text, _journey jsonb)` | DEFINER | `""` | authenticated | reader | app | — | — | REQUIRED_AUTHENTICATED |
| `secretariat_end_class_episode(_episode text, _ended_on date, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `secretariat_enrollment_book_at(_school text, _year text, _known_at timestamp with time zone)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `secretariat_overview_at(_school text, _year text, _on date)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `secretariat_pending_at(_school text, _year text, _on date)` | DEFINER | `""` | authenticated | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `secretariat_reassign_class(_episode text, _new_class text, _effective_on date, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `secretariat_record_exit(_enrollment text, _effective_on date, _movement_type text, _type_version integer, _destination_school text, _reason text)` | DEFINER | `""` | authenticated | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `secretariat_teaching_candidates(_school text, _on date)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `sector_admin_coverage_issues()` | DEFINER | `""` | service_role | reader | app,sqltest | sim | — | INTERNAL_ONLY |
| `sector_school_visible(_school text)` | DEFINER | `""` | authenticated,service_role | reader | app,policy | sim | — | REQUIRED_AUTHENTICATED |
| `sector_station_grants(_on date)` | DEFINER | `""` | service_role | reader | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `set_notification_preference(_kind text, _opted_out boolean)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `sigem_activator_account_origin_guard()` | DEFINER | `""` | service_role | trigger | — | — | sim | INTERNAL_ONLY |
| `sigem_designated_installer_email()` | DEFINER | `""` | service_role | reader | app,sqltest,definer | — | — | INTERNAL_ONLY |
| `sigem_general_admin_coverage_issues(_policy uuid)` | DEFINER | `""` | service_role | reader | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `sigem_policy_fingerprint(_policy_id uuid)` | DEFINER | `""` | service_role | reader | app,sqltest,definer | sim | — | INTERNAL_ONLY |
| `stage_import_batch(_adapter_id text, _adapter_version integer, _source_name text, _source_sha256 text, _rows jsonb, _reprocesses_id uuid, _source_ref text)` | DEFINER | `""` | authenticated,service_role | writer | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `stage_meal_content(_kind text, _context text, _sha256 text, _source text, _rows jsonb)` | DEFINER | `""` | authenticated | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `start_workflow(_definition uuid, _school uuid, _subject_ref text, _idempotency_key text, _comment text)` | DEFINER | `""` | authenticated,service_role | writer | app | sim | — | REQUIRED_AUTHENTICATED |
| `student_card_chain(_school text)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `student_card_grant(_school text)` | DEFINER | `""` | service_role | reader | app,definer | sim | — | INTERNAL_ONLY |
| `student_document_emissions(_school_id text, _student_id text)` | DEFINER | `""` | authenticated,service_role | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `student_document_pendencies(_school text)` | DEFINER | `""` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `student_identity_authority(_student text, _cap text)` | DEFINER | `public` | authenticated,service_role | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `student_photo_current(_school text, _student text)` | DEFINER | `""` | authenticated | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `student_school_life(_school text, _student text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `student_trajectory_at(_student text, _as_of date, _known_at timestamp with time zone, _year text, _period text, _domains text[])` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `teaches_class(_class_id text)` | DEFINER | `""` | authenticated | reader | app,policy | sim | — | REQUIRED_AUTHENTICATED |
| `teaching_assignment_grant(_school text)` | DEFINER | `""` | nenhum | reader | app,sqltest | sim | — | DEPRECATED/UNUSED |
| `teaching_candidate_engagements(_school_id text, _person_id uuid, _on date)` | DEFINER | `""` | authenticated | reader | app | sim | — | REQUIRED_AUTHENTICATED |
| `teaching_plans_overview_at(_school text, _on date)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `teaching_staff_fit(_domain text, _engagement_id uuid, _school text, _functional_link uuid, _from date, _until date)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | — | — | INTERNAL_ONLY |
| `technical_automation_enabled()` | DEFINER | `""` | nenhum | reader | app,definer | — | — | INTERNAL_ONLY |
| `technical_correct_educacenso_2026_temporal(_operation_kind text, _source_hash text, _payload jsonb)` | DEFINER | `""` | nenhum | writer | app,sqltest | — | — | INTERNAL_ONLY |
| `technical_cpf_hmac(_cpf text)` | DEFINER | `""` | nenhum | reader | app,sqltest,definer | — | — | INTERNAL_ONLY |
| `technical_import_educacenso_2026_classes(_operation_kind text, _source_hash text, _snapshot date, _payload jsonb)` | DEFINER | `""` | nenhum | writer | app,sqltest,definer | delega | — | INTERNAL_ONLY |
| `technical_import_educacenso_2026_infrastructure(_operation_kind text, _source_hash text, _snapshot date, _payload jsonb)` | DEFINER | `""` | nenhum | writer | app,sqltest | — | — | INTERNAL_ONLY |
| `technical_import_educacenso_2026_professional_schedules(_operation_kind text, _source_hash text, _snapshot date, _payload jsonb)` | DEFINER | `""` | nenhum | writer | app,sqltest | — | — | INTERNAL_ONLY |
| `technical_import_educacenso_2026_professionals(_operation_kind text, _source_hash text, _snapshot date, _payload jsonb)` | DEFINER | `""` | nenhum | writer | app,sqltest | — | — | INTERNAL_ONLY |
| `technical_import_educacenso_2026_schools(_operation_kind text, _source_hash text, _snapshot date, _schools jsonb)` | DEFINER | `""` | nenhum | writer | app,sqltest | — | — | INTERNAL_ONLY |
| `technical_import_educacenso_2026_students_enrollments(_operation_kind text, _source_hash text, _payload jsonb)` | DEFINER | `""` | nenhum | writer | app,sqltest | — | — | INTERNAL_ONLY |
| `verify_school_document(_code text)` | DEFINER | `""` | anon,authenticated,service_role | reader | app | — | — | PUBLIC_VERIFICATION |
| `verify_student_card(_public_id text, _version integer)` | DEFINER | `""` | anon,authenticated,service_role | reader | app | — | — | PUBLIC_VERIFICATION |
| `workflow_can_read(_definition uuid, _school uuid, _opened_by uuid)` | DEFINER | `""` | authenticated,service_role | reader | app,policy | sim | — | REQUIRED_AUTHENTICATED |
| `workflow_has_capability(_cap text, _school uuid)` | DEFINER | `""` | authenticated,service_role | reader | app,definer | sim | — | REQUIRED_AUTHENTICATED |
| `year_preparation_summary(_school text, _from_year text, _to_year text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |
| `year_transition_candidates(_school text, _from_year text, _to_year text)` | DEFINER | `""` | authenticated | reader | app,sqltest | sim | — | REQUIRED_AUTHENTICATED |