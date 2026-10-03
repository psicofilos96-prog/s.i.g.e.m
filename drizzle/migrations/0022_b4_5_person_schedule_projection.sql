-- B4.5 — Horário do profissional como PROJEÇÃO pura (sem tabela, sem writer, sem capability nova).
-- pessoa → atuações vigentes → blocos B4.4 (class_schedule_at) → horários/conflitos potenciais.
-- Só a própria pessoa (current_person_id()); visibilidade gerencial de terceiros é decisão aberta.

-- Envoltório por turma: chama class_schedule_at e converte SOMENTE falhas fail-closed conhecidas
-- (schedule:*/journey:*) em linha 'source-error', para nunca fabricar bloco nem esconder a falha.
CREATE FUNCTION public.person_schedule_class_source(_class_id text, _on date, _known_at timestamptz)
RETURNS TABLE(result_kind text, class_id text, schedule_state text, schedule_id text, version_id uuid, version integer,
  block_id uuid, block_key text, weekday smallint, starts_at time, ends_at time, block_minutes integer,
  component_id text, component_name text, nature_label text, engagement_ids uuid[], block_state text, issue text)
LANGUAGE plpgsql STABLE SET search_path = '' AS $fn$
#variable_conflict use_column
DECLARE _msg text;
BEGIN
  BEGIN
    PERFORM count(*) FROM public.class_schedule_at(_class_id, _on, _known_at);
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS _msg = MESSAGE_TEXT;
    IF _msg !~ '^(schedule|journey):' THEN RAISE; END IF;
    result_kind := 'source-error'; class_id := _class_id; issue := _msg; RETURN NEXT; RETURN;
  END;
  RETURN QUERY SELECT s.result_kind, _class_id, s.schedule_state, s.schedule_id, s.version_id, s.version, s.block_id, s.block_key,
    s.weekday, s.starts_at, s.ends_at, s.block_minutes, s.component_id, s.component_name, s.nature_label, s.engagement_ids,
    s.block_state, NULL::text
  FROM public.class_schedule_at(_class_id, _on, _known_at) s;
