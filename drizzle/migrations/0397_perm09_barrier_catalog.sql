CREATE TABLE public.permanence_barrier_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type_key text NOT NULL CHECK (type_key ~ '^[a-z0-9-]{2,60}$'),
  version int NOT NULL CHECK (version >= 1),
  label text NOT NULL CHECK (length(btrim(label)) >= 3),
  sensitivity text NOT NULL CHECK (sensitivity IN ('comum','restrita','reforcada')),
  requires_confirmation boolean NOT NULL DEFAULT true,
  author_person uuid NOT NULL,
  approved_by uuid, decision_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (type_key, version),
  CHECK ((approved_by IS NULL) = (decision_ref IS NULL)),
  CHECK (approved_by IS NULL OR approved_by <> author_person)
);
CREATE TABLE public.permanence_case_barriers (
  case_id uuid NOT NULL REFERENCES public.aa_outreach_cases(id),
  barrier_ref uuid NOT NULL DEFAULT gen_random_uuid(),
  seq int NOT NULL CHECK (seq >= 1),
  type_id uuid NOT NULL REFERENCES public.permanence_barrier_types(id),
  status text NOT NULL CHECK (status IN ('relatada','confirmada','descartada','superada')),
  source_kind text NOT NULL CHECK (source_kind IN ('familia','estudante','escola','rede-de-protecao','registro-oficial','visita')),
  source_ref text,
  justification text,
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (barrier_ref, seq),
  CHECK (status = 'relatada' OR length(btrim(coalesce(justification,''))) >= 10)
);
GRANT SELECT ON public.permanence_barrier_types, public.permanence_case_barriers TO authenticated;
GRANT ALL ON public.permanence_barrier_types, public.permanence_case_barriers TO service_role;
ALTER TABLE public.permanence_barrier_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permanence_case_barriers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "barrier types readable" ON public.permanence_barrier_types FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
-- restrição reforçada: capacidade cresce com a sensibilidade do tipo
CREATE POLICY "case barriers by sensitivity" ON public.permanence_case_barriers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.aa_outreach_cases c JOIN public.permanence_barrier_types t ON t.id = type_id
    WHERE c.id = case_id AND public.has_school_capability('ler-barreiras-do-caso', c.school_id)
      AND (t.sensitivity = 'comum'
        OR (t.sensitivity = 'restrita' AND public.has_school_capability('ler-barreiras-restritas', c.school_id))
        OR (t.sensitivity = 'reforcada' AND public.has_school_capability('ler-barreiras-reforcadas', c.school_id)))));
CREATE TRIGGER pbt_immutable BEFORE UPDATE OR DELETE ON public.permanence_barrier_types FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER pcb_immutable BEFORE UPDATE OR DELETE ON public.permanence_case_barriers FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.register_permanence_barrier_type(_key text, _expected_version int, _label text, _sensitivity text, _requires_confirmation boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _id uuid;
BEGIN
  IF _p IS NULL OR NOT public.has_network_capability('configurar-regras-de-permanencia') THEN RAISE EXCEPTION 'permbar:forbidden'; END IF;
  IF _label ~* '(culpa|neglig|irrespons|desestrutur|diagn|transtorno|vagabund|preguiç)' THEN RAISE EXCEPTION 'permbar:judgment-forbidden'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('permbar|' || _key, 0));
  SELECT coalesce(max(version),0) INTO _last FROM public.permanence_barrier_types WHERE type_key = _key;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'permbar:stale-base'; END IF;
  INSERT INTO public.permanence_barrier_types(type_key, version, label, sensitivity, requires_confirmation, author_person)
  VALUES (_key, _last+1, btrim(_label), _sensitivity, _requires_confirmation, _p) RETURNING id INTO _id;
  RETURN _id;
END $$;

