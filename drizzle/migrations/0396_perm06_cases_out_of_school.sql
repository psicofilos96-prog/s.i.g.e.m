-- Identificador do caso canônico (aa_outreach_cases): BA-ano-seq, atribuído uma vez
CREATE TABLE public.permanence_case_numbers (
  case_id uuid PRIMARY KEY REFERENCES public.aa_outreach_cases(id),
  case_year int NOT NULL, case_seq int NOT NULL,
  case_number text NOT NULL UNIQUE,
  assigned_by uuid NOT NULL, assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_year, case_seq)
);
-- Prioridade só de catálogo configurado (sem semente)
CREATE TABLE public.permanence_case_priorities (
  code text PRIMARY KEY CHECK (code ~ '^[a-z0-9-]{2,40}$'),
  label text NOT NULL, rank int NOT NULL UNIQUE,
  decision_ref text NOT NULL CHECK (length(btrim(decision_ref)) >= 3),
  created_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.permanence_case_priority_events (
  case_id uuid NOT NULL REFERENCES public.aa_outreach_cases(id),
  seq int NOT NULL CHECK (seq >= 1),
  priority_code text NOT NULL REFERENCES public.permanence_case_priorities(code),
  justification text NOT NULL CHECK (length(btrim(justification)) >= 10),
  author_person uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, seq)
);
-- Sinalização restrita de criança/adolescente fora da escola: NÃO é matrícula nem estudante
CREATE TABLE public.permanence_out_of_school_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  territory_school_id text NOT NULL,
  child_ref_hmac text NOT NULL CHECK (child_ref_hmac ~ '^[0-9a-f]{64}$'),
  display_initials text CHECK (display_initials IS NULL OR display_initials ~ '^[A-Z]{1,4}$'),
  birth_year int CHECK (birth_year IS NULL OR birth_year BETWEEN 1990 AND 2100),
  source_kind text NOT NULL CHECK (length(btrim(source_kind)) >= 3),
  author_person uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.permanence_out_of_school_events (
  signal_id uuid NOT NULL REFERENCES public.permanence_out_of_school_signals(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('verificacao','encaminhado-matricula','matriculado','descartado')),
  enrollment_ref text, note text,
  author_person uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (signal_id, seq),
  CHECK (kind <> 'matriculado' OR enrollment_ref IS NOT NULL),
  CHECK (kind <> 'descartado' OR length(btrim(coalesce(note,''))) >= 10)
);

GRANT SELECT ON public.permanence_case_numbers, public.permanence_case_priorities, public.permanence_case_priority_events,
  public.permanence_out_of_school_signals, public.permanence_out_of_school_events TO authenticated;
GRANT ALL ON public.permanence_case_numbers, public.permanence_case_priorities, public.permanence_case_priority_events,
  public.permanence_out_of_school_signals, public.permanence_out_of_school_events TO service_role;
ALTER TABLE public.permanence_case_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permanence_case_priorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permanence_case_priority_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permanence_out_of_school_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permanence_out_of_school_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "case numbers by school" ON public.permanence_case_numbers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.aa_outreach_cases c WHERE c.id = case_id AND public.has_school_capability('acompanhar-permanencia', c.school_id)));
CREATE POLICY "priorities readable" ON public.permanence_case_priorities FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "priority events by school" ON public.permanence_case_priority_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.aa_outreach_cases c WHERE c.id = case_id AND public.has_school_capability('acompanhar-permanencia', c.school_id)));
CREATE POLICY "oos signals restricted" ON public.permanence_out_of_school_signals FOR SELECT TO authenticated
  USING (public.has_school_capability('ler-sinalizacoes-fora-da-escola', territory_school_id));
