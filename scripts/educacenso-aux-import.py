#!/usr/bin/env python3
"""Ingestão reexecutável das tabelas auxiliares do Censo Escolar (Educacenso).

Uso: python3 scripts/educacenso-aux-import.py <pasta-dos-xlsx> <pacote.rar> > /tmp/aux.sql ; psql -f /tmp/aux.sql
- Cada arquivo entra com SHA-256, ano de referência (do NOME do arquivo), aba e origem (avulso / também no pacote).
- Códigos SEMPRE como texto: inteiro é escrito sem casas decimais; formato numérico com zeros ("00000")
  é respeitado; texto é preservado (zeros iniciais).
- Idempotente: fontes únicas por (ano, tabela, hash, aba) e linhas por (fonte, nº da linha) com ON CONFLICT DO NOTHING.
- Tabela auxiliar é fonte documental; não homologa leiaute nem importação.
"""
import hashlib, json, os, re, subprocess, sys, unicodedata
import openpyxl

def norm(s): return unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()

# chave, padrão do nome (sem acento), título, extração
TABLES = [
    ("dependencias", "dependencias", "Dependências"),
    ("distritos", "distritos", "Distritos"),
    ("etapas", "etapas", "Etapas de ensino"),
    ("ies", "_ies_", "IES"),
    ("linguas_indigenas", "linguas_indigenas", "Línguas indígenas"),
    ("mediacao", "mediacao", "Mediação didático-pedagógica (Anexo 7)"),
    ("municipios", "municipios", "Municípios"),
    ("orgaos_regionais", "orgaos_regionais", "Órgãos regionais"),
    ("paises", "paises", "Países"),
    ("povos_indigenas", "povos_indigenas", "Povos indígenas"),
    ("regioes_administrativas", "regioes_administrativas", "Regiões administrativas (DF)"),
    ("regras_areas", "regras_de_areas", "Regras de áreas do conhecimento"),
    ("regras_horarios", "horarios_coincidentes", "Regras de horários coincidentes"),
    ("atividade_complementar", "atividade_complementar", "Tipo de atividade complementar"),
    ("transtorno_recurso", "transtornos_x_recurso", "Transtornos x recurso"),
    ("deficiencia_recurso", "deficiencia_x_recurso", "Deficiência x recurso"),
    ("areas_componentes", "areas_do_conhecimento_componentes", "Áreas do conhecimento / componentes"),
    ("aee", "atendimento_educacional", "Atividades de AEE"),
    ("cursos_superior", "formacao_superior", "Cursos de formação superior"),
    ("cursos_profissional", "educacao_profissional", "Cursos da educação profissional"),
    ("ddd", "_ddd_", "DDD"),
    ("areas_pos", "pos_graduacao", "Áreas de pós-graduação"),
]

def cell_text(c):
    v = c.value
    if v is None: return ""
    if isinstance(v, bool): return "1" if v else "0"
    if isinstance(v, float) and v.is_integer(): v = int(v)
    if isinstance(v, int):
        fmt = c.number_format or ""
        if re.fullmatch(r"0{2,}", fmt): return str(v).zfill(len(fmt))
        return str(v)
    return str(v).replace("\xa0", " ").strip()

def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""): h.update(b)
    return h.hexdigest()

def year_of(name):
    m = re.findall(r"(20\d\d)", name); return m[-1] if m else "2026"  # mediação: arquivo sem ano, título "Censo Escolar 2026" vem no anexo

def header_index(rows):
    for i, r in enumerate(rows):
        t = [x for x in r if x]
        if len(t) >= 2 and not any(k in norm(" ".join(t)) for k in ("instituto nacional", "censo escolar 20")) and i + 1 < len(rows): return i
    return None

def fill_down(rows, cols):
    last = {}
    for r in rows:
        for c in cols:
            if c < len(r):
                if r[c]: last[c] = r[c]
                else: r[c] = last.get(c, "")
    return rows

