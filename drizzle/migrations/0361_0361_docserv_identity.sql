-- DocServ LOTE 01: módulo documental nativo. Identidade é SEMPRE a pessoa/escola canônica do SIGEM.
CREATE TABLE public.docserv_identity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_key text NOT NULL,
  seq integer NOT NULL,
  subject_kind text NOT NULL CHECK (subject_kind IN ('servidor','escola')),
  matricula text,
  cpf_hmac text,
  inep text,
  outcome text NOT NULL CHECK (outcome IN ('vinculado','ambiguo','sem-correspondencia','descartado')),
  person_id uuid,
  school_id text,
  candidates jsonb NOT NULL DEFAULT '[]'::jsonb,
  decided_manually boolean NOT NULL DEFAULT false,
  reason text,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (link_key, seq),
  CHECK (outcome <> 'vinculado' OR (subject_kind = 'servidor' AND person_id IS NOT NULL) OR (subject_kind = 'escola' AND school_id IS NOT NULL)),
  CHECK (NOT decided_manually OR length(btrim(coalesce(reason,''))) >= 5)
);
COMMENT ON TABLE public.docserv_identity_links IS 'Mapeamento append-only de referências do DocServ (matrícula, CPF por HMAC, INEP) para pessoa/escola canônicas. CPF nunca é guardado em claro nem é chave; ambiguidade só se resolve manualmente.';
GRANT SELECT ON public.docserv_identity_links TO authenticated;
GRANT ALL ON public.docserv_identity_links TO service_role;
ALTER TABLE public.docserv_identity_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docserv links read by network admin" ON public.docserv_identity_links FOR SELECT TO authenticated
  USING ((SELECT public.has_network_capability('administrar-docserv')));

CREATE TABLE public.docserv_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  actor uuid NOT NULL,
  school_id text,
  subject_ref text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE public.docserv_audit_events IS 'Trilha append-only do DocServ; detail nunca contém CPF, nome completo nem segredo.';
GRANT SELECT ON public.docserv_audit_events TO authenticated;
GRANT ALL ON public.docserv_audit_events TO service_role;
ALTER TABLE public.docserv_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "docserv audit read" ON public.docserv_audit_events FOR SELECT TO authenticated
  USING ((SELECT public.has_network_capability('administrar-docserv')) OR (school_id IS NOT NULL AND public.has_school_capability('gerir-documentos-funcionais', school_id)));

CREATE OR REPLACE FUNCTION public.docserv_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'docserv:append-only'; END $$;
CREATE TRIGGER docserv_links_no_change BEFORE UPDATE OR DELETE ON public.docserv_identity_links FOR EACH ROW EXECUTE FUNCTION public.docserv_append_only();
CREATE TRIGGER docserv_audit_no_change BEFORE UPDATE OR DELETE ON public.docserv_audit_events FOR EACH ROW EXECUTE FUNCTION public.docserv_append_only();

-- Contexto do usuário logado: os três painéis vêm de capacidades, nunca de "tipo de usuário".
CREATE OR REPLACE FUNCTION public.docserv_context() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _person uuid; _schools jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  BEGIN _person := public.current_person_id()::uuid; EXCEPTION WHEN others THEN _person := NULL; END;
  SELECT coalesce(jsonb_agg(DISTINCT s.id), '[]'::jsonb) INTO _schools FROM public.institutional_schools s
   WHERE public.has_school_capability('gerir-documentos-funcionais', s.id::text);
  RETURN jsonb_build_object(
    'person_id', _person,
    'servidor', _person IS NOT NULL AND EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id::text = _person::text AND p.actor_nature = 'pessoa-natural'),
    'escola_schools', _schools,
    'nie', public.has_network_capability('administrar-docserv'));
END $$;

