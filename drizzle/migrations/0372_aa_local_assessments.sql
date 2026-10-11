-- A&A Lote 13: Diagnóstica, Formativa, Simula SAEB e Produção Textual (instrumentos locais versionados).
CREATE TABLE public.lc_instrument_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL DEFAULT gen_random_uuid(), version int NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.lc_instrument_versions(id),
  program_key text NOT NULL CHECK (program_key IN ('diagnostica','formativa','simula-saeb','producao-textual')),
  edition_year int NOT NULL CHECK (edition_year BETWEEN 2020 AND 2100),
  round_label text NOT NULL CHECK (length(btrim(round_label)) >= 1),
  grade text NOT NULL CHECK (grade IN ('1','2','3','4','5','6','7','8','9','TEC')),
  area text NOT NULL CHECK (area IN ('LP','MAT')),
  matrix_ref text NOT NULL CHECK (length(btrim(matrix_ref)) >= 3),
  items jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(items) = 'array'),
  criteria jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(criteria) = 'array'),
  general_formula jsonb CHECK (general_formula IS NULL OR jsonb_typeof(general_formula) = 'object'),
  source_ref text NOT NULL CHECK (length(btrim(source_ref)) >= 3),
  reason text, author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (program_key <> 'simula-saeb' OR grade IN ('4','8')),
  CHECK (program_key <> 'producao-textual' OR (grade IN ('3','4','5','6','7','8','9','TEC') AND area = 'LP' AND jsonb_array_length(criteria) = 3 AND jsonb_array_length(items) = 0)),
  CHECK (program_key = 'producao-textual' OR (jsonb_array_length(items) >= 1 AND jsonb_array_length(criteria) = 0 AND general_formula IS NULL)),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) >= 5)));
COMMENT ON TABLE public.lc_instrument_versions IS 'A&A Lote 13: itens {n, ref_kind bncc|descritor, ref_code, scoring binario|rubrica, max}; Produção Textual com 3 critérios {key,label,max} e fórmula geral só se configurada e homologada.';

CREATE TABLE public.lc_instrument_homologations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_version_id uuid NOT NULL REFERENCES public.lc_instrument_versions(id),
  decision text NOT NULL CHECK (decision IN ('homologado','revogado')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.lc_entry_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL DEFAULT gen_random_uuid(), version int NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.lc_entry_versions(id),
  instrument_version_id uuid NOT NULL REFERENCES public.lc_instrument_versions(id),
  school_id text NOT NULL, class_id text NOT NULL, student_id text NOT NULL,
  presence text NOT NULL CHECK (presence IN ('presente','ausente','nao-registrado')),
  results jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(results) = 'object'),
  reason text, author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (presence = 'presente' OR results = '{}'::jsonb),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) >= 5)));
CREATE UNIQUE INDEX lc_entry_v1_unique ON public.lc_entry_versions(instrument_version_id, student_id, class_id) WHERE version = 1;
CREATE INDEX lc_entry_school_idx ON public.lc_entry_versions(school_id, instrument_version_id);

CREATE TABLE public.lc_entry_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_version_id uuid NOT NULL REFERENCES public.lc_entry_versions(id),
  school_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('conferido','devolvido','homologado')),
  note text, author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (decision <> 'devolvido' OR length(btrim(coalesce(note,''))) >= 5));

GRANT SELECT ON public.lc_instrument_versions, public.lc_instrument_homologations, public.lc_entry_versions, public.lc_entry_reviews TO authenticated;
GRANT ALL ON public.lc_instrument_versions, public.lc_instrument_homologations, public.lc_entry_versions, public.lc_entry_reviews TO service_role;
ALTER TABLE public.lc_instrument_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lc_instrument_homologations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lc_entry_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lc_entry_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY lc_inst_read ON public.lc_instrument_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY lc_hom_read ON public.lc_instrument_homologations FOR SELECT TO authenticated USING (true);
CREATE POLICY lc_entry_read ON public.lc_entry_versions FOR SELECT TO authenticated USING (
  public.has_network_capability('acompanhar-avaliacao-local')
  OR public.has_school_capability('acompanhar-avaliacao-local', school_id)
  OR public.has_school_capability('lancar-avaliacao-local', school_id)
  OR public.has_school_capability('homologar-avaliacao-local', school_id));
