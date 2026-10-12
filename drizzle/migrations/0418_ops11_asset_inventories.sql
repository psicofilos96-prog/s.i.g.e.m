-- Centro de Operações L11: inventário patrimonial. Escopo (escola + ambientes opcionais) e data de referência; fotografia
-- dos bens ESPERADOS congelada na abertura a partir da cadeia de localização; equipe = atuações vigentes; conferência só
-- por membro da equipe; divergência = projeção (esperado × conferido); providência registrada; encerramento por pessoa
-- fora da equipe exige todo esperado conferido e toda divergência com providência. Inventário nunca altera o bem.
CREATE TABLE public.ops_asset_inventories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  space_ids uuid[] NOT NULL DEFAULT '{}',
  reference_date date NOT NULL,
  purpose text NOT NULL CHECK (length(btrim(purpose)) >= 10),
  opened_by uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_asset_inventory_expected (
  inventory_id uuid NOT NULL REFERENCES public.ops_asset_inventories(id),
  asset_id uuid NOT NULL REFERENCES public.ops_assets(id),
  expected_space uuid,
  asset_seq_at_snapshot int NOT NULL,
  PRIMARY KEY (inventory_id, asset_id)
);
CREATE TABLE public.ops_asset_inventory_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_id uuid NOT NULL REFERENCES public.ops_asset_inventories(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('equipe-inclusao','inicio','conferencia','providencia','encerramento','cancelamento')),
  engagement_id uuid REFERENCES public.institutional_engagements(id),
  asset_id uuid REFERENCES public.ops_assets(id),
  found_description text,
  result text CHECK (result IN ('localizado','outro-ambiente','nao-localizado','nao-esperado')),
  found_space uuid REFERENCES public.ops_spaces(id),
  observed_condition text,
  action_kind text CHECK (action_kind IN ('regularizar-localizacao','solicitar-transferencia','apurar-desaparecimento','incorporar','propor-baixa','sem-providencia-justificada')),
  evidence_ref uuid REFERENCES public.admin_case_events(id),
  note text,
  actor_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inventory_id, seq),
  CHECK (kind <> 'equipe-inclusao' OR engagement_id IS NOT NULL),
  CHECK (kind <> 'conferencia' OR (result IS NOT NULL AND ((result = 'nao-esperado') = (asset_id IS NULL)) AND (asset_id IS NOT NULL OR length(btrim(coalesce(found_description,''))) >= 3))),
  CHECK (kind <> 'providencia' OR (action_kind IS NOT NULL AND length(btrim(coalesce(note,''))) >= 10)),
  CHECK (kind NOT IN ('encerramento','cancelamento') OR length(btrim(coalesce(note,''))) >= 10)
);
CREATE UNIQUE INDEX ops_inv_one_count_per_asset ON public.ops_asset_inventory_events (inventory_id, asset_id) WHERE kind = 'conferencia' AND asset_id IS NOT NULL;
CREATE UNIQUE INDEX ops_inv_terminal ON public.ops_asset_inventory_events (inventory_id) WHERE kind IN ('encerramento','cancelamento');

