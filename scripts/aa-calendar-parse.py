#!/usr/bin/env python3
"""A&A Lote 4 — extrai o cronograma 2026 (xlsx 1º sem + PDF 2º sem) em linhas com proveniência.
Reexecutável; não grava nada. Saída: JSON com hash da fonte, linha original e datas só quando legíveis."""
import hashlib, json, re, subprocess, sys
import openpyxl

UP = "/mnt/user-uploads/"
XLSX = UP + "Cronograma_Unificado_Avaliacoes_2026.xlsx"
PDF = UP + "Calendario_Unificado_Acompanhamento_e_Avaliacao_2_Semestre_2026.pdf"
YEAR = 2026

def sha(p): return hashlib.sha256(open(p, "rb").read()).hexdigest()

def parse_dates(t):
    t = t.strip()
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2})(?:/(\d{4}))?", t)
    if m: d = f"{m[3] or YEAR}-{int(m[2]):02d}-{int(m[1]):02d}"; return d, d
    m = re.fullmatch(r"(\d{1,2}) (?:a|e) (\d{1,2})/(\d{1,2})(?:/(\d{4}))?", t)
    if m: y = m[4] or YEAR; return f"{y}-{int(m[3]):02d}-{int(m[1]):02d}", f"{y}-{int(m[3]):02d}-{int(m[2]):02d}"
    m = re.fullmatch(r"(\d{1,2})/(\d{1,2}) a (\d{1,2})/(\d{1,2})", t)
    if m: return f"{YEAR}-{int(m[2]):02d}-{int(m[1]):02d}", f"{YEAR}-{int(m[4]):02d}-{int(m[3]):02d}"
    return None, None

def kind(a):
    s = a.lower()
    if "recupera" in s: return "recuperacao"
    if "devolutiva" in s: return "devolutiva"
    if "validação" in s or "validacao" in s or "conferência" in s: return "validacao"
    if "lançamento" in s or "prazo final" in s or "último dia" in s or "envio" in s or "preenchimento" in s: return "lancamento"
    if "análise" in s: return "analise"
    if "formação" in s: return "formacao"
    if "conselho" in s: return "conselho"
    if any(k in s for k in ["avaliação", "simula", "av1", "av2", "av3", "diagnóstica", "percurso", "prova"]): return "aplicacao"
    return "outro"

def program(a, seg):
    s = (a + " " + seg).lower()
    if "saber ler" in s: return "saber-ler"
    if "simula" in s: return "simula-saeb"
    if "produção" in s and "text" in s: return "producao-textual"
    if "infantil" in s or seg.strip() == "EI" or "percurso" in s: return "educacao-infantil" if kind(a) != "outro" else None
    if "diagnóstica" in s: return "diagnostica-formativa"
    if "cnca" in s or "caed" in s: return "cnca-caed"
    return None

rows = []
wb = openpyxl.load_workbook(XLSX, data_only=True)
for ws in wb:
    for i, r in enumerate(ws.iter_rows(values_only=True), 1):
        if i == 1 or not any(r): continue
        date, seg, act, obs = [("" if c is None else str(c)) for c in (list(r) + [None] * 4)[:4]]
        s, e = parse_dates(date)
        rows.append(dict(source="xlsx", line=i, date_text=date, start=s, end=e, segment=seg, action=act, note=obs or None, relation=None))

txt = subprocess.run(["pdftotext", "-layout", PDF, "-"], capture_output=True, text=True).stdout
REL = r"(DIRETA|ACOMPANHAMENTO|GERAL)"
DATE = r"(\d{1,2}/\d{1,2}(?: a \d{1,2}/\d{1,2})?|\d{1,2} (?:a|e) \d{1,2}/\d{1,2}|Durante o mês|Semana de \d{1,2}/\d{1,2})"
pend = []
for n, line in enumerate(txt.splitlines(), 1):
    m = re.match(rf"^\s*{DATE}\s{{2,}}(.+?)\s{{2,}}(.+?)\s{{2,}}{REL}\s*$", line)
    m2 = re.match(rf"^\s*{DATE}\s{{2,}}(.+?)\s{{2,}}{REL}\s*$", line)
    if m or m2:
        if m: d, seg, act, rel = m.groups()
        else: d, seg, rel = m2.groups(); act = ""
        act = (" ".join(pend) + " " + act).strip(); pend = []
        s, e = parse_dates(d)
        rows.append(dict(source="pdf", line=n, date_text=d, start=s, end=e, segment=seg.strip(), action=act, note=None, relation=rel))
    elif re.match(r"^\s{20,}\S", line) and not re.search(r"SECRETARIA|Página|CALENDÁRIO|^\s*(JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO)", line) and "DATA" not in line:
        t = line.strip()
        if rows and rows[-1]["source"] == "pdf" and rows[-1]["line"] == n - 1 and pend == []: rows[-1]["action"] += " " + t
        else: pend.append(t)
    else:
        pend = [] if not line.strip() else pend

for r in rows:
    r["kind"] = kind(r["action"]); r["program"] = program(r["action"], r["segment"])
out = dict(year=YEAR, sources={"xlsx": dict(file=XLSX.split("/")[-1], sha256=sha(XLSX)), "pdf": dict(file=PDF.split("/")[-1], sha256=sha(PDF))}, rows=rows)
json.dump(out, sys.stdout, ensure_ascii=False, indent=1)