def extract(key, rows, h):
    """Devolve (codes, rules). Linhas de dados = rows[h+1:] com nº de linha original."""
    data = [(i + 1, list(r)) for i, r in enumerate(rows) if i > h and any(r)]
    codes, rules = [], []
    def code(no, c, label, parent=None, **attrs): 
        if c: codes.append({"row_no": no, "code": c, "label": label or None, "parent_code": parent or None, "attrs": attrs})
    cols = lambda r, n: (r + [""] * n)[:n]
    if key in ("dependencias", "paises", "povos_indigenas", "regioes_administrativas", "aee", "areas_pos"):
        for no, r in data:
            r = [x for x in r if x] + ["", ""]
            if re.fullmatch(r"\d+", r[0]): code(no, r[0], r[1], **({"nacionalidade": r[2]} if key == "paises" and r[2] else {}))
    elif key == "municipios":
        for no, r in data:
            a = cols(r, 4); code(no, a[2], a[3], a[0], uf=a[1])
    elif key == "ddd":
        for no, r in data:
            a = cols(r, 5); code(no, a[2], a[3], a[0], uf=a[1], ddd=a[4])
    elif key == "distritos":
        for no, r in data:
            a = cols(r, 7); code(no, a[4], a[5], a[2], uf=a[1], municipio=a[3], codigo_importacao=a[6])
    elif key == "orgaos_regionais":
        for no, r in data:
            a = cols(r, 6); code(no, a[4], a[5], a[2], uf=a[1], municipio=a[3])
    elif key == "ies":
        for no, r in data:
            a = cols(r, 7); code(no, a[0], a[1], None, situacao=a[2], categoria=a[3], municipio=a[4], alteracao=a[5], atualizacao=a[6])
    elif key == "etapas":
        data = [(no, r) for no, r in data if re.fullmatch(r"\d+", (cols(r, 8)[6] or ""))]
        fill_down([r for _, r in data], [0, 1])
        for no, r in data:
            a = cols(r, 8); code(no, a[6], a[7], a[0], etapa_agregada=a[1], filtro=a[5])
    elif key == "linguas_indigenas":
        fill_down([r for _, r in data], [1, 2, 3])
        for no, r in data:
            a = cols(r, 6)
            if re.fullmatch(r"\d+", a[4]): code(no, a[4], a[5], None, tronco=a[1].strip(), familia=a[2], classificacao=a[3])
    elif key == "atividade_complementar":
        fill_down([r for _, r in data], [0, 1])
        for no, r in data:
            a = cols(r, 4)
            if re.fullmatch(r"\d+", a[2]): code(no, a[2], a[3], a[1].split(".")[0].strip(), area=a[0], subarea=a[1])
    elif key == "cursos_profissional":
        fill_down([r for _, r in data], [0])
        for no, r in data:
            a = cols(r, 4)
            if re.fullmatch(r"\d+", a[1]): code(no, a[1], a[2], a[0].split(".")[0].strip(), eixo=a[0], carga_horaria_minima=a[3])
    elif key == "cursos_superior":
        for no, r in data:
            a = cols(r, 9)
            if a[6]: code(no, a[6], a[7] if len(a) > 7 else "", a[4], area_geral=a[1], area_especifica=a[3], area_detalhada=a[5], grau=a[8] if len(a) > 8 else "")
    elif key == "areas_componentes":
        grupo = ""
        for no, r in data:
            t = [x for x in r if x]
            if len(t) == 1: grupo = t[0]
            elif t and re.fullmatch(r"\d+", t[0]): code(no, t[0], t[1].strip(), None, area=grupo)
    elif key in ("deficiencia_recurso", "transtorno_recurso"):
        kind = key.replace("_", "-")
        for no, r in data:
            a = cols(r, 2)
            if a[0] and a[1]: rules.append({"seq": no, "rule_kind": kind, "left_key": a[0], "right_key": a[1], "attrs": {}})
    elif key in ("mediacao", "etapas_tipo_turma"):
        fill_down([r for _, r in data], [0, 1])
        for no, r in data:
            a = cols(r, 4)
            lista = re.findall(r"\d+", a[3]) if a[3] and "aplica" not in norm(a[3]) else []
            if not lista:
                rules.append({"seq": no * 1000, "rule_kind": "etapa-tipo-turma-sem-etapa", "left_key": a[1], "right_key": None, "attrs": {"mediacao": a[0], "tipo_turma": a[1], "etapa_agregada": a[2].strip(" -"), "texto": a[3]}})
            for k, e in enumerate(lista):
                rules.append({"seq": no * 1000 + k, "rule_kind": "etapa-tipo-turma", "left_key": a[1], "right_key": e, "attrs": {"mediacao": a[0], "tipo_turma": a[1], "etapa_agregada": a[2]}})
    elif key == "regras_areas":
        for no, r in data:
            a = cols(r, 3)
            m = re.match(r"\s*(\d+)\s+(.*)", a[0])
            if m: rules.append({"seq": no, "rule_kind": "etapa-areas", "left_key": m.group(1), "right_key": None, "attrs": {"etapa": m.group(2), "devem": a[1], "nao_devem": a[2]}})
    elif key == "regras_horarios":
        rules.append({"seq": 1, "rule_kind": "texto-normativo", "left_key": "horarios-coincidentes", "right_key": None, "attrs": {"texto": "\n".join(" ".join(x for x in r if x) for _, r in data)}})
    return codes, rules

def lit(x): return "'" + x.replace("'", "''") + "'"

