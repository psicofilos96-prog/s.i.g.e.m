-- V.3 UX: depois da busca exata (locate_professional_exact), lista só as atuações DA PESSOA localizada
-- nesta escola, vigentes na data-alvo, para quem tem manter-atribuicao-docente na escola. Sem diretório livre.
CREATE FUNCTION public.teaching_candidate_engagements(_school_id text, _person_id uuid, _on date)
RETURNS TABLE(engagement_id uuid, position_label text, valid_from date, valid_until date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _school_id IS NULL OR _person_id IS NULL OR _on IS NULL THEN RAISE EXCEPTION 'assignment:target-required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.effective_scope_capabilities(_on) c
                 WHERE c.capability_id = 'manter-atribuicao-docente' AND c.policy_id IS NOT NULL
                   AND c.scope_level = 'escola' AND c.school_id = _school_id) THEN
    RAISE EXCEPTION 'capability:manter-atribuicao-docente'; END IF;
  RETURN QUERY SELECT e.id, e.position_label_snapshot, e.valid_from, e.valid_until
    FROM public.institutional_engagements e
   WHERE e.person_id = _person_id AND e.school_id = _school_id
     AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
     AND NOT EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = e.id AND x.ended_on < _on)
   ORDER BY e.valid_from, e.id;
END $fn$;
REVOKE ALL ON FUNCTION public.teaching_candidate_engagements(text, uuid, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.teaching_candidate_engagements(text, uuid, date) TO authenticated;
