-- AJ — Comunicação institucional escola ↔ família (interna ao SIGEM).
-- comunicado (identidade) ≠ versão (conteúdo+audiência, append-only) ≠ ato (publicação/cancelamento, sequência)
-- ≠ leitura/ciência (fato do leitor). Audiência derivada na leitura (data da publicação + autorização vigente),
-- nunca lista copiada. Sem anexos (ATTACHMENTS_PENDING) e sem canal externo (EXTERNAL_DELIVERY_PROVIDER_PENDING).
-- Capabilities novas (sem regra; fechadas até homologação): publicar-comunicacao-escolar (escola|rede),
-- comunicar-turma-atribuida (escola; exige atribuição docente vigente na turma), consultar-comunicacao-escolar.

CREATE TABLE public.school_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.school_communication_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL REFERENCES public.school_communications(id),
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.school_communication_versions(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 8000),
  audience_kind text NOT NULL CHECK (audience_kind IN ('familias-da-escola','familias-da-turma','equipe-da-escola')),
  class_id text REFERENCES public.institutional_classes(id),
  requires_acknowledgement boolean NOT NULL DEFAULT false,
  reason text,
  author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL, author_capability text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (communication_id, version),
  CHECK ((audience_kind = 'familias-da-turma') = (class_id IS NOT NULL)),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE UNIQUE INDEX school_communication_versions_one_successor ON public.school_communication_versions (supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE TABLE public.school_communication_acts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL REFERENCES public.school_communications(id),
  sequence integer NOT NULL CHECK (sequence >= 1),
  act text NOT NULL CHECK (act IN ('publicacao','cancelamento')),
  version_id uuid NOT NULL REFERENCES public.school_communication_versions(id),
  reason text,
  author_user_id uuid NOT NULL, author_person_id uuid NOT NULL, author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (communication_id, sequence),
  CHECK (act = 'publicacao' OR length(btrim(coalesce(reason,''))) > 0)
);
CREATE TABLE public.school_communication_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  communication_id uuid NOT NULL REFERENCES public.school_communications(id),
  version_id uuid NOT NULL REFERENCES public.school_communication_versions(id),
  reader_user_id uuid NOT NULL,
  student_id text REFERENCES public.institutional_students(id),
  kind text NOT NULL CHECK (kind IN ('leitura','ciencia')),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX school_communication_receipts_once ON public.school_communication_receipts (version_id, reader_user_id, coalesce(student_id, ''), kind);
CREATE INDEX school_communications_school ON public.school_communications (school_id);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['school_communications','school_communication_versions','school_communication_acts','school_communication_receipts'] LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.import_append_only()', t || '_append_only', t);
  END LOOP;
END $$;

-- Autoridade de autoria: capability escolar; turma por professor exige atribuição docente vigente da própria atuação.
CREATE FUNCTION public.comm_author_grant(_school text, _audience text, _class text, OUT engagement uuid, OUT capability text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT c.engagement_id, c.capability_id INTO engagement, capability FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = 'publicar-comunicacao-escolar' AND c.policy_id IS NOT NULL
     AND ((c.scope_level = 'escola' AND c.school_id = _school) OR c.scope_level = 'rede')
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  IF engagement IS NOT NULL THEN RETURN; END IF;
  IF _audience = 'familias-da-turma' THEN
    SELECT c.engagement_id, c.capability_id INTO engagement, capability FROM public.effective_scope_capabilities(CURRENT_DATE) c
     WHERE c.capability_id = 'comunicar-turma-atribuida' AND c.policy_id IS NOT NULL AND c.scope_level = 'escola' AND c.school_id = _school
       AND EXISTS (SELECT 1 FROM public.teaching_assignments a JOIN public.teaching_assignment_versions v ON v.assignment_id = a.id
                    WHERE a.class_id = _class AND v.engagement_id = c.engagement_id
                      AND NOT EXISTS (SELECT 1 FROM public.teaching_assignment_versions x WHERE x.supersedes_id = v.id)
                      AND v.valid_from <= CURRENT_DATE AND (v.valid_until IS NULL OR v.valid_until >= CURRENT_DATE))
     ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
    IF engagement IS NOT NULL THEN RETURN; END IF;
  END IF;
  RAISE EXCEPTION 'capability:publicar-comunicacao-escolar';
END $fn$;
REVOKE ALL ON FUNCTION public.comm_author_grant(text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Episódio de turma vigente na data (cabeça da cadeia, sem encerramento anterior à data).
CREATE FUNCTION public.comm_student_in_class(_student text, _class text, _on date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.class_enrollment_episodes e
    WHERE e.student_id = _student AND e.class_id = _class AND e.valid_from <= _on
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = e.id)
      AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episode_endings x WHERE x.episode_id = e.id AND x.ended_on < _on))
