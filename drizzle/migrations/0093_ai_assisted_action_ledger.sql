-- Trilha de ações assistidas por IA: append-only, gravada pelo PRÓPRIO usuário confirmante após o writer canônico.
CREATE TABLE public.ai_assisted_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_kind text NOT NULL CHECK (proposal_kind ~ '^[a-z0-9-]{3,60}$'),
  proposal_sha256 text NOT NULL CHECK (proposal_sha256 ~ '^[0-9a-f]{64}$'),
  writer text,
  outcome text NOT NULL CHECK (outcome IN ('executada','recusada','descartada')),
  result_ref text,
  school_id text,
  confirmed_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (confirmed_by, proposal_sha256, outcome)
);
GRANT SELECT ON public.ai_assisted_actions TO authenticated;
GRANT ALL ON public.ai_assisted_actions TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.ai_assisted_actions FROM PUBLIC, anon, authenticated;
ALTER TABLE public.ai_assisted_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proprias acoes assistidas" ON public.ai_assisted_actions FOR SELECT TO authenticated USING (confirmed_by = auth.uid());
CREATE TRIGGER ai_assisted_actions_ao BEFORE UPDATE OR DELETE ON public.ai_assisted_actions FOR EACH ROW EXECUTE FUNCTION public.integration_append_only();

-- O ator é sempre auth.uid(); nenhuma capability nova é criada para a IA.
CREATE OR REPLACE FUNCTION public.record_ai_assisted_action(_kind text, _sha256 text, _writer text, _outcome text, _result_ref text, _school text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'ai-action:unauthenticated'; END IF;
  INSERT INTO public.ai_assisted_actions(proposal_kind, proposal_sha256, writer, outcome, result_ref, school_id, confirmed_by)
  VALUES (_kind, _sha256, _writer, _outcome, left(_result_ref, 120), _school, auth.uid())
  ON CONFLICT (confirmed_by, proposal_sha256, outcome) DO NOTHING RETURNING id INTO _id;
  RETURN _id;
END; $$;
REVOKE ALL ON FUNCTION public.record_ai_assisted_action(text,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_ai_assisted_action(text,text,text,text,text,text) TO authenticated;