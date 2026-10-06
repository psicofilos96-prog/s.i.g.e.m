-- AH — Educação inclusiva: AEE como entidade própria, agenda e sessões separadas do Diário regular,
-- vínculo do mediador com vigência da atuação e sem sobreposição, estação do mediador, visão mínima docente
-- e visão de rede sem conteúdo. Sem diagnóstico/CID/condição; elegibilidade nunca é inferida nem calculada:
-- sem regra institucional homologada o estado é sempre 'regra-institucional-pendente'.
-- Capabilities novas (sem regra de política; fechadas até homologação humana):
--   escola: organizar-atendimento-aee · registrar-sessao-aee   rede: acompanhar-educacao-inclusiva-rede

CREATE FUNCTION public.ah_grant(_capability text, _school text) RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability NOT IN ('organizar-atendimento-aee','registrar-sessao-aee','consultar-apoio-inclusivo') THEN RAISE EXCEPTION 'inclusion:capability-not-allowed'; END IF;
  IF _school IS NULL THEN RAISE EXCEPTION 'inclusion:school-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL AND c.scope_level = 'escola' AND c.school_id = _school
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.ah_grant(text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE FUNCTION public.ah_engagement_active(_engagement uuid, _on date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = _engagement
    AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    AND NOT EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = e.id AND x.ended_on <= _on))
$fn$;
REVOKE ALL ON FUNCTION public.ah_engagement_active(uuid, date) FROM PUBLIC, anon, authenticated, service_role;

-- 1/4 — AEE deixa de nascer como tipo de registro genérico; legados seguem legíveis.
CREATE FUNCTION public.ah_inclusion_records_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF NEW.version = 1 AND NEW.record_type IN ('participacao-aee','atendimento-aee') THEN
    RAISE EXCEPTION 'inclusion:aee-is-own-entity'; END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.ah_inclusion_records_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER ah_inclusion_records_guard BEFORE INSERT ON public.inclusion_records FOR EACH ROW EXECUTE FUNCTION public.ah_inclusion_records_guard();
COMMENT ON COLUMN public.inclusion_records.record_type IS 'participacao-aee/atendimento-aee DEPRECATED para novos registros: AEE vive em aee_services/aee_sessions (AH).';

-- 3 — mediação: atuação vigente na data inicial e sem sobreposição do mesmo mediador para o mesmo educando.
CREATE FUNCTION public.ah_mediation_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF NEW.event_kind <> 'encerramento' THEN
    IF NOT public.ah_engagement_active(NEW.mediator_engagement_id, NEW.valid_from) THEN
      RAISE EXCEPTION 'inclusion:mediator-engagement-not-active'; END IF;
    IF EXISTS (SELECT 1 FROM public.inclusion_mediation_assignments m
      WHERE m.student_id = NEW.student_id AND m.mediator_engagement_id = NEW.mediator_engagement_id
        AND m.logical_id <> NEW.logical_id AND m.event_kind <> 'encerramento'
        AND NOT EXISTS (SELECT 1 FROM public.inclusion_mediation_assignments s WHERE s.supersedes_id = m.id)
        AND daterange(m.valid_from, m.valid_to, '[]') && daterange(NEW.valid_from, NEW.valid_to, '[]'))
    THEN RAISE EXCEPTION 'inclusion:mediation-overlap'; END IF;
  END IF;
  IF NEW.valid_from IS NULL THEN RAISE EXCEPTION 'inclusion:valid-from-required'; END IF;
  RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION public.ah_mediation_guard() FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER ah_mediation_guard BEFORE INSERT ON public.inclusion_mediation_assignments FOR EACH ROW EXECUTE FUNCTION public.ah_mediation_guard();

