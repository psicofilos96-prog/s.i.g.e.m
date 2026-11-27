CREATE TABLE public.technical_test_school_cleanup_commands (
  request_hash text PRIMARY KEY CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  payload jsonb NOT NULL,
  operation_id uuid REFERENCES public.technical_execution_operations(id),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.technical_test_school_cleanup_commands TO postgres;
REVOKE ALL ON public.technical_test_school_cleanup_commands FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.technical_test_school_cleanup_commands ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER technical_test_school_cleanup_commands_immutable BEFORE UPDATE OR DELETE ON public.technical_test_school_cleanup_commands FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE OR REPLACE FUNCTION public.technical_cleanup_test_school_99999901(_hash text, _payload jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE
  expected constant jsonb := '{"school_id":"inep-99999901","inep":"99999901","operation_kind":"technical-cleanup-test-school-99999901","source_operations":["5e6fdb25-2c18-4bde-b20e-3dd6dd8c0c20","7a2f0000-0000-4000-8000-000000002027"],"expected":{"school":1,"school_versions":2,"school_identifiers":1,"students":80,"enrollments":192,"null_operation_enrollments":80,"classes":6,"staff_source":16,"census":7,"engagements":34},"preserve_audit":true,"preserve_global_catalogs":true,"protected_staff":{"school_rows":1797,"semed_rows":219,"school_sha256":"16061cbd43255ef4e7526b6473ed28c1b84fa7b7cb2f1bfdcbee9a8d89ab5471","semed_sha256":"70cfe4f2af3823decb98aae04e65d0b89867c4ab038afe97ba6a665a253183ba"}}'::jsonb;
  allowed constant text[] := ARRAY['acv_acl','acv_favorites','acv_file_versions','acv_links','acv_nodes','acv_policy_approvals','acv_policy_versions','acv_space_members','acv_spaces','acv_uploads','attendance_record_versions','class_composition_positions','class_composition_versions','class_enrollment_episode_endings','class_enrollment_episodes','class_journey_intervals','class_journey_versions','class_journeys','class_offering_axis_values','class_offering_versions','class_schedule_block_engagements','class_schedule_blocks','class_schedule_versions','class_schedules','class_specific_matrix_association_homologations','class_specific_matrix_association_versions','class_specific_matrix_associations','cycle_participations','data_quality_review_events','dev_activity_submissions','dev_attendance_records','dev_certificate_issuances','dev_certificate_revocations','dev_certificate_validations','dev_certificate_versions','dev_certifications','dev_completion_assessments','dev_completion_confirmations','dev_enrollment_requests','dev_enrollment_reviews','dev_enrollments','dev_learning_results','dev_participation_events','dev_questionnaire_responses','dev_result_review_decisions','dev_result_review_requests','dev_submission_feedback','dev_survey_responses','enr_formalization_links','enr_transfer_events','enrollment_wizard_draft_events','institutional_class_period_organization_versions','institutional_class_record_versions','institutional_classes','institutional_engagement_scope_classes','institutional_engagements','institutional_person_identifiers','institutional_persons','institutional_school_identifiers','institutional_school_record_versions','institutional_schools','institutional_sector_principal_revocations','institutional_sector_principals','institutional_student_persons','institutional_students','lesson_curricular_references','lesson_record_versions','meal_special_diet_decisions','meal_special_diet_requests','ops_transport_decisions','ops_transport_requests','professional_census_declarations','professional_functional_links','professional_postings','renewal_term_records','school_disciplinary_occurrence_attachments','school_disciplinary_occurrence_parties','school_disciplinary_occurrences','school_document_emission_events','school_document_emissions','school_enrollment_endings','school_enrollment_entry_origins','school_enrollment_start_declarations','school_enrollments','school_notice_withdrawals','school_notices','school_official_letter_cancellations','school_official_letters','school_reclassification_steps','school_risk_limits','school_vacancy_request_events','school_vacancy_requests','semed_t10_formation_versions','sg_attendance','sg_classes','sg_staff','sg_students','sia_card_corrections','sia_instrument_print_settings','staff_administrative_records','staff_reconciliation_candidates','staff_reconciliation_decisions','statistical_map_freezes','student_bond_census_attributes','student_class_bond_observations','student_consent_events','student_death_corrections','student_death_records','student_document_pendency_events','student_home_hospital_care_events','student_identity_versions','student_movement_events','student_protection_events','student_protection_recipient_events','student_registration_observations','student_vaccination_status_events','teacher_diary_approvals','teacher_instrument_versions','teaching_assignment_versions','teaching_assignments','teaching_plan_lesson_links','teaching_plan_share_copies','teaching_plan_versions','teaching_substitution_versions','teaching_substitutions','test_school_markers','transfer_declarations','user_person_links','year_transition_decisions'];
  preserved constant text[] := ARRAY['technical_execution_operations','technical_execution_targets','technical_execution_findings','technical_automation_settings','technical_test_school_cleanup_commands','exact_lookup_events','student_protection_access_log','institutional_sector_provisioning_events'];
  ids text[]; students text[]; persons text[]; staff_persons text[]; classes text[]; engagements text[];
  plan jsonb := '{}'::jsonb; before_plan jsonb;
  root_counts jsonb; protected_before jsonb; protected_after jsonb; manifest jsonb; fp text;
  tab record; fk record; r jsonb; rows jsonb; keys jsonb; predicate text;
  op uuid; existing record; started timestamptz := pg_catalog.clock_timestamp();
  loop_no integer; written bigint; total bigint := 0; remaining text[]; changed boolean;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'technical:automation-disabled'; END IF;
  IF _payload IS DISTINCT FROM expected THEN RAISE EXCEPTION 'technical:cleanup-payload-not-allowlisted'; END IF;
  fp := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(_payload::text,'UTF8')),'hex');
  IF _hash IS DISTINCT FROM fp THEN RAISE EXCEPTION 'technical:cleanup-hash-mismatch'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('technical-cleanup-test-school-99999901',0));
  SELECT * INTO existing FROM public.technical_execution_operations WHERE operation_kind='technical-cleanup-test-school-99999901' AND source_hash=_hash;
  IF existing.id IS NOT NULL THEN
    IF existing.payload_fingerprint IS DISTINCT FROM fp THEN RAISE EXCEPTION 'technical:cleanup-retry-differs'; END IF;
    RETURN existing.id;
  END IF;
  FOR tab IN SELECT c.relname FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') ORDER BY c.relname LOOP
    EXECUTE pg_catalog.format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE',tab.relname);
  END LOOP;
  IF (SELECT count(*) FROM public.technical_execution_operations WHERE (id='5e6fdb25-2c18-4bde-b20e-3dd6dd8c0c20' AND operation_kind='tecnica-escola-de-teste-2026') OR (id='7a2f0000-0000-4000-8000-000000002027' AND operation_kind='tecnica-mover-escola-teste-2027')) <> 2 THEN RAISE EXCEPTION 'technical:cleanup-source-operations-mismatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.test_school_markers WHERE school_id='inep-99999901') OR NOT EXISTS (SELECT 1 FROM public.institutional_school_identifiers WHERE school_id='inep-99999901' AND identifier_kind='inep' AND value='99999901') THEN RAISE EXCEPTION 'technical:cleanup-school-provenance-mismatch'; END IF;
  SELECT pg_catalog.array_agg(DISTINCT student_id) INTO students FROM public.school_enrollments WHERE school_id='inep-99999901';
  SELECT pg_catalog.array_agg(id) INTO classes FROM public.institutional_classes WHERE school_id='inep-99999901';
  SELECT pg_catalog.array_agg(id::text),pg_catalog.array_agg(DISTINCT person_id::text) INTO engagements,staff_persons FROM public.institutional_engagements WHERE school_id='inep-99999901';
  SELECT pg_catalog.array_agg(DISTINCT p) INTO persons FROM (SELECT person_id::text p FROM public.institutional_student_persons WHERE student_id=ANY(students) UNION SELECT pg_catalog.unnest(staff_persons)) x;
  root_counts := pg_catalog.jsonb_build_object('school',(SELECT count(*) FROM public.institutional_schools WHERE id='inep-99999901'),'school_versions',(SELECT count(*) FROM public.institutional_school_record_versions WHERE school_id='inep-99999901'),'school_identifiers',(SELECT count(*) FROM public.institutional_school_identifiers WHERE school_id='inep-99999901'),'students',pg_catalog.cardinality(students),'enrollments',(SELECT count(*) FROM public.school_enrollments WHERE school_id='inep-99999901'),'null_operation_enrollments',(SELECT count(*) FROM public.school_enrollments WHERE school_id='inep-99999901' AND technical_operation_id IS NULL),'classes',pg_catalog.cardinality(classes),'staff_source',(SELECT count(*) FROM public.staff_administrative_records WHERE school_id='inep-99999901' AND source_kind='servidores-por-escola' AND source_file='Escola de teste (dados fictícios)'),'census',(SELECT count(*) FROM public.professional_census_declarations WHERE school_id='inep-99999901' AND technical_operation_id='5e6fdb25-2c18-4bde-b20e-3dd6dd8c0c20'),'engagements',pg_catalog.cardinality(engagements));
  IF root_counts IS DISTINCT FROM expected->'expected' THEN RAISE EXCEPTION 'technical:cleanup-expected-counts-mismatch'; END IF;
  IF (SELECT count(*) FROM public.school_enrollments WHERE school_id='inep-99999901' AND technical_operation_id='5e6fdb25-2c18-4bde-b20e-3dd6dd8c0c20') <> 56 OR (SELECT count(*) FROM public.school_enrollments WHERE school_id='inep-99999901' AND technical_operation_id='7a2f0000-0000-4000-8000-000000002027') <> 56 OR EXISTS (SELECT 1 FROM public.school_enrollments WHERE student_id=ANY(students) AND school_id<>'inep-99999901') OR EXISTS (SELECT 1 FROM public.institutional_student_persons WHERE person_id::text=ANY(persons) AND NOT(student_id=ANY(students))) OR EXISTS (SELECT 1 FROM public.institutional_engagements WHERE person_id::text=ANY(persons) AND school_id IS DISTINCT FROM 'inep-99999901') THEN RAISE EXCEPTION 'technical:cleanup-mixed-student-person-scope'; END IF;
  IF EXISTS (SELECT 1 FROM public.staff_administrative_records WHERE school_id='inep-99999901' AND (source_kind IS DISTINCT FROM 'servidores-por-escola' OR source_file IS DISTINCT FROM 'Escola de teste (dados fictícios)')) OR EXISTS (SELECT 1 FROM public.professional_census_declarations WHERE school_id='inep-99999901' AND technical_operation_id IS DISTINCT FROM '5e6fdb25-2c18-4bde-b20e-3dd6dd8c0c20'::uuid) OR EXISTS (SELECT 1 FROM public.professional_functional_links WHERE person_id::text=ANY(staff_persons) AND (originating_act_ref IS DISTINCT FROM 'teste-99999901' OR functional_registration NOT LIKE 'TESTE-%')) THEN RAISE EXCEPTION 'technical:cleanup-staff-provenance-mismatch'; END IF;
  SELECT pg_catalog.array_agg(DISTINCT v) INTO ids FROM (SELECT 'inep-99999901' v UNION SELECT pg_catalog.unnest(students) UNION SELECT pg_catalog.unnest(classes) UNION SELECT pg_catalog.unnest(persons) UNION SELECT pg_catalog.unnest(engagements) UNION SELECT id::text FROM public.institutional_sector_principals WHERE school_id='inep-99999901' UNION SELECT logical_id::text FROM public.professional_functional_links WHERE person_id::text=ANY(staff_persons)) z;
  FOR tab IN SELECT c.table_name,pg_catalog.string_agg(pg_catalog.format('r.%I::text=ANY($1)',c.column_name),' OR ') pred FROM information_schema.columns c JOIN information_schema.tables t USING(table_schema,table_name) WHERE c.table_schema='public' AND t.table_type='BASE TABLE' AND c.table_name<>ALL(preserved) AND (c.column_name IN ('school_id','scope_school_id','unit_id','origin_school_id','destination_school_id','source_school_id','target_school_id','student_id','existing_student_id','person_id','subject_person','subject_person_id','professional_person_id','teacher_person_id','author_person_id','actor_person_id','class_id','engagement_id','authorizing_engagement_id','logical_link_id','functional_link_id','principal_id','author_principal_id') OR (c.column_name='id' AND c.table_name IN ('institutional_schools','institutional_students','institutional_persons'))) GROUP BY c.table_name ORDER BY c.table_name LOOP
    EXECUTE pg_catalog.format('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)),''[]''::jsonb) FROM public.%I r WHERE %s',tab.table_name,tab.pred) INTO rows USING ids;
    IF rows<>'[]'::jsonb THEN
      IF tab.table_name<>ALL(allowed) THEN RAISE EXCEPTION 'technical:cleanup-unreviewed-table:%',tab.table_name; END IF;
      plan := pg_catalog.jsonb_set(plan,ARRAY[tab.table_name],rows,true);
    END IF;
  END LOOP;
  FOR loop_no IN 1..32 LOOP
    before_plan := plan;
    FOR fk IN SELECT c.conname,child.relname child_table,parent.relname parent_table,pg_catalog.string_agg(pg_catalog.format('r.%I::text=p->>%L',ca.attname,pa.attname),' AND ' ORDER BY k.ord) pred FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class child ON child.oid=c.conrelid JOIN pg_catalog.pg_namespace cn ON cn.oid=child.relnamespace JOIN pg_catalog.pg_class parent ON parent.oid=c.confrelid JOIN pg_catalog.pg_namespace pn ON pn.oid=parent.relnamespace CROSS JOIN LATERAL ROWS FROM (pg_catalog.unnest(c.conkey),pg_catalog.unnest(c.confkey)) WITH ORDINALITY k(ck,pk,ord) JOIN pg_catalog.pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=k.ck JOIN pg_catalog.pg_attribute pa ON pa.attrelid=c.confrelid AND pa.attnum=k.pk WHERE c.contype='f' AND cn.nspname='public' AND pn.nspname='public' AND plan ? parent.relname GROUP BY c.oid,c.conname,child.relname,parent.relname ORDER BY child.relname,c.conname LOOP
      EXECUTE pg_catalog.format('SELECT coalesce(jsonb_agg(to_jsonb(r)),''[]''::jsonb) FROM public.%I r WHERE EXISTS(SELECT 1 FROM jsonb_array_elements($1) p WHERE %s)',fk.child_table,fk.pred) INTO rows USING plan->fk.parent_table;
      IF rows<>'[]'::jsonb THEN
        IF fk.child_table=ANY(preserved) OR fk.child_table ~ '(audit|access_log)' THEN RAISE EXCEPTION 'technical:cleanup-retained-audit-reference:%:%',fk.child_table,fk.conname; END IF;
        IF fk.child_table<>ALL(allowed) THEN RAISE EXCEPTION 'technical:cleanup-unreviewed-dependent:%',fk.child_table; END IF;
        SELECT pg_catalog.jsonb_agg(DISTINCT v ORDER BY v) INTO rows FROM pg_catalog.jsonb_array_elements(coalesce(plan->fk.child_table,'[]'::jsonb)||rows) v;
        plan := pg_catalog.jsonb_set(plan,ARRAY[fk.child_table],rows,true);
      END IF;
    END LOOP;
    EXIT WHEN plan=before_plan;
    IF loop_no=32 THEN RAISE EXCEPTION 'technical:cleanup-fk-expansion-not-closed'; END IF;
  END LOOP;
  FOR tab IN SELECT key table_name,value rows FROM pg_catalog.jsonb_each(plan) LOOP
    FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(tab.rows) LOOP
      IF EXISTS (SELECT 1 FROM pg_catalog.jsonb_each_text(r) a WHERE a.key IN ('school_id','scope_school_id','origin_school_id','destination_school_id','source_school_id','target_school_id') AND a.value IS NOT NULL AND a.value<>'inep-99999901') OR (r->>'student_id' IS NOT NULL AND NOT(r->>'student_id'=ANY(students))) OR (r->>'class_id' IS NOT NULL AND NOT(r->>'class_id'=ANY(classes))) THEN RAISE EXCEPTION 'technical:cleanup-mixed-dependent:%',tab.table_name; END IF;
    END LOOP;
  END LOOP;
  IF plan ? 'acv_file_versions' OR plan ? 'acv_uploads' OR plan ? 'inclusion_attachments' OR plan ? 'school_institutional_followup_attachments' THEN RAISE EXCEPTION 'technical:cleanup-private-files-present'; END IF;
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_trigger t JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgenabled<>'D' AND (t.tgtype & 8)<>0 AND plan ? c.relname) THEN RAISE EXCEPTION 'technical:cleanup-existing-delete-guards-require-supported-fixture-path'; END IF;
  SELECT pg_catalog.jsonb_object_agg(source_file,pg_catalog.jsonb_build_object('rows',n,'sha256',sha)) INTO protected_before FROM (SELECT s.source_file,count(*) n,pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.string_agg(pg_catalog.to_jsonb(s)::text,E'\n' ORDER BY s.id),'UTF8')),'hex') sha FROM public.staff_administrative_records s WHERE source_file IN ('Relacao_Servidores_por_Escola_Ago-Set_2026.xlsx','Relacao_Funcionarios_SEMED_por_Setor.xlsx') GROUP BY s.source_file) z;
  IF protected_before->'Relacao_Servidores_por_Escola_Ago-Set_2026.xlsx' IS DISTINCT FROM pg_catalog.jsonb_build_object('rows',1797,'sha256',expected#>>'{protected_staff,school_sha256}') OR protected_before->'Relacao_Funcionarios_SEMED_por_Setor.xlsx' IS DISTINCT FROM pg_catalog.jsonb_build_object('rows',219,'sha256',expected#>>'{protected_staff,semed_sha256}') THEN RAISE EXCEPTION 'technical:cleanup-real-staff-baseline-mismatch'; END IF;
  manifest := '[]'::jsonb;
  FOR tab IN SELECT key table_name,value rows FROM pg_catalog.jsonb_each(plan) ORDER BY key LOOP
    SELECT pg_catalog.jsonb_agg(a.attname ORDER BY k.ord) INTO keys FROM pg_catalog.pg_constraint c CROSS JOIN LATERAL pg_catalog.unnest(c.conkey) WITH ORDINALITY k(num,ord) JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.num WHERE c.contype='p' AND c.conrelid=pg_catalog.to_regclass('public.'||tab.table_name);
    IF keys IS NULL THEN RAISE EXCEPTION 'technical:cleanup-primary-key-required:%',tab.table_name; END IF;
    FOR r IN SELECT value FROM pg_catalog.jsonb_array_elements(tab.rows) LOOP
      manifest := manifest||pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('table',tab.table_name,'key',(SELECT pg_catalog.jsonb_object_agg(a.key,a.value) FROM pg_catalog.jsonb_each(r) a WHERE keys ? a.key),'sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(r::text,'UTF8')),'hex')));
    END LOOP;
  END LOOP;
  op := pg_catalog.gen_random_uuid();
  INSERT INTO public.technical_execution_operations(id,operation_kind,executor_kind,executor_label,environment,source_ref,source_hash,requested_by,payload_fingerprint,status,result,started_at) VALUES(op,'technical-cleanup-test-school-99999901','automacao-tecnica','executor técnico restrito de limpeza SIGEM (Lovable)','desenvolvimento','decisão do proprietário: excluir integralmente a escola fictícia inep-99999901; 2026-11-23',_hash,'decisao-do-proprietario',fp,'concluida',pg_catalog.jsonb_build_object('school_id','inep-99999901','before',root_counts,'manifest',manifest,'manifest_sha256',pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(manifest::text,'UTF8')),'hex'),'findings',pg_catalog.jsonb_build_array('fontes exatas verificadas','referências mistas recusadas','auditoria imutável preservada'),'protected_staff',protected_before),started);
  INSERT INTO public.technical_execution_targets(operation_id,target_table,target_id) SELECT op,e->>'table',(e->'key')::text FROM pg_catalog.jsonb_array_elements(manifest) e;
  SELECT pg_catalog.array_agg(key ORDER BY key) INTO remaining FROM pg_catalog.jsonb_each(plan);
  WHILE coalesce(pg_catalog.cardinality(remaining),0)>0 LOOP
    changed := false;
    FOREACH predicate IN ARRAY remaining LOOP
      IF predicate='institutional_schools' AND pg_catalog.cardinality(remaining)>1 THEN CONTINUE; END IF;
      IF EXISTS (SELECT 1 FROM pg_catalog.pg_constraint c JOIN pg_catalog.pg_class child ON child.oid=c.conrelid JOIN pg_catalog.pg_class parent ON parent.oid=c.confrelid WHERE c.contype='f' AND parent.relname=predicate AND child.relname<>parent.relname AND child.relname=ANY(remaining)) THEN CONTINUE; END IF;
      rows := plan->predicate;
      EXECUTE pg_catalog.format('DELETE FROM public.%I r WHERE to_jsonb(r) IN (SELECT value FROM jsonb_array_elements($1))',predicate) USING rows;
      GET DIAGNOSTICS written=ROW_COUNT;
      IF written<>pg_catalog.jsonb_array_length(rows) THEN RAISE EXCEPTION 'technical:cleanup-delete-count-mismatch:%',predicate; END IF;
      total := total+written; remaining := pg_catalog.array_remove(remaining,predicate); changed := true;
    END LOOP;
    IF NOT changed THEN RAISE EXCEPTION 'technical:cleanup-fk-cycle'; END IF;
  END LOOP;
  FOR tab IN SELECT key table_name,value rows FROM pg_catalog.jsonb_each(plan) LOOP
    EXECUTE pg_catalog.format('SELECT EXISTS(SELECT 1 FROM public.%I r WHERE to_jsonb(r) IN(SELECT value FROM jsonb_array_elements($1)))',tab.table_name) INTO changed USING tab.rows;
    IF changed THEN RAISE EXCEPTION 'technical:cleanup-residual-target:%',tab.table_name; END IF;
  END LOOP;
  SELECT pg_catalog.jsonb_object_agg(source_file,pg_catalog.jsonb_build_object('rows',n,'sha256',sha)) INTO protected_after FROM (SELECT s.source_file,count(*) n,pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.string_agg(pg_catalog.to_jsonb(s)::text,E'\n' ORDER BY s.id),'UTF8')),'hex') sha FROM public.staff_administrative_records s WHERE source_file IN ('Relacao_Servidores_por_Escola_Ago-Set_2026.xlsx','Relacao_Funcionarios_SEMED_por_Setor.xlsx') GROUP BY s.source_file) z;
  IF protected_after IS DISTINCT FROM protected_before OR total<>pg_catalog.jsonb_array_length(manifest) OR EXISTS(SELECT 1 FROM public.institutional_schools WHERE id='inep-99999901') THEN RAISE EXCEPTION 'technical:cleanup-postcondition-failed'; END IF;
  RETURN op;
END $function$;
REVOKE ALL ON FUNCTION public.technical_cleanup_test_school_99999901(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.technical_test_school_cleanup_command()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO '' AS $function$
BEGIN
  IF current_user IS DISTINCT FROM pg_catalog.pg_get_userbyid((SELECT p.proowner FROM pg_catalog.pg_proc p WHERE p.oid='public.technical_cleanup_test_school_99999901(text,jsonb)'::regprocedure)) THEN RAISE EXCEPTION 'technical:cleanup-owner-channel-required'; END IF;
  NEW.operation_id := public.technical_cleanup_test_school_99999901(NEW.request_hash,NEW.payload);
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.technical_test_school_cleanup_command() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER technical_test_school_cleanup_command BEFORE INSERT ON public.technical_test_school_cleanup_commands FOR EACH ROW EXECUTE FUNCTION public.technical_test_school_cleanup_command();
COMMENT ON TABLE public.technical_test_school_cleanup_commands IS 'Owner-only, single allowlisted technical command; no domain-table DML channel. Failure rolls back command and operation; immutable audit and existing guards must remain intact.';