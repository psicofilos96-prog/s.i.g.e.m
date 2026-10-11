-- TSEMED.1 — matrícula ativa central distingue matrículas sem data de início (carga sem opened_on);
-- devolver só as datadas mostraria 0 onde há alunos.
CREATE OR REPLACE FUNCTION public.semed_table_central(_school text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE r record; inep text; act bigint; undated bigint; txt text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.semed_can_read(_school) THEN RETURN NULL; END IF;
  SELECT official_name, district, location_kind, phone, institutional_email INTO r
    FROM public.institutional_school_record_versions WHERE school_id = _school AND (valid_from IS NULL OR valid_from <= current_date)
    ORDER BY version_number DESC LIMIT 1;
  SELECT value INTO inep FROM public.institutional_school_identifiers WHERE school_id = _school AND identifier_kind = 'inep';
  SELECT cardinality(active_ids), undated_count INTO act, undated FROM public.active_enrollments_at(_school, current_date, now());
  txt := CASE WHEN coalesce(undated, 0) = 0 THEN act::text
              ELSE act || ' com data de início + ' || undated || ' sem data de início registrada (não apurado se vigentes)' END;
  RETURN jsonb_build_object('escola', r.official_name, 'inep', inep, 'distrito', r.district, 'zona', r.location_kind,
    'telefone', r.phone, 'email', r.institutional_email, 'matricula-ativa', txt, 'diretor', NULL);
END $$;
