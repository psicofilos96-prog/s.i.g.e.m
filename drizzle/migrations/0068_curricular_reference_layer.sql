-- Camada canônica de referência curricular externa (BNCC, SAEB e futuras). Taxonomia externa é DADO por edição;
-- o motor só conhece fonte, edição, item, vínculo por ID canônico, relação e camada editorial.
-- Capability 'manter-referencia-curricular' (rede) sem regra: gravação fechada até decisão do proprietário.

CREATE FUNCTION public.reference_grant() RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = 'manter-referencia-curricular' AND c.policy_id IS NOT NULL AND c.scope_level = 'rede'
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:manter-referencia-curricular'; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.reference_grant() FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.curricular_reference_editions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id text NOT NULL CHECK (source_id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  source_label text NOT NULL CHECK (length(btrim(source_label)) > 0),
  authority text NOT NULL CHECK (length(btrim(authority)) > 0),
  edition_label text NOT NULL CHECK (length(btrim(edition_label)) > 0),
  published_on date,
  valid_from date,
  source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_ref text,
  supersedes_id uuid REFERENCES public.curricular_reference_editions(id),
  item_count integer NOT NULL,
  recorded_by uuid NOT NULL,
  recorded_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, edition_label),
  UNIQUE (source_id, source_sha256)
);
CREATE UNIQUE INDEX cre_one_successor ON public.curricular_reference_editions (supersedes_id) WHERE supersedes_id IS NOT NULL;

CREATE TABLE public.curricular_reference_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_id uuid NOT NULL REFERENCES public.curricular_reference_editions(id),
  code text NOT NULL CHECK (length(btrim(code)) > 0),
  item_kind text NOT NULL CHECK (item_kind ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  official_text text NOT NULL CHECK (length(btrim(official_text)) > 0),
  parent_code text,
  source_labels jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_labels) = 'object'),
  source_locator text,
  UNIQUE (edition_id, code)
);
CREATE INDEX cri_code ON public.curricular_reference_items (code);

-- Vínculo a IDs canônicos do SIGEM (esquemas de valores), nunca a string.
CREATE TABLE public.curricular_reference_item_bindings (
  item_id uuid NOT NULL REFERENCES public.curricular_reference_items(id),
  scheme_id text NOT NULL,
  value_id text NOT NULL,
  PRIMARY KEY (item_id, scheme_id, value_id)
);

CREATE TABLE public.curricular_reference_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_item_id uuid NOT NULL REFERENCES public.curricular_reference_items(id),
  to_item_id uuid NOT NULL REFERENCES public.curricular_reference_items(id),
  nature text NOT NULL CHECK (nature ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  confidence text NOT NULL CHECK (confidence ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  provenance text NOT NULL CHECK (length(btrim(provenance)) > 0),
  revokes_id uuid REFERENCES public.curricular_reference_relations(id),
  reason text,
  recorded_by uuid NOT NULL,
  recorded_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (from_item_id <> to_item_id),
  CHECK (revokes_id IS NULL OR length(btrim(coalesce(reason,''))) > 0)
);
CREATE UNIQUE INDEX crr_revoked_once ON public.curricular_reference_relations (revokes_id) WHERE revokes_id IS NOT NULL;

-- Camada editorial do SIGEM: nunca substitui o texto oficial.
CREATE TABLE public.curricular_reference_simplifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.curricular_reference_items(id),
  version_no integer NOT NULL CHECK (version_no >= 1),
  supersedes_id uuid REFERENCES public.curricular_reference_simplifications(id),
  simplified_text text NOT NULL CHECK (length(btrim(simplified_text)) > 0),
  reason text,
  recorded_by uuid NOT NULL,
  recorded_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, version_no),
  CHECK (version_no = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) > 0))
);

REVOKE ALL ON public.curricular_reference_editions, public.curricular_reference_items, public.curricular_reference_item_bindings,
  public.curricular_reference_relations, public.curricular_reference_simplifications FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.curricular_reference_editions, public.curricular_reference_items, public.curricular_reference_item_bindings,
  public.curricular_reference_relations, public.curricular_reference_simplifications TO authenticated;
GRANT ALL ON public.curricular_reference_editions, public.curricular_reference_items, public.curricular_reference_item_bindings,
  public.curricular_reference_relations, public.curricular_reference_simplifications TO service_role;
ALTER TABLE public.curricular_reference_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_reference_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_reference_item_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_reference_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_reference_simplifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Catálogo de referência legível por autenticados" ON public.curricular_reference_editions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo de referência legível por autenticados" ON public.curricular_reference_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo de referência legível por autenticados" ON public.curricular_reference_item_bindings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo de referência legível por autenticados" ON public.curricular_reference_relations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo de referência legível por autenticados" ON public.curricular_reference_simplifications FOR SELECT TO authenticated USING (true);

CREATE FUNCTION public.reference_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN RAISE EXCEPTION 'reference:append-only'; END $$;
CREATE TRIGGER cre_ao BEFORE UPDATE OR DELETE ON public.curricular_reference_editions FOR EACH ROW EXECUTE FUNCTION public.reference_append_only();
CREATE TRIGGER cri_ao BEFORE UPDATE OR DELETE ON public.curricular_reference_items FOR EACH ROW EXECUTE FUNCTION public.reference_append_only();
CREATE TRIGGER crb_ao BEFORE UPDATE OR DELETE ON public.curricular_reference_item_bindings FOR EACH ROW EXECUTE FUNCTION public.reference_append_only();
CREATE TRIGGER crr_ao BEFORE UPDATE OR DELETE ON public.curricular_reference_relations FOR EACH ROW EXECUTE FUNCTION public.reference_append_only();
CREATE TRIGGER crs_ao BEFORE UPDATE OR DELETE ON public.curricular_reference_simplifications FOR EACH ROW EXECUTE FUNCTION public.reference_append_only();

