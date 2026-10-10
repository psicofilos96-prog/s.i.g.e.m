-- Regra de resultado (configuração) e cadeia de atos da Folha Final. Regras extraídas das planilhas entram como RASCUNHO;
-- só versão homologada por pessoa distinta do autor decide resultado. Ausência de nota nunca vira zero (tratado no motor).
CREATE TABLE public.final_sheet_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id text NOT NULL CHECK (length(logical_id) BETWEEN 1 AND 120),
  version integer NOT NULL CHECK (version > 0),
  supersedes_id uuid REFERENCES public.final_sheet_rule_versions(id),
  label text NOT NULL CHECK (length(label) BETWEEN 1 AND 200),
  scope jsonb NOT NULL,
  params jsonb NOT NULL,
  source_ref text NOT NULL CHECK (length(source_ref) BETWEEN 1 AND 500),
  status text NOT NULL CHECK (status IN ('rascunho','homologada')),
  author_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version)
);
CREATE TABLE public.final_sheet_acts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id text NOT NULL REFERENCES public.institutional_classes(id),
  school_id text NOT NULL,
  seq integer NOT NULL CHECK (seq > 0),
  action text NOT NULL CHECK (action IN ('rascunho','conferencia','homologacao','retificacao','reabertura')),
  rule_version_id uuid REFERENCES public.final_sheet_rule_versions(id),
  snapshot jsonb NOT NULL,
  snapshot_sha256 text NOT NULL CHECK (snapshot_sha256 ~ '^[0-9a-f]{64}$'),
  reason text CHECK (reason IS NULL OR length(reason) <= 2000),
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, seq)
);
GRANT SELECT ON public.final_sheet_rule_versions, public.final_sheet_acts TO authenticated;
GRANT ALL ON public.final_sheet_rule_versions, public.final_sheet_acts TO service_role;
ALTER TABLE public.final_sheet_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.final_sheet_acts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regras: leitura autenticada" ON public.final_sheet_rule_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "folha final: escola com capability" ON public.final_sheet_acts FOR SELECT TO authenticated USING (
  public.has_school_capability('registrar-folha-final', school_id)
  OR public.has_school_capability('consultar-folha-final', school_id)
  OR public.has_network_capability('consultar-folha-final'));

CREATE OR REPLACE FUNCTION public.final_sheet_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'FINAL_SHEET_IMMUTABLE'; END $$;
CREATE TRIGGER final_sheet_rule_versions_immutable BEFORE UPDATE OR DELETE ON public.final_sheet_rule_versions FOR EACH ROW EXECUTE FUNCTION public.final_sheet_immutable();
CREATE TRIGGER final_sheet_acts_immutable BEFORE UPDATE OR DELETE ON public.final_sheet_acts FOR EACH ROW EXECUTE FUNCTION public.final_sheet_immutable();