-- Resolução determinística: CPF é transformado em HMAC no servidor e descartado; matrícula vai pela conciliação de pessoal já existente.
CREATE OR REPLACE FUNCTION public.docserv_resolve_identity(_kind text, _matricula text, _cpf text, _inep text, _commit boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _hm text; _cands jsonb; _n int; _out text; _key text; _head int; _pid uuid; _sid text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF NOT public.has_network_capability('administrar-docserv') THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  IF _kind NOT IN ('servidor','escola') THEN RAISE EXCEPTION 'docserv:invalid-kind'; END IF;
  _matricula := nullif(btrim(coalesce(_matricula,'')), ''); _inep := nullif(regexp_replace(coalesce(_inep,''), '\s', '', 'g'), '');
  IF _cpf IS NOT NULL AND regexp_replace(_cpf, '\D', '', 'g') ~ '^\d{11}$' THEN _hm := public.technical_cpf_hmac(regexp_replace(_cpf, '\D', '', 'g')); END IF;
  IF _kind = 'escola' THEN
    IF _inep IS NULL THEN RAISE EXCEPTION 'docserv:identifier-required'; END IF;
    SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('school_id', i.school_id::text)), '[]'::jsonb) INTO _cands
      FROM public.institutional_school_identifiers i WHERE i.identifier_kind = 'inep' AND i.value = _inep;
  ELSE
    IF _hm IS NULL AND _matricula IS NULL AND _inep IS NULL THEN RAISE EXCEPTION 'docserv:identifier-required'; END IF;
    SELECT coalesce(jsonb_agg(DISTINCT jsonb_build_object('person_id', x.pid::text, 'via', x.via)), '[]'::jsonb) INTO _cands FROM (
      SELECT i.person_id AS pid, 'cpf' AS via FROM public.institutional_person_identifiers i WHERE _hm IS NOT NULL AND i.identifier_kind = 'cpf-hmac' AND i.value = _hm
      UNION SELECT i.person_id, 'inep' FROM public.institutional_person_identifiers i WHERE _inep IS NOT NULL AND i.identifier_kind = 'inep-pessoa' AND i.value = _inep
      UNION SELECT d.person_id, 'matricula' FROM public.staff_reconciliation_decisions d JOIN public.staff_administrative_records r ON r.id = d.staff_record_id
        WHERE _matricula IS NOT NULL AND r.registration = _matricula AND d.person_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM public.staff_reconciliation_decisions s2 WHERE s2.supersedes_id = d.id)) x;
  END IF;
  SELECT count(DISTINCT coalesce(e->>'person_id', e->>'school_id')) INTO _n FROM jsonb_array_elements(_cands) e;
  _out := CASE WHEN _n = 1 THEN 'vinculado' WHEN _n = 0 THEN 'sem-correspondencia' ELSE 'ambiguo' END;
  IF _out = 'vinculado' THEN
    IF _kind = 'servidor' THEN _pid := (_cands->0->>'person_id')::uuid; ELSE _sid := _cands->0->>'school_id'; END IF;
  END IF;
  IF _commit THEN
    _key := md5(_kind || '|' || coalesce(_matricula,'') || '|' || coalesce(_hm,'') || '|' || coalesce(_inep,''));
    PERFORM pg_advisory_xact_lock(hashtext('docserv-link:' || _key));
    SELECT coalesce(max(seq), 0) INTO _head FROM public.docserv_identity_links WHERE link_key = _key;
    INSERT INTO public.docserv_identity_links (link_key, seq, subject_kind, matricula, cpf_hmac, inep, outcome, person_id, school_id, candidates, recorded_by)
    VALUES (_key, _head + 1, _kind, _matricula, _hm, _inep, _out, _pid, _sid, _cands, auth.uid());
    INSERT INTO public.docserv_audit_events (action, actor, subject_ref, detail) VALUES ('identidade-resolvida', auth.uid(), _key, jsonb_build_object('kind', _kind, 'outcome', _out, 'candidates', _n));
  END IF;
  RETURN jsonb_build_object('outcome', _out, 'candidates', _cands, 'key', _key, 'cpf_informado', _hm IS NOT NULL);
