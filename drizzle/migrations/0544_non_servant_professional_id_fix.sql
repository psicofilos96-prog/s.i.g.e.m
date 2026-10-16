CREATE OR REPLACE FUNCTION public.technical_assign_non_servant_professional_ids(_person_ids uuid[], _source_ref text)
RETURNS TABLE(person_id uuid, professional_id text, outcome text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE op uuid := gen_random_uuid(); pid uuid; v text; h text;
BEGIN
  IF coalesce(btrim(_source_ref),'') = '' THEN RAISE EXCEPTION 'source_ref obrigatório'; END IF;
  h := encode(extensions.digest(array_to_string(_person_ids, ','), 'sha256'), 'hex');
  INSERT INTO public.technical_execution_operations(id, operation_kind, executor_kind, executor_label, environment, source_ref, source_hash, requested_by, payload_fingerprint, status, result, started_at, completed_at)
  VALUES (op, 'technical_assign_non_servant_professional_ids', 'automacao-tecnica', 'agente de desenvolvimento (Lovable)', 'desenvolvimento', _source_ref,
          h, 'decisao-do-proprietario', h, 'concluida', jsonb_build_object('pessoas', cardinality(_person_ids)), now(), now());
  FOREACH pid IN ARRAY _person_ids LOOP
    person_id := pid; professional_id := NULL;
    SELECT i.value INTO v FROM public.institutional_person_identifiers i WHERE i.person_id = pid AND i.identifier_kind = 'id-profissional';
    IF v IS NOT NULL THEN professional_id := v; outcome := 'ja-existente'; RETURN NEXT; CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = pid AND p.actor_nature = 'pessoa-natural') THEN
      outcome := 'nao-e-pessoa-natural'; RETURN NEXT; CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM public.payroll_registration_person_links r WHERE r.person_id = pid)
       OR EXISTS (SELECT 1 FROM public.professional_functional_links f WHERE f.person_id = pid) THEN
      outcome := 'servidor-com-matricula'; RETURN NEXT; CONTINUE; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_person_identifiers i WHERE i.person_id = pid AND i.identifier_kind = 'cpf-hmac') THEN
      outcome := 'sem-cpf'; RETURN NEXT; CONTINUE; END IF;
    v := 'P' || lpad(nextval('public.non_servant_professional_id_seq')::text, 6, '0');
    INSERT INTO public.institutional_person_identifiers(person_id, identifier_kind, value, technical_operation_id) VALUES (pid, 'id-profissional', v, op);
    professional_id := v; outcome := 'atribuido'; RETURN NEXT;
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.technical_assign_non_servant_professional_ids(uuid[], text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.technical_assign_non_servant_professional_ids(uuid[], text) TO service_role;