CREATE TABLE public.test_school_markers (
  school_id text PRIMARY KEY REFERENCES public.institutional_schools(id),
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.test_school_markers TO authenticated;
GRANT ALL ON public.test_school_markers TO service_role;
ALTER TABLE public.test_school_markers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "test markers readable" ON public.test_school_markers FOR SELECT TO authenticated USING (true);
COMMENT ON TABLE public.test_school_markers IS 'Escolas de teste por decisão do proprietário: ficam fora dos totais da rede.';

CREATE OR REPLACE FUNCTION public.census_map_2026_network()
 RETURNS TABLE(schools bigint, classes bigint, school_enrollments bigint, distinct_students bigint, bonds bigint, aee_bonds bigint, aee_students bigint, professionals bigint, infra_items bigint)
 LANGUAGE sql STABLE SET search_path TO ''
AS $function$
  with cls as (select c.id, c.school_id from public.institutional_classes c where c.academic_year_label = 'Ano letivo 2026'
               and not exists (select 1 from public.test_school_markers t where t.school_id = c.school_id)),
  aee as (select class_id from public.class_census_declarations where field = 'Tipo de turma' and value_text ilike '%AEE%'),
  ep as (select e.* from public.class_enrollment_episodes e join cls on cls.id = e.class_id
         where not exists (select 1 from public.class_enrollment_episodes n where n.supersedes_id = e.id)),
  en as (select s.* from public.school_enrollments s
         where not exists (select 1 from public.school_enrollments n where n.supersedes_id = s.id)
           and not exists (select 1 from public.test_school_markers t where t.school_id = s.school_id))
  select (select count(distinct school_id) from cls), (select count(*) from cls), (select count(*) from en),
    (select count(distinct student_id) from en), (select count(*) from ep),
    (select count(*) from ep where class_id in (select class_id from aee)),
    (select count(distinct student_id) from ep where class_id in (select class_id from aee)),
    (select count(distinct person_id) from public.professional_census_declarations p where not exists (select 1 from public.test_school_markers t where t.school_id = p.school_id)),
    (select count(*) from public.school_infrastructure_observations i where not exists (select 1 from public.test_school_markers t where t.school_id = i.school_id))
$function$;