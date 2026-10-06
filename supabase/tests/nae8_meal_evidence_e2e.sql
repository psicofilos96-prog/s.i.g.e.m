-- NAE.8 Lote 2 — prova transacional de ACL/versionamento das evidências (termina em RAISE: nada persiste).
-- O objeto binário real é provado à parte pelo mesmo bucket (upload, hash, URL assinada, recusas, remoção).
DO $t$
DECLARE _ok text := ''; s1 text; s2 text; n int; p1 text; p2 text; ev uuid; id1 uuid; id2 uuid; x text;
  fd1 uuid := gen_random_uuid(); fd2 uuid := gen_random_uuid();
  pS uuid := gen_random_uuid(); uS uuid := gen_random_uuid(); pO uuid := gen_random_uuid(); uO uuid := gen_random_uuid();
  pN uuid := gen_random_uuid(); uN uuid := gen_random_uuid(); pT uuid := gen_random_uuid(); uT uuid := gen_random_uuid();
  sha text := 'c414cd0e204de974f73753c7e28d7638e7b3691bb8b1a2bab6b25bb7fed7ce77';
  c_rec int; c_mov int; c_fd int;
BEGIN
  SELECT id INTO s1 FROM public.institutional_schools ORDER BY id LIMIT 1;
  SELECT id INTO s2 FROM public.institutional_schools ORDER BY id OFFSET 1 LIMIT 1;
  IF (SELECT count(*) FROM public.meal_evidence_attachments) <> 0 THEN RAISE EXCEPTION 'pre: evidências não vazias'; END IF;
  INSERT INTO public.institutional_persons(id, display_name, actor_nature) VALUES
    (pS,'NAE8L2 Escola','pessoa-natural'),(pO,'NAE8L2 Outra escola','pessoa-natural'),(pN,'NAE8L2 Rede','pessoa-natural'),(pT,'NAE8L2 Órgão técnico','orgao-institucional');
  INSERT INTO public.user_person_links(user_id, person_id) VALUES (uS,pS),(uO,pO),(uN,pN),(uT,pT);
  INSERT INTO public.meal_fiscal_documents(logical_id, version, status, school_id, number, sha256, author_user_id, author_person_id, author_engagement) VALUES
    (fd1,1,'recebido',s1,'NAE8-SINT-1',sha,uS,pS,gen_random_uuid()),(fd2,1,'recebido',s2,'NAE8-SINT-2',sha,uO,pO,gen_random_uuid());
  SELECT count(*) INTO c_rec FROM public.meal_receipts; SELECT count(*) INTO c_mov FROM public.meal_inventory_movements; SELECT count(*) INTO c_fd FROM public.meal_fiscal_documents;

  CREATE TEMP TABLE nae8_caps(u uuid, cap text, scope text, school text) ON COMMIT DROP;
  INSERT INTO nae8_caps VALUES (uS,'conferir-recebimento-alimentar','escola',s1),(uO,'conferir-recebimento-alimentar','escola',s2),
    (uN,'acompanhar-alimentacao-rede','rede',NULL),(uT,'conferir-recebimento-alimentar','escola',s1);
  GRANT SELECT ON nae8_caps TO authenticated;
  ALTER FUNCTION public.effective_scope_capabilities(date) RENAME TO esc_nae8_original;
  CREATE FUNCTION public.effective_scope_capabilities(_on date DEFAULT CURRENT_DATE)
    RETURNS TABLE(capability_id text, engagement_id uuid, policy_id uuid, policy_version integer, scope_level text, school_id text)
    LANGUAGE sql STABLE SET search_path TO '' AS $b$
      SELECT c.cap, md5(c.u::text || c.scope)::uuid, '00000000-0000-0000-0000-0000000000e8'::uuid, 1, c.scope, c.school
      FROM pg_temp.nae8_caps c WHERE c.u = auth.uid() $b$;
  GRANT EXECUTE ON FUNCTION public.effective_scope_capabilities(date) TO authenticated;
  CREATE FUNCTION pg_temp.nae8_as(_u uuid) RETURNS void LANGUAGE sql AS $b$
    SELECT set_config('request.jwt.claims', CASE WHEN _u IS NULL THEN '' ELSE jsonb_build_object('sub', _u, 'role','authenticated')::text END, true) $b$;
  CREATE FUNCTION pg_temp.nae8_fail(_sql text, _pat text) RETURNS void LANGUAGE plpgsql AS $b$
    BEGIN EXECUTE _sql; RAISE EXCEPTION 'nae8-should-fail[%]: %', _pat, left(_sql, 120);
    EXCEPTION WHEN others THEN IF SQLERRM LIKE 'nae8-should-fail%' OR SQLERRM NOT LIKE '%' || _pat || '%' THEN
      RAISE EXCEPTION 'nae8-unexpected[%]: %', _pat, SQLERRM; END IF; END $b$;

  SET LOCAL ROLE anon;
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_evidence_slot(%L,%L,%L,70)','documento-fiscal',fd1,'image/png'), 'permission denied');
  PERFORM pg_temp.nae8_fail(format('SELECT * FROM public.meal_evidence_for(%L,%L)','documento-fiscal',fd1), 'permission denied');
  RESET ROLE; SET LOCAL ROLE authenticated;
  PERFORM pg_temp.nae8_as(uS);
  PERFORM pg_temp.nae8_fail(format('INSERT INTO public.meal_evidence_attachments(logical_id,version,event_kind,target_kind,target_logical_id,school_id,storage_path,sha256,media_type,size_bytes,author_user_id,author_person_id,author_engagement) VALUES (gen_random_uuid(),1,%L,%L,%L,%L,%L,%L,%L,70,%L,%L,gen_random_uuid())','anexacao','documento-fiscal',fd1,s1,'x/y',sha,'image/png',uS,pS), 'permission denied');
  PERFORM pg_temp.nae8_fail('SELECT * FROM public.meal_evidence_attachments', 'permission denied');
  PERFORM pg_temp.nae8_as(NULL);
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_evidence_slot(%L,%L,%L,70)','documento-fiscal',fd1,'image/png'), 'session-required');
  PERFORM pg_temp.nae8_as(uT);
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_evidence_slot(%L,%L,%L,70)','documento-fiscal',fd1,'image/png'), 'natural-person-required');
  _ok := _ok || 'anon,dml-direto,sem-sessao,ator-tecnico;';

  PERFORM pg_temp.nae8_as(uS);
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_evidence_slot(%L,%L,%L,70)','documento-fiscal',fd1,'text/html'), 'evidence-media-type');
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_evidence_slot(%L,%L,%L,20000000)','documento-fiscal',fd1,'image/png'), 'evidence-size');
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_evidence_slot(%L,%L,%L,70)','documento-fiscal',gen_random_uuid(),'image/png'), 'evidence-target-unknown');
  p1 := public.meal_evidence_slot('documento-fiscal', fd1, 'image/png', 70);
  IF p1 NOT LIKE s1 || '/documento-fiscal/' || fd1 || '/%' THEN RAISE EXCEPTION 'falha: caminho %', p1; END IF;
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_evidence(NULL,NULL,%L,%L,%L,%L,%L,%L,70,NULL,NULL)','anexacao','documento-fiscal',fd1,s2||'/documento-fiscal/'||fd2||'/z',sha,'image/png'), 'evidence-path');
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_evidence(NULL,NULL,%L,%L,%L,%L,%L,%L,70,NULL,NULL)','anexacao','documento-fiscal',fd1,p1,'abc','image/png'), 'evidence-hash');
  ev := public.record_meal_evidence(NULL, NULL, 'anexacao', 'documento-fiscal', fd1, p1, sha, 'image/png', 70, 'NF sintética', NULL);
  SELECT count(*) INTO n FROM public.meal_evidence_for('documento-fiscal', fd1) WHERE readable AND is_head;
  IF n <> 1 THEN RAISE EXCEPTION 'falha: leitura própria'; END IF;
  SELECT id INTO id1 FROM public.meal_evidence_for('documento-fiscal', fd1) WHERE version = 1;
  IF public.authorize_meal_evidence_access(id1) <> p1 THEN RAISE EXCEPTION 'falha: autorização'; END IF;
  _ok := _ok || 'mime,tamanho,alvo,caminho,hash,anexacao,leitura;';

  PERFORM pg_temp.nae8_as(uO);
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_evidence_slot(%L,%L,%L,70)','documento-fiscal',fd1,'image/png'), 'capability:conferir-recebimento-alimentar');
  IF EXISTS (SELECT 1 FROM public.meal_evidence_for('documento-fiscal', fd1)) THEN RAISE EXCEPTION 'falha: IDOR leitura'; END IF;
  PERFORM pg_temp.nae8_fail(format('SELECT public.authorize_meal_evidence_access(%L)',id1), 'evidence-not-available');
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_evidence(%L,1,%L,NULL,NULL,NULL,NULL,NULL,NULL,NULL,%L)',ev,'revogacao','x'), 'capability:conferir-recebimento-alimentar');
  PERFORM pg_temp.nae8_as(uN);
  IF public.authorize_meal_evidence_access(id1) <> p1 THEN RAISE EXCEPTION 'falha: leitura de rede'; END IF;
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_evidence(%L,1,%L,NULL,NULL,NULL,NULL,NULL,NULL,NULL,%L)',ev,'revogacao','x'), 'capability:conferir-recebimento-alimentar');
  _ok := _ok || 'idor-outra-escola,rede-le-nao-escreve;';

  PERFORM pg_temp.nae8_as(uS);
  p2 := public.meal_evidence_slot('documento-fiscal', fd1, 'application/pdf', 900);
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_evidence(%L,1,%L,NULL,NULL,%L,%L,%L,900,NULL,NULL)',ev,'substituicao',p2,sha,'application/pdf'), 'reason-required');
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_evidence(%L,5,%L,NULL,NULL,%L,%L,%L,900,NULL,%L)',ev,'substituicao',p2,sha,'application/pdf','x'), 'meal:stale');
  PERFORM public.record_meal_evidence(ev, 1, 'substituicao', NULL, NULL, p2, sha, 'application/pdf', 900, 'NF legível', 'Foto ilegível');
  SELECT id INTO id2 FROM public.meal_evidence_for('documento-fiscal', fd1) WHERE version = 2;
  IF public.authorize_meal_evidence_access(id1) <> p1 OR public.authorize_meal_evidence_access(id2) <> p2 THEN RAISE EXCEPTION 'falha: histórico na substituição'; END IF;
  PERFORM public.record_meal_evidence(ev, 2, 'revogacao', NULL, NULL, NULL, NULL, NULL, NULL, NULL, 'Anexada no registro errado');
  PERFORM pg_temp.nae8_fail(format('SELECT public.authorize_meal_evidence_access(%L)',id2), 'evidence-not-available');
  PERFORM pg_temp.nae8_fail(format('SELECT public.authorize_meal_evidence_access(%L)',id1), 'evidence-not-available');
  SELECT count(*) INTO n FROM public.meal_evidence_for('documento-fiscal', fd1);
  IF n <> 3 OR EXISTS (SELECT 1 FROM public.meal_evidence_for('documento-fiscal', fd1) WHERE readable) THEN RAISE EXCEPTION 'falha: revogação histórica %', n; END IF;
  PERFORM pg_temp.nae8_fail(format('SELECT public.record_meal_evidence(%L,3,%L,NULL,NULL,%L,%L,%L,900,NULL,%L)',ev,'substituicao',p2||'b',sha,'application/pdf','x'), 'evidence-revoked');
  _ok := _ok || 'substituicao-versionada,stale,historico,revogacao,pos-revogacao;';

  RESET ROLE;
  PERFORM pg_temp.nae8_fail('UPDATE public.meal_evidence_attachments SET label = ''x''', 'append');
  PERFORM pg_temp.nae8_fail('DELETE FROM public.meal_evidence_attachments', 'append');
  IF (SELECT count(*) FROM public.meal_receipts) <> c_rec OR (SELECT count(*) FROM public.meal_inventory_movements) <> c_mov
     OR (SELECT count(*) FROM public.meal_fiscal_documents) <> c_fd
     OR (SELECT status FROM public.meal_fiscal_documents WHERE logical_id = fd1) <> 'recebido' THEN RAISE EXCEPTION 'falha: anexo alterou domínio'; END IF;
  _ok := _ok || 'append-only,sem-efeito-em-recebimento-estoque-nf;';

  SET LOCAL ROLE authenticated; PERFORM pg_temp.nae8_as(uS);
  RESET ROLE; DELETE FROM nae8_caps WHERE u = uS; SET LOCAL ROLE authenticated;
  PERFORM pg_temp.nae8_fail(format('SELECT public.meal_evidence_slot(%L,%L,%L,70)','documento-fiscal',fd1,'image/png'), 'capability:conferir-recebimento-alimentar');
  IF EXISTS (SELECT 1 FROM public.meal_evidence_for('documento-fiscal', fd1)) THEN RAISE EXCEPTION 'falha: leitura após revogação de capability'; END IF;
  _ok := _ok || 'capability-revogada;';
  RESET ROLE;
  RAISE EXCEPTION 'nae8-l2-ok: %', _ok;
END $t$;
