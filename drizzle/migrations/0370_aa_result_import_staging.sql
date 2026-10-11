CREATE TABLE public.aa_import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adapter_key text NOT NULL, adapter_version int NOT NULL CHECK (adapter_version >= 1),
  file_name text NOT NULL, sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'), sheet text NOT NULL,
  program_key text NOT NULL, edition_year int NOT NULL, cycle text, round text, school_label text,
  measure_kind text NOT NULL CHECK (measure_kind IN ('acertos-locais','proficiencia-tri')),
  formula_note text, executor_label text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (adapter_key, adapter_version, sha256, sheet));
COMMENT ON TABLE public.aa_import_batches IS 'A&A Lote 7: staging de resultados; acertos locais e proficiência TRI nunca se convertem; fórmula própria do instrumento preservada em formula_note.';

CREATE TABLE public.aa_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.aa_import_batches(id), row_no int NOT NULL,
  class_label text, student_name text, inep text, enrollment_ref text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  match_state text NOT NULL CHECK (match_state IN ('exato-inep','exato-matricula','revisao-nome','sem-correspondencia','duplicado','sem-dado')),
  candidate_student_ids text[] NOT NULL DEFAULT '{}', matched_student_id text,
  UNIQUE (batch_id, row_no),
  CHECK (match_state NOT IN ('exato-inep','exato-matricula') OR matched_student_id IS NOT NULL));

CREATE TABLE public.aa_import_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_id uuid NOT NULL REFERENCES public.aa_import_rows(id), seq int NOT NULL CHECK (seq >= 1),
  decision text NOT NULL CHECK (decision IN ('vincular','rejeitar')), student_id text,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5), author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (row_id, seq), CHECK (decision <> 'vincular' OR student_id IS NOT NULL));

CREATE TABLE public.aa_import_batch_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.aa_import_batches(id), seq int NOT NULL CHECK (seq >= 1),
  event text NOT NULL CHECK (event IN ('preparado','confirmado','revertido')),
  reason text, author_user_id uuid, executor_label text, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (batch_id, seq),
  CHECK ((author_user_id IS NULL) <> (executor_label IS NULL)),
  CHECK (event <> 'revertido' OR length(btrim(coalesce(reason,''))) >= 5),
  CHECK (event = 'preparado' OR author_user_id IS NOT NULL));

GRANT SELECT ON public.aa_import_batches, public.aa_import_rows, public.aa_import_review_events, public.aa_import_batch_events TO authenticated;
GRANT ALL ON public.aa_import_batches, public.aa_import_rows, public.aa_import_review_events, public.aa_import_batch_events TO service_role;
ALTER TABLE public.aa_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aa_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aa_import_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aa_import_batch_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY aa_imp_b_read ON public.aa_import_batches FOR SELECT TO authenticated USING (public.has_network_capability('importar-resultados-avaliacao'));
CREATE POLICY aa_imp_r_read ON public.aa_import_rows FOR SELECT TO authenticated USING (public.has_network_capability('importar-resultados-avaliacao'));
CREATE POLICY aa_imp_rv_read ON public.aa_import_review_events FOR SELECT TO authenticated USING (public.has_network_capability('importar-resultados-avaliacao'));
CREATE POLICY aa_imp_be_read ON public.aa_import_batch_events FOR SELECT TO authenticated USING (public.has_network_capability('importar-resultados-avaliacao'));

CREATE FUNCTION public.aa_import_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'aa-import:append-only'; END $$;
CREATE TRIGGER aa_imp_b_ro BEFORE UPDATE OR DELETE ON public.aa_import_batches FOR EACH ROW EXECUTE FUNCTION public.aa_import_append_only();
CREATE TRIGGER aa_imp_r_ro BEFORE UPDATE OR DELETE ON public.aa_import_rows FOR EACH ROW EXECUTE FUNCTION public.aa_import_append_only();
CREATE TRIGGER aa_imp_rv_ro BEFORE UPDATE OR DELETE ON public.aa_import_review_events FOR EACH ROW EXECUTE FUNCTION public.aa_import_append_only();
CREATE TRIGGER aa_imp_be_ro BEFORE UPDATE OR DELETE ON public.aa_import_batch_events FOR EACH ROW EXECUTE FUNCTION public.aa_import_append_only();

