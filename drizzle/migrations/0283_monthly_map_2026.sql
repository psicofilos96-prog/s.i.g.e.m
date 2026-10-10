-- Mapa Estatístico MENSAL 2026: chave escola + ano + mês (+ versão da apuração).
-- Leitura viva por data de referência; apuração congelada append-only por competência.
CREATE OR REPLACE FUNCTION public.monthly_map_2026_live(_month integer)
RETURNS TABLE(school_id text, inep text, school_name text, reference_date date, earliest_evidence date, status text,
  distinct_students bigint, school_enrollments bigint, undated_enrollments bigint, bonds bigint, regular_bonds bigint,
  aee_bonds bigint, aee_students bigint, aee_only_students bigint, classes_with_students bigint,
  entries_in_month bigint, exits_in_month bigint)
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
               (select min(x.ended_on) from public.class_enrollment_episode_endings x where x.episode_id = e.id) as ended_on
             from public.class_enrollment_episodes e join cls on cls.id = e.class_id
             where not exists (select 1 from public.class_enrollment_episodes n where n.supersedes_id = e.id)),
  ev as (select school_id, min(valid_from) as first_ev from ep_all group by school_id),
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
         when ev.first_ev is null or p.ref < ev.first_ev then 'nao-apurado'
         else 'apurado' end,
    x.ds, y.en_dated, y.en_undated, x.b, x.rb, x.ab, x.ast, x.aonly, x.cl,
    (select count(*) from ep_all a where a.school_id = s.id and a.valid_from between p.first_day and p.ref),
    (select count(*) from ep_all a where a.school_id = s.id and a.ended_on between p.first_day and p.ref)
  from public.institutional_schools s cross join p
  left join ev on ev.school_id = s.id
  left join lateral (
    select count(distinct ep.student_id) ds, count(*) b, count(*) filter (where not ep.is_aee) rb,
      count(*) filter (where ep.is_aee) ab, count(distinct ep.student_id) filter (where ep.is_aee) ast,
      count(distinct ep.student_id) filter (where ep.is_aee and not exists (
        select 1 from ep o where o.student_id = ep.student_id and o.school_id = s.id and not o.is_aee)) aonly,
      count(distinct ep.class_id) cl
    from ep where ep.school_id = s.id) x on true
  left join lateral (
    select count(*) filter (where en.opened_on is not null and en.opened_on <= p.ref
                              and (en.ended_on is null or en.ended_on > p.ref)) en_dated,
           count(*) filter (where en.opened_on is null) en_undated
    from en where en.school_id = s.id) y on true
  where exists (select 1 from cls where cls.school_id = s.id)
$$;
REVOKE ALL ON FUNCTION public.monthly_map_2026_live(integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.monthly_map_2026_live(integer) TO authenticated;

CREATE TABLE public.monthly_map_2026_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  map_year integer NOT NULL DEFAULT 2026 CHECK (map_year = 2026),
  map_month integer NOT NULL CHECK (map_month BETWEEN 1 AND 12),
  version integer NOT NULL,
  kind text NOT NULL CHECK (kind IN ('apuracao','revisao')),
  reference_date date NOT NULL,
  measures jsonb NOT NULL,
  digest text NOT NULL,
  reason text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, map_year, map_month, version),
  CHECK (kind = 'apuracao' OR length(coalesce(reason,'')) >= 10)
);
GRANT SELECT ON public.monthly_map_2026_closures TO authenticated;
GRANT ALL ON public.monthly_map_2026_closures TO service_role;
ALTER TABLE public.monthly_map_2026_closures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consulta por competência da escola" ON public.monthly_map_2026_closures FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-mapa-estatistico', school_id)
      OR public.has_school_capability('oficializar-mapa-estatistico', school_id));
CREATE TRIGGER monthly_map_2026_closures_append_only BEFORE UPDATE OR DELETE ON public.monthly_map_2026_closures
  FOR EACH ROW EXECUTE FUNCTION public.aa_ledger_append_only();

CREATE OR REPLACE FUNCTION public.record_monthly_map_2026(_school text, _month integer, _reason text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE _r record; _m jsonb; _v integer; _id uuid; _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'monthly-map: sessão ausente'; END IF;
  IF NOT public.has_school_capability('oficializar-mapa-estatistico', _school) THEN
    RAISE EXCEPTION 'monthly-map: capacidade oficializar-mapa-estatistico ausente na escola'; END IF;
  SELECT * INTO _r FROM public.monthly_map_2026_live(_month) l WHERE l.school_id = _school;
  IF NOT FOUND THEN RAISE EXCEPTION 'monthly-map: escola sem turmas 2026'; END IF;
  IF _r.status <> 'apurado' THEN RAISE EXCEPTION 'monthly-map: mês % não apurável (%)', _month, _r.status; END IF;
  SELECT coalesce(max(version), 0) INTO _v FROM public.monthly_map_2026_closures
    WHERE school_id = _school AND map_month = _month;
  IF _v > 0 AND length(coalesce(_reason,'')) < 10 THEN
    RAISE EXCEPTION 'monthly-map: revisão exige motivo (mín. 10 caracteres)'; END IF;
  _m := jsonb_build_object('distinct_students', _r.distinct_students, 'school_enrollments', _r.school_enrollments,
    'undated_enrollments', _r.undated_enrollments, 'bonds', _r.bonds, 'regular_bonds', _r.regular_bonds,
    'aee_bonds', _r.aee_bonds, 'aee_students', _r.aee_students, 'aee_only_students', _r.aee_only_students,
    'classes_with_students', _r.classes_with_students, 'entries_in_month', _r.entries_in_month,
    'exits_in_month', _r.exits_in_month, 'earliest_evidence', _r.earliest_evidence);
  INSERT INTO public.monthly_map_2026_closures(school_id, map_month, version, kind, reference_date, measures, digest, reason, recorded_by)
  VALUES (_school, _month, _v + 1, CASE WHEN _v = 0 THEN 'apuracao' ELSE 'revisao' END, _r.reference_date, _m,
    encode(extensions.digest(_m::text, 'sha256'), 'hex'), _reason, _uid)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.record_monthly_map_2026(text, integer, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_monthly_map_2026(text, integer, text) TO authenticated;