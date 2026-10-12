-- Tecnologia — Lote corretivo 15: cadastros técnicos (contratos/licenças, conectividade, serviços, backups, ativos)
-- recusam informação de rede ou credencial em texto livre (IP, MAC, URL interna, senha/token), porque endereço
-- interno ou segredo gravado em ledger append-only não se desfaz. Writers e comprovação (contrato/evidência
-- juntados) já existentes seguem iguais; nada é semeado. Só INSERT é verificado (registros são imutáveis).
CREATE OR REPLACE FUNCTION public.tech_text_exposes_network(_t text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT _t IS NOT NULL AND (
       _t ~ '(^|[^0-9.])(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])){3}([^0-9.]|$)'
    OR _t ~* '(^|[^0-9a-f:])([0-9a-f]{2}[:-]){5}[0-9a-f]{2}([^0-9a-f:]|$)'
    OR _t ~* '(^|[^0-9a-f:])([0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}([^0-9a-f:]|$)'
    OR _t ~* '\m(senha|password|passwd|pwd|token|api[-_ ]?key|secret|segredo|ssid|wpa2?|psk|vlan)\M\s*[:=]'
    OR _t ~* '://[^/\s]*(localhost|\.local|\.lan|\.intranet|\.internal)([:/\s]|$)'
    OR _t ~* '://[^/\s@]*:[^/\s@]*@'
  )
$$;

CREATE OR REPLACE FUNCTION public.tech_registry_network_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE _col text; _val text; _row jsonb := to_jsonb(NEW);
BEGIN
  FOREACH _col IN ARRAY TG_ARGV LOOP
    _val := _row ->> _col;
    IF public.tech_text_exposes_network(_val) THEN RAISE EXCEPTION 'tech:network-info-refused' USING DETAIL = _col; END IF;
  END LOOP;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tech_registry_network_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS tech_net_guard ON public.tech_connectivity_links;
CREATE TRIGGER tech_net_guard BEFORE INSERT ON public.tech_connectivity_links FOR EACH ROW EXECUTE FUNCTION public.tech_registry_network_guard('provider_name');
DROP TRIGGER IF EXISTS tech_net_guard ON public.tech_digital_service_versions;
CREATE TRIGGER tech_net_guard BEFORE INSERT ON public.tech_digital_service_versions FOR EACH ROW EXECUTE FUNCTION public.tech_registry_network_guard('name','purpose','access_url');
DROP TRIGGER IF EXISTS tech_net_guard ON public.tech_equipment_sheets;
CREATE TRIGGER tech_net_guard BEFORE INSERT ON public.tech_equipment_sheets FOR EACH ROW EXECUTE FUNCTION public.tech_registry_network_guard('reason','equipment_type','manufacturer','model','specs');
DROP TRIGGER IF EXISTS tech_net_guard ON public.tech_backup_plan_versions;
CREATE TRIGGER tech_net_guard BEFORE INSERT ON public.tech_backup_plan_versions FOR EACH ROW EXECUTE FUNCTION public.tech_registry_network_guard('source_ref','scope');
DROP TRIGGER IF EXISTS tech_net_guard ON public.tech_restore_tests;
CREATE TRIGGER tech_net_guard BEFORE INSERT ON public.tech_restore_tests FOR EACH ROW EXECUTE FUNCTION public.tech_registry_network_guard('note');