GRANT SELECT ON public.ops_asset_inventories, public.ops_asset_inventory_expected TO authenticated;
GRANT SELECT (id, inventory_id, seq, kind, engagement_id, asset_id, found_description, result, found_space, observed_condition, action_kind, note, actor_person, idempotency_key, created_at) ON public.ops_asset_inventory_events TO authenticated;
GRANT ALL ON public.ops_asset_inventories, public.ops_asset_inventory_expected, public.ops_asset_inventory_events TO service_role;
ALTER TABLE public.ops_asset_inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_asset_inventory_expected ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_asset_inventory_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventories by school" ON public.ops_asset_inventories FOR SELECT TO authenticated USING (public.ops_can_read('patrimonio', school_id));
CREATE POLICY "inventory expected by school" ON public.ops_asset_inventory_expected FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_asset_inventories i WHERE i.id = inventory_id AND public.ops_can_read('patrimonio', i.school_id)));
CREATE POLICY "inventory events by school" ON public.ops_asset_inventory_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_asset_inventories i WHERE i.id = inventory_id AND public.ops_can_read('patrimonio', i.school_id)));
CREATE TRIGGER opsinv_immutable BEFORE UPDATE OR DELETE ON public.ops_asset_inventories FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsinvx_immutable BEFORE UPDATE OR DELETE ON public.ops_asset_inventory_expected FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsinve_immutable BEFORE UPDATE OR DELETE ON public.ops_asset_inventory_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.open_ops_asset_inventory(_school text, _spaces uuid[], _ref date, _purpose text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsinv:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_asset_inventories WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_school_capability('abrir-inventarios-patrimoniais', _school) THEN RAISE EXCEPTION 'opsinv:forbidden'; END IF;
  IF _ref > current_date THEN RAISE EXCEPTION 'opsinv:future-reference'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(_spaces,'{}')) s WHERE NOT EXISTS (SELECT 1 FROM public.ops_spaces x WHERE x.id = s AND x.school_id = _school)) THEN RAISE EXCEPTION 'opsinv:invalid-space'; END IF;
  INSERT INTO public.ops_asset_inventories(school_id, space_ids, reference_date, purpose, opened_by, idempotency_key)
  VALUES (_school, coalesce(_spaces,'{}'), _ref, btrim(_purpose), _p, _key) RETURNING id INTO _id;
  -- Fotografia: última localização com data ≤ referência, na escola/escopo, sem baixa até a referência.
  INSERT INTO public.ops_asset_inventory_expected(inventory_id, asset_id, expected_space, asset_seq_at_snapshot)
  SELECT _id, l.asset_id, l.space_id, (SELECT max(seq) FROM public.ops_asset_events z WHERE z.asset_id = l.asset_id AND z.effective_on <= _ref)
  FROM (SELECT DISTINCT ON (asset_id) asset_id, school_id, space_id FROM public.ops_asset_events
        WHERE kind = 'localizacao' AND effective_on <= _ref ORDER BY asset_id, seq DESC) l
  WHERE l.school_id = _school AND (cardinality(coalesce(_spaces,'{}')) = 0 OR l.space_id = ANY(_spaces))
    AND NOT EXISTS (SELECT 1 FROM public.ops_asset_events b WHERE b.asset_id = l.asset_id AND b.kind = 'baixa' AND b.effective_on <= _ref);
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsinv:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_ops_asset_inventory_event(_inv uuid, _expected_seq int, _kind text, _engagement uuid, _asset uuid,
  _found_desc text, _result text, _found_space uuid, _condition text, _action text, _evidence uuid, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _i public.ops_asset_inventories; _last int; _seq int; _member boolean; _started boolean;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsinv:no-person'; END IF;
  SELECT seq INTO _seq FROM public.ops_asset_inventory_events WHERE idempotency_key = _key;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _i FROM public.ops_asset_inventories WHERE id = _inv FOR UPDATE;
  IF _i.id IS NULL THEN RAISE EXCEPTION 'opsinv:unavailable'; END IF;
  IF EXISTS (SELECT 1 FROM public.ops_asset_inventory_events WHERE inventory_id = _inv AND kind IN ('encerramento','cancelamento')) THEN RAISE EXCEPTION 'opsinv:closed'; END IF;
  SELECT coalesce(max(seq),0) INTO _last FROM public.ops_asset_inventory_events WHERE inventory_id = _inv;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'opsinv:conflict'; END IF;
  _started := EXISTS (SELECT 1 FROM public.ops_asset_inventory_events WHERE inventory_id = _inv AND kind = 'inicio');
  _member := EXISTS (SELECT 1 FROM public.ops_asset_inventory_events m JOIN public.institutional_engagements e ON e.id = m.engagement_id
    WHERE m.inventory_id = _inv AND m.kind = 'equipe-inclusao' AND e.person_id = _p
      AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date));
  IF _kind IN ('equipe-inclusao','inicio','cancelamento') THEN
    IF NOT public.has_school_capability('abrir-inventarios-patrimoniais', _i.school_id) THEN RAISE EXCEPTION 'opsinv:forbidden'; END IF;
    IF _kind = 'equipe-inclusao' AND (_started OR NOT EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = _engagement AND e.school_id = _i.school_id
       AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date))) THEN RAISE EXCEPTION 'opsinv:member-invalid'; END IF;
    IF _kind = 'inicio' AND (_started OR NOT EXISTS (SELECT 1 FROM public.ops_asset_inventory_events WHERE inventory_id = _inv AND kind = 'equipe-inclusao')) THEN RAISE EXCEPTION 'opsinv:cannot-start'; END IF;
  ELSIF _kind IN ('conferencia','providencia') THEN
    IF NOT _started THEN RAISE EXCEPTION 'opsinv:not-started'; END IF;
    IF NOT _member THEN RAISE EXCEPTION 'opsinv:not-team-member'; END IF;
    IF _kind = 'conferencia' AND _asset IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_asset_inventory_expected x WHERE x.inventory_id = _inv AND x.asset_id = _asset) THEN RAISE EXCEPTION 'opsinv:asset-not-expected'; END IF;
    IF _found_space IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_spaces s WHERE s.id = _found_space AND s.school_id = _i.school_id) THEN RAISE EXCEPTION 'opsinv:invalid-space'; END IF;
  ELSIF _kind = 'encerramento' THEN
    IF NOT public.has_school_capability('encerrar-inventarios-patrimoniais', _i.school_id) THEN RAISE EXCEPTION 'opsinv:close-forbidden'; END IF;
    IF _member OR EXISTS (SELECT 1 FROM public.ops_asset_inventory_events WHERE inventory_id = _inv AND kind = 'conferencia' AND actor_person = _p) THEN RAISE EXCEPTION 'opsinv:self-close'; END IF;
    IF EXISTS (SELECT 1 FROM public.ops_asset_inventory_expected x WHERE x.inventory_id = _inv AND NOT EXISTS (
         SELECT 1 FROM public.ops_asset_inventory_events c WHERE c.inventory_id = _inv AND c.kind = 'conferencia' AND c.asset_id = x.asset_id)) THEN RAISE EXCEPTION 'opsinv:unchecked-assets'; END IF;
    IF EXISTS (SELECT 1 FROM public.ops_asset_inventory_events c WHERE c.inventory_id = _inv AND c.kind = 'conferencia' AND c.result <> 'localizado'
         AND NOT EXISTS (SELECT 1 FROM public.ops_asset_inventory_events v WHERE v.inventory_id = _inv AND v.kind = 'providencia'
           AND (v.asset_id = c.asset_id OR (c.asset_id IS NULL AND v.note LIKE '%' || c.id::text || '%')))) THEN RAISE EXCEPTION 'opsinv:divergence-without-action'; END IF;
  ELSE RAISE EXCEPTION 'opsinv:invalid';
  END IF;
  INSERT INTO public.ops_asset_inventory_events(inventory_id, seq, kind, engagement_id, asset_id, found_description, result, found_space, observed_condition, action_kind, evidence_ref, note, actor_person, idempotency_key)
  VALUES (_inv, _last + 1, _kind, _engagement, _asset, nullif(btrim(_found_desc),''), _result, _found_space, nullif(btrim(_condition),''), _action, _evidence, nullif(btrim(_note),''), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opsinv:duplicate';
  WHEN check_violation THEN RAISE EXCEPTION 'opsinv:invalid';
END $$;

REVOKE ALL ON FUNCTION public.open_ops_asset_inventory(text,uuid[],date,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_asset_inventory_event(uuid,int,text,uuid,uuid,text,text,uuid,text,text,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.open_ops_asset_inventory(text,uuid[],date,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_asset_inventory_event(uuid,int,text,uuid,uuid,text,text,uuid,text,text,uuid,text,text) TO authenticated;
REVOKE SELECT ON public.ops_asset_inventory_events FROM authenticated;
GRANT SELECT (id, inventory_id, seq, kind, engagement_id, asset_id, found_description, result, found_space, observed_condition, action_kind, note, actor_person, idempotency_key, created_at) ON public.ops_asset_inventory_events TO authenticated;