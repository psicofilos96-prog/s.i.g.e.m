-- Frente Y — Repositório curricular canônico: hardening da 0068, governança estreita, contrato v2, relações
-- oficiais × editoriais, ausência de correspondência, palavras-chave, glossário, homologação e readers estáveis.
-- Aditiva. Nenhum conteúdo oficial é inserido aqui.

-- ===== Y.0 ACL: nenhuma escrita direta, nem por service_role =====
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.curricular_reference_editions, public.curricular_reference_items,
  public.curricular_reference_item_bindings, public.curricular_reference_relations, public.curricular_reference_simplifications
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.curricular_reference_editions, public.curricular_reference_items, public.curricular_reference_item_bindings,
  public.curricular_reference_relations, public.curricular_reference_simplifications TO service_role;

-- ===== Colunas aditivas =====
ALTER TABLE public.curricular_reference_editions ADD COLUMN recorded_by_person_id uuid, ADD COLUMN declared_item_count integer, ADD COLUMN contract_schema text;
ALTER TABLE public.curricular_reference_items ADD COLUMN parent_item_id uuid REFERENCES public.curricular_reference_items(id), ADD COLUMN ordinal integer;
ALTER TABLE public.curricular_reference_item_bindings ADD COLUMN value_version integer;
ALTER TABLE public.curricular_reference_relations ADD COLUMN origin text, ADD COLUMN direction text, ADD COLUMN justification text,
  ADD COLUMN criteria jsonb, ADD COLUMN official_locator text, ADD COLUMN recorded_by_person_id uuid;
ALTER TABLE public.curricular_reference_simplifications ADD COLUMN recorded_by_person_id uuid;
COMMENT ON COLUMN public.curricular_reference_relations.confidence IS 'Legado 0068; relações novas usam origin + nature fechada + justification.';
COMMENT ON FUNCTION public.reference_grant() IS 'DEPRECATED: substituída por reference_actor(capability, data) (Frente Y).';

CREATE UNIQUE INDEX cre_one_root ON public.curricular_reference_editions (source_id) WHERE supersedes_id IS NULL;
CREATE UNIQUE INDEX crs_one_successor ON public.curricular_reference_simplifications (supersedes_id) WHERE supersedes_id IS NOT NULL;

-- ===== Y.0 Guardas de cadeia e coerência no banco =====
CREATE FUNCTION public.cre_chain_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE p record;
BEGIN
  IF NEW.supersedes_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.curricular_reference_editions e WHERE e.source_id = NEW.source_id) THEN RAISE EXCEPTION 'reference:edition-second-root'; END IF;
  ELSE
    SELECT * INTO p FROM public.curricular_reference_editions WHERE id = NEW.supersedes_id;
    IF p.id IS NULL OR p.source_id <> NEW.source_id THEN RAISE EXCEPTION 'reference:edition-chain-other-source'; END IF;
    IF EXISTS (SELECT 1 FROM public.curricular_reference_editions s WHERE s.supersedes_id = p.id) THEN RAISE EXCEPTION 'reference:edition-fork'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cre_chain BEFORE INSERT ON public.curricular_reference_editions FOR EACH ROW EXECUTE FUNCTION public.cre_chain_guard();

CREATE FUNCTION public.crs_chain_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE p record;
BEGIN
  IF (NEW.version_no = 1) <> (NEW.supersedes_id IS NULL) THEN RAISE EXCEPTION 'reference:simplification-chain-invalid'; END IF;
  IF NEW.supersedes_id IS NOT NULL THEN
    SELECT * INTO p FROM public.curricular_reference_simplifications WHERE id = NEW.supersedes_id;
    IF p.id IS NULL OR p.item_id <> NEW.item_id OR NEW.version_no <> p.version_no + 1 THEN RAISE EXCEPTION 'reference:simplification-chain-invalid'; END IF;
  ELSIF EXISTS (SELECT 1 FROM public.curricular_reference_simplifications s WHERE s.item_id = NEW.item_id) THEN
    RAISE EXCEPTION 'reference:simplification-chain-invalid';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crs_chain BEFORE INSERT ON public.curricular_reference_simplifications FOR EACH ROW EXECUTE FUNCTION public.crs_chain_guard();

CREATE FUNCTION public.crr_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE t record;
BEGIN
  IF NEW.from_item_id = NEW.to_item_id THEN RAISE EXCEPTION 'reference:relation-self'; END IF;
  IF NEW.revokes_id IS NOT NULL THEN
    SELECT * INTO t FROM public.curricular_reference_relations WHERE id = NEW.revokes_id;
    IF t.id IS NULL THEN RAISE EXCEPTION 'reference:relation-not-found'; END IF;
    IF t.revokes_id IS NOT NULL THEN RAISE EXCEPTION 'reference:cannot-revoke-revocation'; END IF;
    IF t.from_item_id <> NEW.from_item_id OR t.to_item_id <> NEW.to_item_id OR t.nature <> NEW.nature
       OR t.origin IS DISTINCT FROM NEW.origin THEN RAISE EXCEPTION 'reference:revocation-target-mismatch'; END IF;
    IF length(btrim(coalesce(NEW.reason,''))) = 0 THEN RAISE EXCEPTION 'reference:reason-required'; END IF;
    RETURN NEW;
  END IF;
  IF NEW.origin IS NULL OR NEW.origin NOT IN ('oficial-da-fonte','editorial-sigem') THEN RAISE EXCEPTION 'reference:relation-origin-required'; END IF;
  IF NEW.origin = 'editorial-sigem' AND NEW.nature NOT IN ('direta','parcial','indireta-complementar') THEN RAISE EXCEPTION 'reference:editorial-nature-invalid'; END IF;
  IF NEW.origin = 'oficial-da-fonte' AND length(btrim(coalesce(NEW.official_locator,''))) = 0 THEN RAISE EXCEPTION 'reference:official-locator-required'; END IF;
  IF length(btrim(coalesce(NEW.justification,''))) = 0 THEN RAISE EXCEPTION 'reference:justification-required'; END IF;
  IF NEW.direction IS NULL OR NEW.direction NOT IN ('de-para','bidirecional') THEN RAISE EXCEPTION 'reference:direction-invalid'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crr_guard BEFORE INSERT ON public.curricular_reference_relations FOR EACH ROW EXECUTE FUNCTION public.crr_guard();

