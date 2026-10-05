CREATE TABLE public.teaching_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.teaching_plan_versions(id),
  assignment_id text NOT NULL REFERENCES public.teaching_assignments(id),
  assignment_version_id uuid NOT NULL,
  matrix_version_id uuid NOT NULL,
  class_id text NOT NULL,
  school_id text NOT NULL,
  level_value_id text,
  covers_from date,
  covers_until date,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(blocks) = 'array'),
  curricular_refs jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(curricular_refs) = 'array'),
  status text NOT NULL CHECK (status IN ('rascunho','publicado','arquivado')),
  copied_from_version_id uuid REFERENCES public.teaching_plan_versions(id),
  change_reason text,
  author_user_id uuid NOT NULL,
  author_engagement_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, version),
  CHECK (covers_until IS NULL OR covers_from IS NULL OR covers_until >= covers_from),
  CHECK ((version = 1) = (supersedes_id IS NULL))
);
CREATE UNIQUE INDEX teaching_plan_one_successor ON public.teaching_plan_versions(supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX teaching_plan_by_assignment ON public.teaching_plan_versions(assignment_id, plan_id);
CREATE INDEX teaching_plan_by_school ON public.teaching_plan_versions(school_id, status);

CREATE TABLE public.teaching_plan_lesson_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_logical_record_id text NOT NULL,
  plan_version_id uuid NOT NULL REFERENCES public.teaching_plan_versions(id),
  linked_by uuid NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  supersedes_id uuid REFERENCES public.teaching_plan_lesson_links(id),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX teaching_plan_links_lesson ON public.teaching_plan_lesson_links(lesson_logical_record_id);

CREATE TABLE public.teaching_plan_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id text NOT NULL,
  object_path text NOT NULL UNIQUE,
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 1 AND 160),
  content_sha256 text NOT NULL CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  revoked boolean NOT NULL DEFAULT false,
  supersedes_id uuid REFERENCES public.teaching_plan_attachments(id),
  author_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.teaching_plan_versions, public.teaching_plan_lesson_links, public.teaching_plan_attachments TO authenticated;
GRANT ALL ON public.teaching_plan_versions, public.teaching_plan_lesson_links, public.teaching_plan_attachments TO service_role;
ALTER TABLE public.teaching_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teaching_plan_lesson_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teaching_plan_attachments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.teaching_plan_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'plan:append-only'; END $$;
CREATE TRIGGER teaching_plan_versions_immutable BEFORE UPDATE OR DELETE ON public.teaching_plan_versions FOR EACH ROW EXECUTE FUNCTION public.teaching_plan_immutable();
CREATE TRIGGER teaching_plan_links_immutable BEFORE UPDATE OR DELETE ON public.teaching_plan_lesson_links FOR EACH ROW EXECUTE FUNCTION public.teaching_plan_immutable();
CREATE TRIGGER teaching_plan_attachments_immutable BEFORE UPDATE OR DELETE ON public.teaching_plan_attachments FOR EACH ROW EXECUTE FUNCTION public.teaching_plan_immutable();

-- Visibilidade: autor vê tudo seu; demais só versões publicadas, com capability de consulta na escola. Rascunho nunca sai do autor.
CREATE OR REPLACE FUNCTION public.can_read_teaching_plan_version(_author uuid, _status text, _school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT _author = auth.uid()
      OR (_status = 'publicado' AND public.has_school_capability('consultar-planejamento-docente', _school))
$$;
REVOKE EXECUTE ON FUNCTION public.can_read_teaching_plan_version(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_teaching_plan_version(uuid, text, text) TO authenticated;

CREATE POLICY "plan versions readable by author or published+capability" ON public.teaching_plan_versions FOR SELECT TO authenticated
  USING (public.can_read_teaching_plan_version(author_user_id, status, school_id));
CREATE POLICY "plan links readable with plan" ON public.teaching_plan_lesson_links FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.teaching_plan_versions v WHERE v.id = plan_version_id AND public.can_read_teaching_plan_version(v.author_user_id, v.status, v.school_id)));
CREATE POLICY "plan attachments readable by author" ON public.teaching_plan_attachments FOR SELECT TO authenticated
  USING (author_user_id = auth.uid());