$fn$;
REVOKE ALL ON FUNCTION public.comm_student_in_class(text, text, date) FROM PUBLIC, anon, authenticated, service_role;

-- Writers ------------------------------------------------------------------------------------------
CREATE FUNCTION public.record_school_communication_version(_communication uuid, _expected_version integer, _school text,
  _title text, _body text, _audience text, _class text, _requires_ack boolean, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g record; head public.school_communication_versions; c uuid := _communication; r uuid;
BEGIN
  me := public.af_natural_person();
  IF c IS NOT NULL THEN
    SELECT school_id INTO _school FROM public.school_communications WHERE id = c FOR UPDATE;
    IF _school IS NULL THEN RAISE EXCEPTION 'comm:unknown'; END IF;
    SELECT * INTO head FROM public.school_communication_versions WHERE communication_id = c ORDER BY version DESC LIMIT 1;
    IF _expected_version IS DISTINCT FROM head.version THEN RAISE EXCEPTION 'comm:stale'; END IF;
    IF EXISTS (SELECT 1 FROM public.school_communication_acts a WHERE a.communication_id = c AND a.act = 'cancelamento') THEN RAISE EXCEPTION 'comm:cancelled'; END IF;
  ELSIF _expected_version IS NOT NULL THEN RAISE EXCEPTION 'comm:stale';
  END IF;
  IF _audience NOT IN ('familias-da-escola','familias-da-turma','equipe-da-escola') THEN RAISE EXCEPTION 'comm:audience-invalid'; END IF;
  IF _audience = 'familias-da-turma' THEN
    IF _class IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_classes k WHERE k.id = _class AND k.school_id = _school) THEN RAISE EXCEPTION 'comm:class-outside-school'; END IF;
  ELSE _class := NULL; END IF;
  SELECT * INTO g FROM public.comm_author_grant(_school, _audience, _class);
  IF c IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _school) THEN RAISE EXCEPTION 'comm:school-unknown'; END IF;
    INSERT INTO public.school_communications(school_id) VALUES (_school) RETURNING id INTO c;
  END IF;
  INSERT INTO public.school_communication_versions(communication_id, version, supersedes_id, title, body, audience_kind, class_id, requires_acknowledgement,
    reason, author_user_id, author_person_id, author_engagement, author_capability)
  VALUES (c, coalesce(head.version,0)+1, head.id, btrim(_title), btrim(_body), _audience, _class, coalesce(_requires_ack,false),
    nullif(btrim(_reason),''), auth.uid(), me, g.engagement, g.capability)
  RETURNING id INTO r;
  RETURN c;
END $fn$;

