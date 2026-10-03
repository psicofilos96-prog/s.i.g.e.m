-- B4.2.4 — Resolução integrada E1–E4, somente leitura (passos 3.0–3.2 do contrato B4.2.0).
-- Nenhum writer, nenhum dado. Readers SECURITY INVOKER, search_path vazio.
-- Nenhum literal de esquema/valor institucional: só os três efeitos técnicos já fechados no E2.

-- 3.0 Contexto comum da turma ------------------------------------------------
CREATE FUNCTION public.class_curricular_resolution_context_at(_class_id text, _on date, _known_at timestamptz)
RETURNS TABLE(class_id text, context_state text, gate_effect text,
  profile_id text, profile_version_id uuid, profile_homologation_id uuid, position_key_schemes text[],
  nature_scheme_id text, offering_version_id uuid, nature_value_id text, nature_value_version integer,
  conflicting_association_id text)
LANGUAGE plpgsql STABLE SET search_path = ''
AS $fn$
DECLARE _n integer; _gates jsonb; _nat text; _val text; _ver integer; _eff text; _conf text;
BEGIN
  IF _class_id IS NULL THEN RAISE EXCEPTION 'resolution:class-required'; END IF;
  IF _on IS NULL THEN RAISE EXCEPTION 'resolution:valid-on-required'; END IF;
  IF _known_at IS NULL THEN RAISE EXCEPTION 'resolution:known-at-required'; END IF;
  class_id := _class_id;

  -- perfil E2 homologado (contagem explícita: ambiguidade vira estado, nunca ausência;
  -- falhas de cadeia/temporais do reader de origem são propagadas)
  SELECT count(*) INTO _n FROM public.curricular_correspondence_profiles_at(_on, _known_at) x WHERE x.homologation_state = 'homologada';
  IF _n > 1 THEN context_state := 'inconsistente:perfil-ambiguo'; RETURN NEXT; RETURN; END IF;
  IF _n = 0 THEN context_state := 'bloqueada:perfil-ausente'; RETURN NEXT; RETURN; END IF;
  SELECT x.profile_id, x.version_id, x.homologation_id, x.position_key_schemes, x.nature_scheme_id, x.nature_gates
    INTO profile_id, profile_version_id, profile_homologation_id, position_key_schemes, _nat, _gates
  FROM public.curricular_correspondence_profiles_at(_on, _known_at) x WHERE x.homologation_state = 'homologada';
  nature_scheme_id := _nat;
  IF _nat IS NULL THEN context_state := 'bloqueada:natureza-nao-designada'; RETURN NEXT; RETURN; END IF;

  -- natureza na Oferta B2.6 (mesmo validOn/knownAt; ambiguidade temporal da oferta é propagada)
  SELECT count(*) INTO _n FROM public.class_offering_at(_class_id, _on, _known_at) o WHERE o.scheme_id = _nat;
  IF _n = 0 THEN context_state := 'ausente:natureza-nao-registrada'; RETURN NEXT; RETURN; END IF;
  IF _n > 1 THEN context_state := 'inconsistente:natureza-ambigua'; RETURN NEXT; RETURN; END IF;
  SELECT o.offering_version_id, o.value_id, o.value_version INTO offering_version_id, _val, _ver
  FROM public.class_offering_at(_class_id, _on, _known_at) o WHERE o.scheme_id = _nat;
  nature_value_id := _val; nature_value_version := _ver;

  -- catálogo: linha imutável; status fixado na criação; created_at <= knownAt; sem fim de vigência
  IF NOT EXISTS (SELECT 1 FROM public.attribute_value_definitions d
    WHERE d.scheme_id = _nat AND d.value_id = _val AND d.version = _ver AND d.status = 'homologada'
      AND (d.valid_from IS NULL OR d.valid_from <= _on) AND d.created_at <= _known_at) THEN
    context_state := 'bloqueada:natureza-nao-homologada'; RETURN NEXT; RETURN;
  END IF;

  -- portão E2 exato (valor + versão do valor)
  SELECT count(*), min(g->>'effect') INTO _n, _eff FROM jsonb_array_elements(_gates) g
  WHERE g->>'value' = _val AND (g->>'version')::integer = _ver;
  IF _n = 0 THEN context_state := 'bloqueada:natureza-sem-portao'; RETURN NEXT; RETURN; END IF;
  IF _n > 1 THEN context_state := 'inconsistente:portao-ambiguo'; RETURN NEXT; RETURN; END IF;
  gate_effect := _eff;

  -- E4 homologada em turma de matching regular: inconsistência, E4 nunca é usada
  IF _eff = 'matching-regular' THEN
    SELECT min(a.association_id) INTO _conf FROM public.class_specific_matrix_associations_at(_on, _known_at) a
    WHERE a.class_id = _class_id AND a.homologation_state = 'homologada';
    IF _conf IS NOT NULL THEN
      conflicting_association_id := _conf;
      context_state := 'inconsistente:associacao-explicita-em-turma-regular'; RETURN NEXT; RETURN;
    END IF;
  END IF;
  context_state := 'portao-resolvido'; RETURN NEXT;
