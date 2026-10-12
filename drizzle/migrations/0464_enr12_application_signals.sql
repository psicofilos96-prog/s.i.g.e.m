-- Matrículas L12: sinais (repetida, já matriculado, identificador inconsistente, responsáveis múltiplos) são PROJEÇÃO calculada na hora;
-- só a resolução humana é gravada (append-only). Nunca exclui, funde nem altera pedido, estudante ou matrícula.
CREATE TABLE public.enr_signal_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid NOT NULL REFERENCES public.enr_applications(id),
  signal_kind text NOT NULL CHECK (signal_kind IN ('inscricao-repetida','ja-matriculado','identificador-inconsistente','responsaveis-multiplos')),
  related_key text NOT NULL CHECK (length(related_key) BETWEEN 1 AND 80),
  seq int NOT NULL CHECK (seq >= 1),
  decision text NOT NULL CHECK (decision IN ('legitimo','procede','indeterminado')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 20),
  decider_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (application_id, signal_kind, related_key, seq)
);
GRANT SELECT ON public.enr_signal_resolutions TO authenticated;
GRANT ALL ON public.enr_signal_resolutions TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_signal_resolutions FROM authenticated, anon;
ALTER TABLE public.enr_signal_resolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enr signal resolutions read" ON public.enr_signal_resolutions FOR SELECT TO authenticated USING (public.enr_can_see_application(application_id));
CREATE TRIGGER enr_signal_resolutions_append_only BEFORE UPDATE OR DELETE ON public.enr_signal_resolutions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.enr_norm_name(_t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT regexp_replace(lower(btrim(translate(_t, 'ÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäéèêëíìîïóòôõöúùûüç', 'AAAAAEEEEIIIIOOOOOUUUUCaaaaaeeeeiiiiooooouuuuc'))), '\s+', ' ', 'g')
$$;

-- Sinais de UM pedido. related_key = código do outro pedido (nunca CPF/HMAC) ou 'matricula'. Resolução vigente = última decisão.
CREATE OR REPLACE FUNCTION public.enr_application_signals(_app uuid)
RETURNS TABLE(signal_kind text, related_key text, evidence text, strength text, decision text, decided_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _a public.enr_applications; _student text; _today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  IF NOT public.enr_can_see_application(_app) THEN RETURN; END IF;
  SELECT * INTO _a FROM public.enr_applications WHERE id = _app;
  -- estudante só por reconciliação humana já decidida (L06); sem decisão ⇒ sem sinal de matrícula (nunca por nome).
  SELECT r.student_id INTO _student FROM public.enr_application_protocols l
    JOIN public.enr_preliminary_students ps ON ps.protocol_registration_id = l.registration_id
    JOIN LATERAL (SELECT x.* FROM public.enr_student_reconciliations x WHERE x.preliminary_id = ps.id ORDER BY x.seq DESC LIMIT 1) r ON true
   WHERE l.application_id = _app AND r.decision = 'mesmo-estudante' LIMIT 1;
  RETURN QUERY
  WITH same_student AS (
    SELECT o.*, CASE WHEN _a.student_cpf_hmac IS NOT NULL AND o.student_cpf_hmac = _a.student_cpf_hmac THEN 'forte' ELSE 'fraca' END AS st
    FROM public.enr_applications o
    WHERE o.id <> _a.id AND o.campaign_id = _a.campaign_id
      AND ((_a.student_cpf_hmac IS NOT NULL AND o.student_cpf_hmac = _a.student_cpf_hmac)
        OR (public.enr_norm_name(o.student_name) = public.enr_norm_name(_a.student_name) AND o.student_birth_date = _a.student_birth_date))
  ), raw AS (
    SELECT 'inscricao-repetida'::text k, s.application_code rk, 'Outro pedido na mesma campanha para o mesmo estudante'::text ev, s.st FROM same_student s
    UNION ALL
    SELECT 'responsaveis-multiplos', s.application_code, 'Pedido do mesmo estudante feito por outra pessoa', s.st FROM same_student s WHERE s.requester_cpf_hmac <> _a.requester_cpf_hmac
    UNION ALL
    SELECT 'identificador-inconsistente', o.application_code, 'Mesmo CPF do estudante com nome ou nascimento diferente', 'forte'
      FROM public.enr_applications o WHERE o.id <> _a.id AND _a.student_cpf_hmac IS NOT NULL AND o.student_cpf_hmac = _a.student_cpf_hmac
       AND (o.student_birth_date <> _a.student_birth_date OR public.enr_norm_name(o.student_name) <> public.enr_norm_name(_a.student_name))
    UNION ALL
    SELECT 'ja-matriculado', 'matricula',
      CASE WHEN bool_or(h.opened_on IS NULL) AND NOT bool_or(h.opened_on IS NOT NULL) THEN 'Estudante reconciliado com matrícula sem início declarado' ELSE 'Estudante reconciliado com matrícula ativa' END,
      CASE WHEN bool_or(h.opened_on IS NOT NULL) THEN 'forte' ELSE 'indeterminada' END
      FROM public.school_enrollments h
     WHERE _student IS NOT NULL AND h.student_id = _student
       AND NOT EXISTS (SELECT 1 FROM public.school_enrollments s2 WHERE s2.supersedes_id = h.id)
       AND (h.opened_on IS NULL OR h.opened_on <= _today)
       AND NOT EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = h.id AND x.ended_on <= _today)
     HAVING count(*) > 0
  )
  SELECT r.k, r.rk, r.ev, r.st, d.decision, d.created_at FROM raw r
  LEFT JOIN LATERAL (SELECT z.decision, z.created_at FROM public.enr_signal_resolutions z
     WHERE z.application_id = _app AND z.signal_kind = r.k AND z.related_key = r.rk ORDER BY z.seq DESC LIMIT 1) d ON true
  ORDER BY r.k, r.rk;
END $$;

CREATE OR REPLACE FUNCTION public.record_enr_signal_resolution(_app uuid, _kind text, _related text, _expected_seq int, _decision text, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _last int;
BEGIN
  SELECT id INTO _id FROM public.enr_signal_resolutions WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL OR NOT public.enr_can_see_application(_app) THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  -- só sinal que existe agora pode ser resolvido (nada de decisão sobre sinal inventado).
  IF NOT EXISTS (SELECT 1 FROM public.enr_application_signals(_app) s WHERE s.signal_kind = _kind AND s.related_key = _related) THEN RAISE EXCEPTION 'sinal-inexistente'; END IF;
  PERFORM 1 FROM public.enr_applications WHERE id = _app FOR UPDATE;
  SELECT coalesce(max(seq),0) INTO _last FROM public.enr_signal_resolutions WHERE application_id = _app AND signal_kind = _kind AND related_key = _related;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'sequencia-desatualizada'; END IF;
  INSERT INTO public.enr_signal_resolutions(application_id, signal_kind, related_key, seq, decision, reason, decider_person, idempotency_key)
  VALUES (_app, _kind, _related, _last + 1, _decision, btrim(_reason), _p, _key) RETURNING id INTO _id;
  RETURN _id;
END $$;

REVOKE ALL ON FUNCTION public.enr_norm_name(text), public.enr_application_signals(uuid), public.record_enr_signal_resolution(uuid,text,text,int,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enr_application_signals(uuid), public.record_enr_signal_resolution(uuid,text,text,int,text,text,text) TO authenticated;