-- Publicar a versão vigente (primeira publicação ou retificação publicada) ou cancelar.
CREATE FUNCTION public.record_school_communication_act(_communication uuid, _expected_sequence integer, _act text, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE me uuid; g record; head public.school_communication_versions; last public.school_communication_acts; sch text; s integer;
BEGIN
  me := public.af_natural_person();
  SELECT school_id INTO sch FROM public.school_communications WHERE id = _communication FOR UPDATE;
  IF sch IS NULL THEN RAISE EXCEPTION 'comm:unknown'; END IF;
  SELECT * INTO head FROM public.school_communication_versions WHERE communication_id = _communication ORDER BY version DESC LIMIT 1;
  SELECT * INTO g FROM public.comm_author_grant(sch, head.audience_kind, head.class_id);
  IF _act NOT IN ('publicacao','cancelamento') THEN RAISE EXCEPTION 'comm:act-invalid'; END IF;
  SELECT * INTO last FROM public.school_communication_acts WHERE communication_id = _communication ORDER BY sequence DESC LIMIT 1;
  IF coalesce(last.sequence,0) IS DISTINCT FROM coalesce(_expected_sequence,0) THEN RAISE EXCEPTION 'comm:stale'; END IF;
  IF last.act = 'cancelamento' THEN RAISE EXCEPTION 'comm:cancelled'; END IF;
  IF _act = 'publicacao' AND last.version_id = head.id THEN RAISE EXCEPTION 'comm:already-published'; END IF;
  IF _act = 'cancelamento' AND last.id IS NULL THEN RAISE EXCEPTION 'comm:not-published'; END IF;
  s := coalesce(last.sequence,0) + 1;
  INSERT INTO public.school_communication_acts(communication_id, sequence, act, version_id, reason, author_user_id, author_person_id, author_engagement)
  VALUES (_communication, s, _act, head.id, nullif(btrim(_reason),''), auth.uid(), me, g.engagement);
  RETURN s;
END $fn$;

-- Readers ------------------------------------------------------------------------------------------
-- Equipe: comunicados da escola com estado derivado e contagem de leituras/ciências (sem identificar leitores).
CREATE FUNCTION public.school_communications_at(_school text)
RETURNS TABLE(communication_id uuid, version integer, version_id uuid, title text, body text, audience_kind text, class_id text,
  requires_acknowledgement boolean, author_capability text, recorded_at timestamptz, state text, last_sequence integer,
  published_version integer, published_at timestamptz, reads integer, acknowledgements integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
#variable_conflict use_column
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c WHERE c.policy_id IS NOT NULL
      AND c.capability_id IN ('publicar-comunicacao-escolar','consultar-comunicacao-escolar','comunicar-turma-atribuida')
      AND ((c.scope_level = 'escola' AND c.school_id = _school) OR c.scope_level = 'rede'))
  THEN RAISE EXCEPTION 'capability:consultar-comunicacao-escolar'; END IF;
  RETURN QUERY
  SELECT h.communication_id, h.version, h.id, h.title, h.body, h.audience_kind, h.class_id, h.requires_acknowledgement, h.author_capability, h.recorded_at,
    CASE WHEN la.act IS NULL THEN 'rascunho' WHEN la.act = 'cancelamento' THEN 'cancelado'
         WHEN la.version_id = h.id THEN 'publicado' ELSE 'retificacao-em-rascunho' END,
    la.sequence, pv.version, pa.recorded_at,
    (SELECT count(*)::int FROM public.school_communication_receipts r WHERE r.version_id = la.version_id AND r.kind = 'leitura'),
    (SELECT count(*)::int FROM public.school_communication_receipts r WHERE r.version_id = la.version_id AND r.kind = 'ciencia')
  FROM public.school_communications m
  JOIN LATERAL (SELECT v.* FROM public.school_communication_versions v WHERE v.communication_id = m.id ORDER BY v.version DESC LIMIT 1) h ON true
  LEFT JOIN LATERAL (SELECT a.* FROM public.school_communication_acts a WHERE a.communication_id = m.id ORDER BY a.sequence DESC LIMIT 1) la ON true
  LEFT JOIN LATERAL (SELECT a.* FROM public.school_communication_acts a WHERE a.communication_id = m.id AND a.act = 'publicacao' ORDER BY a.sequence DESC LIMIT 1) pa ON true
  LEFT JOIN public.school_communication_versions pv ON pv.id = pa.version_id
  WHERE m.school_id = _school
    -- professor sem capability ampla vê só comunicados da própria autoria
    AND (EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c WHERE c.policy_id IS NOT NULL
           AND c.capability_id IN ('publicar-comunicacao-escolar','consultar-comunicacao-escolar')
           AND ((c.scope_level = 'escola' AND c.school_id = _school) OR c.scope_level = 'rede'))
         OR EXISTS (SELECT 1 FROM public.school_communication_versions o WHERE o.communication_id = m.id AND o.author_user_id = auth.uid()))
  ORDER BY h.recorded_at DESC LIMIT 300;
END $fn$;