CREATE FUNCTION public.aa_import_review(_row uuid, _expected_seq int, _decision text, _student text, _reason text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.aa_import_rows; cur int; last_batch text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'aa-import:unauthenticated'; END IF;
  IF NOT public.has_network_capability('importar-resultados-avaliacao') THEN RAISE EXCEPTION 'aa-import:forbidden'; END IF;
  SELECT * INTO r FROM public.aa_import_rows WHERE id = _row;
  IF r.id IS NULL THEN RAISE EXCEPTION 'aa-import:not-found'; END IF;
  IF r.match_state NOT IN ('revisao-nome','sem-correspondencia') THEN RAISE EXCEPTION 'aa-import:not-reviewable'; END IF;
  SELECT event INTO last_batch FROM public.aa_import_batch_events WHERE batch_id = r.batch_id ORDER BY seq DESC LIMIT 1;
  IF last_batch IS DISTINCT FROM 'preparado' THEN RAISE EXCEPTION 'aa-import:batch-not-open'; END IF;
  IF _decision = 'vincular' AND NOT (_student = ANY (r.candidate_student_ids)) THEN RAISE EXCEPTION 'aa-import:not-a-candidate'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('aaimprv' || _row::text));
  SELECT coalesce(max(seq),0) INTO cur FROM public.aa_import_review_events WHERE row_id = _row;
  IF cur <> _expected_seq THEN RAISE EXCEPTION 'aa-import:stale-base'; END IF;
  INSERT INTO public.aa_import_review_events(row_id, seq, decision, student_id, reason, author_user_id)
  VALUES (_row, cur + 1, _decision, CASE WHEN _decision = 'vincular' THEN _student END, btrim(_reason), auth.uid());
  RETURN cur + 1;
END $$;

CREATE FUNCTION public.aa_import_batch_act(_batch uuid, _expected_seq int, _event text, _reason text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cur int; last_ev text; pending int;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'aa-import:unauthenticated'; END IF;
  IF NOT public.has_network_capability('importar-resultados-avaliacao') THEN RAISE EXCEPTION 'aa-import:forbidden'; END IF;
  IF _event NOT IN ('confirmado','revertido') THEN RAISE EXCEPTION 'aa-import:event-invalid'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('aaimpb' || _batch::text));
  SELECT coalesce(max(seq),0) INTO cur FROM public.aa_import_batch_events WHERE batch_id = _batch;
  IF cur <> _expected_seq THEN RAISE EXCEPTION 'aa-import:stale-base'; END IF;
  SELECT event INTO last_ev FROM public.aa_import_batch_events WHERE batch_id = _batch AND seq = cur;
  IF last_ev = 'revertido' THEN RAISE EXCEPTION 'aa-import:reverted'; END IF;
  IF _event = 'confirmado' THEN
    IF last_ev <> 'preparado' THEN RAISE EXCEPTION 'aa-import:not-prepared'; END IF;
    SELECT count(*) INTO pending FROM public.aa_import_rows r
      WHERE r.batch_id = _batch AND r.match_state IN ('revisao-nome','sem-correspondencia')
        AND NOT EXISTS (SELECT 1 FROM public.aa_import_review_events v WHERE v.row_id = r.id);
    IF pending > 0 THEN RAISE EXCEPTION 'aa-import:review-pending'; END IF;
  END IF;
  INSERT INTO public.aa_import_batch_events(batch_id, seq, event, reason, author_user_id) VALUES (_batch, cur + 1, _event, nullif(btrim(_reason),''), auth.uid());
  RETURN cur + 1;
END $$;

REVOKE ALL ON FUNCTION public.aa_import_review(uuid,int,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aa_import_batch_act(uuid,int,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aa_import_review(uuid,int,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aa_import_batch_act(uuid,int,text,text) TO authenticated;