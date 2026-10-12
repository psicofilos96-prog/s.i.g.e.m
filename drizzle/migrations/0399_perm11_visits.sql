CREATE TABLE public.permanence_visits (
  visit_ref uuid NOT NULL,
  seq int NOT NULL CHECK (seq >= 1),
  case_id uuid NOT NULL REFERENCES public.aa_outreach_cases(id),
  kind text NOT NULL CHECK (kind IN ('visita','atendimento')),
  status text NOT NULL CHECK (status IN ('planejada','realizada','nao-realizada','cancelada')),
  objective text NOT NULL CHECK (length(btrim(objective)) >= 10),
  scheduled_on date NOT NULL,
  occurred_on date,
  professional_person uuid NOT NULL,
  companion_person uuid,
  safety_checked boolean NOT NULL DEFAULT false,
  safety_note text,
  providences text,
  return_needed boolean,
  return_on date,
  justification text,
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visit_ref, seq),
  CHECK (status <> 'realizada' OR (occurred_on IS NOT NULL AND return_needed IS NOT NULL)),
  CHECK (return_on IS NULL OR return_needed),
  CHECK (status NOT IN ('nao-realizada','cancelada') OR length(btrim(coalesce(justification,''))) >= 10),
  CHECK (kind <> 'visita' OR status <> 'planejada' OR safety_checked),
  CHECK (companion_person IS NULL OR companion_person <> professional_person)
);
CREATE INDEX permanence_visits_case_idx ON public.permanence_visits(case_id, scheduled_on);
GRANT SELECT ON public.permanence_visits TO authenticated;
GRANT ALL ON public.permanence_visits TO service_role;
ALTER TABLE public.permanence_visits ENABLE ROW LEVEL SECURITY;
-- privado: só quem lê visitas do caso na escola, ou o próprio profissional/acompanhante
CREATE POLICY "visits restricted" ON public.permanence_visits FOR SELECT TO authenticated USING (
  professional_person = public.current_person_id() OR companion_person = public.current_person_id()
  OR EXISTS (SELECT 1 FROM public.aa_outreach_cases c WHERE c.id = case_id AND public.has_school_capability('ler-visitas-do-caso', c.school_id)));
CREATE TRIGGER pv_immutable BEFORE UPDATE OR DELETE ON public.permanence_visits FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_permanence_visit(_visit_ref uuid, _expected_seq int, _case uuid, _kind text, _status text, _objective text,
  _scheduled_on date, _occurred_on date, _professional uuid, _companion uuid, _safety_checked boolean, _safety_note text,
  _providences text, _return_needed boolean, _return_on date, _justification text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.aa_outreach_cases; _ref uuid; _last int; _prev public.permanence_visits;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'permvisit:no-person'; END IF;
  SELECT visit_ref INTO _ref FROM public.permanence_visits WHERE idempotency_key = _key;
  IF _ref IS NOT NULL THEN RETURN _ref; END IF;
  SELECT * INTO _c FROM public.aa_outreach_cases WHERE id = _case;
  IF _c.id IS NULL OR NOT public.has_school_capability('planejar-visitas-do-caso', _c.school_id) THEN RAISE EXCEPTION 'permvisit:unavailable'; END IF;
  -- profissional competente: precisa ter a capacidade de realizar o tipo na escola (verificada para a sessão quando é ele quem registra)
  IF _status IN ('realizada','nao-realizada') AND _professional <> _p THEN RAISE EXCEPTION 'permvisit:only-professional-records'; END IF;
  IF _professional = _p AND NOT public.has_school_capability('realizar-' || _kind || 's-do-caso', _c.school_id) THEN RAISE EXCEPTION 'permvisit:not-competent'; END IF;
  IF _occurred_on IS NOT NULL AND _occurred_on > current_date THEN RAISE EXCEPTION 'permvisit:future-occurrence'; END IF;
  IF coalesce(_safety_note,'') ~* '(endere[cç]o|rua |cpf|telefone|laudo|cid )' OR coalesce(_providences,'') ~* '(cpf|laudo|cid )' THEN RAISE EXCEPTION 'permvisit:private-data'; END IF;
  _ref := coalesce(_visit_ref, gen_random_uuid());
  PERFORM pg_advisory_xact_lock(hashtextextended('permvisit|' || _ref, 0));
  SELECT coalesce(max(seq),0) INTO _last FROM public.permanence_visits WHERE visit_ref = _ref;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'permvisit:stale-base'; END IF;
  IF _last = 0 AND _status <> 'planejada' THEN RAISE EXCEPTION 'permvisit:must-plan-first'; END IF;
  IF _last > 0 THEN
    SELECT * INTO _prev FROM public.permanence_visits WHERE visit_ref = _ref AND seq = _last;
    IF _prev.case_id <> _case OR _prev.kind <> _kind THEN RAISE EXCEPTION 'permvisit:mismatch'; END IF;
    IF _prev.status <> 'planejada' THEN RAISE EXCEPTION 'permvisit:closed'; END IF;
  END IF;
  INSERT INTO public.permanence_visits(visit_ref, seq, case_id, kind, status, objective, scheduled_on, occurred_on, professional_person, companion_person,
    safety_checked, safety_note, providences, return_needed, return_on, justification, author_person, idempotency_key)
  VALUES (_ref, _last+1, _case, _kind, _status, btrim(_objective), _scheduled_on, _occurred_on, _professional, _companion,
    coalesce(_safety_checked,false), nullif(btrim(_safety_note),''), nullif(btrim(_providences),''), _return_needed, _return_on, nullif(btrim(_justification),''), _p, _key);
  RETURN _ref;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'permvisit:invalid';
END $$;
REVOKE ALL ON FUNCTION public.record_permanence_visit(uuid,int,uuid,text,text,text,date,date,uuid,uuid,boolean,text,text,boolean,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_permanence_visit(uuid,int,uuid,text,text,text,date,date,uuid,uuid,boolean,text,text,boolean,date,text,text) TO authenticated;