-- N5.3 — Vagas e Livro de Matrícula como LEITURAS da cadeia canônica (nenhuma tabela nova, nenhuma segunda fonte).
-- Capacidade só existe se houver UM registro vigente não anulado; ausência nunca vira zero.

CREATE OR REPLACE FUNCTION public.sec_class_capacity_on(_class text, _on date)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT CASE WHEN count(*) = 1 THEN max(k.reference_limit) END FROM public.class_capacity_at(_class, _on, NULL) k WHERE NOT k.annulled
$$;
CREATE OR REPLACE FUNCTION public.sec_class_occupancy_on(_class text, _on date)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT count(*)::integer FROM public.class_enrollment_episodes p
   WHERE p.class_id = _class AND p.valid_from <= _on AND public.af_episode_current(p.id)
     AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = p.id AND y.ended_on <= _on)
$$;
REVOKE ALL ON FUNCTION public.sec_class_capacity_on(text, date) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.sec_class_occupancy_on(text, date) FROM PUBLIC, anon, authenticated, service_role;

-- Painel de vagas: leitura com capability de consulta da própria escola (Direção lê; ninguém escreve por aqui).
CREATE OR REPLACE FUNCTION public.secretariat_class_vacancies_at(_school text, _year text, _on date)
RETURNS TABLE(class_id text, name text, shift_label text, capacity integer, occupancy integer, available integer, vacancy_state text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_school_capability('consultar-matricula-e-movimentacao', _school) THEN RAISE EXCEPTION 'secretariat:not-authorized'; END IF;
  RETURN QUERY
  SELECT q.id, q.nm, q.sh, q.cap, q.occ,
    CASE WHEN q.cap IS NULL THEN NULL ELSE greatest(q.cap - q.occ, 0) END,
    CASE WHEN q.cap IS NULL THEN 'capacidade-nao-informada' WHEN q.occ >= q.cap THEN 'lotada' ELSE 'ha-vaga' END
  FROM (
    SELECT c.id, r.name AS nm,
      (SELECT sh.value_label FROM public.class_shift_at(c.id, _on, NULL) sh LIMIT 1) AS sh,
      public.sec_class_capacity_on(c.id, _on) AS cap, public.sec_class_occupancy_on(c.id, _on) AS occ
    FROM public.institutional_classes c
    CROSS JOIN LATERAL (SELECT a.name, a.administrative_status FROM public.class_at(c.id, _on, NULL) a LIMIT 1) r
    WHERE c.school_id = _school AND c.academic_year_id = _year AND r.administrative_status = 'ativa'
  ) q ORDER BY q.nm;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_class_vacancies_at(text, text, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_class_vacancies_at(text, text, date) TO authenticated;

-- Enturmação: mesma fonte de capacidade; lotada bloqueia, capacidade não informada não bloqueia. Lock por turma serializa concorrência.
CREATE OR REPLACE FUNCTION public.sec_allocate_core(_enrollment text, _class text, _valid_from date, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE e record; c record; yv record; nid text; cap integer;
BEGIN
  SELECT * INTO e FROM public.school_enrollments WHERE id = _enrollment;
  IF e.id IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', e.school_id) THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
  IF NOT public.af_enrollment_current(e.id) THEN RAISE EXCEPTION 'base-superseded'; END IF;
  IF NOT public.s_year_open_for_operation(e.academic_year_id) THEN RAISE EXCEPTION 'secretariat:year-not-open'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'secretariat:date-required'; END IF;
  IF e.opened_on IS NULL THEN RAISE EXCEPTION 'secretariat:enrollment-start-unknown'; END IF;
  IF _valid_from < e.opened_on THEN RAISE EXCEPTION 'secretariat:before-enrollment'; END IF;
  SELECT v.starts_on, v.ends_on INTO yv FROM public.institutional_academic_year_versions v WHERE v.academic_year_id = e.academic_year_id ORDER BY v.version DESC LIMIT 1;
  IF yv.starts_on IS NOT NULL AND (_valid_from < yv.starts_on OR _valid_from > yv.ends_on) THEN RAISE EXCEPTION 'secretariat:outside-year'; END IF;
  IF EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = e.id) THEN RAISE EXCEPTION 'secretariat:enrollment-ended'; END IF;
  SELECT * INTO c FROM public.institutional_classes WHERE id = _class;
  IF c.id IS NULL OR c.school_id <> e.school_id OR c.academic_year_id IS DISTINCT FROM e.academic_year_id THEN RAISE EXCEPTION 'secretariat:class-invalid'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_at(c.id, _valid_from, NULL) a WHERE a.administrative_status = 'ativa') THEN RAISE EXCEPTION 'secretariat:class-not-active-on-date'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('af-alloc:' || e.id));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('af-class-cap:' || c.id));
  IF EXISTS (SELECT 1 FROM public.class_enrollment_episodes p WHERE p.enrollment_id = e.id AND public.af_episode_current(p.id)
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = p.id)) THEN
    RAISE EXCEPTION 'secretariat:active-class-exists'; END IF;
  cap := public.sec_class_capacity_on(c.id, _valid_from);
  IF cap IS NOT NULL AND public.sec_class_occupancy_on(c.id, _valid_from) >= cap THEN RAISE EXCEPTION 'secretariat:class-full'; END IF;
  nid := 'enturm-' || pg_catalog.gen_random_uuid();
  INSERT INTO public.class_enrollment_episodes(id, enrollment_id, student_id, school_id, class_id, class_label_snapshot, cycle_id, valid_from,
    originating_act_ref, recorded_by, logical_id)
  VALUES (nid, e.id, e.student_id, e.school_id, c.id, c.name, e.cycle_id, _valid_from, nullif(pg_catalog.btrim(coalesce(_reason,'')), ''), auth.uid(), nid);
  RETURN nid;
