-- AL — Supervisão Escolar: registros próprios de acompanhamento (append-only, versionados).
-- Capacidades sem política atribuída ⇒ fail-closed. Modalidade/situação só de catálogos homologados (sem seed).
CREATE TABLE public.school_supervision_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid UNIQUE REFERENCES public.school_supervision_records(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','retificacao','anulacao')),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  modality_value_id text NOT NULL,
  modality_value_version integer NOT NULL,
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 1 AND 300),
  occurred_on date NOT NULL,
  referral text CHECK (referral IS NULL OR length(referral) <= 4000),
  responsible_label text CHECK (responsible_label IS NULL OR length(responsible_label) <= 200),
  return_on date,
  status_value_id text,
  status_value_version integer,
  school_visible boolean NOT NULL DEFAULT false,
  reason text,
  author_user_id uuid NOT NULL,
  author_person_id uuid NOT NULL,
  author_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (logical_id, version),
  CHECK (return_on IS NULL OR return_on >= occurred_on),
  CHECK (event_kind = 'registro' OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);
CREATE INDEX school_supervision_records_school_idx ON public.school_supervision_records(school_id, occurred_on DESC);
REVOKE ALL ON public.school_supervision_records FROM PUBLIC, anon, authenticated, service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.school_supervision_records FROM anon, authenticated, service_role;
GRANT SELECT ON public.school_supervision_records TO service_role;
ALTER TABLE public.school_supervision_records ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.al_supervision_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN RAISE EXCEPTION 'supervision:append-only'; END $$;
CREATE TRIGGER school_supervision_records_immutable BEFORE UPDATE OR DELETE ON public.school_supervision_records
  FOR EACH ROW EXECUTE FUNCTION public.al_supervision_immutable();

