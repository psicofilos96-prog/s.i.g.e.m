-- 0195: autogestão de atuação recusada (defeito detectado na Frente BO: record_engagement aceitava a própria pessoa).
CREATE OR REPLACE FUNCTION public.record_engagement(_person uuid, _kind text, _scope_level text, _school text, _class_ids text[], _component text, _period text, _valid_from date, _valid_until date, _act_ref text, _position_label text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _id uuid; _c text;
BEGIN
  IF NOT public.has_network_capability('manter-atuacoes-institucionais') THEN RAISE EXCEPTION 'capability:manter-atuacoes-institucionais'; END IF;
  IF _person IS NOT DISTINCT FROM public.current_person_id() THEN RAISE EXCEPTION 'engagement:self-grant'; END IF;
  IF NOT EXISTS (SELECT 1 FROM institutional_persons WHERE id = _person) THEN RAISE EXCEPTION 'engagement:person-missing'; END IF;
  IF coalesce(btrim(_kind),'') = '' THEN RAISE EXCEPTION 'engagement:kind-required'; END IF;
  IF _scope_level NOT IN ('rede','escola','turmas','turma') THEN RAISE EXCEPTION 'engagement:scope-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'engagement:valid-from-required'; END IF;
  IF _valid_until IS NOT NULL AND _valid_until < _valid_from THEN RAISE EXCEPTION 'engagement:invalid-validity'; END IF;
  _act_ref := NULLIF(pg_catalog.btrim(_act_ref), '');
  IF _scope_level = 'turmas' AND coalesce(array_length(_class_ids,1),0) = 0 THEN RAISE EXCEPTION 'engagement:classes-required'; END IF;
  INSERT INTO institutional_engagements(person_id, engagement_kind_id, position_label_snapshot, scope_level, school_id, class_id, component_id, period_id, valid_from, valid_until, originating_act_ref)
  VALUES (_person, btrim(_kind), nullif(btrim(_position_label),''), _scope_level,
    CASE WHEN _scope_level = 'rede' THEN NULL ELSE nullif(_school,'') END,
    CASE WHEN _scope_level = 'turma' THEN _class_ids[1] END,
    nullif(_component,''), nullif(_period,''), _valid_from, _valid_until, _act_ref) RETURNING id INTO _id;
  IF _scope_level = 'turmas' THEN
    FOREACH _c IN ARRAY _class_ids LOOP
      INSERT INTO institutional_engagement_scope_classes(engagement_id, class_id, originating_act_ref) VALUES (_id, _c, _act_ref);
    END LOOP;
  END IF;
  RETURN _id;
END $function$;