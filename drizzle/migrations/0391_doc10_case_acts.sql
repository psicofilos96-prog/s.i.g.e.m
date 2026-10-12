CREATE TABLE public.admin_case_acts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.admin_case_files(id),
  act_kind text NOT NULL CHECK (act_kind IN ('despacho','parecer','encaminhamento','decisao')),
  unit_id text NOT NULL,
  created_by_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.admin_case_act_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  act_id uuid NOT NULL REFERENCES public.admin_case_acts(id),
  version int NOT NULL CHECK (version >= 1),
  body text NOT NULL CHECK (length(btrim(body)) >= 10),
  outcome text,
  competence_capability text NOT NULL,
  change_reason text,
  content_sha256 text NOT NULL,
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (act_id, version),
  CHECK (version = 1 OR length(btrim(coalesce(change_reason,''))) >= 10)
);
CREATE TABLE public.admin_case_act_references (
  version_id uuid NOT NULL REFERENCES public.admin_case_act_versions(id),
  ref_kind text NOT NULL CHECK (ref_kind IN ('documento','ato','norma','protocolo')),
  ref_id text NOT NULL,
  PRIMARY KEY (version_id, ref_kind, ref_id)
);
GRANT SELECT ON public.admin_case_acts, public.admin_case_act_versions, public.admin_case_act_references TO authenticated;
GRANT ALL ON public.admin_case_acts, public.admin_case_act_versions, public.admin_case_act_references TO service_role;
ALTER TABLE public.admin_case_acts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_case_act_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_case_act_references ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acts follow case" ON public.admin_case_acts FOR SELECT TO authenticated USING (public.admin_case_readable(case_id));
CREATE POLICY "act versions follow act" ON public.admin_case_act_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_case_acts a WHERE a.id = act_id));
CREATE POLICY "act refs follow version" ON public.admin_case_act_references FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_case_act_versions v WHERE v.id = version_id));
CREATE TRIGGER admin_acts_immutable BEFORE UPDATE OR DELETE ON public.admin_case_acts FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER admin_act_versions_immutable BEFORE UPDATE OR DELETE ON public.admin_case_act_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER admin_act_refs_immutable BEFORE UPDATE OR DELETE ON public.admin_case_act_references FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.admin_act_capability(_kind text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE _kind WHEN 'decisao' THEN 'decidir-processos' WHEN 'parecer' THEN 'emitir-pareceres' ELSE 'instruir-processos' END $$;

CREATE OR REPLACE FUNCTION public.record_admin_case_act(_case_id uuid, _act_id uuid, _act_kind text, _expected_version int, _body text, _outcome text, _change_reason text, _references jsonb, _idempotency_key text)
RETURNS TABLE(act_id uuid, version int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid := public.current_person_id(); _unit text; _cap text; _a public.admin_case_acts; _last int; _vid uuid; _r jsonb; _concluded boolean; _parecer_author uuid;
BEGIN
  IF _person IS NULL THEN RAISE EXCEPTION 'act:no-person'; END IF;
  PERFORM 1 FROM public.admin_case_files WHERE id = _case_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'act:not-found'; END IF;
  SELECT e.event_type = 'concluido' INTO _concluded FROM public.admin_case_events e
    WHERE e.case_id = _case_id AND e.event_type IN ('autuado','concluido','reaberto') ORDER BY e.seq DESC LIMIT 1;
  IF _concluded THEN RAISE EXCEPTION 'act:case-concluded'; END IF;
  _unit := public.admin_case_current_unit(_case_id);
  IF _act_id IS NULL THEN
    SELECT * INTO _a FROM public.admin_case_acts WHERE idempotency_key = _idempotency_key;
    IF FOUND THEN RETURN QUERY SELECT _a.id, 1; RETURN; END IF;
    IF _act_kind NOT IN ('despacho','parecer','encaminhamento','decisao') THEN RAISE EXCEPTION 'act:invalid-kind'; END IF;
    IF coalesce(btrim(_idempotency_key),'') = '' THEN RAISE EXCEPTION 'act:missing-key'; END IF;
  ELSE
    SELECT * INTO _a FROM public.admin_case_acts WHERE id = _act_id AND case_id = _case_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'act:not-found'; END IF;
    _act_kind := _a.act_kind;
  END IF;
  _cap := public.admin_act_capability(_act_kind);
  IF NOT public.case_can_act(_unit, _cap) THEN RAISE EXCEPTION 'act:forbidden'; END IF;
  IF _act_kind = 'decisao' THEN
    IF coalesce(btrim(_outcome),'') = '' THEN RAISE EXCEPTION 'act:decision-without-outcome'; END IF;
    IF coalesce(jsonb_array_length(_references),0) = 0 THEN RAISE EXCEPTION 'act:decision-without-references'; END IF;
  END IF;
  IF _act_kind = 'parecer' AND EXISTS (SELECT 1 FROM public.admin_case_acts x JOIN public.admin_case_act_versions v ON v.act_id = x.id
       WHERE x.case_id = _case_id AND x.act_kind = 'decisao' AND v.author_person = _person) THEN
    RAISE EXCEPTION 'act:opinion-by-decider'; END IF;
  IF _act_kind = 'decisao' THEN
    FOR _r IN SELECT * FROM jsonb_array_elements(_references) LOOP
      IF _r->>'kind' = 'ato' THEN
        SELECT v.author_person INTO _parecer_author FROM public.admin_case_act_versions v JOIN public.admin_case_acts x ON x.id = v.act_id
          WHERE x.id::text = _r->>'id' AND x.act_kind = 'parecer' ORDER BY v.version DESC LIMIT 1;
        IF _parecer_author = _person THEN RAISE EXCEPTION 'act:decision-on-own-opinion'; END IF;
      END IF;
    END LOOP;
  END IF;
  IF _act_id IS NULL THEN
    INSERT INTO public.admin_case_acts(case_id, act_kind, unit_id, created_by_person, idempotency_key)
    VALUES (_case_id, _act_kind, _unit, _person, _idempotency_key) RETURNING * INTO _a;
    _last := 0;
  ELSE
    SELECT max(v.version) INTO _last FROM public.admin_case_act_versions v WHERE v.act_id = _a.id;
  END IF;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'act:stale-base'; END IF;
  IF _last > 0 AND length(btrim(coalesce(_change_reason,''))) < 10 THEN RAISE EXCEPTION 'act:reason-required'; END IF;
  INSERT INTO public.admin_case_act_versions(act_id, version, body, outcome, competence_capability, change_reason, content_sha256, author_person)
  VALUES (_a.id, _last+1, btrim(_body), nullif(btrim(_outcome),''), _cap, nullif(btrim(_change_reason),''),
    encode(extensions.digest(_a.id::text || '|' || (_last+1) || '|' || btrim(_body) || '|' || coalesce(_outcome,''), 'sha256'), 'hex'), _person)
  RETURNING id INTO _vid;
  FOR _r IN SELECT * FROM jsonb_array_elements(coalesce(_references,'[]'::jsonb)) LOOP
    IF coalesce(_r->>'kind','') NOT IN ('documento','ato','norma','protocolo') OR coalesce(btrim(_r->>'id'),'') = '' THEN RAISE EXCEPTION 'act:invalid-reference'; END IF;
    INSERT INTO public.admin_case_act_references(version_id, ref_kind, ref_id) VALUES (_vid, _r->>'kind', btrim(_r->>'id')) ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN QUERY SELECT _a.id, _last+1;
END $$;

REVOKE ALL ON FUNCTION public.admin_act_capability(text), public.record_admin_case_act(uuid,uuid,text,int,text,text,text,jsonb,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_act_capability(text), public.record_admin_case_act(uuid,uuid,text,int,text,text,text,jsonb,text) TO authenticated;