-- Edição inteira numa transação. Nova edição de fonte já existente exige supersedes = última edição (expected head).
CREATE FUNCTION public.record_curricular_reference_edition(_source_id text, _source_label text, _authority text, _edition_label text,
  _published_on date, _valid_from date, _source_sha256 text, _source_ref text, _expected_head uuid, _items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; head uuid; ed uuid; it jsonb; item uuid; b jsonb; n int;
BEGIN
  g := public.reference_grant();
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'reference:items-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ref:' || coalesce(_source_id,'')));
  SELECT e.id INTO head FROM public.curricular_reference_editions e
   WHERE e.source_id = _source_id AND NOT EXISTS (SELECT 1 FROM public.curricular_reference_editions s WHERE s.supersedes_id = e.id)
   ORDER BY e.recorded_at DESC LIMIT 1;
  IF head IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'reference:stale-head'; END IF;
  IF EXISTS (SELECT 1 FROM public.curricular_reference_editions WHERE source_id = _source_id AND source_sha256 = _source_sha256) THEN
    RAISE EXCEPTION 'reference:same-source-already-recorded'; END IF;
  SELECT count(*) - count(DISTINCT x ->> 'code') INTO n FROM jsonb_array_elements(_items) x;
  IF n > 0 THEN RAISE EXCEPTION 'reference:duplicate-code'; END IF;
  INSERT INTO public.curricular_reference_editions(source_id, source_label, authority, edition_label, published_on, valid_from,
    source_sha256, source_ref, supersedes_id, item_count, recorded_by, recorded_engagement)
  VALUES (_source_id, btrim(_source_label), btrim(_authority), btrim(_edition_label), _published_on, _valid_from,
    _source_sha256, nullif(btrim(_source_ref),''), head, jsonb_array_length(_items), auth.uid(), g)
  RETURNING id INTO ed;
  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    INSERT INTO public.curricular_reference_items(edition_id, code, item_kind, official_text, parent_code, source_labels, source_locator)
    VALUES (ed, btrim(it ->> 'code'), it ->> 'kind', it ->> 'official_text', nullif(btrim(it ->> 'parent_code'),''),
      coalesce(it -> 'source_labels', '{}'::jsonb), nullif(btrim(it ->> 'locator'),''))
    RETURNING id INTO item;
    FOR b IN SELECT * FROM jsonb_array_elements(coalesce(it -> 'bindings', '[]'::jsonb)) LOOP
      IF NOT EXISTS (SELECT 1 FROM public.attribute_value_definitions d WHERE d.scheme_id = b ->> 'scheme_id' AND d.value_id = b ->> 'value_id') THEN
        RAISE EXCEPTION 'reference:binding-unknown:%/%', b ->> 'scheme_id', b ->> 'value_id'; END IF;
      INSERT INTO public.curricular_reference_item_bindings VALUES (item, b ->> 'scheme_id', b ->> 'value_id');
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('id', ed, 'supersedes_id', head);
END $fn$;
REVOKE ALL ON FUNCTION public.record_curricular_reference_edition(text,text,text,text,date,date,text,text,uuid,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_curricular_reference_edition(text,text,text,text,date,date,text,text,uuid,jsonb) TO authenticated;

CREATE FUNCTION public.record_curricular_reference_relation(_from uuid, _to uuid, _nature text, _confidence text, _provenance text, _revokes uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; r uuid; old record;
BEGIN
  g := public.reference_grant();
  IF _revokes IS NOT NULL THEN
    SELECT * INTO old FROM public.curricular_reference_relations WHERE id = _revokes;
    IF old.id IS NULL OR old.revokes_id IS NOT NULL THEN RAISE EXCEPTION 'reference:relation-not-found'; END IF;
    _from := old.from_item_id; _to := old.to_item_id; _nature := old.nature; _confidence := old.confidence;
  END IF;
  INSERT INTO public.curricular_reference_relations(from_item_id, to_item_id, nature, confidence, provenance, revokes_id, reason, recorded_by, recorded_engagement)
  VALUES (_from, _to, _nature, _confidence, _provenance, _revokes, nullif(btrim(_reason),''), auth.uid(), g) RETURNING id INTO r;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.record_curricular_reference_relation(uuid,uuid,text,text,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_curricular_reference_relation(uuid,uuid,text,text,text,uuid,text) TO authenticated;

CREATE FUNCTION public.record_curricular_reference_simplification(_item uuid, _expected_head uuid, _text text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; head record; r uuid;
BEGIN
  g := public.reference_grant();
  PERFORM pg_advisory_xact_lock(hashtext('refs:' || _item::text));
  SELECT id, version_no INTO head FROM public.curricular_reference_simplifications WHERE item_id = _item ORDER BY version_no DESC LIMIT 1;
  IF head.id IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'reference:stale-head'; END IF;
  INSERT INTO public.curricular_reference_simplifications(item_id, version_no, supersedes_id, simplified_text, reason, recorded_by, recorded_engagement)
  VALUES (_item, coalesce(head.version_no, 0) + 1, head.id, _text, nullif(btrim(_reason),''), auth.uid(), g) RETURNING id INTO r;
  RETURN r;
END $fn$;
REVOKE ALL ON FUNCTION public.record_curricular_reference_simplification(uuid,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_curricular_reference_simplification(uuid,uuid,text,text) TO authenticated;