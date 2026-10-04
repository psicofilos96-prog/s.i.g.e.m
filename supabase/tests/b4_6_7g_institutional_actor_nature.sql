-- Atores fictícios; rollback integral pelo marcador final. Sem instalação real.
DO $t$
DECLARE p uuid := gen_random_uuid();
BEGIN
  IF has_function_privilege('authenticated', 'public.install_sigem_reviewed(text,text,text,text,text,uuid,text,boolean)', 'EXECUTE')
    THEN RAISE EXCEPTION 'actor:old-entry-open'; END IF;
  IF NOT has_function_privilege('authenticated', 'public.install_sigem_reviewed(text,text,text,text,text,text,uuid,text,boolean)', 'EXECUTE')
    THEN RAISE EXCEPTION 'actor:new-entry-closed'; END IF;
  IF has_function_privilege('anon', 'public.install_sigem_reviewed(text,text,text,text,text,text,uuid,text,boolean)', 'EXECUTE')
    THEN RAISE EXCEPTION 'actor:anon-entry-open'; END IF;
  IF has_table_privilege('authenticated', 'public.institutional_actor_nature_origins', 'INSERT')
    OR has_table_privilege('anon', 'public.institutional_actor_nature_origins', 'SELECT')
    THEN RAISE EXCEPTION 'actor:origin-public'; END IF;
  INSERT INTO public.institutional_persons(id, display_name, actor_nature)
    VALUES (p, 'Órgão fictício para teste', 'orgao-institucional');
  INSERT INTO public.institutional_actor_nature_origins(person_id, actor_nature, origin, recorded_by)
    VALUES (p, 'orgao-institucional', 'teste com rollback', gen_random_uuid());
  BEGIN
    UPDATE public.institutional_actor_nature_origins SET actor_nature = 'pessoa-natural' WHERE person_id = p;
    RAISE EXCEPTION 'actor:origin-mutable';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'actor:origin-mutable' THEN RAISE; END IF;
  END;
  BEGIN
    INSERT INTO public.institutional_persons(display_name, actor_nature) VALUES ('Teste', 'inventada');
    RAISE EXCEPTION 'actor:unknown-nature';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  RAISE EXCEPTION 'b467g-tests-ok: explicit-institutional-actor immutable-origin private-acls closed-old-entry';
END $t$;
