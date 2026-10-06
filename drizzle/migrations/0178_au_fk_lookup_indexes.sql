-- AU: índices de busca em colunas de FK lidas pelos readers (medido: seq scan 300–560 ms).
-- Só desempenho: nenhuma mudança de semântica, RLS, GRANT ou dado.
CREATE INDEX IF NOT EXISTS au_school_enrollments_school_idx ON public.school_enrollments (school_id);
CREATE INDEX IF NOT EXISTS au_school_enrollments_student_idx ON public.school_enrollments (student_id);
CREATE INDEX IF NOT EXISTS au_school_enrollments_year_idx ON public.school_enrollments (academic_year_id);
CREATE INDEX IF NOT EXISTS au_scbo_class_idx ON public.student_class_bond_observations (class_id);
CREATE INDEX IF NOT EXISTS au_scbo_school_idx ON public.student_class_bond_observations (school_id);
CREATE INDEX IF NOT EXISTS au_scbo_student_idx ON public.student_class_bond_observations (student_id);
CREATE INDEX IF NOT EXISTS au_scbo_enrollment_idx ON public.student_class_bond_observations (enrollment_id);
CREATE INDEX IF NOT EXISTS au_ssdo_student_idx ON public.student_school_day_observations (student_id);
CREATE INDEX IF NOT EXISTS au_ssdo_class_idx ON public.student_school_day_observations (class_id);
CREATE INDEX IF NOT EXISTS au_ssdo_school_idx ON public.student_school_day_observations (school_id);
CREATE INDEX IF NOT EXISTS au_ccd_class_idx ON public.class_census_declarations (class_id);
CREATE INDEX IF NOT EXISTS au_pcd_school_idx ON public.professional_census_declarations (school_id);
CREATE INDEX IF NOT EXISTS au_pcd_class_idx ON public.professional_census_declarations (class_id);
CREATE INDEX IF NOT EXISTS au_pcd_person_idx ON public.professional_census_declarations (person_id);
CREATE INDEX IF NOT EXISTS au_sio_attr_idx ON public.school_infrastructure_observations (attribute_version_id);
CREATE INDEX IF NOT EXISTS au_cpr_policy_idx ON public.capability_policy_rules (policy_id);
CREATE INDEX IF NOT EXISTS au_cvda_day_type_idx ON public.calendar_version_day_assignments (day_type_version_id);
