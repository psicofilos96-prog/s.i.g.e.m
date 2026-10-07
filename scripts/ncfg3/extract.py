"""NCFG.3 — extrai só as colunas-chave (sem nome/CPF) para o dry-run. Somente leitura."""
import hashlib, json, sys, pandas as pd
from pathlib import Path
def col(df,*names):
  for n in names:
    if n in df: return df[n]
  return pd.Series([""]*len(df))  # coluna ausente ⇒ sem chave (recusa), nunca inferida
SRC = Path("/mnt/user-uploads"); out = {}
for f in ["Consolidado_Escolas_Municipais_Conveniadas_Itaperuna.xlsx", "Consolidado_Escolas_Privadas_Itaperuna.xlsx"]:
  p = SRC / f; x = pd.read_excel(p, sheet_name=None, dtype=str)
  pr, jo, tu = x["Professores"], x["Jornadas e Vínculos"], x["Turmas"]
  out[f] = {"sha256": hashlib.sha256(p.read_bytes()).hexdigest(),
    "prof": [[a, b] for a, b in zip(pr["Identificação única"].fillna(""), col(pr,"Código da Escola (Educacenso)").fillna(""))],
    "jorn": [[a, b, c, d] for a, b, c, d in zip(jo["Identificação única"].fillna(""), col(jo,"Código da Escola (Educacenso)","Código da Escola").fillna(""), jo["Vínculo na escola (Etapa de ensino) - Código da turma"].fillna(""), jo["Vínculo na escola (Etapa de ensino) - Carga horária semanal (hh:mm)"].fillna(""))],
    "turm": [[a, b] for a, b in zip(tu["Código da turma"].fillna(""), col(tu,"Código da Escola (Educacenso)").fillna(""))],
    "etapa": sorted(set(tu["Etapa de ensino"].dropna())), "componente": sorted({c.strip() for v in tu["Áreas do conhecimento/componentes curriculares"].dropna() for c in str(v).split(",") if c.strip()})}
json.dump(out, open(sys.argv[1], "w"))
