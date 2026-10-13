-- PERF.LOADING.4: mesma saída, agregação única em vez de 7 varreduras por turma.
CREATE OR REPLACE FUNCTION public.census_map_2026_classes()
 RETURNS TABLE(school_id text, class_id text, class_code text, class_name text, stage text, stage_group text, class_type text, mediation text, organization text, schedule_literal text, declared_students integer, bonds bigint, distinct_students bigint, is_aee boolean, professionals bigint)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with cls as (
    select c.id, c.school_id, c.code, c.name from public.institutional_classes c
    where c.academic_year_label = 'Ano letivo 2026'
  ), d as (
    select x.class_id,
      (array_agg(x.value_text) filter (where x.field = 'Etapa de ensino'))[1] etapa,
      (array_agg(x.value_text) filter (where x.field = 'Etapa Agregada'))[1] agregada,
      (array_agg(x.value_text) filter (where x.field = 'Tipo de turma'))[1] tipo,
      (array_agg(x.value_text) filter (where x.field = 'Tipo de mediação didático-pedagógica'))[1] mediacao,
      (array_agg(x.value_text) filter (where x.field = 'Formas de organização da turma'))[1] org,
      (array_agg(x.value_text) filter (where x.field = 'Dias da semana e horário de funcionamento'))[1] horario,
      (array_agg(x.value_text) filter (where x.field = 'Quantidade de Alunos (as)'))[1] qtd
    from public.class_census_declarations x
    where x.class_id in (select id from cls)
    group by x.class_id
  ), ep as (
    select e.class_id, count(*) bonds, count(distinct e.student_id) students
    from public.class_enrollment_episodes e
    where e.class_id in (select id from cls)
      and not exists (select 1 from public.class_enrollment_episodes n where n.supersedes_id = e.id)
    group by e.class_id
  ), pr as (
    select p.class_id, count(distinct p.person_id) n
    from public.professional_census_declarations p
    where p.class_id in (select id from cls)
    group by p.class_id
  )
  select c.school_id, c.id, c.code, c.name,
    d.etapa, d.agregada, d.tipo, d.mediacao, d.org, d.horario,
    case when d.qtd ~ '^[0-9]+$' then d.qtd::int end,
    coalesce(ep.bonds, 0), coalesce(ep.students, 0),
    coalesce(d.tipo ilike '%AEE%', false),
    coalesce(pr.n, 0)
  from cls c
  left join d on d.class_id = c.id
  left join ep on ep.class_id = c.id
  left join pr on pr.class_id = c.id
$function$;