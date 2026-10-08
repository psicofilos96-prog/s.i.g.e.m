-- NINC.1: negação não pode levantar exceção depois de gravar a trilha (o RAISE desfaria o registro da tentativa).
-- Recusa e ausência devolvem o mesmo conjunto vazio, como na Central de Auditoria, para não permitir enumeração.
CREATE OR REPLACE FUNCTION public.inclusion_clinical_records_for(_school text, _student text, _purpose text)
RETURNS TABLE(id uuid, logical_id uuid, version integer, event_kind text, cid_as_written text, source_document text,
  dimension_scheme_id text, dimension_value_id text, note text, attachment_id uuid, valid_from date, valid_to date, reason text, recorded_at timestamptz, is_head boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _purpose IS NULL OR length(btrim(_purpose)) = 0 THEN RAISE EXCEPTION 'inclusion:purpose-required'; END IF;
  g := public.inclusion_grant('consultar-documento-sensivel-inclusao', _school);
  INSERT INTO public.inclusion_clinical_access_events(school_id, student_id, user_id, engagement_id, purpose, granted)
  VALUES (_school, _student, auth.uid(), g, left(_purpose, 300), g IS NOT NULL);
  IF g IS NULL THEN RETURN; END IF;
  RETURN QUERY SELECT c.id, c.logical_id, c.version, c.event_kind, c.cid_as_written, c.source_document, c.dimension_scheme_id, c.dimension_value_id,
    c.note, c.attachment_id, c.valid_from, c.valid_to, c.reason, c.recorded_at,
    NOT EXISTS (SELECT 1 FROM public.inclusion_clinical_records s WHERE s.supersedes_id = c.id)
    FROM public.inclusion_clinical_records c WHERE c.school_id = _school AND c.student_id = _student
    ORDER BY c.logical_id, c.version;
END $fn$;