CREATE FUNCTION public.crb_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF NEW.value_version IS NULL OR NOT public.attribute_value_homologated(NEW.scheme_id, NEW.value_id, NEW.value_version, NULL) THEN
    RAISE EXCEPTION 'reference:binding-not-homologated:%/%', NEW.scheme_id, NEW.value_id; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crb_guard BEFORE INSERT ON public.curricular_reference_item_bindings FOR EACH ROW EXECUTE FUNCTION public.crb_guard();

-- ===== Y.4/Y.5 Novas camadas editoriais (append-only, versionadas) =====
CREATE TABLE public.curricular_reference_correspondence_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.curricular_reference_items(id),
  target_source_id text NOT NULL CHECK (target_source_id ~ '^[a-z0-9][a-z0-9-]{1,39}$'),
  version_no integer NOT NULL CHECK (version_no >= 1),
  supersedes_id uuid REFERENCES public.curricular_reference_correspondence_assessments(id),
  conclusion text NOT NULL CHECK (conclusion = 'sem-correspondencia-identificada'),
  withdrawn boolean NOT NULL DEFAULT false,
  justification text NOT NULL CHECK (length(btrim(justification)) > 0),
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(criteria) = 'object'),
  reason text,
  recorded_by uuid NOT NULL, recorded_by_person_id uuid NOT NULL, recorded_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, target_source_id, version_no),
  CHECK (version_no = 1 OR length(btrim(coalesce(reason,''))) > 0)
);
CREATE UNIQUE INDEX crca_one_successor ON public.curricular_reference_correspondence_assessments (supersedes_id) WHERE supersedes_id IS NOT NULL;

CREATE TABLE public.curricular_reference_keyword_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.curricular_reference_items(id),
  version_no integer NOT NULL CHECK (version_no >= 1),
  supersedes_id uuid REFERENCES public.curricular_reference_keyword_versions(id),
  terms text[] NOT NULL CHECK (cardinality(terms) BETWEEN 1 AND 40),
  reason text,
  recorded_by uuid NOT NULL, recorded_by_person_id uuid NOT NULL, recorded_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, version_no),
  CHECK (version_no = 1 OR length(btrim(coalesce(reason,''))) > 0)
);
CREATE UNIQUE INDEX crkv_one_successor ON public.curricular_reference_keyword_versions (supersedes_id) WHERE supersedes_id IS NOT NULL;

CREATE TABLE public.curricular_reference_glossary_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_key text NOT NULL CHECK (term_key ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  version_no integer NOT NULL CHECK (version_no >= 1),
  supersedes_id uuid REFERENCES public.curricular_reference_glossary_versions(id),
  term text NOT NULL CHECK (length(btrim(term)) > 0),
  definition text NOT NULL CHECK (length(btrim(definition)) > 0),
  definition_origin text NOT NULL CHECK (definition_origin IN ('oficial-da-fonte','explicacao-sigem')),
  edition_id uuid NOT NULL REFERENCES public.curricular_reference_editions(id),
  item_id uuid REFERENCES public.curricular_reference_items(id),
  source_locator text,
  reason text,
  recorded_by uuid NOT NULL, recorded_by_person_id uuid NOT NULL, recorded_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (term_key, version_no),
  CHECK (version_no = 1 OR length(btrim(coalesce(reason,''))) > 0),
  CHECK (definition_origin <> 'oficial-da-fonte' OR length(btrim(coalesce(source_locator,''))) > 0)
);
CREATE UNIQUE INDEX crgv_one_successor ON public.curricular_reference_glossary_versions (supersedes_id) WHERE supersedes_id IS NOT NULL;

CREATE TABLE public.curricular_reference_homologations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_kind text NOT NULL CHECK (target_kind IN ('edicao','simplificacao','relacao','avaliacao-correspondencia','palavras-chave','glossario')),
  target_id uuid NOT NULL,
  sequence integer NOT NULL CHECK (sequence >= 1),
  predecessor_id uuid REFERENCES public.curricular_reference_homologations(id),
  decision text NOT NULL CHECK (decision IN ('homologada','revogada')),
  reason text,
  recorded_by uuid NOT NULL, recorded_by_person_id uuid NOT NULL, recorded_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (target_kind, target_id, sequence),
  CHECK ((sequence = 1) = (predecessor_id IS NULL)),
  CHECK (decision = 'homologada' OR length(btrim(coalesce(reason,''))) > 0)
);
CREATE UNIQUE INDEX crh_one_successor ON public.curricular_reference_homologations (predecessor_id) WHERE predecessor_id IS NOT NULL;

-- Guarda genérica de cadeia versionada por chave (version 1 = raiz única; sucessor da mesma chave, +1).
CREATE FUNCTION public.cr_versioned_chain_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
DECLARE ok boolean; exists_root boolean;
BEGIN
  IF (NEW.version_no = 1) <> (NEW.supersedes_id IS NULL) THEN RAISE EXCEPTION 'reference:chain-invalid'; END IF;
  IF TG_TABLE_NAME = 'curricular_reference_keyword_versions' THEN
    SELECT EXISTS (SELECT 1 FROM public.curricular_reference_keyword_versions p WHERE p.id = NEW.supersedes_id AND p.item_id = NEW.item_id AND p.version_no + 1 = NEW.version_no),
           EXISTS (SELECT 1 FROM public.curricular_reference_keyword_versions p WHERE p.item_id = NEW.item_id) INTO ok, exists_root;
  ELSIF TG_TABLE_NAME = 'curricular_reference_glossary_versions' THEN
    SELECT EXISTS (SELECT 1 FROM public.curricular_reference_glossary_versions p WHERE p.id = NEW.supersedes_id AND p.term_key = NEW.term_key AND p.version_no + 1 = NEW.version_no),
           EXISTS (SELECT 1 FROM public.curricular_reference_glossary_versions p WHERE p.term_key = NEW.term_key) INTO ok, exists_root;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.curricular_reference_correspondence_assessments p WHERE p.id = NEW.supersedes_id AND p.item_id = NEW.item_id
             AND p.target_source_id = NEW.target_source_id AND p.version_no + 1 = NEW.version_no),
           EXISTS (SELECT 1 FROM public.curricular_reference_correspondence_assessments p WHERE p.item_id = NEW.item_id AND p.target_source_id = NEW.target_source_id) INTO ok, exists_root;
  END IF;
  IF NEW.supersedes_id IS NULL AND exists_root THEN RAISE EXCEPTION 'reference:chain-invalid'; END IF;
  IF NEW.supersedes_id IS NOT NULL AND NOT ok THEN RAISE EXCEPTION 'reference:chain-invalid'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crca_chain BEFORE INSERT ON public.curricular_reference_correspondence_assessments FOR EACH ROW EXECUTE FUNCTION public.cr_versioned_chain_guard();