CREATE OR REPLACE FUNCTION public.record_final_sheet_rule(_logical text, _expected_version integer, _label text, _scope jsonb, _params jsonb, _source_ref text, _status text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _head public.final_sheet_rule_versions; _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF NOT public.has_network_capability('manter-regras-de-resultado') THEN RAISE EXCEPTION 'CAPABILITY_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('fsr:' || _logical));
  SELECT * INTO _head FROM public.final_sheet_rule_versions r WHERE r.logical_id = _logical ORDER BY version DESC LIMIT 1;
  IF coalesce(_head.version, 0) <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'STALE_BASE'; END IF;
  IF _status = 'homologada' THEN
    IF _head.id IS NULL OR _head.status <> 'rascunho' THEN RAISE EXCEPTION 'HOMOLOGATION_REQUIRES_DRAFT'; END IF;
    IF _head.author_id = _uid THEN RAISE EXCEPTION 'HOMOLOGATION_SAME_AUTHOR'; END IF;
    IF _head.params IS DISTINCT FROM _params OR _head.scope IS DISTINCT FROM _scope THEN RAISE EXCEPTION 'HOMOLOGATION_MUST_NOT_CHANGE'; END IF;
  END IF;
  INSERT INTO public.final_sheet_rule_versions(logical_id, version, supersedes_id, label, scope, params, source_ref, status, author_id)
  VALUES (_logical, coalesce(_head.version, 0) + 1, _head.id, _label, _scope, _params, _source_ref, _status, _uid) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_final_sheet_act(_class text, _expected_seq integer, _action text, _rule uuid, _snapshot jsonb, _sha text, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _school text; _last public.final_sheet_acts; _conf public.final_sheet_acts; _r public.final_sheet_rule_versions; _seq integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  SELECT c.school_id INTO _school FROM public.institutional_classes c WHERE c.id = _class;
  IF _school IS NULL THEN RAISE EXCEPTION 'CLASS_NOT_FOUND'; END IF;
  IF NOT public.has_school_capability('registrar-folha-final', _school) THEN RAISE EXCEPTION 'CAPABILITY_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('fsa:' || _class));
  SELECT * INTO _last FROM public.final_sheet_acts a WHERE a.class_id = _class ORDER BY seq DESC LIMIT 1;
  IF coalesce(_last.seq, 0) <> coalesce(_expected_seq, 0) THEN RAISE EXCEPTION 'STALE_BASE'; END IF;
  IF _action IN ('rascunho','conferencia') AND _last.action IN ('homologacao','retificacao') THEN RAISE EXCEPTION 'REOPEN_REQUIRED'; END IF;
  IF _action = 'homologacao' THEN
    IF _last.action IS DISTINCT FROM 'conferencia' THEN RAISE EXCEPTION 'CONFERENCE_REQUIRED'; END IF;
    IF _last.actor_id = _uid THEN RAISE EXCEPTION 'HOMOLOGATION_SAME_ACTOR'; END IF;
    IF _last.snapshot_sha256 <> _sha THEN RAISE EXCEPTION 'SNAPSHOT_CHANGED_SINCE_CONFERENCE'; END IF;
    SELECT * INTO _r FROM public.final_sheet_rule_versions r WHERE r.id = _rule;
    IF _r.id IS NULL OR _r.status <> 'homologada' THEN RAISE EXCEPTION 'RULE_NOT_HOMOLOGATED'; END IF;
    IF EXISTS (SELECT 1 FROM public.final_sheet_rule_versions n WHERE n.logical_id = _r.logical_id AND n.version > _r.version) THEN RAISE EXCEPTION 'RULE_SUPERSEDED'; END IF;
    IF jsonb_path_exists(_snapshot, '$.rows[*] ? (@.overall == "PENDENTE")') THEN RAISE EXCEPTION 'PENDING_ROWS'; END IF;
  END IF;
  IF _action IN ('retificacao','reabertura') THEN
    IF _last.action IS DISTINCT FROM 'homologacao' AND _last.action IS DISTINCT FROM 'retificacao' THEN RAISE EXCEPTION 'NOTHING_TO_REOPEN'; END IF;
    IF _reason IS NULL OR length(trim(_reason)) < 5 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
  END IF;
  _seq := coalesce(_last.seq, 0) + 1;
  INSERT INTO public.final_sheet_acts(class_id, school_id, seq, action, rule_version_id, snapshot, snapshot_sha256, reason, actor_id)
  VALUES (_class, _school, _seq, _action, _rule, _snapshot, _sha, nullif(trim(coalesce(_reason,'')), ''), _uid);
  RETURN _seq;
END $$;
REVOKE ALL ON FUNCTION public.record_final_sheet_rule(text,integer,text,jsonb,jsonb,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_final_sheet_act(text,integer,text,uuid,jsonb,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_final_sheet_rule(text,integer,text,jsonb,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_final_sheet_act(text,integer,text,uuid,jsonb,text,text) TO authenticated;