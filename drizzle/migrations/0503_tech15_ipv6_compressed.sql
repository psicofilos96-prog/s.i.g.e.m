-- Forward-fix 0502: IPv6 comprimido (ex.: fe80::1) também é recusado.
CREATE OR REPLACE FUNCTION public.tech_text_exposes_network(_t text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT _t IS NOT NULL AND (
       _t ~ '(^|[^0-9.])(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])){3}([^0-9.]|$)'
    OR _t ~* '(^|[^0-9a-f:])([0-9a-f]{2}[:-]){5}[0-9a-f]{2}([^0-9a-f:]|$)'
    OR _t ~* '(^|[^0-9a-f:])([0-9a-f]{1,4}:){3,7}[0-9a-f]{1,4}([^0-9a-f:]|$)'
    OR _t ~* '(^|[^0-9a-z:])[0-9a-f]{0,4}(:[0-9a-f]{1,4})*::([0-9a-f]{1,4}(:[0-9a-f]{1,4})*)?([^0-9a-z:]|$)'
    OR _t ~* '\m(senha|password|passwd|pwd|token|api[-_ ]?key|secret|segredo|ssid|wpa2?|psk|vlan)\M\s*[:=]'
    OR _t ~* '://[^/\s]*(localhost|\.local|\.lan|\.intranet|\.internal)([:/\s]|$)'
    OR _t ~* '://[^/\s@]*:[^/\s@]*@'
  )
$$;