CREATE TRIGGER crkv_chain BEFORE INSERT ON public.curricular_reference_keyword_versions FOR EACH ROW EXECUTE FUNCTION public.cr_versioned_chain_guard();
CREATE TRIGGER crgv_chain BEFORE INSERT ON public.curricular_reference_glossary_versions FOR EACH ROW EXECUTE FUNCTION public.cr_versioned_chain_guard();

CREATE FUNCTION public.crh_chain_guard() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN
  IF NEW.predecessor_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.curricular_reference_homologations h WHERE h.target_kind = NEW.target_kind AND h.target_id = NEW.target_id) THEN
      RAISE EXCEPTION 'reference:homologation-chain-invalid'; END IF;
  ELSIF NOT EXISTS (SELECT 1 FROM public.curricular_reference_homologations h WHERE h.id = NEW.predecessor_id AND h.target_kind = NEW.target_kind
        AND h.target_id = NEW.target_id AND h.sequence + 1 = NEW.sequence) THEN
    RAISE EXCEPTION 'reference:homologation-chain-invalid';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER crh_chain BEFORE INSERT ON public.curricular_reference_homologations FOR EACH ROW EXECUTE FUNCTION public.crh_chain_guard();

CREATE TRIGGER crca_ao BEFORE UPDATE OR DELETE ON public.curricular_reference_correspondence_assessments FOR EACH ROW EXECUTE FUNCTION public.reference_append_only();
CREATE TRIGGER crkv_ao BEFORE UPDATE OR DELETE ON public.curricular_reference_keyword_versions FOR EACH ROW EXECUTE FUNCTION public.reference_append_only();
CREATE TRIGGER crgv_ao BEFORE UPDATE OR DELETE ON public.curricular_reference_glossary_versions FOR EACH ROW EXECUTE FUNCTION public.reference_append_only();
CREATE TRIGGER crh_ao BEFORE UPDATE OR DELETE ON public.curricular_reference_homologations FOR EACH ROW EXECUTE FUNCTION public.reference_append_only();
CREATE TRIGGER cre_tr BEFORE TRUNCATE ON public.curricular_reference_editions EXECUTE FUNCTION public.reference_append_only();
CREATE TRIGGER cri_tr BEFORE TRUNCATE ON public.curricular_reference_items EXECUTE FUNCTION public.reference_append_only();
CREATE TRIGGER crr_tr BEFORE TRUNCATE ON public.curricular_reference_relations EXECUTE FUNCTION public.reference_append_only();
CREATE TRIGGER crs_tr BEFORE TRUNCATE ON public.curricular_reference_simplifications EXECUTE FUNCTION public.reference_append_only();

REVOKE ALL ON public.curricular_reference_correspondence_assessments, public.curricular_reference_keyword_versions,
  public.curricular_reference_glossary_versions, public.curricular_reference_homologations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.curricular_reference_correspondence_assessments, public.curricular_reference_keyword_versions,
  public.curricular_reference_glossary_versions, public.curricular_reference_homologations TO authenticated, service_role;
ALTER TABLE public.curricular_reference_correspondence_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_reference_keyword_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_reference_glossary_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.curricular_reference_homologations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Catálogo de referência legível por autenticados" ON public.curricular_reference_correspondence_assessments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo de referência legível por autenticados" ON public.curricular_reference_keyword_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo de referência legível por autenticados" ON public.curricular_reference_glossary_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Catálogo de referência legível por autenticados" ON public.curricular_reference_homologations FOR SELECT TO authenticated USING (true);

