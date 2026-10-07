-- NDB.2: applicable_diary_policy(text,boolean) é DEPRECATED (substituída por applicable_diary_policy_on), sem chamada no app,
-- em políticas ou testes; os chamadores restantes são SECURITY DEFINER (executam como dono). Revoga só o EXECUTE residual.
REVOKE EXECUTE ON FUNCTION public.applicable_diary_policy(text, boolean) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.applicable_diary_policy(text, boolean) IS 'DEPRECATED for W writers: replaced by applicable_diary_policy_on (vigência na data da aula, W.2). NDB.2: sem EXECUTE para sessões; só chamadores DEFINER internos.';