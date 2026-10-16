CREATE TABLE public.statistical_map_freezes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  year int NOT NULL CHECK (year BETWEEN 2000 AND 2200),
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  frozen_at timestamptz NOT NULL DEFAULT now(),
  frozen_by uuid NOT NULL,
  note text,
  UNIQUE (school_id, year, month)
);
GRANT SELECT ON public.statistical_map_freezes TO authenticated;
GRANT ALL ON public.statistical_map_freezes TO service_role;
ALTER TABLE public.statistical_map_freezes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consulta do mapa le congelamentos" ON public.statistical_map_freezes FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-mapa-estatistico', school_id));
CREATE OR REPLACE FUNCTION public.statistical_map_freezes_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'congelamento do mapa é permanente'; END $$;
CREATE TRIGGER statistical_map_freezes_no_change BEFORE UPDATE OR DELETE ON public.statistical_map_freezes
  FOR EACH ROW EXECUTE FUNCTION public.statistical_map_freezes_immutable();

CREATE OR REPLACE FUNCTION public.freeze_statistical_map(_school text, _year int, _month int, _note text DEFAULT NULL)
RETURNS public.statistical_map_freezes LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.statistical_map_freezes;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sessão obrigatória'; END IF;
  IF NOT public.has_school_capability('oficializar-mapa-estatistico', _school) THEN RAISE EXCEPTION 'sem capacidade para congelar o mapa desta escola'; END IF;
  SELECT * INTO r FROM public.statistical_map_freezes WHERE school_id = _school AND year = _year AND month = _month;
  IF FOUND THEN RETURN r; END IF;
  INSERT INTO public.statistical_map_freezes(school_id, year, month, frozen_by, note)
  VALUES (_school, _year, _month, auth.uid(), nullif(btrim(_note), '')) RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.freeze_statistical_map(text,int,int,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.freeze_statistical_map(text,int,int,text) TO authenticated;

-- Leitores com corte de conhecimento: só o que estava registrado até _known_at.
CREATE OR REPLACE FUNCTION public.map_live_classes_known(_school text, _on date, _known_at timestamptz)
RETURNS TABLE(class_id text, class_name text, stage_label text, shift_label text, students integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ok AS (SELECT public.has_school_capability('consultar-mapa-estatistico', _school) AS v),
  cls AS (
    SELECT c.id, c.stage_label_snapshot FROM institutional_classes c, ok
    WHERE ok.v AND c.school_id = _school AND c.valid_from <= _on AND (c.valid_until IS NULL OR c.valid_until >= _on)
  ),
  ep AS (
    SELECT e.class_id, e.student_id FROM class_enrollment_episodes e
    WHERE e.class_id IN (SELECT id FROM cls) AND e.valid_from <= _on AND e.created_at <= _known_at
      AND NOT EXISTS (SELECT 1 FROM class_enrollment_episodes w WHERE w.supersedes_id = e.id AND w.created_at <= _known_at)
      AND NOT EXISTS (SELECT 1 FROM class_enrollment_episode_endings x WHERE x.episode_id = e.id AND x.ended_on < _on AND x.created_at <= _known_at)
  )
  SELECT c.id,
    (SELECT r.name FROM public.class_at(c.id, _on) r ORDER BY r.version DESC LIMIT 1),
    c.stage_label_snapshot,
    (SELECT s.value_label FROM public.class_shift_at(c.id, _on) s ORDER BY s.version DESC LIMIT 1),
    (SELECT count(DISTINCT ep.student_id)::int FROM ep WHERE ep.class_id = c.id)
  FROM cls c;
$$;

-- Movimentações do intervalo registradas na janela (_after, _until].
CREATE OR REPLACE FUNCTION public.map_live_movements_known(_school text, _from date, _to date, _after timestamptz, _until timestamptz)
RETURNS TABLE(grp text, student_name text, census_id text, kind text, happened_on date, class_label text, recorded_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ok AS (SELECT public.has_school_capability('consultar-mapa-estatistico', _school) AS v),
  nm AS (
    SELECT DISTINCT ON (i.student_id) i.student_id, coalesce(nullif(i.social_name,''), i.civil_name) AS name
    FROM student_identity_versions i ORDER BY i.student_id, i.version DESC
  ),
  cid AS (
    SELECT sp.student_id, min(pi.value) AS v FROM institutional_student_persons sp
    JOIN institutional_person_identifiers pi ON pi.person_id = sp.person_id AND pi.identifier_kind = 'inep-pessoa'
    GROUP BY sp.student_id
  ),
  rows AS (
    SELECT 'A'::text g, se.student_id, 'Novo'::text k, se.opened_on d, NULL::text cl, se.created_at ca
    FROM school_enrollments se, ok WHERE ok.v AND se.school_id = _school AND se.opened_on BETWEEN _from AND _to
      AND NOT EXISTS (SELECT 1 FROM school_enrollments w WHERE w.supersedes_id = se.id)
    UNION ALL
    SELECT CASE WHEN x.reason_label ILIKE 'transfer%' THEN 'B' WHEN x.reason_label ILIKE ANY (ARRAY['%abandono%','%evas%']) THEN 'C'
                WHEN x.reason_label ILIKE 'remanej%' THEN 'R' ELSE 'D' END,
      e.student_id, x.reason_label, x.ended_on, e.class_label_snapshot, x.created_at
    FROM class_enrollment_episode_endings x JOIN class_enrollment_episodes e ON e.id = x.episode_id, ok
    WHERE ok.v AND e.school_id = _school AND x.ended_on BETWEEN _from AND _to
      AND x.reason_label NOT ILIKE 'movida para%'
  )
  SELECT r.g, nm.name, cid.v, r.k, r.d, r.cl, r.ca FROM rows r
  LEFT JOIN nm ON nm.student_id = r.student_id LEFT JOIN cid ON cid.student_id = r.student_id
  WHERE (_after IS NULL OR r.ca > _after) AND (_until IS NULL OR r.ca <= _until)
  ORDER BY r.g, nm.name;
$$;
REVOKE ALL ON FUNCTION public.map_live_classes_known(text,date,timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.map_live_movements_known(text,date,date,timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.map_live_classes_known(text,date,timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.map_live_movements_known(text,date,date,timestamptz,timestamptz) TO authenticated;