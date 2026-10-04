-- B4.6.5c — Vínculo explícito dimensão↔primitiva de efeito na norma de composição + evidência privada (aditiva; 0023–0030 intactas).
-- Nenhum writer, capacidade, norma, seed ou leitor público. Vínculo só por (primitiva, versão do contrato), nunca por rótulo.

CREATE TABLE public.calendar_composition_norm_effect_bindings (
  version_id uuid NOT NULL REFERENCES public.calendar_composition_norm_versions(id),
  dimension_id text NOT NULL CHECK (dimension_id ~ '^[a-z0-9][a-z0-9-]*$'),
  effect_primitive text NOT NULL CHECK (effect_primitive IN ('school_day_effect')),
  effect_contract_version integer NOT NULL CHECK (effect_contract_version = 1),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (version_id, dimension_id),
  UNIQUE (version_id, effect_primitive)
);
GRANT ALL ON public.calendar_composition_norm_effect_bindings TO service_role;
REVOKE ALL ON public.calendar_composition_norm_effect_bindings FROM PUBLIC, anon, authenticated;
ALTER TABLE public.calendar_composition_norm_effect_bindings ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER ccn_effect_binding_guard BEFORE INSERT ON public.calendar_composition_norm_effect_bindings
  FOR EACH ROW EXECUTE FUNCTION public.guard_composition_norm_child();
CREATE TRIGGER ccn_effect_binding_immutable BEFORE UPDATE OR DELETE ON public.calendar_composition_norm_effect_bindings
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