END $$;

-- Resolução manual de ambiguidade: escolhe um dos candidatos já apurados, com motivo; nunca cria pessoa.
CREATE OR REPLACE FUNCTION public.docserv_decide_identity(_key text, _choice text, _reason text, _expected_seq integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE h public.docserv_identity_links; _ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF NOT public.has_network_capability('administrar-docserv') THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) < 5 THEN RAISE EXCEPTION 'docserv:reason-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('docserv-link:' || _key));
  SELECT * INTO h FROM public.docserv_identity_links WHERE link_key = _key ORDER BY seq DESC LIMIT 1;
  IF h.id IS NULL THEN RAISE EXCEPTION 'docserv:not-found'; END IF;
  IF h.seq <> _expected_seq THEN RAISE EXCEPTION 'docserv:stale-base'; END IF;
  IF _choice IS NULL THEN
    INSERT INTO public.docserv_identity_links (link_key, seq, subject_kind, matricula, cpf_hmac, inep, outcome, candidates, decided_manually, reason, recorded_by)
    VALUES (_key, h.seq + 1, h.subject_kind, h.matricula, h.cpf_hmac, h.inep, 'descartado', h.candidates, true, btrim(_reason), auth.uid());
  ELSE
    SELECT EXISTS (SELECT 1 FROM jsonb_array_elements(h.candidates) e WHERE coalesce(e->>'person_id', e->>'school_id') = _choice) INTO _ok;
    IF NOT _ok THEN RAISE EXCEPTION 'docserv:choice-not-candidate'; END IF;
    INSERT INTO public.docserv_identity_links (link_key, seq, subject_kind, matricula, cpf_hmac, inep, outcome, person_id, school_id, candidates, decided_manually, reason, recorded_by)
    VALUES (_key, h.seq + 1, h.subject_kind, h.matricula, h.cpf_hmac, h.inep, 'vinculado',
      CASE WHEN h.subject_kind = 'servidor' THEN _choice::uuid END, CASE WHEN h.subject_kind = 'escola' THEN _choice END, h.candidates, true, btrim(_reason), auth.uid());
  END IF;
  INSERT INTO public.docserv_audit_events (action, actor, subject_ref, detail) VALUES ('identidade-decidida', auth.uid(), _key, jsonb_build_object('seq', h.seq + 1, 'descartado', _choice IS NULL));
  RETURN h.seq + 1;
END $$;

CREATE OR REPLACE FUNCTION public.docserv_identity_queue(_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'docserv:unauthenticated'; END IF;
  IF NOT public.has_network_capability('administrar-docserv') THEN RAISE EXCEPTION 'docserv:forbidden'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('key', l.link_key, 'seq', l.seq, 'kind', l.subject_kind, 'outcome', l.outcome,
      'matricula', l.matricula, 'cpf', l.cpf_hmac IS NOT NULL, 'inep', l.inep, 'candidates', l.candidates,
      'masked_names', (SELECT jsonb_agg(public.educacenso_mask_name(p.display_name)) FROM public.institutional_persons p
                        WHERE p.id::text IN (SELECT e->>'person_id' FROM jsonb_array_elements(l.candidates) e)),
      'manual', l.decided_manually, 'recorded_at', l.recorded_at) ORDER BY l.recorded_at DESC)
    FROM (SELECT DISTINCT ON (link_key) * FROM public.docserv_identity_links ORDER BY link_key, seq DESC) l
    WHERE true LIMIT least(greatest(coalesce(_limit,100),1),500)), '[]'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.docserv_context() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.docserv_resolve_identity(text, text, text, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.docserv_decide_identity(text, text, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.docserv_identity_queue(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.docserv_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.docserv_resolve_identity(text, text, text, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.docserv_decide_identity(text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.docserv_identity_queue(integer) TO authenticated;