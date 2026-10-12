-- Tecnologia L17: incidente de segurança digital = registro de ACESSO RESTRITO (fora de ops_requests, que é legível pela escola).
-- Qualquer pessoa identificada relata; leitura só com 'tratar-incidentes-de-seguranca' (rede); o relator vê só o estado pela função própria.
-- Fases append-only com transições fechadas; dado pessoal envolvido exige decisão de comunicação registrada (com documento) antes de encerrar.
CREATE TABLE public.tech_security_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  category text NOT NULL CHECK (category IN ('acesso-indevido','credencial-comprometida','malware','phishing','vazamento','indisponibilidade','outro')),
  school_id text,
  summary text NOT NULL CHECK (length(btrim(summary)) BETWEEN 10 AND 2000),
  personal_data boolean,
  reporter_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tech_security_incident_events (
  incident_id uuid NOT NULL REFERENCES public.tech_security_incidents(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('triagem','contencao','erradicacao','recuperacao','decisao-comunicacao','encerramento','descarte')),
  severity text CHECK (severity IN ('baixa','media','alta','critica')),
  personal_data boolean,
  communicate boolean,
  document_ref uuid REFERENCES public.admin_case_events(id),
  note text NOT NULL CHECK (length(btrim(note)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (incident_id, seq),
  CHECK (kind <> 'triagem' OR (severity IS NOT NULL AND personal_data IS NOT NULL)),
  CHECK (kind <> 'decisao-comunicacao' OR (communicate IS NOT NULL AND document_ref IS NOT NULL))
);
CREATE TABLE public.tech_security_counters (year int PRIMARY KEY, last int NOT NULL);
GRANT ALL ON public.tech_security_incidents, public.tech_security_incident_events, public.tech_security_counters TO service_role;
REVOKE ALL ON public.tech_security_incidents, public.tech_security_incident_events, public.tech_security_counters FROM anon, authenticated;
GRANT SELECT ON public.tech_security_incidents TO authenticated;
GRANT SELECT (incident_id, seq, kind, severity, personal_data, communicate, note, person_id, created_at) ON public.tech_security_incident_events TO authenticated;
ALTER TABLE public.tech_security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_security_incident_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_security_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sec inc read" ON public.tech_security_incidents FOR SELECT TO authenticated USING (public.has_network_capability('tratar-incidentes-de-seguranca'));
CREATE POLICY "sec ev read" ON public.tech_security_incident_events FOR SELECT TO authenticated USING (public.has_network_capability('tratar-incidentes-de-seguranca'));
CREATE TRIGGER sec_inc_immutable BEFORE UPDATE OR DELETE ON public.tech_security_incidents FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER sec_ev_immutable BEFORE UPDATE OR DELETE ON public.tech_security_incident_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.report_tech_security_incident(_category text, _school text, _summary text, _key text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c text; _y int := extract(year FROM now())::int; _n int;
BEGIN
  SELECT code INTO _c FROM public.tech_security_incidents WHERE idempotency_key = _key AND reporter_person = _p; IF _c IS NOT NULL THEN RETURN _c; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  INSERT INTO public.tech_security_counters(year, last) VALUES (_y, 1) ON CONFLICT (year) DO UPDATE SET last = public.tech_security_counters.last + 1 RETURNING last INTO _n;
  _c := 'SEG-' || _y || '-' || lpad(_n::text, 5, '0');
  INSERT INTO public.tech_security_incidents(code, category, school_id, summary, reporter_person, idempotency_key) VALUES (_c, _category, _school, btrim(_summary), _p, _key);
  RETURN _c;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos'; WHEN unique_violation THEN RAISE EXCEPTION 'chave-ja-usada';
END $$;

CREATE OR REPLACE FUNCTION public.record_tech_security_event(_inc uuid, _expected int, _kind text, _severity text, _pd boolean, _communicate boolean, _doc uuid, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _i public.tech_security_incidents; _last int; _lk text; _prev int; _pdv boolean;
BEGIN
  SELECT seq INTO _prev FROM public.tech_security_incident_events WHERE idempotency_key = _key; IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('tratar-incidentes-de-seguranca') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  SELECT * INTO _i FROM public.tech_security_incidents WHERE id = _inc FOR UPDATE;
  IF _i.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  IF _i.reporter_person = _p AND _kind IN ('triagem','encerramento','descarte') THEN RAISE EXCEPTION 'relator-nao-decide'; END IF;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.tech_security_incident_events WHERE incident_id = _inc;
  IF _last <> _expected THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  SELECT kind INTO _lk FROM public.tech_security_incident_events WHERE incident_id = _inc AND seq = _last;
  IF _lk IN ('encerramento','descarte') THEN RAISE EXCEPTION 'encerrado'; END IF;
  IF _lk IS NULL AND _kind NOT IN ('triagem','descarte') THEN RAISE EXCEPTION 'transicao-invalida'; END IF;
  IF _lk IS NOT NULL AND _kind IN ('triagem','descarte') AND _kind <> 'triagem' THEN RAISE EXCEPTION 'transicao-invalida'; END IF;
  IF _doc IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.admin_case_events WHERE id = _doc AND event_type = 'documento_juntado') THEN RAISE EXCEPTION 'documento-nao-juntado'; END IF;
  IF _kind = 'encerramento' THEN
    SELECT personal_data INTO _pdv FROM public.tech_security_incident_events WHERE incident_id = _inc AND kind = 'triagem' ORDER BY seq DESC LIMIT 1;
    IF _pdv IS NULL THEN RAISE EXCEPTION 'sem-triagem'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.tech_security_incident_events WHERE incident_id = _inc AND kind = 'contencao') THEN RAISE EXCEPTION 'sem-contencao'; END IF;
    IF _pdv AND NOT EXISTS (SELECT 1 FROM public.tech_security_incident_events WHERE incident_id = _inc AND kind = 'decisao-comunicacao') THEN RAISE EXCEPTION 'sem-decisao-de-comunicacao'; END IF;
  END IF;
  INSERT INTO public.tech_security_incident_events(incident_id, seq, kind, severity, personal_data, communicate, document_ref, note, person_id, idempotency_key)
  VALUES (_inc, _last + 1, _kind, _severity, _pd, _communicate, _doc, btrim(_note), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

-- Relator vê só código e fase (sem resumo, gravidade ou notas da equipe).
CREATE OR REPLACE FUNCTION public.my_tech_security_reports()
RETURNS TABLE(code text, created_at timestamptz, phase text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT i.code, i.created_at, coalesce((SELECT e.kind FROM public.tech_security_incident_events e WHERE e.incident_id = i.id ORDER BY e.seq DESC LIMIT 1), 'relatado')
  FROM public.tech_security_incidents i WHERE i.reporter_person = public.current_person_id() ORDER BY i.created_at DESC LIMIT 200
$$;
REVOKE ALL ON FUNCTION public.report_tech_security_incident(text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_tech_security_event(uuid, int, text, text, boolean, boolean, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_tech_security_reports() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.report_tech_security_incident(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_tech_security_event(uuid, int, text, text, boolean, boolean, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_tech_security_reports() TO authenticated;