CREATE TABLE public.permanence_referral_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dest_key text NOT NULL CHECK (dest_key ~ '^[a-z0-9-]{2,60}$'),
  version int NOT NULL CHECK (version >= 1),
  label text NOT NULL CHECK (length(btrim(label)) >= 3),
  legal_basis text NOT NULL CHECK (length(btrim(legal_basis)) >= 5),
  allowed_fields text[] NOT NULL CHECK (cardinality(allowed_fields) BETWEEN 1 AND 15),
  agreement_ref text,
  author_person uuid NOT NULL,
  approved_by uuid, decision_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (dest_key, version),
  CHECK ((approved_by IS NULL) = (decision_ref IS NULL)),
  CHECK (approved_by IS NULL OR approved_by <> author_person),
  CHECK (NOT (allowed_fields && ARRAY['prontuario','prontuario-integral','laudo','cid','cpf','endereco-completo']))
);
CREATE TABLE public.permanence_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.aa_outreach_cases(id),
  destination_id uuid NOT NULL REFERENCES public.permanence_referral_destinations(id),
  purpose text NOT NULL CHECK (length(btrim(purpose)) >= 10),
  legal_basis text NOT NULL CHECK (length(btrim(legal_basis)) >= 5),
  shared_fields text[] NOT NULL CHECK (cardinality(shared_fields) >= 1),
  protocol_ref text,
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.permanence_referral_events (
  referral_id uuid NOT NULL REFERENCES public.permanence_referrals(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('envio-comprovado','recebimento-confirmado','retorno','sem-retorno-registrado','encerrado')),
  evidence_ref text, evidence_sha256 text, note text,
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (referral_id, seq),
  CHECK (kind NOT IN ('envio-comprovado','recebimento-confirmado') OR (evidence_sha256 ~ '^[0-9a-f]{64}$' AND length(btrim(coalesce(evidence_ref,''))) >= 3)),
  CHECK (kind NOT IN ('retorno','encerrado') OR length(btrim(coalesce(note,''))) >= 10)
);
GRANT SELECT ON public.permanence_referral_destinations, public.permanence_referrals, public.permanence_referral_events TO authenticated;
GRANT ALL ON public.permanence_referral_destinations, public.permanence_referrals, public.permanence_referral_events TO service_role;
ALTER TABLE public.permanence_referral_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permanence_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permanence_referral_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "destinations readable" ON public.permanence_referral_destinations FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "referrals by school" ON public.permanence_referrals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.aa_outreach_cases c WHERE c.id = case_id AND public.has_school_capability('ler-encaminhamentos-do-caso', c.school_id)));
CREATE POLICY "referral events by school" ON public.permanence_referral_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.permanence_referrals r JOIN public.aa_outreach_cases c ON c.id = r.case_id WHERE r.id = referral_id AND public.has_school_capability('ler-encaminhamentos-do-caso', c.school_id)));
CREATE TRIGGER prd_immutable BEFORE UPDATE OR DELETE ON public.permanence_referral_destinations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER pr_immutable BEFORE UPDATE OR DELETE ON public.permanence_referrals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER pre_immutable BEFORE UPDATE OR DELETE ON public.permanence_referral_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.register_referral_destination(_key text, _expected_version int, _label text, _basis text, _fields text[], _agreement text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _id uuid;
BEGIN
  IF _p IS NULL OR NOT public.has_network_capability('configurar-regras-de-permanencia') THEN RAISE EXCEPTION 'permref:forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('permrefd|' || _key, 0));
  SELECT coalesce(max(version),0) INTO _last FROM public.permanence_referral_destinations WHERE dest_key = _key;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'permref:stale-base'; END IF;
  INSERT INTO public.permanence_referral_destinations(dest_key, version, label, legal_basis, allowed_fields, agreement_ref, author_person)
  VALUES (_key, _last+1, btrim(_label), btrim(_basis), _fields, nullif(btrim(_agreement),''), _p) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'permref:invalid-destination';
END $$;

CREATE OR REPLACE FUNCTION public.approve_referral_destination(_dest uuid, _decision text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _d public.permanence_referral_destinations; _last int; _id uuid;
BEGIN
  IF _p IS NULL OR NOT public.has_network_capability('aprovar-regras-de-permanencia') THEN RAISE EXCEPTION 'permref:approve-forbidden'; END IF;
  SELECT * INTO _d FROM public.permanence_referral_destinations WHERE id = _dest;
  IF _d.id IS NULL OR _d.approved_by IS NOT NULL THEN RAISE EXCEPTION 'permref:not-draft'; END IF;
  IF _d.author_person = _p THEN RAISE EXCEPTION 'permref:self-approval'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('permrefd|' || _d.dest_key, 0));
  SELECT max(version) INTO _last FROM public.permanence_referral_destinations WHERE dest_key = _d.dest_key;
  IF _last <> _d.version THEN RAISE EXCEPTION 'permref:stale-base'; END IF;
  INSERT INTO public.permanence_referral_destinations(dest_key, version, label, legal_basis, allowed_fields, agreement_ref, author_person, approved_by, decision_ref)
  VALUES (_d.dest_key, _last+1, _d.label, _d.legal_basis, _d.allowed_fields, _d.agreement_ref, _d.author_person, _p, btrim(_decision)) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'permref:decision-required';
END $$;

CREATE OR REPLACE FUNCTION public.create_permanence_referral(_case uuid, _destination uuid, _purpose text, _fields text[], _protocol_ref text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.aa_outreach_cases; _d public.permanence_referral_destinations; _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'permref:no-person'; END IF;
  SELECT id INTO _id FROM public.permanence_referrals WHERE idempotency_key = _key AND case_id = _case;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  SELECT * INTO _c FROM public.aa_outreach_cases WHERE id = _case;
  IF _c.id IS NULL OR NOT public.has_school_capability('encaminhar-casos-de-permanencia', _c.school_id) THEN RAISE EXCEPTION 'permref:unavailable'; END IF;
  SELECT * INTO _d FROM public.permanence_referral_destinations WHERE id = _destination;
  -- só a versão vigente (última) e aprovada do destino
  IF _d.id IS NULL OR _d.approved_by IS NULL OR _d.version <> (SELECT max(version) FROM public.permanence_referral_destinations WHERE dest_key = _d.dest_key) THEN
    RAISE EXCEPTION 'permref:destination-not-approved'; END IF;
  IF _fields IS NULL OR cardinality(_fields) = 0 OR NOT (_fields <@ _d.allowed_fields) THEN RAISE EXCEPTION 'permref:fields-not-allowed'; END IF;
  INSERT INTO public.permanence_referrals(case_id, destination_id, purpose, legal_basis, shared_fields, protocol_ref, author_person, idempotency_key)
  VALUES (_case, _destination, btrim(_purpose), _d.legal_basis, _fields, nullif(btrim(_protocol_ref),''), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'permref:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_permanence_referral_event(_referral uuid, _expected_seq int, _kind text, _evidence_ref text, _evidence_sha text, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _r public.permanence_referrals; _school text; _last int; _lk text; _s int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'permref:no-person'; END IF;
  SELECT seq INTO _s FROM public.permanence_referral_events WHERE idempotency_key = _key AND referral_id = _referral;
  IF _s IS NOT NULL THEN RETURN _s; END IF;
  SELECT * INTO _r FROM public.permanence_referrals WHERE id = _referral FOR UPDATE;
  SELECT school_id INTO _school FROM public.aa_outreach_cases WHERE id = _r.case_id;
  IF _r.id IS NULL OR NOT public.has_school_capability('encaminhar-casos-de-permanencia', _school) THEN RAISE EXCEPTION 'permref:unavailable'; END IF;
  SELECT coalesce(max(seq),0) INTO _last FROM public.permanence_referral_events WHERE referral_id = _referral;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'permref:stale-base'; END IF;
  SELECT kind INTO _lk FROM public.permanence_referral_events WHERE referral_id = _referral AND seq = _last;
  IF _lk = 'encerrado' THEN RAISE EXCEPTION 'permref:closed'; END IF;
  IF _kind <> 'envio-comprovado' AND _kind <> 'encerrado' AND NOT EXISTS (SELECT 1 FROM public.permanence_referral_events WHERE referral_id = _referral AND kind = 'envio-comprovado') THEN
    RAISE EXCEPTION 'permref:not-sent'; END IF;
  INSERT INTO public.permanence_referral_events(referral_id, seq, kind, evidence_ref, evidence_sha256, note, author_person, idempotency_key)
  VALUES (_referral, _last+1, _kind, nullif(btrim(_evidence_ref),''), nullif(btrim(_evidence_sha),''), nullif(btrim(_note),''), _p, _key);
  RETURN _last+1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'permref:evidence-required';
END $$;

REVOKE ALL ON FUNCTION public.register_referral_destination(text,int,text,text,text[],text), public.approve_referral_destination(uuid,text),
  public.create_permanence_referral(uuid,uuid,text,text[],text,text), public.record_permanence_referral_event(uuid,int,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_referral_destination(text,int,text,text,text[],text), public.approve_referral_destination(uuid,text),
  public.create_permanence_referral(uuid,uuid,text,text[],text,text), public.record_permanence_referral_event(uuid,int,text,text,text,text,text) TO authenticated;