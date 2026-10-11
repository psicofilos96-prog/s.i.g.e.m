-- NEI.5: visitas, providências, protocolos com devolutiva e vazamento. Contas sintéticas; termina em exceção (nada persiste).
DO $$
DECLARE st text; sc text; other text; u_tec uuid := gen_random_uuid(); u_aee uuid := gen_random_uuid(); u_b uuid := gen_random_uuid(); u_x uuid := gen_random_uuid();
  vid uuid; aid uuid; n bigint; pid uuid; j jsonb; ok boolean; c int;
BEGIN
  SELECT e.student_id, e.school_id INTO st, sc FROM public.class_enrollment_episodes e WHERE public.nei_enrolled_in(e.student_id, e.school_id) LIMIT 1;
  SELECT id INTO other FROM public.institutional_schools WHERE id <> sc LIMIT 1;
  INSERT INTO public.nei_role_grants(user_id, role, scope_kind, school_id, valid_from, reason, granted_by) VALUES
    (u_tec,'tecnico','escola',sc,CURRENT_DATE,'teste sintético',gen_random_uuid()),
    (u_aee,'aee','escola',sc,CURRENT_DATE,'teste sintético',gen_random_uuid()),
    (u_b,'tecnico','escola',other,CURRENT_DATE,'teste sintético',gen_random_uuid());
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_tec, 'role','authenticated')::text, true);
  -- Visita: agendar, reagendar, realizar com relatório; terminal.
  vid := public.schedule_nei_visit(sc, st, 'Visita técnica de acompanhamento em sala', CURRENT_DATE + 3);
  PERFORM public.record_nei_visit_event(vid, 1, 'reagendada', CURRENT_DATE + 5, NULL);
  BEGIN PERFORM public.record_nei_visit_event(vid, 1, 'realizada', NULL, 'x'); RAISE EXCEPTION 'FAIL stale'; EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%stale%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.record_nei_visit_event(vid, 2, 'realizada', NULL, 'curto'); RAISE EXCEPTION 'FAIL report'; EXCEPTION WHEN others THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
  PERFORM public.record_nei_visit_event(vid, 2, 'realizada', NULL, 'Observação em sala; ajustes de material combinados com a docente.');
  BEGIN PERFORM public.record_nei_visit_event(vid, 3, 'cancelada', NULL, 'tentativa após realizada'); RAISE EXCEPTION 'FAIL terminal'; EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%invalid-transition%' THEN RAISE; END IF; END;
  -- Providência com prazo.
  aid := public.open_nei_action(sc, vid, 'Providenciar material ampliado', CURRENT_DATE + 10, 'Coordenação da escola');
  PERFORM public.record_nei_action_event(aid, 1, 'em-andamento', 'Pedido feito');
  BEGIN PERFORM public.record_nei_action_event(aid, 2, 'concluida', 'ok'); RAISE EXCEPTION 'FAIL short close'; EXCEPTION WHEN others THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
  PERFORM public.record_nei_action_event(aid, 2, 'concluida', 'Material entregue à turma');
  -- Protocolo: texto clínico recusado; destinatário inelegível recusado; AEE elegível.
  BEGIN n := public.send_nei_protocol(sc, st, 'aee', u_aee, 'Encaminhamento CID F84', 'Estudante com laudo recente', NULL); RAISE EXCEPTION 'FAIL clinical'; EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%clinical-text%' THEN RAISE; END IF; END;
  BEGIN n := public.send_nei_protocol(sc, st, 'familia', u_x, 'Convite para reunião', 'Convidamos para reunião na escola.', NULL); RAISE EXCEPTION 'FAIL family'; EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%recipient-not-eligible%' THEN RAISE; END IF; END;
  BEGIN n := public.send_nei_protocol(sc, st, 'docente', u_x, 'Orientação de atividade', 'Sugestão de adaptação de atividade.', NULL); RAISE EXCEPTION 'FAIL docente'; EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%recipient-not-eligible%' THEN RAISE; END IF; END;
  n := public.send_nei_protocol(sc, st, 'aee', u_aee, 'Encaminhamento para AEE', 'Solicitamos avaliação pedagógica para atendimento.', CURRENT_DATE + 7);
  SELECT id INTO pid FROM public.nei_protocols WHERE number = n;
  -- Inbox do AEE: só número/assunto, sem nome nem corpo.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_aee, 'role','authenticated')::text, true);
  SELECT count(*) INTO c FROM public.nei_protocol_inbox(); IF c <> 1 THEN RAISE EXCEPTION 'FAIL inbox %', c; END IF;
  BEGIN PERFORM public.record_nei_protocol_event(pid, 1, 'encerrado', NULL); RAISE EXCEPTION 'FAIL aee closes'; EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%not-authorized%' THEN RAISE; END IF; END;
  PERFORM public.record_nei_protocol_event(pid, 1, 'recebido', NULL);
  PERFORM public.record_nei_protocol_event(pid, 2, 'devolutiva', 'Atendimento iniciado às terças-feiras.');
  -- AEE não lê agenda nem gerencia visitas.
  IF public.nei_school_agenda(sc) IS NOT NULL THEN RAISE EXCEPTION 'FAIL aee agenda'; END IF;
  -- Escola B: sem agenda, sem protocolo, sem documento; recusas registradas.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_b, 'role','authenticated')::text, true);
  IF public.nei_school_agenda(sc) IS NOT NULL THEN RAISE EXCEPTION 'FAIL B agenda'; END IF;
  IF public.open_nei_protocol(pid) IS NOT NULL THEN RAISE EXCEPTION 'FAIL B opens'; END IF;
  SELECT count(*) INTO c FROM public.nei_protocol_inbox(); IF c <> 0 THEN RAISE EXCEPTION 'FAIL B inbox'; END IF;
  BEGIN PERFORM public.record_nei_protocol_event(pid, 3, 'devolutiva', 'tentando responder no lugar'); RAISE EXCEPTION 'FAIL B reply'; EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%not-authorized%' THEN RAISE; END IF; END;
  BEGIN PERFORM public.register_nei_document(vid, NULL, 'x.pdf', 'application/pdf', 10); RAISE EXCEPTION 'FAIL B doc'; EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%not-authorized%' THEN RAISE; END IF; END;
  SELECT EXISTS (SELECT 1 FROM public.nei_access_events WHERE user_id = u_b AND outcome = 'recusado' AND action = 'protocolo-abrir') INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'FAIL refusal not logged'; END IF;
  -- Gestão A: agenda completa, encerra protocolo, documento com retenção nula e acesso só por regra.
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_tec, 'role','authenticated')::text, true);
  j := public.nei_school_agenda(sc);
  IF jsonb_array_length(j->'visits') < 1 OR jsonb_array_length(j->'actions') < 1 OR (j->'protocols'->0->>'last_stage') <> 'devolutiva' THEN RAISE EXCEPTION 'FAIL agenda %', j; END IF;
  PERFORM public.record_nei_protocol_event(pid, 3, 'encerrado', 'Encaminhamento concluído');
  IF public.register_nei_document(NULL, pid, 'relatorio.pdf', 'application/pdf', 1000) IS NULL THEN RAISE EXCEPTION 'FAIL doc'; END IF;
  IF EXISTS (SELECT 1 FROM public.nei_documents WHERE protocol_id = pid AND retention_class IS NOT NULL) THEN RAISE EXCEPTION 'FAIL retention invented'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_b, 'role','authenticated')::text, true);
  IF EXISTS (SELECT 1 FROM public.nei_documents d WHERE d.protocol_id = pid AND public.nei_document_allowed(d.object_path, false)) THEN RAISE EXCEPTION 'FAIL B doc read'; END IF;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', u_aee, 'role','authenticated')::text, true);
  IF NOT EXISTS (SELECT 1 FROM public.nei_documents d WHERE d.protocol_id = pid AND public.nei_document_allowed(d.object_path, false)) THEN RAISE EXCEPTION 'FAIL recipient doc read'; END IF;
  BEGIN UPDATE public.nei_protocol_events SET note = 'x' WHERE protocol_id = pid; RAISE EXCEPTION 'FAIL mutable'; EXCEPTION WHEN others THEN IF SQLERRM LIKE 'FAIL%' THEN RAISE; END IF; END;
  -- Anônimo.
  PERFORM set_config('request.jwt.claims', '', true);
  BEGIN PERFORM public.nei_protocol_inbox(); RAISE EXCEPTION 'FAIL anon'; EXCEPTION WHEN others THEN IF SQLERRM NOT LIKE '%session-required%' THEN RAISE; END IF; END;
  RAISE EXCEPTION 'NEI5_PASS';
END $$;
