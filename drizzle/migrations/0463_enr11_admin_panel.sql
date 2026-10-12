-- Matrículas L11: painel administrativo. Acesso por competência explícita: rede (capability de rede) OU escola
-- (capability escolar 'analisar-inscricoes-de-ingresso' na escola escolhida pelo pedido). Contato do responsável só para quem conduz.
CREATE TABLE public.enr_application_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.enr_applications(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('anotacao','pendencia-aberta','pendencia-resolvida','criterio-conferido','criterio-nao-comprovado')),
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 3 AND 120),
  note text NOT NULL CHECK (length(btrim(note)) BETWEEN 10 AND 2000),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, seq)
);
GRANT SELECT ON public.enr_application_analyses TO authenticated;
GRANT ALL ON public.enr_application_analyses TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_application_analyses FROM authenticated, anon;
ALTER TABLE public.enr_application_analyses ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER enr_app_analyses_append_only BEFORE UPDATE OR DELETE ON public.enr_application_analyses FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.enr_can_see_application(_app uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.has_network_capability('registrar-identificacao-de-ingresso')
      OR public.has_network_capability('reconciliar-estudante-de-ingresso')
      OR EXISTS (SELECT 1 FROM public.enr_applications a WHERE a.id = _app
                 AND a.school_preferences && ARRAY(SELECT public.school_capability_schools('analisar-inscricoes-de-ingresso'))::text[])
$$;
CREATE POLICY "enr analyses read" ON public.enr_application_analyses FOR SELECT TO authenticated USING (public.enr_can_see_application(application_id));

-- Lista paginada (máx. 200) com filtros campanha/escola; nunca devolve HMAC; total exato para não parecer completo quando truncado.
CREATE OR REPLACE FUNCTION public.enr_admin_applications(_campaign uuid, _school text, _limit int, _offset int)
RETURNS TABLE(id uuid, application_code text, campaign_id uuid, submitted_at timestamptz, requester_kind text, requester_name text,
  requester_email text, requester_phone text, declared_kinship text, student_name text, student_birth_date date, stage_id text, modality_id text,
  school_preferences text[], protocol_number text, docs_total int, docs_pending int, open_pendencies int, total_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH visible AS (
    SELECT a.* FROM public.enr_applications a
    WHERE (_campaign IS NULL OR a.campaign_id = _campaign)
      AND (_school IS NULL OR _school = ANY(a.school_preferences))
      AND public.enr_can_see_application(a.id)
  )
  SELECT v.id, v.application_code, v.campaign_id, v.submitted_at, v.requester_kind, v.requester_name,
    v.requester_email, v.requester_phone, v.declared_kinship, v.student_name, v.student_birth_date, v.stage_id, v.modality_id,
    v.school_preferences,
    (SELECT p.protocol_number FROM public.enr_application_protocols l JOIN public.protocol_registrations p ON p.id = l.registration_id WHERE l.application_id = v.id),
    (SELECT count(DISTINCT d.doc_type)::int FROM public.enr_application_documents d WHERE d.application_id = v.id),
    (SELECT count(*)::int FROM (SELECT DISTINCT ON (d.doc_type) d.id FROM public.enr_application_documents d WHERE d.application_id = v.id ORDER BY d.doc_type, d.version DESC) x
       WHERE coalesce((SELECT r.outcome FROM public.enr_document_reviews r WHERE r.document_id = x.id AND r.outcome <> 'vinculado-ged' ORDER BY r.seq DESC LIMIT 1),'') <> 'conferido'),
    (SELECT count(*)::int FROM (SELECT DISTINCT ON (n.subject) n.kind FROM public.enr_application_analyses n WHERE n.application_id = v.id AND n.kind IN ('pendencia-aberta','pendencia-resolvida') ORDER BY n.subject, n.seq DESC) y WHERE y.kind = 'pendencia-aberta'),
    count(*) OVER ()
  FROM visible v ORDER BY v.submitted_at, v.id
  LIMIT least(greatest(coalesce(_limit,50),1),200) OFFSET greatest(coalesce(_offset,0),0)
$$;

-- Histórico do pedido: envio, protocolo, documentos, conferências e análises (só para quem vê o pedido).
CREATE OR REPLACE FUNCTION public.enr_admin_application_history(_app uuid)
RETURNS TABLE(at timestamptz, kind text, detail text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.enr_can_see_application(_app) THEN RETURN; END IF;
  RETURN QUERY
    SELECT a.submitted_at, 'envio'::text, 'Pedido recebido pelo portal'::text FROM public.enr_applications a WHERE a.id = _app
    UNION ALL SELECT l.created_at, 'protocolo', p.protocol_number FROM public.enr_application_protocols l JOIN public.protocol_registrations p ON p.id = l.registration_id WHERE l.application_id = _app
    UNION ALL SELECT d.created_at, 'documento', d.doc_type || ' v' || d.version FROM public.enr_application_documents d WHERE d.application_id = _app
    UNION ALL SELECT r.created_at, 'conferencia', d.doc_type || ': ' || r.outcome || ' — ' || r.reason FROM public.enr_document_reviews r JOIN public.enr_application_documents d ON d.id = r.document_id WHERE d.application_id = _app
    UNION ALL SELECT n.created_at, n.kind, n.subject || ' — ' || n.note FROM public.enr_application_analyses n WHERE n.application_id = _app
    ORDER BY 1;
END $$;

CREATE OR REPLACE FUNCTION public.record_enr_application_analysis(_app uuid, _expected_seq int, _kind text, _subject text, _note text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _last int;
BEGIN
  SELECT id INTO _id FROM public.enr_application_analyses WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL OR NOT public.enr_can_see_application(_app) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  PERFORM 1 FROM public.enr_applications WHERE id = _app FOR UPDATE;
  SELECT coalesce(max(seq),0) INTO _last FROM public.enr_application_analyses WHERE application_id = _app;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'sequencia-desatualizada'; END IF;
  INSERT INTO public.enr_application_analyses(application_id, seq, kind, subject, note, author_person, idempotency_key)
  VALUES (_app, _last + 1, _kind, btrim(_subject), btrim(_note), _p, _key) RETURNING id INTO _id;
  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.enr_can_see_application(uuid), public.enr_admin_applications(uuid,text,int,int), public.enr_admin_application_history(uuid), public.record_enr_application_analysis(uuid,int,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enr_can_see_application(uuid), public.enr_admin_applications(uuid,text,int,int), public.enr_admin_application_history(uuid), public.record_enr_application_analysis(uuid,int,text,text,text,text) TO authenticated;