-- A&A Lote 12: Saber Ler. Instrumento (rodada) configurável, lançamento por estudante versionado, revisão/homologação por pessoa distinta.
CREATE TABLE public.sl_instrument_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL DEFAULT gen_random_uuid(), version int NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.sl_instrument_versions(id),
  edition_year int NOT NULL CHECK (edition_year BETWEEN 2020 AND 2100),
  grade int NOT NULL CHECK (grade IN (1,2)),
  week int NOT NULL CHECK (week BETWEEN 1 AND 60),
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) BETWEEN 1 AND 200),
  writing_stages jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(writing_stages) = 'array'),
  percent_bands jsonb CHECK (percent_bands IS NULL OR jsonb_typeof(percent_bands) = 'array'),
  source_ref text NOT NULL CHECK (length(btrim(source_ref)) >= 3),
  reason text, author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) >= 5)));
COMMENT ON TABLE public.sl_instrument_versions IS 'Saber Ler: rodada (ano/semana) com itens {n, axis 1..5|null}; estágios de escrita e faixas só se configurados (vazio = não documentado).';

CREATE TABLE public.sl_instrument_homologations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_version_id uuid NOT NULL REFERENCES public.sl_instrument_versions(id),
  decision text NOT NULL CHECK (decision IN ('homologado','revogado')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.sl_entry_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL DEFAULT gen_random_uuid(), version int NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.sl_entry_versions(id),
  instrument_version_id uuid NOT NULL REFERENCES public.sl_instrument_versions(id),
  school_id text NOT NULL, class_id text NOT NULL, student_id text NOT NULL,
  presence text NOT NULL CHECK (presence IN ('presente','ausente','nao-registrado')),
  participation text CHECK (participation IN ('participou','participou-parcialmente','nao-participou')),
  item_results jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(item_results) = 'object'),
  writing_stage text,
  reason text, author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (presence = 'presente' OR (participation IS NULL AND item_results = '{}'::jsonb AND writing_stage IS NULL)),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) >= 5)));
CREATE UNIQUE INDEX sl_entry_v1_unique ON public.sl_entry_versions(instrument_version_id, student_id, class_id) WHERE version = 1;
CREATE INDEX sl_entry_school_idx ON public.sl_entry_versions(school_id, instrument_version_id);
CREATE INDEX sl_entry_student_idx ON public.sl_entry_versions(student_id);

CREATE TABLE public.sl_entry_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_version_id uuid NOT NULL REFERENCES public.sl_entry_versions(id),
  school_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('conferido','devolvido','homologado')),
  note text, author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  CHECK (decision <> 'devolvido' OR length(btrim(coalesce(note,''))) >= 5));

GRANT SELECT ON public.sl_instrument_versions, public.sl_instrument_homologations, public.sl_entry_versions, public.sl_entry_reviews TO authenticated;
GRANT ALL ON public.sl_instrument_versions, public.sl_instrument_homologations, public.sl_entry_versions, public.sl_entry_reviews TO service_role;
ALTER TABLE public.sl_instrument_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sl_instrument_homologations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sl_entry_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sl_entry_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY sl_inst_read ON public.sl_instrument_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY sl_hom_read ON public.sl_instrument_homologations FOR SELECT TO authenticated USING (true);
CREATE POLICY sl_entry_read ON public.sl_entry_versions FOR SELECT TO authenticated USING (
  public.has_network_capability('acompanhar-saber-ler')
  OR public.has_school_capability('acompanhar-saber-ler', school_id)
  OR public.has_school_capability('lancar-saber-ler', school_id)
  OR public.has_school_capability('homologar-saber-ler', school_id));
CREATE POLICY sl_rev_read ON public.sl_entry_reviews FOR SELECT TO authenticated USING (
  public.has_network_capability('acompanhar-saber-ler')
  OR public.has_school_capability('acompanhar-saber-ler', school_id)
  OR public.has_school_capability('lancar-saber-ler', school_id)
  OR public.has_school_capability('homologar-saber-ler', school_id));

