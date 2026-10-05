-- 0120 — Correção da 0119: a atuação de rede vem de effective_scope_capabilities (escopo 'rede'), não de capability_grant de turma.
CREATE OR REPLACE FUNCTION public.map_rule_network_engagement()
RETURNS uuid LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $$
  SELECT e.engagement_id FROM public.effective_scope_capabilities() e
  WHERE e.capability_id = 'manter-regra-de-competencia-do-mapa' AND e.scope_level = 'rede'
  ORDER BY e.engagement_id LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.map_rule_network_engagement() FROM PUBLIC, anon, service_role;

CREATE OR REPLACE FUNCTION public.record_map_competence_rule_draft(_id text, _expected_version integer, _valid_from date, _valid_until date, _definition jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE me uuid := public.current_person_id(); eng uuid; head integer; issue text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF me IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_network_capability('manter-regra-de-competencia-do-mapa') THEN RAISE EXCEPTION 'map-rule:capability-missing'; END IF;
  eng := public.map_rule_network_engagement();
  IF eng IS NULL THEN RAISE EXCEPTION 'map-rule:engagement-missing'; END IF;
  IF coalesce(btrim(_id),'') !~ '^[a-z0-9-]{3,80}$' THEN RAISE EXCEPTION 'map-rule:id-invalid'; END IF;
  IF _valid_from IS NULL OR (_valid_until IS NOT NULL AND _valid_until < _valid_from) THEN RAISE EXCEPTION 'map-rule:validity-invalid'; END IF;
  issue := public.map_rule_definition_issue(_definition);
  IF issue IS NOT NULL THEN RAISE EXCEPTION '%', issue; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('map-rule:' || _id));
  SELECT max(version) INTO head FROM public.map_competence_rules WHERE id = _id;
  IF head IS DISTINCT FROM _expected_version THEN RAISE EXCEPTION 'map-rule:stale-head'; END IF;
  INSERT INTO public.map_competence_rules(id, version, status, homologation_act_ref, valid_from, valid_until, definition, drafted_by, drafted_person_id, drafted_engagement_id)
  VALUES (_id, coalesce(head, 0) + 1, 'rascunho', NULL, _valid_from, _valid_until, _definition, auth.uid(), me, eng);
  RETURN coalesce(head, 0) + 1;
END $$;

CREATE OR REPLACE FUNCTION public.homologate_map_competence_rule(_id text, _version integer, _source_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE me uuid := public.current_person_id(); eng uuid; r record; issue text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF me IS NULL THEN RAISE EXCEPTION 'session:person-required'; END IF;
  IF NOT public.has_network_capability('manter-regra-de-competencia-do-mapa') THEN RAISE EXCEPTION 'map-rule:capability-missing'; END IF;
  eng := public.map_rule_network_engagement();
  IF eng IS NULL THEN RAISE EXCEPTION 'map-rule:engagement-missing'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('map-rule:' || _id));
  SELECT * INTO r FROM public.map_competence_rules WHERE id = _id AND version = _version FOR UPDATE;
  IF r.id IS NULL THEN RAISE EXCEPTION 'map-rule:not-found'; END IF;
  IF r.status <> 'rascunho' THEN RAISE EXCEPTION 'map-rule:not-draft'; END IF;
  IF EXISTS (SELECT 1 FROM public.map_competence_rules WHERE id = _id AND version > _version) THEN RAISE EXCEPTION 'map-rule:stale-head'; END IF;
  IF r.drafted_person_id IS NULL OR r.drafted_person_id = me THEN RAISE EXCEPTION 'map-rule:segregation'; END IF;
  issue := public.map_rule_definition_issue(r.definition);
  IF issue IS NOT NULL THEN RAISE EXCEPTION '%', issue; END IF;
  IF EXISTS (SELECT 1 FROM public.map_competence_rules o
             WHERE o.status = 'homologada' AND o.id <> _id
               AND o.valid_from <= coalesce(r.valid_until, 'infinity'::date) AND coalesce(o.valid_until, 'infinity'::date) >= r.valid_from
               AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(o.definition -> 'coveredSchoolIds') a
                           JOIN jsonb_array_elements_text(r.definition -> 'coveredSchoolIds') b ON a = b)) THEN
    RAISE EXCEPTION 'map-rule:overlapping-coverage'; END IF;
  UPDATE public.map_competence_rules SET status = 'homologada', homologation_act_ref = nullif(btrim(coalesce(_source_ref,'')),''),
    homologated_by = auth.uid(), homologated_person_id = me, homologated_engagement_id = eng, homologated_at = now()
  WHERE id = _id AND version = _version;
END $$;
