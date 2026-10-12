"""L38 — carga técnica idempotente da folha de matrículas (vínculos funcionais).
Uso: SIGEM_L38_IMPORT=1 python3 scripts/lote38-payroll-import.py <arquivo.xlsx>
Só grava em payroll_functional_registrations (append-only). Nunca cria pessoa, vínculo de pessoa, lotação ou permissão.
Nunca imprime nome, data ou matrícula: só contagens.
"""
import hashlib, json, os, re, sys, urllib.request
from datetime import datetime
import pandas as pd

CANONICAL = "crfqhyqkujhhlbiyhdbc"
url, key = os.environ.get("SUPABASE_URL", ""), os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if os.environ.get("SIGEM_L38_IMPORT") != "1": sys.exit("recusado: SIGEM_L38_IMPORT≠1")
if f"{CANONICAL}.supabase.co" not in url or not key: sys.exit("recusado: destino não canônico ou sem credencial técnica")
path = sys.argv[1]
raw = open(path, "rb").read()
sha = hashlib.sha256(raw).hexdigest()
df = pd.read_excel(path, sheet_name="AGOSTO", dtype=str)
need = ["Matricula", "Nome", "Admissao", "Horas mensais", "Carga horária", "CodCargo", "Cargo", "Nascimento"]
if list(df.columns[: len(need)]) != need: sys.exit("recusado: leiaute diferente do esperado")

def d(v):
    try: return datetime.strptime(str(v).strip(), "%d/%m/%Y").date().isoformat()
    except Exception: return None
def i(v):
    try: return int(str(v).strip())
    except Exception: return None

rows, rejected = [], []
for n, r in enumerate(df.itertuples(index=False), start=2):  # linha 1 = cabeçalho
    reg = str(r[0] or "").strip(); norm = re.sub(r"\D", "", reg); name = str(r[1] or "").strip()
    if not norm or not name: rejected.append((n, "sem-matricula-ou-nome")); continue
    rows.append({"source_file": os.path.basename(path), "source_sha256": sha, "sheet": "AGOSTO", "row_no": n,
                 "reference_period": "2026-08", "registration_raw": reg, "registration_norm": norm, "full_name": name,
                 "birth_date": d(r[7]), "admission_date": d(r[2]), "monthly_hours": i(r[3]),
                 "weekly_workload_text": (str(r[4]).strip() if pd.notna(r[4]) else None),
                 "cargo_code": (str(r[5]).strip() if pd.notna(r[5]) else None), "cargo_label": (str(r[6]).strip() if pd.notna(r[6]) else None)})
dups = len(rows) - len({x["registration_norm"] for x in rows})
if dups: sys.exit(f"recusado: {dups} matrícula(s) repetida(s) após normalização")

inserted = 0
for k in range(0, len(rows), 500):
    req = urllib.request.Request(f"{url}/rest/v1/payroll_functional_registrations?on_conflict=source_sha256,sheet,row_no",
        data=json.dumps(rows[k:k + 500]).encode(), method="POST",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json",
                 "Prefer": "resolution=ignore-duplicates,return=representation"})
    with urllib.request.urlopen(req) as resp: inserted += len(json.loads(resp.read()))
print(json.dumps({"sha256": sha, "linhas": len(df), "validas": len(rows), "rejeitadas": len(rejected),
                  "motivos": sorted({m for _, m in rejected}), "gravadas_agora": inserted,
                  "ja_existentes": len(rows) - inserted,
                  "sem_nascimento": sum(1 for x in rows if not x["birth_date"]),
                  "sem_admissao": sum(1 for x in rows if not x["admission_date"])}))
