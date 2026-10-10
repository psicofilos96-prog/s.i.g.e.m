-- LOTE 7: regra da Folha Final com escopo validado (modalidade/ano/vigência) e homologação da folha exige
-- regra da mesma modalidade, vigente, citada no snapshot, e frequência informada quando a regra a exige.
CREATE OR REPLACE FUNCTION public.record_final_sheet_rule(_logical text, _expected_version integer, _label text, _scope jsonb, _params jsonb, _source_ref text, _status text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _uid uuid := auth.uid(); _head public.final_sheet_rule_versions; _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  IF NOT public.has_network_capability('manter-regras-de-resultado') THEN RAISE EXCEPTION 'CAPABILITY_REQUIRED'; END IF;
  IF _status NOT IN ('rascunho','homologada') THEN RAISE EXCEPTION 'STATUS_INVALID'; END IF;
  IF coalesce(_scope->>'modality','') NOT IN ('fundamental-anos-iniciais','fundamental-anos-finais','eja') THEN RAISE EXCEPTION 'SCOPE_INVALID'; END IF;
  IF (_scope->>'valid_from') IS NULL OR (_scope->>'valid_from') !~ '^\d{4}-\d{2}-\d{2}$'
     OR ((_scope->>'valid_to') IS NOT NULL AND ((_scope->>'valid_to') !~ '^\d{4}-\d{2}-\d{2}$' OR (_scope->>'valid_to')::date < (_scope->>'valid_from')::date)) THEN RAISE EXCEPTION 'VALIDITY_INVALID'; END IF;
  IF jsonb_typeof(_params->'passMark') <> 'number' OR (_params->>'passMark')::numeric < 0 OR (_params->>'passMark')::numeric > 100 THEN RAISE EXCEPTION 'PARAMS_INVALID'; END IF;
  IF _params ? 'minAttendance' AND jsonb_typeof(_params->'minAttendance') NOT IN ('null','number') THEN RAISE EXCEPTION 'PARAMS_INVALID'; END IF;
  IF jsonb_typeof(_params->'minAttendance') = 'number' AND ((_params->>'minAttendance')::numeric <= 0 OR (_params->>'minAttendance')::numeric > 1) THEN RAISE EXCEPTION 'PARAMS_INVALID'; END IF;
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
DECLARE _uid uuid := auth.uid(); _school text; _last public.final_sheet_acts; _r public.final_sheet_rule_versions; _seq integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'UNAUTHENTICATED'; END IF;
  SELECT c.school_id INTO _school FROM public.institutional_classes c WHERE c.id = _class;
  IF _school IS NULL THEN RAISE EXCEPTION 'CLASS_NOT_FOUND'; END IF;
  IF NOT public.has_school_capability('registrar-folha-final', _school) THEN RAISE EXCEPTION 'CAPABILITY_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('fsa:' || _class));
  SELECT * INTO _last FROM public.final_sheet_acts a WHERE a.class_id = _class ORDER BY seq DESC LIMIT 1;
  IF coalesce(_last.seq, 0) <> coalesce(_expected_seq, 0) THEN RAISE EXCEPTION 'STALE_BASE'; END IF;
  IF _action IN ('rascunho','conferencia') AND _last.action IN ('homologacao','retificacao') THEN RAISE EXCEPTION 'REOPEN_REQUIRED'; END IF;
  IF _action IN ('homologacao','retificacao') THEN
    IF _action = 'homologacao' THEN
      IF _last.action IS DISTINCT FROM 'conferencia' THEN RAISE EXCEPTION 'CONFERENCE_REQUIRED'; END IF;
      IF _last.actor_id = _uid THEN RAISE EXCEPTION 'HOMOLOGATION_SAME_ACTOR'; END IF;
      IF _last.snapshot_sha256 <> _sha THEN RAISE EXCEPTION 'SNAPSHOT_CHANGED_SINCE_CONFERENCE'; END IF;
    END IF;
    SELECT * INTO _r FROM public.final_sheet_rule_versions r WHERE r.id = _rule;
    IF _r.id IS NULL OR _r.status <> 'homologada' THEN RAISE EXCEPTION 'RULE_NOT_HOMOLOGATED'; END IF;
    IF EXISTS (SELECT 1 FROM public.final_sheet_rule_versions n WHERE n.logical_id = _r.logical_id AND n.version > _r.version) THEN RAISE EXCEPTION 'RULE_SUPERSEDED'; END IF;
    IF (_snapshot->'rule'->>'id') IS DISTINCT FROM _r.id::text THEN RAISE EXCEPTION 'RULE_MISMATCH'; END IF;
    IF (_snapshot->>'modality') IS DISTINCT FROM (_r.scope->>'modality') THEN RAISE EXCEPTION 'RULE_MODALITY_MISMATCH'; END IF;
    IF (_r.scope->>'valid_from') IS NOT NULL AND ((_r.scope->>'valid_from')::date > current_date OR ((_r.scope->>'valid_to') IS NOT NULL AND (_r.scope->>'valid_to')::date < current_date)) THEN RAISE EXCEPTION 'RULE_NOT_IN_FORCE'; END IF;
    IF jsonb_path_exists(_snapshot, '$.rows[*] ? (@.overall == "PENDENTE" || @.overall == "AGUARDA REGRA")') THEN RAISE EXCEPTION 'PENDING_ROWS'; END IF;
    IF jsonb_typeof(_r.params->'minAttendance') = 'number'
       AND jsonb_path_exists(_snapshot, '$.rows[*] ? (@.status == "Ativo").components[*] ? (@.att == null)') THEN RAISE EXCEPTION 'ATTENDANCE_REQUIRED'; END IF;
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