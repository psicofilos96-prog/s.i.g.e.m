CREATE INDEX IF NOT EXISTS ndb11_institutional_classes_academic_year_id_idx ON public.institutional_classes (academic_year_id);
CREATE INDEX IF NOT EXISTS ndb11_class_source_observations_class_id_idx ON public.class_source_observations (class_id);
CREATE INDEX IF NOT EXISTS ndb11_professional_functional_links_person_id_idx ON public.professional_functional_links (person_id);
CREATE INDEX IF NOT EXISTS ndb11_institutional_sector_principals_school_id_idx ON public.institutional_sector_principals (school_id);
CREATE INDEX IF NOT EXISTS ndb11_guardian_authorizations_student_id_idx ON public.guardian_authorizations (student_id);
CREATE INDEX IF NOT EXISTS ndb11_meal_order_versions_school_id_idx ON public.meal_order_versions (school_id);
CREATE INDEX IF NOT EXISTS ndb11_student_movement_events_student_id_idx ON public.student_movement_events (student_id);
CREATE INDEX IF NOT EXISTS ndb11_meal_fiscal_documents_school_id_idx ON public.meal_fiscal_documents (school_id);
CREATE INDEX IF NOT EXISTS ndb11_meal_receipts_school_id_idx ON public.meal_receipts (school_id);
CREATE INDEX IF NOT EXISTS ndb11_meal_nonconformities_school_id_idx ON public.meal_nonconformities (school_id);
CREATE INDEX IF NOT EXISTS ndb11_meal_stock_counts_school_id_idx ON public.meal_stock_counts (school_id);
CREATE INDEX IF NOT EXISTS ndb11_student_photo_versions_student_id_idx ON public.student_photo_versions (student_id);
CREATE INDEX IF NOT EXISTS ndb11_sigem_installation_acts_engagement_id_idx ON public.sigem_installation_acts (engagement_id);
CREATE INDEX IF NOT EXISTS ndb11_sigem_installation_acts_person_id_idx ON public.sigem_installation_acts (person_id);
CREATE INDEX IF NOT EXISTS ndb11_cycle_enrollment_ending_versions_school_id_idx ON public.cycle_enrollment_ending_versions (school_id);
CREATE INDEX IF NOT EXISTS ndb11_class_allocation_ending_versions_school_id_idx ON public.class_allocation_ending_versions (school_id);
CREATE INDEX IF NOT EXISTS ndb11_class_allocation_ending_versions_class_id_idx ON public.class_allocation_ending_versions (class_id);
CREATE INDEX IF NOT EXISTS ndb11_cycle_participations_student_id_idx ON public.cycle_participations (student_id);
CREATE INDEX IF NOT EXISTS ndb11_cycle_participations_school_id_idx ON public.cycle_participations (school_id);
CREATE INDEX IF NOT EXISTS ndb11_class_capacity_records_class_id_idx ON public.class_capacity_records (class_id);
CREATE INDEX IF NOT EXISTS ndb11_class_capacity_records_school_id_idx ON public.class_capacity_records (school_id);
CREATE INDEX IF NOT EXISTS ndb11_curricular_matrix_applicability_academic_year_id_idx ON public.curricular_matrix_applicability (academic_year_id);
CREATE INDEX IF NOT EXISTS ndb11_curricular_matrix_applicability_school_id_idx ON public.curricular_matrix_applicability (school_id);
CREATE INDEX IF NOT EXISTS ndb11_class_specific_matrix_associations_class_id_idx ON public.class_specific_matrix_associations (class_id);
CREATE INDEX IF NOT EXISTS ndb11_class_shift_versions_class_id_idx ON public.class_shift_versions (class_id);
CREATE INDEX IF NOT EXISTS ndb11_institutional_engagements_person_id_idx ON public.institutional_engagements (person_id);
CREATE INDEX IF NOT EXISTS ndb11_calendar_version_applicability_condition_school_id_idx ON public.calendar_version_applicability_conditions (school_id);
CREATE INDEX IF NOT EXISTS ndb11_calendar_authority_designations_person_id_idx ON public.calendar_authority_designations (person_id);
CREATE INDEX IF NOT EXISTS ndb11_calendar_network_source_links_academic_year_id_idx ON public.calendar_network_source_links (academic_year_id);
CREATE INDEX IF NOT EXISTS ndb11_teaching_assignments_class_id_idx ON public.teaching_assignments (class_id);
CREATE INDEX IF NOT EXISTS ndb11_student_movement_events_enrollment_id_idx ON public.student_movement_events (enrollment_id);
CREATE INDEX IF NOT EXISTS ndb11_class_enrollment_episodes_enrollment_id_idx ON public.class_enrollment_episodes (enrollment_id);
CREATE INDEX IF NOT EXISTS ndb11_class_enrollment_episodes_student_id_idx ON public.class_enrollment_episodes (student_id);
CREATE INDEX IF NOT EXISTS ndb11_class_offering_versions_class_id_idx ON public.class_offering_versions (class_id);
CREATE INDEX IF NOT EXISTS ndb11_professional_postings_school_id_idx ON public.professional_postings (school_id);
CREATE INDEX IF NOT EXISTS ndb11_institutional_engagement_scope_classes_class_id_idx ON public.institutional_engagement_scope_classes (class_id);
CREATE INDEX IF NOT EXISTS ndb11_class_enrollment_episodes_school_id_idx ON public.class_enrollment_episodes (school_id);
CREATE INDEX IF NOT EXISTS ndb11_year_transition_decisions_student_id_idx ON public.year_transition_decisions (student_id);
CREATE INDEX IF NOT EXISTS ndb11_student_registration_events_student_id_idx ON public.student_registration_events (student_id);
CREATE INDEX IF NOT EXISTS ndb11_student_registration_events_person_id_idx ON public.student_registration_events (person_id);
CREATE INDEX IF NOT EXISTS ndb11_student_registration_events_school_id_idx ON public.student_registration_events (school_id);
CREATE INDEX IF NOT EXISTS ndb11_school_staff_presence_school_id_idx ON public.school_staff_presence (school_id);
CREATE INDEX IF NOT EXISTS ndb11_school_staff_presence_academic_year_id_idx ON public.school_staff_presence (academic_year_id);
CREATE INDEX IF NOT EXISTS ndb11_school_communication_versions_class_id_idx ON public.school_communication_versions (class_id);
CREATE INDEX IF NOT EXISTS ndb11_school_communication_receipts_student_id_idx ON public.school_communication_receipts (student_id);
CREATE INDEX IF NOT EXISTS ndb11_institutional_engagements_school_id_idx ON public.institutional_engagements (school_id);
CREATE INDEX IF NOT EXISTS ndb11_institutional_period_organizations_academic_year_id_idx ON public.institutional_period_organizations (academic_year_id);
CREATE INDEX IF NOT EXISTS ndb11_user_person_links_person_id_idx ON public.user_person_links (person_id);
CREATE INDEX IF NOT EXISTS ndb11_student_document_pendency_events_enrollment_id_idx ON public.student_document_pendency_events (enrollment_id);
CREATE INDEX IF NOT EXISTS ndb11_institutional_class_schedule_slots_class_id_idx ON public.institutional_class_schedule_slots (class_id);
CREATE INDEX IF NOT EXISTS ndb11_institutional_class_schedule_slots_engagement_id_idx ON public.institutional_class_schedule_slots (engagement_id);
CREATE INDEX IF NOT EXISTS ndb11_statistical_map_versions_engagement_id_idx ON public.statistical_map_versions (engagement_id);
CREATE INDEX IF NOT EXISTS ndb11_statistical_map_versions_person_id_idx ON public.statistical_map_versions (person_id);
CREATE INDEX IF NOT EXISTS ndb11_institutional_visit_records_school_id_idx ON public.institutional_visit_records (school_id);
CREATE INDEX IF NOT EXISTS ndb11_statistical_map_events_person_id_idx ON public.statistical_map_events (person_id);
CREATE INDEX IF NOT EXISTS ndb11_professional_functional_events_school_id_idx ON public.professional_functional_events (school_id);
CREATE INDEX IF NOT EXISTS ndb11_class_schedule_block_engagements_engagement_id_idx ON public.class_schedule_block_engagements (engagement_id);
CREATE INDEX IF NOT EXISTS ndb11_professional_qualifications_person_id_idx ON public.professional_qualifications (person_id);
CREATE INDEX IF NOT EXISTS ndb11_professional_schedule_declarations_person_id_idx ON public.professional_schedule_declarations (person_id);
CREATE INDEX IF NOT EXISTS ndb11_professional_schedule_declarations_school_id_idx ON public.professional_schedule_declarations (school_id);
CREATE INDEX IF NOT EXISTS ndb11_professional_schedule_declarations_class_id_idx ON public.professional_schedule_declarations (class_id);
CREATE INDEX IF NOT EXISTS ndb11_meal_master_records_school_id_idx ON public.meal_master_records (school_id);
CREATE INDEX IF NOT EXISTS ndb11_meal_operational_records_school_id_idx ON public.meal_operational_records (school_id);
CREATE INDEX IF NOT EXISTS ndb11_statistical_map_cell_adjustments_person_id_idx ON public.statistical_map_cell_adjustments (person_id);

-- NDB.1.1: leitor em lote do cadastro da turma. INVOKER: reaproveita class_at
-- (mesma RLS, mesma regra bitemporal); só elimina N chamadas da tela.
CREATE OR REPLACE FUNCTION public.classes_at_batch(_class_ids text[], _valid_on date, _known_at timestamptz DEFAULT NULL)
RETURNS SETOF public.institutional_class_record_versions
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  SELECT v.* FROM (SELECT DISTINCT unnest(_class_ids) AS id) ids
  CROSS JOIN LATERAL public.class_at(ids.id, _valid_on, _known_at) v
  WHERE pg_catalog.cardinality(_class_ids) <= 2000
$$;
REVOKE ALL ON FUNCTION public.classes_at_batch(text[], date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classes_at_batch(text[], date, timestamptz) TO authenticated, service_role;