END $fn$;
REVOKE ALL ON FUNCTION public.person_schedule_class_source(text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.person_schedule_class_source(text, date, timestamptz) TO authenticated;

CREATE FUNCTION public.person_schedule_at(_person_id uuid, _on date, _known_at timestamptz)
RETURNS TABLE(result_kind text, valid_on date, known_at timestamptz, class_id text, school_id text,
  source_state text, source_issue text, schedule_id text, version_id uuid, version integer,
  block_id uuid, block_key text, weekday smallint, starts_at time, ends_at time, block_minutes integer,
  component_id text, component_name text, nature_label text, own_engagement_ids uuid[], block_state text,
  operational boolean, other_block_id uuid, other_class_id text, overlap_starts_at time, overlap_ends_at time,
  operational_block_count integer, unavailable_block_count integer, week_minutes integer, conflict_count integer)
LANGUAGE plpgsql STABLE SET search_path = '' AS $fn$
#variable_conflict use_column
DECLARE _me uuid;
BEGIN
  IF _on IS NULL THEN RAISE EXCEPTION 'person-schedule:valid-on-required'; END IF;
  IF _known_at IS NULL THEN RAISE EXCEPTION 'person-schedule:known-at-required'; END IF;
  _me := public.current_person_id();
  IF _me IS NULL OR _person_id IS NULL OR _person_id <> _me THEN
    result_kind := 'access-denied'; valid_on := _on; known_at := _known_at; RETURN NEXT; RETURN;
  END IF;

  RETURN QUERY
  WITH me_e AS (
    SELECT e.id, e.class_id FROM public.institutional_engagements e
    WHERE e.person_id = _me AND e.created_at <= _known_at
      AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
      AND NOT EXISTS (SELECT 1 FROM public.engagement_endings x WHERE x.engagement_id = e.id AND x.created_at <= _known_at AND x.ended_on < _on)),
  cls AS (
    SELECT me_e.class_id AS cid FROM me_e WHERE me_e.class_id IS NOT NULL
    UNION SELECT s.class_id FROM public.institutional_engagement_scope_classes s JOIN me_e ON me_e.id = s.engagement_id
      WHERE s.created_at <= _known_at),
  src AS (SELECT x.* FROM cls CROSS JOIN LATERAL public.person_schedule_class_source(cls.cid, _on, _known_at) x),
  own AS (
    SELECT src.*, ARRAY(SELECT u FROM (SELECT unnest(src.engagement_ids) INTERSECT SELECT me_e.id FROM me_e) t(u) ORDER BY u) AS mine
    FROM src WHERE src.result_kind = 'block'),
  blk AS (
    SELECT own.*, (own.schedule_state = 'utilizavel' AND own.block_state = 'utilizavel') AS op,
      (SELECT c.school_id FROM public.institutional_classes c WHERE c.id = own.class_id) AS sch
    FROM own WHERE cardinality(own.mine) > 0),
  cf AS (
    SELECT a.*, b.block_id AS ob, b.class_id AS oc, GREATEST(a.starts_at, b.starts_at) AS os, LEAST(a.ends_at, b.ends_at) AS oe
    FROM blk a JOIN blk b ON a.op AND b.op AND a.weekday = b.weekday AND a.block_id < b.block_id
      AND a.starts_at < b.ends_at AND b.starts_at < a.ends_at),
  unav AS (
    SELECT src.class_id, CASE WHEN src.result_kind = 'access-denied' THEN 'turma-nao-legivel' ELSE 'erro-de-leitura' END AS st, src.issue
    FROM src WHERE src.result_kind IN ('access-denied', 'source-error')),
  tot AS (
    SELECT (SELECT count(*) FROM blk WHERE op)::integer AS nop, (SELECT count(*) FROM blk WHERE NOT op)::integer AS nun,
      (SELECT coalesce(sum(block_minutes), 0) FROM blk WHERE op)::integer AS wm, (SELECT count(*) FROM cf)::integer AS nc,
      (SELECT count(*) FROM unav)::integer AS nu)
  SELECT * FROM (
    SELECT 'block'::text AS rk, _on AS von, _known_at AS kat, blk.class_id AS cid, blk.sch AS sid, blk.schedule_state AS sst, NULL::text AS sis,
      blk.schedule_id AS schid, blk.version_id AS vid, blk.version AS ver, blk.block_id AS bid, blk.block_key AS bkey, blk.weekday AS wd,
      blk.starts_at AS sa, blk.ends_at AS ea, blk.block_minutes AS bm, blk.component_id AS compid, blk.component_name AS compname,
      blk.nature_label AS nlabel, blk.mine AS mine, blk.block_state AS bst, blk.op AS op, NULL::uuid AS obid, NULL::text AS ocid,
      NULL::time AS os, NULL::time AS oe, NULL::integer AS nop, NULL::integer AS nun, NULL::integer AS wm, NULL::integer AS nc
    FROM blk
    UNION ALL
    SELECT 'conflict', _on, _known_at, cf.class_id, cf.sch, 'conflito-temporal-potencial', NULL, cf.schedule_id, cf.version_id, cf.version,
      cf.block_id, cf.block_key, cf.weekday, cf.starts_at, cf.ends_at, cf.block_minutes, cf.component_id, cf.component_name,
      cf.nature_label, cf.mine, cf.block_state, cf.op, cf.ob, cf.oc, cf.os, cf.oe, NULL, NULL, NULL, NULL
    FROM cf
    UNION ALL
    SELECT 'source-unavailable', _on, _known_at, unav.class_id, NULL, unav.st, unav.issue, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL
    FROM unav
    UNION ALL
    SELECT CASE WHEN tot.nop + tot.nun + tot.nu = 0 THEN 'absent' ELSE 'summary' END, _on, _known_at, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
      NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
      CASE WHEN tot.nop + tot.nun + tot.nu = 0 THEN NULL ELSE tot.nop END, CASE WHEN tot.nop + tot.nun + tot.nu = 0 THEN NULL ELSE tot.nun END,
      CASE WHEN tot.nop + tot.nun + tot.nu = 0 THEN NULL ELSE tot.wm END, CASE WHEN tot.nop + tot.nun + tot.nu = 0 THEN NULL ELSE tot.nc END
    FROM tot
  ) z
  ORDER BY CASE z.rk WHEN 'summary' THEN 0 WHEN 'absent' THEN 0 WHEN 'source-unavailable' THEN 1 WHEN 'block' THEN 2 ELSE 3 END,
    z.wd NULLS FIRST, z.sa NULLS FIRST, z.cid NULLS FIRST, z.bid NULLS FIRST, z.obid NULLS FIRST;
END $fn$;
REVOKE ALL ON FUNCTION public.person_schedule_at(uuid, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.person_schedule_at(uuid, date, timestamptz) TO authenticated;