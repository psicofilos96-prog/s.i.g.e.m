-- NFAM.2: declarações de saúde da família (alimentar, alergia, medicamento) como dado sensível de menor.
-- Escrita só pela família com autorização vigente que inclua a seção 'saude'; ciência obrigatória; append-only com histórico.
-- Leitura escolar só pela capability de alimentação no escopo da escola da matrícula vigente, com trilha de acesso.
-- Nunca entra em relatório geral, catálogo, busca global ou verificação pública.
CREATE TABLE public.family_health_declarations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL,
  version integer NOT NULL CHECK (version >= 1),
  supersedes_id uuid REFERENCES public.family_health_declarations(id),
  student_id text NOT NULL REFERENCES public.institutional_students(id),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  kind text NOT NULL CHECK (kind IN ('alimentar','alergia','medicamento')),
  event_kind text NOT NULL CHECK (event_kind IN ('declaracao','retificacao','retirada')),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 3 AND 600),
  instructions text CHECK (instructions IS NULL OR length(instructions) <= 600),
  consent_text_version text NOT NULL,
  consent_at timestamptz NOT NULL,
  declared_by uuid NOT NULL,
  guardian_authorization_id uuid NOT NULL REFERENCES public.guardian_authorizations(id),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version)
);
CREATE UNIQUE INDEX fhd_one_successor ON public.family_health_declarations(supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE INDEX fhd_student ON public.family_health_declarations(student_id, logical_id, version DESC);
REVOKE ALL ON public.family_health_declarations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.family_health_declarations TO service_role;
ALTER TABLE public.family_health_declarations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.family_health_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  school_id text NOT NULL,
  rows_returned integer NOT NULL,
  accessed_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.family_health_access_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.family_health_access_events TO service_role;
ALTER TABLE public.family_health_access_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.fhd_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'health:append-only'; END $$;
CREATE TRIGGER fhd_no_update BEFORE UPDATE OR DELETE ON public.family_health_declarations FOR EACH ROW EXECUTE FUNCTION public.fhd_immutable();
CREATE TRIGGER fhae_no_update BEFORE UPDATE OR DELETE ON public.family_health_access_events FOR EACH ROW EXECUTE FUNCTION public.fhd_immutable();

-- Família: grava declaração/retificação/retirada. Base esperada = última versão (concorrência otimista entre responsáveis).
CREATE OR REPLACE FUNCTION public.record_family_health_declaration(_student text, _base uuid, _event text, _kind text,
  _description text, _instructions text, _consent_version text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.guardian_authorizations; b public.family_health_declarations; nid uuid := gen_random_uuid();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  a := public.family_authorization(_student);
  IF a.id IS NULL OR NOT ('saude' = ANY (a.sections)) THEN RAISE EXCEPTION 'family:not-authorized'; END IF;
  IF nullif(btrim(coalesce(_consent_version, '')), '') IS NULL THEN RAISE EXCEPTION 'health:consent-required'; END IF;
  IF _event NOT IN ('declaracao','retificacao','retirada') THEN RAISE EXCEPTION 'health:invalid-event'; END IF;
  IF _event = 'declaracao' THEN
    IF _base IS NOT NULL THEN RAISE EXCEPTION 'health:base-not-allowed'; END IF;
    INSERT INTO public.family_health_declarations(id, logical_id, version, student_id, school_id, kind, event_kind, description, instructions,
      consent_text_version, consent_at, declared_by, guardian_authorization_id)
    VALUES (nid, gen_random_uuid(), 1, _student, a.school_id, _kind, 'declaracao', btrim(_description), nullif(btrim(coalesce(_instructions,'')), ''),
      btrim(_consent_version), now(), auth.uid(), a.id);
    RETURN nid;
  END IF;
  SELECT * INTO b FROM public.family_health_declarations d WHERE d.id = _base AND d.student_id = _student FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'family:not-authorized'; END IF;
  IF EXISTS (SELECT 1 FROM public.family_health_declarations d WHERE d.supersedes_id = b.id) THEN RAISE EXCEPTION 'health:stale-base'; END IF;
  IF b.event_kind = 'retirada' THEN RAISE EXCEPTION 'health:already-withdrawn'; END IF;
  INSERT INTO public.family_health_declarations(id, logical_id, version, supersedes_id, student_id, school_id, kind, event_kind, description, instructions,
    consent_text_version, consent_at, declared_by, guardian_authorization_id)
  VALUES (nid, b.logical_id, b.version + 1, b.id, _student, a.school_id, b.kind, _event,
    CASE WHEN _event = 'retirada' THEN b.description ELSE btrim(_description) END,
    CASE WHEN _event = 'retirada' THEN b.instructions ELSE nullif(btrim(coalesce(_instructions,'')), '') END,
    btrim(_consent_version), now(), auth.uid(), a.id);
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.record_family_health_declaration(text, uuid, text, text, text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_family_health_declaration(text, uuid, text, text, text, text, text) TO authenticated;

-- Família: histórico completo do educando (todos os responsáveis autorizados com 'saude' veem o mesmo histórico; autor só como "você"/"outro responsável").
CREATE OR REPLACE FUNCTION public.family_health_history(_student text)
RETURNS TABLE(id uuid, logical_id uuid, version integer, kind text, event_kind text, description text, instructions text,
  consent_text_version text, recorded_at timestamptz, by_me boolean, is_head boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.guardian_authorizations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  a := public.family_authorization(_student);
  IF a.id IS NULL OR NOT ('saude' = ANY (a.sections)) THEN RAISE EXCEPTION 'family:not-authorized'; END IF;
  RETURN QUERY SELECT d.id, d.logical_id, d.version, d.kind, d.event_kind, d.description, d.instructions, d.consent_text_version, d.recorded_at,
    d.declared_by = auth.uid(), NOT EXISTS (SELECT 1 FROM public.family_health_declarations s WHERE s.supersedes_id = d.id)
  FROM public.family_health_declarations d WHERE d.student_id = _student ORDER BY d.logical_id, d.version DESC;
END $$;
REVOKE ALL ON FUNCTION public.family_health_history(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.family_health_history(text) TO authenticated;

-- Escola: só declarações vigentes (não retiradas) de estudantes com matrícula vigente na própria escola, com a capability de alimentação; acesso registrado.
CREATE OR REPLACE FUNCTION public.school_family_health_declarations(_school text)
RETURNS TABLE(student_name text, internal_id text, kind text, description text, instructions text, version integer, recorded_at timestamptz)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.effective_scope_capabilities(CURRENT_DATE) c
     WHERE c.capability_id = 'consultar-alimentacao-escolar' AND c.scope_level = 'escola' AND c.school_id = _school) THEN
    RAISE EXCEPTION 'health:capability-missing'; END IF;
  RETURN QUERY
  SELECT i.name, i.internal_id, d.kind, d.description, d.instructions, d.version, d.recorded_at
    FROM public.family_health_declarations d
    CROSS JOIN LATERAL public.student_card_identity(d.student_id) i
   WHERE d.event_kind <> 'retirada'
     AND NOT EXISTS (SELECT 1 FROM public.family_health_declarations s WHERE s.supersedes_id = d.id)
     AND public.family_enrollment_school(d.student_id, CURRENT_DATE) = _school
   ORDER BY 1, 3;
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO public.family_health_access_events(actor_user_id, school_id, rows_returned) VALUES (auth.uid(), _school, n);
END $$;
REVOKE ALL ON FUNCTION public.school_family_health_declarations(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.school_family_health_declarations(text) TO authenticated;

-- Busca da Secretaria para estudantes sem CPF: nome + data de nascimento (quando registrada) + identificador, com contagem de homônimos na escola.
CREATE OR REPLACE FUNCTION public.student_card_candidates_v2(_school text, _query text, _birth date)
RETURNS TABLE(student_id text, name text, name_kind text, internal_id text, class_label text, has_photo boolean, open_card text,
  birth_date date, homonyms integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  WITH c AS (SELECT * FROM public.student_card_candidates(_school, _query)),
  b AS (SELECT c.*, (SELECT v.birth_date FROM public.student_identity_versions v WHERE v.student_id = c.student_id ORDER BY v.version DESC LIMIT 1) AS bd FROM c)
  SELECT b.student_id, b.name, b.name_kind, b.internal_id, b.class_label, b.has_photo, b.open_card, b.bd,
    (count(*) OVER (PARTITION BY lower(extensions.unaccent(b.name))))::integer
  FROM b WHERE _birth IS NULL OR b.bd = _birth ORDER BY b.name;
END $$;
REVOKE ALL ON FUNCTION public.student_card_candidates_v2(text, text, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.student_card_candidates_v2(text, text, date) TO authenticated;