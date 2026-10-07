-- N5.2.1 — Matrícula guiada: rascunho append-only + conclusão transacional pelos writers canônicos
-- (register/enroll/allocate). O rascunho nunca é matrícula oficial; CPF nunca fica em texto no rascunho.

CREATE TABLE public.enrollment_wizard_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id uuid NOT NULL,
  sequence integer NOT NULL CHECK (sequence >= 1),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  kind text NOT NULL CHECK (kind IN ('salvo','concluido','abandonado')),
  step integer NOT NULL CHECK (step BETWEEN 1 AND 8),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  cpf_hmac text,
  cpf_hint text,
  inep text CHECK (inep IS NULL OR inep ~ '^[0-9]{12}$'),
  existing_student_id text REFERENCES public.institutional_students(id),
  result jsonb,
  reason text,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, sequence)
);
COMMENT ON TABLE public.enrollment_wizard_events IS 'Rascunho da operação de matrícula guiada (append-only). Não é matrícula oficial: o fato oficial nasce só pelos writers canônicos na conclusão. CPF só como HMAC + 2 dígitos finais.';
CREATE INDEX enrollment_wizard_events_school_idx ON public.enrollment_wizard_events (school_id, draft_id, sequence DESC);
CREATE INDEX enrollment_wizard_events_student_idx ON public.enrollment_wizard_events ((result->>'student_id')) WHERE kind = 'concluido';
GRANT SELECT ON public.enrollment_wizard_events TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enrollment_wizard_events FROM anon, authenticated, service_role;
ALTER TABLE public.enrollment_wizard_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER enrollment_wizard_events_immutable BEFORE UPDATE OR DELETE ON public.enrollment_wizard_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.ew_head(_draft uuid)
RETURNS public.enrollment_wizard_events LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT * FROM public.enrollment_wizard_events WHERE draft_id = _draft ORDER BY sequence DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.ew_head(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Salvar rascunho. _expected = 0 cria; _cpf NULL mantém, '' limpa.
CREATE OR REPLACE FUNCTION public.enrollment_draft_save(_draft uuid, _school text, _expected integer, _step integer, _payload jsonb, _cpf text, _inep text, _existing_student text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE me uuid := public.s_current_person(); h public.enrollment_wizard_events; c text; hm text; hint text; i text; photo text;
BEGIN
  IF auth.uid() IS NULL OR me IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF _draft IS NULL OR _school IS NULL THEN RAISE EXCEPTION 'draft:invalid'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'draft:capability-missing'; END IF;
  IF _step IS NULL OR _step < 1 OR _step > 8 THEN RAISE EXCEPTION 'draft:invalid'; END IF;
  IF _payload IS NULL OR pg_catalog.jsonb_typeof(_payload) <> 'object' OR pg_catalog.length(_payload::text) > 65536 THEN RAISE EXCEPTION 'draft:payload-invalid'; END IF;
  IF _payload::text ~* '"cpf"\s*:' THEN RAISE EXCEPTION 'draft:payload-invalid'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('enrollment-draft:' || _draft));
  h := public.ew_head(_draft);
  IF h.id IS NULL THEN
    IF coalesce(_expected, 0) <> 0 THEN RAISE EXCEPTION 'draft:stale-head'; END IF;
  ELSE
    IF h.school_id <> _school THEN RAISE EXCEPTION 'draft:school-immutable'; END IF;
    IF h.kind <> 'salvo' THEN RAISE EXCEPTION 'draft:closed'; END IF;
    IF h.sequence <> coalesce(_expected, -1) THEN RAISE EXCEPTION 'draft:stale-head'; END IF;
  END IF;
  photo := _payload #>> '{foto,path}';
  IF photo IS NOT NULL AND photo NOT LIKE (_school || '/' || _draft::text || '/%') THEN RAISE EXCEPTION 'draft:photo-path-invalid'; END IF;
  IF _cpf IS NULL THEN hm := h.cpf_hmac; hint := h.cpf_hint;
  ELSE
    c := pg_catalog.regexp_replace(_cpf, '[^0-9]', '', 'g');
    IF c = '' THEN hm := NULL; hint := NULL;
    ELSIF NOT public.technical_cpf_valid(c) THEN RAISE EXCEPTION 'student:cpf-invalid';
    ELSE hm := public.technical_cpf_hmac(c); hint := pg_catalog.right(c, 2); END IF;
  END IF;
  i := nullif(pg_catalog.regexp_replace(coalesce(_inep,''), '[^0-9]', '', 'g'), '');
  IF i IS NOT NULL AND i !~ '^[0-9]{12}$' THEN RAISE EXCEPTION 'student:inep-invalid'; END IF;
  IF _existing_student IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutional_students s WHERE s.id = _existing_student) THEN RAISE EXCEPTION 'draft:student-not-found'; END IF;
  INSERT INTO public.enrollment_wizard_events(draft_id, sequence, school_id, kind, step, payload, cpf_hmac, cpf_hint, inep, existing_student_id, author_user_id, author_person_id)
  VALUES (_draft, coalesce(h.sequence, 0) + 1, _school, 'salvo', _step, _payload, hm, hint, i, _existing_student, auth.uid(), me);
  RETURN coalesce(h.sequence, 0) + 1;
