CREATE OR REPLACE FUNCTION public.class_teaching_engagements_by_item(_class_id text, _on date, _known_at timestamp with time zone)
 RETURNS TABLE(mv uuid, ik text, eng uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  -- Mesmo conteúdo de class_block_teaching_engagements, para todos os blocos da turma de uma vez.
  SELECT q.mv, q.ik, q.eng FROM (
    SELECT v.matrix_version_id AS mv, v.item_key AS ik, v.engagement_id AS eng FROM public.teaching_assignment_effective_versions(_known_at) w
      JOIN public.teaching_assignment_versions v ON v.id = w.version_id
      JOIN public.teaching_assignments a ON a.id = v.assignment_id AND a.class_id = _class_id
     WHERE w.effective_from <= _on AND (w.effective_until IS NULL OR w.effective_until >= _on)
    UNION
    SELECT tv.matrix_version_id, tv.item_key, sv.substitute_engagement_id FROM public.teaching_substitution_effective_versions(_known_at) sw
      JOIN public.teaching_substitution_versions sv ON sv.id = sw.version_id
      JOIN public.teaching_substitutions s ON s.id = sv.substitution_id
      JOIN public.teaching_assignment_versions tv ON tv.assignment_id = s.assignment_id
      JOIN public.teaching_assignments a ON a.id = s.assignment_id AND a.class_id = _class_id
     WHERE sw.effective_from <= _on AND sw.effective_until >= _on) q
  WHERE (SELECT public.can_read_offer_organization(_class_id))
$function$;
REVOKE ALL ON FUNCTION public.class_teaching_engagements_by_item(text, date, timestamp with time zone) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_teaching_engagements_by_item(text, date, timestamp with time zone) TO authenticated;

CREATE OR REPLACE FUNCTION public.class_schedule_at(_class_id text, _on date, _known_at timestamp with time zone)
 RETURNS TABLE(result_kind text, class_id text, valid_on date, known_at timestamp with time zone, schedule_state text, schedule_id text, version_id uuid, version integer, change_kind text, valid_from date, effective_until date, originating_act_ref text, change_reason text, recorded_at timestamp with time zone, block_id uuid, block_key text, weekday smallint, starts_at time without time zone, ends_at time without time zone, block_minutes integer, component_id text, component_version integer, component_name text, nature_scheme_id text, nature_value_id text, nature_value_version integer, nature_label text, engagement_ids uuid[], block_state text, block_issues text[], overlapping_block_keys text[], coverage_state text, coverage_matrix_ids text[], day_minutes integer, week_minutes integer)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
#variable_conflict use_column
DECLARE _school text; _count integer; _sid text; _jabsent boolean; _covm text[] := '{}'; _covc text[] := '{}'; _covfail boolean := false;
  _rv uuid[] := '{}'; _rm text[] := '{}';
BEGIN
  IF _class_id IS NULL OR _on IS NULL THEN RAISE EXCEPTION 'schedule:valid-on-required'; END IF;
  IF _known_at IS NULL THEN RAISE EXCEPTION 'schedule:known-at-required'; END IF;
  SELECT c.school_id INTO _school FROM public.institutional_classes c WHERE c.id = _class_id;
  IF _school IS NULL OR NOT public.can_read_offer_organization(_class_id) THEN
    result_kind := 'access-denied'; class_id := _class_id; valid_on := _on; known_at := _known_at; RETURN NEXT; RETURN;
  END IF;
  SELECT s.id INTO _sid FROM public.class_schedules s WHERE s.class_id = _class_id AND s.created_at <= _known_at;
  IF _sid IS NOT NULL AND EXISTS (
    WITH k AS (SELECT v.* FROM public.class_schedule_versions v WHERE v.schedule_id = _sid AND v.created_at <= _known_at)
    SELECT 1 FROM k LEFT JOIN k p ON p.id = k.supersedes_id
    WHERE (k.supersedes_id IS NULL AND k.version <> 1) OR (k.supersedes_id IS NOT NULL AND (p.id IS NULL OR k.version <> p.version + 1))
       OR NOT EXISTS (SELECT 1 FROM public.class_schedule_blocks b WHERE b.version_id = k.id)
  ) THEN RAISE EXCEPTION 'schedule:invalid-chain'; END IF;
  SELECT count(*)::integer INTO _count FROM public.class_schedule_effective_versions(_sid, _on, _known_at);
  IF _count > 1 THEN RAISE EXCEPTION 'schedule:ambiguous-temporal-state'; END IF;
  IF _count = 1 AND NOT EXISTS (SELECT 1 FROM public.class_at(_class_id, _on, _known_at)) THEN
    RAISE EXCEPTION 'schedule:outside-class-validity';
  END IF;
  IF _count = 0 THEN
    result_kind := 'absent'; class_id := _class_id; valid_on := _on; known_at := _known_at; RETURN NEXT; RETURN;
  END IF;
  _jabsent := NOT EXISTS (SELECT 1 FROM public.class_journey_at(_class_id, _on, _known_at) j WHERE j.result_kind = 'interval');
  BEGIN
    SELECT coalesce(array_agg(x.mid), '{}'), coalesce(array_agg(x.cid), '{}') INTO _covm, _covc FROM (
      SELECT DISTINCT m.matrix_id AS mid, it.component_id AS cid
      FROM public.class_curricular_matrices_at(_school, _class_id, _on, _known_at) m
      CROSS JOIN LATERAL public.curricular_matrix_items_at(m.matrix_id, _on, _known_at) it
      WHERE m.matrix_version_id IS NOT NULL AND it.version_id = m.matrix_version_id AND it.component_id IS NOT NULL
        AND ((m.result_kind = 'matrix' AND m.state = 'resolvida-por-posicao')
          OR (m.result_kind = 'specific-link' AND m.state = 'vinculo-especifico-vigente'))) x;
    SELECT coalesce(array_agg(y.v), '{}'), coalesce(array_agg(y.m), '{}') INTO _rv, _rm FROM (
      SELECT DISTINCT m.matrix_version_id AS v, m.matrix_id AS m
      FROM public.class_curricular_matrices_at(_school, _class_id, _on, _known_at) m
      WHERE m.matrix_version_id IS NOT NULL
        AND ((m.result_kind = 'matrix' AND m.state = 'resolvida-por-posicao')
          OR (m.result_kind = 'specific-link' AND m.state = 'vinculo-especifico-vigente'))) y;
  EXCEPTION WHEN OTHERS THEN _covfail := true; _covm := '{}'; _covc := '{}'; _rv := '{}'; _rm := '{}';
  END;

  RETURN QUERY
  WITH ev AS (SELECT * FROM public.class_schedule_effective_versions(_sid, _on, _known_at)),
  jv AS (SELECT j.weekday AS wd, j.starts_at AS js, j.ends_at AS je FROM public.class_journey_at(_class_id, _on, _known_at) j WHERE j.result_kind = 'interval'),
  cov AS (SELECT x.mid, x.cid FROM unnest(_covm, _covc) AS x(mid, cid)),
  rvm AS (SELECT r.v, r.m FROM unnest(_rv, _rm) AS r(v, m)),
  te AS MATERIALIZED (SELECT t.mv, t.ik, t.eng FROM public.class_teaching_engagements_by_item(_class_id, _on, _known_at) t),
  b AS (SELECT bl.* FROM public.class_schedule_blocks bl JOIN ev ON ev.id = bl.version_id),
  bx AS (
    SELECT b.*, cv.cver, cv.cname, cv.cact, ad.nlabel,
      CASE WHEN b.matrix_version_id IS NULL THEN '{}'::uuid[] ELSE ARRAY(SELECT DISTINCT te.eng FROM te WHERE te.mv = b.matrix_version_id AND te.ik = b.item_key ORDER BY 1) END AS engs,
      EXISTS (SELECT 1 FROM jv WHERE jv.wd = b.weekday AND jv.js <= b.starts_at AND b.ends_at <= jv.je) AS fits,
      (SELECT array_agg(o.block_key ORDER BY o.block_key) FROM b o WHERE o.id <> b.id AND o.weekday = b.weekday
         AND o.starts_at < b.ends_at AND b.starts_at < o.ends_at) AS ovl,
      CASE WHEN b.matrix_version_id IS NOT NULL
           THEN (SELECT array_agg(DISTINCT rvm.m ORDER BY rvm.m) FROM rvm WHERE rvm.v = b.matrix_version_id)
           ELSE (SELECT array_agg(DISTINCT cov.mid ORDER BY cov.mid) FROM cov WHERE cov.cid = b.component_id) END AS covmx
    FROM b
    LEFT JOIN LATERAL (SELECT v.version AS cver, v.official_name AS cname, v.is_active AS cact FROM public.curricular_component_versions v
      WHERE v.component_id = b.component_id AND v.valid_from <= _on AND v.created_at <= _known_at ORDER BY v.version DESC LIMIT 1) cv ON true
    LEFT JOIN LATERAL (SELECT d.label AS nlabel FROM public.attribute_value_definitions d
      WHERE d.scheme_id = b.nature_scheme_id AND d.value_id = b.nature_value_id AND d.version = b.nature_value_version
        AND d.status = 'homologada' AND (d.valid_from IS NULL OR d.valid_from <= _on) AND d.created_at <= _known_at LIMIT 1) ad ON true
  ),
  bi AS (
    SELECT bx.*, (extract(epoch FROM bx.ends_at - bx.starts_at) / 60)::integer AS mins,
      array_remove(ARRAY[
        CASE WHEN _jabsent THEN 'bloqueada:jornada-ausente' END,
        CASE WHEN bx.component_id IS NOT NULL AND bx.cact IS NOT TRUE THEN 'bloqueada:componente-inexistente-ou-inativo' END,
        CASE WHEN bx.nature_value_id IS NOT NULL AND bx.nlabel IS NULL THEN 'bloqueada:tipo-nao-homologado' END,
        CASE WHEN bx.matrix_version_id IS NOT NULL AND bx.covmx IS NULL AND NOT _covfail THEN 'bloqueada:referencia-curricular-nao-aplicavel' END,
        CASE WHEN NOT _jabsent AND NOT bx.fits THEN 'bloqueada:bloco-fora-da-jornada' END,
        CASE WHEN bx.ovl IS NOT NULL THEN 'inconsistente:sobreposicao-de-blocos' END
      ]::text[], NULL) AS issues
    FROM bx
  ),
  bj AS (SELECT bi.*, EXISTS (SELECT 1 FROM unnest(bi.issues) z WHERE z LIKE 'bloqueada:%') AS blk FROM bi)
  SELECT 'block'::text, _class_id, _on, _known_at,
    CASE WHEN _jabsent THEN 'bloqueada:jornada-ausente'
         WHEN bool_or(bj.blk) OVER () THEN 'bloqueada:blocos-com-pendencia'
         WHEN bool_or(cardinality(bj.issues) > 0) OVER () THEN 'inconsistente:sobreposicao-de-blocos'
         ELSE 'utilizavel' END,
    _sid, ev.id, ev.version, ev.change_kind, ev.valid_from, ev.eu, ev.act, ev.reason, ev.created,
    bj.id, bj.block_key, bj.weekday, bj.starts_at, bj.ends_at, bj.mins, bj.component_id, bj.cver, bj.cname,
    bj.nature_scheme_id, bj.nature_value_id, bj.nature_value_version, bj.nlabel, coalesce(bj.engs, '{}'::uuid[]),
    coalesce(bj.issues[1], 'utilizavel'), bj.issues, coalesce(bj.ovl, '{}'::text[]),
    CASE WHEN bj.component_id IS NULL AND bj.matrix_version_id IS NULL THEN 'nao-aplicavel'
         WHEN bj.covmx IS NOT NULL THEN 'comprovada'
         WHEN _covfail THEN 'nao-comprovada:leitura-curricular-interrompida'
         ELSE 'nao-comprovada' END,
    coalesce(bj.covmx, '{}'::text[]),
    (sum(bj.mins) OVER (PARTITION BY bj.weekday))::integer, (sum(bj.mins) OVER ())::integer
  FROM bj CROSS JOIN ev
  ORDER BY bj.weekday, bj.starts_at, bj.block_key;
END $function$;