END $fn$;
REVOKE ALL ON FUNCTION public.sec_allocate_core(text, text, date, text) FROM PUBLIC, anon, authenticated, service_role;

-- Livro de Matrícula: projeção reproduzível das matrículas vigentes da escola/ano conhecidas até _known_at.
-- Sem número oficial (NUMERAÇÃO_OFICIAL_PENDENTE): a ordem é cronológica de registro e não é numeração jurídica.
CREATE OR REPLACE FUNCTION public.secretariat_enrollment_book_at(_school text, _year text, _known_at timestamptz)
RETURNS TABLE(entry_order integer, enrollment_id text, student_name text, institutional_number text, opened_on date,
  class_label text, situation text, ended_on date, end_reason text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE k timestamptz := coalesce(_known_at, pg_catalog.now());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_school_capability('consultar-matricula-e-movimentacao', _school) THEN RAISE EXCEPTION 'secretariat:not-authorized'; END IF;
  RETURN QUERY
  WITH en AS (
    SELECT e.* FROM public.school_enrollments e
     WHERE e.school_id = _school AND e.academic_year_id = _year AND e.created_at <= k
       AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s WHERE s.supersedes_id = e.id AND s.created_at <= k)
  )
  SELECT (row_number() OVER (ORDER BY en.opened_on NULLS LAST, en.created_at, en.id))::integer,
    en.id,
    (SELECT coalesce(nullif(v.social_name,''), v.civil_name) FROM public.student_identity_versions v
      WHERE v.student_id = en.student_id AND v.created_at <= k ORDER BY v.version DESC LIMIT 1),
    en.institutional_number, en.opened_on,
    (SELECT p.class_label_snapshot FROM public.class_enrollment_episodes p
      WHERE p.enrollment_id = en.id AND p.created_at <= k
        AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes q WHERE q.supersedes_id = p.id AND q.created_at <= k)
      ORDER BY p.valid_from DESC, p.created_at DESC LIMIT 1),
    CASE WHEN x.enrollment_id IS NULL THEN 'ativa' ELSE 'encerrada' END,
    x.ended_on, x.reason_text, en.created_at
  FROM en LEFT JOIN LATERAL (SELECT * FROM public.school_enrollment_endings z WHERE z.enrollment_id = en.id AND z.created_at <= k ORDER BY z.created_at DESC LIMIT 1) x ON true
  ORDER BY 1;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_enrollment_book_at(text, text, timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_enrollment_book_at(text, text, timestamptz) TO authenticated;