ALTER TABLE public.institutional_person_identifiers DROP CONSTRAINT institutional_person_identifiers_identifier_kind_check;
ALTER TABLE public.institutional_person_identifiers ADD CONSTRAINT institutional_person_identifiers_identifier_kind_check
  CHECK (identifier_kind = ANY (ARRAY['cpf-hmac','inep-pessoa','qp-mec','id-profissional']));
COMMENT ON CONSTRAINT institutional_person_identifiers_identifier_kind_check ON public.institutional_person_identifiers IS
  'id-profissional: ID único permanente de profissional não servidor municipal; substitui a matrícula funcional no login (decisão do proprietário 2026-10-16).';

CREATE SEQUENCE IF NOT EXISTS public.non_servant_professional_id_seq START 1;
REVOKE ALL ON SEQUENCE public.non_servant_professional_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.technical_assign_non_servant_professional_ids(_person_ids uuid[], _source_ref text)
RETURNS TABLE(person_id uuid, professional_id text, outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE op uuid := gen_random_uuid(); pid uuid; v text; n_new int := 0; n_skip int := 0;
BEGIN
  IF coalesce(btrim(_source_ref),'') = '' THEN RAISE EXCEPTION 'source_ref obrigatório'; END IF;
  INSERT INTO public.technical_execution_operations(id, operation_kind, executor_kind, executor_label, environment, source_ref, source_hash, requested_by, payload_fingerprint, status, result, started_at)
  VALUES (op, 'technical_assign_non_servant_professional_ids', 'automacao-tecnica', 'agente de desenvolvimento (Lovable)', 'desenvolvimento', _source_ref,
          encode(extensions.digest(array_to_string(_person_ids, ','), 'sha256'), 'hex'), 'decisao-do-proprietario',
          encode(extensions.digest(array_to_string(_person_ids, ','), 'sha256'), 'hex'), 'em-execucao', '{}'::jsonb, now());
  FOREACH pid IN ARRAY _person_ids LOOP
    SELECT i.value INTO v FROM public.institutional_person_identifiers i WHERE i.person_id = pid AND i.identifier_kind = 'id-profissional';
    IF v IS NOT NULL THEN person_id := pid; professional_id := v; outcome := 'ja-existente'; n_skip := n_skip + 1; RETURN NEXT; CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = pid AND p.actor_nature IS DISTINCT FROM 'organ') THEN
      person_id := pid; professional_id := NULL; outcome := 'pessoa-inexistente'; RETURN NEXT; CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.payroll_registration_person_links r WHERE r.person_id = pid)
       OR EXISTS (SELECT 1 FROM public.professional_functional_links f WHERE f.person_id = pid) THEN
      person_id := pid; professional_id := NULL; outcome := 'servidor-com-matricula'; RETURN NEXT; CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_person_identifiers i WHERE i.person_id = pid AND i.identifier_kind = 'cpf-hmac') THEN
      person_id := pid; professional_id := NULL; outcome := 'sem-cpf'; RETURN NEXT; CONTINUE; END IF;
    v := 'P' || lpad(nextval('public.non_servant_professional_id_seq')::text, 6, '0');
    INSERT INTO public.institutional_person_identifiers(person_id, identifier_kind, value, technical_operation_id) VALUES (pid, 'id-profissional', v, op);
    n_new := n_new + 1; person_id := pid; professional_id := v; outcome := 'atribuido'; RETURN NEXT;
  END LOOP;
  UPDATE public.technical_execution_operations SET status = 'concluida', completed_at = now(),
    result = jsonb_build_object('atribuidos', n_new, 'ja_existentes', n_skip) WHERE id = op;
END $$;
REVOKE ALL ON FUNCTION public.technical_assign_non_servant_professional_ids(uuid[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.technical_assign_non_servant_professional_ids(uuid[], text) TO service_role;