-- 4 — atendimento AEE (organização) e agenda.
CREATE TABLE public.aee_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.aee_services(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','encerramento')),
  school_id text NOT NULL,
  student_id text NOT NULL,
  responsible_engagement_id uuid NOT NULL REFERENCES public.institutional_engagements(id),
  valid_from date NOT NULL,
  valid_to date,
  origin_kind text NOT NULL CHECK (origin_kind IN ('decisao-escolar-registrada')),
  reason text,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL,
  author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE UNIQUE INDEX aee_services_one_successor ON public.aee_services (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX aee_services_school ON public.aee_services (school_id, student_id);
CREATE TABLE public.aee_service_slots (
  service_version_id uuid NOT NULL REFERENCES public.aee_services(id),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  starts_at time NOT NULL,
  ends_at time NOT NULL CHECK (ends_at > starts_at),
  PRIMARY KEY (service_version_id, weekday, starts_at)
);
-- Sessão do atendimento: frequência AEE própria (valor de catálogo homologado), nunca a frequência da turma regular.
CREATE TABLE public.aee_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.aee_sessions(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','anulacao')),
  service_logical_id uuid NOT NULL,
  school_id text NOT NULL,
  student_id text NOT NULL,
  session_date date NOT NULL,
  presence_scheme_id text NOT NULL,
  presence_value_id text NOT NULL,
  presence_value_version integer NOT NULL,
  pedagogical_note text CHECK (pedagogical_note IS NULL OR (length(btrim(pedagogical_note)) > 0 AND length(pedagogical_note) <= 1000)),
  reason text,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL,
  author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE UNIQUE INDEX aee_sessions_one_successor ON public.aee_sessions (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX aee_sessions_service ON public.aee_sessions (service_logical_id, session_date);

GRANT SELECT ON public.aee_services, public.aee_service_slots, public.aee_sessions TO service_role;
ALTER TABLE public.aee_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aee_service_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aee_sessions ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER aee_services_append_only BEFORE UPDATE OR DELETE ON public.aee_services FOR EACH ROW EXECUTE FUNCTION public.import_append_only();
CREATE TRIGGER aee_service_slots_append_only BEFORE UPDATE OR DELETE ON public.aee_service_slots FOR EACH ROW EXECUTE FUNCTION public.import_append_only();
CREATE TRIGGER aee_sessions_append_only BEFORE UPDATE OR DELETE ON public.aee_sessions FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

-- 5 — automação não grava diretamente em nenhuma tabela de inclusão (só leitura técnica).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.inclusion_records, public.inclusion_mediation_assignments,
  public.inclusion_attachments, public.inclusion_access_events FROM service_role;

CREATE FUNCTION public.record_aee_service(_base_id uuid, _kind text, _school text, _student text,
  _responsible_engagement uuid, _valid_from date, _valid_to date, _slots jsonb, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; me uuid; base public.aee_services; r uuid; s jsonb;
BEGIN
  me := public.af_natural_person();
  IF _kind NOT IN ('registro','retificacao','encerramento') THEN RAISE EXCEPTION 'inclusion:kind-invalid'; END IF;
  IF _kind = 'registro' THEN
    IF _base_id IS NOT NULL THEN RAISE EXCEPTION 'inclusion:base-not-allowed'; END IF;
  ELSE
    SELECT * INTO base FROM public.aee_services WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'inclusion:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.aee_services WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'inclusion:base-superseded'; END IF;
    IF base.event_kind = 'encerramento' THEN RAISE EXCEPTION 'inclusion:already-closed'; END IF;
    _school := base.school_id; _student := base.student_id;
    IF _kind = 'encerramento' THEN
      _responsible_engagement := base.responsible_engagement_id; _valid_from := base.valid_from;
      IF _valid_to IS NULL THEN RAISE EXCEPTION 'inclusion:valid-to-required'; END IF;
      SELECT coalesce(jsonb_agg(jsonb_build_object('weekday',weekday,'starts_at',starts_at,'ends_at',ends_at)),'[]') INTO _slots
        FROM public.aee_service_slots WHERE service_version_id = base.id;
    END IF;
  END IF;
  g := public.ah_grant('organizar-atendimento-aee', _school);
  IF g IS NULL THEN RAISE EXCEPTION 'capability:organizar-atendimento-aee'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'inclusion:valid-from-required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _student AND e.school_id = _school) THEN
    RAISE EXCEPTION 'inclusion:student-not-in-school'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = _responsible_engagement AND e.school_id = _school)
     OR NOT public.ah_engagement_active(_responsible_engagement, _valid_from) THEN
    RAISE EXCEPTION 'inclusion:responsible-not-active-in-school'; END IF;
  IF _kind <> 'encerramento' AND EXISTS (SELECT 1 FROM public.aee_services a
     WHERE a.school_id = _school AND a.student_id = _student AND a.logical_id <> coalesce(base.logical_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND a.event_kind <> 'encerramento' AND NOT EXISTS (SELECT 1 FROM public.aee_services x WHERE x.supersedes_id = a.id)
       AND daterange(a.valid_from, a.valid_to, '[]') && daterange(_valid_from, _valid_to, '[]'))
  THEN RAISE EXCEPTION 'inclusion:aee-overlap'; END IF;
  IF _slots IS NULL OR jsonb_typeof(_slots) <> 'array' THEN RAISE EXCEPTION 'inclusion:slots-invalid'; END IF;
  INSERT INTO public.aee_services(logical_id, version, supersedes_id, event_kind, school_id, student_id, responsible_engagement_id,
    valid_from, valid_to, origin_kind, reason, author_user_id, author_person_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _school, _student, _responsible_engagement,
    _valid_from, _valid_to, 'decisao-escolar-registrada', nullif(btrim(_reason),''), auth.uid(), me, g)
  RETURNING id INTO r;
  FOR s IN SELECT * FROM jsonb_array_elements(_slots) LOOP
    BEGIN
      INSERT INTO public.aee_service_slots VALUES (r, (s->>'weekday')::smallint, (s->>'starts_at')::time, (s->>'ends_at')::time);
    EXCEPTION WHEN check_violation OR invalid_text_representation OR invalid_datetime_format OR not_null_violation OR unique_violation OR datetime_field_overflow THEN
      RAISE EXCEPTION 'inclusion:slots-invalid';
    END;
  END LOOP;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.record_aee_service(uuid,text,text,text,uuid,date,date,jsonb,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_aee_service(uuid,text,text,text,uuid,date,date,jsonb,text) TO authenticated;

CREATE FUNCTION public.record_aee_session(_base_id uuid, _kind text, _service_logical uuid, _date date,
  _presence_scheme text, _presence_value text, _note text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; me uuid; base public.aee_sessions; svc public.aee_services; cat record; r uuid;
BEGIN
  me := public.af_natural_person();
  IF _kind NOT IN ('registro','retificacao','anulacao') THEN RAISE EXCEPTION 'inclusion:kind-invalid'; END IF;
  IF _kind <> 'registro' THEN
    SELECT * INTO base FROM public.aee_sessions WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'inclusion:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.aee_sessions WHERE supersedes_id = base.id) THEN RAISE EXCEPTION 'inclusion:base-superseded'; END IF;
    IF base.event_kind = 'anulacao' THEN RAISE EXCEPTION 'inclusion:already-annulled'; END IF;
    _service_logical := base.service_logical_id; _date := base.session_date;
    IF _kind = 'anulacao' THEN _presence_scheme := base.presence_scheme_id; _presence_value := base.presence_value_id; _note := base.pedagogical_note; END IF;
  ELSIF _base_id IS NOT NULL THEN RAISE EXCEPTION 'inclusion:base-not-allowed';
  END IF;
  -- versão do atendimento vigente na data da sessão (cadeia sem sucessora e não encerrada antes da data)
  SELECT a.* INTO svc FROM public.aee_services a WHERE a.logical_id = _service_logical
    AND NOT EXISTS (SELECT 1 FROM public.aee_services x WHERE x.supersedes_id = a.id);
  IF svc.id IS NULL THEN RAISE EXCEPTION 'inclusion:aee-unknown'; END IF;
  g := public.ah_grant('registrar-sessao-aee', svc.school_id);
  IF g IS NULL THEN RAISE EXCEPTION 'capability:registrar-sessao-aee'; END IF;
  IF _date IS NULL OR _date < svc.valid_from OR (svc.valid_to IS NOT NULL AND _date > svc.valid_to) THEN
    RAISE EXCEPTION 'inclusion:session-outside-service'; END IF;
  SELECT d.value_id, d.version INTO cat FROM public.attribute_value_definitions d
   WHERE d.scheme_id = _presence_scheme AND d.value_id = _presence_value AND d.status = 'homologado' ORDER BY d.version DESC LIMIT 1;
  IF cat.value_id IS NULL THEN RAISE EXCEPTION 'inclusion:presence-not-homologated'; END IF;
  IF _kind = 'registro' AND EXISTS (SELECT 1 FROM public.aee_sessions s WHERE s.service_logical_id = _service_logical AND s.session_date = _date
     AND s.event_kind <> 'anulacao' AND NOT EXISTS (SELECT 1 FROM public.aee_sessions x WHERE x.supersedes_id = s.id))
  THEN RAISE EXCEPTION 'inclusion:session-duplicate'; END IF;
  INSERT INTO public.aee_sessions(logical_id, version, supersedes_id, event_kind, service_logical_id, school_id, student_id, session_date,
    presence_scheme_id, presence_value_id, presence_value_version, pedagogical_note, reason, author_user_id, author_person_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version,0)+1, base.id, _kind, _service_logical, svc.school_id, svc.student_id, _date,
    _presence_scheme, cat.value_id, cat.version, nullif(btrim(_note),''), nullif(btrim(_reason),''), auth.uid(), me, g)
  RETURNING id INTO r;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.record_aee_session(uuid,text,uuid,date,text,text,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_aee_session(uuid,text,uuid,date,text,text,text,text) TO authenticated;

-- Readers --------------------------------------------------------------------------------------------
CREATE FUNCTION public.aee_services_at(_school text, _student text, _known_at timestamptz)
RETURNS TABLE(id uuid, logical_id uuid, version integer, event_kind text, student_id text, responsible_engagement_id uuid,
  valid_from date, valid_to date, origin_kind text, reason text, recorded_at timestamptz, slots jsonb, eligibility_status text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF public.ah_grant('consultar-apoio-inclusivo', _school) IS NULL AND public.ah_grant('organizar-atendimento-aee', _school) IS NULL
     AND public.ah_grant('registrar-sessao-aee', _school) IS NULL THEN RAISE EXCEPTION 'capability:consultar-apoio-inclusivo'; END IF;
  RETURN QUERY SELECT a.id, a.logical_id, a.version, a.event_kind, a.student_id, a.responsible_engagement_id, a.valid_from, a.valid_to,
      a.origin_kind, a.reason, a.recorded_at,
      (SELECT coalesce(jsonb_agg(jsonb_build_object('weekday',s.weekday,'starts_at',s.starts_at,'ends_at',s.ends_at) ORDER BY s.weekday, s.starts_at),'[]')
         FROM public.aee_service_slots s WHERE s.service_version_id = a.id),
      'regra-institucional-pendente'::text
    FROM public.aee_services a
   WHERE a.school_id = _school AND a.recorded_at <= k AND (_student IS NULL OR a.student_id = _student)
     AND NOT EXISTS (SELECT 1 FROM public.aee_services x WHERE x.supersedes_id = a.id AND x.recorded_at <= k)
   ORDER BY a.valid_from DESC LIMIT 500;
END $fn$;
REVOKE ALL ON FUNCTION public.aee_services_at(text,text,timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.aee_services_at(text,text,timestamptz) TO authenticated;

CREATE FUNCTION public.aee_sessions_at(_service_logical uuid, _known_at timestamptz)
RETURNS TABLE(id uuid, logical_id uuid, version integer, event_kind text, session_date date, presence_scheme_id text,
  presence_value_id text, pedagogical_note text, reason text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE k timestamptz := coalesce(_known_at, now()); sch text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT a.school_id INTO sch FROM public.aee_services a WHERE a.logical_id = _service_logical LIMIT 1;
  -- inexistente e sem permissão respondem igual (IDOR uniforme)
  IF sch IS NULL OR (public.ah_grant('consultar-apoio-inclusivo', sch) IS NULL AND public.ah_grant('registrar-sessao-aee', sch) IS NULL)
  THEN RAISE EXCEPTION 'capability:consultar-apoio-inclusivo'; END IF;
  RETURN QUERY SELECT s.id, s.logical_id, s.version, s.event_kind, s.session_date, s.presence_scheme_id, s.presence_value_id,
      s.pedagogical_note, s.reason, s.recorded_at
    FROM public.aee_sessions s
   WHERE s.service_logical_id = _service_logical AND s.recorded_at <= k
     AND NOT EXISTS (SELECT 1 FROM public.aee_sessions x WHERE x.supersedes_id = s.id AND x.recorded_at <= k)
   ORDER BY s.session_date DESC LIMIT 500;
END $fn$;
REVOKE ALL ON FUNCTION public.aee_sessions_at(uuid,timestamptz) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.aee_sessions_at(uuid,timestamptz) TO authenticated;

-- Estação do mediador: só educandos com vínculo vigente na data, pela própria atuação. Sem condição alguma.
CREATE FUNCTION public.inclusion_my_mediated_students(_on date)
RETURNS TABLE(mediation_logical_id uuid, school_id text, student_id text, student_name text, class_id text, valid_from date, valid_to date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _on IS NULL THEN RAISE EXCEPTION 'inclusion:date-required'; END IF;
  RETURN QUERY SELECT m.logical_id, m.school_id, m.student_id, st.display_name, m.class_id, m.valid_from, m.valid_to
    FROM public.inclusion_mediation_assignments m
    JOIN public.institutional_engagements e ON e.id = m.mediator_engagement_id
    JOIN public.user_person_links l ON l.person_id = e.person_id AND l.user_id = auth.uid()
    JOIN public.institutional_students st ON st.id = m.student_id
   WHERE m.event_kind <> 'encerramento'
     AND NOT EXISTS (SELECT 1 FROM public.inclusion_mediation_assignments s WHERE s.supersedes_id = m.id)
     AND m.valid_from <= _on AND (m.valid_to IS NULL OR m.valid_to >= _on)
     AND public.ah_engagement_active(e.id, _on)
   ORDER BY st.display_name;
END $fn$;
REVOKE ALL ON FUNCTION public.inclusion_my_mediated_students(date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.inclusion_my_mediated_students(date) TO authenticated;

-- Professor: só educandos das próprias atribuições vigentes e só o fato "há mediação vigente". Sem AEE, sem conteúdo.
CREATE FUNCTION public.inclusion_teaching_support_flags(_on date)
RETURNS TABLE(class_id text, student_id text, has_active_mediation boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _on IS NULL THEN RAISE EXCEPTION 'inclusion:date-required'; END IF;
  RETURN QUERY SELECT DISTINCT ep.class_id, ep.student_id, true
    FROM (SELECT DISTINCT t.class_id FROM public.my_teaching_assignments_at(_on, now()) t) my
    JOIN public.class_enrollment_episodes ep ON ep.class_id = my.class_id AND ep.valid_from <= _on
     AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes x WHERE x.supersedes_id = ep.id)
     AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings en WHERE en.episode_id = ep.id AND en.ended_on < _on)
    JOIN public.inclusion_mediation_assignments m ON m.student_id = ep.student_id AND m.event_kind <> 'encerramento'
     AND NOT EXISTS (SELECT 1 FROM public.inclusion_mediation_assignments s WHERE s.supersedes_id = m.id)
     AND m.valid_from <= _on AND (m.valid_to IS NULL OR m.valid_to >= _on);
END $fn$;
REVOKE ALL ON FUNCTION public.inclusion_teaching_support_flags(date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.inclusion_teaching_support_flags(date) TO authenticated;

-- NEI/rede: contagens por escola na data, sem educando, sem conteúdo, sem categoria. Capability de rede explícita.
CREATE FUNCTION public.inclusion_network_overview(_on date)
RETURNS TABLE(school_id text, active_aee_services integer, active_mediations integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _on IS NULL THEN RAISE EXCEPTION 'inclusion:date-required'; END IF;
  IF NOT public.has_network_capability('acompanhar-educacao-inclusiva-rede') THEN RAISE EXCEPTION 'capability:acompanhar-educacao-inclusiva-rede'; END IF;
  RETURN QUERY WITH a AS (
      SELECT x.school_id, count(*)::int n FROM public.aee_services x WHERE x.event_kind <> 'encerramento'
        AND NOT EXISTS (SELECT 1 FROM public.aee_services y WHERE y.supersedes_id = x.id)
        AND x.valid_from <= _on AND (x.valid_to IS NULL OR x.valid_to >= _on) GROUP BY 1),
    m AS (
      SELECT x.school_id, count(*)::int n FROM public.inclusion_mediation_assignments x WHERE x.event_kind <> 'encerramento'
        AND NOT EXISTS (SELECT 1 FROM public.inclusion_mediation_assignments y WHERE y.supersedes_id = x.id)
        AND x.valid_from <= _on AND (x.valid_to IS NULL OR x.valid_to >= _on) GROUP BY 1)
    SELECT coalesce(a.school_id, m.school_id), coalesce(a.n, 0), coalesce(m.n, 0)
      FROM a FULL JOIN m ON m.school_id = a.school_id ORDER BY 1;
END $fn$;
REVOKE ALL ON FUNCTION public.inclusion_network_overview(date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.inclusion_network_overview(date) TO authenticated;