def main(folder, rar):
    # Hash por entrada lida direto do pacote (extrair em disco colide nomes com acento mal codificados).
    entries = [n for n in subprocess.run(["unrar", "lb", rar], capture_output=True, check=True).stdout.split(b"\n") if n]
    pkg = {hashlib.sha256(subprocess.run(["unrar", "p", "-inul", rar, n], capture_output=True, check=True).stdout).hexdigest() for n in entries}
    print(f"-- pacote: {len(entries)} entradas, {len(pkg)} hashes distintos", file=sys.stderr)
    pkg_sha = sha(rar); op = "educacenso-aux-" + pkg_sha[:12]
    files = sorted(f for f in os.listdir(folder) if f.startswith("Tabela_de_") and f.endswith(".xlsx"))
    out = ["BEGIN;"]; report = []
    for f in files:
        n = norm(f); spec = next((t for t in TABLES if t[1] in n), None)
        if not spec: report.append(("IGNORADO", f)); continue
        path = os.path.join(folder, f); h = sha(path); year = year_of(f)
        wb = openpyxl.load_workbook(path, data_only=True)
        for ws in wb.worksheets:
            key = spec[0]
            if key == "etapas" and "turma" in norm(ws.title): key = "etapas_tipo_turma"
            rows = [[cell_text(c) for c in r] for r in ws.iter_rows()]
            while rows and not any(rows[-1]): rows.pop()
            kw = {"deficiencia_recurso": "recurso", "transtorno_recurso": "recurso", "mediacao": "tipo de turma", "etapas_tipo_turma": "tipo de  turma", "regras_horarios": "regras horarios", "etapas": "nome etapa"}.get(key)
            exact = {"deficiencia_recurso": "deficiencia", "transtorno_recurso": "transtorno", "mediacao": "tipo de mediacao didatico-pedagogica", "etapas_tipo_turma": "tipo de mediacao didatico-pedagogica"}.get(key)
            if exact: hi = next((i for i, r in enumerate(rows) if r and norm(next((x for x in r if x), "")) == exact), None)
            else: hi = next((i for i, r in enumerate(rows) if kw in norm(" ".join(r))), None) if kw else header_index(rows)
            if key == "etapas_tipo_turma" and hi is None: hi = next((i for i, r in enumerate(rows) if "tipo de turma" in norm(" ".join(r)).replace("  ", " ")), None)
            if hi is None: report.append(("SEM-CABECALHO", f, ws.title)); continue
            codes, rules = extract(key, rows, hi)
            title = spec[2] + (" — Tipo de turma × Etapa" if key == "etapas_tipo_turma" else "")
            notes = None
            if key == "deficiencia_recurso": notes = "Arquivo nomeado 2025; cabeçalho interno diz 'Censo Escolar 2026'. Versionado como 2025 e NÃO aplicado a 2026."
            if key == "mediacao": notes = "Arquivo sem ano no nome; conteúdo é o Anexo 7. Ano 2026 atribuído pelo pacote tabelas_auxiliares_2026."
            raw = [{"row_no": i + 1, "cells": r} for i, r in enumerate(rows) if any(r)]
            src = f"(SELECT id FROM public.educacenso_aux_sources WHERE reference_year={lit(year)} AND table_key={lit(key)} AND file_sha256={lit(h)} AND sheet_name={lit(ws.title)})"
            out.append(f"INSERT INTO public.educacenso_aux_sources (reference_year,table_key,title,file_name,sheet_name,file_sha256,in_package,package_sha256,header,row_count,extracted_count,notes,technical_operation_id) VALUES ({lit(year)},{lit(key)},{lit(title)},{lit(f)},{lit(ws.title)},{lit(h)},{'true' if h in pkg else 'false'},{lit(pkg_sha) if h in pkg else 'NULL'},{lit(json.dumps(rows[hi] if hi is not None and hi < len(rows) else [], ensure_ascii=False))}::jsonb,{len(raw)},{len(codes) + len(rules)},{lit(notes) if notes else 'NULL'},{lit(op)}) ON CONFLICT DO NOTHING;")
            out.append(f"INSERT INTO public.educacenso_aux_rows (source_id,row_no,cells) SELECT {src},(e->>'row_no')::int,e->'cells' FROM jsonb_array_elements({lit(json.dumps(raw, ensure_ascii=False))}::jsonb) e ON CONFLICT DO NOTHING;")
            if codes: out.append(f"INSERT INTO public.educacenso_aux_codes (source_id,row_no,table_key,reference_year,code,label,parent_code,attrs) SELECT {src},(e->>'row_no')::int,{lit(key)},{lit(year)},e->>'code',e->>'label',e->>'parent_code',e->'attrs' FROM jsonb_array_elements({lit(json.dumps(codes, ensure_ascii=False))}::jsonb) e ON CONFLICT DO NOTHING;")
            if rules: out.append(f"INSERT INTO public.educacenso_aux_rules (source_id,seq,table_key,reference_year,rule_kind,left_key,right_key,attrs) SELECT {src},(e->>'seq')::int,{lit(key)},{lit(year)},e->>'rule_kind',e->>'left_key',e->>'right_key',e->'attrs' FROM jsonb_array_elements({lit(json.dumps(rules, ensure_ascii=False))}::jsonb) e ON CONFLICT DO NOTHING;")
            report.append((key, year, ws.title, len(raw), len(codes), len(rules), "pacote" if h in pkg else "SÓ AVULSO", f))
    out.append("COMMIT;")
    print("\n".join(out))
    for r in report: print("--", *r, file=sys.stderr)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
