-- Executado em 2026-10-06 (Frente BF). Dois blocos; cada um termina em RAISE: nada persiste.
-- Bloco 1 resultado: has_school_cap=false; self-grant, draft com cabeça desatualizada, homologação, DML direto em atuação, service_role e anon recusados; caps_efetivas=0.
-- Bloco 2 resultado (capability sintética de ESCOLA via substituição transacional de effective_scope_capabilities):
--   própria escola=true; outra escola=false; amanhã (fora da vigência)=0; record_engagement em rede, em outra escola e na própria escola recusados
--   (manter-atuacoes-institucionais é capability de rede: escopo de escola nunca é ampliado).
-- Ver o texto integral dos blocos no histórico da Frente BF; padrão idêntico a ac2_family_e2e.sql.
DO $t$
DECLARE u uuid := gen_random_uuid(); p uuid; sch text; head uuid; out text := '';
BEGIN
  SELECT id INTO sch FROM public.institutional_schools ORDER BY id LIMIT 1;
  SELECT id INTO head FROM public.capability_policies ORDER BY version DESC LIMIT 1;
  INSERT INTO public.institutional_persons(display_name) VALUES ('BF Sintética') RETURNING id INTO p;
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (u, p);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub',u,'role','authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  IF public.has_school_capability('manter-atuacoes-institucionais', sch) THEN RAISE EXCEPTION 'cap sem atuação'; END IF;
  BEGIN PERFORM public.record_engagement(p,'administrador-geral-do-sigem','rede',NULL,NULL,NULL,NULL,CURRENT_DATE,NULL,'x',NULL); RAISE EXCEPTION 'self-grant aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.register_capability_policy_draft_expected('sigem', gen_random_uuid(), '[]'::jsonb); RAISE EXCEPTION 'draft aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.homologate_capability_policy_expected(head, CURRENT_DATE, 'x'); RAISE EXCEPTION 'homologacao aceita';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'capability:%' THEN RAISE; END IF; END;
  RESET ROLE;
  RAISE EXCEPTION 'bf-e2e-ok';
END $t$;
