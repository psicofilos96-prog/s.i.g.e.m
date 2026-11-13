-- Selected scanner findings only: institutional shared data requires canonical linkage.
CREATE OR REPLACE FUNCTION public.security_catalog_reader()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.current_person_id() IS NOT NULL
    OR public.current_principal_id() IS NOT NULL
    OR EXISTS (SELECT 1 FROM auth.users u WHERE u.id = auth.uid()
      AND lower(u.email) = public.sigem_designated_installer_email())
  )
$$;
REVOKE ALL ON FUNCTION public.security_catalog_reader() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.security_catalog_reader() TO authenticated;
COMMENT ON FUNCTION public.security_catalog_reader() IS 'Shared institutional catalogs require a canonical linked person, valid sector principal, or designated activation account; authentication alone is insufficient.';
DO $$
DECLARE r record; n integer := 0;
BEGIN
  FOR r IN SELECT tablename, policyname FROM pg_catalog.pg_policies
    WHERE schemaname = 'public' AND cmd = 'SELECT' AND qual = 'true'
      AND roles = ARRAY['authenticated']::name[]
      AND tablename = ANY (ARRAY[
        'tech_annual_plan_versions','lc_instrument_versions','semed_t04_rule_versions','curricular_reference_items','dev_rubric_approvals','dev_track_mandates','final_sheet_rule_versions','sia_print_header_versions','semed_t11_rule_versions','dev_class_trainers','dev_survey_approvals','dev_role_track_target_withdrawals','tech_recurrence_rule_approvals','dev_role_track_targets','studio_template_events','network_notice_withdrawals','ops_transport_rule_versions','dev_class_status_events','aa_calendar_items','tech_service_accessibility_checks','dev_completion_criteria_approvals','ops_supply_item_approvals','institutional_schools','docserv_seasons','curricular_reference_correspondence_assessments','sipe_plan_template_versions','dev_class_activities','enr_parameter_approvals','territorial_districts','tech_sla_policy_approvals','lesson_resource_records','dev_class_material_withdrawals','school_infrastructure_attribute_versions','territorial_subdistricts','dev_courses','tech_parameter_approvals','dev_rubric_versions','curricular_reference_item_bindings','sector_parameter_versions','lc_instrument_homologations','dev_course_catalog_contents','dev_class_waitlist_criteria','ops_transport_rule_approvals','tech_equipment_category_marks','curricular_reference_homologations','educacenso_aux_codes','map_competence_rules','tech_service_accessibility','educacenso_aux_rows','dev_course_prerequisites','curricular_reference_simplifications','dev_competency_approvals','dev_waitlist_criteria_versions','sigem_installation_acts','tech_digital_service_versions','academic_year_operational_states','dev_partners','curricular_reference_glossary_versions','tech_digital_service_approvals','tech_annual_plan_approvals','dev_course_codes','semed_table_catalog','tech_equipment_category_mark_approvals','institutional_school_record_versions','sigem_installation_state','educacenso_aux_sources','test_school_markers','class_designation_policy_versions','dev_programs','tech_sla_policy_versions','dev_competencies','dev_meeting_notices','aa_calendar_sources','territorial_district_changes','curricular_reference_editions','tech_kb_links','tech_pedagogical_evaluations','ops_asset_category_approvals','territorial_dtb_sources','sector_parameter_catalog','tech_pedagogical_rubric_versions','institutional_school_identifiers','tech_recurrence_rule_versions','movement_type_definitions','sl_instrument_homologations','dev_partner_course_links','tech_kb_link_validations','tech_pedagogical_rubric_approvals','op_permanent_board_versions','educacenso_aux_rules','aa_calendar_status_events','docserv_document_types','semed_t06_rule_versions','dev_course_competency_links','dev_completion_criteria_versions','dev_class_details','workflow_definitions','dev_classes','docserv_document_policies','network_notices','class_designation_policy_homologations','enr_parameter_versions','territorial_ufs','attribute_value_definitions','dev_survey_versions','tech_parameter_versions','territorial_municipalities','dev_class_meeting_versions','dev_waitlist_criteria_approvals','dev_course_versions','ops_supply_item_versions','ops_crew_requirement_versions','dev_track_approvals','curriculum_objectives','dev_track_mandate_revocations','studio_template_versions','dev_tracks','institutional_school_links','dev_partner_approvals','tech_ticket_category_versions','tech_ticket_category_approvals','sl_instrument_versions','curricular_reference_keyword_versions','ops_asset_category_versions','dev_class_meetings','curricular_reference_relations'
      ]::text[])
  LOOP
    IF r.tablename = 'lesson_resource_records' THEN
      EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated USING (EXISTS (SELECT 1 FROM public.lesson_record_versions l WHERE l.logical_record_id = lesson_resource_records.lesson_ref OR l.id::text = lesson_resource_records.lesson_ref))', r.policyname, r.tablename);
    ELSE
      EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated USING ((SELECT public.security_catalog_reader()))', r.policyname, r.tablename);
    END IF;
    n := n + 1;
  END LOOP;
  IF n <> 126 THEN RAISE EXCEPTION 'Selected security policy set changed: expected 126, found %', n; END IF;
END $$;
-- Logos are intentionally shared institutional branding, but only registered artifacts are readable.
CREATE OR REPLACE FUNCTION public.security_school_logo_readable(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT public.security_catalog_reader() AND EXISTS (
    SELECT 1 FROM public.school_logo_versions l WHERE l.object_path = _name
  )
$$;
REVOKE ALL ON FUNCTION public.security_school_logo_readable(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.security_school_logo_readable(text) TO authenticated;
ALTER POLICY "logos leitura autenticada" ON storage.objects TO authenticated
  USING (bucket_id = 'escola-logos' AND (
    owner_id = (SELECT auth.uid()::text)
    OR public.security_school_logo_readable(name)
  ));
-- Published notice attachments follow the existing notice RLS; owners can preview uploads.
ALTER POLICY "avisos-rede leitura autenticada" ON storage.objects TO authenticated
  USING (bucket_id = 'avisos-rede' AND (
    owner_id = (SELECT auth.uid()::text)
    OR EXISTS (SELECT 1 FROM public.network_notices n WHERE n.image_path = objects.name)
  ));