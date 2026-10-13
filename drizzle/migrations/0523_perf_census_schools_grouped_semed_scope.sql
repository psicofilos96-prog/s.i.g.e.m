CREATE OR REPLACE FUNCTION public.census_map_2026_schools()
 RETURNS TABLE(school_id text, inep text, school_name text, classes bigint, school_enrollments bigint, distinct_students bigint, bonds bigint, aee_bonds bigint, aee_students bigint, aee_only_students bigint, teachers bigint, professionals bigint, infra_items bigint, infra_informed bigint, receipt_students integer, receipt_bonds integer, receipt_aee integer, receipt_classes integer, receipt_teachers integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with cls as (select c.id, c.school_id from public.institutional_classes c where c.academic_year_label = 'Ano letivo 2026'),
  aee as (select class_id from public.class_census_declarations where field = 'Tipo de turma' and value_text ilike '%AEE%'),
  ep as (select e.school_id, e.student_id,
                (e.class_id in (select class_id from aee)) as is_aee,
                (e.class_id not in (select class_id from aee)) as non_aee
         from public.class_enrollment_episodes e join cls on cls.id = e.class_id
         where not exists (select 1 from public.class_enrollment_episodes n where n.supersedes_id = e.id)),
  en as (select s.school_id, s.student_id from public.school_enrollments s
         where not exists (select 1 from public.school_enrollments n where n.supersedes_id = s.id)),
  cls_g as (select school_id, count(*) n from cls group by school_id),
  en_g as (select school_id, count(*) n, count(distinct student_id) d from en group by school_id),
  ep_g as (select school_id, count(*) bonds,
                  count(*) filter (where is_aee) aee_bonds,
                  count(distinct student_id) filter (where is_aee) aee_students
           from ep group by school_id),
  ep_only as (select school_id, count(*) n from (
                select school_id, student_id from ep group by school_id, student_id
                having bool_or(is_aee is true) and not coalesce(bool_or(non_aee is true), false)) x
              group by school_id),
  prof_g as (select p.school_id, count(distinct p.person_id) filter (where p.function_literal ilike 'docente%') t,
                    count(distinct p.person_id) n
             from public.professional_census_declarations p group by p.school_id),
  inf_g as (select o.school_id, count(*) n,
                   count(*) filter (where o.value_boolean is not null or o.value_integer is not null or o.value_decimal is not null or nullif(o.value_text,'') is not null or o.value_catalog is not null) i
            from public.school_infrastructure_observations o group by o.school_id),
  rec as (select distinct on (r.school_id) r.school_id, r.measures m from public.census_official_receipt_snapshots r
          where r.census_year = '2026' order by r.school_id, r.version desc)
  select s.id,
    (select i.value from public.institutional_school_identifiers i where i.school_id = s.id and i.identifier_kind ilike '%inep%' order by i.created_at desc limit 1),
    (select v.official_name from public.institutional_school_record_versions v where v.school_id = s.id order by v.version_number desc limit 1),
    coalesce(cls_g.n, 0), coalesce(en_g.n, 0), coalesce(en_g.d, 0),
    coalesce(ep_g.bonds, 0), coalesce(ep_g.aee_bonds, 0), coalesce(ep_g.aee_students, 0), coalesce(ep_only.n, 0),
    coalesce(prof_g.t, 0), coalesce(prof_g.n, 0), coalesce(inf_g.n, 0), coalesce(inf_g.i, 0),
    case when (rec.m->'alunos'->>'value') ~ '^[0-9]+$' then (rec.m->'alunos'->>'value')::int end,
    case when (rec.m->'matriculas_total'->>'value') ~ '^[0-9]+$' then (rec.m->'matriculas_total'->>'value')::int end,
    case when (rec.m->'matriculas_aee'->>'value') ~ '^[0-9]+$' then (rec.m->'matriculas_aee'->>'value')::int end,
    case when (rec.m->'turmas'->>'value') ~ '^[0-9]+$' then (rec.m->'turmas'->>'value')::int end,
    case when (rec.m->'profissionais_docentes'->>'value') ~ '^[0-9]+$' then (rec.m->'profissionais_docentes'->>'value')::int end
  from public.institutional_schools s
  left join cls_g on cls_g.school_id = s.id
  left join en_g on en_g.school_id = s.id
  left join ep_g on ep_g.school_id = s.id
  left join ep_only on ep_only.school_id = s.id
  left join prof_g on prof_g.school_id = s.id
  left join inf_g on inf_g.school_id = s.id
  left join rec on rec.school_id = s.id
$function$;

CREATE OR REPLACE FUNCTION public.semed_scope_schools()
 RETURNS TABLE(school_id text, can_fill boolean, can_review boolean, network boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  WITH n AS MATERIALIZED (SELECT public.semed_is_network() AS v),
  s AS MATERIALIZED (
    SELECT s.id, public.semed_can_fill(s.id) AS f, public.semed_can_review(s.id) AS r
    FROM public.institutional_schools s WHERE auth.uid() IS NOT NULL)
  SELECT s.id, s.f, s.r, n.v FROM s, n
  WHERE s.f OR s.r OR n.v OR public.has_school_capability('consultar-matricula-e-movimentacao', s.id)
$function$;