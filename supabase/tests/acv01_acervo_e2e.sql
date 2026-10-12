-- ACV.1 — prova executável no banco vivo com contas reais de setor (bloco termina em RAISE: nada persiste).
-- Cenários: dois setores, servidor sem vínculo na escola, herança de permissão, pasta aninhada, upload múltiplo,
-- colisão, mover entre setores (permissão nos dois lados), versão, lixeira/restauração, cota, isolamento RLS.
DO $$
DECLARE
  dir_uid uuid := 'bf87eefb-2860-4b1d-ac8c-b232a917d6f0';  -- Direção inep-33094756
  sec_uid uuid := '2277d993-7feb-4ae1-8f62-3e748561b821';  -- Secretaria inep-33094756
  dir2_uid uuid := 'ab1fa83e-ffe2-4106-88ce-afb6784c76ba'; -- Direção inep-33002061 (outra escola)
  srv_uid uuid := 'df4f1255-73bc-4399-95b3-4f43591d5c7d';  -- servidor com atuação só de rede (sem vínculo na escola)
  srv_person uuid := '076951f6-914f-4c3b-a1f3-92c0a8979b2b';
  s_dir uuid; s_sec uuid; f_root uuid; f_sub uuid; f_deep uuid; up record; n1 uuid; n2 uuid; cnt int; ok boolean;
  sha text := repeat('a', 64);
