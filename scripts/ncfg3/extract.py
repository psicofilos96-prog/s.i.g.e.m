"""NCFG.3 — extrai só as colunas-chave (sem nome/CPF) para o dry-run. Somente leitura."""
import hashlib, json, sys, pandas as pd
from pathlib import Path
SRC = Path("/mnt/user-uploads"); out = {}
for f in ["Consolidado_Escolas_Municipais_Conveniadas_Itaperuna.xlsx", "Consolidado_Escolas_Privadas_Itaperuna.xlsx"]:
  p = SRC / f; x = pd.read_excel(p, sheet_name=None, dtype=str)
  pr, jo, tu = x["Professores"], x["Jornadas e Vínculos"], x["Turmas"]
  out[f] = {"sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
    "prof": [[a, b] for a, b in zip(pr["Identificação única"].fillna(""), pr["Código da Escola (Educacenso)"].fillna(""))],
    "jorn": [[a, b, c, d] for a, b, c, d in zip(jo["Identificação única"].fillna(""), jo["Código da Escola (Educacenso)"].fillna(""), jo["Vínculo na escola (Etapa de ensino) - Código da turma"].fillna(""), jo["Vínculo na escola (Etapa de ensino) - Carga horária semanal (hh:mm)"].fillna(""))],
    "turm": [[a, b] for a, b in zip(tu["Código da turma"].fillna(""), tu["Código da Escola (Educacenso)"].fillna(""))],
    "etapa": sorted(set(tu["Etapa de ensino"].dropna())), "componente": sorted({c.strip() for v in tu["Áreas do conhecimento/componentes curriculares"].dropna() for c in str(v).split(",") if c.strip()})}
json.dump(out, open(sys.argv[1], "w"))
