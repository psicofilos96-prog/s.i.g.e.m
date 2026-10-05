-- V.0.3 complemento: a fronteira de leitura da organização da oferta também usa a data institucional alvo
-- (início do ano letivo da turma / data consultada), não só o relógio — quem prepara 2027 lê o que prepara.
CREATE FUNCTION public.offer_capability_on(_school text, _on date) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT _school IS NOT NULL AND _on IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.effective_scope_capabilities(_on) c
    WHERE c.policy_id IS NOT NULL
      AND c.capability_id IN ('consultar-organizacao-da-oferta','manter-jornada-da-turma','manter-grade-da-turma','manter-atribuicao-docente')
      AND ((c.scope_level = 'escola' AND c.school_id = _school) OR c.scope_level = 'rede'))
$fn$;
REVOKE ALL ON FUNCTION public.offer_capability_on(text, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.offer_capability_on(text, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.can_read_offer_organization(_class_id text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
  SELECT EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = _class_id AND (
    public.can_read_institutional_class(c.id, c.school_id)
    OR public.has_school_capability('consultar-organizacao-da-oferta', c.school_id)
    OR public.has_school_capability('consultar-matricula-e-movimentacao', c.school_id)
    OR public.teaches_class(c.id)
    OR public.offer_capability_on(c.school_id, (SELECT v.starts_on FROM public.institutional_academic_year_versions v
         WHERE v.academic_year_id = c.academic_year_id ORDER BY v.version DESC LIMIT 1))))
$fn$;

CREATE OR REPLACE FUNCTION public.school_teaching_schedule_at(_school_id text, _on date, _known_at timestamptz)
RETURNS TABLE(result_kind text, person_id uuid, engagement_id uuid, origin text, assignment_id text, substitution_id text,
  class_id text, class_name text, block_id uuid, block_key text, weekday smallint, starts_at time, ends_at time, block_minutes integer,
  matrix_version_id uuid, item_key text, component_label text, conflict_with_block_ids uuid[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
#variable_conflict use_column
BEGIN
  IF _school_id IS NULL OR _on IS NULL OR _known_at IS NULL THEN RAISE EXCEPTION 'school-schedule:target-required'; END IF;
  IF NOT (public.has_school_capability('consultar-organizacao-da-oferta', _school_id)
       OR public.has_school_capability('manter-atribuicao-docente', _school_id)
       OR public.has_school_capability('manter-grade-da-turma', _school_id)
       OR public.offer_capability_on(_school_id, _on)) THEN
    result_kind := 'access-denied'; RETURN NEXT; RETURN;
  END IF;
  RETURN QUERY
  WITH sv AS (
    SELECT c.id AS cid, c.name AS cname, ev.id AS vid
    FROM public.institutional_classes c
    JOIN public.class_schedules s ON s.class_id = c.id AND s.created_at <= _known_at
    CROSS JOIN LATERAL public.class_schedule_effective_versions(s.id, _on, _known_at) ev
    WHERE c.school_id = _school_id),
  bl AS (SELECT sv.cid, sv.cname, b.* FROM sv JOIN public.class_schedule_blocks b ON b.version_id = sv.vid WHERE b.matrix_version_id IS NOT NULL),
  tit AS (
    SELECT bl.*, v.engagement_id AS eid, 'titular'::text AS org, v.assignment_id AS aid, NULL::text AS subid
    FROM bl JOIN public.teaching_assignments a ON a.class_id = bl.cid
    JOIN public.teaching_assignment_versions v ON v.assignment_id = a.id AND v.matrix_version_id = bl.matrix_version_id AND v.item_key = bl.item_key
    JOIN public.teaching_assignment_effective_versions(_known_at) w ON w.version_id = v.id
    WHERE w.effective_from <= _on AND (w.effective_until IS NULL OR w.effective_until >= _on)),
  sub AS (
    SELECT bl.*, x.substitute_engagement_id AS eid, 'substituicao'::text AS org, s.assignment_id AS aid, s.id AS subid
    FROM bl JOIN public.teaching_assignments a ON a.class_id = bl.cid
    JOIN public.teaching_assignment_versions tv ON tv.assignment_id = a.id AND tv.matrix_version_id = bl.matrix_version_id AND tv.item_key = bl.item_key
    JOIN public.teaching_substitutions s ON s.assignment_id = a.id
    JOIN public.teaching_substitution_versions x ON x.substitution_id = s.id
    JOIN public.teaching_substitution_effective_versions(_known_at) sw ON sw.version_id = x.id
    WHERE sw.effective_from <= _on AND sw.effective_until >= _on),
  al AS (SELECT DISTINCT ON (q.id, q.eid) q.* FROM (SELECT * FROM tit UNION ALL SELECT * FROM sub) q ORDER BY q.id, q.eid, q.org),
  pe AS (SELECT al.*, e.person_id AS pid FROM al JOIN public.institutional_engagements e ON e.id = al.eid)
  SELECT 'block'::text, pe.pid, pe.eid, pe.org, pe.aid, pe.subid, pe.cid, pe.cname, pe.id, pe.block_key, pe.weekday, pe.starts_at, pe.ends_at,
    (extract(epoch FROM pe.ends_at - pe.starts_at) / 60)::integer, pe.matrix_version_id, pe.item_key,
    (SELECT i.component_label_snapshot FROM public.curricular_matrix_items i WHERE i.matrix_version_id = pe.matrix_version_id AND i.item_key = pe.item_key),
    ARRAY(SELECT o.id FROM pe o WHERE o.pid = pe.pid AND o.id <> pe.id AND o.weekday = pe.weekday
          AND o.starts_at < pe.ends_at AND pe.starts_at < o.ends_at ORDER BY o.id)
  FROM pe ORDER BY pe.pid, pe.weekday, pe.starts_at, pe.cid;
END $fn$;