BEGIN
  -- helper inline: troca de sessão
  PERFORM set_config('request.jwt.claims', json_build_object('sub', dir_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', dir_uid::text, true);
  SET LOCAL ROLE authenticated;
  s_dir := public.acv_ensure_space();
  f_root := public.acv_create_folder(s_dir, NULL, 'Atas', 'k-root-0001');
  IF public.acv_create_folder(s_dir, NULL, 'Atas', 'k-root-0001') <> f_root THEN RAISE EXCEPTION 'falha: idempotencia'; END IF;
  BEGIN PERFORM public.acv_create_folder(s_dir, NULL, 'atas', 'k-root-0002'); RAISE EXCEPTION 'falha: colisao aceita';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'nome-em-uso' THEN RAISE; END IF; END;
  f_sub := public.acv_create_folder(s_dir, f_root, '2026', 'k-sub-0001');
  f_deep := public.acv_create_folder(s_dir, f_sub, 'Conselho', 'k-deep-0001');
  BEGIN PERFORM public.acv_move(f_root, s_dir, f_deep, 'k-cycle-001'); RAISE EXCEPTION 'falha: ciclo aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'ciclo' THEN RAISE; END IF; END;
  BEGIN PERFORM public.acv_create_folder(s_dir, NULL, '../x', 'k-bad-00001'); RAISE EXCEPTION 'falha: nome invalido aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'nome-invalido' THEN RAISE; END IF; END;

  -- upload múltiplo (2 arquivos) na pasta aninhada
  FOR i IN 1..2 LOOP
    SELECT * INTO up FROM public.acv_begin_upload('k-up-000' || i, s_dir, f_deep, NULL, 'ata-' || i || '.pdf', sha, 10, 'application/pdf');
    RESET ROLE;
    INSERT INTO storage.objects(bucket_id, name, owner, metadata) VALUES ('acervo-documental', up.storage_path, dir_uid, jsonb_build_object('size', 10, 'mimetype', 'application/pdf'));
    SET LOCAL ROLE authenticated;
    IF i = 1 THEN n1 := public.acv_commit_upload(up.upload_id); ELSE n2 := public.acv_commit_upload(up.upload_id); END IF;
  END LOOP;
  BEGIN PERFORM * FROM public.acv_begin_upload('k-up-html1', s_dir, f_deep, NULL, 'x.html', sha, 10, 'text/html'); RAISE EXCEPTION 'falha: html aceito';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'tipo-nao-permitido' THEN RAISE; END IF; END;
  BEGIN PERFORM * FROM public.acv_begin_upload('k-up-mism1', s_dir, f_deep, NULL, 'x.pdf', sha, 10, 'image/png'); RAISE EXCEPTION 'falha: extensao/MIME divergentes aceitos';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'tipo-nao-permitido' THEN RAISE; END IF; END;
  BEGIN PERFORM * FROM public.acv_begin_upload('k-up-dup01', s_dir, f_deep, NULL, 'ATA-1.pdf', sha, 10, 'application/pdf'); RAISE EXCEPTION 'falha: colisao de arquivo';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'nome-em-uso' THEN RAISE; END IF; END;
  -- confirmação sem bytes enviados
  SELECT * INTO up FROM public.acv_begin_upload('k-up-nob01', s_dir, f_deep, NULL, 'vazio.pdf', sha, 10, 'application/pdf');
  BEGIN PERFORM public.acv_commit_upload(up.upload_id); RAISE EXCEPTION 'falha: commit sem bytes';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'arquivo-nao-enviado' THEN RAISE; END IF; END;

  -- nova versão
  SELECT * INTO up FROM public.acv_begin_upload('k-up-v2-01', s_dir, NULL, n1, NULL, repeat('b', 64), 12, 'application/pdf');
  RESET ROLE;
  INSERT INTO storage.objects(bucket_id, name, owner, metadata) VALUES ('acervo-documental', up.storage_path, dir_uid, jsonb_build_object('size', 12, 'mimetype', 'application/pdf'));
  SET LOCAL ROLE authenticated;
  PERFORM public.acv_commit_upload(up.upload_id);
  SELECT count(*) INTO cnt FROM public.acv_file_versions WHERE node_id = n1;
  IF cnt <> 2 THEN RAISE EXCEPTION 'falha: versionamento %', cnt; END IF;

  -- cota
  PERFORM public.acv_set_quota(s_dir, 40, 'k-quota-001');
  BEGIN PERFORM * FROM public.acv_begin_upload('k-up-quo01', s_dir, f_deep, NULL, 'grande.pdf', sha, 30, 'application/pdf'); RAISE EXCEPTION 'falha: cota ignorada';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'cota-excedida' THEN RAISE; END IF; END;
  PERFORM public.acv_set_quota(s_dir, NULL, 'k-quota-002');

  -- lixeira e restauração; documento continua existindo
  PERFORM public.acv_trash(f_sub, 'k-trash-001');
  IF NOT public.acv_node_trashed(n1) THEN RAISE EXCEPTION 'falha: heranca da lixeira'; END IF;
  BEGIN PERFORM public.acv_restore(f_deep, 'k-rest-0001'); RAISE EXCEPTION 'falha: restaurar dentro de pasta na lixeira';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT IN ('pasta-de-origem-na-lixeira', 'fora-da-lixeira') THEN RAISE; END IF; END;
  PERFORM public.acv_restore(f_sub, 'k-rest-0002');

  -- servidor sem vínculo na escola: não vira membro e não vê nada
  BEGIN PERFORM public.acv_add_member(s_dir, srv_person, NULL, 'visualizar', 'k-mem-0001'); RAISE EXCEPTION 'falha: membro sem vinculo';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'destinatario-sem-vinculo' THEN RAISE; END IF; END;
  -- compartilhamento herdado: servidor (atuação de rede vigente) recebe visualizar em Atas
  PERFORM public.acv_share(f_root, srv_person, NULL, 'visualizar', 'k-share-001');

  PERFORM set_config('request.jwt.claims', json_build_object('sub', srv_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', srv_uid::text, true);
  SELECT count(*) INTO cnt FROM public.acv_nodes WHERE id IN (f_root, f_sub, f_deep, n1, n2);
  IF cnt <> 5 THEN RAISE EXCEPTION 'falha: heranca de compartilhamento %', cnt; END IF;
  IF public.acv_node_rank(n1) <> 1 THEN RAISE EXCEPTION 'falha: papel herdado'; END IF;
  BEGIN PERFORM public.acv_rename(n1, 'outro.pdf', 'k-ren-srv01'); RAISE EXCEPTION 'falha: visualizador renomeou';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'sem-permissao' THEN RAISE; END IF; END;

  -- outra escola (mesmo tipo de setor): isolamento total
  PERFORM set_config('request.jwt.claims', json_build_object('sub', dir2_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', dir2_uid::text, true);
  SELECT count(*) INTO cnt FROM public.acv_nodes WHERE space_id = s_dir;
  IF cnt <> 0 THEN RAISE EXCEPTION 'falha: isolamento entre escolas %', cnt; END IF;
  SELECT count(*) INTO cnt FROM storage.objects WHERE bucket_id = 'acervo-documental';
  IF cnt <> 0 THEN RAISE EXCEPTION 'falha: storage visivel a outra escola'; END IF;

  -- segundo setor (Secretaria, mesma escola): não vê Direção; mover exige permissão nos dois lados
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sec_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', sec_uid::text, true);
  s_sec := public.acv_ensure_space();
  SELECT count(*) INTO cnt FROM public.acv_nodes WHERE space_id = s_dir;
  IF cnt <> 0 THEN RAISE EXCEPTION 'falha: isolamento entre setores'; END IF;
  BEGIN PERFORM public.acv_move(n2, s_sec, NULL, 'k-mv-sec001'); RAISE EXCEPTION 'falha: mover sem permissao na origem';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'sem-permissao' THEN RAISE; END IF; END;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', dir_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', dir_uid::text, true);
  BEGIN PERFORM public.acv_move(n2, s_sec, NULL, 'k-mv-dir001'); RAISE EXCEPTION 'falha: mover sem permissao no destino';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM <> 'sem-permissao-no-destino' THEN RAISE; END IF; END;

  -- Secretaria concede organizar à Direção no seu espaço → mover passa e trilha registra nos dois espaços
  PERFORM set_config('request.jwt.claims', json_build_object('sub', sec_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', sec_uid::text, true);
  PERFORM public.acv_add_member(s_sec, NULL, 'a565ee18-f04b-4250-bb46-265d23aa272c', 'organizar', 'k-mem-sec01');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', dir_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', dir_uid::text, true);
  PERFORM public.acv_move(n2, s_sec, NULL, 'k-mv-dir002');
  RESET ROLE;
  SELECT count(*) INTO cnt FROM public.acv_events WHERE node_id = n2 AND action IN ('movido', 'recebido');
  IF cnt <> 2 THEN RAISE EXCEPTION 'falha: trilha de movimentacao %', cnt; END IF;
  -- sem DML direta
  SET LOCAL ROLE authenticated;
  BEGIN UPDATE public.acv_nodes SET name = 'x' WHERE id = n1; RAISE EXCEPTION 'falha: update direto';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  BEGIN DELETE FROM public.acv_file_versions; RAISE EXCEPTION 'falha: delete direto';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  RAISE EXCEPTION 'ACV01-OK';
END $$;
