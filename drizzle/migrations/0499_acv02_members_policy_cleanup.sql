-- ACV.2: pessoas elegíveis para membros/compartilhamento, provisionamento controlado, expiração de reservas
-- órfãs com limpeza só do objeto nunca confirmado, e política de cota/retenção versionada com aprovação humana.

-- 1) Pessoas elegíveis (atuação vigente na escola do espaço), só para quem pode compartilhar/administrar.
CREATE OR REPLACE FUNCTION public.acv_eligible_people(_space uuid, _query text)
RETURNS TABLE(person_id uuid, display_name text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _s public.acv_spaces; _q text := lower(btrim(coalesce(_query, '')));
BEGIN
  SELECT * INTO _s FROM public.acv_spaces WHERE id = _space;
  IF _s.id IS NULL OR public.acv_space_rank(_space) < 6 OR length(_q) < 3 THEN RETURN; END IF;
  RETURN QUERY SELECT DISTINCT p.id, p.display_name FROM public.institutional_persons p
    JOIN public.institutional_engagements e ON e.person_id = p.id
   WHERE e.valid_from <= CURRENT_DATE AND (e.valid_until IS NULL OR e.valid_until >= CURRENT_DATE)
     AND (_s.school_id IS NULL OR e.school_id = _s.school_id)
     AND lower(p.display_name) LIKE '%' || replace(replace(_q, '%', ''), '_', '') || '%'
   ORDER BY p.display_name LIMIT 20;
END $$;
REVOKE EXECUTE ON FUNCTION public.acv_eligible_people(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acv_eligible_people(uuid, text) TO authenticated;

-- Papel efetivo do nó para a sessão + origem (herdado de qual pasta), para a tela explicar a herança.
CREATE OR REPLACE FUNCTION public.acv_node_access(_node uuid)
RETURNS TABLE(acl_id uuid, node_id uuid, inherited boolean, person_id uuid, principal_id uuid, display_name text, role text, granted_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.acv_node_rank(_node) < 6 THEN RETURN; END IF;
  RETURN QUERY WITH RECURSIVE anc AS (
    SELECT n.id, n.parent_id, 0 AS depth FROM public.acv_nodes n WHERE n.id = _node
    UNION ALL SELECT n.id, n.parent_id, anc.depth + 1 FROM public.acv_nodes n JOIN anc ON n.id = anc.parent_id)
  SELECT a.id, a.node_id, anc.depth > 0, a.person_id, a.principal_id, p.display_name, a.role, a.granted_at
    FROM public.acv_acl a JOIN anc ON a.node_id = anc.id LEFT JOIN public.institutional_persons p ON p.id = a.person_id
   WHERE a.revoked_at IS NULL ORDER BY anc.depth, a.granted_at;
END $$;
REVOKE EXECUTE ON FUNCTION public.acv_node_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acv_node_access(uuid) TO authenticated;

-- Membros do espaço com nome, só para o administrador do espaço.
CREATE OR REPLACE FUNCTION public.acv_space_member_list(_space uuid)
RETURNS TABLE(member_id uuid, person_id uuid, principal_id uuid, display_name text, role text, granted_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF public.acv_space_rank(_space) < 7 THEN RETURN; END IF;
  RETURN QUERY SELECT m.id, m.person_id, m.principal_id, coalesce(p.display_name, x.station_code), m.role, m.granted_at
    FROM public.acv_space_members m LEFT JOIN public.institutional_persons p ON p.id = m.person_id
    LEFT JOIN public.institutional_sector_principals x ON x.id = m.principal_id
   WHERE m.space_id = _space AND m.revoked_at IS NULL ORDER BY m.granted_at;
END $$;
REVOKE EXECUTE ON FUNCTION public.acv_space_member_list(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acv_space_member_list(uuid) TO authenticated;

-- 2) Provisionamento controlado: rede cria o espaço de um setor antes do primeiro acesso da conta do setor.
CREATE OR REPLACE FUNCTION public.acv_provision_space(_principal uuid, _key text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _prev uuid := public.acv_replay(_key); _x public.institutional_sector_principals; _id uuid;
BEGIN
  IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  PERFORM public.acv_require_actor();
  IF NOT public.has_network_capability('provisionar-acervo-documental') THEN RAISE EXCEPTION 'sem-permissao'; END IF;
  SELECT * INTO _x FROM public.institutional_sector_principals WHERE id = _principal;
  IF _x.id IS NULL OR EXISTS (SELECT 1 FROM public.institutional_sector_principal_revocations r WHERE r.principal_id = _x.id AND r.revoked_on <= CURRENT_DATE) THEN
    RAISE EXCEPTION 'destinatario-invalido'; END IF;
  SELECT id INTO _id FROM public.acv_spaces WHERE station_code = _x.station_code AND school_id IS NOT DISTINCT FROM _x.school_id;
  IF _id IS NULL THEN
    INSERT INTO public.acv_spaces(station_code, school_id) VALUES (_x.station_code, _x.school_id) RETURNING id INTO _id;
  END IF;
  PERFORM public.acv_log(_id, NULL, 'espaco-provisionado', jsonb_build_object('principal', _principal), _key);
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.acv_provision_space(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acv_provision_space(uuid, text) TO authenticated;

-- 3) Reservas de envio expiradas (janela técnica de 24 h já usada pelo envio).
ALTER TABLE public.acv_uploads DROP CONSTRAINT IF EXISTS acv_uploads_status_check;
ALTER TABLE public.acv_uploads ADD CONSTRAINT acv_uploads_status_check CHECK (status = ANY (ARRAY['pendente','concluido','expirado']));

CREATE OR REPLACE FUNCTION public.acv_expire_uploads(_space uuid)
RETURNS TABLE(upload_id uuid, storage_path text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _n int;
BEGIN
  PERFORM public.acv_require_actor();
  IF public.acv_space_rank(_space) < 7 THEN RAISE EXCEPTION 'sem-permissao'; END IF;
  UPDATE public.acv_uploads u SET status = 'expirado'
   WHERE u.space_id = _space AND u.status = 'pendente' AND u.created_at < now() - interval '24 hours';
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n > 0 THEN PERFORM public.acv_log(_space, NULL, 'reservas-expiradas', jsonb_build_object('quantidade', _n), NULL); END IF;
  -- Devolve só objetos ainda presentes de reservas expiradas nunca confirmadas (repetir é seguro).
  RETURN QUERY SELECT u.id, u.storage_path FROM public.acv_uploads u
   WHERE u.space_id = _space AND u.status = 'expirado'
     AND EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'acervo-documental' AND o.name = u.storage_path)
     AND NOT EXISTS (SELECT 1 FROM public.acv_file_versions v WHERE v.storage_path = u.storage_path);
END $$;
REVOKE EXECUTE ON FUNCTION public.acv_expire_uploads(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acv_expire_uploads(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.acv_orphan_removable(_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.acv_uploads u WHERE u.storage_path = _name AND u.status = 'expirado'
                  AND public.acv_space_rank(u.space_id) >= 7)
     AND NOT EXISTS (SELECT 1 FROM public.acv_file_versions v WHERE v.storage_path = _name) $$;
REVOKE EXECUTE ON FUNCTION public.acv_orphan_removable(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acv_orphan_removable(text) TO authenticated;

DROP POLICY IF EXISTS "acervo delete orfao expirado" ON storage.objects;
CREATE POLICY "acervo delete orfao expirado" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'acervo-documental' AND public.acv_orphan_removable(name));

-- 4) Política de cota e retenção: versão proposta pelo setor, efeito só após aprovação por outra pessoa da rede.
CREATE TABLE IF NOT EXISTS public.acv_policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id uuid NOT NULL REFERENCES public.acv_spaces(id),
  version int NOT NULL CHECK (version >= 1),
  quota_bytes bigint CHECK (quota_bytes IS NULL OR quota_bytes > 0),
  trash_retention_days int CHECK (trash_retention_days IS NULL OR trash_retention_days > 0),
  source text NOT NULL CHECK (length(btrim(source)) >= 5),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  author_person uuid, author_principal uuid,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (space_id, version)
);
CREATE TABLE IF NOT EXISTS public.acv_policy_approvals (
  policy_id uuid PRIMARY KEY REFERENCES public.acv_policy_versions(id),
  approver_person uuid NOT NULL,
  decision text NOT NULL CHECK (length(btrim(decision)) >= 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.acv_policy_versions, public.acv_policy_approvals TO authenticated;
GRANT ALL ON public.acv_policy_versions, public.acv_policy_approvals TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.acv_policy_versions, public.acv_policy_approvals FROM authenticated, anon;
ALTER TABLE public.acv_policy_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acv_policy_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acv policy read" ON public.acv_policy_versions;
CREATE POLICY "acv policy read" ON public.acv_policy_versions FOR SELECT TO authenticated
  USING (public.acv_space_rank(space_id) >= 7 OR public.has_network_capability('aprovar-politica-do-acervo'));
DROP POLICY IF EXISTS "acv policy approval read" ON public.acv_policy_approvals;
CREATE POLICY "acv policy approval read" ON public.acv_policy_approvals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.acv_policy_versions v WHERE v.id = policy_id
    AND (public.acv_space_rank(v.space_id) >= 7 OR public.has_network_capability('aprovar-politica-do-acervo'))));
DROP TRIGGER IF EXISTS acv_policy_versions_imm ON public.acv_policy_versions;
CREATE TRIGGER acv_policy_versions_imm BEFORE UPDATE OR DELETE ON public.acv_policy_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
DROP TRIGGER IF EXISTS acv_policy_approvals_imm ON public.acv_policy_approvals;
CREATE TRIGGER acv_policy_approvals_imm BEFORE UPDATE OR DELETE ON public.acv_policy_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.acv_record_policy(_space uuid, _expected int, _quota bigint, _retention int, _source text, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _id uuid; _last int;
BEGIN
  SELECT id INTO _id FROM public.acv_policy_versions WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  PERFORM public.acv_require_actor();
  IF public.acv_space_rank(_space) < 7 THEN RAISE EXCEPTION 'sem-permissao'; END IF;
  PERFORM 1 FROM public.acv_spaces WHERE id = _space FOR UPDATE;
  SELECT coalesce(max(version), 0) INTO _last FROM public.acv_policy_versions WHERE space_id = _space;
  IF _last <> coalesce(_expected, -1) THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  INSERT INTO public.acv_policy_versions(space_id, version, quota_bytes, trash_retention_days, source, reason, author_person, author_principal, idempotency_key)
  VALUES (_space, _last + 1, _quota, _retention, btrim(_source), btrim(_reason), public.current_person_id(), public.current_principal_id(), _key) RETURNING id INTO _id;
  PERFORM public.acv_log(_space, NULL, 'politica-proposta', jsonb_build_object('policy', _id, 'version', _last + 1), NULL);
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.acv_approve_policy(_policy uuid, _decision text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.acv_policy_versions; _last int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.acv_policy_approvals WHERE policy_id = _policy) THEN RETURN _policy; END IF;
  IF _p IS NULL OR NOT public.has_network_capability('aprovar-politica-do-acervo') THEN RAISE EXCEPTION 'sem-permissao'; END IF;
  SELECT * INTO _v FROM public.acv_policy_versions WHERE id = _policy FOR UPDATE;
  IF _v.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  IF _v.author_person IS NOT DISTINCT FROM _p THEN RAISE EXCEPTION 'aprovador-igual-autor'; END IF;
  SELECT max(version) INTO _last FROM public.acv_policy_versions WHERE space_id = _v.space_id;
  IF _v.version <> _last THEN RAISE EXCEPTION 'versao-superada'; END IF;
  INSERT INTO public.acv_policy_approvals(policy_id, approver_person, decision) VALUES (_policy, _p, btrim(_decision));
  -- Efeito só da cota; retenção é informativa: nada é eliminado automaticamente.
  UPDATE public.acv_spaces SET quota_bytes = _v.quota_bytes WHERE id = _v.space_id;
  PERFORM public.acv_log(_v.space_id, NULL, 'politica-aprovada', jsonb_build_object('policy', _policy, 'quota', _v.quota_bytes, 'retention_days', _v.trash_retention_days), NULL);
  RETURN _policy;
END $$;
REVOKE EXECUTE ON FUNCTION public.acv_record_policy(uuid,int,bigint,int,text,text,text), public.acv_approve_policy(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.acv_record_policy(uuid,int,bigint,int,text,text,text), public.acv_approve_policy(uuid,text) TO authenticated;

-- Cota direta sem aprovação deixa de ser caminho: só a política aprovada altera a cota.
REVOKE EXECUTE ON FUNCTION public.acv_set_quota(uuid, bigint, text) FROM authenticated;
COMMENT ON FUNCTION public.acv_set_quota(uuid, bigint, text) IS 'DEPRECATED: replaced by acv_record_policy + acv_approve_policy (ACV.2)';