CREATE FUNCTION public.sl_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'saber-ler:append-only'; END $$;
CREATE TRIGGER sl_inst_ro BEFORE UPDATE OR DELETE ON public.sl_instrument_versions FOR EACH ROW EXECUTE FUNCTION public.sl_append_only();
CREATE TRIGGER sl_hom_ro BEFORE UPDATE OR DELETE ON public.sl_instrument_homologations FOR EACH ROW EXECUTE FUNCTION public.sl_append_only();
CREATE TRIGGER sl_entry_ro BEFORE UPDATE OR DELETE ON public.sl_entry_versions FOR EACH ROW EXECUTE FUNCTION public.sl_append_only();
CREATE TRIGGER sl_rev_ro BEFORE UPDATE OR DELETE ON public.sl_entry_reviews FOR EACH ROW EXECUTE FUNCTION public.sl_append_only();

-- Instrumento: itens {n:int>=1 único, axis: 1..5 ou null}; nomes de eixo nunca aceitos.
CREATE FUNCTION public.sl_record_instrument(_logical uuid, _expected_version int, _year int, _grade int, _week int,
  _items jsonb, _stages jsonb, _bands jsonb, _source text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE b public.sl_instrument_versions; nid uuid; it jsonb; lid uuid := coalesce(_logical, gen_random_uuid()); seen int[] := '{}'; n int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'saber-ler:unauthenticated'; END IF;
  IF NOT public.has_network_capability('manter-instrumento-saber-ler') THEN RAISE EXCEPTION 'saber-ler:forbidden'; END IF;
  IF jsonb_typeof(_items) <> 'array' THEN RAISE EXCEPTION 'saber-ler:items-invalid'; END IF;
  FOR it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    IF it ? 'axisName' OR it ? 'axis_name' THEN RAISE EXCEPTION 'saber-ler:axis-name-not-documented'; END IF;
    n := (it->>'n')::int;
    IF n IS NULL OR n < 1 OR n = ANY(seen) THEN RAISE EXCEPTION 'saber-ler:item-number-invalid'; END IF;
    seen := seen || n;
    IF it->'axis' IS NOT NULL AND jsonb_typeof(it->'axis') <> 'null' AND ((it->>'axis')::int NOT BETWEEN 1 AND 5) THEN RAISE EXCEPTION 'saber-ler:axis-out-of-range'; END IF;
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtext('slinst' || lid::text));
  SELECT * INTO b FROM public.sl_instrument_versions WHERE logical_id = lid ORDER BY version DESC LIMIT 1;
  IF coalesce(b.version,0) <> coalesce(_expected_version,0) THEN RAISE EXCEPTION 'saber-ler:stale-base'; END IF;
  INSERT INTO public.sl_instrument_versions(logical_id, version, supersedes_id, edition_year, grade, week, items, writing_stages, percent_bands, source_ref, reason, author_user_id)
  VALUES (lid, coalesce(b.version,0)+1, b.id, _year, _grade, _week, _items, coalesce(_stages,'[]'::jsonb), _bands, btrim(_source), nullif(btrim(_reason),''), auth.uid())
  RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE FUNCTION public.sl_homologate_instrument(_version uuid, _decision text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.sl_instrument_versions; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'saber-ler:unauthenticated'; END IF;
  IF NOT public.has_network_capability('homologar-instrumento-saber-ler') THEN RAISE EXCEPTION 'saber-ler:forbidden'; END IF;
  SELECT * INTO v FROM public.sl_instrument_versions WHERE id = _version;
  IF v.id IS NULL THEN RAISE EXCEPTION 'saber-ler:not-found'; END IF;
  IF v.author_user_id = auth.uid() THEN RAISE EXCEPTION 'saber-ler:self-homologation'; END IF;
  INSERT INTO public.sl_instrument_homologations(instrument_version_id, decision, reason, author_user_id) VALUES (_version, _decision, btrim(_reason), auth.uid()) RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE FUNCTION public.sl_instrument_is_homologated(_version uuid) RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce((SELECT decision = 'homologado' FROM public.sl_instrument_homologations WHERE instrument_version_id = _version ORDER BY recorded_at DESC, id DESC LIMIT 1), false)
$$;

-- Lançamento: só contra instrumento homologado; resultado por item só para itens existentes; estágio só do catálogo configurado.
CREATE FUNCTION public.sl_record_entry(_logical uuid, _expected_version int, _instrument uuid, _school text, _class text, _student text,
  _presence text, _participation text, _items jsonb, _stage text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE b public.sl_entry_versions; i public.sl_instrument_versions; nid uuid; k text; val text; lid uuid := coalesce(_logical, gen_random_uuid());
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'saber-ler:unauthenticated'; END IF;
  IF NOT public.has_school_capability('lancar-saber-ler', _school) THEN RAISE EXCEPTION 'saber-ler:forbidden'; END IF;
  SELECT * INTO i FROM public.sl_instrument_versions WHERE id = _instrument;
  IF i.id IS NULL OR NOT public.sl_instrument_is_homologated(_instrument) THEN RAISE EXCEPTION 'saber-ler:instrument-not-homologated'; END IF;
  IF _presence = 'presente' AND _participation IS NULL THEN RAISE EXCEPTION 'saber-ler:participation-required'; END IF;
  FOR k, val IN SELECT key, value #>> '{}' FROM jsonb_each(coalesce(_items,'{}'::jsonb)) LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(i.items) x WHERE x->>'n' = k) THEN RAISE EXCEPTION 'saber-ler:item-unknown'; END IF;
    IF val NOT IN ('acerto','erro','em-branco','nao-aplicado') THEN RAISE EXCEPTION 'saber-ler:item-value-invalid'; END IF;
  END LOOP;
  IF _stage IS NOT NULL AND NOT (i.writing_stages ? _stage) THEN RAISE EXCEPTION 'saber-ler:stage-not-configured'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('slentry' || lid::text));
  SELECT * INTO b FROM public.sl_entry_versions WHERE logical_id = lid ORDER BY version DESC LIMIT 1;
  IF coalesce(b.version,0) <> coalesce(_expected_version,0) THEN RAISE EXCEPTION 'saber-ler:stale-base'; END IF;
  IF b.id IS NOT NULL AND (b.student_id <> _student OR b.instrument_version_id <> _instrument OR b.school_id <> _school) THEN RAISE EXCEPTION 'saber-ler:identity-immutable'; END IF;
  INSERT INTO public.sl_entry_versions(logical_id, version, supersedes_id, instrument_version_id, school_id, class_id, student_id, presence, participation, item_results, writing_stage, reason, author_user_id)
  VALUES (lid, coalesce(b.version,0)+1, b.id, _instrument, _school, _class, _student, _presence,
    CASE WHEN _presence = 'presente' THEN _participation END,
    CASE WHEN _presence = 'presente' THEN coalesce(_items,'{}'::jsonb) ELSE '{}'::jsonb END,
    CASE WHEN _presence = 'presente' THEN nullif(btrim(_stage),'') END, nullif(btrim(_reason),''), auth.uid())
  RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE FUNCTION public.sl_review_entry(_entry_version uuid, _decision text, _note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE e public.sl_entry_versions; head uuid; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'saber-ler:unauthenticated'; END IF;
  SELECT * INTO e FROM public.sl_entry_versions WHERE id = _entry_version;
  IF e.id IS NULL THEN RAISE EXCEPTION 'saber-ler:not-found'; END IF;
  IF NOT public.has_school_capability('homologar-saber-ler', e.school_id) THEN RAISE EXCEPTION 'saber-ler:forbidden'; END IF;
  IF e.author_user_id = auth.uid() THEN RAISE EXCEPTION 'saber-ler:self-review'; END IF;
  SELECT id INTO head FROM public.sl_entry_versions WHERE logical_id = e.logical_id ORDER BY version DESC LIMIT 1;
  IF head <> e.id THEN RAISE EXCEPTION 'saber-ler:stale-base'; END IF;
  INSERT INTO public.sl_entry_reviews(entry_version_id, school_id, decision, note, author_user_id) VALUES (e.id, e.school_id, _decision, nullif(btrim(_note),''), auth.uid()) RETURNING id INTO nid;
  RETURN nid;
END $$;

REVOKE ALL ON FUNCTION public.sl_record_instrument(uuid,int,int,int,int,jsonb,jsonb,jsonb,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sl_homologate_instrument(uuid,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sl_record_entry(uuid,int,uuid,text,text,text,text,text,jsonb,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sl_review_entry(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sl_record_instrument(uuid,int,int,int,int,jsonb,jsonb,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sl_homologate_instrument(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sl_record_entry(uuid,int,uuid,text,text,text,text,text,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sl_review_entry(uuid,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sl_instrument_is_homologated(uuid) TO authenticated;
