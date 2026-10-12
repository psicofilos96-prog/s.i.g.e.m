-- SIGEM Desenvolvimento L07: catálogo de cursos. Código estável por curso; conteúdo do catálogo é filho imutável da versão.
CREATE TABLE public.dev_course_codes (
  course_id uuid PRIMARY KEY REFERENCES public.dev_courses(id),
  code text NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9][A-Z0-9.\-]{1,29}$'),
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dev_course_catalog_contents (
  course_version_id uuid PRIMARY KEY REFERENCES public.dev_course_versions(id),
  syllabus text NOT NULL CHECK (length(btrim(syllabus)) BETWEEN 20 AND 4000),
  contents text[] NOT NULL CHECK (cardinality(contents) BETWEEN 1 AND 60),
  modality text NOT NULL CHECK (length(btrim(modality)) BETWEEN 3 AND 80),
  assessment text NOT NULL CHECK (length(btrim(assessment)) BETWEEN 10 AND 2000),
  completion_criteria text NOT NULL CHECK (length(btrim(completion_criteria)) BETWEEN 10 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dev_course_prerequisites (
  course_version_id uuid NOT NULL REFERENCES public.dev_course_versions(id),
  prerequisite_course_id uuid NOT NULL REFERENCES public.dev_courses(id),
  PRIMARY KEY (course_version_id, prerequisite_course_id)
);
GRANT SELECT ON public.dev_course_codes, public.dev_course_catalog_contents, public.dev_course_prerequisites TO authenticated;
GRANT ALL ON public.dev_course_codes, public.dev_course_catalog_contents, public.dev_course_prerequisites TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.dev_course_codes, public.dev_course_catalog_contents, public.dev_course_prerequisites FROM authenticated, anon;
ALTER TABLE public.dev_course_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_course_catalog_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_course_prerequisites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev course codes read" ON public.dev_course_codes FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev course catalog read" ON public.dev_course_catalog_contents FOR SELECT TO authenticated USING (true);
CREATE POLICY "dev course prereq read" ON public.dev_course_prerequisites FOR SELECT TO authenticated USING (true);
CREATE TRIGGER devcc_immutable BEFORE UPDATE OR DELETE ON public.dev_course_codes FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devccc_immutable BEFORE UPDATE OR DELETE ON public.dev_course_catalog_contents FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devcp_immutable BEFORE UPDATE OR DELETE ON public.dev_course_prerequisites FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Writer único do catálogo: nova versão (base esperada, motivo a partir da v2) + conteúdo + pré-requisitos numa transação.
CREATE OR REPLACE FUNCTION public.record_dev_catalog_course_version(
  _program uuid, _course uuid, _expected_version int, _code text, _title text, _minutes int, _min_pct numeric,
  _syllabus text, _contents text[], _modality text, _assessment text, _completion text, _prerequisites uuid[], _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _cid uuid; _existing text; _pre uuid; _clean text[];
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_course_versions WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('planejar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF _minutes IS NULL OR _minutes <= 0 THEN RAISE EXCEPTION 'dev:hours-required'; END IF;
  IF _min_pct IS NULL THEN RAISE EXCEPTION 'dev:attendance-required'; END IF;
  SELECT array_agg(btrim(c)) INTO _clean FROM unnest(coalesce(_contents, '{}'::text[])) c WHERE length(btrim(c)) > 0;
  IF _clean IS NULL THEN RAISE EXCEPTION 'dev:contents-required'; END IF;
  IF _course IS NOT NULL THEN
    SELECT code INTO _existing FROM public.dev_course_codes WHERE course_id = _course;
    IF _existing IS NOT NULL AND _existing <> upper(btrim(_code)) THEN RAISE EXCEPTION 'dev:code-immutable'; END IF;
  END IF;
  _id := public.record_dev_course_version(_program, _course, _expected_version, _title, _minutes, _min_pct, _reason, _key);
  SELECT course_id INTO _cid FROM public.dev_course_versions WHERE id = _id;
  IF _existing IS NULL THEN
    INSERT INTO public.dev_course_codes(course_id, code, author_person) VALUES (_cid, upper(btrim(_code)), _p);
  END IF;
  INSERT INTO public.dev_course_catalog_contents(course_version_id, syllabus, contents, modality, assessment, completion_criteria)
  VALUES (_id, btrim(_syllabus), _clean, btrim(_modality), btrim(_assessment), btrim(_completion));
  FOREACH _pre IN ARRAY coalesce(_prerequisites, '{}'::uuid[]) LOOP
    IF _pre = _cid THEN RAISE EXCEPTION 'dev:prerequisite-self'; END IF;
    -- recusa ciclo direto: o pré-requisito não pode exigir este curso na sua versão mais recente
    IF EXISTS (SELECT 1 FROM public.dev_course_prerequisites q JOIN public.dev_course_versions v ON v.id = q.course_version_id
               WHERE v.course_id = _pre AND q.prerequisite_course_id = _cid
                 AND v.version = (SELECT max(version) FROM public.dev_course_versions WHERE course_id = _pre)) THEN
      RAISE EXCEPTION 'dev:prerequisite-cycle'; END IF;
    INSERT INTO public.dev_course_prerequisites(course_version_id, prerequisite_course_id) VALUES (_id, _pre) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN _id;
EXCEPTION WHEN check_violation OR foreign_key_violation OR unique_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;
REVOKE EXECUTE ON FUNCTION public.record_dev_catalog_course_version(uuid,uuid,int,text,text,int,numeric,text,text[],text,text,text,uuid[],text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_dev_catalog_course_version(uuid,uuid,int,text,text,int,numeric,text,text[],text,text,text,uuid[],text,text) TO authenticated;

-- O writer sem catálogo (0431) deixa de ser porta de entrada: versão nova sem ementa não pode nascer.
REVOKE EXECUTE ON FUNCTION public.record_dev_course_version(uuid,uuid,int,text,int,numeric,text,text) FROM authenticated;
COMMENT ON FUNCTION public.record_dev_course_version(uuid,uuid,int,text,int,numeric,text,text) IS 'DEPRECATED for clients: use record_dev_catalog_course_version (L07)';