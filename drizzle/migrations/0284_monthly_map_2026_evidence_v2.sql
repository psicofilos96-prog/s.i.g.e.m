-- Correção final do Mapa mensal 2026: fotografia (carga técnica) não é evidência datada de movimento.
-- Mês cuja composição depende de fotografia ⇒ 'estimativa-parcial'; sem vínculo vigente ⇒ 'nao-apurado';
-- mês não encerrado ⇒ 'mes-nao-encerrado' (provisório, nunca congelável).
CREATE OR REPLACE FUNCTION public.monthly_map_2026_live_v2(_month integer)
RETURNS TABLE(school_id text, inep text, school_name text, reference_date date, earliest_evidence date, status text,
  distinct_students bigint, school_enrollments bigint, undated_enrollments bigint, bonds bigint, regular_bonds bigint,
  aee_bonds bigint, aee_students bigint, aee_only_students bigint, classes_with_students bigint,
  entries_in_month bigint, exits_in_month bigint,
  snapshot_bonds bigint, dated_bonds bigint, snapshot_date date, coverage_pct numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = ''
AS $$
  with p as (
    select (make_date(2026, _month, 1) + interval '1 month' - interval '1 day')::date as ref,
           make_date(2026, _month, 1) as first_day
    where _month between 1 and 12
  ),
  cls as (select c.id, c.school_id from public.institutional_classes c where c.academic_year_label = 'Ano letivo 2026'),
  aee as (select class_id from public.class_census_declarations where field = 'Tipo de turma' and value_text ilike '%AEE%'),
  ep_all as (select e.id, e.school_id, e.student_id, e.class_id, e.valid_from,
               coalesce(e.originating_act_ref, '') like 'technical-operation:%' as is_snapshot,
               (select min(x.ended_on) from public.class_enrollment_episode_endings x where x.episode_id = e.id) as ended_on
             from public.class_enrollment_episodes e join cls on cls.id = e.class_id
             where not exists (select 1 from public.class_enrollment_episodes n where n.supersedes_id = e.id)),
  ev as (select school_id, min(valid_from) as first_ev, max(valid_from) filter (where is_snapshot) as snap from ep_all group by school_id),
  ep as (select a.*, (a.class_id in (select class_id from aee)) as is_aee from ep_all a, p
         where a.valid_from <= p.ref and (a.ended_on is null or a.ended_on > p.ref)),
  en as (select s.id, s.school_id, s.opened_on,
           (select min(x.ended_on) from public.school_enrollment_endings x where x.enrollment_id = s.id) as ended_on
         from public.school_enrollments s
         where not exists (select 1 from public.school_enrollments n where n.supersedes_id = s.id))
  select s.id,
    (select i.value from public.institutional_school_identifiers i where i.school_id = s.id and i.identifier_kind ilike '%inep%' order by i.created_at desc limit 1),
    (select v.official_name from public.institutional_school_record_versions v where v.school_id = s.id order by v.version_number desc limit 1),
    p.ref, ev.first_ev,
    case when p.ref >= current_date then 'mes-nao-encerrado'
         when coalesce(x.b, 0) = 0 then 'nao-apurado'
         when x.snap_b > 0 then 'estimativa-parcial'
         else 'apurado' end,
    x.ds, y.en_dated, y.en_undated, x.b, x.rb, x.ab, x.ast, x.aonly, x.cl,
    (select count(*) from ep_all a where a.school_id = s.id and not a.is_snapshot and a.valid_from between p.first_day and p.ref),
    (select count(*) from ep_all a where a.school_id = s.id and a.ended_on between p.first_day and p.ref),
    x.snap_b, x.b - x.snap_b, ev.snap,
    case when coalesce(x.b, 0) = 0 then null else round(100.0 * (x.b - x.snap_b) / x.b, 1) end
  from public.institutional_schools s cross join p
  left join ev on ev.school_id = s.id
  left join lateral (
    select count(distinct ep.student_id) ds, count(*) b, count(*) filter (where not ep.is_aee) rb,
      count(*) filter (where ep.is_aee) ab, count(distinct ep.student_id) filter (where ep.is_aee) ast,
      count(distinct ep.student_id) filter (where ep.is_aee and not exists (
        select 1 from ep o where o.student_id = ep.student_id and o.school_id = s.id and not o.is_aee)) aonly,
      count(distinct ep.class_id) cl, count(*) filter (where ep.is_snapshot) snap_b
    from ep where ep.school_id = s.id) x on true
  left join lateral (
    select count(*) filter (where en.opened_on is not null and en.opened_on <= p.ref
                              and (en.ended_on is null or en.ended_on > p.ref)) en_dated,
           count(*) filter (where en.opened_on is null) en_undated
    from en where en.school_id = s.id) y on true
  where exists (select 1 from cls where cls.school_id = s.id)
$$;
REVOKE ALL ON FUNCTION public.monthly_map_2026_live_v2(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.monthly_map_2026_live_v2(integer) TO authenticated;
COMMENT ON FUNCTION public.monthly_map_2026_live(integer) IS 'DEPRECATED: replaced by monthly_map_2026_live_v2 (fotografia não é evidência datada)';

-- Writer: só mês encerrado, só 'apurado' por evidência datada, sempre com justificativa; revisão = nova versão.
CREATE OR REPLACE FUNCTION public.record_monthly_map_2026(_school text, _month integer, _reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE _r record; _m jsonb; _v integer; _id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'monthly-map: sessão ausente'; END IF;
  IF NOT public.has_school_capability('oficializar-mapa-estatistico', _school) THEN
    RAISE EXCEPTION 'monthly-map: capacidade oficializar-mapa-estatistico ausente na escola'; END IF;
  IF length(coalesce(btrim(_reason),'')) < 10 THEN
    RAISE EXCEPTION 'monthly-map: apuração e revisão exigem justificativa (mín. 10 caracteres)'; END IF;
  SELECT * INTO _r FROM public.monthly_map_2026_live_v2(_month) l WHERE l.school_id = _school;
  IF NOT FOUND THEN RAISE EXCEPTION 'monthly-map: escola sem turmas 2026'; END IF;
  IF _r.reference_date >= current_date THEN RAISE EXCEPTION 'monthly-map: mês % não encerrado — provisório, não congelável', _month; END IF;
  IF _r.status <> 'apurado' THEN RAISE EXCEPTION 'monthly-map: mês % sem evidência datada suficiente (%)', _month, _r.status; END IF;
  SELECT coalesce(max(version), 0) INTO _v FROM public.monthly_map_2026_closures
    WHERE school_id = _school AND map_month = _month;
  _m := jsonb_build_object('distinct_students', _r.distinct_students, 'school_enrollments', _r.school_enrollments,
    'undated_enrollments', _r.undated_enrollments, 'bonds', _r.bonds, 'regular_bonds', _r.regular_bonds,
    'aee_bonds', _r.aee_bonds, 'aee_students', _r.aee_students, 'aee_only_students', _r.aee_only_students,
    'classes_with_students', _r.classes_with_students, 'entries_in_month', _r.entries_in_month,
    'exits_in_month', _r.exits_in_month, 'earliest_evidence', _r.earliest_evidence, 'coverage_pct', _r.coverage_pct);
  INSERT INTO public.monthly_map_2026_closures(school_id, map_month, version, kind, reference_date, measures, digest, reason, recorded_by)
  VALUES (_school, _month, _v + 1, CASE WHEN _v = 0 THEN 'apuracao' ELSE 'revisao' END, _r.reference_date, _m,
    encode(extensions.digest(_m::text, 'sha256'), 'hex'), btrim(_reason), _uid)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.record_monthly_map_2026(text, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_monthly_map_2026(text, integer, text) TO authenticated;