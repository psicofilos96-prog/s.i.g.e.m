-- Lote 19: frequência nunca é digitada; só nasce da apuração por evidências (assess/confirm_dev_completion).
-- Mesma assinatura (compatível com o app publicado); _pct informado é recusado.
CREATE OR REPLACE FUNCTION public.record_dev_participation(_enrollment uuid, _expected_seq int, _kind text, _pct numeric, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _e public.dev_enrollments; _last int; _seq int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF _pct IS NOT NULL THEN RAISE EXCEPTION 'dev:pct-derived-only'; END IF;
  IF _kind IN ('confirmacao','espera') THEN RAISE EXCEPTION 'dev:use-place'; END IF;
  IF _kind IN ('conclusao','nao-conclusao') THEN RAISE EXCEPTION 'dev:use-completion-engine'; END IF;
  SELECT seq INTO _seq FROM public.dev_participation_events WHERE idempotency_key = _key AND enrollment_id = _enrollment;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _e FROM public.dev_enrollments WHERE id = _enrollment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF NOT (public.has_network_capability('gerir-turmas-de-formacao') OR (_kind = 'desistencia' AND _e.person_id = _p)) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_participation_events WHERE enrollment_id = _enrollment AND kind IN ('desistencia','cancelamento','conclusao','nao-conclusao')) THEN
    RAISE EXCEPTION 'dev:terminal'; END IF;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.dev_participation_events WHERE enrollment_id = _enrollment;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'dev:stale'; END IF;
  INSERT INTO public.dev_participation_events(enrollment_id, seq, kind, attendance_pct, note, actor_person, idempotency_key)
  VALUES (_enrollment, _last + 1, _kind, NULL, nullif(btrim(coalesce(_note, '')), ''), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;
REVOKE EXECUTE ON FUNCTION public.record_dev_participation(uuid, int, text, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_dev_participation(uuid, int, text, numeric, text, text) TO authenticated;