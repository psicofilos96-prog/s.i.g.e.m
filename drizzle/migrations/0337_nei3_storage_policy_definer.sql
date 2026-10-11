CREATE OR REPLACE FUNCTION public.nei_plan_object_allowed(_name text, _upload boolean) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.nei_plan_attachments a
    WHERE a.object_path = _name AND (NOT _upload OR a.recorded_by = auth.uid()) AND public.nei_plan_role(a.plan_id) IS NOT NULL)
$$;
REVOKE ALL ON FUNCTION public.nei_plan_object_allowed(text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nei_plan_object_allowed(text,boolean) TO authenticated;
DROP POLICY "nei_planos_read" ON storage.objects;
DROP POLICY "nei_planos_insert" ON storage.objects;
CREATE POLICY "nei_planos_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'nei-planos' AND public.nei_plan_object_allowed(name, false));
CREATE POLICY "nei_planos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'nei-planos' AND public.nei_plan_object_allowed(name, true));