"""NCFG.1 — inventário determinístico das fontes 2027 (somente leitura; sem PII na saída)."""
import hashlib, json, sys, pandas as pd
from pathlib import Path
SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "/mnt/user-uploads")
GROUPS = {
 "escolas": ["INEP_-_ESCOLAS_atualizado_Recuperado_Automaticamente.xlsx","Consolidado_Escolas_Municipais_Conveniadas_Itaperuna.xlsx","Consolidado_Escolas_Privadas_Itaperuna.xlsx","Situacao_Escolas_Matriculas_municipais.xlsx","Situacao_Escolas_Matriculas_conveniadas.xlsx"],
 "turmas": ["Todas_as_turmas.xlsx","Todas_as_turmas-2.xlsx","Todas_as_turmas-3.xlsx","Consolidado_-_Dados_das_Turmas.xlsx","RelacaoTurmaEscola_31_7_2026.xlsx"],
 "alunos": ["Todos_os_alunos.xlsx","Todos_os_alunos-2.xlsx","Todos_os_alunos-3.xlsx","Consolidado_-_Dados_dos_Alunos.xlsx","ALUNOS_-_ESTATÍSTICA.xlsx","ALUNOS_-_SALA_AEE_-_2026_atualizado.xlsx"],
 "profissionais": ["Todos_os_prof.xlsx","Todos_os_prof-2.xlsx","Todos_os_prof-3.xlsx","Relacao_Servidores_por_Escola_Ago-Set_2026.xlsx"],
 "jornadas": ["Todas_as_jornadas.xlsx","Todas_as_jornadas-2.xlsx","Todas_as_jornadas-3.xlsx"],
 "censo": ["Censo_Escolar_2026_Preliminar_Itaperuna.xlsx","Matriz_Escolas_Itaperuna_Censo2026.xlsx","Matriz_Escolas_Itaperuna_Censo2026_PREENCHIDA.xlsx"],
 "infraestrutura": ["Aspectos_Infraestrutura_municipais.xlsx","Aspectos_Infraestrutura_municipais-2.xlsx","Aspectos_Infraestrutura_conveniadas.xlsx","Aspectos_Infraestrutura_conveniadas-2.xlsx"],
 "matriz_curriculo_calendario": ["RJ_2026_-_AvaliaRJ_1_-_Matriz_-_LP.pdf","RJ_2026_-_AvaliaRJ_1_-_Matriz_-_MT.pdf","Calendário_2026_assinado.pdf","Calendario_Unificado_Acompanhamento_e_Avaliacao_2_Semestre_2026.pdf"],
}
YEARS = ("2025","2026","2027")
out = []
for g, files in GROUPS.items():
  for f in files:
    p = SRC / f
    if not p.exists(): out.append({"grupo": g, "arquivo": f, "status": "AUSENTE"}); continue
    rec = {"grupo": g, "arquivo": f, "sha256": hashlib.sha256(p.read_bytes()).hexdigest()}
    if p.suffix == ".xlsx":
      sheets = []
      for sh, df in pd.read_excel(p, sheet_name=None, dtype=str).items():
        text = " ".join(map(str, df.columns)) + " " + " ".join(df.head(200).fillna("").astype(str).values.ravel())
        sheets.append({"aba": sh, "linhas": len(df), "colunas": len(df.columns),
          "cabecalho": [str(c) for c in df.columns][:40],
          "celulas_vazias_pct": round(float(df.isna().mean().mean()) * 100, 1) if len(df) else None,
          "linhas_duplicadas_exatas": int(df.duplicated().sum()),
          "anos_citados": sorted({y for y in YEARS if y in text})})
      rec["abas"] = sheets
    else: rec["tipo"] = "pdf (não tabular)"
    out.append(rec)
# cópias -2/-3 idênticas?
by = {}
for r in out:
  if "sha256" in r: by.setdefault(r["sha256"], []).append(r["arquivo"])
json.dump({"fontes": out, "copias_identicas": [v for v in by.values() if len(v) > 1]}, sys.stdout, ensure_ascii=False, indent=1, sort_keys=True)