CREATE OR REPLACE FUNCTION public.al_supervision_grant(_capability text, _school text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability NOT IN ('registrar-acompanhamento-da-supervisao','consultar-acompanhamento-da-supervisao','consultar-supervisao-da-propria-escola')
    THEN RAISE EXCEPTION 'supervision:capability-not-allowed'; END IF;
  IF _school IS NULL THEN RAISE EXCEPTION 'supervision:school-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL
     AND ((c.scope_level = 'rede' AND _capability <> 'consultar-supervisao-da-propria-escola') OR (c.scope_level = 'escola' AND c.school_id = _school))
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  RETURN g;
END $$;
REVOKE ALL ON FUNCTION public.al_supervision_grant(text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.record_school_supervision(_base_id uuid, _kind text, _school text, _modality text, _subject text,
  _occurred_on date, _referral text, _responsible_label text, _return_on date, _status_value text, _school_visible boolean, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _person uuid; g uuid; base public.school_supervision_records; m record; st record; r uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'supervision:session-required'; END IF;
  SELECT l.person_id INTO _person FROM public.user_person_links l WHERE l.user_id = auth.uid();
  IF _person IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = _person AND p.actor_nature = 'pessoa-natural')
    THEN RAISE EXCEPTION 'supervision:natural-person-required'; END IF;
  IF _kind NOT IN ('registro','retificacao','anulacao') THEN RAISE EXCEPTION 'supervision:kind-invalid'; END IF;
  IF _kind = 'registro' THEN
    IF _base_id IS NOT NULL THEN RAISE EXCEPTION 'supervision:base-not-allowed'; END IF;
  ELSE
    SELECT * INTO base FROM public.school_supervision_records WHERE id = _base_id FOR UPDATE;
    IF base.id IS NULL THEN RAISE EXCEPTION 'supervision:base-unknown'; END IF;
    IF EXISTS (SELECT 1 FROM public.school_supervision_records x WHERE x.supersedes_id = base.id) THEN RAISE EXCEPTION 'supervision:base-superseded'; END IF;
    IF base.event_kind = 'anulacao' THEN RAISE EXCEPTION 'supervision:already-annulled'; END IF;
    IF base.author_user_id <> auth.uid() THEN RAISE EXCEPTION 'supervision:only-author-rectifies'; END IF;
    IF length(btrim(coalesce(_reason,''))) = 0 THEN RAISE EXCEPTION 'supervision:reason-required'; END IF;
    _school := base.school_id;
    IF _kind = 'anulacao' THEN _modality := base.modality_value_id; _subject := base.subject; _occurred_on := base.occurred_on; _referral := base.referral;
      _responsible_label := base.responsible_label; _return_on := base.return_on; _status_value := base.status_value_id; _school_visible := base.school_visible; END IF;
  END IF;
  g := public.al_supervision_grant('registrar-acompanhamento-da-supervisao', _school);
  IF g IS NULL THEN RAISE EXCEPTION 'capability:registrar-acompanhamento-da-supervisao'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_schools s WHERE s.id = _school) THEN RAISE EXCEPTION 'supervision:school-unknown'; END IF;
  SELECT d.value_id, d.version INTO m FROM public.attribute_value_definitions d
   WHERE d.scheme_id = 'modalidade-de-acompanhamento-da-supervisao' AND d.value_id = _modality AND d.status = 'homologado' ORDER BY d.version DESC LIMIT 1;
  IF m.value_id IS NULL THEN RAISE EXCEPTION 'supervision:modality-not-homologated'; END IF;
  IF _status_value IS NOT NULL THEN
    SELECT d.value_id, d.version INTO st FROM public.attribute_value_definitions d
     WHERE d.scheme_id = 'situacao-de-acompanhamento-da-supervisao' AND d.value_id = _status_value AND d.status = 'homologado' ORDER BY d.version DESC LIMIT 1;
    IF st.value_id IS NULL THEN RAISE EXCEPTION 'supervision:status-not-homologated'; END IF;
  END IF;
  IF _occurred_on IS NULL THEN RAISE EXCEPTION 'supervision:occurred-on-required'; END IF;
  IF _occurred_on > CURRENT_DATE THEN RAISE EXCEPTION 'supervision:occurred-on-future'; END IF;
  IF _return_on IS NOT NULL AND _return_on < _occurred_on THEN RAISE EXCEPTION 'supervision:return-before-occurrence'; END IF;
  IF length(btrim(coalesce(_subject,''))) = 0 THEN RAISE EXCEPTION 'supervision:subject-required'; END IF;
  INSERT INTO public.school_supervision_records(logical_id, version, supersedes_id, event_kind, school_id, modality_value_id, modality_value_version,
    subject, occurred_on, referral, responsible_label, return_on, status_value_id, status_value_version, school_visible, reason,
    author_user_id, author_person_id, author_engagement)
  VALUES (coalesce(base.logical_id, gen_random_uuid()), coalesce(base.version, 0) + 1, base.id, _kind, _school, m.value_id, m.version,
    btrim(_subject), _occurred_on, nullif(btrim(_referral),''), nullif(btrim(_responsible_label),''), _return_on, st.value_id, st.version,
    coalesce(_school_visible, false), nullif(btrim(_reason),''), auth.uid(), _person, g)
  RETURNING id INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.record_school_supervision(uuid,text,text,text,text,date,text,text,date,text,boolean,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_school_supervision(uuid,text,text,text,text,date,text,text,date,text,boolean,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.school_supervision_records_at(_school text, _known_at timestamptz, _logical_id uuid)
RETURNS TABLE(id uuid, logical_id uuid, version integer, event_kind text, school_id text, modality_value_id text, subject text,
  occurred_on date, referral text, responsible_label text, return_on date, status_value_id text, school_visible boolean,
  reason text, recorded_at timestamptz, own boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE k timestamptz := coalesce(_known_at, now()); full_access boolean; school_access boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  full_access := public.al_supervision_grant('consultar-acompanhamento-da-supervisao', _school) IS NOT NULL
              OR public.al_supervision_grant('registrar-acompanhamento-da-supervisao', _school) IS NOT NULL;
  school_access := public.al_supervision_grant('consultar-supervisao-da-propria-escola', _school) IS NOT NULL;
  IF NOT full_access AND NOT school_access THEN RAISE EXCEPTION 'access-denied'; END IF;
  RETURN QUERY SELECT r.id, r.logical_id, r.version, r.event_kind, r.school_id, r.modality_value_id, r.subject, r.occurred_on,
      r.referral, r.responsible_label, r.return_on, r.status_value_id, r.school_visible, r.reason, r.recorded_at, r.author_user_id = auth.uid()
    FROM public.school_supervision_records r
   WHERE r.school_id = _school AND r.recorded_at <= k
     AND (full_access OR r.school_visible)
     AND (CASE WHEN _logical_id IS NOT NULL THEN r.logical_id = _logical_id
          ELSE NOT EXISTS (SELECT 1 FROM public.school_supervision_records s WHERE s.supersedes_id = r.id AND s.recorded_at <= k) END)
   ORDER BY r.occurred_on DESC, r.recorded_at DESC LIMIT 500;
END $$;
REVOKE ALL ON FUNCTION public.school_supervision_records_at(text, timestamptz, uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.school_supervision_records_at(text, timestamptz, uuid) TO authenticated;