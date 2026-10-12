-- Matrículas L19: (1) família manifesta aceite da vaga reservada (código + conferência; idempotente; só reserva ativa);
-- (2) validação administrativa por pessoa ≠ reservante, com comprovante SHA-256, confirma a reserva pelo writer canônico (enr_seat_close);
-- (3) a matrícula NUNCA nasce aqui: só a Secretaria a cria no writer canônico e depois vincula a referência (school_enrollments) à reserva.
CREATE TABLE public.enr_family_acceptances (
  hold_id uuid PRIMARY KEY,
  application_id uuid NOT NULL REFERENCES public.enr_applications(id),
  receipt_hash text NOT NULL CHECK (receipt_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.enr_admin_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id uuid NOT NULL,
  outcome text NOT NULL CHECK (outcome IN ('validado','devolvido')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 20),
  receipt_hash text NOT NULL CHECK (receipt_hash ~ '^[0-9a-f]{64}$'),
  validator_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX enr_admin_validations_one_ok ON public.enr_admin_validations(hold_id) WHERE outcome = 'validado';
CREATE TABLE public.enr_formalization_links (
  hold_id uuid PRIMARY KEY,
  enrollment_id text NOT NULL UNIQUE REFERENCES public.school_enrollments(id),
  person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.enr_family_acceptances, public.enr_admin_validations, public.enr_formalization_links TO authenticated;
GRANT ALL ON public.enr_family_acceptances, public.enr_admin_validations, public.enr_formalization_links TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_family_acceptances, public.enr_admin_validations, public.enr_formalization_links FROM authenticated, anon;
ALTER TABLE public.enr_family_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_admin_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_formalization_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enr accept read" ON public.enr_family_acceptances FOR SELECT TO authenticated USING (public.has_network_capability('confirmar-vagas-de-ingresso') OR public.has_network_capability('reservar-vagas-de-ingresso'));
CREATE POLICY "enr validation read" ON public.enr_admin_validations FOR SELECT TO authenticated USING (public.has_network_capability('confirmar-vagas-de-ingresso') OR public.has_network_capability('reservar-vagas-de-ingresso'));
CREATE POLICY "enr formal read" ON public.enr_formalization_links FOR SELECT TO authenticated USING (public.has_network_capability('confirmar-vagas-de-ingresso') OR EXISTS (SELECT 1 FROM public.school_capability_schools('formalizar-matricula-de-ingresso')));
CREATE TRIGGER enr_accept_append_only BEFORE UPDATE OR DELETE ON public.enr_family_acceptances FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_validation_append_only BEFORE UPDATE OR DELETE ON public.enr_admin_validations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_formal_append_only BEFORE UPDATE OR DELETE ON public.enr_formalization_links FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- (1) Aceite da família. Resposta de lista fechada; falha de identificação ⇒ 'indisponivel' uniforme.
CREATE OR REPLACE FUNCTION public.enr_public_accept_seat(_code text, _check text)
RETURNS TABLE(status text, receipt text) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _a public.enr_applications; _r public.enr_seat_events; _f public.enr_family_acceptances; _h text;
BEGIN
  IF _code IS NULL OR _check IS NULL OR btrim(_code) !~ '^INS-[0-9A-F]{10}$' OR lower(btrim(_check)) !~ '^[0-9a-f]{12}$' THEN
    RETURN QUERY SELECT 'indisponivel'::text, NULL::text; RETURN; END IF;
  SELECT * INTO _a FROM public.enr_applications a WHERE a.application_code = btrim(_code) FOR UPDATE;
  IF _a.check_hash IS NULL OR _a.check_hash <> encode(extensions.digest(lower(btrim(_check)), 'sha256'), 'hex') THEN
    RETURN QUERY SELECT 'indisponivel'::text, NULL::text; RETURN; END IF;
  SELECT r.* INTO _r FROM public.enr_seat_events r WHERE r.application_id = _a.id AND r.kind = 'reservar' ORDER BY r.created_at DESC LIMIT 1;
  IF _r.id IS NULL THEN RETURN QUERY SELECT 'sem-reserva'::text, NULL::text; RETURN; END IF;
  SELECT * INTO _f FROM public.enr_family_acceptances fa WHERE fa.hold_id = _r.hold_id;
  IF _f.hold_id IS NOT NULL THEN RETURN QUERY SELECT 'ja-registrado'::text, substr(_f.receipt_hash, 1, 16); RETURN; END IF;
  PERFORM 1 FROM public.enr_seat_pools sp WHERE sp.id = _r.pool_id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.enr_seat_events c WHERE c.hold_id = _r.hold_id AND c.kind IN ('confirmar','liberar')) OR _r.expires_at <= now() THEN
    RETURN QUERY SELECT 'reserva-nao-ativa'::text, NULL::text; RETURN; END IF;
  _h := encode(extensions.digest('aceite|' || _r.hold_id::text || '|' || _a.application_code || '|' || now()::text, 'sha256'), 'hex');
  INSERT INTO public.enr_family_acceptances(hold_id, application_id, receipt_hash) VALUES (_r.hold_id, _a.id, _h);
  RETURN QUERY SELECT 'registrado'::text, substr(_h, 1, 16);
END $$;

-- (2) Validação administrativa: validado exige aceite da família e reserva ativa; confirma a vaga na MESMA transação.
CREATE OR REPLACE FUNCTION public.record_enr_admin_validation(_hold uuid, _outcome text, _reason text, _key text)
RETURNS TABLE(validation_receipt text, seat_seq int) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.enr_admin_validations; _h text; _s int;
BEGIN
  SELECT * INTO _v FROM public.enr_admin_validations av WHERE av.idempotency_key = _key;
  IF _v.id IS NOT NULL THEN RETURN QUERY SELECT _v.receipt_hash, NULL::int; RETURN; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('confirmar-vagas-de-ingresso') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  IF _outcome NOT IN ('validado','devolvido') THEN RAISE EXCEPTION 'resultado-invalido'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 20 THEN RAISE EXCEPTION 'motivo-obrigatorio'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.enr_seat_events e WHERE e.hold_id = _hold AND e.kind = 'reservar') THEN RAISE EXCEPTION 'reserva-inexistente'; END IF;
  IF _outcome = 'validado' AND NOT EXISTS (SELECT 1 FROM public.enr_family_acceptances fa WHERE fa.hold_id = _hold) THEN RAISE EXCEPTION 'sem-aceite-da-familia'; END IF;
  _h := encode(extensions.digest('validacao|' || _hold::text || '|' || _outcome || '|' || _p::text || '|' || now()::text, 'sha256'), 'hex');
  IF _outcome = 'validado' THEN
    _s := public.enr_seat_close(_hold, 'confirmar', btrim(_reason), 'val:' || _key); -- trava o quadro, recusa vencida, confirmador ≠ reservante
  END IF;
  INSERT INTO public.enr_admin_validations(hold_id, outcome, reason, receipt_hash, validator_person, idempotency_key)
  VALUES (_hold, _outcome, btrim(_reason), _h, _p, _key);
  RETURN QUERY SELECT _h, _s;
END $$;

-- (3) Vínculo da matrícula formalizada pela Secretaria (writer canônico já gravou). Nada é criado aqui.
CREATE OR REPLACE FUNCTION public.enr_link_formalized_enrollment(_hold uuid, _enrollment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _cell text; _school text; _e public.school_enrollments; _ok timestamptz;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF EXISTS (SELECT 1 FROM public.enr_formalization_links l WHERE l.hold_id = _hold AND l.enrollment_id = _enrollment) THEN RETURN; END IF;
  SELECT p.cell_key INTO _cell FROM public.enr_seat_events r JOIN public.enr_seat_pools p ON p.id = r.pool_id WHERE r.hold_id = _hold AND r.kind = 'reservar';
  IF _cell IS NULL THEN RAISE EXCEPTION 'reserva-inexistente'; END IF;
  _school := split_part(_cell, '|', 1);
  IF NOT EXISTS (SELECT 1 FROM public.school_capability_schools('formalizar-matricula-de-ingresso') s WHERE s::text = _school) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT av.created_at INTO _ok FROM public.enr_admin_validations av WHERE av.hold_id = _hold AND av.outcome = 'validado';
  IF _ok IS NULL OR NOT EXISTS (SELECT 1 FROM public.enr_seat_events e WHERE e.hold_id = _hold AND e.kind = 'confirmar') THEN RAISE EXCEPTION 'vaga-nao-validada'; END IF;
  SELECT * INTO _e FROM public.school_enrollments se WHERE se.id = _enrollment;
  IF _e.id IS NULL THEN RAISE EXCEPTION 'matricula-inexistente'; END IF;
  IF _e.school_id::text <> _school THEN RAISE EXCEPTION 'matricula-de-outra-escola'; END IF;
  IF EXISTS (SELECT 1 FROM public.school_enrollments s2 WHERE s2.supersedes_id = _e.id)
     OR EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = _e.id) THEN RAISE EXCEPTION 'matricula-nao-vigente'; END IF;
  IF _e.created_at < _ok THEN RAISE EXCEPTION 'matricula-anterior-a-validacao'; END IF;
  INSERT INTO public.enr_formalization_links(hold_id, enrollment_id, person_id) VALUES (_hold, _enrollment, _p);
END $$;

REVOKE ALL ON FUNCTION public.enr_public_accept_seat(text,text), public.record_enr_admin_validation(uuid,text,text,text),
  public.enr_link_formalized_enrollment(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_enr_admin_validation(uuid,text,text,text), public.enr_link_formalized_enrollment(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enr_public_accept_seat(text,text) TO anon, authenticated;