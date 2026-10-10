-- LOTE 6/14: decisões humanas de conciliação (append-only). Nunca cria vínculo, lotação, atuação ou acesso.
CREATE TABLE public.staff_reconciliation_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_record_id uuid NOT NULL REFERENCES public.staff_administrative_records(id),
  decision text NOT NULL CHECK (decision IN ('confirmado','rejeitado','pendente-de-chave')),
  person_id uuid NULL,
  evidence text NOT NULL CHECK (length(btrim(evidence)) >= 10),
  supersedes_id uuid NULL REFERENCES public.staff_reconciliation_decisions(id),
  decided_by uuid NULL,
  decided_by_principal_id uuid NULL,
  decided_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((decision = 'confirmado') = (person_id IS NOT NULL)),
  CHECK ((decided_by IS NULL) <> (decided_by_principal_id IS NULL))
);
CREATE UNIQUE INDEX staff_recon_decisions_one_successor ON public.staff_reconciliation_decisions(supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE UNIQUE INDEX staff_recon_decisions_one_root ON public.staff_reconciliation_decisions(staff_record_id) WHERE supersedes_id IS NULL;
CREATE INDEX staff_recon_decisions_record ON public.staff_reconciliation_decisions(staff_record_id);

GRANT SELECT ON public.staff_reconciliation_decisions TO authenticated;
GRANT ALL ON public.staff_reconciliation_decisions TO service_role;
ALTER TABLE public.staff_reconciliation_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "segue a leitura do registro administrativo" ON public.staff_reconciliation_decisions
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.staff_administrative_records r WHERE r.id = staff_record_id));

CREATE OR REPLACE FUNCTION public.staff_recon_decisions_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'staff_reconciliation_decisions é append-only' USING ERRCODE = '42501'; END $$;
CREATE TRIGGER staff_recon_decisions_no_update BEFORE UPDATE OR DELETE ON public.staff_reconciliation_decisions
  FOR EACH ROW EXECUTE FUNCTION public.staff_recon_decisions_immutable();

CREATE OR REPLACE FUNCTION public.record_staff_reconciliation_decision(
  _staff_record_id uuid, _decision text, _person_id uuid, _evidence text, _expected_head uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _head uuid; _school text; _uid uuid := auth.uid(); _principal uuid; _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'sessao-ausente' USING ERRCODE = '42501'; END IF;
  SELECT school_id INTO _school FROM public.staff_administrative_records WHERE id = _staff_record_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'registro-inexistente' USING ERRCODE = 'P0002'; END IF;
  -- Competência: capability explícita vigente (rede ou escola do registro). Sem política homologada ⇒ recusa.
  IF NOT EXISTS (SELECT 1 FROM public.effective_capabilities() c
                 WHERE c.capability_id = 'conciliar-pessoal-administrativo' AND (c.school_id IS NULL OR c.school_id = _school)) THEN
    RAISE EXCEPTION 'sem-competencia' USING ERRCODE = '42501';
  END IF;
  IF _decision NOT IN ('confirmado','rejeitado','pendente-de-chave') THEN RAISE EXCEPTION 'decisao-invalida' USING ERRCODE = '22023'; END IF;
  IF length(btrim(coalesce(_evidence,''))) < 10 THEN RAISE EXCEPTION 'evidencia-obrigatoria' USING ERRCODE = '22023'; END IF;
  IF _decision = 'confirmado' THEN
    IF _person_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons WHERE id = _person_id) THEN
      RAISE EXCEPTION 'pessoa-invalida' USING ERRCODE = '22023'; END IF;
  ELSIF _person_id IS NOT NULL THEN RAISE EXCEPTION 'pessoa-so-em-confirmacao' USING ERRCODE = '22023'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('staff-recon:' || _staff_record_id::text));
  SELECT d.id INTO _head FROM public.staff_reconciliation_decisions d
   WHERE d.staff_record_id = _staff_record_id
     AND NOT EXISTS (SELECT 1 FROM public.staff_reconciliation_decisions s WHERE s.supersedes_id = d.id);
  IF _head IS DISTINCT FROM _expected_head THEN RAISE EXCEPTION 'base-desatualizada' USING ERRCODE = '40001'; END IF;
  _principal := public.current_principal_id();
  INSERT INTO public.staff_reconciliation_decisions(staff_record_id, decision, person_id, evidence, supersedes_id, decided_by, decided_by_principal_id)
  VALUES (_staff_record_id, _decision, _person_id, btrim(_evidence), _head,
          CASE WHEN _principal IS NULL THEN _uid END, _principal)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.record_staff_reconciliation_decision(uuid, text, uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_staff_reconciliation_decision(uuid, text, uuid, text, uuid) TO authenticated;