-- Writer único. A regência tem de estar vigente HOJE para o próprio usuário; planos de regência encerrada continuam legíveis, sem novas versões.
CREATE OR REPLACE FUNCTION public.record_teaching_plan_version(
  _plan_id text, _expected_head uuid, _assignment_id text, _title text, _level_value_id text,
  _covers_from date, _covers_until date, _blocks jsonb, _curricular_refs jsonb, _status text,
  _copied_from uuid, _change_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a record; head record; new_plan text := _plan_id; v int := 1; new_id uuid; school text; r jsonb; b jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'plan:no-session'; END IF;
  SELECT * INTO a FROM public.my_teaching_assignments_at(current_date, now()) t WHERE t.assignment_id = _assignment_id LIMIT 1;
  IF a IS NULL THEN RAISE EXCEPTION 'plan:assignment-not-current'; END IF;
  SELECT c.school_id INTO school FROM public.institutional_classes c WHERE c.id = a.class_id;
  IF school IS NULL THEN RAISE EXCEPTION 'plan:class-missing'; END IF;
  IF _status NOT IN ('rascunho','publicado','arquivado') THEN RAISE EXCEPTION 'plan:invalid-status'; END IF;
  IF jsonb_typeof(coalesce(_blocks,'[]')) <> 'array' OR jsonb_array_length(coalesce(_blocks,'[]')) > 60 THEN RAISE EXCEPTION 'plan:invalid-blocks'; END IF;
  FOR b IN SELECT * FROM jsonb_array_elements(coalesce(_blocks,'[]')) LOOP
    IF jsonb_typeof(b) <> 'object' OR length(coalesce(b->>'heading','')) > 160 OR length(coalesce(b->>'body','')) > 20000 THEN RAISE EXCEPTION 'plan:invalid-blocks'; END IF;
  END LOOP;
  IF jsonb_typeof(coalesce(_curricular_refs,'[]')) <> 'array' THEN RAISE EXCEPTION 'plan:invalid-refs'; END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(coalesce(_curricular_refs,'[]')) LOOP
    IF r->>'kind' = 'matrix-item' THEN
      IF NOT EXISTS (SELECT 1 FROM public.curricular_matrix_items i JOIN public.teaching_assignment_versions tv ON tv.matrix_version_id = i.matrix_version_id
                     WHERE tv.id = a.version_id AND i.item_key = r->>'item_key') THEN RAISE EXCEPTION 'plan:matrix-item-not-applicable'; END IF;
    ELSIF r->>'kind' = 'reference-item' THEN
      IF NOT EXISTS (SELECT 1 FROM public.curricular_reference_items i WHERE i.id::text = r->>'item_id') THEN RAISE EXCEPTION 'plan:reference-item-unknown'; END IF;
    ELSE RAISE EXCEPTION 'plan:invalid-refs'; END IF;
  END LOOP;
  IF _copied_from IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.teaching_plan_versions s WHERE s.id = _copied_from
       AND public.can_read_teaching_plan_version(s.author_user_id, s.status, s.school_id)) THEN RAISE EXCEPTION 'plan:copy-source-not-readable'; END IF;

  IF _expected_head IS NULL THEN
    IF new_plan IS NULL THEN new_plan := 'pln-' || gen_random_uuid(); END IF;
    IF EXISTS (SELECT 1 FROM public.teaching_plan_versions WHERE plan_id = new_plan) THEN RAISE EXCEPTION 'plan:stale-head'; END IF;
  ELSE
    SELECT * INTO head FROM public.teaching_plan_versions WHERE plan_id = _plan_id ORDER BY version DESC LIMIT 1 FOR UPDATE;
    IF head IS NULL OR head.id <> _expected_head THEN RAISE EXCEPTION 'plan:stale-head'; END IF;
    IF head.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'plan:not-author'; END IF;
    IF head.assignment_id <> _assignment_id THEN RAISE EXCEPTION 'plan:assignment-immutable'; END IF;
    IF _copied_from IS NOT NULL THEN RAISE EXCEPTION 'plan:copy-only-on-new'; END IF;
    v := head.version + 1;
  END IF;

  INSERT INTO public.teaching_plan_versions(plan_id, version, supersedes_id, assignment_id, assignment_version_id, matrix_version_id, class_id, school_id,
    level_value_id, covers_from, covers_until, title, blocks, curricular_refs, status, copied_from_version_id, change_reason, author_user_id, author_engagement_id)
  SELECT new_plan, v, _expected_head, _assignment_id, a.version_id, tv.matrix_version_id, a.class_id, school,
    nullif(btrim(_level_value_id),''), _covers_from, _covers_until, btrim(_title), coalesce(_blocks,'[]'), coalesce(_curricular_refs,'[]'), _status, _copied_from,
    nullif(btrim(_change_reason),''), auth.uid(), a.engagement_id::uuid
  FROM public.teaching_assignment_versions tv WHERE tv.id = a.version_id
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_teaching_plan_version(text, uuid, text, text, text, date, date, jsonb, jsonb, text, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_teaching_plan_version(text, uuid, text, text, text, date, date, jsonb, jsonb, text, uuid, text) TO authenticated;

-- Aula referencia planejamento (ou desfaz a referência); nunca marca conteúdo como ministrado.
CREATE OR REPLACE FUNCTION public.link_lesson_to_plan(_lesson_logical_record_id text, _plan_version_id uuid, _revoke_link uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p record; new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'plan:no-session'; END IF;
  IF _revoke_link IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.teaching_plan_lesson_links l WHERE l.id = _revoke_link AND l.linked_by = auth.uid() AND NOT l.revoked
                   AND NOT EXISTS (SELECT 1 FROM public.teaching_plan_lesson_links x WHERE x.supersedes_id = l.id)) THEN RAISE EXCEPTION 'plan:stale-head'; END IF;
    INSERT INTO public.teaching_plan_lesson_links(lesson_logical_record_id, plan_version_id, linked_by, revoked, supersedes_id)
      SELECT l.lesson_logical_record_id, l.plan_version_id, auth.uid(), true, l.id FROM public.teaching_plan_lesson_links l WHERE l.id = _revoke_link RETURNING id INTO new_id;
    RETURN new_id;
  END IF;
  SELECT * INTO p FROM public.teaching_plan_versions WHERE id = _plan_version_id;
  IF p IS NULL OR p.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'plan:not-author'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.lesson_record_versions l WHERE l.logical_record_id = _lesson_logical_record_id AND l.author_user_id = auth.uid() AND l.assignment_id = p.assignment_id)
    THEN RAISE EXCEPTION 'plan:lesson-not-own-assignment'; END IF;
  INSERT INTO public.teaching_plan_lesson_links(lesson_logical_record_id, plan_version_id, linked_by) VALUES (_lesson_logical_record_id, _plan_version_id, auth.uid()) RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.link_lesson_to_plan(text, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_lesson_to_plan(text, uuid, uuid) TO authenticated;

-- Anexos: só o autor do plano registra; objeto deve estar sob o prefixo do usuário no bucket privado.
CREATE OR REPLACE FUNCTION public.record_teaching_plan_attachment(_plan_id text, _object_path text, _label text, _sha256 text, _revoke uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'plan:no-session'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.teaching_plan_versions WHERE plan_id = _plan_id AND author_user_id = auth.uid()) THEN RAISE EXCEPTION 'plan:not-author'; END IF;
  IF _revoke IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.teaching_plan_attachments a WHERE a.id = _revoke AND a.plan_id = _plan_id AND NOT a.revoked
       AND NOT EXISTS (SELECT 1 FROM public.teaching_plan_attachments x WHERE x.supersedes_id = a.id)) THEN RAISE EXCEPTION 'plan:stale-head'; END IF;
    INSERT INTO public.teaching_plan_attachments(plan_id, object_path, label, content_sha256, revoked, supersedes_id, author_user_id)
      SELECT plan_id, object_path || '#revogado-' || gen_random_uuid(), label, content_sha256, true, id, auth.uid() FROM public.teaching_plan_attachments WHERE id = _revoke RETURNING id INTO new_id;
    RETURN new_id;
  END IF;
  IF split_part(_object_path, '/', 1) <> auth.uid()::text THEN RAISE EXCEPTION 'plan:attachment-path'; END IF;
  INSERT INTO public.teaching_plan_attachments(plan_id, object_path, label, content_sha256, author_user_id)
    VALUES (_plan_id, _object_path, btrim(_label), lower(_sha256), auth.uid()) RETURNING id INTO new_id;
  RETURN new_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_teaching_plan_attachment(text, text, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_teaching_plan_attachment(text, text, text, text, uuid) TO authenticated;

CREATE POLICY "plan attachments own prefix read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'planejamento-docente' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "plan attachments own prefix insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'planejamento-docente' AND (storage.foldername(name))[1] = auth.uid()::text);