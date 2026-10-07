-- N5.2.1b — Conta setorial da Secretaria (principal institucional, sem pessoa) não conseguia gravar matrícula:
-- writers exigiam pessoa natural. Ator canônico = current_actor() (humano OU principal), sem afirmar que principal é pessoa.
-- A tabela da 0212 (vazia, nunca usada) é substituída por outra que registra o tipo de ator.

COMMENT ON TABLE public.enrollment_wizard_events IS 'DEPRECATED: substituída por enrollment_wizard_draft_events (0213), que registra ator humano ou principal setorial. Nunca recebeu linhas.';

CREATE TABLE public.enrollment_wizard_draft_events (
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
  author_actor_kind text NOT NULL CHECK (author_actor_kind IN ('human','institutional')),
  author_person_id uuid REFERENCES public.institutional_persons(id),
  author_principal_id uuid REFERENCES public.institutional_sector_principals(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_id, sequence),
  CHECK ((author_actor_kind = 'human' AND author_person_id IS NOT NULL AND author_principal_id IS NULL)
      OR (author_actor_kind = 'institutional' AND author_principal_id IS NOT NULL AND author_person_id IS NULL))
);
COMMENT ON TABLE public.enrollment_wizard_draft_events IS 'Rascunho da matrícula guiada (append-only). Não é matrícula oficial; o fato nasce só na conclusão pelos núcleos canônicos. CPF só como HMAC + 2 dígitos. Ator humano ou principal setorial.';
CREATE INDEX enrollment_wizard_draft_events_school_idx ON public.enrollment_wizard_draft_events (school_id, draft_id, sequence DESC);
CREATE INDEX enrollment_wizard_draft_events_student_idx ON public.enrollment_wizard_draft_events ((result->>'student_id')) WHERE kind = 'concluido';
GRANT SELECT ON public.enrollment_wizard_draft_events TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enrollment_wizard_draft_events FROM anon, authenticated, service_role;
ALTER TABLE public.enrollment_wizard_draft_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER enrollment_wizard_draft_events_immutable BEFORE UPDATE OR DELETE ON public.enrollment_wizard_draft_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Ator canônico para os writers da Secretaria.
CREATE OR REPLACE FUNCTION public.sec_actor()
RETURNS TABLE(kind text, person_id uuid, principal_id uuid) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE a record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  SELECT * INTO a FROM public.current_actor() LIMIT 1;
  IF a.actor_kind = 'institutional' THEN RETURN QUERY SELECT 'institutional'::text, NULL::uuid, a.institutional_principal_id; RETURN; END IF;
  IF a.actor_kind = 'human' AND EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = a.person_id AND p.actor_nature = 'pessoa-natural') THEN
    RETURN QUERY SELECT 'human'::text, a.person_id, NULL::uuid; RETURN; END IF;
  RAISE EXCEPTION 'session:person-required';
END $$;
REVOKE ALL ON FUNCTION public.sec_actor() FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ewd_head(_draft uuid)
RETURNS public.enrollment_wizard_draft_events LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT * FROM public.enrollment_wizard_draft_events WHERE draft_id = _draft ORDER BY sequence DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.ewd_head(uuid) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.enrollment_draft_save(_draft uuid, _school text, _expected integer, _step integer, _payload jsonb, _cpf text, _inep text, _existing_student text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE ac record; h public.enrollment_wizard_draft_events; c text; hm text; hint text; i text; photo text;
BEGIN
  SELECT * INTO ac FROM public.sec_actor();
  IF _draft IS NULL OR _school IS NULL THEN RAISE EXCEPTION 'draft:invalid'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'draft:capability-missing'; END IF;
  IF _step IS NULL OR _step < 1 OR _step > 8 THEN RAISE EXCEPTION 'draft:invalid'; END IF;
  IF _payload IS NULL OR pg_catalog.jsonb_typeof(_payload) <> 'object' OR pg_catalog.length(_payload::text) > 65536 THEN RAISE EXCEPTION 'draft:payload-invalid'; END IF;
  IF _payload::text ~* '"cpf"\s*:' THEN RAISE EXCEPTION 'draft:payload-invalid'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('enrollment-draft:' || _draft));
  h := public.ewd_head(_draft);
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
  INSERT INTO public.enrollment_wizard_draft_events(draft_id, sequence, school_id, kind, step, payload, cpf_hmac, cpf_hint, inep, existing_student_id,
    author_user_id, author_actor_kind, author_person_id, author_principal_id)
  VALUES (_draft, coalesce(h.sequence, 0) + 1, _school, 'salvo', _step, _payload, hm, hint, i, _existing_student, auth.uid(), ac.kind, ac.person_id, ac.principal_id);
  RETURN coalesce(h.sequence, 0) + 1;
END $$;