-- aprovação = nova versão idêntica assinada por outra pessoa (linhas são imutáveis)
CREATE OR REPLACE FUNCTION public.approve_permanence_barrier_type(_type uuid, _decision text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _t public.permanence_barrier_types; _last int; _id uuid;
BEGIN
  IF _p IS NULL OR NOT public.has_network_capability('aprovar-regras-de-permanencia') THEN RAISE EXCEPTION 'permbar:approve-forbidden'; END IF;
  SELECT * INTO _t FROM public.permanence_barrier_types WHERE id = _type;
  IF _t.id IS NULL OR _t.approved_by IS NOT NULL THEN RAISE EXCEPTION 'permbar:not-draft'; END IF;
  IF _t.author_person = _p THEN RAISE EXCEPTION 'permbar:self-approval'; END IF;
  IF length(btrim(coalesce(_decision,''))) < 3 THEN RAISE EXCEPTION 'permbar:decision-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('permbar|' || _t.type_key, 0));
  SELECT max(version) INTO _last FROM public.permanence_barrier_types WHERE type_key = _t.type_key;
  IF _last <> _t.version THEN RAISE EXCEPTION 'permbar:stale-base'; END IF;
  INSERT INTO public.permanence_barrier_types(type_key, version, label, sensitivity, requires_confirmation, author_person, approved_by, decision_ref)
  VALUES (_t.type_key, _last+1, _t.label, _t.sensitivity, _t.requires_confirmation, _t.author_person, _p, btrim(_decision)) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_case_barrier(_case uuid, _barrier_ref uuid, _expected_seq int, _type uuid, _status text, _source text, _source_ref text, _justification text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.aa_outreach_cases; _t public.permanence_barrier_types; _last int; _ref uuid; _first_author uuid; _prev text;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'permbar:no-person'; END IF;
  SELECT barrier_ref INTO _ref FROM public.permanence_case_barriers WHERE idempotency_key = _key;
  IF _ref IS NOT NULL THEN RETURN _ref; END IF;
  SELECT * INTO _c FROM public.aa_outreach_cases WHERE id = _case;
  IF _c.id IS NULL OR NOT public.has_school_capability('registrar-barreiras-do-caso', _c.school_id) THEN RAISE EXCEPTION 'permbar:unavailable'; END IF;
  SELECT * INTO _t FROM public.permanence_barrier_types WHERE id = _type;
  IF _t.id IS NULL OR _t.approved_by IS NULL THEN RAISE EXCEPTION 'permbar:type-not-approved'; END IF;
  IF _t.sensitivity = 'reforcada' AND NOT public.has_school_capability('ler-barreiras-reforcadas', _c.school_id) THEN RAISE EXCEPTION 'permbar:unavailable'; END IF;
  IF _t.sensitivity = 'restrita' AND NOT public.has_school_capability('ler-barreiras-restritas', _c.school_id) THEN RAISE EXCEPTION 'permbar:unavailable'; END IF;
  IF _justification ~* '(culpa|neglig|irrespons|desestrutur|diagn|transtorno)' THEN RAISE EXCEPTION 'permbar:judgment-forbidden'; END IF;
  _ref := coalesce(_barrier_ref, gen_random_uuid());
  PERFORM pg_advisory_xact_lock(hashtextextended('permbarref|' || _ref, 0));
  SELECT coalesce(max(seq),0) INTO _last FROM public.permanence_case_barriers WHERE barrier_ref = _ref;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'permbar:stale-base'; END IF;
  IF _last = 0 AND _status <> 'relatada' THEN RAISE EXCEPTION 'permbar:must-start-reported'; END IF;
  IF _last > 0 THEN
    SELECT author_person INTO _first_author FROM public.permanence_case_barriers WHERE barrier_ref = _ref AND seq = 1;
    SELECT status INTO _prev FROM public.permanence_case_barriers WHERE barrier_ref = _ref AND seq = _last;
    IF EXISTS (SELECT 1 FROM public.permanence_case_barriers WHERE barrier_ref = _ref AND (case_id <> _case OR type_id <> _type)) THEN RAISE EXCEPTION 'permbar:mismatch'; END IF;
    IF _prev IN ('descartada','superada') THEN RAISE EXCEPTION 'permbar:closed'; END IF;
    IF _status = 'confirmada' AND _first_author = _p THEN RAISE EXCEPTION 'permbar:self-confirmation'; END IF;
    IF _status = 'confirmada' AND length(btrim(coalesce(_source_ref,''))) < 3 THEN RAISE EXCEPTION 'permbar:source-required'; END IF;
  END IF;
  INSERT INTO public.permanence_case_barriers(case_id, barrier_ref, seq, type_id, status, source_kind, source_ref, justification, author_person, idempotency_key)
  VALUES (_case, _ref, _last+1, _type, _status, _source, nullif(btrim(_source_ref),''), nullif(btrim(_justification),''), _p, _key);
  RETURN _ref;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'permbar:invalid';
END $$;

REVOKE ALL ON FUNCTION public.register_permanence_barrier_type(text,int,text,text,boolean), public.approve_permanence_barrier_type(uuid,text),
  public.record_case_barrier(uuid,uuid,int,uuid,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_permanence_barrier_type(text,int,text,text,boolean), public.approve_permanence_barrier_type(uuid,text),
  public.record_case_barrier(uuid,uuid,int,uuid,text,text,text,text,text) TO authenticated;