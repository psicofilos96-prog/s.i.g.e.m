-- Frente Y.1 — Fechamento do repositório curricular: cadeia de edições com revisão +1, identidade de conteúdo
-- (hash do arquivo-fonte + manifesto canônico calculado no banco) e vigência dos vínculos de valor canônico na data efetiva.
-- Aditiva: 0068/0133/0134 intactas; funções substituídas por CREATE OR REPLACE, colunas novas anuláveis.

-- ===== 1. Cadeia de edições: revisão determinística =====
ALTER TABLE public.curricular_reference_editions
  ADD COLUMN revision_no integer CHECK (revision_no IS NULL OR revision_no >= 1),
  ADD COLUMN manifest_sha256 text CHECK (manifest_sha256 IS NULL OR manifest_sha256 ~ '^[0-9a-f]{64}$');
COMMENT ON COLUMN public.curricular_reference_editions.revision_no IS 'Posição na cadeia da fonte: raiz = 1, sucessor = predecessor + 1 (Y.1).';
COMMENT ON COLUMN public.curricular_reference_editions.source_sha256 IS 'SHA-256 dos bytes do arquivo-fonte importado (calculado no navegador sobre o arquivo).';
COMMENT ON COLUMN public.curricular_reference_editions.manifest_sha256 IS 'SHA-256 do manifesto canônico (contrato + metadados da edição + itens normalizados), calculado no banco (Y.1).';

-- Backfill de revisão para cadeias pré-existentes (no fechamento da Y havia 0 edições).
DO $bf$
BEGIN
  IF EXISTS (SELECT 1 FROM public.curricular_reference_editions) THEN
    ALTER TABLE public.curricular_reference_editions DISABLE TRIGGER cre_ao;
    WITH RECURSIVE c AS (SELECT id, 1 AS n FROM public.curricular_reference_editions WHERE supersedes_id IS NULL
                         UNION ALL SELECT e.id, c.n + 1 FROM public.curricular_reference_editions e JOIN c ON e.supersedes_id = c.id)
    UPDATE public.curricular_reference_editions e SET revision_no = c.n FROM c WHERE c.id = e.id;
    ALTER TABLE public.curricular_reference_editions ENABLE TRIGGER cre_ao;
  END IF;
END $bf$;

CREATE UNIQUE INDEX cre_source_revision ON public.curricular_reference_editions (source_id, revision_no) WHERE revision_no IS NOT NULL;
CREATE UNIQUE INDEX cre_source_manifest ON public.curricular_reference_editions (source_id, manifest_sha256) WHERE manifest_sha256 IS NOT NULL;

-- Ciclos são impossíveis por construção: o predecessor precisa existir antes (FK + BEFORE INSERT) e a linha é imutável
-- (UPDATE/DELETE/TRUNCATE bloqueados). Com raiz única e sucessor único, a cadeia de cada fonte é uma lista linear.
CREATE OR REPLACE FUNCTION public.cre_chain_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE p record;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('ref:' || coalesce(NEW.source_id,'')));
  IF NEW.supersedes_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.curricular_reference_editions e WHERE e.source_id = NEW.source_id) THEN RAISE EXCEPTION 'reference:edition-second-root'; END IF;
    IF NEW.revision_no IS NOT NULL AND NEW.revision_no <> 1 THEN RAISE EXCEPTION 'reference:edition-revision-invalid'; END IF;
    NEW.revision_no := 1;
  ELSE
    SELECT * INTO p FROM public.curricular_reference_editions WHERE id = NEW.supersedes_id;
    IF p.id IS NULL OR p.source_id <> NEW.source_id THEN RAISE EXCEPTION 'reference:edition-chain-other-source'; END IF;
    IF EXISTS (SELECT 1 FROM public.curricular_reference_editions s WHERE s.supersedes_id = p.id) THEN RAISE EXCEPTION 'reference:edition-fork'; END IF;
    IF p.revision_no IS NULL THEN RAISE EXCEPTION 'reference:ambiguous-chain'; END IF;
    IF NEW.revision_no IS NOT NULL AND NEW.revision_no <> p.revision_no + 1 THEN RAISE EXCEPTION 'reference:edition-revision-invalid'; END IF;
    NEW.revision_no := p.revision_no + 1;
    IF p.valid_from IS NOT NULL AND (NEW.valid_from IS NULL OR NEW.valid_from < p.valid_from) THEN RAISE EXCEPTION 'reference:edition-validity-regression'; END IF;
  END IF;
  RETURN NEW;