CREATE OR REPLACE FUNCTION public.enrollment_draft_abandon(_draft uuid, _expected integer, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE ac record; h public.enrollment_wizard_draft_events;
BEGIN
  SELECT * INTO ac FROM public.sec_actor();
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('enrollment-draft:' || _draft));
  h := public.ewd_head(_draft);
  IF h.id IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', h.school_id) THEN RAISE EXCEPTION 'draft:not-found'; END IF;
  IF h.kind <> 'salvo' THEN RAISE EXCEPTION 'draft:closed'; END IF;
  IF h.sequence <> coalesce(_expected, -1) THEN RAISE EXCEPTION 'draft:stale-head'; END IF;
  INSERT INTO public.enrollment_wizard_draft_events(draft_id, sequence, school_id, kind, step, payload, cpf_hmac, cpf_hint, inep, existing_student_id, reason,
    author_user_id, author_actor_kind, author_person_id, author_principal_id)
  VALUES (_draft, h.sequence + 1, h.school_id, 'abandonado', h.step, h.payload, h.cpf_hmac, h.cpf_hint, h.inep, h.existing_student_id,
    nullif(pg_catalog.btrim(coalesce(_reason,'')),''), auth.uid(), ac.kind, ac.person_id, ac.principal_id);
  RETURN h.sequence + 1;
END $$;

CREATE OR REPLACE FUNCTION public.enrollment_drafts_open(_school text)
RETURNS TABLE(draft_id uuid, sequence integer, step integer, payload jsonb, has_cpf boolean, cpf_hint text, inep text, existing_student_id text, existing_student_name text, updated_at timestamptz, mine boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'draft:capability-missing'; END IF;
  RETURN QUERY
  SELECT e.draft_id, e.sequence, e.step, e.payload, e.cpf_hmac IS NOT NULL, e.cpf_hint, e.inep, e.existing_student_id, s.display_name, e.created_at, e.author_user_id = auth.uid()
  FROM (SELECT DISTINCT ON (w.draft_id) w.* FROM public.enrollment_wizard_draft_events w WHERE w.school_id = _school ORDER BY w.draft_id, w.sequence DESC) e
  LEFT JOIN public.institutional_students s ON s.id = e.existing_student_id
  WHERE e.kind = 'salvo'
  ORDER BY e.created_at DESC;
END $$;

-- Núcleo de enturmação (mesmas regras de secretariat_allocate_to_class, sem exigir pessoa).
CREATE OR REPLACE FUNCTION public.sec_allocate_core(_enrollment text, _class text, _valid_from date, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE e record; c record; yv record; nid text;
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
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('af-alloc:' || e.id));
  IF EXISTS (SELECT 1 FROM public.class_enrollment_episodes p WHERE p.enrollment_id = e.id AND public.af_episode_current(p.id)
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings y WHERE y.episode_id = p.id)) THEN
    RAISE EXCEPTION 'secretariat:active-class-exists'; END IF;
  nid := 'enturm-' || pg_catalog.gen_random_uuid();
  INSERT INTO public.class_enrollment_episodes(id, enrollment_id, student_id, school_id, class_id, class_label_snapshot, cycle_id, valid_from,
    originating_act_ref, recorded_by, logical_id)
  VALUES (nid, e.id, e.student_id, e.school_id, c.id, c.name, e.cycle_id, _valid_from, nullif(pg_catalog.btrim(coalesce(_reason,'')), ''), auth.uid(), nid);
  RETURN nid;
END $fn$;
REVOKE ALL ON FUNCTION public.sec_allocate_core(text, text, date, text) FROM PUBLIC, anon, authenticated, service_role;

