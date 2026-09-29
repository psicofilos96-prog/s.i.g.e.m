ALTER TABLE public.capability_policies ADD COLUMN homologated_by uuid;
CREATE OR REPLACE FUNCTION public.stamp_policy_homologation_author() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'homologated' AND OLD.status <> 'homologated' THEN NEW.homologated_by := auth.uid(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER capability_policies_stamp_author BEFORE UPDATE ON public.capability_policies FOR EACH ROW EXECUTE FUNCTION public.stamp_policy_homologation_author();