CREATE POLICY "oos events restricted" ON public.permanence_out_of_school_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.permanence_out_of_school_signals s WHERE s.id = signal_id AND public.has_school_capability('ler-sinalizacoes-fora-da-escola', s.territory_school_id)));
CREATE TRIGGER pcn_immutable BEFORE UPDATE OR DELETE ON public.permanence_case_numbers FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER pcp_immutable BEFORE UPDATE OR DELETE ON public.permanence_case_priorities FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER pcpe_immutable BEFORE UPDATE OR DELETE ON public.permanence_case_priority_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER poss_immutable BEFORE UPDATE OR DELETE ON public.permanence_out_of_school_signals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER pose_immutable BEFORE UPDATE OR DELETE ON public.permanence_out_of_school_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.assign_permanence_case_number(_case uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.aa_outreach_cases; _y int; _s int; _n text;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'permcase:no-person'; END IF;
  SELECT * INTO _c FROM public.aa_outreach_cases WHERE id = _case;
  IF _c.id IS NULL OR NOT public.has_school_capability('abrir-casos-de-busca-ativa', _c.school_id) THEN RAISE EXCEPTION 'permcase:unavailable'; END IF;
  SELECT case_number INTO _n FROM public.permanence_case_numbers WHERE case_id = _case;
  IF _n IS NOT NULL THEN RETURN _n; END IF;
  _y := extract(year FROM _c.opened_at)::int;
  PERFORM pg_advisory_xact_lock(hashtextextended('permcase|' || _y, 0));
  SELECT coalesce(max(case_seq),0)+1 INTO _s FROM public.permanence_case_numbers WHERE case_year = _y;
  _n := 'BA-' || _y || '-' || lpad(_s::text, 5, '0');
  INSERT INTO public.permanence_case_numbers(case_id, case_year, case_seq, case_number, assigned_by) VALUES (_case, _y, _s, _n, _p);
  RETURN _n;
END $$;

CREATE OR REPLACE FUNCTION public.register_permanence_priority(_code text, _label text, _rank int, _decision text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id();
BEGIN
  IF _p IS NULL OR NOT public.has_network_capability('configurar-regras-de-permanencia') THEN RAISE EXCEPTION 'permcase:forbidden'; END IF;
  INSERT INTO public.permanence_case_priorities(code, label, rank, decision_ref, created_by) VALUES (_code, btrim(_label), _rank, btrim(_decision), _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'permcase:priority-exists';
END $$;

CREATE OR REPLACE FUNCTION public.set_permanence_case_priority(_case uuid, _expected_seq int, _code text, _justification text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.aa_outreach_cases; _last int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'permcase:no-person'; END IF;
  SELECT * INTO _c FROM public.aa_outreach_cases WHERE id = _case FOR UPDATE;
  IF _c.id IS NULL OR NOT public.has_school_capability('abrir-casos-de-busca-ativa', _c.school_id) THEN RAISE EXCEPTION 'permcase:unavailable'; END IF;
  SELECT coalesce(max(seq),0) INTO _last FROM public.permanence_case_priority_events WHERE case_id = _case;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'permcase:stale-base'; END IF;
  INSERT INTO public.permanence_case_priority_events(case_id, seq, priority_code, justification, author_person) VALUES (_case, _last+1, _code, btrim(_justification), _p);
  RETURN _last+1;
EXCEPTION WHEN foreign_key_violation THEN RAISE EXCEPTION 'permcase:priority-unknown';
          WHEN check_violation THEN RAISE EXCEPTION 'permcase:justification-required';
END $$;

CREATE OR REPLACE FUNCTION public.register_out_of_school_signal(_key text, _territory text, _hmac text, _initials text, _birth_year int, _source text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'permcase:no-person'; END IF;
  IF NOT public.has_school_capability('sinalizar-fora-da-escola', _territory) THEN RAISE EXCEPTION 'permcase:forbidden'; END IF;
  INSERT INTO public.permanence_out_of_school_signals(idempotency_key, territory_school_id, child_ref_hmac, display_initials, birth_year, source_kind, author_person)
  VALUES (_key, _territory, _hmac, nullif(btrim(_initials),''), _birth_year, btrim(_source), _p)
  ON CONFLICT (idempotency_key) DO NOTHING RETURNING id INTO _id;
  IF _id IS NULL THEN SELECT id INTO _id FROM public.permanence_out_of_school_signals WHERE idempotency_key = _key AND territory_school_id = _territory; END IF;
  IF _id IS NULL THEN RAISE EXCEPTION 'permcase:key-conflict'; END IF;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'permcase:invalid-signal';
END $$;

CREATE OR REPLACE FUNCTION public.record_out_of_school_event(_signal uuid, _expected_seq int, _kind text, _enrollment_ref text, _note text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _s public.permanence_out_of_school_signals; _last int; _lk text;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'permcase:no-person'; END IF;
  SELECT * INTO _s FROM public.permanence_out_of_school_signals WHERE id = _signal FOR UPDATE;
  IF _s.id IS NULL OR NOT public.has_school_capability('sinalizar-fora-da-escola', _s.territory_school_id) THEN RAISE EXCEPTION 'permcase:unavailable'; END IF;
  SELECT coalesce(max(seq),0) INTO _last FROM public.permanence_out_of_school_events WHERE signal_id = _signal;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'permcase:stale-base'; END IF;
  SELECT kind INTO _lk FROM public.permanence_out_of_school_events WHERE signal_id = _signal AND seq = _last;
  IF _lk IN ('matriculado','descartado') THEN RAISE EXCEPTION 'permcase:closed'; END IF;
  -- matrícula só por referência a fato real gravado pelo writer B3
  IF _kind = 'matriculado' AND NOT EXISTS (SELECT 1 FROM public.cycle_participations WHERE id::text = _enrollment_ref) THEN
    RAISE EXCEPTION 'permcase:enrollment-not-found'; END IF;
  INSERT INTO public.permanence_out_of_school_events(signal_id, seq, kind, enrollment_ref, note, author_person) VALUES (_signal, _last+1, _kind, nullif(btrim(_enrollment_ref),''), nullif(btrim(_note),''), _p);
  RETURN _last+1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'permcase:invalid-event';
END $$;

REVOKE ALL ON FUNCTION public.assign_permanence_case_number(uuid), public.register_permanence_priority(text,text,int,text),
  public.set_permanence_case_priority(uuid,int,text,text), public.register_out_of_school_signal(text,text,text,text,int,text),
  public.record_out_of_school_event(uuid,int,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_permanence_case_number(uuid), public.register_permanence_priority(text,text,int,text),
  public.set_permanence_case_priority(uuid,int,text,text), public.register_out_of_school_signal(text,text,text,text,int,text),
  public.record_out_of_school_event(uuid,int,text,text,text) TO authenticated;