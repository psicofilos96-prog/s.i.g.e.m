"""L38/L39 — PREPARADOR do payload da folha. NÃO grava no banco e não usa credencial.
Desde L39 a única via de escrita é public.technical_import_payroll_functional_registrations(hash, payload),
sem EXECUTE para anon/authenticated/service_role, protegida por switch no banco (payroll_import_switch_events)
e pelo ledger technical_execution_operations. A chamada é feita pela camada técnica privilegiada, nunca por PostgREST.
Uso: python3 scripts/lote38-payroll-import.py <arquivo.xlsx> <saida-privada.json>
Saída: payload em arquivo fora do repositório (ex.: /tmp). No terminal só contagens — nunca nome, data ou matrícula.
"""
import hashlib, json, os, sys
from datetime import datetime
import pandas as pd

LAYOUT = ["Matricula", "Nome", "Admissao", "Horas mensais", "Carga horária", "CodCargo", "Cargo", "Nascimento"]
if len(sys.argv) != 3: sys.exit("uso: <arquivo.xlsx> <saida.json>")
src, out = sys.argv[1], os.path.abspath(sys.argv[2])
if out.startswith(os.path.abspath(".")): sys.exit("recusado: payload com dado pessoal não pode ficar dentro do repositório")
raw = open(src, "rb").read(); sha = hashlib.sha256(raw).hexdigest()
df = pd.read_excel(src, sheet_name="AGOSTO", dtype=str)
if list(df.columns[: len(LAYOUT)]) != LAYOUT: sys.exit("recusado: leiaute diferente do esperado")

def d(v):
    try: return datetime.strptime(str(v).strip(), "%d/%m/%Y").date().isoformat()
    except Exception: return None
def s(v): return str(v).strip() if pd.notna(v) and str(v).strip() else None

rows = []
for n, r in enumerate(df.itertuples(index=False), start=2):  # linha 1 = cabeçalho
    h = s(r[3])
    rows.append({"row_no": n, "registration_raw": s(r[0]) or "", "full_name": s(r[1]) or "",
                 "birth_date": d(r[7]), "admission_date": d(r[2]),
                 "monthly_hours": int(h) if h and h.isdigit() else None,
                 "weekly_workload_text": s(r[4]), "cargo_code": s(r[5]), "cargo_label": s(r[6])})
payload = {"manifest": {"source_hash": sha, "source_ref": os.path.basename(src), "sheet": "AGOSTO",
                        "reference_period": "2026-08", "row_count": len(rows), "layout": LAYOUT}, "rows": rows}
with open(out, "w", encoding="utf-8") as f: json.dump(payload, f, ensure_ascii=False)
os.chmod(out, 0o600)
print(json.dumps({"sha256": sha, "linhas": len(rows), "payload": "gravado em arquivo privado (0600)"}))