-- Enturmar pela estação também passa a aceitar a conta setorial (mesma regra; ator canônico).
CREATE OR REPLACE FUNCTION public.secretariat_allocate_to_class(_enrollment text, _class text, _valid_from date, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  PERFORM public.sec_actor();
  RETURN public.sec_allocate_core(_enrollment, _class, _valid_from, _reason);
END $fn$;

CREATE OR REPLACE FUNCTION public.enroll_student_in_school_year(_student text, _school text, _year text, _declared_on date, _act_ref text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  PERFORM public.sec_actor();
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', _school) THEN RAISE EXCEPTION 'enrollment:capability-missing'; END IF;
  IF NOT public.s_year_open_for_operation(_year) THEN RAISE EXCEPTION 'enrollment:year-not-open'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_students s WHERE s.id = _student) THEN RAISE EXCEPTION 'enrollment:student-not-found'; END IF;
  RETURN public.s_enroll_core(_student, _school, _year, _declared_on, _act_ref);
END $$;

CREATE OR REPLACE FUNCTION public.enrollment_draft_complete(_draft uuid, _expected integer, _year text, _declared_on date, _class text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE ac record; h public.enrollment_wizard_draft_events; nm text; sid text; pid uuid; p1 uuid; p2 uuid;
  reused boolean := false; created boolean := false; enr text; ep text; res jsonb; c record;
BEGIN
  SELECT * INTO ac FROM public.sec_actor();
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('enrollment-draft:' || _draft));
  h := public.ewd_head(_draft);
  IF h.id IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', h.school_id) THEN RAISE EXCEPTION 'draft:not-found'; END IF;
  IF h.kind <> 'salvo' THEN RAISE EXCEPTION 'draft:closed'; END IF;
  IF h.sequence <> coalesce(_expected, -1) THEN RAISE EXCEPTION 'draft:stale-head'; END IF;
  IF _declared_on IS NULL THEN RAISE EXCEPTION 'secretariat:date-required'; END IF;
  IF NOT public.s_year_open_for_operation(_year) THEN RAISE EXCEPTION 'enrollment:year-not-open'; END IF;
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
    IF ac.kind = 'human' THEN
      INSERT INTO public.student_registration_events(student_id, person_id, school_id, purpose, person_reused, author_user_id, author_person_id)
      VALUES (sid, pid, h.school_id, 'matricula-na-escola', reused, auth.uid(), ac.person_id);
    END IF;
  END IF;
  IF NOT public.has_school_capability('manter-matricula-e-enturmacao', h.school_id) THEN RAISE EXCEPTION 'enrollment:capability-missing'; END IF;
  enr := public.s_enroll_core(sid, h.school_id, _year, _declared_on, NULL);
  IF _class IS NOT NULL THEN ep := public.sec_allocate_core(enr, _class, _declared_on, NULL); END IF;
  res := pg_catalog.jsonb_build_object('student_id', sid, 'enrollment_id', enr, 'episode_id', ep, 'class_id', _class, 'year_id', _year,
    'declared_on', _declared_on, 'student_created', created, 'person_reused', reused);
  INSERT INTO public.enrollment_wizard_draft_events(draft_id, sequence, school_id, kind, step, payload, cpf_hmac, cpf_hint, inep, existing_student_id, result,
    author_user_id, author_actor_kind, author_person_id, author_principal_id)
  VALUES (_draft, h.sequence + 1, h.school_id, 'concluido', 8, h.payload, h.cpf_hmac, h.cpf_hint, h.inep, sid, res, auth.uid(), ac.kind, ac.person_id, ac.principal_id);
  RETURN res;
END $$;

CREATE OR REPLACE FUNCTION public.enrollment_form_for_student(_school text, _student text)
RETURNS TABLE(draft_id uuid, payload jsonb, cpf_hint text, result jsonb, completed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT (public.has_school_capability('consultar-matricula-e-movimentacao', _school) OR public.has_school_capability('manter-matricula-e-enturmacao', _school)) THEN RAISE EXCEPTION 'secretariat:not-found'; END IF;
  RETURN QUERY SELECT e.draft_id, e.payload, e.cpf_hint, e.result, e.created_at FROM public.enrollment_wizard_draft_events e
   WHERE e.school_id = _school AND e.kind = 'concluido' AND e.result->>'student_id' = _student ORDER BY e.created_at DESC;
END $$;

-- Localizar aluno também pela conta setorial (mesma regra e mesmo registro da busca).
CREATE OR REPLACE FUNCTION public.locate_student_exact(_school text, _kind text, _value text, _year text)
RETURNS TABLE(outcome text, student_id text, display_name text, active_here boolean, active_elsewhere boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v text := pg_catalog.regexp_replace(coalesce(_value,''), '[^0-9]', '', 'g'); p1 uuid; sids text[]; o text; s record; a record;
BEGIN
  PERFORM public.sec_actor();
  IF NOT public.has_school_capability('localizar-estudante-para-matricula', _school) THEN RAISE EXCEPTION 'lookup:capability-missing'; END IF;
  PERFORM public.s_lookup_guard('localizar-aluno', _school, _kind);
  IF _kind = 'cpf' AND public.technical_cpf_valid(v) THEN
    SELECT i.person_id INTO p1 FROM public.institutional_person_identifiers i WHERE i.identifier_kind = 'cpf-hmac' AND i.value = public.technical_cpf_hmac(v);
  ELSIF _kind = 'inep' AND v ~ '^[0-9]{12}$' THEN
    SELECT i.person_id INTO p1 FROM public.institutional_person_identifiers i WHERE i.identifier_kind = 'inep-pessoa' AND i.value = v;
  ELSE
    o := 'entrada-invalida';
  END IF;
  IF o IS NULL THEN
    SELECT pg_catalog.array_agg(sp.student_id) INTO sids FROM public.institutional_student_persons sp WHERE sp.person_id = p1;
    o := CASE WHEN p1 IS NULL OR sids IS NULL THEN 'nao-encontrado' WHEN pg_catalog.cardinality(sids) > 1 THEN 'conflito' ELSE 'encontrado' END;
  END IF;
  INSERT INTO public.exact_lookup_events(user_id, purpose, school_id, identifier_kind, outcome) VALUES (auth.uid(), 'localizar-aluno', _school, coalesce(_kind,'?'), o);
  IF o <> 'encontrado' THEN RETURN QUERY SELECT o, NULL::text, NULL::text, NULL::boolean, NULL::boolean; RETURN; END IF;
  SELECT st.id, st.display_name INTO s FROM public.institutional_students st WHERE st.id = sids[1];
  SELECT * INTO a FROM public.s_active_enrollment(s.id, _year) LIMIT 1;
  RETURN QUERY SELECT o, s.id, s.display_name, coalesce(a.school_id = _school, false), coalesce(a.school_id <> _school, false);
END $$;
