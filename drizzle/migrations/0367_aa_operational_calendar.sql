CREATE TABLE public.aa_calendar_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL, sha256 text NOT NULL UNIQUE CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  edition_year int NOT NULL, executor_label text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE public.aa_calendar_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL DEFAULT gen_random_uuid(), version int NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.aa_calendar_items(id),
  event_kind text NOT NULL CHECK (event_kind IN ('registro','reprogramacao','cancelamento')),
  edition_year int NOT NULL, start_date date, end_date date, date_text text NOT NULL,
  segment text NOT NULL, action text NOT NULL CHECK (length(btrim(action)) > 0),
  kind text NOT NULL CHECK (kind IN ('aplicacao','lancamento','validacao','analise','devolutiva','recuperacao','formacao','conselho','outro')),
  program_key text, relation text CHECK (relation IN ('DIRETA','ACOMPANHAMENTO','GERAL')),
  responsible text, source_id uuid REFERENCES public.aa_calendar_sources(id), source_line int,
  reason text, author_user_id uuid, executor_label text, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK ((author_user_id IS NULL) <> (executor_label IS NULL)),
  CHECK (start_date IS NULL OR end_date IS NULL OR end_date >= start_date),
  CHECK (version = 1 OR (supersedes_id IS NOT NULL AND length(btrim(coalesce(reason,''))) >= 5)));
CREATE UNIQUE INDEX aa_calendar_items_source_line ON public.aa_calendar_items(source_id, source_line) WHERE version = 1;

CREATE TABLE public.aa_calendar_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_logical_id uuid NOT NULL, seq int NOT NULL CHECK (seq >= 1),
  state text NOT NULL CHECK (state IN ('planejado','em-andamento','concluido','nao-realizado')),
  evidence text, author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_logical_id, seq),
  CHECK (state NOT IN ('concluido','nao-realizado') OR length(btrim(coalesce(evidence,''))) >= 5));

GRANT SELECT ON public.aa_calendar_sources, public.aa_calendar_items, public.aa_calendar_status_events TO authenticated;
GRANT ALL ON public.aa_calendar_sources, public.aa_calendar_items, public.aa_calendar_status_events TO service_role;
ALTER TABLE public.aa_calendar_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aa_calendar_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aa_calendar_status_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY aa_cal_src_read ON public.aa_calendar_sources FOR SELECT TO authenticated USING (true);
CREATE POLICY aa_cal_items_read ON public.aa_calendar_items FOR SELECT TO authenticated USING (true);
CREATE POLICY aa_cal_status_read ON public.aa_calendar_status_events FOR SELECT TO authenticated USING (true);

CREATE FUNCTION public.aa_calendar_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'aa-calendar:append-only'; END $$;
CREATE TRIGGER aa_cal_items_ro BEFORE UPDATE OR DELETE ON public.aa_calendar_items FOR EACH ROW EXECUTE FUNCTION public.aa_calendar_append_only();
CREATE TRIGGER aa_cal_status_ro BEFORE UPDATE OR DELETE ON public.aa_calendar_status_events FOR EACH ROW EXECUTE FUNCTION public.aa_calendar_append_only();
CREATE TRIGGER aa_cal_src_ro BEFORE UPDATE OR DELETE ON public.aa_calendar_sources FOR EACH ROW EXECUTE FUNCTION public.aa_calendar_append_only();

CREATE FUNCTION public.aa_calendar_reprogram(_logical uuid, _expected_version int, _kind text, _start date, _end date, _date_text text, _responsible text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE b public.aa_calendar_items; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'aa-calendar:unauthenticated'; END IF;
  IF NOT public.has_network_capability('manter-calendario-avaliacao') THEN RAISE EXCEPTION 'aa-calendar:forbidden'; END IF;
  IF _kind NOT IN ('reprogramacao','cancelamento') THEN RAISE EXCEPTION 'aa-calendar:kind-invalid'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'aa-calendar:reason-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(_logical::text));
  SELECT * INTO b FROM public.aa_calendar_items WHERE logical_id = _logical ORDER BY version DESC LIMIT 1;
  IF b.id IS NULL THEN RAISE EXCEPTION 'aa-calendar:not-found'; END IF;
  IF b.version <> _expected_version THEN RAISE EXCEPTION 'aa-calendar:stale-base'; END IF;
  IF b.event_kind = 'cancelamento' THEN RAISE EXCEPTION 'aa-calendar:cancelled'; END IF;
  INSERT INTO public.aa_calendar_items(logical_id, version, supersedes_id, event_kind, edition_year, start_date, end_date, date_text, segment, action, kind, program_key, relation, responsible, source_id, source_line, reason, author_user_id)
  VALUES (b.logical_id, b.version + 1, b.id, _kind, b.edition_year,
    CASE WHEN _kind = 'cancelamento' THEN b.start_date ELSE _start END, CASE WHEN _kind = 'cancelamento' THEN b.end_date ELSE _end END,
    CASE WHEN _kind = 'cancelamento' THEN b.date_text ELSE coalesce(nullif(btrim(_date_text),''), b.date_text) END,
    b.segment, b.action, b.kind, b.program_key, b.relation, coalesce(nullif(btrim(_responsible),''), b.responsible), b.source_id, b.source_line, btrim(_reason), auth.uid())
  RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE FUNCTION public.aa_calendar_record_status(_logical uuid, _expected_seq int, _state text, _evidence text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cur int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'aa-calendar:unauthenticated'; END IF;
  IF NOT (public.has_network_capability('acompanhar-calendario-avaliacao') OR public.has_network_capability('manter-calendario-avaliacao')) THEN RAISE EXCEPTION 'aa-calendar:forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('st' || _logical::text));
  IF NOT EXISTS (SELECT 1 FROM public.aa_calendar_items WHERE logical_id = _logical) THEN RAISE EXCEPTION 'aa-calendar:not-found'; END IF;
  SELECT coalesce(max(seq), 0) INTO cur FROM public.aa_calendar_status_events WHERE item_logical_id = _logical;
  IF cur <> _expected_seq THEN RAISE EXCEPTION 'aa-calendar:stale-base'; END IF;
  INSERT INTO public.aa_calendar_status_events(item_logical_id, seq, state, evidence, author_user_id)
  VALUES (_logical, cur + 1, _state, nullif(btrim(_evidence),''), auth.uid());
  RETURN cur + 1;
END $$;

REVOKE ALL ON FUNCTION public.aa_calendar_reprogram(uuid,int,text,date,date,text,text,text), public.aa_calendar_record_status(uuid,int,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aa_calendar_reprogram(uuid,int,text,date,date,text,text,text), public.aa_calendar_record_status(uuid,int,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.aa_calendar_append_only() FROM PUBLIC, anon, authenticated;