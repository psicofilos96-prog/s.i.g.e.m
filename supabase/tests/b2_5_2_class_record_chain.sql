-- Prova estrutural complementar da B2.5.2. Após a migration, somente em
-- transação explicitamente revertida; não cadastra fatos oficiais.
BEGIN;
CREATE TEMP TABLE b252_chain_results(n integer PRIMARY KEY, scenario text NOT NULL, result text NOT NULL);
DO $chain_test$
DECLARE
  test_policy uuid;
  test_person uuid := '00000000-0000-0000-0000-00000000b591';
  test_engagement uuid := '00000000-0000-0000-0000-00000000b592';
  test_root uuid := '00000000-0000-0000-0000-00000000b593';
  test_segment uuid := '00000000-0000-0000-0000-00000000b594';
  cycle_a uuid := '00000000-0000-0000-0000-00000000b595';
  cycle_b uuid := '00000000-0000-0000-0000-00000000b596';
BEGIN
  SELECT p.id INTO test_policy FROM public.capability_policies p
    WHERE p.logical_policy_id='politica-capacidades-diario' AND p.version=2;
  IF test_policy IS NULL OR EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id LIKE 'turma-b252-chain-%')
  THEN RAISE EXCEPTION 'b252-chain:baseline'; END IF;
  INSERT INTO public.institutional_persons(id,display_name) VALUES (test_person,'Prova de cadeia');
  INSERT INTO public.institutional_schools(id) VALUES ('esc-b252-chain');
  INSERT INTO public.institutional_academic_years(id) VALUES ('ano-b252-chain');
  INSERT INTO public.institutional_engagements
    (id,person_id,engagement_kind_id,scope_level,school_id,valid_from)
  VALUES (test_engagement,test_person,'secretaria-escolar','escola','esc-b252-chain','2020-01-01');
  INSERT INTO public.institutional_classes
    (id,school_id,school_label_snapshot,academic_year_id,academic_year_label,name,valid_from)
  VALUES
    ('turma-b252-chain-a','esc-b252-chain','Escola','ano-b252-chain','Ano','A','2026-01-01'),
    ('turma-b252-chain-b','esc-b252-chain','Escola','ano-b252-chain','Ano','B','2026-01-01');
  INSERT INTO public.institutional_engagements
    (id,person_id,engagement_kind_id,scope_level,school_id,valid_from)
  VALUES ('00000000-0000-0000-0000-00000000b597',test_person,
          'professor','turmas','esc-b252-chain','2020-01-01');
  INSERT INTO public.institutional_engagement_scope_classes
    (engagement_id,class_id,originating_act_ref)
  VALUES ('00000000-0000-0000-0000-00000000b597','turma-b252-chain-a','ato-escopo');

  -- 1. A FK do ano protege o contexto estrutural na identidade.
  BEGIN
    INSERT INTO public.institutional_classes
      (id,school_id,school_label_snapshot,academic_year_id,academic_year_label,name,valid_from)
    VALUES ('turma-b252-chain-invalid','esc-b252-chain','Escola','ano-inexistente','Ano','X','2026-01-01');
    RAISE EXCEPTION 'b252-chain:year-fk-accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    IF position('institutional_classes_academic_year_fk' in SQLERRM)=0 THEN RAISE; END IF;
  END;
  INSERT INTO b252_chain_results VALUES (1,'FK estrutural do ano','PASS');

  INSERT INTO public.institutional_class_record_versions
    (id,class_id,segment_id,version,name,administrative_status,valid_from,valid_until,
     originating_act_ref,recorded_by,recorded_by_person_id,recorded_via_engagement_id,
     authorizing_policy_id,created_at)
  VALUES
    (test_root,'turma-b252-chain-a',test_segment,1,'A','ativa','2026-01-01','2026-12-31',
     'ato-1',test_person,test_person,test_engagement,test_policy,'2026-01-01 12:00:00+00');

  -- 2. Um segmento tem somente uma raiz.
  BEGIN
    INSERT INTO public.institutional_class_record_versions
      (class_id,segment_id,version,name,administrative_status,valid_from,
       change_reason,originating_act_ref,recorded_by,recorded_by_person_id,
       recorded_via_engagement_id,authorizing_policy_id)
    VALUES ('turma-b252-chain-a',test_segment,2,'Raiz duplicada','ativa','2027-01-01',
            'teste','ato',test_person,test_person,test_engagement,test_policy);
    RAISE EXCEPTION 'b252-chain:second-root-accepted';
  EXCEPTION WHEN unique_violation THEN
    IF position('institutional_class_record_segment_root_idx' in SQLERRM)=0 THEN RAISE; END IF;
  END;
  INSERT INTO b252_chain_results VALUES (2,'Raiz única por turma/segmento','PASS');

  -- 3. A FK composta proíbe apontar para versão de outra turma.
  BEGIN
    INSERT INTO public.institutional_class_record_versions
      (class_id,segment_id,version,supersedes_id,name,administrative_status,valid_from,
       change_reason,originating_act_ref,recorded_by,recorded_by_person_id,
       recorded_via_engagement_id,authorizing_policy_id)
    VALUES ('turma-b252-chain-b',test_segment,1,test_root,'B','ativa','2026-01-01',
            'teste','ato',test_person,test_person,test_engagement,test_policy);
    RAISE EXCEPTION 'b252-chain:cross-class-accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
  INSERT INTO b252_chain_results VALUES (3,'supersedes de outra turma recusado','PASS');

  -- 4. A mesma FK proíbe trocar o segmento de uma correção.
  BEGIN
    INSERT INTO public.institutional_class_record_versions
      (class_id,segment_id,version,supersedes_id,name,administrative_status,valid_from,
       change_reason,originating_act_ref,recorded_by,recorded_by_person_id,
       recorded_via_engagement_id,authorizing_policy_id)
    VALUES ('turma-b252-chain-a',gen_random_uuid(),2,test_root,'A','ativa','2026-01-01',
            'teste','ato',test_person,test_person,test_engagement,test_policy);
    RAISE EXCEPTION 'b252-chain:cross-segment-accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
  INSERT INTO b252_chain_results VALUES (4,'supersedes de outro segmento recusado','PASS');

  -- 5. Uma versão tem somente um sucessor.
  INSERT INTO public.institutional_class_record_versions
    (class_id,segment_id,version,supersedes_id,name,administrative_status,valid_from,valid_until,
     change_reason,originating_act_ref,recorded_by,recorded_by_person_id,
     recorded_via_engagement_id,authorizing_policy_id,created_at)
  VALUES ('turma-b252-chain-a',test_segment,2,test_root,'A corrigida','ativa',
          '2026-01-01','2026-12-31','correção','ato-2',
          test_person,test_person,test_engagement,test_policy,'2026-02-01 12:00:00+00');
  BEGIN
    INSERT INTO public.institutional_class_record_versions
      (class_id,segment_id,version,supersedes_id,name,administrative_status,valid_from,
       change_reason,originating_act_ref,recorded_by,recorded_by_person_id,
       recorded_via_engagement_id,authorizing_policy_id)
    VALUES ('turma-b252-chain-a',test_segment,3,test_root,'Outra correção','ativa',
            '2026-01-01','teste','ato',test_person,test_person,test_engagement,test_policy);
    RAISE EXCEPTION 'b252-chain:duplicate-successor-accepted';
  EXCEPTION WHEN unique_violation THEN
    IF position('institutional_class_record_versions_supersedes_id_key' in SQLERRM)=0 THEN RAISE; END IF;
  END;
  INSERT INTO b252_chain_results VALUES (5,'Substituição única da base','PASS');

  -- 6. Auto referência e ciclo de duas versões são impossíveis.
  BEGIN
    INSERT INTO public.institutional_class_record_versions
      (id,class_id,segment_id,version,supersedes_id,name,administrative_status,valid_from,
       change_reason,originating_act_ref,recorded_by,recorded_by_person_id,
       recorded_via_engagement_id,authorizing_policy_id)
    VALUES (cycle_a,'turma-b252-chain-a',gen_random_uuid(),100,cycle_a,'Ciclo','ativa',
            '2026-01-01','teste','ato',test_person,test_person,test_engagement,test_policy);
    RAISE EXCEPTION 'b252-chain:self-cycle-accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
  BEGIN
    INSERT INTO public.institutional_class_record_versions
      (id,class_id,segment_id,version,supersedes_id,name,administrative_status,valid_from,
       change_reason,originating_act_ref,recorded_by,recorded_by_person_id,
       recorded_via_engagement_id,authorizing_policy_id)
    VALUES
      (cycle_a,'turma-b252-chain-a',cycle_b,100,cycle_b,'Ciclo A','ativa',
       '2026-01-01','teste','ato',test_person,test_person,test_engagement,test_policy),
      (cycle_b,'turma-b252-chain-a',cycle_b,101,cycle_a,'Ciclo B','ativa',
       '2026-01-01','teste','ato',test_person,test_person,test_engagement,test_policy);
    RAISE EXCEPTION 'b252-chain:two-cycle-accepted';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:invalid-version-chain%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_chain_results VALUES (6,'Ciclos de um e dois nós recusados','PASS');

  -- 7. Em T anterior à correção, a cabeça conhecida ainda é a raiz.
  IF (SELECT v.name FROM public.class_at('turma-b252-chain-a','2026-03-01',
      '2026-01-15 00:00:00+00') v) <> 'A'
    OR (SELECT v.name FROM public.class_at('turma-b252-chain-a','2026-03-01',
      '2026-02-15 00:00:00+00') v) <> 'A corrigida'
  THEN RAISE EXCEPTION 'b252-chain:as-known'; END IF;
  INSERT INTO b252_chain_results VALUES (7,'Cabeça conhecida em T','PASS');
  IF (SELECT s.class_id FROM public.institutional_engagement_scope_classes s
      WHERE s.engagement_id='00000000-0000-0000-0000-00000000b597') <> 'turma-b252-chain-a'
    OR (SELECT count(*) FROM public.institutional_classes c WHERE c.id='turma-b252-chain-a') <> 1
  THEN RAISE EXCEPTION 'b252-chain:reference-moved'; END IF;
  INSERT INTO b252_chain_results VALUES (9,'Referência existente mantém classId','PASS');

  -- 8. Mesmo se um operador privilegiado corrompesse intervalos, o leitor
  -- nunca escolheria silenciosamente a maior versão.
  INSERT INTO public.institutional_class_record_versions
    (class_id,segment_id,version,name,administrative_status,valid_from,valid_until,
     change_reason,originating_act_ref,recorded_by,recorded_by_person_id,
     recorded_via_engagement_id,authorizing_policy_id)
  VALUES ('turma-b252-chain-a',gen_random_uuid(),3,'Sobreposta','ativa',
          '2026-03-01','2026-03-31','prova de ambiguidade','ato-3',
          test_person,test_person,test_engagement,test_policy);
  BEGIN
    PERFORM 1 FROM public.class_at('turma-b252-chain-a','2026-03-15',NULL) v;
    RAISE EXCEPTION 'b252-chain:ambiguity-silently-resolved';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM NOT LIKE '%class:ambiguous-temporal-state%' THEN RAISE; END IF;
  END;
  INSERT INTO b252_chain_results VALUES (8,'Leitor recusa ambiguidade','PASS');
END $chain_test$;
SELECT n,scenario,result FROM b252_chain_results ORDER BY n;
ROLLBACK;
