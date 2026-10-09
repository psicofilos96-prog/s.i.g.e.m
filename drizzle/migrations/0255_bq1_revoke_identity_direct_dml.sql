-- BQ.1: identidade do estudante só pelo writer oficial; nenhum papel do app grava direto.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.student_identity_versions FROM PUBLIC, anon, authenticated;