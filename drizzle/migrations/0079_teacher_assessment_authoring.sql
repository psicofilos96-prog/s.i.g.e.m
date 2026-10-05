CREATE TABLE public.assessment_item_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id text NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.assessment_item_versions(id),
  item_type_id text NOT NULL CHECK (item_type_id ~ '^[a-z0-9-]{1,60}$'),
  stem text NOT NULL CHECK (length(btrim(stem)) BETWEEN 1 AND 20000),
  options jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(options) = 'array'),
  curricular_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(curricular_refs) = 'array'),
  school_id text NOT NULL,
  visibility text NOT NULL CHECK (visibility IN ('pessoal','compartilhado')),
  status text NOT NULL CHECK (status IN ('rascunho','publicado')),
  key_shared boolean NOT NULL DEFAULT false,
  copied_from_version_id uuid REFERENCES public.assessment_item_versions(id),
  author_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, version),
  CHECK ((version = 1) = (supersedes_id IS NULL))
);
CREATE UNIQUE INDEX assessment_item_one_successor ON public.assessment_item_versions(supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX assessment_item_by_school ON public.assessment_item_versions(school_id, visibility, status);

-- Gabarito/critério em tabela separada: nunca vai junto do enunciado.
CREATE TABLE public.assessment_item_keys (
  item_version_id uuid PRIMARY KEY REFERENCES public.assessment_item_versions(id),
  answer jsonb NOT NULL,
  criteria text CHECK (criteria IS NULL OR length(criteria) <= 20000),
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.teacher_instrument_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id text NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.teacher_instrument_versions(id),
  assignment_id text NOT NULL REFERENCES public.teaching_assignments(id),
  class_id text NOT NULL,
  school_id text NOT NULL,
  period_id text,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  instructions text CHECK (instructions IS NULL OR length(instructions) <= 10000),
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  randomization jsonb,
  status text NOT NULL CHECK (status IN ('rascunho','publicado')),
  results_instrument_id text,
  author_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instrument_id, version),
  CHECK ((version = 1) = (supersedes_id IS NULL))
);
CREATE UNIQUE INDEX teacher_instrument_one_successor ON public.teacher_instrument_versions(supersedes_id) WHERE supersedes_id IS NOT NULL;

CREATE TABLE public.assessment_item_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id text NOT NULL,
  object_path text NOT NULL UNIQUE,
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 160),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  mime text NOT NULL CHECK (mime IN ('image/png','image/jpeg','image/webp','application/pdf')),
  author_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.assessment_item_versions, public.assessment_item_keys, public.teacher_instrument_versions, public.assessment_item_media TO authenticated;
GRANT ALL ON public.assessment_item_versions, public.assessment_item_keys, public.teacher_instrument_versions, public.assessment_item_media TO service_role;
ALTER TABLE public.assessment_item_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_item_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_instrument_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_item_media ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER assessment_item_versions_immutable BEFORE UPDATE OR DELETE ON public.assessment_item_versions FOR EACH ROW EXECUTE FUNCTION public.teaching_plan_immutable();
CREATE TRIGGER assessment_item_keys_immutable BEFORE UPDATE OR DELETE ON public.assessment_item_keys FOR EACH ROW EXECUTE FUNCTION public.teaching_plan_immutable();
CREATE TRIGGER teacher_instrument_versions_immutable BEFORE UPDATE OR DELETE ON public.teacher_instrument_versions FOR EACH ROW EXECUTE FUNCTION public.teaching_plan_immutable();
CREATE TRIGGER assessment_item_media_immutable BEFORE UPDATE OR DELETE ON public.assessment_item_media FOR EACH ROW EXECUTE FUNCTION public.teaching_plan_immutable();

CREATE OR REPLACE FUNCTION public.can_read_assessment_item(_author uuid, _status text, _visibility text, _school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT _author = auth.uid()
      OR (_status = 'publicado' AND _visibility = 'compartilhado' AND public.has_school_capability('consultar-banco-de-itens', _school))
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_assessment_item(uuid, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_assessment_item(uuid, text, text, text) TO authenticated;

CREATE POLICY "items by author or shared bank capability" ON public.assessment_item_versions FOR SELECT TO authenticated
  USING (public.can_read_assessment_item(author_user_id, status, visibility, school_id));
-- Gabarito: só o autor, ou item compartilhado com gabarito explicitamente compartilhado.
CREATE POLICY "keys by author or explicitly shared" ON public.assessment_item_keys FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.assessment_item_versions v WHERE v.id = item_version_id
    AND (v.author_user_id = auth.uid() OR (v.key_shared AND public.can_read_assessment_item(v.author_user_id, v.status, v.visibility, v.school_id)))));
