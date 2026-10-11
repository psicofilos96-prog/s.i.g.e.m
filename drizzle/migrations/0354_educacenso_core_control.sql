-- EDUCACENSO.1 — núcleo de controle anual: leiaute registrado (nunca homologado sem documento INEP),
-- etapa da coleta com data de referência e estado por escola. Tudo append-only; gravação só por DEFINER.
CREATE TABLE public.educacenso_layout_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  census_year text NOT NULL CHECK (census_year ~ '^[0-9]{4}$'),
  layout_label text NOT NULL CHECK (length(btrim(layout_label)) BETWEEN 1 AND 120),
  documentation_state text NOT NULL CHECK (documentation_state IN ('documentacao-pendente','documentacao-inep-registrada')),
  document_title text CHECK (document_title IS NULL OR length(document_title) <= 300),
  document_ref text CHECK (document_ref IS NULL OR length(document_ref) <= 500),
  document_sha256 text CHECK (document_sha256 IS NULL OR document_sha256 ~ '^[0-9a-f]{64}$'),
  reason text NOT NULL CHECK (length(btrim(reason)) > 2),
  actor_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (documentation_state = 'documentacao-pendente' OR (document_title IS NOT NULL AND document_sha256 IS NOT NULL))
);
CREATE TABLE public.educacenso_collection_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  census_year text NOT NULL CHECK (census_year ~ '^[0-9]{4}$'),
  stage_key text NOT NULL CHECK (stage_key ~ '^[a-z0-9-]{3,60}$'),
  stage_label text NOT NULL CHECK (length(btrim(stage_label)) BETWEEN 1 AND 120),
  seq integer NOT NULL CHECK (seq > 0),
  act text NOT NULL CHECK (act IN ('configurar','abrir','encerrar','reabrir')),
  reference_date date,
  layout_registration_id uuid REFERENCES public.educacenso_layout_registrations(id),
  reason text NOT NULL CHECK (length(btrim(reason)) > 2),
  actor_user_id uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (census_year, stage_key, seq)
);
CREATE TABLE public.educacenso_school_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  census_year text NOT NULL,
  stage_key text NOT NULL,
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  seq integer NOT NULL CHECK (seq > 0),
  state text NOT NULL CHECK (state IN ('em-preparacao','pendencias-em-correcao','conferida-pela-escola','devolvida-pela-rede','declarada-enviada-ao-inep','em-retificacao')),
  protocol_ref text CHECK (protocol_ref IS NULL OR length(protocol_ref) <= 200),
  reason text NOT NULL CHECK (length(btrim(reason)) > 2),
  actor_user_id uuid NOT NULL,
  actor_scope text NOT NULL CHECK (actor_scope IN ('escola','rede')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (census_year, stage_key, school_id, seq),
  CHECK (state <> 'declarada-enviada-ao-inep' OR protocol_ref IS NOT NULL)
);
CREATE INDEX educacenso_school_status_lookup ON public.educacenso_school_status_events (census_year, stage_key, school_id, seq DESC);

GRANT SELECT ON public.educacenso_layout_registrations, public.educacenso_collection_events, public.educacenso_school_status_events TO authenticated;
GRANT ALL ON public.educacenso_layout_registrations, public.educacenso_collection_events, public.educacenso_school_status_events TO service_role;
ALTER TABLE public.educacenso_layout_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educacenso_collection_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.educacenso_school_status_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY educacenso_layout_read ON public.educacenso_layout_registrations FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY educacenso_collection_read ON public.educacenso_collection_events FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY educacenso_school_status_read ON public.educacenso_school_status_events FOR SELECT TO authenticated
  USING (public.census_can_read_network() OR public.has_school_capability('consultar-pendencias-do-censo', school_id) OR public.has_school_capability('preparar-censo-escolar', school_id));

CREATE OR REPLACE FUNCTION public.educacenso_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'educacenso:append-only'; END $$;
CREATE TRIGGER educacenso_layout_immutable BEFORE UPDATE OR DELETE ON public.educacenso_layout_registrations FOR EACH ROW EXECUTE FUNCTION public.educacenso_append_only();
CREATE TRIGGER educacenso_collection_immutable BEFORE UPDATE OR DELETE ON public.educacenso_collection_events FOR EACH ROW EXECUTE FUNCTION public.educacenso_append_only();
CREATE TRIGGER educacenso_school_status_immutable BEFORE UPDATE OR DELETE ON public.educacenso_school_status_events FOR EACH ROW EXECUTE FUNCTION public.educacenso_append_only();

