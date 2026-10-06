-- AC.2: superfície da equipe para conceder/substituir/revogar autorização de responsável sem expor conta.
-- Localização exata do responsável (CPF via HMAC no banco), cadeia por educando e writer v3 que resolve a conta pelo vínculo pessoa↔conta.

CREATE OR REPLACE FUNCTION public.locate_guardian_person_exact(_school text, _kind text, _value text)
RETURNS TABLE(outcome text, person_id uuid, display_name text, account_state text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE v text := pg_catalog.regexp_replace(coalesce(_value,''), '[^0-9]', '', 'g'); pids uuid[]; o text; n int;
BEGIN
  IF auth.uid() IS NULL OR public.s_current_person() IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_school_capability('manter-autorizacao-de-responsavel', _school) THEN RAISE EXCEPTION 'lookup:capability-missing'; END IF;
  PERFORM public.s_lookup_guard('localizar-responsavel', _school, _kind);
  IF _kind = 'cpf' AND public.technical_cpf_valid(v) THEN
    SELECT pg_catalog.array_agg(DISTINCT i.person_id) INTO pids FROM public.institutional_person_identifiers i
      JOIN public.institutional_persons p ON p.id = i.person_id AND p.actor_nature = 'pessoa-natural'
     WHERE i.identifier_kind = 'cpf-hmac' AND i.value = public.technical_cpf_hmac(v);
    o := CASE WHEN pids IS NULL THEN 'nao-encontrado' WHEN pg_catalog.cardinality(pids) > 1 THEN 'conflito' ELSE 'encontrado' END;
  ELSE
    o := 'entrada-invalida';
  END IF;
  INSERT INTO public.exact_lookup_events(user_id, purpose, school_id, identifier_kind, outcome) VALUES (auth.uid(), 'localizar-responsavel', _school, coalesce(_kind,'?'), o);
  IF o <> 'encontrado' THEN RETURN QUERY SELECT o, NULL::uuid, NULL::text, NULL::text; RETURN; END IF;
  SELECT count(*) INTO n FROM public.user_person_links l WHERE l.person_id = pids[1];
  RETURN QUERY SELECT o, p.id, p.display_name, CASE WHEN n = 0 THEN 'sem-conta' WHEN n > 1 THEN 'conta-ambigua' ELSE 'conta-unica' END
    FROM public.institutional_persons p WHERE p.id = pids[1];
END $fn$;
REVOKE ALL ON FUNCTION public.locate_guardian_person_exact(text,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.locate_guardian_person_exact(text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.guardian_authorization_chain(_school text, _student text)
RETURNS TABLE(id uuid, logical_id uuid, version int, event_kind text, guardian_person_id uuid, guardian_name text,
  relation_scheme_id text, relation_value_id text, sections text[], valid_from date, valid_until date, reason text, recorded_at timestamptz, is_head boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT public.has_school_capability('manter-autorizacao-de-responsavel', _school) THEN RAISE EXCEPTION 'capability:manter-autorizacao-de-responsavel'; END IF;
  RETURN QUERY SELECT a.id, a.logical_id, a.version, a.event_kind, a.guardian_person_id, p.display_name,
      a.relation_scheme_id, a.relation_value_id, a.sections, a.valid_from, a.valid_until, a.reason, a.recorded_at,
      NOT EXISTS (SELECT 1 FROM public.guardian_authorizations s WHERE s.supersedes_id = a.id)
    FROM public.guardian_authorizations a LEFT JOIN public.institutional_persons p ON p.id = a.guardian_person_id
   WHERE a.student_id = _student AND a.school_id = _school
   ORDER BY a.logical_id, a.version;
END $fn$;
REVOKE ALL ON FUNCTION public.guardian_authorization_chain(text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.guardian_authorization_chain(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_guardian_authorization_v3(_base_id uuid, _kind text, _student text, _guardian_person uuid, _school text,
  _relation_scheme text, _relation_value text, _sections text[], _valid_from date, _valid_until date, _reason text, _source_ref text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE u uuid[]; base public.guardian_authorizations; p uuid := _guardian_person;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _base_id IS NOT NULL THEN
    SELECT * INTO base FROM public.guardian_authorizations WHERE id = _base_id;
    IF base.id IS NULL THEN RAISE EXCEPTION 'family:base-unknown'; END IF;
    p := coalesce(base.guardian_person_id, p);
    IF base.guardian_person_id IS NULL THEN RAISE EXCEPTION 'family:legacy-requires-v2'; END IF;
  END IF;
  IF p IS NULL THEN RAISE EXCEPTION 'family:guardian-person-invalid'; END IF;
  SELECT pg_catalog.array_agg(l.user_id) INTO u FROM public.user_person_links l WHERE l.person_id = p;
  IF u IS NULL THEN RAISE EXCEPTION 'family:guardian-account-missing'; END IF;
  IF pg_catalog.cardinality(u) > 1 THEN RAISE EXCEPTION 'family:guardian-account-ambiguous'; END IF;
  IF base.id IS NOT NULL AND base.guardian_user_id <> u[1] THEN RAISE EXCEPTION 'family:account-person-mismatch'; END IF;
  RETURN public.record_guardian_authorization_v2(_base_id, _kind, _student, u[1], p, _school, _relation_scheme, _relation_value,
    _sections, _valid_from, _valid_until, _reason, _source_ref);
END $fn$;
REVOKE ALL ON FUNCTION public.record_guardian_authorization_v3(uuid,text,text,uuid,text,text,text,text[],date,date,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_guardian_authorization_v3(uuid,text,text,uuid,text,text,text,text[],date,date,text,text) TO authenticated;