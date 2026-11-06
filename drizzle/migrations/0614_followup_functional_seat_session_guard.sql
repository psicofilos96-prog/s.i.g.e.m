-- PR7 / 0614 — barreira para sessões antigas ao reutilizar identificadores de postos.
-- Aditiva: não ativa contas, não concede policy/capability nem instala credenciais.
-- A troca operacional de pessoa continua dependente de procedimento institucional.
-- Proteção exclusivamente dos leitores/escritores do acompanhamento (não das outras áreas).
--
-- Um JWT renovado preserva session_id: verificar auth.sessions.created_at,
-- não o iat do token. Revogação de refresh token isoladamente não basta.

CREATE OR REPLACE FUNCTION public.followup_functional_seat_current_session()
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE
  _email text;
  _meta jsonb;
  _person uuid;
  _linked_at timestamptz;
  _session uuid;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  -- JWT cujo usuário foi excluído do Auth não recebe capacidades por
  -- um user_person_links órfão; fail closed antes de qualquer bypass.
  SELECT lower(u.email), u.raw_app_meta_data, l.person_id, l.created_at
    INTO _email, _meta, _person, _linked_at
  FROM auth.users u
  LEFT JOIN public.user_person_links l ON l.user_id = u.id
  WHERE u.id = auth.uid();
  IF NOT FOUND THEN RETURN false; END IF;

  -- Contas comuns seguem o contrato canônico; endereços funcionais OU
  -- marcador administrativo impedem que renomear o email evite o controle.
  IF _email NOT IN (
    'acomp1@sigem.itap.gov.br','acomp2@sigem.itap.gov.br','gab@sigem.itap.gov.br'
  ) AND coalesce(_meta->>'sigem_account', '') <> 'followup-functional-pending'
  THEN RETURN true; END IF;

  IF _person IS NULL OR _linked_at IS NULL THEN RETURN false; END IF;
  BEGIN
    _session := nullif(auth.jwt()->>'session_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN RETURN false;
  END;
  IF _session IS NULL THEN RETURN false; END IF;

  RETURN EXISTS (
    SELECT 1 FROM auth.sessions s
    WHERE s.id = _session AND s.user_id = auth.uid()
      AND s.created_at >= _linked_at
      AND (s.not_after IS NULL OR s.not_after > now())
  );
END $$;
REVOKE ALL ON FUNCTION public.followup_functional_seat_current_session()
  FROM PUBLIC, anon, authenticated, service_role;

-- A função original da migration 0613 mantém a política e o escopo.
-- Aqui se acrescenta a checagem de idade de sessão ANTES da política.
CREATE OR REPLACE FUNCTION public.school_institutional_followup_grant(_capability text, _school text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
BEGIN
  IF auth.uid() IS NULL OR _school IS NULL OR _capability NOT IN (
    'consultar-acompanhamento-institucional','registrar-acompanhamento-institucional'
  ) THEN RETURN false; END IF;
  IF NOT public.followup_functional_seat_current_session() THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.effective_scope_capabilities(
      (now() AT TIME ZONE 'America/Sao_Paulo')::date
    ) c WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL
      AND (c.scope_level = 'rede' OR c.scope_level = 'escola' AND c.school_id = _school)
  );
END $$;
REVOKE ALL ON FUNCTION public.school_institutional_followup_grant(text,text)
  FROM PUBLIC, anon, authenticated, service_role;

-- Impedir alteração in place do elo de uma conta funcional: se person_id
-- muda mas created_at fica antigo, o JWT anterior herdaria o novo titular.
-- INSERT/DELETE+INSERT deve ocorrer só por procedimento governado com trilha,
-- revogação e credencial rotacionada; este trigger NÃO implementa esse fluxo.
CREATE OR REPLACE FUNCTION public.followup_functional_seat_link_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _marked boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT (
      lower(u.email) IN (
        'acomp1@sigem.itap.gov.br','acomp2@sigem.itap.gov.br','gab@sigem.itap.gov.br'
      ) OR u.raw_app_meta_data->>'sigem_account' = 'followup-functional-pending'
    ) INTO _marked
    FROM auth.users u WHERE u.id = NEW.user_id;
    IF coalesce(_marked, false) THEN
      -- A data de vinculação não pode ser injetada retroativamente.
      NEW.created_at := clock_timestamp();
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id IN (OLD.user_id, NEW.user_id) AND (
        lower(u.email) IN (
          'acomp1@sigem.itap.gov.br','acomp2@sigem.itap.gov.br','gab@sigem.itap.gov.br'
        ) OR u.raw_app_meta_data->>'sigem_account' = 'followup-functional-pending'
      )
    ) INTO _marked;
    IF _marked THEN RAISE EXCEPTION 'followup:seat-rebind-requires-governance'; END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.followup_functional_seat_link_guard()
  FROM PUBLIC, anon, authenticated, service_role;
CREATE TRIGGER followup_functional_seat_link_guard
  BEFORE INSERT OR UPDATE ON public.user_person_links
  FOR EACH ROW EXECUTE FUNCTION public.followup_functional_seat_link_guard();
