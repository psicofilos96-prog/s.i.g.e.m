-- PERF.LOADING.2 — leitor temporal de turmas: visibilidade por conjunto (uma vez por chamada),
-- mesma semântica de can_read_offer_organization (que já inclui can_read_institutional_class).
CREATE OR REPLACE FUNCTION public.classes_with_period_link_at(_valid_on date, _known_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS TABLE(class_id text, school_id text, academic_year_id text, record jsonb, link jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF _valid_on IS NULL THEN RAISE EXCEPTION 'class:query-arguments-required'; END IF;
  IF auth.uid() IS NULL THEN RETURN; END IF;
  RETURN QUERY
  WITH visible AS (
    SELECT c.id, c.school_id, c.academic_year_id,
           public.can_read_institutional_class(c.id, c.school_id) AS link_ok
      FROM public.institutional_classes c
     WHERE c.id IN (SELECT public.readable_class_ids())
  )
  SELECT v.id, v.school_id, v.academic_year_id,
    COALESCE((SELECT jsonb_agg(to_jsonb(r)) FROM public.class_at(v.id, _valid_on, _known_at) r), '[]'::jsonb),
    CASE WHEN v.link_ok
      THEN COALESCE((SELECT jsonb_agg(to_jsonb(l)) FROM public.class_period_organization_at(v.id, _valid_on, _known_at) l), '[]'::jsonb)
      ELSE '[]'::jsonb END
  FROM visible v;
END $function$;