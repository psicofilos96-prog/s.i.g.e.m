-- B4.6.7c — Eixos de aplicabilidade vêm da posição B3.3 do ESTUDANTE (alocação, data, knownAt) e da oferta da turma,
-- marcados por origem; colisão de esquema entre as duas origens com valores distintos ⇒ contexto ambíguo explícito (sem dominante).
-- Aditiva: 0033/0034 preservadas; só substitui a função privada.
CREATE OR REPLACE FUNCTION public.calendar_composed_day_private(_on date, _known_at timestamptz, _allocation text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $fn$
DECLARE ev jsonb; _ctx jsonb; _norm jsonb; _axis jsonb; _cands jsonb := '[]'::jsonb; c record;
  _block text; _n integer; _cal text; _ver uuid; _rows jsonb; _ds text; _hs text; _t integer; _f integer;
  _res text; _eff boolean; _vh text; _u integer; _paxis jsonb; _oaxis jsonb; _collide text;
BEGIN
  ev := public.calendar_composition_evidence_at(_on, _known_at, _allocation);
  _ctx := ev->'context';
  IF _ctx->>'state' IS DISTINCT FROM 'derivado' THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'contexto-indisponivel', 'detail', _ctx->>'state', 'context', _ctx); END IF;
  -- Eixos do ESTUDANTE (B3.3, posição da alocação na data/knownAt) e da OFERTA da turma, separados por origem.
  BEGIN
    SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('scheme', a->>'scheme', 'value', a->>'value',
             'version', (a->>'version')::integer, 'source', 'posicao') ORDER BY a->>'scheme', a->>'value'), '[]'::jsonb) INTO _paxis
      FROM public.allocation_curricular_positions_at(_ctx->>'school', _ctx->>'class', _on, _known_at) p,
           LATERAL pg_catalog.jsonb_array_elements(coalesce(p.axes, '[]'::jsonb)) a
     WHERE p.allocation_logical_id = _allocation;
  EXCEPTION WHEN OTHERS THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'contexto-indisponivel', 'detail', 'ambigua:posicao-curricular', 'context', _ctx);
  END;
  BEGIN
    SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('scheme', o.scheme_id, 'value', o.value_id, 'version', o.value_version,
             'source', 'oferta') ORDER BY o.scheme_id, o.value_id), '[]'::jsonb) INTO _oaxis
      FROM public.class_offering_at(_ctx->>'class', _on, _known_at) o WHERE o.scheme_id IS NOT NULL;
  EXCEPTION WHEN OTHERS THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'contexto-indisponivel', 'detail', 'ambigua:oferta', 'context', _ctx);
  END;
  -- Colisão: mesmo esquema declarado na posição do estudante e na oferta com valores diferentes ⇒ ambíguo, sem dominante.
  SELECT pg_catalog.min(s.scheme) INTO _collide FROM (
    SELECT e->>'scheme' AS scheme FROM pg_catalog.jsonb_array_elements(_paxis) e
    INTERSECT SELECT e->>'scheme' FROM pg_catalog.jsonb_array_elements(_oaxis) e) s
   WHERE (SELECT pg_catalog.array_agg((e->>'value') || '@' || (e->>'version') ORDER BY (e->>'value') || '@' || (e->>'version')) FROM pg_catalog.jsonb_array_elements(_paxis) e WHERE e->>'scheme' = s.scheme)
         IS DISTINCT FROM
         (SELECT pg_catalog.array_agg((e->>'value') || '@' || (e->>'version') ORDER BY (e->>'value') || '@' || (e->>'version')) FROM pg_catalog.jsonb_array_elements(_oaxis) e WHERE e->>'scheme' = s.scheme);
  IF _collide IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'contexto-indisponivel', 'detail', 'ambigua:eixo-posicao-oferta:' || _collide,
      'context', _ctx || pg_catalog.jsonb_build_object('positionAxis', _paxis, 'offeringAxis', _oaxis));
  END IF;
  _axis := _paxis || _oaxis;
  _ctx := _ctx || pg_catalog.jsonb_build_object('axis', _axis, 'positionAxis', _paxis, 'offeringAxis', _oaxis);
  _norm := ev->'norm';
  IF _norm->>'state' IS DISTINCT FROM 'norma-homologada' THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'norma-indisponivel', 'detail', _norm->>'state', 'context', _ctx); END IF;
  IF _norm#>>'{configuration,multiplicity}' IS DISTINCT FROM 'exigir-exclusividade' THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'composicao-indeterminada', 'detail', 'multiplicidade-nao-suportada-pelo-servidor:' ||
      coalesce(_norm#>>'{configuration,multiplicity}', 'ausente'), 'context', _ctx, 'norm', _norm); END IF;
  IF NOT (_norm->'effectBindings') @> '[{"effectPrimitive":"school_day_effect","effectContractVersion":1}]'::jsonb THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'efeito-nao-vinculado', 'context', _ctx, 'norm', _norm); END IF;

  _n := 0;
  FOR c IN SELECT x.resolution, x.calendar_id, x.version_id, pg_catalog.array_agg(x.scope_key ORDER BY x.scope_key) AS scopes
             FROM public.calendar_applicability_candidates(_on, _known_at, _ctx->>'school', _allocation, _ctx->>'position', _axis) x
            WHERE x.calendar_id IS NOT NULL GROUP BY x.resolution, x.calendar_id, x.version_id ORDER BY x.calendar_id, x.resolution LOOP
    BEGIN
      _vh := public.calendar_version_homologation_state(c.version_id, _on, _known_at);
    EXCEPTION WHEN OTHERS THEN _vh := 'cadeia-invalida'; END;
    IF _vh = 'cadeia-invalida' THEN _block := coalesce(_block, 'homologacao:cadeia-invalida'); CONTINUE; END IF;
    CONTINUE WHEN _vh IS DISTINCT FROM 'homologada';
    _cands := _cands || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('resolution', c.resolution, 'calendarId', c.calendar_id,
      'versionId', c.version_id, 'scopes', pg_catalog.to_jsonb(c.scopes)));
    IF c.resolution = 'candidato' THEN _n := _n + 1; _cal := c.calendar_id; _ver := c.version_id;
    ELSE _block := coalesce(_block, c.resolution); END IF;
  END LOOP;
  IF _block IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'composicao-indeterminada', 'detail', _block, 'context', _ctx, 'norm', _norm, 'candidates', _cands); END IF;
  IF _n = 0 THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'sem-calendario-aplicavel', 'context', _ctx, 'norm', _norm, 'candidates', _cands); END IF;
  IF _n > 1 THEN
    RETURN pg_catalog.jsonb_build_object('on', _on, 'result', 'exclusividade-violada', 'context', _ctx, 'norm', _norm, 'candidates', _cands); END IF;

  SELECT coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(r)), '[]'::jsonb), max(r.day_state), max(r.homologation_state),
         count(*) FILTER (WHERE r.school_day_effect IS TRUE), count(*) FILTER (WHERE r.school_day_effect IS FALSE),
         count(*) FILTER (WHERE r.declaration_id IS NOT NULL AND r.school_day_effect IS NULL)
    INTO _rows, _ds, _hs, _t, _f, _u FROM public.calendar_day_declarations(_cal, _on, _known_at) r;
  IF _hs IS DISTINCT FROM 'homologada' THEN _res := 'calendario-nao-homologado';
  ELSIF _ds IN ('sem-versao-vigente','referencia-b2-4-invalida') THEN _res := 'composicao-indeterminada';
  ELSIF _t > 0 AND _f > 0 THEN _res := 'conflito';
  ELSIF _u > 0 THEN _res := 'efeito-nao-declarado';
  ELSIF _t > 0 THEN _res := 'letivo'; _eff := true;
  ELSIF _f > 0 THEN _res := 'nao-letivo'; _eff := false;
  ELSE _res := 'efeito-nao-declarado'; END IF;
  RETURN pg_catalog.jsonb_build_object('on', _on, 'result', _res, 'schoolDayEffect', _eff, 'detail', _ds, 'context', _ctx, 'norm', _norm,
    'candidates', _cands, 'calendarId', _cal, 'versionId', _ver, 'homologationState', _hs, 'declarations', _rows);
END $fn$;
REVOKE ALL ON FUNCTION public.calendar_composed_day_private(date, timestamptz, text) FROM PUBLIC, anon, authenticated;