REVOKE SELECT ON public.ops_safety_certificate_refs FROM authenticated;
GRANT SELECT (id, school_id, space_id, kind, issuer, number_on_document, issued_on, valid_until, author_person, idempotency_key, created_at)
  ON public.ops_safety_certificate_refs TO authenticated;