-- Evidência privada num ÚNICO (on, knownAt): contexto canônico derivado do banco a partir da alocação (escola, turma,
-- posição curricular); norma (estado ou evidência completa); candidatos agrupados por calendário+versão+resolução com
-- recortes/janelas; linhas de calendar_day_declarations por candidato. Valor de eixo NÃO é derivado (lista vazia ⇒
-- recorte por eixo nunca corresponde). Não decide nada: o motor puro compõe; o servidor será a fonte final.
CREATE FUNCTION public.calendar_composition_evidence_at(_on date, _known_at timestamptz, _allocation text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE _n integer; _a public.class_enrollment_episodes%ROWTYPE; _yr text; _st text; _pos text; _np integer;
  _final text; _nv public.calendar_composition_norm_versions%ROWTYPE; _norm jsonb; _h public.calendar_composition_norm_homologations%ROWTYPE;
  _cands jsonb := '[]'::jsonb; g record; _ctx jsonb;
BEGIN
  IF _on IS NULL OR _known_at IS NULL OR coalesce(pg_catalog.btrim(_allocation), '') = '' THEN
    RAISE EXCEPTION 'calendar-composition-evidence:snapshot-and-allocation-required'; END IF;
  SELECT count(*) INTO _n FROM public.class_enrollment_episodes a
   WHERE a.logical_id = _allocation AND a.created_at <= _known_at
     AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id AND s.created_at <= _known_at);
  IF _n <> 1 THEN
    RETURN pg_catalog.jsonb_build_object('contract', 'b4.6.5c/1', 'snapshot', pg_catalog.jsonb_build_object('on', _on, 'knownAt', _known_at),
      'context', pg_catalog.jsonb_build_object('state', CASE WHEN _n = 0 THEN 'alocacao-desconhecida-no-instante' ELSE 'ambigua:alocacao' END, 'allocation', _allocation));
  END IF;
  SELECT a.* INTO _a FROM public.class_enrollment_episodes a
   WHERE a.logical_id = _allocation AND a.created_at <= _known_at
     AND NOT EXISTS (SELECT 1 FROM public.class_enrollment_episodes s WHERE s.supersedes_id = a.id AND s.created_at <= _known_at);
  SELECT k.academic_year_id INTO _yr FROM public.institutional_classes k WHERE k.id = _a.class_id;
  _st := public.calendar_allocation_state_at(_allocation, _yr, _a.school_id, _on, _known_at);
  IF _st IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('contract', 'b4.6.5c/1', 'snapshot', pg_catalog.jsonb_build_object('on', _on, 'knownAt', _known_at),
      'context', pg_catalog.jsonb_build_object('state', _st, 'allocation', _allocation));
  END IF;
  SELECT count(*), max(x.position_logical_id) INTO _np, _pos
    FROM public.allocation_curricular_positions_at(_a.school_id, _a.class_id, _on, _known_at) x WHERE x.allocation_logical_id = _allocation;
  IF _np > 1 THEN
    RETURN pg_catalog.jsonb_build_object('contract', 'b4.6.5c/1', 'snapshot', pg_catalog.jsonb_build_object('on', _on, 'knownAt', _known_at),
      'context', pg_catalog.jsonb_build_object('state', 'ambigua:posicao-curricular', 'allocation', _allocation));
  END IF;
  _ctx := pg_catalog.jsonb_build_object('state', 'derivado', 'allocation', _allocation, 'school', _a.school_id, 'class', _a.class_id,
    'academicYear', _yr, 'position', _pos, 'axis', 'nao-derivado');

  -- Norma: só a linha final decide se há evidência; nunca escolhe dominante.
  SELECT x.state INTO _final FROM public.calendar_composition_norm_state_at(_on, _known_at) x WHERE x.norm_id IS NULL;
  IF _final = 'norma-homologada' THEN
    SELECT v.* INTO _nv FROM public.calendar_composition_norm_versions v
      JOIN public.calendar_composition_norm_state_at(_on, _known_at) x ON x.version_id = v.id WHERE x.state = 'homologada';
    SELECT h.* INTO _h FROM public.calendar_composition_norm_homologations h
     WHERE h.version_id = _nv.id AND h.created_at <= _known_at AND h.effective_from <= _on
       AND NOT EXISTS (SELECT 1 FROM public.calendar_composition_norm_homologations s
                       WHERE s.supersedes_id = h.id AND s.created_at <= _known_at AND s.effective_from <= _on);
    _norm := pg_catalog.jsonb_build_object('state', _final, 'normId', _nv.norm_id, 'versionId', _nv.id, 'version', _nv.version,
      'validFrom', _nv.valid_from, 'validTo', _nv.valid_until, 'recordedAt', _nv.created_at, 'actId', _nv.originating_act_ref,
      'configuration', pg_catalog.jsonb_build_object('recorded', true,
        'multiplicity', (SELECT m.operation FROM public.calendar_composition_norm_multiplicity m WHERE m.version_id = _nv.id),
        'dimensionRules', coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('dimensionId', d.dimension_id, 'operation', d.operation, 'onAbsence', d.on_absence) ORDER BY d.dimension_id)
          FROM public.calendar_composition_norm_dimension_rules d WHERE d.version_id = _nv.id), '[]'::jsonb)),
      'homologation', pg_catalog.jsonb_build_object('state', _h.decision, 'recordId', _h.id, 'sequence', _h.sequence,
        'effectiveFrom', _h.effective_from, 'recordedAt', _h.created_at, 'exercisedCapabilityId', _h.exercised_capability_id),
      'effectBindings', coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('dimensionId', b.dimension_id, 'effectPrimitive', b.effect_primitive,
          'effectContractVersion', b.effect_contract_version) ORDER BY b.dimension_id)
        FROM public.calendar_composition_norm_effect_bindings b WHERE b.version_id = _nv.id AND b.created_at <= _known_at), '[]'::jsonb));
  ELSE
    _norm := pg_catalog.jsonb_build_object('state', _final);
  END IF;

  FOR g IN
    SELECT c.resolution, c.calendar_id, c.version_id, cv.version,
           pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('scopeKey', c.scope_key, 'windowFrom', w.window_from, 'windowTo', w.window_until) ORDER BY c.scope_key) AS scopes
      FROM public.calendar_applicability_candidates(_on, _known_at, _a.school_id, _allocation, _pos, '[]'::jsonb) c
      JOIN public.calendar_versions cv ON cv.id = c.version_id
      LEFT JOIN public.calendar_version_applicability_scopes s ON s.version_id = c.version_id AND s.scope_key = c.scope_key
      LEFT JOIN public.calendar_version_applicability_scope_windows w ON w.scope_id = s.id
     WHERE c.calendar_id IS NOT NULL
     GROUP BY c.resolution, c.calendar_id, c.version_id, cv.version
     ORDER BY c.calendar_id, c.resolution
  LOOP
    _cands := _cands || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('resolution', g.resolution, 'calendarId', g.calendar_id,
      'versionId', g.version_id, 'version', g.version,
      'scopes', CASE WHEN g.scopes @> '[{"scopeKey": null}]'::jsonb THEN '[]'::jsonb ELSE g.scopes END,
      'dayRows', CASE WHEN g.resolution = 'candidato' THEN coalesce((SELECT pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r))
        FROM public.calendar_day_declarations(g.calendar_id, _on, _known_at) r), '[]'::jsonb) ELSE '[]'::jsonb END));
  END LOOP;

  RETURN pg_catalog.jsonb_build_object('contract', 'b4.6.5c/1', 'snapshot', pg_catalog.jsonb_build_object('on', _on, 'knownAt', _known_at),
    'context', _ctx, 'norm', _norm, 'candidates', _cands);
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_composition_evidence_at(date, timestamptz, text) FROM PUBLIC, anon, authenticated;
