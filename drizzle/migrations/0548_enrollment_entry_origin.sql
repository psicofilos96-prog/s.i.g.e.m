-- Forma de ingresso na matrícula: aluno novo (primeira matrícula da vida) ou transferência recebida, com escola de origem.
CREATE TABLE public.school_enrollment_entry_origins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id text NOT NULL REFERENCES public.school_enrollments(id),
  entry_kind text NOT NULL CHECK (entry_kind IN ('aluno-novo','transferencia-recebida')),
  origin_kind text CHECK (origin_kind IN ('rede','privada','outra')),
  origin_school_inep text,
  origin_school_name text,
  recorded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((entry_kind = 'aluno-novo' AND origin_kind IS NULL AND origin_school_name IS NULL)
      OR (entry_kind = 'transferencia-recebida' AND origin_kind IS NOT NULL AND nullif(btrim(origin_school_name),'') IS NOT NULL))
);
CREATE INDEX ON public.school_enrollment_entry_origins(enrollment_id, created_at DESC);
GRANT SELECT ON public.school_enrollment_entry_origins TO authenticated;
GRANT ALL ON public.school_enrollment_entry_origins TO service_role;
ALTER TABLE public.school_enrollment_entry_origins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "le origem com acesso a escola" ON public.school_enrollment_entry_origins FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.id = enrollment_id
    AND (public.has_school_capability('manter-matricula-e-enturmacao', e.school_id) OR public.has_school_capability('consultar-mapa-estatistico', e.school_id))));
CREATE TRIGGER school_enrollment_entry_origins_no_change BEFORE UPDATE OR DELETE ON public.school_enrollment_entry_origins
  FOR EACH ROW EXECUTE FUNCTION public.statistical_map_freezes_immutable();

CREATE OR REPLACE FUNCTION public.record_enrollment_entry_origin(_enrollment text, _entry_kind text, _origin_kind text, _origin_inep text, _origin_name text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _school text; _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sessão obrigatória'; END IF;
  SELECT school_id INTO _school FROM public.school_enrollments WHERE id = _enrollment;
  IF _school IS NULL THEN RAISE EXCEPTION 'matrícula não encontrada'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'sem capacidade de matrícula nesta escola'; END IF;
  INSERT INTO public.school_enrollment_entry_origins(enrollment_id, entry_kind, origin_kind, origin_school_inep, origin_school_name, recorded_by)
  VALUES (_enrollment, _entry_kind,
    CASE WHEN _entry_kind = 'aluno-novo' THEN NULL ELSE _origin_kind END,
    CASE WHEN _entry_kind = 'aluno-novo' THEN NULL ELSE nullif(btrim(_origin_inep),'') END,
    CASE WHEN _entry_kind = 'aluno-novo' THEN NULL ELSE nullif(btrim(_origin_name),'') END, auth.uid())
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.record_enrollment_entry_origin(text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_enrollment_entry_origin(text,text,text,text,text) TO authenticated;

-- Mapa: grupo A informa a forma de ingresso registrada (sem registro = "Não informado").
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
  org AS (SELECT DISTINCT ON (enrollment_id) enrollment_id, entry_kind, origin_school_name FROM school_enrollment_entry_origins ORDER BY enrollment_id, created_at DESC),
  rows AS (
    SELECT 'A'::text g, se.student_id,
      CASE WHEN org.entry_kind = 'transferencia-recebida' THEN 'Transferência recebida — ' || org.origin_school_name
           WHEN org.entry_kind = 'aluno-novo' THEN 'Aluno novo' ELSE 'Não informado' END k,
      se.opened_on d, NULL::text cl, se.created_at ca
    FROM school_enrollments se LEFT JOIN org ON org.enrollment_id = se.id, ok
    WHERE ok.v AND se.school_id = _school AND se.opened_on BETWEEN _from AND _to
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