CREATE FUNCTION public.school_communication_history(_communication uuid)
RETURNS TABLE(entry_kind text, number integer, detail text, reason text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE sch text;
BEGIN
  SELECT school_id INTO sch FROM public.school_communications WHERE id = _communication;
  IF sch IS NULL OR NOT EXISTS (SELECT 1 FROM public.school_communications_at(sch) x WHERE x.communication_id = _communication)
  THEN RAISE EXCEPTION 'comm:not-available'; END IF;
  RETURN QUERY
    SELECT 'versao', v.version, v.title, v.reason, v.recorded_at FROM public.school_communication_versions v WHERE v.communication_id = _communication
    UNION ALL
    SELECT a.act, a.sequence, (SELECT 'versão ' || v.version FROM public.school_communication_versions v WHERE v.id = a.version_id), a.reason, a.recorded_at
      FROM public.school_communication_acts a WHERE a.communication_id = _communication
    ORDER BY 5;
END $fn$;

-- Família: comunicados publicados (versão da última publicação, não cancelados) cuja audiência inclui o educando
-- na data da publicação, com autorização vigente HOJE na seção 'comunicados'. Rascunho e cancelado nunca aparecem.
CREATE FUNCTION public.family_communications(_student text)
RETURNS TABLE(communication_id uuid, version_id uuid, version integer, title text, body text, published_at timestamptz,
  rectified boolean, requires_acknowledgement boolean, read_at timestamptz, acknowledged_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
#variable_conflict use_column
DECLARE sch text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT a.school_id INTO sch FROM public.guardian_authorizations a
   WHERE a.guardian_user_id = auth.uid() AND a.student_id = _student AND a.event_kind <> 'revogacao' AND 'comunicados' = ANY (a.sections)
     AND NOT EXISTS (SELECT 1 FROM public.guardian_authorizations s WHERE s.supersedes_id = a.id)
     AND a.valid_from <= CURRENT_DATE AND (a.valid_until IS NULL OR a.valid_until >= CURRENT_DATE)
   ORDER BY a.recorded_at DESC LIMIT 1;
  IF sch IS NULL THEN RAISE EXCEPTION 'family:not-authorized'; END IF;
  RETURN QUERY
  SELECT m.id, v.id, v.version, v.title, v.body, la.recorded_at, v.version > 1, v.requires_acknowledgement,
    (SELECT r.recorded_at FROM public.school_communication_receipts r WHERE r.version_id = v.id AND r.reader_user_id = auth.uid() AND r.student_id = _student AND r.kind = 'leitura'),
    (SELECT r.recorded_at FROM public.school_communication_receipts r WHERE r.version_id = v.id AND r.reader_user_id = auth.uid() AND r.student_id = _student AND r.kind = 'ciencia')
  FROM public.school_communications m
  JOIN LATERAL (SELECT a.* FROM public.school_communication_acts a WHERE a.communication_id = m.id ORDER BY a.sequence DESC LIMIT 1) la ON la.act = 'publicacao'
  JOIN public.school_communication_versions v ON v.id = la.version_id
  WHERE m.school_id = sch
    AND (v.audience_kind = 'familias-da-escola'
         OR (v.audience_kind = 'familias-da-turma' AND public.comm_student_in_class(_student, v.class_id, (la.recorded_at AT TIME ZONE 'America/Sao_Paulo')::date)))
  ORDER BY la.recorded_at DESC LIMIT 200;
END $fn$;

-- Leitura e ciência: fatos distintos, só pelo próprio leitor e só sobre versão que ele pode ver agora.
CREATE FUNCTION public.record_family_communication_receipt(_student text, _version uuid, _kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE c uuid; req boolean;
BEGIN
  IF _kind NOT IN ('leitura','ciencia') THEN RAISE EXCEPTION 'comm:kind-invalid'; END IF;
  SELECT f.communication_id, f.requires_acknowledgement INTO c, req FROM public.family_communications(_student) f WHERE f.version_id = _version;
  IF c IS NULL THEN RAISE EXCEPTION 'comm:not-available'; END IF;
  IF _kind = 'ciencia' AND NOT req THEN RAISE EXCEPTION 'comm:acknowledgement-not-requested'; END IF;
  INSERT INTO public.school_communication_receipts(communication_id, version_id, reader_user_id, student_id, kind)
  VALUES (c, _version, auth.uid(), _student, _kind) ON CONFLICT DO NOTHING;
END $fn$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['record_school_communication_version(uuid,integer,text,text,text,text,text,boolean,text)',
    'record_school_communication_act(uuid,integer,text,text)','school_communications_at(text)','school_communication_history(uuid)',
    'family_communications(text)','record_family_communication_receipt(text,uuid,text)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, service_role', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;