-- ===== Y.1 Ator: sessão → pessoa → capacidade de rede na data declarada E no instante do registro =====
-- A data declarada (vigência da operação) é explícita; o instante do registro prova que a autoridade existe agora.
CREATE FUNCTION public.reference_actor(_cap text, _on date) RETURNS TABLE(engagement_id uuid, person_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE p uuid; g uuid; today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  p := public.current_person_id();
  IF p IS NULL THEN RAISE EXCEPTION 'person-required'; END IF;
  IF EXISTS (SELECT 1 FROM public.institutional_persons ip WHERE ip.id = p AND ip.actor_nature <> 'pessoa-natural') THEN RAISE EXCEPTION 'reference:human-author-required'; END IF;
  IF _on IS NULL THEN RAISE EXCEPTION 'reference:operation-date-required'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(_on) c
   WHERE c.capability_id = _cap AND c.policy_id IS NOT NULL AND c.scope_level = 'rede'
     AND EXISTS (SELECT 1 FROM public.effective_scope_capabilities(today) n WHERE n.capability_id = _cap AND n.policy_id IS NOT NULL
                 AND n.scope_level = 'rede' AND n.engagement_id = c.engagement_id)
   ORDER BY c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _cap; END IF;
  RETURN QUERY SELECT g, p;
END $fn$;
REVOKE ALL ON FUNCTION public.reference_actor(text, date) FROM PUBLIC, anon, authenticated, service_role;

-- ===== Escritores 0068 aposentados (usavam CURRENT_DATE e capacidade única) =====
CREATE OR REPLACE FUNCTION public.reference_grant() RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN RAISE EXCEPTION 'reference:writer-retired'; END $fn$;
CREATE OR REPLACE FUNCTION public.record_curricular_reference_edition(_source_id text, _source_label text, _authority text, _edition_label text,
  _published_on date, _valid_from date, _source_sha256 text, _source_ref text, _expected_head uuid, _items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$ BEGIN RAISE EXCEPTION 'reference:writer-retired'; END $fn$;
CREATE OR REPLACE FUNCTION public.record_curricular_reference_relation(_from uuid, _to uuid, _nature text, _confidence text, _provenance text, _revokes uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$ BEGIN RAISE EXCEPTION 'reference:writer-retired'; END $fn$;
CREATE OR REPLACE FUNCTION public.record_curricular_reference_simplification(_item uuid, _expected_head uuid, _text text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$ BEGIN RAISE EXCEPTION 'reference:writer-retired'; END $fn$;
REVOKE ALL ON FUNCTION public.record_curricular_reference_edition(text,text,text,text,date,date,text,text,uuid,jsonb),
  public.record_curricular_reference_relation(uuid,uuid,text,text,text,uuid,text),
  public.record_curricular_reference_simplification(uuid,uuid,text,text) FROM PUBLIC, anon, service_role;

-- ===== Y.2 Edição (contrato v2) =====
CREATE FUNCTION public.record_curricular_reference_edition_v2(_source_id text, _source_label text, _authority text, _edition_label text,
  _published_on date, _valid_from date, _source_sha256 text, _source_ref text, _expected_head uuid, _declared_item_count integer, _items jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE a record; head uuid; ed uuid; it record; item uuid; b jsonb; n int; reached int; existing uuid; bad text;
BEGIN
  SELECT * INTO a FROM public.reference_actor('construir-referencia-curricular', _valid_from);
  IF _source_sha256 IS NULL OR _source_sha256 !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'reference:sha256-invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('ref:' || coalesce(_source_id,'')));
  SELECT e.id INTO existing FROM public.curricular_reference_editions e WHERE e.source_id = _source_id AND e.source_sha256 = _source_sha256;
  IF existing IS NOT NULL THEN RETURN jsonb_build_object('id', existing, 'idempotent', true); END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'reference:items-required'; END IF;
  IF _declared_item_count IS NULL OR _declared_item_count <> jsonb_array_length(_items) THEN RAISE EXCEPTION 'reference:item-count-mismatch'; END IF;
  SELECT e.id INTO head FROM public.curricular_reference_editions e
   WHERE e.source_id = _source_id AND NOT EXISTS (SELECT 1 FROM public.curricular_reference_editions s WHERE s.supersedes_id = e.id);
  IF head IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'reference:stale-head'; END IF;

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

  INSERT INTO public.curricular_reference_editions(source_id, source_label, authority, edition_label, published_on, valid_from,
    source_sha256, source_ref, supersedes_id, item_count, recorded_by, recorded_engagement, recorded_by_person_id, declared_item_count, contract_schema)
  VALUES (_source_id, btrim(_source_label), btrim(_authority), btrim(_edition_label), _published_on, _valid_from,
    _source_sha256, nullif(btrim(_source_ref),''), head, jsonb_array_length(_items), auth.uid(), a.engagement_id, a.person_id, _declared_item_count,
    'sigem.curricular-reference-source.v2')
  RETURNING id INTO ed;
  FOR it IN WITH RECURSIVE t AS (SELECT c.*, 0 AS d FROM pg_temp._cr_items c WHERE c.parent IS NULL
                                 UNION ALL SELECT c.*, t.d + 1 FROM pg_temp._cr_items c JOIN t ON c.parent = t.code)
            SELECT * FROM t ORDER BY d, ord LOOP
    INSERT INTO public.curricular_reference_items(edition_id, code, item_kind, official_text, parent_code, source_labels, source_locator, parent_item_id, ordinal)
    VALUES (ed, it.code, it.kind, it.txt, it.parent, it.labels, it.locator,
      (SELECT i.id FROM public.curricular_reference_items i WHERE i.edition_id = ed AND i.code = it.parent), it.ord)
    RETURNING id INTO item;
    FOR b IN SELECT * FROM jsonb_array_elements(it.bindings) LOOP
      IF NOT public.attribute_value_homologated(b->>'scheme_id', b->>'value_id', (b->>'value_version')::integer, _valid_from) THEN
        RAISE EXCEPTION 'reference:binding-unknown:%:%/%', it.code, b->>'scheme_id', b->>'value_id'; END IF;
      INSERT INTO public.curricular_reference_item_bindings(item_id, scheme_id, value_id, value_version)
      VALUES (item, b->>'scheme_id', b->>'value_id', (b->>'value_version')::integer);
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('id', ed, 'supersedes_id', head, 'idempotent', false);
END $fn$;

-- ===== Y.5 Simplificação =====
CREATE FUNCTION public.record_curricular_reference_simplification_v2(_item uuid, _expected_head uuid, _text text, _reason text, _effective_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE a record; head record; r uuid;
BEGIN
  SELECT * INTO a FROM public.reference_actor('manter-simplificacoes-curriculares', _effective_on);
  IF NOT EXISTS (SELECT 1 FROM public.curricular_reference_items WHERE id = _item) THEN RAISE EXCEPTION 'reference:item-not-found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('refs:' || _item::text));
  SELECT id, version_no INTO head FROM public.curricular_reference_simplifications WHERE item_id = _item ORDER BY version_no DESC LIMIT 1;
  IF head.id IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'reference:stale-head'; END IF;
  INSERT INTO public.curricular_reference_simplifications(item_id, version_no, supersedes_id, simplified_text, reason, recorded_by, recorded_engagement, recorded_by_person_id)
  VALUES (_item, coalesce(head.version_no, 0) + 1, head.id, btrim(_text), nullif(btrim(_reason),''), auth.uid(), a.engagement_id, a.person_id) RETURNING id INTO r;
  RETURN r;
END $fn$;

CREATE FUNCTION public.record_curricular_reference_keywords(_item uuid, _expected_head uuid, _terms text[], _reason text, _effective_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE a record; head record; r uuid; clean text[];
BEGIN
  SELECT * INTO a FROM public.reference_actor('manter-simplificacoes-curriculares', _effective_on);
  IF NOT EXISTS (SELECT 1 FROM public.curricular_reference_items WHERE id = _item) THEN RAISE EXCEPTION 'reference:item-not-found'; END IF;
  SELECT array_agg(DISTINCT btrim(t)) INTO clean FROM unnest(coalesce(_terms, ARRAY[]::text[])) t WHERE length(btrim(t)) BETWEEN 2 AND 80;
  IF clean IS NULL THEN RAISE EXCEPTION 'reference:terms-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('refk:' || _item::text));
  SELECT id, version_no INTO head FROM public.curricular_reference_keyword_versions WHERE item_id = _item ORDER BY version_no DESC LIMIT 1;
  IF head.id IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'reference:stale-head'; END IF;
  INSERT INTO public.curricular_reference_keyword_versions(item_id, version_no, supersedes_id, terms, reason, recorded_by, recorded_by_person_id, recorded_engagement)
  VALUES (_item, coalesce(head.version_no, 0) + 1, head.id, clean, nullif(btrim(_reason),''), auth.uid(), a.person_id, a.engagement_id) RETURNING id INTO r;
  RETURN r;
END $fn$;

CREATE FUNCTION public.record_curricular_reference_glossary_term(_term_key text, _expected_head uuid, _term text, _definition text, _origin text,
  _edition uuid, _item uuid, _locator text, _reason text, _effective_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE a record; head record; r uuid;
BEGIN
  SELECT * INTO a FROM public.reference_actor(CASE WHEN _origin = 'oficial-da-fonte' THEN 'construir-referencia-curricular' ELSE 'manter-simplificacoes-curriculares' END, _effective_on);
  IF NOT EXISTS (SELECT 1 FROM public.curricular_reference_editions WHERE id = _edition) THEN RAISE EXCEPTION 'reference:edition-not-found'; END IF;
  IF _item IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.curricular_reference_items WHERE id = _item AND edition_id = _edition) THEN RAISE EXCEPTION 'reference:item-not-in-edition'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('refg:' || coalesce(_term_key,'')));
  SELECT id, version_no INTO head FROM public.curricular_reference_glossary_versions WHERE term_key = _term_key ORDER BY version_no DESC LIMIT 1;
  IF head.id IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'reference:stale-head'; END IF;
  INSERT INTO public.curricular_reference_glossary_versions(term_key, version_no, supersedes_id, term, definition, definition_origin, edition_id, item_id, source_locator,
    reason, recorded_by, recorded_by_person_id, recorded_engagement)
  VALUES (_term_key, coalesce(head.version_no, 0) + 1, head.id, btrim(_term), btrim(_definition), _origin, _edition, _item, nullif(btrim(_locator),''),
    nullif(btrim(_reason),''), auth.uid(), a.person_id, a.engagement_id) RETURNING id INTO r;
  RETURN r;
END $fn$;

-- ===== Y.4 Relações N:N e ausência de correspondência =====
CREATE FUNCTION public.record_curricular_reference_relation_v2(_from uuid, _to uuid, _origin text, _nature text, _direction text,
  _justification text, _criteria jsonb, _official_locator text, _effective_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE a record; r uuid; src text;
BEGIN
  SELECT * INTO a FROM public.reference_actor('manter-mapeamentos-curriculares', _effective_on);
  IF NOT EXISTS (SELECT 1 FROM public.curricular_reference_items WHERE id = _from) OR NOT EXISTS (SELECT 1 FROM public.curricular_reference_items WHERE id = _to) THEN
    RAISE EXCEPTION 'reference:item-not-found'; END IF;
  IF _criteria IS NOT NULL AND (jsonb_typeof(_criteria) <> 'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(_criteria) k
       WHERE k NOT IN ('objeto-conhecimento','operacao-cognitiva','conhecimentos-mobilizados','contexto','complexidade'))) THEN
    RAISE EXCEPTION 'reference:criteria-invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('refr:' || least(_from::text, _to::text) || greatest(_from::text, _to::text)));
  IF EXISTS (SELECT 1 FROM public.curricular_reference_relations x WHERE x.revokes_id IS NULL AND x.from_item_id = _from AND x.to_item_id = _to
       AND x.origin = _origin AND NOT EXISTS (SELECT 1 FROM public.curricular_reference_relations v WHERE v.revokes_id = x.id)) THEN
    RAISE EXCEPTION 'reference:relation-already-active'; END IF;
  SELECT e.source_id INTO src FROM public.curricular_reference_items i JOIN public.curricular_reference_editions e ON e.id = i.edition_id WHERE i.id = _to;
  IF EXISTS (SELECT 1 FROM public.curricular_reference_correspondence_assessments c WHERE c.item_id = _from AND c.target_source_id = src
       AND NOT c.withdrawn AND NOT EXISTS (SELECT 1 FROM public.curricular_reference_correspondence_assessments s WHERE s.supersedes_id = c.id)) THEN
    RAISE EXCEPTION 'reference:conflicts-with-no-correspondence'; END IF;
  INSERT INTO public.curricular_reference_relations(from_item_id, to_item_id, nature, confidence, provenance, origin, direction, justification, criteria,
    official_locator, recorded_by, recorded_engagement, recorded_by_person_id)
  VALUES (_from, _to, _nature, 'nao-aplicavel', CASE WHEN _origin = 'oficial-da-fonte' THEN coalesce(nullif(btrim(_official_locator),''), 'fonte') ELSE 'editorial-sigem' END,
    _origin, _direction, btrim(_justification), _criteria, nullif(btrim(_official_locator),''), auth.uid(), a.engagement_id, a.person_id) RETURNING id INTO r;
  RETURN r;
END $fn$;

CREATE FUNCTION public.revoke_curricular_reference_relation(_relation uuid, _reason text, _effective_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE a record; t record; r uuid;
BEGIN
  SELECT * INTO a FROM public.reference_actor('manter-mapeamentos-curriculares', _effective_on);
  SELECT * INTO t FROM public.curricular_reference_relations WHERE id = _relation;
  IF t.id IS NULL THEN RAISE EXCEPTION 'reference:relation-not-found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('refrv:' || _relation::text));
  INSERT INTO public.curricular_reference_relations(from_item_id, to_item_id, nature, confidence, provenance, origin, direction, justification,
    revokes_id, reason, recorded_by, recorded_engagement, recorded_by_person_id)
  VALUES (t.from_item_id, t.to_item_id, t.nature, t.confidence, t.provenance, t.origin, t.direction, t.justification,
    _relation, btrim(_reason), auth.uid(), a.engagement_id, a.person_id) RETURNING id INTO r;
  RETURN r;
END $fn$;

CREATE FUNCTION public.record_curricular_reference_no_correspondence(_item uuid, _target_source_id text, _expected_head uuid, _justification text,
  _criteria jsonb, _withdrawn boolean, _reason text, _effective_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE a record; head record; r uuid;
BEGIN
  SELECT * INTO a FROM public.reference_actor('manter-mapeamentos-curriculares', _effective_on);
  IF NOT EXISTS (SELECT 1 FROM public.curricular_reference_items WHERE id = _item) THEN RAISE EXCEPTION 'reference:item-not-found'; END IF;
  IF _criteria IS NOT NULL AND (jsonb_typeof(_criteria) <> 'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(_criteria) k
       WHERE k NOT IN ('objeto-conhecimento','operacao-cognitiva','conhecimentos-mobilizados','contexto','complexidade'))) THEN
    RAISE EXCEPTION 'reference:criteria-invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('refnc:' || _item::text || coalesce(_target_source_id,'')));
  SELECT id, version_no INTO head FROM public.curricular_reference_correspondence_assessments
   WHERE item_id = _item AND target_source_id = _target_source_id ORDER BY version_no DESC LIMIT 1;
  IF head.id IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'reference:stale-head'; END IF;
  IF NOT coalesce(_withdrawn, false) AND EXISTS (SELECT 1 FROM public.curricular_reference_relations x
       JOIN public.curricular_reference_items i ON i.id = x.to_item_id JOIN public.curricular_reference_editions e ON e.id = i.edition_id
      WHERE x.from_item_id = _item AND x.revokes_id IS NULL AND e.source_id = _target_source_id
        AND NOT EXISTS (SELECT 1 FROM public.curricular_reference_relations v WHERE v.revokes_id = x.id)) THEN
    RAISE EXCEPTION 'reference:conflicts-with-active-relation'; END IF;
  INSERT INTO public.curricular_reference_correspondence_assessments(item_id, target_source_id, version_no, supersedes_id, conclusion, withdrawn,
    justification, criteria, reason, recorded_by, recorded_by_person_id, recorded_engagement)
  VALUES (_item, _target_source_id, coalesce(head.version_no, 0) + 1, head.id, 'sem-correspondencia-identificada', coalesce(_withdrawn, false),
    btrim(_justification), coalesce(_criteria, '{}'::jsonb), nullif(btrim(_reason),''), auth.uid(), a.person_id, a.engagement_id) RETURNING id INTO r;
  RETURN r;
END $fn$;

-- ===== Y.1 Homologação: pessoa distinta da autora, cadeia por alvo =====
CREATE FUNCTION public.homologate_curricular_reference(_target_kind text, _target_id uuid, _decision text, _expected_head uuid, _reason text, _effective_on date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE a record; author uuid; head record; r uuid; cap text;
BEGIN
  cap := CASE _target_kind WHEN 'edicao' THEN 'homologar-referencia-curricular'
    WHEN 'relacao' THEN 'homologar-mapeamentos-curriculares' WHEN 'avaliacao-correspondencia' THEN 'homologar-mapeamentos-curriculares'
    WHEN 'simplificacao' THEN 'homologar-simplificacoes-curriculares' WHEN 'palavras-chave' THEN 'homologar-simplificacoes-curriculares'
    WHEN 'glossario' THEN 'homologar-simplificacoes-curriculares' END;
  IF cap IS NULL THEN RAISE EXCEPTION 'reference:target-kind-invalid'; END IF;
  SELECT * INTO a FROM public.reference_actor(cap, _effective_on);
  author := CASE _target_kind
    WHEN 'edicao' THEN (SELECT recorded_by_person_id FROM public.curricular_reference_editions WHERE id = _target_id)
    WHEN 'relacao' THEN (SELECT recorded_by_person_id FROM public.curricular_reference_relations WHERE id = _target_id AND revokes_id IS NULL)
    WHEN 'avaliacao-correspondencia' THEN (SELECT recorded_by_person_id FROM public.curricular_reference_correspondence_assessments WHERE id = _target_id)
    WHEN 'simplificacao' THEN (SELECT recorded_by_person_id FROM public.curricular_reference_simplifications WHERE id = _target_id)
    WHEN 'palavras-chave' THEN (SELECT recorded_by_person_id FROM public.curricular_reference_keyword_versions WHERE id = _target_id)
    WHEN 'glossario' THEN (SELECT recorded_by_person_id FROM public.curricular_reference_glossary_versions WHERE id = _target_id) END;
  IF author IS NULL THEN RAISE EXCEPTION 'reference:target-not-found'; END IF;
  IF author = a.person_id THEN RAISE EXCEPTION 'reference:author-cannot-homologate'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('refh:' || _target_kind || _target_id::text));
  SELECT id, sequence, decision INTO head FROM public.curricular_reference_homologations WHERE target_kind = _target_kind AND target_id = _target_id ORDER BY sequence DESC LIMIT 1;
  IF head.id IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'reference:stale-head'; END IF;
  IF head.decision IS NOT DISTINCT FROM _decision OR (head.id IS NULL AND _decision <> 'homologada') THEN RAISE EXCEPTION 'reference:homologation-transition-invalid'; END IF;
  INSERT INTO public.curricular_reference_homologations(target_kind, target_id, sequence, predecessor_id, decision, reason, recorded_by, recorded_by_person_id, recorded_engagement)
  VALUES (_target_kind, _target_id, coalesce(head.sequence, 0) + 1, head.id, _decision, nullif(btrim(_reason),''), auth.uid(), a.person_id, a.engagement_id) RETURNING id INTO r;
  RETURN r;
END $fn$;

DO $acl$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.record_curricular_reference_edition_v2(text,text,text,text,date,date,text,text,uuid,integer,jsonb)',
    'public.record_curricular_reference_simplification_v2(uuid,uuid,text,text,date)',
    'public.record_curricular_reference_keywords(uuid,uuid,text[],text,date)',
    'public.record_curricular_reference_glossary_term(text,uuid,text,text,text,uuid,uuid,text,text,date)',
    'public.record_curricular_reference_relation_v2(uuid,uuid,text,text,text,text,jsonb,text,date)',
    'public.revoke_curricular_reference_relation(uuid,text,date)',
    'public.record_curricular_reference_no_correspondence(uuid,text,uuid,text,jsonb,boolean,text,date)',
    'public.homologate_curricular_reference(text,uuid,text,uuid,text,date)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, service_role', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $acl$;

-- ===== Y.7 Readers estáveis (SECURITY INVOKER, RLS de quem lê, knownAt explícito) =====
CREATE FUNCTION public.curricular_reference_homologation_state(_kind text, _id uuid, _known_at timestamptz) RETURNS text
LANGUAGE sql STABLE SET search_path TO '' AS $$
  SELECT coalesce((SELECT h.decision FROM public.curricular_reference_homologations h WHERE h.target_kind = _kind AND h.target_id = _id
    AND h.recorded_at <= _known_at ORDER BY h.sequence DESC LIMIT 1), 'nao-homologada')
$$;

CREATE FUNCTION public.curricular_reference_fold(_t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT lower(translate(coalesce(_t,''), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc'))
$$;

CREATE FUNCTION public.curricular_reference_item_at(_item uuid, _known_at timestamptz)
RETURNS TABLE(result_kind text, item_id uuid, code text, item_kind text, official_text text, parent_item_id uuid, source_labels jsonb, source_locator text,
  edition_id uuid, source_id text, source_label text, authority text, edition_label text, published_on date, valid_from date, source_sha256 text, source_ref text,
  edition_state text, edition_homologation text, simplification_id uuid, simplification_version integer, simplified_text text, simplification_homologation text,
  keyword_version_id uuid, keyword_terms text[], keywords_homologation text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
#variable_conflict use_column
BEGIN
  IF _item IS NULL OR _known_at IS NULL THEN RAISE EXCEPTION 'reference:item-and-known-at-required'; END IF;
  RETURN QUERY
  SELECT 'item'::text, i.id, i.code, i.item_kind, i.official_text, i.parent_item_id, i.source_labels, i.source_locator,
    e.id, e.source_id, e.source_label, e.authority, e.edition_label, e.published_on, e.valid_from, e.source_sha256, e.source_ref,
    CASE WHEN EXISTS (SELECT 1 FROM public.curricular_reference_editions s WHERE s.supersedes_id = e.id AND s.recorded_at <= _known_at) THEN 'substituida' ELSE 'vigente' END,
    public.curricular_reference_homologation_state('edicao', e.id, _known_at),
    s.id, s.version_no, s.simplified_text, CASE WHEN s.id IS NULL THEN NULL ELSE public.curricular_reference_homologation_state('simplificacao', s.id, _known_at) END,
    k.id, k.terms, CASE WHEN k.id IS NULL THEN NULL ELSE public.curricular_reference_homologation_state('palavras-chave', k.id, _known_at) END
  FROM public.curricular_reference_items i JOIN public.curricular_reference_editions e ON e.id = i.edition_id
  LEFT JOIN LATERAL (SELECT * FROM public.curricular_reference_simplifications x WHERE x.item_id = i.id AND x.recorded_at <= _known_at ORDER BY x.version_no DESC LIMIT 1) s ON true
  LEFT JOIN LATERAL (SELECT * FROM public.curricular_reference_keyword_versions x WHERE x.item_id = i.id AND x.recorded_at <= _known_at ORDER BY x.version_no DESC LIMIT 1) k ON true
  WHERE i.id = _item AND e.recorded_at <= _known_at;
  IF NOT FOUND THEN
    RETURN QUERY SELECT 'absent'::text, _item, NULL::text, NULL::text, NULL::text, NULL::uuid, NULL::jsonb, NULL::text, NULL::uuid, NULL::text, NULL::text, NULL::text,
      NULL::text, NULL::date, NULL::date, NULL::text, NULL::text, NULL::text, NULL::text, NULL::uuid, NULL::integer, NULL::text, NULL::text, NULL::uuid, NULL::text[], NULL::text;
  END IF;
END $fn$;

CREATE FUNCTION public.curricular_reference_search(_text text, _source_id text, _edition_id uuid, _item_kind text, _bindings jsonb,
  _only_current boolean, _known_at timestamptz, _limit integer)
RETURNS TABLE(item_id uuid, code text, item_kind text, official_text text, source_locator text, edition_id uuid, source_id text, source_label text, edition_label text,
  simplified_text text, simplification_homologation text, keyword_terms text[], matched_in text[], has_active_relation boolean)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path TO '' AS $fn$
#variable_conflict use_column
DECLARE terms text[];
BEGIN
  IF _known_at IS NULL THEN RAISE EXCEPTION 'reference:known-at-required'; END IF;
  IF _bindings IS NOT NULL AND jsonb_typeof(_bindings) <> 'array' THEN RAISE EXCEPTION 'reference:bindings-invalid'; END IF;
  terms := array_remove(regexp_split_to_array(public.curricular_reference_fold(btrim(coalesce(_text,''))), '\s+'), '');
  RETURN QUERY
  WITH base AS (
    SELECT i.*, e.source_id AS sid, e.source_label AS slabel, e.edition_label AS elabel,
      s.simplified_text AS stext, s.id AS sid2, k.terms AS kterms
    FROM public.curricular_reference_items i JOIN public.curricular_reference_editions e ON e.id = i.edition_id
    LEFT JOIN LATERAL (SELECT * FROM public.curricular_reference_simplifications x WHERE x.item_id = i.id AND x.recorded_at <= _known_at ORDER BY x.version_no DESC LIMIT 1) s ON true
    LEFT JOIN LATERAL (SELECT * FROM public.curricular_reference_keyword_versions x WHERE x.item_id = i.id AND x.recorded_at <= _known_at ORDER BY x.version_no DESC LIMIT 1) k ON true
    WHERE e.recorded_at <= _known_at
      AND (_source_id IS NULL OR e.source_id = _source_id) AND (_edition_id IS NULL OR e.id = _edition_id)
      AND (_item_kind IS NULL OR i.item_kind = _item_kind)
      AND (NOT coalesce(_only_current, true) OR NOT EXISTS (SELECT 1 FROM public.curricular_reference_editions n WHERE n.supersedes_id = e.id AND n.recorded_at <= _known_at))
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(_bindings,'[]'::jsonb)) b
        WHERE NOT EXISTS (SELECT 1 FROM public.curricular_reference_item_bindings x WHERE x.item_id = i.id AND x.scheme_id = b->>'scheme_id' AND x.value_id = b->>'value_id'))
  ), scored AS (
    SELECT b.*, ARRAY_REMOVE(ARRAY[
      CASE WHEN cardinality(terms) > 0 AND (SELECT bool_and(public.curricular_reference_fold(b.code) LIKE '%' || t || '%') FROM unnest(terms) t) THEN 'codigo' END,
      CASE WHEN cardinality(terms) > 0 AND (SELECT bool_and(public.curricular_reference_fold(b.official_text) LIKE '%' || t || '%') FROM unnest(terms) t) THEN 'texto-oficial' END,
      CASE WHEN cardinality(terms) > 0 AND b.stext IS NOT NULL AND (SELECT bool_and(public.curricular_reference_fold(b.stext) LIKE '%' || t || '%') FROM unnest(terms) t) THEN 'simplificacao' END,
      CASE WHEN cardinality(terms) > 0 AND b.kterms IS NOT NULL AND (SELECT bool_and(public.curricular_reference_fold(array_to_string(b.kterms,' ')) LIKE '%' || t || '%') FROM unnest(terms) t) THEN 'palavra-chave' END
    ], NULL) AS m FROM base b
  )
  SELECT s.id, s.code, s.item_kind, s.official_text, s.source_locator, s.edition_id, s.sid, s.slabel, s.elabel, s.stext,
    CASE WHEN s.sid2 IS NULL THEN NULL ELSE public.curricular_reference_homologation_state('simplificacao', s.sid2, _known_at) END, s.kterms, s.m,
    EXISTS (SELECT 1 FROM public.curricular_reference_relations r WHERE r.revokes_id IS NULL AND (r.from_item_id = s.id OR r.to_item_id = s.id) AND r.recorded_at <= _known_at
      AND NOT EXISTS (SELECT 1 FROM public.curricular_reference_relations v WHERE v.revokes_id = r.id AND v.recorded_at <= _known_at))
  FROM scored s WHERE cardinality(terms) = 0 OR cardinality(s.m) > 0
  ORDER BY s.sid, s.code LIMIT least(greatest(coalesce(_limit, 50), 1), 500);
END $fn$;

CREATE FUNCTION public.curricular_reference_relations_at(_item uuid, _known_at timestamptz)
RETURNS TABLE(relation_id uuid, direction text, other_item_id uuid, other_code text, other_source_id text, other_edition_label text, origin text, nature text,
  relation_direction text, justification text, criteria jsonb, official_locator text, homologation text, recorded_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $$
  SELECT r.id, CASE WHEN r.from_item_id = _item THEN 'saida' ELSE 'entrada' END, o.id, o.code, e.source_id, e.edition_label, r.origin, r.nature,
    r.direction, r.justification, r.criteria, r.official_locator, public.curricular_reference_homologation_state('relacao', r.id, _known_at), r.recorded_at
  FROM public.curricular_reference_relations r
  JOIN public.curricular_reference_items o ON o.id = CASE WHEN r.from_item_id = _item THEN r.to_item_id ELSE r.from_item_id END
  JOIN public.curricular_reference_editions e ON e.id = o.edition_id
  WHERE (r.from_item_id = _item OR r.to_item_id = _item) AND r.revokes_id IS NULL AND r.recorded_at <= _known_at
    AND NOT EXISTS (SELECT 1 FROM public.curricular_reference_relations v WHERE v.revokes_id = r.id AND v.recorded_at <= _known_at)
  ORDER BY r.origin, e.source_id, o.code
$$;

CREATE FUNCTION public.curricular_reference_no_correspondence_at(_item uuid, _known_at timestamptz)
RETURNS TABLE(assessment_id uuid, target_source_id text, version_no integer, justification text, criteria jsonb, homologation text, recorded_at timestamptz)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $$
  SELECT c.id, c.target_source_id, c.version_no, c.justification, c.criteria,
    public.curricular_reference_homologation_state('avaliacao-correspondencia', c.id, _known_at), c.recorded_at
  FROM public.curricular_reference_correspondence_assessments c
  WHERE c.item_id = _item AND c.recorded_at <= _known_at AND NOT c.withdrawn
    AND NOT EXISTS (SELECT 1 FROM public.curricular_reference_correspondence_assessments s WHERE s.supersedes_id = c.id AND s.recorded_at <= _known_at)
$$;

CREATE FUNCTION public.curricular_reference_children(_edition uuid, _parent uuid)
RETURNS TABLE(item_id uuid, code text, item_kind text, official_text text, source_labels jsonb, source_locator text, has_children boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $$
  SELECT i.id, i.code, i.item_kind, i.official_text, i.source_labels, i.source_locator,
    EXISTS (SELECT 1 FROM public.curricular_reference_items c WHERE c.parent_item_id = i.id)
  FROM public.curricular_reference_items i
  WHERE i.edition_id = _edition AND i.parent_item_id IS NOT DISTINCT FROM _parent
  ORDER BY i.ordinal NULLS LAST, i.code
$$;

CREATE FUNCTION public.curricular_reference_glossary_at(_text text, _known_at timestamptz)
RETURNS TABLE(term_key text, version_no integer, term text, definition text, definition_origin text, edition_id uuid, edition_label text, source_id text,
  item_id uuid, source_locator text, homologation text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path TO '' AS $$
  SELECT g.term_key, g.version_no, g.term, g.definition, g.definition_origin, g.edition_id, e.edition_label, e.source_id, g.item_id, g.source_locator,
    public.curricular_reference_homologation_state('glossario', g.id, _known_at)
  FROM public.curricular_reference_glossary_versions g JOIN public.curricular_reference_editions e ON e.id = g.edition_id
  WHERE g.recorded_at <= _known_at
    AND NOT EXISTS (SELECT 1 FROM public.curricular_reference_glossary_versions s WHERE s.supersedes_id = g.id AND s.recorded_at <= _known_at)
    AND (coalesce(btrim(_text),'') = '' OR public.curricular_reference_fold(g.term || ' ' || g.definition) LIKE '%' || public.curricular_reference_fold(btrim(_text)) || '%')
  ORDER BY g.term
$$;

DO $acl$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.curricular_reference_homologation_state(text,uuid,timestamptz)', 'public.curricular_reference_fold(text)',
    'public.curricular_reference_item_at(uuid,timestamptz)', 'public.curricular_reference_search(text,text,uuid,text,jsonb,boolean,timestamptz,integer)',
    'public.curricular_reference_relations_at(uuid,timestamptz)', 'public.curricular_reference_no_correspondence_at(uuid,timestamptz)',
    'public.curricular_reference_children(uuid,uuid)', 'public.curricular_reference_glossary_at(text,timestamptz)'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, service_role', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $acl$;
