-- NEI.4: pedidos de apoio (mediador/apoio/AEE) com análise, encaminhamento e vínculo a designação JÁ registrada;
-- cobertura (afastamento/substituição) como registro do NEI sobre atuações existentes, sem ato funcional;
-- barreiras de acessibilidade com andamento e referência externa a compras/patrimônio (sem duplicar).
CREATE TABLE public.nei_support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id text NOT NULL,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  support_kind text NOT NULL CHECK (support_kind IN ('mediador','profissional-de-apoio','professor-aee','outro')),
  justification text NOT NULL CHECK (length(btrim(justification)) BETWEEN 10 AND 4000),
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.nei_support_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.nei_support_requests(id),
  seq integer NOT NULL CHECK (seq >= 1),
  stage text NOT NULL CHECK (stage IN ('solicitada','em-analise','encaminhada','designada','indeferida','cancelada','encerrada')),
  note text NOT NULL CHECK (length(btrim(note)) >= 3),
  forwarded_to text,
  mediation_logical_id uuid,
  engagement_id uuid,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (request_id, seq),
  CHECK (stage <> 'encaminhada' OR length(btrim(coalesce(forwarded_to,''))) >= 3),
  CHECK (stage <> 'designada' OR mediation_logical_id IS NOT NULL OR engagement_id IS NOT NULL),
  CHECK (stage NOT IN ('indeferida','cancelada','encerrada') OR length(btrim(note)) >= 10)
);
CREATE TABLE public.nei_coverage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  covered_engagement_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('afastamento','substituicao')),
  starts_on date NOT NULL,
  ends_on date,
  substitute_engagement_id uuid,
  note text NOT NULL CHECK (length(btrim(note)) >= 5),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (ends_on IS NULL OR ends_on >= starts_on),
  CHECK ((kind = 'substituicao') = (substitute_engagement_id IS NOT NULL)),
  CHECK (substitute_engagement_id IS DISTINCT FROM covered_engagement_id)
);
CREATE TABLE public.nei_accessibility_barriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  student_id text,
  category text NOT NULL CHECK (category IN ('arquitetonica','comunicacional','pedagogica','tecnologica','atitudinal','transporte','outra')),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 10 AND 4000),
  opened_by uuid NOT NULL,
  opened_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.nei_barrier_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barrier_id uuid NOT NULL REFERENCES public.nei_accessibility_barriers(id),
  seq integer NOT NULL CHECK (seq >= 1),
  status text NOT NULL CHECK (status IN ('identificada','em-andamento','resolvida','sem-solucao')),
  priority text CHECK (priority IS NULL OR length(btrim(priority)) BETWEEN 1 AND 40),
  resource_needed text CHECK (resource_needed IS NULL OR length(resource_needed) <= 400),
  external_ref text CHECK (external_ref IS NULL OR length(external_ref) <= 200),
  note text NOT NULL CHECK (length(btrim(note)) >= 3),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (barrier_id, seq),
  CHECK (status NOT IN ('resolvida','sem-solucao') OR length(btrim(note)) >= 10)
);
GRANT ALL ON public.nei_support_requests, public.nei_support_request_events, public.nei_coverage_events, public.nei_accessibility_barriers, public.nei_barrier_events TO service_role;
REVOKE ALL ON public.nei_support_requests, public.nei_support_request_events, public.nei_coverage_events, public.nei_accessibility_barriers, public.nei_barrier_events FROM PUBLIC, anon, authenticated;
ALTER TABLE public.nei_support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_support_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_coverage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_accessibility_barriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nei_barrier_events ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER nei_sr_imm BEFORE UPDATE OR DELETE ON public.nei_support_requests FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_sre_imm BEFORE UPDATE OR DELETE ON public.nei_support_request_events FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_cov_imm BEFORE UPDATE OR DELETE ON public.nei_coverage_events FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_bar_imm BEFORE UPDATE OR DELETE ON public.nei_accessibility_barriers FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();
CREATE TRIGGER nei_bare_imm BEFORE UPDATE OR DELETE ON public.nei_barrier_events FOR EACH ROW EXECUTE FUNCTION public.sia_immutable();