END $fn$;

-- 3.2 Ramo específico por turma ---------------------------------------------
CREATE FUNCTION public.class_specific_curricular_matrix_at(_class_id text, _on date, _known_at timestamptz)
RETURNS TABLE(class_id text, resolution_state text, context_state text, gate_effect text,
  profile_id text, profile_version_id uuid, profile_homologation_id uuid,
  offering_version_id uuid, nature_scheme_id text, nature_value_id text, nature_value_version integer,
  association_id text, association_version_id uuid, association_homologation_id uuid,
  matrix_id text, matrix_version_id uuid, matrix_homologation_id uuid, column_key text)
LANGUAGE plpgsql STABLE SET search_path = ''
AS $fn$
DECLARE _c record; _r record; _n integer;
BEGIN
  SELECT * INTO _c FROM public.class_curricular_resolution_context_at(_class_id, _on, _known_at);
  class_id := _class_id; context_state := _c.context_state; gate_effect := _c.gate_effect;
  profile_id := _c.profile_id; profile_version_id := _c.profile_version_id; profile_homologation_id := _c.profile_homologation_id;
  offering_version_id := _c.offering_version_id; nature_scheme_id := _c.nature_scheme_id;
  nature_value_id := _c.nature_value_id; nature_value_version := _c.nature_value_version;
  IF _c.context_state <> 'portao-resolvido' THEN resolution_state := _c.context_state; RETURN NEXT; RETURN; END IF;
  IF _c.gate_effect = 'fora-de-correspondencia' THEN resolution_state := 'nao-aplicavel:natureza'; RETURN NEXT; RETURN; END IF;
  IF _c.gate_effect <> 'associacao-explicita' THEN resolution_state := 'nao-aplicavel:ramo-regular'; RETURN NEXT; RETURN; END IF;

  SELECT count(*) INTO _n FROM public.class_specific_matrix_associations_at(_on, _known_at) a
  WHERE a.class_id = _class_id AND a.homologation_state = 'homologada';
  IF _n = 0 THEN resolution_state := 'nao-registrada:associacao-especifica'; RETURN NEXT; RETURN; END IF;
  IF _n > 1 THEN resolution_state := 'inconsistente:associacao-ambigua'; RETURN NEXT; RETURN; END IF;
  SELECT * INTO _r FROM public.resolve_class_specific_matrix_association_at(_class_id, _on, _known_at);
  association_id := _r.association_id; association_version_id := _r.version_id; association_homologation_id := _r.homologation_id;
  matrix_id := _r.target_matrix_id; matrix_version_id := _r.matrix_version_id;
  matrix_homologation_id := _r.matrix_homologation_id; column_key := _r.target_column_key;
  resolution_state := _r.association_state;
  IF resolution_state = 'vinculo-especifico-vigente'
     AND EXISTS (SELECT 1 FROM public.curricular_matrix_applicability_at(_r.target_matrix_id, _on, _known_at)) THEN
    resolution_state := 'bloqueada:aplicabilidade-nao-homologada';
  END IF;
  RETURN NEXT;
END $fn$;

-- 3.1 Ramo regular por estudante/alocação ----------------------------------
CREATE FUNCTION public.student_curricular_matrix_at(_school text, _class_id text, _on date, _known_at timestamptz)
RETURNS TABLE(allocation_id text, allocation_logical_id text, student_id text, class_id text,
  resolution_state text, context_state text, gate_effect text, position_version_id uuid,
  profile_id text, profile_version_id uuid, profile_homologation_id uuid,
  offering_version_id uuid, nature_scheme_id text, nature_value_id text, nature_value_version integer,
  correspondence_id text, correspondence_version_id uuid, correspondence_homologation_id uuid,
  matrix_id text, matrix_version_id uuid, matrix_homologation_id uuid, column_key text,
  association_id text, association_version_id uuid, association_state text)
