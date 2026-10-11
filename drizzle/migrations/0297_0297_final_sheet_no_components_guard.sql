CREATE OR REPLACE FUNCTION public.record_final_sheet_act(_class text, _expected_seq integer, _action text, _rule uuid, _snapshot jsonb, _sha text, _reason text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    IF jsonb_path_exists(_snapshot, '$.rows[*] ? (@.status == "Ativo" && (!exists(@.components[*])))') THEN RAISE EXCEPTION 'NO_COMPONENTS'; END IF;
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
END $function$;