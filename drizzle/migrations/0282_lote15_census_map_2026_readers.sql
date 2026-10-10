-- LOTE 15: Mapa Censo 2026 — readers SECURITY INVOKER (RLS de quem consulta), somente leitura, 2026 apenas.
CREATE OR REPLACE FUNCTION public.census_map_2026_classes()
RETURNS TABLE(school_id text, class_id text, class_code text, class_name text, stage text, stage_group text, class_type text,
  mediation text, organization text, schedule_literal text, declared_students integer, bonds bigint, distinct_students bigint,
  is_aee boolean, professionals bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  with ep as (
    select e.* from public.class_enrollment_episodes e
    where not exists (select 1 from public.class_enrollment_episodes n where n.supersedes_id = e.id)
  ), d as (
    select x.class_id, x.field, x.value_text from public.class_census_declarations x
  )
  select c.school_id, c.id, c.code, c.name,
    (select value_text from d where d.class_id = c.id and d.field = 'Etapa de ensino' limit 1),
    (select value_text from d where d.class_id = c.id and d.field = 'Etapa Agregada' limit 1),
    (select value_text from d where d.class_id = c.id and d.field = 'Tipo de turma' limit 1),
    (select value_text from d where d.class_id = c.id and d.field = 'Tipo de mediação didático-pedagógica' limit 1),
    (select value_text from d where d.class_id = c.id and d.field = 'Formas de organização da turma' limit 1),
    (select value_text from d where d.class_id = c.id and d.field = 'Dias da semana e horário de funcionamento' limit 1),
    (select case when value_text ~ '^[0-9]+$' then value_text::int end from d where d.class_id = c.id and d.field = 'Quantidade de Alunos (as)' limit 1),
    (select count(*) from ep where ep.class_id = c.id),
    (select count(distinct ep.student_id) from ep where ep.class_id = c.id),
    coalesce((select value_text ilike '%AEE%' from d where d.class_id = c.id and d.field = 'Tipo de turma' limit 1), false),
    (select count(distinct p.person_id) from public.professional_census_declarations p where p.class_id = c.id)
  from public.institutional_classes c
  where c.academic_year_label = 'Ano letivo 2026'
$$;

CREATE OR REPLACE FUNCTION public.census_map_2026_schools()
RETURNS TABLE(school_id text, inep text, school_name text, classes bigint, school_enrollments bigint, distinct_students bigint,
  bonds bigint, aee_bonds bigint, aee_students bigint, aee_only_students bigint, teachers bigint, professionals bigint,
  infra_items bigint, infra_informed bigint, receipt_students integer, receipt_bonds integer, receipt_aee integer,
  receipt_classes integer, receipt_teachers integer)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  with cls as (select c.id, c.school_id from public.institutional_classes c where c.academic_year_label = 'Ano letivo 2026'),
  aee as (select class_id from public.class_census_declarations where field = 'Tipo de turma' and value_text ilike '%AEE%'),
  ep as (select e.* from public.class_enrollment_episodes e join cls on cls.id = e.class_id
         where not exists (select 1 from public.class_enrollment_episodes n where n.supersedes_id = e.id)),
  en as (select s.* from public.school_enrollments s
         where not exists (select 1 from public.school_enrollments n where n.supersedes_id = s.id)),
  rec as (select distinct on (r.school_id) r.school_id, r.measures m from public.census_official_receipt_snapshots r
          where r.census_year = '2026' order by r.school_id, r.version desc)
  select s.id,
    (select i.value from public.institutional_school_identifiers i where i.school_id = s.id and i.identifier_kind ilike '%inep%' order by i.created_at desc limit 1),
    (select v.official_name from public.institutional_school_record_versions v where v.school_id = s.id order by v.version_number desc limit 1),
    (select count(*) from cls where cls.school_id = s.id),
    (select count(*) from en where en.school_id = s.id),
    (select count(distinct en.student_id) from en where en.school_id = s.id),
    (select count(*) from ep where ep.school_id = s.id),
    (select count(*) from ep where ep.school_id = s.id and ep.class_id in (select class_id from aee)),
    (select count(distinct ep.student_id) from ep where ep.school_id = s.id and ep.class_id in (select class_id from aee)),
    (select count(distinct a.student_id) from ep a where a.school_id = s.id and a.class_id in (select class_id from aee)
       and not exists (select 1 from ep b where b.student_id = a.student_id and b.school_id = s.id and b.class_id not in (select class_id from aee))),
    (select count(distinct p.person_id) from public.professional_census_declarations p where p.school_id = s.id and p.function_literal ilike 'docente%'),
    (select count(distinct p.person_id) from public.professional_census_declarations p where p.school_id = s.id),
    (select count(*) from public.school_infrastructure_observations o where o.school_id = s.id),
    (select count(*) from public.school_infrastructure_observations o where o.school_id = s.id
       and (o.value_boolean is not null or o.value_integer is not null or o.value_decimal is not null or nullif(o.value_text,'') is not null or o.value_catalog is not null)),
    (select case when (rec.m->'alunos'->>'value') ~ '^[0-9]+$' then (rec.m->'alunos'->>'value')::int end from rec where rec.school_id = s.id),
    (select case when (rec.m->'matriculas_total'->>'value') ~ '^[0-9]+$' then (rec.m->'matriculas_total'->>'value')::int end from rec where rec.school_id = s.id),
    (select case when (rec.m->'matriculas_aee'->>'value') ~ '^[0-9]+$' then (rec.m->'matriculas_aee'->>'value')::int end from rec where rec.school_id = s.id),
    (select case when (rec.m->'turmas'->>'value') ~ '^[0-9]+$' then (rec.m->'turmas'->>'value')::int end from rec where rec.school_id = s.id),
    (select case when (rec.m->'profissionais_docentes'->>'value') ~ '^[0-9]+$' then (rec.m->'profissionais_docentes'->>'value')::int end from rec where rec.school_id = s.id)
  from public.institutional_schools s
$$;

CREATE OR REPLACE FUNCTION public.census_map_2026_network()
RETURNS TABLE(schools bigint, classes bigint, school_enrollments bigint, distinct_students bigint, bonds bigint,
  aee_bonds bigint, aee_students bigint, professionals bigint, infra_items bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  with cls as (select c.id, c.school_id from public.institutional_classes c where c.academic_year_label = 'Ano letivo 2026'),
  aee as (select class_id from public.class_census_declarations where field = 'Tipo de turma' and value_text ilike '%AEE%'),
  ep as (select e.* from public.class_enrollment_episodes e join cls on cls.id = e.class_id
         where not exists (select 1 from public.class_enrollment_episodes n where n.supersedes_id = e.id)),
  en as (select s.* from public.school_enrollments s
         where not exists (select 1 from public.school_enrollments n where n.supersedes_id = s.id))
  select (select count(distinct school_id) from cls), (select count(*) from cls), (select count(*) from en),
    (select count(distinct student_id) from en), (select count(*) from ep),
    (select count(*) from ep where class_id in (select class_id from aee)),
    (select count(distinct student_id) from ep where class_id in (select class_id from aee)),
    (select count(distinct person_id) from public.professional_census_declarations),
    (select count(*) from public.school_infrastructure_observations)
$$;

REVOKE ALL ON FUNCTION public.census_map_2026_classes() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.census_map_2026_schools() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.census_map_2026_network() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.census_map_2026_classes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.census_map_2026_schools() TO authenticated;
GRANT EXECUTE ON FUNCTION public.census_map_2026_network() TO authenticated;