END $$;

-- Cadeia ordenada da fonte conhecida em knownAt; qualquer incoerência falha fechado.
CREATE FUNCTION public.curricular_reference_edition_chain(_source_id text, _known_at timestamptz)
RETURNS TABLE(edition_id uuid, revision_no integer, supersedes_id uuid, edition_label text, valid_from date, source_sha256 text, manifest_sha256 text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
#variable_conflict use_column
DECLARE total int; reached int; roots int; bad int;
BEGIN
  IF _source_id IS NULL OR _known_at IS NULL THEN RAISE EXCEPTION 'reference:source-and-known-at-required'; END IF;
  SELECT count(*), count(*) FILTER (WHERE e.supersedes_id IS NULL) INTO total, roots FROM public.curricular_reference_editions e
   WHERE e.source_id = _source_id AND e.recorded_at <= _known_at;
  IF total = 0 THEN RETURN; END IF;
  IF roots <> 1 THEN RAISE EXCEPTION 'reference:ambiguous-chain'; END IF;
  SELECT count(*) INTO bad FROM public.curricular_reference_editions e
    LEFT JOIN public.curricular_reference_editions p ON p.id = e.supersedes_id
   WHERE e.source_id = _source_id AND e.recorded_at <= _known_at
     AND (e.revision_no IS NULL
       OR (e.supersedes_id IS NULL AND e.revision_no <> 1)
       OR (e.supersedes_id IS NOT NULL AND (p.id IS NULL OR p.source_id <> e.source_id OR p.revision_no IS NULL OR e.revision_no <> p.revision_no + 1
            OR p.recorded_at > _known_at)));
  IF bad > 0 THEN RAISE EXCEPTION 'reference:ambiguous-chain'; END IF;
  WITH RECURSIVE c AS (SELECT e.id, 1 AS d FROM public.curricular_reference_editions e WHERE e.source_id = _source_id AND e.supersedes_id IS NULL AND e.recorded_at <= _known_at
                       UNION ALL SELECT e.id, c.d + 1 FROM public.curricular_reference_editions e JOIN c ON e.supersedes_id = c.id WHERE e.recorded_at <= _known_at AND c.d < total)
  SELECT count(DISTINCT id) INTO reached FROM c;
  IF reached <> total THEN RAISE EXCEPTION 'reference:ambiguous-chain'; END IF;
  RETURN QUERY SELECT e.id, e.revision_no, e.supersedes_id, e.edition_label, e.valid_from, e.source_sha256, e.manifest_sha256, e.recorded_at
    FROM public.curricular_reference_editions e WHERE e.source_id = _source_id AND e.recorded_at <= _known_at ORDER BY e.revision_no;
END $fn$;

-- Edição aplicável da fonte numa data efetiva: zero ⇒ não definido; histórico de vigência incoerente ⇒ ambíguo.
CREATE FUNCTION public.curricular_reference_edition_applicable_on(_source_id text, _on date, _known_at timestamptz)
RETURNS TABLE(result_kind text, edition_id uuid, revision_no integer)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
#variable_conflict use_column
DECLARE r record; prev date; best record;
BEGIN
  IF _on IS NULL THEN RAISE EXCEPTION 'reference:effective-date-required'; END IF;
  FOR r IN SELECT * FROM public.curricular_reference_edition_chain(_source_id, _known_at) LOOP
    IF r.valid_from IS NULL THEN RETURN QUERY SELECT 'ambiguo'::text, NULL::uuid, NULL::integer; RETURN; END IF;
    IF prev IS NOT NULL AND r.valid_from < prev THEN RETURN QUERY SELECT 'ambiguo'::text, NULL::uuid, NULL::integer; RETURN; END IF;
    prev := r.valid_from;
    IF r.valid_from <= _on THEN best := r; END IF;
  END LOOP;
  IF best.edition_id IS NULL THEN RETURN QUERY SELECT 'nao-definido'::text, NULL::uuid, NULL::integer; RETURN; END IF;
  RETURN QUERY SELECT 'aplicavel'::text, best.edition_id, best.revision_no;
END $fn$;

-- ===== 3. Vigência do valor canônico na data efetiva =====
-- Precedente b33: na data, vale a maior versão do valor com valid_from ≤ data. O vínculo só é vigente se a versão
-- declarada é essa e está homologada. Zero candidatas ⇒ não definido; histórico não monotônico ⇒ ambíguo.
CREATE FUNCTION public.attribute_value_state_on(_scheme text, _value text, _version integer, _on date) RETURNS text
LANGUAGE plpgsql STABLE SET search_path TO '' AS $fn$
DECLARE top record;
BEGIN
  IF _on IS NULL THEN RAISE EXCEPTION 'reference:effective-date-required'; END IF;
  IF EXISTS (SELECT 1 FROM public.attribute_value_definitions a JOIN public.attribute_value_definitions b
               ON b.scheme_id = a.scheme_id AND b.value_id = a.value_id AND b.version > a.version
             WHERE a.scheme_id = _scheme AND a.value_id = _value
               AND coalesce(b.valid_from, '-infinity'::date) < coalesce(a.valid_from, '-infinity'::date)) THEN RETURN 'ambiguo'; END IF;
  SELECT d.version, d.status INTO top FROM public.attribute_value_definitions d
   WHERE d.scheme_id = _scheme AND d.value_id = _value AND (d.valid_from IS NULL OR d.valid_from <= _on)
   ORDER BY d.version DESC LIMIT 1;
  IF top.version IS NULL THEN RETURN 'nao-definido'; END IF;
  IF top.version = _version AND top.status = 'homologada' THEN RETURN 'vigente'; END IF;
  RETURN 'nao-vigente';
END $fn$;
REVOKE ALL ON FUNCTION public.attribute_value_state_on(text,text,integer,date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.attribute_value_state_on(text,text,integer,date) TO authenticated;

-- Guarda do banco: o vínculo vale na vigência da edição; sem data efetiva, falha fechado.
CREATE OR REPLACE FUNCTION public.crb_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE d date; st text;
BEGIN
  SELECT e.valid_from INTO d FROM public.curricular_reference_items i JOIN public.curricular_reference_editions e ON e.id = i.edition_id WHERE i.id = NEW.item_id;
  IF d IS NULL THEN RAISE EXCEPTION 'reference:binding-effective-date-required'; END IF;
  IF NEW.value_version IS NULL THEN RAISE EXCEPTION 'reference:binding-not-homologated:%/%', NEW.scheme_id, NEW.value_id; END IF;
  st := public.attribute_value_state_on(NEW.scheme_id, NEW.value_id, NEW.value_version, d);
  IF st <> 'vigente' THEN RAISE EXCEPTION 'reference:binding-%:%/%', st, NEW.scheme_id, NEW.value_id; END IF;
  RETURN NEW;
END $$;

-- Estado de cada vínculo do item numa data-alvo (consumidores não usam relógio civil).
CREATE FUNCTION public.curricular_reference_item_bindings_on(_item uuid, _on date)
RETURNS TABLE(scheme_id text, value_id text, value_version integer, state text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $$
  SELECT b.scheme_id, b.value_id, b.value_version, public.attribute_value_state_on(b.scheme_id, b.value_id, b.value_version, _on)
    FROM public.curricular_reference_item_bindings b WHERE b.item_id = _item ORDER BY b.scheme_id, b.value_id
$$;

-- ===== 2. Escritor da edição: idempotência por conteúdo, conflito explícito =====
CREATE OR REPLACE FUNCTION public.record_curricular_reference_edition_v2(_source_id text, _source_label text, _authority text, _edition_label text,
  _published_on date, _valid_from date, _source_sha256 text, _source_ref text, _expected_head uuid, _declared_item_count integer, _items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE a record; head uuid; ed uuid; it record; item uuid; b jsonb; reached int; bad text; manifest jsonb; msha text; ex record; st text;
BEGIN
  SELECT * INTO a FROM public.reference_actor('construir-referencia-curricular', _valid_from);
  IF _source_sha256 IS NULL OR _source_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'reference:sha256-invalid'; END IF;
  IF _source_id IS NULL OR _source_id !~ '^[a-z0-9][a-z0-9-]{1,39}$' THEN RAISE EXCEPTION 'reference:source-id-invalid'; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'reference:items-required'; END IF;
  IF _declared_item_count IS NULL OR _declared_item_count <> jsonb_array_length(_items) THEN RAISE EXCEPTION 'reference:item-count-mismatch'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ref:' || _source_id));

  CREATE TEMP TABLE IF NOT EXISTS pg_temp._cr_items (ord int, code text, kind text, txt text, parent text, labels jsonb, locator text, bindings jsonb) ON COMMIT DROP;
  TRUNCATE pg_temp._cr_items;
  INSERT INTO pg_temp._cr_items SELECT x.o::int, btrim(x.v->>'code'), x.v->>'kind', x.v->>'official_text', nullif(btrim(x.v->>'parent_code'),''),
    coalesce(x.v->'source_labels','{}'::jsonb), nullif(btrim(x.v->>'locator'),''), coalesce(x.v->'bindings','[]'::jsonb)
    FROM jsonb_array_elements(_items) WITH ORDINALITY x(v, o);
  SELECT 'item ' || ord INTO bad FROM pg_temp._cr_items WHERE coalesce(code,'') = '' LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'reference:code-required:%', bad; END IF;
  SELECT code INTO bad FROM pg_temp._cr_items GROUP BY code HAVING count(*) > 1 LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'reference:duplicate-code:%', bad; END IF;
  SELECT code INTO bad FROM pg_temp._cr_items WHERE kind IS NULL OR kind !~ '^[a-z0-9][a-z0-9-]{1,39}$' LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'reference:kind-invalid:%', bad; END IF;
  SELECT code INTO bad FROM pg_temp._cr_items WHERE length(btrim(coalesce(txt,''))) = 0 LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'reference:official-text-required:%', bad; END IF;
  SELECT code INTO bad FROM pg_temp._cr_items WHERE jsonb_typeof(labels) <> 'object' OR jsonb_typeof(bindings) <> 'array' LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'reference:item-shape-invalid:%', bad; END IF;
  SELECT c.code INTO bad FROM pg_temp._cr_items c WHERE c.parent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_temp._cr_items p WHERE p.code = c.parent) LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'reference:parent-missing:%', bad; END IF;
  WITH RECURSIVE t AS (SELECT code, 0 AS d FROM pg_temp._cr_items WHERE parent IS NULL
                       UNION ALL SELECT c.code, t.d + 1 FROM pg_temp._cr_items c JOIN t ON c.parent = t.code WHERE t.d < 64)
  SELECT count(DISTINCT code) INTO reached FROM t;
  IF reached <> (SELECT count(*) FROM pg_temp._cr_items) THEN RAISE EXCEPTION 'reference:parent-cycle'; END IF;

  -- Manifesto canônico: jsonb normaliza chaves; itens na ordem da fonte; vínculos ordenados.
  manifest := jsonb_build_object('contract', 'sigem.curricular-reference-source.v2', 'source_id', _source_id, 'source_label', btrim(_source_label),
    'authority', btrim(_authority), 'edition_label', btrim(_edition_label), 'published_on', _published_on, 'valid_from', _valid_from,
    'items', (SELECT jsonb_agg(jsonb_build_object('code', c.code, 'kind', c.kind, 'official_text', c.txt, 'parent_code', c.parent,
                'source_labels', c.labels, 'locator', c.locator,
                'bindings', (SELECT coalesce(jsonb_agg(jsonb_build_object('scheme_id', x->>'scheme_id', 'value_id', x->>'value_id', 'value_version', x->'value_version')
                              ORDER BY x->>'scheme_id', x->>'value_id', x->>'value_version'), '[]'::jsonb) FROM jsonb_array_elements(c.bindings) x))
              ORDER BY c.ord) FROM pg_temp._cr_items c));
  msha := encode(pg_catalog.sha256(convert_to(manifest::text, 'UTF8')), 'hex');

  SELECT e.id, e.manifest_sha256 INTO ex FROM public.curricular_reference_editions e WHERE e.source_id = _source_id AND e.source_sha256 = _source_sha256;
  IF ex.id IS NOT NULL THEN
    IF ex.manifest_sha256 IS NOT DISTINCT FROM msha THEN RETURN jsonb_build_object('id', ex.id, 'idempotent', true, 'manifest_sha256', msha); END IF;
    RAISE EXCEPTION 'reference:hash-context-conflict';
  END IF;
  IF EXISTS (SELECT 1 FROM public.curricular_reference_editions e WHERE e.source_id = _source_id AND e.edition_label = btrim(_edition_label)) THEN
    RAISE EXCEPTION 'reference:edition-label-conflict'; END IF;
  IF EXISTS (SELECT 1 FROM public.curricular_reference_editions e WHERE e.source_id = _source_id AND e.manifest_sha256 = msha) THEN
    RAISE EXCEPTION 'reference:manifest-already-recorded'; END IF;

  SELECT e.id INTO head FROM public.curricular_reference_editions e
   WHERE e.source_id = _source_id AND NOT EXISTS (SELECT 1 FROM public.curricular_reference_editions s WHERE s.supersedes_id = e.id);
  IF head IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'reference:stale-head'; END IF;

  INSERT INTO public.curricular_reference_editions(source_id, source_label, authority, edition_label, published_on, valid_from,
    source_sha256, source_ref, supersedes_id, item_count, recorded_by, recorded_engagement, recorded_by_person_id, declared_item_count, contract_schema, manifest_sha256)
  VALUES (_source_id, btrim(_source_label), btrim(_authority), btrim(_edition_label), _published_on, _valid_from,
    _source_sha256, nullif(btrim(_source_ref),''), head, jsonb_array_length(_items), auth.uid(), a.engagement_id, a.person_id, _declared_item_count,
    'sigem.curricular-reference-source.v2', msha)
  RETURNING id INTO ed;
  FOR it IN WITH RECURSIVE t AS (SELECT c.*, 0 AS d FROM pg_temp._cr_items c WHERE c.parent IS NULL
                                 UNION ALL SELECT c.*, t.d + 1 FROM pg_temp._cr_items c JOIN t ON c.parent = t.code)
            SELECT * FROM t ORDER BY d, ord LOOP
    INSERT INTO public.curricular_reference_items(edition_id, code, item_kind, official_text, parent_code, source_labels, source_locator, parent_item_id, ordinal)
    VALUES (ed, it.code, it.kind, it.txt, it.parent, it.labels, it.locator,
      (SELECT i.id FROM public.curricular_reference_items i WHERE i.edition_id = ed AND i.code = it.parent), it.ord)
    RETURNING id INTO item;
    FOR b IN SELECT * FROM jsonb_array_elements(it.bindings) LOOP
      IF (b->>'value_version') IS NULL OR (b->>'value_version') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'reference:binding-unknown:%:%/%', it.code, b->>'scheme_id', b->>'value_id'; END IF;
      st := public.attribute_value_state_on(b->>'scheme_id', b->>'value_id', (b->>'value_version')::integer, _valid_from);
      IF st = 'nao-definido' THEN RAISE EXCEPTION 'reference:binding-unknown:%:%/%', it.code, b->>'scheme_id', b->>'value_id'; END IF;
      IF st <> 'vigente' THEN RAISE EXCEPTION 'reference:binding-%:%:%/%', st, it.code, b->>'scheme_id', b->>'value_id'; END IF;
      INSERT INTO public.curricular_reference_item_bindings(item_id, scheme_id, value_id, value_version)
      VALUES (item, b->>'scheme_id', b->>'value_id', (b->>'value_version')::integer);
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('id', ed, 'supersedes_id', head, 'idempotent', false, 'manifest_sha256', msha,
    'revision_no', (SELECT revision_no FROM public.curricular_reference_editions WHERE id = ed));
END $fn$;

-- ===== 4. ACL revalidada =====
REVOKE ALL ON FUNCTION public.record_curricular_reference_edition_v2(text,text,text,text,date,date,text,text,uuid,integer,jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_curricular_reference_edition_v2(text,text,text,text,date,date,text,text,uuid,integer,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.cre_chain_guard(), public.crb_guard() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.curricular_reference_edition_chain(text, timestamptz), public.curricular_reference_edition_applicable_on(text, date, timestamptz),
  public.curricular_reference_item_bindings_on(uuid, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.curricular_reference_edition_chain(text, timestamptz), public.curricular_reference_edition_applicable_on(text, date, timestamptz),
  public.curricular_reference_item_bindings_on(uuid, date) TO authenticated;
