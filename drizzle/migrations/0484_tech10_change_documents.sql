-- Tecnologia L10: documentação da mudança = juntadas do SIGEM Documentos vinculadas por tipo (coluna oculta).
-- Gates no banco: aprovar exige plano; executar exige plano e teste; reverter exige evidência de reversão;
-- encerrar exige revisão pós-implantação e (se executada sem reversão) evidência de execução.
CREATE TABLE public.tech_change_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  change_id uuid NOT NULL REFERENCES public.tech_changes(id),
  kind text NOT NULL CHECK (kind IN ('plano','teste','evidencia-execucao','evidencia-reversao','revisao-pos')),
  case_event_ref uuid NOT NULL REFERENCES public.admin_case_events(id),
  note text NOT NULL CHECK (length(btrim(note)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (change_id, case_event_ref)
);
GRANT SELECT ON public.tech_change_documents TO authenticated;
GRANT ALL ON public.tech_change_documents TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tech_change_documents FROM anon, authenticated, service_role;
REVOKE SELECT ON public.tech_change_documents FROM authenticated;
GRANT SELECT (id, change_id, kind, note, person_id, created_at) ON public.tech_change_documents TO authenticated;
ALTER TABLE public.tech_change_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech chgdoc read" ON public.tech_change_documents FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.tech_changes c WHERE c.id = change_id AND public.tech_can_read(c.school_id)));
CREATE TRIGGER tech_chgdoc_immutable BEFORE UPDATE OR DELETE ON public.tech_change_documents FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.attach_tech_change_document(_change uuid, _kind text, _case_event uuid, _note text, _key text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.tech_changes; _id uuid; _last text;
BEGIN
  SELECT id INTO _id FROM public.tech_change_documents WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _c FROM public.tech_changes WHERE id = _change FOR UPDATE;
  IF _c.id IS NULL OR NOT public.tech_can_manage(_c.school_id) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT action INTO _last FROM public.tech_change_events WHERE change_id = _change ORDER BY seq DESC LIMIT 1;
  IF _last IN ('rejeitar','encerrar') THEN RAISE EXCEPTION 'mudanca-fechada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_case_events e WHERE e.id = _case_event AND e.kind = 'juntada') THEN RAISE EXCEPTION 'juntada-inexistente'; END IF;
  INSERT INTO public.tech_change_documents(change_id, kind, case_event_ref, note, person_id, idempotency_key)
  VALUES (_change, _kind, _case_event, btrim(_note), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

CREATE OR REPLACE FUNCTION public.tech_change_doc_gate() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE _has text[]; _reverted boolean;
BEGIN
  SELECT coalesce(array_agg(DISTINCT kind), '{}') INTO _has FROM public.tech_change_documents WHERE change_id = NEW.change_id;
  IF NEW.action = 'aprovar' AND NOT ('plano' = ANY(_has)) THEN RAISE EXCEPTION 'falta-documento:plano'; END IF;
  IF NEW.action = 'executar' AND NOT (_has @> ARRAY['plano','teste']) THEN RAISE EXCEPTION 'falta-documento:plano-e-teste'; END IF;
  IF NEW.action = 'reverter' AND NOT ('evidencia-reversao' = ANY(_has)) THEN RAISE EXCEPTION 'falta-documento:evidencia-reversao'; END IF;
  IF NEW.action = 'encerrar' THEN
    _reverted := EXISTS (SELECT 1 FROM public.tech_change_events WHERE change_id = NEW.change_id AND action = 'reverter');
    IF NOT ('revisao-pos' = ANY(_has)) THEN RAISE EXCEPTION 'falta-documento:revisao-pos'; END IF;
    IF NOT _reverted AND EXISTS (SELECT 1 FROM public.tech_change_events WHERE change_id = NEW.change_id AND action = 'executar')
       AND NOT ('evidencia-execucao' = ANY(_has)) THEN RAISE EXCEPTION 'falta-documento:evidencia-execucao'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tech_change_doc_gate BEFORE INSERT ON public.tech_change_events FOR EACH ROW EXECUTE FUNCTION public.tech_change_doc_gate();

REVOKE ALL ON FUNCTION public.attach_tech_change_document(uuid, text, uuid, text, text), public.tech_change_doc_gate() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.attach_tech_change_document(uuid, text, uuid, text, text) TO authenticated;
