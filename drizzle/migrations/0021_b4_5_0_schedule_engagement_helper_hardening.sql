-- B4.5.0 — Hardening do helper B4.4 class_schedule_engagement_valid (aditivo; 0020 intacta).
-- Defeito objetivo: o helper SECURITY DEFINER respondia sobre QUALQUER UUID de atuação para qualquer
-- turma legível, permitindo testar UUIDs arbitrários (vínculo turma/componente/vigência) — oracle.
-- Agora só responde TRUE para atuação efetivamente referenciada por um bloco B4.4 (conhecido em knownAt)
-- da grade daquela turma cujo componente coincide com o informado. Contrato de class_schedule_at preservado:
-- o reader só consulta atuações referenciadas pelo próprio bloco.
CREATE OR REPLACE FUNCTION public.class_schedule_engagement_valid(_engagement uuid, _class text, _component text, _on date, _known_at timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $fn$
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = _class
      AND (public.can_read_institutional_class(c.id, c.school_id) OR public.has_school_capability('consultar-matricula-e-movimentacao', c.school_id)))
    THEN NULL
    ELSE EXISTS (SELECT 1 FROM public.class_schedule_block_engagements be
        JOIN public.class_schedule_blocks b ON b.id = be.block_id
        JOIN public.class_schedule_versions v ON v.id = b.version_id AND v.created_at <= _known_at
        JOIN public.class_schedules s ON s.id = v.schedule_id AND s.class_id = _class
        WHERE be.engagement_id = _engagement AND b.component_id IS NOT DISTINCT FROM _component)
     AND EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = _engagement AND e.created_at <= _known_at
      AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
      AND NOT EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = e.id AND x.created_at <= _known_at AND x.ended_on < _on)
      AND (e.class_id = _class OR EXISTS (SELECT 1 FROM public.institutional_engagement_scope_classes s
             WHERE s.engagement_id = e.id AND s.class_id = _class AND s.created_at <= _known_at))
      AND (e.component_id IS NULL OR _component IS NULL OR e.component_id = _component))
  END
$fn$;
REVOKE ALL ON FUNCTION public.class_schedule_engagement_valid(uuid, text, text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_schedule_engagement_valid(uuid, text, text, date, timestamptz) TO authenticated;