LANGUAGE plpgsql STABLE SET search_path = ''
AS $fn$
DECLARE _c record; _sp record; _a record; _r record; _col record; _key jsonb; _n integer;
BEGIN
  IF _class_id IS NULL THEN RAISE EXCEPTION 'resolution:class-required'; END IF;
  SELECT * INTO _c FROM public.class_curricular_resolution_context_at(_class_id, _on, _known_at);
  IF _c.context_state = 'portao-resolvido' AND _c.gate_effect = 'associacao-explicita' THEN
    SELECT * INTO _sp FROM public.class_specific_curricular_matrix_at(_class_id, _on, _known_at);
  END IF;

  FOR _a IN SELECT * FROM public.allocation_curricular_positions_at(_school, _class_id, _on, _known_at) LOOP
    allocation_id := _a.allocation_id; allocation_logical_id := _a.allocation_logical_id; student_id := _a.student_id;
    class_id := _a.class_id; position_version_id := _a.position_version_id;
    context_state := _c.context_state; gate_effect := _c.gate_effect;
    profile_id := _c.profile_id; profile_version_id := _c.profile_version_id; profile_homologation_id := _c.profile_homologation_id;
    offering_version_id := _c.offering_version_id; nature_scheme_id := _c.nature_scheme_id;
    nature_value_id := _c.nature_value_id; nature_value_version := _c.nature_value_version;
    correspondence_id := NULL; correspondence_version_id := NULL; correspondence_homologation_id := NULL;
    matrix_id := NULL; matrix_version_id := NULL; matrix_homologation_id := NULL; column_key := NULL;
    association_id := NULL; association_version_id := NULL; association_state := NULL;

    IF _c.context_state <> 'portao-resolvido' THEN resolution_state := _c.context_state; RETURN NEXT; CONTINUE; END IF;
    IF _c.gate_effect = 'fora-de-correspondencia' THEN resolution_state := 'nao-aplicavel:natureza'; RETURN NEXT; CONTINUE; END IF;
    IF _c.gate_effect = 'associacao-explicita' THEN
      resolution_state := 'nao-aplicavel:ramo-especifico';
      association_id := _sp.association_id; association_version_id := _sp.association_version_id; association_state := _sp.resolution_state;
      RETURN NEXT; CONTINUE;
    END IF;

    -- matching-regular
    IF _a.position_version_id IS NULL THEN resolution_state := 'ausente:posicao'; RETURN NEXT; CONTINUE; END IF;
    IF coalesce(cardinality(_c.position_key_schemes), 0) = 0 THEN resolution_state := 'bloqueada:chave-nao-designada'; RETURN NEXT; CONTINUE; END IF;
    SELECT count(*), jsonb_agg(jsonb_build_object('scheme', e->>'scheme', 'value', e->>'value', 'version', (e->>'version')::integer) ORDER BY e->>'scheme')
      INTO _n, _key
    FROM jsonb_array_elements(_a.axes) e WHERE e->>'scheme' = ANY (_c.position_key_schemes);
    IF _n <> cardinality(_c.position_key_schemes) THEN resolution_state := 'ausente:posicao-incompleta'; RETURN NEXT; CONTINUE; END IF;

    SELECT count(*) INTO _n FROM public.curricular_position_matrix_correspondences_at(_on, _known_at) x
    WHERE x.profile_id = _c.profile_id AND x.homologation_state = 'homologada' AND x.position_key = _key;
    IF _n = 0 THEN resolution_state := 'ausente:correspondencia'; RETURN NEXT; CONTINUE; END IF;
    IF _n > 1 THEN resolution_state := 'inconsistente:correspondencia-ambigua'; RETURN NEXT; CONTINUE; END IF;
    SELECT * INTO _r FROM public.resolve_position_matrix_correspondence_at(_c.profile_id, _key, _on, _known_at);
    correspondence_id := _r.correspondence_id; correspondence_version_id := _r.version_id; correspondence_homologation_id := _r.homologation_id;
    matrix_id := _r.target_matrix_id; matrix_version_id := _r.matrix_version_id; column_key := _r.target_column_key;
    IF _r.matrix_version_id IS NULL THEN resolution_state := 'ausente:matriz-vigente'; RETURN NEXT; CONTINUE; END IF;
    SELECT h.homologation_id INTO matrix_homologation_id FROM public.curricular_matrix_homologation_state_at(_on, _known_at) h
    WHERE h.version_id = _r.matrix_version_id AND h.homologation_state = 'homologada';
    IF matrix_homologation_id IS NULL THEN resolution_state := 'bloqueada:matriz-nao-homologada'; RETURN NEXT; CONTINUE; END IF;
    IF _r.column_state <> 'coluna-presente' THEN resolution_state := 'bloqueada:coluna-inexistente'; RETURN NEXT; CONTINUE; END IF;
    SELECT lc.ref_scheme_id, lc.ref_value_id, lc.ref_value_version INTO _col FROM public.curricular_matrix_layout_columns lc
    WHERE lc.matrix_version_id = _r.matrix_version_id AND lc.column_key = _r.target_column_key;
    IF _col.ref_value_id IS NULL THEN resolution_state := 'bloqueada:coluna-nao-referenciada'; RETURN NEXT; CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_key) k WHERE k->>'scheme' = _col.ref_scheme_id
                   AND k->>'value' = _col.ref_value_id AND (k->>'version')::integer = _col.ref_value_version) THEN
      resolution_state := 'inconsistente:coluna-ref-divergente'; RETURN NEXT; CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.curricular_matrix_applicability_at(_r.target_matrix_id, _on, _known_at)) THEN
      resolution_state := 'bloqueada:aplicabilidade-nao-homologada'; RETURN NEXT; CONTINUE;
    END IF;
    resolution_state := 'resolvida-por-posicao'; RETURN NEXT;
  END LOOP;
END $fn$;

REVOKE ALL ON FUNCTION public.class_curricular_resolution_context_at(text, date, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.class_specific_curricular_matrix_at(text, date, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.student_curricular_matrix_at(text, text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.class_curricular_resolution_context_at(text, date, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.class_specific_curricular_matrix_at(text, date, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_curricular_matrix_at(text, text, date, timestamptz) TO authenticated;