-- Gestão do NEI na escola (coordenação/técnico/estação; AEE não gere apoio nem barreira).
CREATE OR REPLACE FUNCTION public.nei_school_manager(_school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND (public.nei_is_station(auth.uid()) OR EXISTS (SELECT 1 FROM public.nei_active_grants(auth.uid()) g
    WHERE g.role IN ('coordenador','tecnico') AND (g.scope_kind = 'rede' OR (g.scope_kind = 'escola' AND g.school_id = _school))))
$$;
REVOKE ALL ON FUNCTION public.nei_school_manager(text) FROM PUBLIC, anon, authenticated;

-- Atuação vigente na escola (existente; nunca criada aqui).
CREATE OR REPLACE FUNCTION public.nei_engagement_active_at(_eng uuid, _school text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = _eng AND (e.school_id = _school OR e.scope_level = 'rede')
    AND e.valid_from <= CURRENT_DATE AND (e.valid_until IS NULL OR e.valid_until >= CURRENT_DATE)
    AND NOT EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = e.id AND x.ended_on <= CURRENT_DATE))
$$;
REVOKE ALL ON FUNCTION public.nei_engagement_active_at(uuid,text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.nei_mediation_head(_logical uuid) RETURNS public.inclusion_mediation_assignments
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT m.* FROM public.inclusion_mediation_assignments m WHERE m.logical_id = _logical ORDER BY m.version DESC LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.nei_mediation_head(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.open_nei_support_request(_student text, _school text, _kind text, _justification text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE rid uuid;
BEGIN
  IF NOT public.nei_school_manager(_school) THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  IF NOT public.nei_enrolled_in(_student, _school) THEN RAISE EXCEPTION 'nei:student-not-in-school'; END IF;
  INSERT INTO public.nei_support_requests(student_id, school_id, support_kind, justification, opened_by) VALUES (_student, _school, _kind, _justification, auth.uid()) RETURNING id INTO rid;
  INSERT INTO public.nei_support_request_events(request_id, seq, stage, note, recorded_by) VALUES (rid, 1, 'solicitada', _justification, auth.uid());
  PERFORM public.nei_log('apoio-solicitacao', _school, 'permitido');
  RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.open_nei_support_request(text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_nei_support_request(text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.nei_support_next_allowed(_from text, _to text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT (_from, _to) IN (('solicitada','em-analise'),('solicitada','cancelada'),('em-analise','encaminhada'),('em-analise','indeferida'),('em-analise','cancelada'),
    ('encaminhada','designada'),('encaminhada','indeferida'),('encaminhada','em-analise'),('designada','encerrada'),('designada','em-analise'))
$$;

-- Designação: só referência a designação/atuação EXISTENTE e vigente na escola, para o mesmo estudante quando for mediação.
CREATE OR REPLACE FUNCTION public.record_nei_support_event(_request uuid, _expected_seq integer, _stage text, _note text, _forwarded_to text DEFAULT NULL, _mediation uuid DEFAULT NULL, _engagement uuid DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.nei_support_requests; last public.nei_support_request_events; m public.inclusion_mediation_assignments;
BEGIN
  SELECT * INTO r FROM public.nei_support_requests WHERE id = _request FOR UPDATE;
  IF r.id IS NULL OR NOT public.nei_school_manager(r.school_id) THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  SELECT * INTO last FROM public.nei_support_request_events WHERE request_id = _request ORDER BY seq DESC LIMIT 1;
  IF last.seq <> _expected_seq THEN RAISE EXCEPTION 'nei:stale-version'; END IF;
  IF NOT public.nei_support_next_allowed(last.stage, _stage) THEN RAISE EXCEPTION 'nei:invalid-transition'; END IF;
  IF _stage = 'designada' THEN
    IF _mediation IS NOT NULL THEN
      m := public.nei_mediation_head(_mediation);
      IF m.id IS NULL OR m.student_id <> r.student_id OR m.school_id <> r.school_id OR m.event_kind = 'encerramento'
         OR m.valid_from > CURRENT_DATE OR (m.valid_to IS NOT NULL AND m.valid_to < CURRENT_DATE) THEN RAISE EXCEPTION 'nei:designation-not-found'; END IF;
    ELSIF _engagement IS NULL OR NOT public.nei_engagement_active_at(_engagement, r.school_id) THEN RAISE EXCEPTION 'nei:designation-not-found';
    END IF;
  END IF;
  INSERT INTO public.nei_support_request_events(request_id, seq, stage, note, forwarded_to, mediation_logical_id, engagement_id, recorded_by)
  VALUES (_request, last.seq + 1, _stage, _note, nullif(btrim(coalesce(_forwarded_to,'')),''), CASE WHEN _stage = 'designada' THEN _mediation END, CASE WHEN _stage = 'designada' THEN _engagement END, auth.uid());
  PERFORM public.nei_log('apoio-andamento', r.school_id, 'permitido');
  RETURN last.seq + 1;
END $$;
REVOKE ALL ON FUNCTION public.record_nei_support_event(uuid,integer,text,text,text,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_nei_support_event(uuid,integer,text,text,text,uuid,uuid) TO authenticated;

-- Cobertura: afastamento/substituição registrados pelo NEI sobre atuações existentes; não altera DP.
-- Recusa substituto já em substituição sobreposta (conflito) ou atuação não vigente.
CREATE OR REPLACE FUNCTION public.record_nei_coverage_event(_school text, _covered uuid, _kind text, _starts date, _ends date, _substitute uuid, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE nid uuid;
BEGIN
  IF NOT public.nei_school_manager(_school) THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = _covered AND (e.school_id = _school OR e.scope_level = 'rede')) THEN RAISE EXCEPTION 'nei:engagement-not-found'; END IF;
  IF _substitute IS NOT NULL THEN
    IF NOT public.nei_engagement_active_at(_substitute, _school) THEN RAISE EXCEPTION 'nei:engagement-not-found'; END IF;
    IF EXISTS (SELECT 1 FROM public.nei_coverage_events c WHERE c.substitute_engagement_id = _substitute
       AND daterange(c.starts_on, coalesce(c.ends_on, 'infinity'::date), '[]') && daterange(_starts, coalesce(_ends, 'infinity'::date), '[]')) THEN RAISE EXCEPTION 'nei:substitute-conflict'; END IF;
    IF EXISTS (SELECT 1 FROM public.nei_coverage_events c WHERE c.covered_engagement_id = _substitute AND c.kind = 'afastamento'
       AND daterange(c.starts_on, coalesce(c.ends_on, 'infinity'::date), '[]') && daterange(_starts, coalesce(_ends, 'infinity'::date), '[]')) THEN RAISE EXCEPTION 'nei:substitute-on-leave'; END IF;
  END IF;
  INSERT INTO public.nei_coverage_events(school_id, covered_engagement_id, kind, starts_on, ends_on, substitute_engagement_id, note, recorded_by)
  VALUES (_school, _covered, _kind, _starts, _ends, _substitute, _note, auth.uid()) RETURNING id INTO nid;
  PERFORM public.nei_log('cobertura', _school, 'permitido');
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.record_nei_coverage_event(text,uuid,text,date,date,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_nei_coverage_event(text,uuid,text,date,date,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.open_nei_barrier(_school text, _student text, _category text, _description text, _priority text DEFAULT NULL, _resource text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE bid uuid;
BEGIN
  IF NOT public.nei_school_manager(_school) THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  IF _student IS NOT NULL AND NOT public.nei_enrolled_in(_student, _school) THEN RAISE EXCEPTION 'nei:student-not-in-school'; END IF;
  INSERT INTO public.nei_accessibility_barriers(school_id, student_id, category, description, opened_by) VALUES (_school, _student, _category, _description, auth.uid()) RETURNING id INTO bid;
  INSERT INTO public.nei_barrier_events(barrier_id, seq, status, priority, resource_needed, note, recorded_by)
  VALUES (bid, 1, 'identificada', nullif(btrim(coalesce(_priority,'')),''), nullif(btrim(coalesce(_resource,'')),''), _description, auth.uid());
  PERFORM public.nei_log('barreira', _school, 'permitido');
  RETURN bid;
END $$;
REVOKE ALL ON FUNCTION public.open_nei_barrier(text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_nei_barrier(text,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_nei_barrier_event(_barrier uuid, _expected_seq integer, _status text, _note text, _priority text DEFAULT NULL, _resource text DEFAULT NULL, _external_ref text DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE b public.nei_accessibility_barriers; last public.nei_barrier_events;
BEGIN
  SELECT * INTO b FROM public.nei_accessibility_barriers WHERE id = _barrier FOR UPDATE;
  IF b.id IS NULL OR NOT public.nei_school_manager(b.school_id) THEN RAISE EXCEPTION 'nei:not-authorized'; END IF;
  SELECT * INTO last FROM public.nei_barrier_events WHERE barrier_id = _barrier ORDER BY seq DESC LIMIT 1;
  IF last.seq <> _expected_seq THEN RAISE EXCEPTION 'nei:stale-version'; END IF;
  IF last.status IN ('resolvida','sem-solucao') THEN RAISE EXCEPTION 'nei:invalid-transition'; END IF;
  INSERT INTO public.nei_barrier_events(barrier_id, seq, status, priority, resource_needed, external_ref, note, recorded_by)
  VALUES (_barrier, last.seq + 1, _status, coalesce(nullif(btrim(coalesce(_priority,'')),''), last.priority), coalesce(nullif(btrim(coalesce(_resource,'')),''), last.resource_needed),
          coalesce(nullif(btrim(coalesce(_external_ref,'')),''), last.external_ref), _note, auth.uid());
  PERFORM public.nei_log('barreira-andamento', b.school_id, 'permitido');
  RETURN last.seq + 1;
END $$;
REVOKE ALL ON FUNCTION public.record_nei_barrier_event(uuid,integer,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_nei_barrier_event(uuid,integer,text,text,text,text,text) TO authenticated;

-- Leitura da escola: pedidos, mediações vigentes com cobertura, barreiras, profissionais elegíveis. Recusa = NULL registrado.
CREATE OR REPLACE FUNCTION public.nei_school_support(_school text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _school IS NULL OR NOT public.nei_school_manager(_school) THEN PERFORM public.nei_log('apoio-escola', _school, 'recusado'); RETURN NULL; END IF;
  PERFORM public.nei_log('apoio-escola', _school, 'permitido');
  RETURN jsonb_build_object(
    'requests', coalesce((SELECT jsonb_agg(jsonb_build_object('id', r.id, 'student_id', r.student_id,
        'student_name', (SELECT coalesce(nullif(btrim(v.social_name),''), v.civil_name) FROM public.student_identity_versions v WHERE v.student_id = r.student_id ORDER BY v.version DESC LIMIT 1),
        'support_kind', r.support_kind, 'justification', r.justification, 'opened_at', r.opened_at,
        'events', (SELECT jsonb_agg(jsonb_build_object('seq', e.seq, 'stage', e.stage, 'note', e.note, 'forwarded_to', e.forwarded_to, 'linked', e.mediation_logical_id IS NOT NULL OR e.engagement_id IS NOT NULL, 'recorded_at', e.recorded_at) ORDER BY e.seq) FROM public.nei_support_request_events e WHERE e.request_id = r.id))
      ORDER BY r.opened_at DESC) FROM public.nei_support_requests r WHERE r.school_id = _school), '[]'::jsonb),
    'mediations', coalesce((SELECT jsonb_agg(jsonb_build_object('logical_id', m.logical_id, 'student_id', m.student_id,
        'student_name', (SELECT coalesce(nullif(btrim(v.social_name),''), v.civil_name) FROM public.student_identity_versions v WHERE v.student_id = m.student_id ORDER BY v.version DESC LIMIT 1),
        'mediator_engagement_id', m.mediator_engagement_id,
        'mediator_name', (SELECT p.display_name FROM public.institutional_engagements e JOIN public.institutional_persons p ON p.id = e.person_id WHERE e.id = m.mediator_engagement_id),
        'mediator_active', public.nei_engagement_active_at(m.mediator_engagement_id, m.school_id),
        'on_leave', EXISTS (SELECT 1 FROM public.nei_coverage_events c WHERE c.covered_engagement_id = m.mediator_engagement_id AND c.kind = 'afastamento' AND c.starts_on <= CURRENT_DATE AND (c.ends_on IS NULL OR c.ends_on >= CURRENT_DATE)),
        'substituted', EXISTS (SELECT 1 FROM public.nei_coverage_events c WHERE c.covered_engagement_id = m.mediator_engagement_id AND c.kind = 'substituicao' AND c.starts_on <= CURRENT_DATE AND (c.ends_on IS NULL OR c.ends_on >= CURRENT_DATE)),
        'valid_from', m.valid_from, 'valid_to', m.valid_to))
      FROM (SELECT DISTINCT ON (x.logical_id) x.* FROM public.inclusion_mediation_assignments x WHERE x.school_id = _school ORDER BY x.logical_id, x.version DESC) m
      WHERE m.event_kind <> 'encerramento' AND m.valid_from <= CURRENT_DATE AND (m.valid_to IS NULL OR m.valid_to >= CURRENT_DATE)), '[]'::jsonb),
    'coverage', coalesce((SELECT jsonb_agg(jsonb_build_object('kind', c.kind, 'starts_on', c.starts_on, 'ends_on', c.ends_on, 'note', c.note,
        'covered_name', (SELECT p.display_name FROM public.institutional_engagements e JOIN public.institutional_persons p ON p.id = e.person_id WHERE e.id = c.covered_engagement_id),
        'substitute_name', (SELECT p.display_name FROM public.institutional_engagements e JOIN public.institutional_persons p ON p.id = e.person_id WHERE e.id = c.substitute_engagement_id)) ORDER BY c.starts_on DESC)
      FROM public.nei_coverage_events c WHERE c.school_id = _school), '[]'::jsonb),
    'barriers', coalesce((SELECT jsonb_agg(jsonb_build_object('id', b.id, 'category', b.category, 'description', b.description, 'has_student', b.student_id IS NOT NULL, 'opened_at', b.opened_at,
        'events', (SELECT jsonb_agg(jsonb_build_object('seq', e.seq, 'status', e.status, 'priority', e.priority, 'resource_needed', e.resource_needed, 'external_ref', e.external_ref, 'note', e.note, 'recorded_at', e.recorded_at) ORDER BY e.seq) FROM public.nei_barrier_events e WHERE e.barrier_id = b.id))
      ORDER BY b.opened_at DESC) FROM public.nei_accessibility_barriers b WHERE b.school_id = _school), '[]'::jsonb),
    'professionals', coalesce((SELECT jsonb_agg(jsonb_build_object('engagement_id', e.id, 'name', p.display_name, 'label', e.position_label_snapshot) ORDER BY p.display_name)
      FROM public.institutional_engagements e JOIN public.institutional_persons p ON p.id = e.person_id
      WHERE e.school_id = _school AND public.nei_engagement_active_at(e.id, _school)), '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.nei_school_support(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_school_support(text) TO authenticated;