CREATE OR REPLACE FUNCTION public.educacenso_register_layout(_year text, _label text, _doc_title text, _doc_ref text, _doc_sha256 text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE rid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'educacenso:session-required'; END IF;
  IF NOT public.has_network_capability('preparar-censo-escolar') THEN RAISE EXCEPTION 'educacenso:not-authorized'; END IF;
  INSERT INTO public.educacenso_layout_registrations(census_year, layout_label, documentation_state, document_title, document_ref, document_sha256, reason, actor_user_id)
  VALUES (_year, btrim(_label), CASE WHEN _doc_sha256 IS NOT NULL AND nullif(btrim(_doc_title), '') IS NOT NULL THEN 'documentacao-inep-registrada' ELSE 'documentacao-pendente' END,
          nullif(btrim(_doc_title), ''), nullif(btrim(_doc_ref), ''), lower(_doc_sha256), _reason, auth.uid())
  RETURNING id INTO rid;
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.educacenso_collection_act(_year text, _stage_key text, _stage_label text, _act text, _expected_seq integer, _reference_date date, _layout uuid, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE head record; nseq integer; lay record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'educacenso:session-required'; END IF;
  IF NOT public.has_network_capability('preparar-censo-escolar') THEN RAISE EXCEPTION 'educacenso:not-authorized'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('educacenso:' || _year || ':' || _stage_key));
  SELECT * INTO head FROM public.educacenso_collection_events e WHERE e.census_year = _year AND e.stage_key = _stage_key ORDER BY seq DESC LIMIT 1;
  IF coalesce(head.seq, 0) <> coalesce(_expected_seq, -1) THEN RAISE EXCEPTION 'educacenso:stale-base'; END IF;
  IF _layout IS NOT NULL THEN
    SELECT * INTO lay FROM public.educacenso_layout_registrations l WHERE l.id = _layout;
    IF NOT FOUND OR lay.census_year <> _year THEN RAISE EXCEPTION 'educacenso:layout-year-mismatch'; END IF;
  END IF;
  IF _act = 'configurar' THEN
    IF head.act IS NOT NULL AND head.act NOT IN ('configurar') THEN RAISE EXCEPTION 'educacenso:invalid-transition'; END IF;
    IF _reference_date IS NULL OR extract(year FROM _reference_date)::text <> _year THEN RAISE EXCEPTION 'educacenso:reference-date-required'; END IF;
  ELSIF _act = 'abrir' THEN
    IF head.act IS DISTINCT FROM 'configurar' THEN RAISE EXCEPTION 'educacenso:invalid-transition'; END IF;
    _reference_date := head.reference_date; _layout := coalesce(_layout, head.layout_registration_id);
  ELSIF _act = 'encerrar' THEN
    IF head.act NOT IN ('abrir','reabrir') THEN RAISE EXCEPTION 'educacenso:invalid-transition'; END IF;
    _reference_date := head.reference_date; _layout := head.layout_registration_id;
  ELSIF _act = 'reabrir' THEN
    IF head.act IS DISTINCT FROM 'encerrar' THEN RAISE EXCEPTION 'educacenso:invalid-transition'; END IF;
    _reference_date := head.reference_date; _layout := head.layout_registration_id;
  ELSE RAISE EXCEPTION 'educacenso:invalid-act'; END IF;
  nseq := coalesce(head.seq, 0) + 1;
  INSERT INTO public.educacenso_collection_events(census_year, stage_key, stage_label, seq, act, reference_date, layout_registration_id, reason, actor_user_id)
  VALUES (_year, _stage_key, coalesce(nullif(btrim(_stage_label), ''), head.stage_label), nseq, _act, _reference_date, _layout, _reason, auth.uid());
  RETURN nseq;
END $$;

CREATE OR REPLACE FUNCTION public.educacenso_school_act(_year text, _stage_key text, _school text, _state text, _expected_seq integer, _protocol text, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE coll record; head record; scope text; nseq integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'educacenso:session-required'; END IF;
  IF public.has_network_capability('preparar-censo-escolar') THEN scope := 'rede';
  ELSIF public.has_school_capability('preparar-censo-escolar', _school) THEN scope := 'escola';
  ELSE RAISE EXCEPTION 'educacenso:not-authorized'; END IF;
  SELECT * INTO coll FROM public.educacenso_collection_events e WHERE e.census_year = _year AND e.stage_key = _stage_key ORDER BY seq DESC LIMIT 1;
  IF coll.act IS NULL OR coll.act NOT IN ('abrir','reabrir') THEN RAISE EXCEPTION 'educacenso:collection-not-open'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('educacenso:' || _year || ':' || _stage_key || ':' || _school));
  SELECT * INTO head FROM public.educacenso_school_status_events e WHERE e.census_year = _year AND e.stage_key = _stage_key AND e.school_id = _school ORDER BY seq DESC LIMIT 1;
  IF coalesce(head.seq, 0) <> coalesce(_expected_seq, -1) THEN RAISE EXCEPTION 'educacenso:stale-base'; END IF;
  IF _state = 'devolvida-pela-rede' AND scope <> 'rede' THEN RAISE EXCEPTION 'educacenso:network-only'; END IF;
  IF _state = 'devolvida-pela-rede' AND head.state IS DISTINCT FROM 'conferida-pela-escola' THEN RAISE EXCEPTION 'educacenso:invalid-transition'; END IF;
  IF _state = 'declarada-enviada-ao-inep' AND (nullif(btrim(_protocol), '') IS NULL OR head.state IS DISTINCT FROM 'conferida-pela-escola') THEN RAISE EXCEPTION 'educacenso:protocol-and-conference-required'; END IF;
  IF _state = 'em-retificacao' AND head.state IS DISTINCT FROM 'declarada-enviada-ao-inep' THEN RAISE EXCEPTION 'educacenso:invalid-transition'; END IF;
  IF _state = 'conferida-pela-escola' AND head.state IS NOT NULL AND head.state NOT IN ('em-preparacao','pendencias-em-correcao','devolvida-pela-rede','em-retificacao') THEN RAISE EXCEPTION 'educacenso:invalid-transition'; END IF;
  nseq := coalesce(head.seq, 0) + 1;
  INSERT INTO public.educacenso_school_status_events(census_year, stage_key, school_id, seq, state, protocol_ref, reason, actor_user_id, actor_scope)
  VALUES (_year, _stage_key, _school, nseq, _state, nullif(btrim(_protocol), ''), _reason, auth.uid(), scope);
  RETURN nseq;
END $$;

-- Painel: estado por escola no escopo + evidências já existentes (recibo oficial importado, matrículas sem início efetivo).
CREATE OR REPLACE FUNCTION public.educacenso_control_at(_year text, _stage_key text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE net boolean; rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'educacenso:session-required'; END IF;
  net := public.census_can_read_network() OR public.has_network_capability('preparar-censo-escolar');
  SELECT coalesce(jsonb_agg(jsonb_build_object(
      'school_id', s.id,
      'inep', (SELECT i.value FROM public.institutional_school_identifiers i WHERE i.school_id = s.id AND i.kind = 'inep' LIMIT 1),
      'head', (SELECT jsonb_build_object('seq', e.seq, 'state', e.state, 'protocol_ref', e.protocol_ref, 'reason', e.reason, 'actor_scope', e.actor_scope, 'recorded_at', e.recorded_at)
               FROM public.educacenso_school_status_events e WHERE e.census_year = _year AND e.stage_key = _stage_key AND e.school_id = s.id ORDER BY e.seq DESC LIMIT 1),
      'receipt', (SELECT jsonb_build_object('version', r.version, 'issued_at', r.issued_at, 'closed_at', r.closed_at)
               FROM public.census_official_receipt_snapshots r WHERE r.school_id = s.id AND r.census_year = _year ORDER BY r.version DESC LIMIT 1),
      'enrollments_without_start', (SELECT count(*) FROM public.school_enrollments se WHERE se.school_id = s.id AND se.academic_year_id = _year AND se.opened_on IS NULL)
    ) ORDER BY s.id), '[]'::jsonb) INTO rows
  FROM public.institutional_schools s
  WHERE net OR public.has_school_capability('consultar-pendencias-do-censo', s.id) OR public.has_school_capability('preparar-censo-escolar', s.id);
  RETURN jsonb_build_object('network', net, 'can_configure', public.has_network_capability('preparar-censo-escolar'), 'schools', rows);
END $$;

REVOKE ALL ON FUNCTION public.educacenso_register_layout(text,text,text,text,text,text), public.educacenso_collection_act(text,text,text,text,integer,date,uuid,text),
  public.educacenso_school_act(text,text,text,text,integer,text,text), public.educacenso_control_at(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.educacenso_register_layout(text,text,text,text,text,text), public.educacenso_collection_act(text,text,text,text,integer,date,uuid,text),
  public.educacenso_school_act(text,text,text,text,integer,text,text), public.educacenso_control_at(text,text) TO authenticated, service_role;