END $$;
REVOKE ALL ON FUNCTION public.enrollment_draft_save(uuid, text, integer, integer, jsonb, text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.enrollment_draft_save(uuid, text, integer, integer, jsonb, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.enrollment_draft_abandon(_draft uuid, _expected integer, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE me uuid := public.s_current_person(); h public.enrollment_wizard_events;
BEGIN
  IF auth.uid() IS NULL OR me IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('enrollment-draft:' || _draft));
  h := public.ew_head(_draft);
  IF h.id IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', h.school_id) THEN RAISE EXCEPTION 'draft:not-found'; END IF;
  IF h.kind <> 'salvo' THEN RAISE EXCEPTION 'draft:closed'; END IF;
  IF h.sequence <> coalesce(_expected, -1) THEN RAISE EXCEPTION 'draft:stale-head'; END IF;
  INSERT INTO public.enrollment_wizard_events(draft_id, sequence, school_id, kind, step, payload, cpf_hmac, cpf_hint, inep, existing_student_id, reason, author_user_id, author_person_id)
  VALUES (_draft, h.sequence + 1, h.school_id, 'abandonado', h.step, h.payload, h.cpf_hmac, h.cpf_hint, h.inep, h.existing_student_id, nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), me);
  RETURN h.sequence + 1;
END $$;
REVOKE ALL ON FUNCTION public.enrollment_draft_abandon(uuid, integer, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.enrollment_draft_abandon(uuid, integer, text) TO authenticated;

-- Rascunhos abertos da escola (equipe da Secretaria); sem HMAC.
CREATE OR REPLACE FUNCTION public.enrollment_drafts_open(_school text)
RETURNS TABLE(draft_id uuid, sequence integer, step integer, payload jsonb, has_cpf boolean, cpf_hint text, inep text, existing_student_id text, existing_student_name text, updated_at timestamptz, mine boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'draft:capability-missing'; END IF;
  RETURN QUERY
  SELECT e.draft_id, e.sequence, e.step, e.payload, e.cpf_hmac IS NOT NULL, e.cpf_hint, e.inep, e.existing_student_id, s.display_name, e.created_at, e.author_user_id = auth.uid()
  FROM (SELECT DISTINCT ON (w.draft_id) w.* FROM public.enrollment_wizard_events w WHERE w.school_id = _school ORDER BY w.draft_id, w.sequence DESC) e
  LEFT JOIN public.institutional_students s ON s.id = e.existing_student_id
  WHERE e.kind = 'salvo'
  ORDER BY e.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.enrollment_drafts_open(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.enrollment_drafts_open(text) TO authenticated;

-- Turmas elegíveis com dados honestos: capacidade só se houver registro único vigente; ocupação = enturmações vigentes.
CREATE OR REPLACE FUNCTION public.enrollment_wizard_class_options(_school text, _year text, _on date)
RETURNS TABLE(class_id text, name text, administrative_status text, shift_label text, capacity integer, occupancy integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'draft:capability-missing'; END IF;
  RETURN QUERY
  SELECT c.id, r.name, r.administrative_status,
    (SELECT sh.value_label FROM public.class_shift_at(c.id, _on, NULL) sh LIMIT 1),
    (SELECT CASE WHEN count(*) = 1 THEN max(k.reference_limit) END FROM public.class_capacity_at(c.id, _on, NULL) k WHERE NOT k.annulled),
    (SELECT count(*)::integer FROM public.class_enrollment_episodes p
      WHERE p.class_id = c.id AND p.valid_from <= _on AND public.af_episode_current(p.id)
        AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = p.id AND y.ended_on < _on))
  FROM public.institutional_classes c
  CROSS JOIN LATERAL (SELECT a.name, a.administrative_status FROM public.class_at(c.id, _on, NULL) a LIMIT 1) r
  WHERE c.school_id = _school AND c.academic_year_id = _year AND r.administrative_status = 'ativa'
  ORDER BY r.name;
END $$;
REVOKE ALL ON FUNCTION public.enrollment_wizard_class_options(text, text, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.enrollment_wizard_class_options(text, text, date) TO authenticated;

-- Conclusão: tudo numa transação; qualquer recusa desfaz tudo e o rascunho permanece retomável.
CREATE OR REPLACE FUNCTION public.enrollment_draft_complete(_draft uuid, _expected integer, _year text, _declared_on date, _class text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE me uuid := public.s_current_person(); h public.enrollment_wizard_events; nm text; sid text; pid uuid; p1 uuid; p2 uuid;
  reused boolean := false; created boolean := false; enr text; ep text; res jsonb; c record;
BEGIN
  IF auth.uid() IS NULL OR me IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('enrollment-draft:' || _draft));
  h := public.ew_head(_draft);
  IF h.id IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', h.school_id) THEN RAISE EXCEPTION 'draft:not-found'; END IF;
  IF h.kind <> 'salvo' THEN RAISE EXCEPTION 'draft:closed'; END IF;
  IF h.sequence <> coalesce(_expected, -1) THEN RAISE EXCEPTION 'draft:stale-head'; END IF;
  IF _declared_on IS NULL THEN RAISE EXCEPTION 'secretariat:date-required'; END IF;
  IF _class IS NOT NULL THEN
    SELECT * INTO c FROM public.institutional_classes WHERE id = _class;
    IF c.id IS NULL OR c.school_id <> h.school_id OR c.academic_year_id IS DISTINCT FROM _year THEN RAISE EXCEPTION 'secretariat:class-invalid'; END IF;
  END IF;
  IF h.existing_student_id IS NOT NULL THEN
    sid := h.existing_student_id; reused := true;
  ELSE
    nm := pg_catalog.btrim(coalesce(h.payload #>> '{aluno,nome}', ''));
    IF nm = '' THEN RAISE EXCEPTION 'student:name-required'; END IF;
    IF h.cpf_hmac IS NULL AND h.inep IS NULL THEN RAISE EXCEPTION 'student:exact-identifier-required'; END IF;
    IF NOT public.has_school_capability('cadastrar-estudante-na-escola', h.school_id) THEN RAISE EXCEPTION 'student:capability-missing'; END IF;
    IF h.cpf_hmac IS NOT NULL THEN PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('person-id:' || h.cpf_hmac));
      SELECT person_id INTO p1 FROM public.institutional_person_identifiers WHERE identifier_kind = 'cpf-hmac' AND value = h.cpf_hmac; END IF;
    IF h.inep IS NOT NULL THEN PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('person-id:' || h.inep));
      SELECT person_id INTO p2 FROM public.institutional_person_identifiers WHERE identifier_kind = 'inep-pessoa' AND value = h.inep; END IF;
    IF p1 IS NOT NULL AND p2 IS NOT NULL AND p1 <> p2 THEN RAISE EXCEPTION 'identity:conflict'; END IF;
    pid := coalesce(p1, p2);
    IF pid IS NOT NULL AND EXISTS (SELECT 1 FROM public.institutional_student_persons sp WHERE sp.person_id = pid) THEN RAISE EXCEPTION 'identity:already-registered-use-search'; END IF;
    IF pid IS NULL THEN INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES (nm, 'pessoa-natural') RETURNING id INTO pid; ELSE reused := true; END IF;
    IF h.cpf_hmac IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.institutional_person_identifiers WHERE person_id = pid AND identifier_kind = 'cpf-hmac' AND value <> h.cpf_hmac) THEN RAISE EXCEPTION 'identity:conflict'; END IF;
      INSERT INTO public.institutional_person_identifiers(person_id, identifier_kind, value) VALUES (pid, 'cpf-hmac', h.cpf_hmac) ON CONFLICT DO NOTHING;
    END IF;
    IF h.inep IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM public.institutional_person_identifiers WHERE person_id = pid AND identifier_kind = 'inep-pessoa' AND value <> h.inep) THEN RAISE EXCEPTION 'identity:conflict'; END IF;
      INSERT INTO public.institutional_person_identifiers(person_id, identifier_kind, value) VALUES (pid, 'inep-pessoa', h.inep) ON CONFLICT DO NOTHING;
    END IF;
    sid := 'est-' || pg_catalog.gen_random_uuid(); created := true;
    INSERT INTO public.institutional_students(id, display_name) VALUES (sid, nm);
    INSERT INTO public.institutional_student_persons(student_id, person_id) VALUES (sid, pid);
    INSERT INTO public.student_registration_events(student_id, person_id, school_id, purpose, person_reused, author_user_id, author_person_id)
    VALUES (sid, pid, h.school_id, 'matricula-na-escola', reused, auth.uid(), me);
  END IF;
  enr := public.enroll_student_in_school_year(sid, h.school_id, _year, _declared_on, NULL);
  IF _class IS NOT NULL THEN ep := public.secretariat_allocate_to_class(enr, _class, _declared_on, NULL); END IF;
  res := pg_catalog.jsonb_build_object('student_id', sid, 'enrollment_id', enr, 'episode_id', ep, 'class_id', _class, 'year_id', _year,
    'declared_on', _declared_on, 'student_created', created);
  INSERT INTO public.enrollment_wizard_events(draft_id, sequence, school_id, kind, step, payload, cpf_hmac, cpf_hint, inep, existing_student_id, result, author_user_id, author_person_id)
  VALUES (_draft, h.sequence + 1, h.school_id, 'concluido', 8, h.payload, h.cpf_hmac, h.cpf_hint, h.inep, sid, res, auth.uid(), me);
  RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.enrollment_draft_complete(uuid, integer, text, date, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.enrollment_draft_complete(uuid, integer, text, date, text) TO authenticated;

-- Ficha de matrícula (dados complementares da operação concluída) para quem consulta a escola.
CREATE OR REPLACE FUNCTION public.enrollment_form_for_student(_school text, _student text)
RETURNS TABLE(draft_id uuid, payload jsonb, cpf_hint text, result jsonb, completed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT (public.has_school_capability('consultar-matricula-e-movimentacao', _school) OR public.has_school_capability('manter-matricula-e-enturmacao', _school)) THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
  RETURN QUERY SELECT e.draft_id, e.payload, e.cpf_hint, e.result, e.created_at FROM public.enrollment_wizard_events e
   WHERE e.school_id = _school AND e.kind = 'concluido' AND e.result->>'student_id' = _student ORDER BY e.created_at DESC;
END $$;
REVOKE ALL ON FUNCTION public.enrollment_form_for_student(text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.enrollment_form_for_student(text, text) TO authenticated;

-- Foto 3×4: bucket privado, caminho <escola>/<rascunho>/..., só quem mantém matrícula grava; leitura também por quem consulta.
CREATE POLICY fotos_estudantes_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fotos-estudantes' AND public.has_school_capability('manter-matricula-e-enturmacao', (storage.foldername(name))[1]));
CREATE POLICY fotos_estudantes_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fotos-estudantes' AND (public.has_school_capability('manter-matricula-e-enturmacao', (storage.foldername(name))[1])
    OR public.has_school_capability('consultar-matricula-e-movimentacao', (storage.foldername(name))[1])));
