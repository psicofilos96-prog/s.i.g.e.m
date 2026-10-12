"""L38 — provas reais contra o banco (só tentativas que DEVEM falhar + leituras de contagem). Sem dado pessoal na saída."""
import json, os, sys, urllib.request, urllib.error
url, svc, pub = os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"], os.environ["SUPABASE_PUBLISHABLE_KEY"]
T = f"{url}/rest/v1"
res = []
def call(method, path, key, body=None, extra=None):
    h = {"apikey": key, "Content-Type": "application/json", "Prefer": "return=representation"}
    if key == svc: h["Authorization"] = f"Bearer {svc}"
    h.update(extra or {})
    req = urllib.request.Request(T + path, data=json.dumps(body).encode() if body is not None else None, method=method, headers=h)
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e: return e.code, e.read().decode()[:600]
def check(name, ok, info=""): res.append(ok); print(("PASS " if ok else "FAIL ") + name + (f" — {info}" if info else ""))

rows = []
for off in range(0, 5000, 1000):
    s, pg = call("GET", f"/payroll_functional_registrations?select=id,registration_norm,full_name,birth_date,source_sha256,row_no&order=row_no&offset={off}&limit=1000", svc)
    rows += pg
    if len(pg) < 1000: break
regs = [r["registration_norm"] for r in rows]
check("matrícula única por vínculo", len(regs) == len(set(regs)) == 2037, f"{len(regs)} linhas")
from collections import Counter
pp = Counter((r["full_name"].upper(), r["birth_date"]) for r in rows)
two = sum(1 for v in pp.values() if v >= 2)
check("mesma pessoa provável com 2 matrículas = 2 vínculos separados", two == 85 and len(pp) == 1952, f"{two} pares nome+nasc com 2 vínculos")
a = rows[0]
dup = dict(source_file="x", source_sha256=a["source_sha256"], sheet="AGOSTO", row_no=99999, reference_period="2026-08",
           registration_raw=a["registration_norm"], registration_norm=a["registration_norm"], full_name="TESTE L38")
s, b = call("POST", "/payroll_functional_registrations", svc, dup)
check("reimportação/duplicata de matrícula recusada pelo banco", s == 409, str(s))
q = dict(dup, row_no=99998, registration_raw="9999999", registration_norm="9999999", qpmec_number="999999-9")
s, b = call("POST", "/payroll_functional_registrations", svc, q)
check("QP-MEC igual à matrícula recusado", s == 400 and "pfr_qpmec_not_registration" in b, str(s))
bad = dict(dup, row_no=99997, registration_raw="12-3", registration_norm="999")
s, b = call("POST", "/payroll_functional_registrations", svc, bad)
check("normalização sem perda de dígito verificador imposta", s == 400 and "pfr_norm_matches" in b, str(s))
s, b = call("PATCH", f"/payroll_functional_registrations?id=eq.{a['id']}", svc, {"cargo_label": "X"})
check("append-only: alteração recusada", s >= 400 and "append-only" in b, str(s))
s, b = call("DELETE", f"/payroll_functional_registrations?id=eq.{a['id']}", svc)
check("append-only: exclusão recusada", s >= 400 and "append-only" in b, str(s))
s, b = call("GET", "/payroll_functional_registrations?select=id&limit=5", pub)
check("RLS: anônimo não lê vínculos", (s == 200 and b == []) or s in (401, 403), str(s))
s, b = call("POST", "/payroll_functional_registrations", pub, dict(dup, row_no=99996))
check("anônimo não grava", s in (401, 403), str(s))
s, b = call("POST", "/rpc/record_payroll_person_link", pub, {"_registration_norm": a["registration_norm"], "_expected_seq": 0, "_action": "vincular", "_person_id": None, "_evidence": "x" * 12, "_idempotency_key": "l38"})
check("anônimo não vincula pessoa", s in (401, 403), str(s))
s, b = call("POST", "/rpc/record_payroll_person_link", svc, {"_registration_norm": a["registration_norm"], "_expected_seq": 0, "_action": "vincular", "_person_id": None, "_evidence": "x" * 12, "_idempotency_key": "l38"})
check("vinculação sem sessão humana recusada (executor técnico não decide)", s >= 400 and "sem-sessao" in b, str(s))
s, b = call("GET", "/payroll_registration_person_links?select=id", svc)
check("nenhuma ligação vínculo→pessoa criada", s == 200 and b == [], f"{len(b) if isinstance(b, list) else b}")
s, b = call("GET", "/payroll_staff_registration_matches?select=source_kind,registration_found", svc)
semed = [x for x in b if x["source_kind"] == "funcionarios-semed-por-setor"]
check("SEMED: 213 de 219 matrículas casam com a folha", sum(x["registration_found"] for x in semed) == 213 and len(semed) == 219)
print(f"L38_CHECKS {sum(res)}/{len(res)}"); sys.exit(0 if all(res) else 1)
