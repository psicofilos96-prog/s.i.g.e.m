-- 0101: herdar × alterar × limpar nos campos administrativos. Termina em RAISE; nada persiste.
DO $T$ DECLARE s text := 'inep-33100012'; v1 record; b uuid; v2 uuid; v3 uuid; v4 uuid; r record; msg text;
BEGIN
  SELECT * INTO v1 FROM public.institutional_school_record_versions WHERE school_id = s ORDER BY version_number DESC LIMIT 1;
  IF v1.administrative_dependency IS DISTINCT FROM 'privada' THEN RAISE EXCEPTION 'FAIL precondition'; END IF;
  -- legado/omitido: herda
  v2 := public.school_record_version_core(s, v1.id, v1.official_name, NULL, NULL, v1.location_kind, true, '2026-09-01', 'teste herdar', NULL, NULL, NULL, v1.phone, v1.institutional_email, NULL, NULL, NULL, NULL, '   ', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  SELECT * INTO r FROM public.institutional_school_record_versions WHERE id = v2;
  IF r.administrative_dependency <> 'privada' OR r.private_school_category <> 'Confessional' OR r.partnership_public_authority <> 'Municipal' THEN RAISE EXCEPTION 'FAIL inherit (blank must not change)'; END IF;
  -- alterar
  v3 := public.school_record_version_core(s, v2, v1.official_name, NULL, NULL, v1.location_kind, true, '2026-09-02', 'teste alterar', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Filantropica', NULL, NULL, NULL, NULL, NULL, NULL, NULL);
  SELECT * INTO r FROM public.institutional_school_record_versions WHERE id = v3;
  IF r.private_school_category <> 'Filantropica' OR r.administrative_dependency <> 'privada' THEN RAISE EXCEPTION 'FAIL set'; END IF;
  -- limpar explícito, junto com alteração da dependência
  v4 := public.school_record_version_core(s, v3, v1.official_name, NULL, NULL, v1.location_kind, true, '2026-09-03', 'teste limpar', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'municipal', NULL, NULL, ARRAY['private_school_category','partnership_public_authority'], NULL, NULL, NULL, NULL, NULL);
  SELECT * INTO r FROM public.institutional_school_record_versions WHERE id = v4;
  IF r.administrative_dependency <> 'municipal' OR r.private_school_category IS NOT NULL OR r.partnership_public_authority IS NOT NULL THEN RAISE EXCEPTION 'FAIL clear'; END IF;
  -- versões anteriores intactas
  SELECT * INTO r FROM public.institutional_school_record_versions WHERE id = v1.id;
  IF r.private_school_category <> 'Confessional' OR r.partnership_public_authority <> 'Municipal' THEN RAISE EXCEPTION 'FAIL history'; END IF;
  SELECT * INTO r FROM public.institutional_school_record_versions WHERE id = v3;
  IF r.private_school_category <> 'Filantropica' THEN RAISE EXCEPTION 'FAIL history v3'; END IF;
  -- base superada
  BEGIN PERFORM public.school_record_version_core(s, v3, 'x', NULL, NULL, NULL, true, '2026-09-04', 'j', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL); RAISE EXCEPTION 'FAIL head';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg NOT LIKE 'Versão base superada%' THEN RAISE EXCEPTION 'FAIL head %', msg; END IF; END;
  -- conflito limpar+alterar e campo desconhecido
  BEGIN PERFORM public.school_record_version_core(s, v4, 'x', NULL, NULL, NULL, true, '2026-09-04', 'j', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'privada', NULL, NULL, ARRAY['administrative_dependency'], NULL, NULL, NULL, NULL, NULL); RAISE EXCEPTION 'FAIL conflict';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'school:clear-and-set-conflict' THEN RAISE EXCEPTION 'FAIL conflict %', msg; END IF; END;
  BEGIN PERFORM public.school_record_version_core(s, v4, 'x', NULL, NULL, NULL, true, '2026-09-04', 'j', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, ARRAY['official_name'], NULL, NULL, NULL, NULL, NULL); RAISE EXCEPTION 'FAIL unknown';
  EXCEPTION WHEN raise_exception THEN GET STACKED DIAGNOSTICS msg = MESSAGE_TEXT; IF msg <> 'school:clear-unknown-field' THEN RAISE EXCEPTION 'FAIL unknown %', msg; END IF; END;
  RAISE EXCEPTION 'TEST-OK-ROLLBACK';
END $T$;