CREATE POLICY "instruments by author or published+capability" ON public.teacher_instrument_versions FOR SELECT TO authenticated
  USING (author_user_id = auth.uid() OR (status = 'publicado' AND public.has_school_capability('consultar-instrumento-docente', school_id)));
CREATE POLICY "media by author" ON public.assessment_item_media FOR SELECT TO authenticated USING (author_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.record_assessment_item_version(
  _item_id text, _expected_head uuid, _item_type_id text, _stem text, _options jsonb, _curricular_refs jsonb,
  _school_id text, _visibility text, _status text, _key_shared boolean, _answer jsonb, _criteria text, _copied_from uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE head record; v int := 1; new_item text := _item_id; new_id uuid; r jsonb; o jsonb; src record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'item:no-session'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.my_teaching_assignments_at(current_date, now()) t JOIN public.institutional_classes c ON c.id = t.class_id WHERE c.school_id = _school_id)
    THEN RAISE EXCEPTION 'item:no-current-assignment-in-school'; END IF;
  IF jsonb_typeof(coalesce(_options,'[]')) <> 'array' OR jsonb_array_length(coalesce(_options,'[]')) > 26 THEN RAISE EXCEPTION 'item:invalid-options'; END IF;
  FOR o IN SELECT * FROM jsonb_array_elements(coalesce(_options,'[]')) LOOP
    IF jsonb_typeof(o) <> 'object' OR coalesce(o->>'key','') !~ '^[A-Za-z0-9]{1,4}$' OR length(coalesce(o->>'text','')) NOT BETWEEN 1 AND 4000 THEN RAISE EXCEPTION 'item:invalid-options'; END IF;
  END LOOP;
  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(_curricular_refs,'[]')) LOOP
    IF r->>'kind' <> 'reference-item' OR NOT EXISTS (SELECT 1 FROM public.curricular_reference_items i WHERE i.id::text = r->>'item_id') THEN RAISE EXCEPTION 'item:reference-item-unknown'; END IF;
  END LOOP;
  IF _visibility NOT IN ('pessoal','compartilhado') OR _status NOT IN ('rascunho','publicado') THEN RAISE EXCEPTION 'item:invalid-status'; END IF;
  IF _copied_from IS NOT NULL THEN
    SELECT * INTO src FROM public.assessment_item_versions s WHERE s.id = _copied_from;
    IF src IS NULL OR NOT public.can_read_assessment_item(src.author_user_id, src.status, src.visibility, src.school_id) THEN RAISE EXCEPTION 'item:copy-source-not-readable'; END IF;
  END IF;
  IF _expected_head IS NULL THEN
    IF new_item IS NULL THEN new_item := 'itm-' || gen_random_uuid(); END IF;
    IF EXISTS (SELECT 1 FROM public.assessment_item_versions WHERE item_id = new_item) THEN RAISE EXCEPTION 'item:stale-head'; END IF;
  ELSE
    IF _copied_from IS NOT NULL THEN RAISE EXCEPTION 'item:copy-only-on-new'; END IF;
    SELECT * INTO head FROM public.assessment_item_versions WHERE item_id = _item_id ORDER BY version DESC LIMIT 1 FOR UPDATE;
    IF head IS NULL OR head.id <> _expected_head THEN RAISE EXCEPTION 'item:stale-head'; END IF;
    IF head.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'item:not-author'; END IF;
    v := head.version + 1;
  END IF;
  INSERT INTO public.assessment_item_versions(item_id, version, supersedes_id, item_type_id, stem, options, curricular_refs, school_id, visibility, status, key_shared, copied_from_version_id, author_user_id)
    VALUES (new_item, v, _expected_head, _item_type_id, btrim(_stem), coalesce(_options,'[]'), coalesce(_curricular_refs,'[]'), _school_id, _visibility, _status, coalesce(_key_shared,false), _copied_from, auth.uid())
    RETURNING id INTO new_id;
  IF _answer IS NOT NULL OR _criteria IS NOT NULL THEN
    INSERT INTO public.assessment_item_keys(item_version_id, answer, criteria) VALUES (new_id, coalesce(_answer,'null'::jsonb), nullif(btrim(_criteria),''));
  END IF;
  RETURN new_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_assessment_item_version(text, uuid, text, text, jsonb, jsonb, text, text, text, boolean, jsonb, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_assessment_item_version(text, uuid, text, text, jsonb, jsonb, text, text, text, boolean, jsonb, text, uuid) TO authenticated;

-- Instrumento: itens fixados por versão publicada legível; publicado é congelado (sem sucessora).
CREATE OR REPLACE FUNCTION public.record_teacher_instrument_version(
  _instrument_id text, _expected_head uuid, _assignment_id text, _period_id text, _title text, _instructions text,
  _items jsonb, _randomization jsonb, _status text, _results_instrument_id text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a record; head record; v int := 1; new_ins text := _instrument_id; new_id uuid; school text; it jsonb; iv record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'item:no-session'; END IF;
  SELECT * INTO a FROM public.my_teaching_assignments_at(current_date, now()) t WHERE t.assignment_id = _assignment_id LIMIT 1;
  IF a IS NULL THEN RAISE EXCEPTION 'instrument:assignment-not-current'; END IF;
  SELECT c.school_id INTO school FROM public.institutional_classes c WHERE c.id = a.class_id;
  IF _status NOT IN ('rascunho','publicado') THEN RAISE EXCEPTION 'item:invalid-status'; END IF;
  IF jsonb_typeof(coalesce(_items,'[]')) <> 'array' OR jsonb_array_length(coalesce(_items,'[]')) > 200 THEN RAISE EXCEPTION 'instrument:invalid-items'; END IF;
  IF _status = 'publicado' AND jsonb_array_length(coalesce(_items,'[]')) = 0 THEN RAISE EXCEPTION 'instrument:empty'; END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(_items,'[]')) LOOP
    SELECT * INTO iv FROM public.assessment_item_versions x WHERE x.id::text = it->>'item_version_id';
    IF iv IS NULL OR NOT public.can_read_assessment_item(iv.author_user_id, iv.status, iv.visibility, iv.school_id) THEN RAISE EXCEPTION 'instrument:item-not-readable'; END IF;
    IF iv.status <> 'publicado' THEN RAISE EXCEPTION 'instrument:item-not-published'; END IF;
  END LOOP;
  IF _randomization IS NOT NULL AND (jsonb_typeof(_randomization) <> 'object' OR coalesce(_randomization->>'seed','') = '') THEN RAISE EXCEPTION 'instrument:invalid-randomization'; END IF;
  IF _results_instrument_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.assessment_instruments r WHERE r.id = _results_instrument_id AND r.class_id = a.class_id)
    THEN RAISE EXCEPTION 'instrument:results-instrument-mismatch'; END IF;
  IF _expected_head IS NULL THEN
    IF new_ins IS NULL THEN new_ins := 'tin-' || gen_random_uuid(); END IF;
    IF EXISTS (SELECT 1 FROM public.teacher_instrument_versions WHERE instrument_id = new_ins) THEN RAISE EXCEPTION 'item:stale-head'; END IF;
  ELSE
    SELECT * INTO head FROM public.teacher_instrument_versions WHERE instrument_id = _instrument_id ORDER BY version DESC LIMIT 1 FOR UPDATE;
    IF head IS NULL OR head.id <> _expected_head THEN RAISE EXCEPTION 'item:stale-head'; END IF;
    IF head.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'item:not-author'; END IF;
    IF head.status = 'publicado' THEN RAISE EXCEPTION 'instrument:published-frozen'; END IF;
    IF head.assignment_id <> _assignment_id THEN RAISE EXCEPTION 'instrument:assignment-immutable'; END IF;
    v := head.version + 1;
  END IF;
  INSERT INTO public.teacher_instrument_versions(instrument_id, version, supersedes_id, assignment_id, class_id, school_id, period_id, title, instructions, items, randomization, status, results_instrument_id, author_user_id)
    VALUES (new_ins, v, _expected_head, _assignment_id, a.class_id, school, nullif(btrim(_period_id),''), btrim(_title), nullif(btrim(_instructions),''), coalesce(_items,'[]'), _randomization, _status, _results_instrument_id, auth.uid())
    RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_teacher_instrument_version(text, uuid, text, text, text, text, jsonb, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_teacher_instrument_version(text, uuid, text, text, text, text, jsonb, jsonb, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_assessment_item_media(_item_id text, _object_path text, _label text, _sha256 text, _mime text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'item:no-session'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.assessment_item_versions WHERE item_id = _item_id AND author_user_id = auth.uid()) THEN RAISE EXCEPTION 'item:not-author'; END IF;
  IF split_part(_object_path, '/', 1) <> auth.uid()::text THEN RAISE EXCEPTION 'item:media-path'; END IF;
  INSERT INTO public.assessment_item_media(item_id, object_path, label, content_sha256, mime, author_user_id)
    VALUES (_item_id, _object_path, btrim(_label), lower(_sha256), _mime, auth.uid()) RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_assessment_item_media(text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_assessment_item_media(text, text, text, text, text) TO authenticated;

CREATE POLICY "item media own prefix read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avaliacao-docente' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "item media own prefix insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avaliacao-docente' AND (storage.foldername(name))[1] = auth.uid()::text);