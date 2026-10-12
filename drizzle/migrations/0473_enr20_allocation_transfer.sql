-- Matrículas L20: enturmação e transferência do ingresso SÓ pelos writers canônicos da Secretaria.
-- (1) Enturmação: matrícula vinculada (L19) → secretariat_allocate_to_class (capacidade/escola/ano validados lá). Ingresso só registra o vínculo.
-- (2) Transferência: pedido do ingresso com estudante reconciliado (L06) e matrícula vigente em outra escola; ledger
--     analise → autorizar (≠ analista, com ato) ; efetivar = encerra a origem por secretariat_record_exit numa transação,
--     exigindo vaga de destino validada (L19). O destino constitui o próprio vínculo pela Secretaria; nada é movido nem apagado.
CREATE TABLE public.enr_allocation_links (
  hold_id uuid PRIMARY KEY,
  episode_id text NOT NULL UNIQUE,
  class_id text NOT NULL,
  valid_from date NOT NULL,
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.enr_transfer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hold_id uuid NOT NULL,
  seq int NOT NULL CHECK (seq >= 1),
  action text NOT NULL CHECK (action IN ('analisar','indeferir','autorizar','efetivar')),
  origin_enrollment_id text NOT NULL REFERENCES public.school_enrollments(id),
  act_ref uuid REFERENCES public.admin_case_act_versions(id),
  exit_ref uuid,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 20),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hold_id, seq),
  CHECK (action <> 'autorizar' OR act_ref IS NOT NULL),
  CHECK (action <> 'efetivar' OR exit_ref IS NOT NULL)
);
GRANT SELECT ON public.enr_allocation_links, public.enr_transfer_events TO authenticated;
GRANT ALL ON public.enr_allocation_links, public.enr_transfer_events TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_allocation_links, public.enr_transfer_events FROM authenticated, anon;
ALTER TABLE public.enr_allocation_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_transfer_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enr alloc read" ON public.enr_allocation_links FOR SELECT TO authenticated USING (public.has_network_capability('confirmar-vagas-de-ingresso') OR EXISTS (SELECT 1 FROM public.school_capability_schools('formalizar-matricula-de-ingresso')));
CREATE POLICY "enr transfer read" ON public.enr_transfer_events FOR SELECT TO authenticated USING (public.has_network_capability('analisar-transferencias-de-ingresso') OR public.has_network_capability('autorizar-transferencias-de-ingresso'));
CREATE TRIGGER enr_alloc_append_only BEFORE UPDATE OR DELETE ON public.enr_allocation_links FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_transfer_append_only BEFORE UPDATE OR DELETE ON public.enr_transfer_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.enr_allocate_formalized(_hold uuid, _class text, _valid_from date, _reason text, _key text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _l public.enr_allocation_links; _enr text; _ep text;
BEGIN
  SELECT * INTO _l FROM public.enr_allocation_links al WHERE al.idempotency_key = _key;
  IF _l.hold_id IS NOT NULL THEN RETURN _l.episode_id; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT f.enrollment_id INTO _enr FROM public.enr_formalization_links f WHERE f.hold_id = _hold FOR UPDATE;
  IF _enr IS NULL THEN RAISE EXCEPTION 'matricula-nao-formalizada'; END IF;
  IF EXISTS (SELECT 1 FROM public.enr_allocation_links al WHERE al.hold_id = _hold) THEN RAISE EXCEPTION 'ja-enturmado-pelo-ingresso'; END IF;
  -- writer canônico: capability escolar, ano aberto, capacidade conhecida, sobreposição temporal
  _ep := public.secretariat_allocate_to_class(_enr, _class, _valid_from, _reason);
  INSERT INTO public.enr_allocation_links(hold_id, episode_id, class_id, valid_from, person_id, idempotency_key)
  VALUES (_hold, _ep, _class, _valid_from, _p, _key);
  RETURN _ep;
END $$;

CREATE OR REPLACE FUNCTION public.record_enr_transfer_event(_hold uuid, _expected_seq int, _action text, _origin text, _act uuid,
  _movement_type text, _type_version int, _effective_on date, _reason text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _s int; _last public.enr_transfer_events; _app uuid; _student text; _cell text; _school text;
        _o public.school_enrollments; _analyst uuid; _exit uuid;
BEGIN
  SELECT seq INTO _s FROM public.enr_transfer_events te WHERE te.idempotency_key = _key;
  IF _s IS NOT NULL THEN RETURN _s; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 20 THEN RAISE EXCEPTION 'motivo-obrigatorio'; END IF;
  SELECT r.application_id, p.cell_key INTO _app, _cell FROM public.enr_seat_events r JOIN public.enr_seat_pools p ON p.id = r.pool_id
   WHERE r.hold_id = _hold AND r.kind = 'reservar' AND r.origin = 'transferencia';
  IF _app IS NULL THEN RAISE EXCEPTION 'reserva-de-transferencia-inexistente'; END IF;
  PERFORM 1 FROM public.enr_applications a WHERE a.id = _app FOR UPDATE;
  _school := split_part(_cell, '|', 1);
  SELECT * INTO _last FROM public.enr_transfer_events te WHERE te.hold_id = _hold ORDER BY te.seq DESC LIMIT 1;
  IF coalesce(_last.seq, 0) <> _expected_seq THEN RAISE EXCEPTION 'sequencia-desatualizada'; END IF;
  IF _last.action IN ('indeferir','efetivar') THEN RAISE EXCEPTION 'transferencia-encerrada'; END IF;
  IF _last.id IS NOT NULL AND _last.origin_enrollment_id <> _origin THEN RAISE EXCEPTION 'origem-diferente'; END IF;

  -- origem = matrícula vigente do estudante reconciliado do pedido, em OUTRA escola
  SELECT rc.student_id INTO _student FROM public.enr_application_protocols l
    JOIN public.enr_preliminary_students ps ON ps.protocol_registration_id = l.registration_id
    JOIN public.enr_student_reconciliations rc ON rc.preliminary_id = ps.id
   WHERE l.application_id = _app ORDER BY rc.seq DESC LIMIT 1;
  IF _student IS NULL THEN RAISE EXCEPTION 'estudante-nao-reconciliado'; END IF;
  SELECT * INTO _o FROM public.school_enrollments se WHERE se.id = _origin;
  IF _o.id IS NULL OR _o.student_id::text <> _student THEN RAISE EXCEPTION 'origem-de-outro-estudante'; END IF;
  IF _o.school_id::text = _school THEN RAISE EXCEPTION 'origem-igual-destino'; END IF;
  IF EXISTS (SELECT 1 FROM public.school_enrollments s2 WHERE s2.supersedes_id = _o.id)
     OR EXISTS (SELECT 1 FROM public.school_enrollment_endings x WHERE x.enrollment_id = _o.id) THEN RAISE EXCEPTION 'origem-nao-vigente'; END IF;

  IF _action IN ('analisar','indeferir') THEN
    IF NOT public.has_network_capability('analisar-transferencias-de-ingresso') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
    IF _action = 'indeferir' AND coalesce(_last.action,'') <> 'analisar' THEN RAISE EXCEPTION 'indeferir-exige-analise'; END IF;
    IF _action = 'analisar' AND _last.id IS NOT NULL THEN RAISE EXCEPTION 'ja-analisada'; END IF;
  ELSIF _action = 'autorizar' THEN
    IF NOT public.has_network_capability('autorizar-transferencias-de-ingresso') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
    IF coalesce(_last.action,'') <> 'analisar' THEN RAISE EXCEPTION 'autorizar-exige-analise'; END IF;
    IF _last.person_id = _p THEN RAISE EXCEPTION 'autorizador-igual-analista'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.admin_case_act_versions WHERE id = _act) THEN RAISE EXCEPTION 'ato-inexistente'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.enr_admin_validations av WHERE av.hold_id = _hold AND av.outcome = 'validado') THEN RAISE EXCEPTION 'vaga-de-destino-nao-validada'; END IF;
  ELSIF _action = 'efetivar' THEN
    IF coalesce(_last.action,'') <> 'autorizar' THEN RAISE EXCEPTION 'efetivar-exige-autorizacao'; END IF;
    IF _effective_on IS NULL THEN RAISE EXCEPTION 'data-obrigatoria'; END IF;
    -- writer canônico da Secretaria: capability escolar da ORIGEM, tipo de movimentação homologado, destino registrado
    _exit := public.secretariat_record_exit(_origin, _effective_on, _movement_type, _type_version, _school, btrim(_reason));
  ELSE RAISE EXCEPTION 'acao-invalida'; END IF;

  INSERT INTO public.enr_transfer_events(hold_id, seq, action, origin_enrollment_id, act_ref, exit_ref, reason, person_id, idempotency_key)
  VALUES (_hold, coalesce(_last.seq,0) + 1, _action, _origin, CASE WHEN _action = 'autorizar' THEN _act END, _exit, btrim(_reason), _p, _key);
  RETURN coalesce(_last.seq,0) + 1;
END $$;

REVOKE ALL ON FUNCTION public.enr_allocate_formalized(uuid,text,date,text,text),
  public.record_enr_transfer_event(uuid,int,text,text,uuid,text,int,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enr_allocate_formalized(uuid,text,date,text,text),
  public.record_enr_transfer_event(uuid,int,text,text,uuid,text,int,date,text,text) TO authenticated;