CREATE POLICY lc_rev_read ON public.lc_entry_reviews FOR SELECT TO authenticated USING (
  public.has_network_capability('acompanhar-avaliacao-local')
  OR public.has_school_capability('acompanhar-avaliacao-local', school_id)
  OR public.has_school_capability('lancar-avaliacao-local', school_id)
  OR public.has_school_capability('homologar-avaliacao-local', school_id));

CREATE FUNCTION public.lc_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'avaliacao-local:append-only'; END $$;
CREATE TRIGGER lc_inst_ro BEFORE UPDATE OR DELETE ON public.lc_instrument_versions FOR EACH ROW EXECUTE FUNCTION public.lc_append_only();
CREATE TRIGGER lc_hom_ro BEFORE UPDATE OR DELETE ON public.lc_instrument_homologations FOR EACH ROW EXECUTE FUNCTION public.lc_append_only();
CREATE TRIGGER lc_entry_ro BEFORE UPDATE OR DELETE ON public.lc_entry_versions FOR EACH ROW EXECUTE FUNCTION public.lc_append_only();
CREATE TRIGGER lc_rev_ro BEFORE UPDATE OR DELETE ON public.lc_entry_reviews FOR EACH ROW EXECUTE FUNCTION public.lc_append_only();

CREATE FUNCTION public.lc_record_instrument(_logical uuid, _expected_version int, _program text, _year int, _round text, _grade text, _area text,
  _matrix text, _items jsonb, _criteria jsonb, _formula jsonb, _source text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE b public.lc_instrument_versions; nid uuid; it jsonb; seen int[] := '{}'; n int; lid uuid := coalesce(_logical, gen_random_uuid()); k text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'avaliacao-local:unauthenticated'; END IF;
  IF NOT public.has_network_capability('manter-instrumento-avaliacao-local') THEN RAISE EXCEPTION 'avaliacao-local:forbidden'; END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(_items,'[]'::jsonb)) LOOP
    n := (it->>'n')::int;
    IF n IS NULL OR n < 1 OR n = ANY(seen) THEN RAISE EXCEPTION 'avaliacao-local:item-number-invalid'; END IF; seen := seen || n;
    IF coalesce(it->>'ref_kind','') NOT IN ('bncc','descritor') OR length(btrim(coalesce(it->>'ref_code',''))) = 0 THEN RAISE EXCEPTION 'avaliacao-local:item-ref-required'; END IF;
    IF _program = 'simula-saeb' AND it->>'ref_kind' <> 'descritor' THEN RAISE EXCEPTION 'avaliacao-local:simula-requires-descriptor'; END IF;
    IF coalesce(it->>'scoring','') NOT IN ('binario','rubrica') THEN RAISE EXCEPTION 'avaliacao-local:scoring-required'; END IF;
    IF it->>'scoring' = 'rubrica' AND coalesce((it->>'max')::numeric, 0) <= 0 THEN RAISE EXCEPTION 'avaliacao-local:rubric-max-required'; END IF;
  END LOOP;
  FOR it IN SELECT * FROM jsonb_array_elements(coalesce(_criteria,'[]'::jsonb)) LOOP
    IF length(btrim(coalesce(it->>'key',''))) = 0 OR length(btrim(coalesce(it->>'label',''))) = 0 OR coalesce((it->>'max')::numeric,0) <= 0 THEN RAISE EXCEPTION 'avaliacao-local:criterion-invalid'; END IF;
  END LOOP;
  IF _formula IS NOT NULL THEN
    IF _formula->>'kind' IS DISTINCT FROM 'soma-ponderada' OR jsonb_typeof(_formula->'weights') <> 'object' OR length(btrim(coalesce(_formula->>'source',''))) < 3 THEN RAISE EXCEPTION 'avaliacao-local:formula-invalid'; END IF;
    FOR it IN SELECT * FROM jsonb_array_elements(coalesce(_criteria,'[]'::jsonb)) LOOP
      k := it->>'key'; IF NOT (_formula->'weights' ? k) THEN RAISE EXCEPTION 'avaliacao-local:formula-weight-missing'; END IF;
    END LOOP;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('lcinst' || lid::text));
  SELECT * INTO b FROM public.lc_instrument_versions WHERE logical_id = lid ORDER BY version DESC LIMIT 1;
  IF coalesce(b.version,0) <> coalesce(_expected_version,0) THEN RAISE EXCEPTION 'avaliacao-local:stale-base'; END IF;
  INSERT INTO public.lc_instrument_versions(logical_id, version, supersedes_id, program_key, edition_year, round_label, grade, area, matrix_ref, items, criteria, general_formula, source_ref, reason, author_user_id)
  VALUES (lid, coalesce(b.version,0)+1, b.id, _program, _year, btrim(_round), _grade, _area, btrim(_matrix), coalesce(_items,'[]'::jsonb), coalesce(_criteria,'[]'::jsonb), _formula, btrim(_source), nullif(btrim(_reason),''), auth.uid())
  RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE FUNCTION public.lc_homologate_instrument(_version uuid, _decision text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.lc_instrument_versions; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'avaliacao-local:unauthenticated'; END IF;
  IF NOT public.has_network_capability('homologar-instrumento-avaliacao-local') THEN RAISE EXCEPTION 'avaliacao-local:forbidden'; END IF;
  SELECT * INTO v FROM public.lc_instrument_versions WHERE id = _version;
  IF v.id IS NULL THEN RAISE EXCEPTION 'avaliacao-local:not-found'; END IF;
  IF v.author_user_id = auth.uid() THEN RAISE EXCEPTION 'avaliacao-local:self-homologation'; END IF;
  INSERT INTO public.lc_instrument_homologations(instrument_version_id, decision, reason, author_user_id) VALUES (_version, _decision, btrim(_reason), auth.uid()) RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE FUNCTION public.lc_instrument_is_homologated(_version uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce((SELECT decision = 'homologado' FROM public.lc_instrument_homologations WHERE instrument_version_id = _version ORDER BY recorded_at DESC, id DESC LIMIT 1), false)
$$;

-- results: chave = número do item ou chave do critério; valor numérico (0/1 binário; 0..max rubrica) ou "nao-aplicado". Ausência de chave = não registrado.
CREATE FUNCTION public.lc_record_entry(_logical uuid, _expected_version int, _instrument uuid, _school text, _class text, _student text,
  _presence text, _results jsonb, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE b public.lc_entry_versions; i public.lc_instrument_versions; nid uuid; k text; val jsonb; def jsonb; mx numeric; lid uuid := coalesce(_logical, gen_random_uuid());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'avaliacao-local:unauthenticated'; END IF;
  IF NOT public.has_school_capability('lancar-avaliacao-local', _school) THEN RAISE EXCEPTION 'avaliacao-local:forbidden'; END IF;
  SELECT * INTO i FROM public.lc_instrument_versions WHERE id = _instrument;
  IF i.id IS NULL OR NOT public.lc_instrument_is_homologated(_instrument) THEN RAISE EXCEPTION 'avaliacao-local:instrument-not-homologated'; END IF;
  FOR k, val IN SELECT key, value FROM jsonb_each(coalesce(_results,'{}'::jsonb)) LOOP
    SELECT x INTO def FROM jsonb_array_elements(CASE WHEN i.program_key = 'producao-textual' THEN i.criteria ELSE i.items END) x
      WHERE (x->>'n') = k OR (x->>'key') = k LIMIT 1;
    IF def IS NULL THEN RAISE EXCEPTION 'avaliacao-local:result-key-unknown'; END IF;
    IF jsonb_typeof(val) = 'string' AND val #>> '{}' = 'nao-aplicado' THEN CONTINUE; END IF;
    IF jsonb_typeof(val) <> 'number' THEN RAISE EXCEPTION 'avaliacao-local:result-value-invalid'; END IF;
    mx := CASE WHEN def->>'scoring' = 'binario' THEN 1 ELSE (def->>'max')::numeric END;
    IF (val #>> '{}')::numeric < 0 OR (val #>> '{}')::numeric > mx THEN RAISE EXCEPTION 'avaliacao-local:result-out-of-range'; END IF;
    IF def->>'scoring' = 'binario' AND (val #>> '{}')::numeric NOT IN (0,1) THEN RAISE EXCEPTION 'avaliacao-local:binary-only'; END IF;
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtext('lcentry' || lid::text));
  SELECT * INTO b FROM public.lc_entry_versions WHERE logical_id = lid ORDER BY version DESC LIMIT 1;
  IF coalesce(b.version,0) <> coalesce(_expected_version,0) THEN RAISE EXCEPTION 'avaliacao-local:stale-base'; END IF;
  IF b.id IS NOT NULL AND (b.student_id <> _student OR b.instrument_version_id <> _instrument OR b.school_id <> _school) THEN RAISE EXCEPTION 'avaliacao-local:identity-immutable'; END IF;
  INSERT INTO public.lc_entry_versions(logical_id, version, supersedes_id, instrument_version_id, school_id, class_id, student_id, presence, results, reason, author_user_id)
  VALUES (lid, coalesce(b.version,0)+1, b.id, _instrument, _school, _class, _student, _presence,
    CASE WHEN _presence = 'presente' THEN coalesce(_results,'{}'::jsonb) ELSE '{}'::jsonb END, nullif(btrim(_reason),''), auth.uid())
  RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE FUNCTION public.lc_review_entry(_entry_version uuid, _decision text, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.lc_entry_versions; head uuid; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'avaliacao-local:unauthenticated'; END IF;
  SELECT * INTO e FROM public.lc_entry_versions WHERE id = _entry_version;
  IF e.id IS NULL THEN RAISE EXCEPTION 'avaliacao-local:not-found'; END IF;
  IF NOT public.has_school_capability('homologar-avaliacao-local', e.school_id) THEN RAISE EXCEPTION 'avaliacao-local:forbidden'; END IF;
  IF e.author_user_id = auth.uid() THEN RAISE EXCEPTION 'avaliacao-local:self-review'; END IF;
  SELECT id INTO head FROM public.lc_entry_versions WHERE logical_id = e.logical_id ORDER BY version DESC LIMIT 1;
  IF head <> e.id THEN RAISE EXCEPTION 'avaliacao-local:stale-base'; END IF;
  INSERT INTO public.lc_entry_reviews(entry_version_id, school_id, decision, note, author_user_id) VALUES (e.id, e.school_id, _decision, nullif(btrim(_note),''), auth.uid()) RETURNING id INTO nid;
  RETURN nid;
END $$;

REVOKE ALL ON FUNCTION public.lc_record_instrument(uuid,int,text,int,text,text,text,text,jsonb,jsonb,jsonb,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lc_homologate_instrument(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lc_record_entry(uuid,int,uuid,text,text,text,text,jsonb,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lc_review_entry(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lc_record_instrument(uuid,int,text,int,text,text,text,text,jsonb,jsonb,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lc_homologate_instrument(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lc_record_entry(uuid,int,uuid,text,text,text,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lc_review_entry(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lc_instrument_is_homologated(uuid) TO authenticated;
