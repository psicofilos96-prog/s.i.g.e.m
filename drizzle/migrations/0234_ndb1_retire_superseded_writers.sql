REVOKE EXECUTE ON FUNCTION public.record_curricular_reference_edition(text,text,text,text,date,date,text,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_curricular_reference_relation(uuid,uuid,text,text,text,uuid,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_curricular_reference_simplification(uuid,uuid,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.record_guardian_authorization_v2(uuid,text,text,uuid,uuid,text,text,text,text[],date,date,text,text) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.record_curricular_reference_edition(text,text,text,text,date,date,text,text,uuid,jsonb) IS 'DEPRECATED (NDB.1): replaced by record_curricular_reference_edition_v2';
COMMENT ON FUNCTION public.record_curricular_reference_relation(uuid,uuid,text,text,text,uuid,text) IS 'DEPRECATED (NDB.1): replaced by record_curricular_reference_relation_v2';
COMMENT ON FUNCTION public.record_curricular_reference_simplification(uuid,uuid,text,text) IS 'DEPRECATED (NDB.1): replaced by record_curricular_reference_simplification_v2';
COMMENT ON FUNCTION public.record_guardian_authorization_v2(uuid,text,text,uuid,uuid,text,text,text,text[],date,date,text,text) IS 'DEPRECATED (NDB.1): replaced by record_guardian_authorization_v3';