CREATE TABLE public.document_numbering_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL,
  version int NOT NULL CHECK (version >= 1),
  document_type_key text NOT NULL,
  pattern text NOT NULL CHECK (pattern ~ '\{seq\}'),
  seq_padding int NOT NULL DEFAULT 3 CHECK (seq_padding BETWEEN 1 AND 9),
  status text NOT NULL CHECK (status IN ('rascunho','aprovada','revogada')),
  decision_ref text,
  approved_by_person uuid,
  created_by_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_key, version),
  CHECK (status <> 'aprovada' OR (decision_ref IS NOT NULL AND approved_by_person IS NOT NULL))
);
CREATE TABLE public.document_number_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.document_numbering_rules(id),
  document_type_key text NOT NULL,
  unit_id text NOT NULL,
  year int NOT NULL CHECK (year BETWEEN 1900 AND 2200),
  seq int NOT NULL CHECK (seq >= 1),
  formatted text NOT NULL,
  subject_ref text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  allocated_by_person uuid NOT NULL,
  allocated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_type_key, unit_id, year, seq),
  UNIQUE (document_type_key, unit_id, year, formatted)
);
CREATE TABLE public.document_number_cancellations (
  allocation_id uuid PRIMARY KEY REFERENCES public.document_number_allocations(id),
  justification text NOT NULL CHECK (length(btrim(justification)) >= 10),
  cancelled_by_person uuid NOT NULL,
  cancelled_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.document_numbering_rules, public.document_number_allocations, public.document_number_cancellations TO authenticated;
GRANT ALL ON public.document_numbering_rules, public.document_number_allocations, public.document_number_cancellations TO service_role;
ALTER TABLE public.document_numbering_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_number_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_number_cancellations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "numbering rules readable by authenticated" ON public.document_numbering_rules FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "allocations readable with capability" ON public.document_number_allocations FOR SELECT TO authenticated
  USING (public.has_network_capability('numerar-documentos') OR unit_id IN (SELECT public.school_capability_schools('numerar-documentos')));
CREATE POLICY "cancellations readable with capability" ON public.document_number_cancellations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.document_number_allocations a WHERE a.id = allocation_id));

CREATE OR REPLACE FUNCTION public.doc_numbering_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'numbering:append-only'; END $$;
CREATE TRIGGER doc_alloc_immutable BEFORE UPDATE OR DELETE ON public.document_number_allocations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER doc_cancel_immutable BEFORE UPDATE OR DELETE ON public.document_number_cancellations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER doc_rule_immutable BEFORE UPDATE OR DELETE ON public.document_numbering_rules FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.allocate_document_number(_document_type_key text, _unit_id text, _year int, _subject_ref text, _idempotency_key text)
RETURNS TABLE(allocation_id uuid, formatted text, seq int, reused boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid := public.current_person_id(); _rule public.document_numbering_rules; _prev public.document_number_allocations; _next int; _fmt text; _id uuid;
BEGIN
  IF _person IS NULL THEN RAISE EXCEPTION 'numbering:no-person'; END IF;
  IF NOT (public.has_network_capability('numerar-documentos') OR _unit_id IN (SELECT public.school_capability_schools('numerar-documentos'))) THEN
    RAISE EXCEPTION 'numbering:forbidden'; END IF;
  IF coalesce(btrim(_subject_ref),'') = '' OR coalesce(btrim(_idempotency_key),'') = '' THEN RAISE EXCEPTION 'numbering:missing-reference'; END IF;
  SELECT * INTO _prev FROM public.document_number_allocations a WHERE a.idempotency_key = _idempotency_key;
  IF FOUND THEN
    IF _prev.document_type_key <> _document_type_key OR _prev.unit_id <> _unit_id OR _prev.year <> _year OR _prev.subject_ref <> _subject_ref THEN
      RAISE EXCEPTION 'numbering:idempotency-conflict'; END IF;
    RETURN QUERY SELECT _prev.id, _prev.formatted, _prev.seq, true; RETURN;
  END IF;
  SELECT r.* INTO _rule FROM public.document_numbering_rules r
   WHERE r.document_type_key = _document_type_key
     AND r.version = (SELECT max(r2.version) FROM public.document_numbering_rules r2 WHERE r2.rule_key = r.rule_key)
     AND r.status = 'aprovada';
  IF NOT FOUND THEN RAISE EXCEPTION 'numbering:no-approved-rule'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(_document_type_key || '|' || _unit_id || '|' || _year, 0));
  SELECT coalesce(max(a.seq),0) + 1 INTO _next FROM public.document_number_allocations a
   WHERE a.document_type_key = _document_type_key AND a.unit_id = _unit_id AND a.year = _year;
  _fmt := replace(replace(replace(_rule.pattern,'{seq}', lpad(_next::text, _rule.seq_padding, '0')),'{ano}', _year::text),'{unidade}', _unit_id);
  INSERT INTO public.document_number_allocations(rule_id, document_type_key, unit_id, year, seq, formatted, subject_ref, idempotency_key, allocated_by_person)
  VALUES (_rule.id, _document_type_key, _unit_id, _year, _next, _fmt, _subject_ref, _idempotency_key, _person) RETURNING id INTO _id;
  RETURN QUERY SELECT _id, _fmt, _next, false;
END $$;

CREATE OR REPLACE FUNCTION public.cancel_document_number(_allocation_id uuid, _justification text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid := public.current_person_id(); _a public.document_number_allocations;
BEGIN
  IF _person IS NULL THEN RAISE EXCEPTION 'numbering:no-person'; END IF;
  SELECT * INTO _a FROM public.document_number_allocations WHERE id = _allocation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'numbering:not-found'; END IF;
  IF NOT (public.has_network_capability('numerar-documentos') OR _a.unit_id IN (SELECT public.school_capability_schools('numerar-documentos'))) THEN
    RAISE EXCEPTION 'numbering:forbidden'; END IF;
  INSERT INTO public.document_number_cancellations(allocation_id, justification, cancelled_by_person) VALUES (_allocation_id, _justification, _person);
END $$;

REVOKE ALL ON FUNCTION public.allocate_document_number(text,text,int,text,text), public.cancel_document_number(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.allocate_document_number(text,text,int,text,text), public.cancel_document_number(uuid,text) TO authenticated;