#!/usr/bin/env python3
"""Importação idempotente do IBGE DTB (Divisão Territorial Brasileira) para o catálogo territorial.

Uso: python3 scripts/ibge-dtb-import.py <pasta-com-os-ODS> <ano> <data-base AAAA-MM-DD> > /tmp/dtb.sql ; psql -v ON_ERROR_STOP=1 -f /tmp/dtb.sql
- Lê só os 4 ODS oficiais (o XLS do mesmo par é duplicata e não é carregado); grava SHA-256 por arquivo.
- Códigos sempre texto, validados por comprimento (UF 2, município 7, distrito 9, subdistrito 11) e prefixo hierárquico.
- Linha inválida é rejeitada e contada (relatório em stderr); nunca corrigida por palpite.
- Idempotente: ON CONFLICT DO NOTHING em todas as tabelas; fonte única por (ano, tipo, hash).
- Executor técnico: sandbox_exec; `loaded_by` registra o script, nunca pessoa.
"""
import hashlib, json, re, sys
import pandas as pd

folder, year, refdate = sys.argv[1], int(sys.argv[2]), sys.argv[3]
FILES = {"municipios": f"RELATORIO_DTB_BRASIL_{year}_MUNICIPIOS.ods", "distritos": f"RELATORIO_DTB_BRASIL_{year}_DISTRITOS.ods",
         "subdistritos": f"RELATORIO_DTB_BRASIL_{year}_SUBDISTRITOS.ods", "distritos_novos_extintos": "Distritos_novos_e_extintos.ods"}
LOADER = "scripts/ibge-dtb-import.py"

def q(v): return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"
def s(v):
    if v is None or (isinstance(v, float) and v != v): return None
    t = str(v).strip(); return t or None
def code(v, n):
    t = s(v); return t if t and re.fullmatch(rf"\d{{{n}}}", t) else None

out, report = ["BEGIN;"], {}
def source(kind, rows, rejected):
    path = f"{folder}/{FILES[kind]}"; h = hashlib.sha256(open(path, "rb").read()).hexdigest()
    out.append(f"INSERT INTO public.territorial_dtb_sources (dtb_year, reference_date, kind, file_name, sha256, row_count, rejected_count, loaded_by) "
               f"VALUES ({year}, {q(refdate)}, {q(kind)}, {q(FILES[kind])}, {q(h)}, {rows}, {rejected}, {q(LOADER)}) ON CONFLICT DO NOTHING;")
    report[kind] = {"file": FILES[kind], "sha256": h, "rows": rows, "rejected": rejected}
    return f"(SELECT id FROM public.territorial_dtb_sources WHERE dtb_year={year} AND kind={q(kind)} AND sha256={q(h)})"

def table(kind):
    d = pd.read_excel(f"{folder}/{FILES[kind]}", header=None, dtype=str, engine="odf")
    hdr = next(i for i in range(20) if s(d.iloc[i, 0]) == "UF")
    return d.iloc[hdr + 1:].reset_index(drop=True)

def batch(prefix, values):
    for i in range(0, len(values), 500):
        out.append(prefix + ",\n".join(values[i:i + 500]) + " ON CONFLICT DO NOTHING;")

# Municípios + UFs
m = table("municipios"); ufs, muns, rej = {}, [], 0
for r in m.itertuples(index=False):
    uf, mc, name = code(r[0], 2), code(r[7], 7), s(r[8])
    if not (uf and mc and name and mc.startswith(uf)): rej += 1; continue
    ufs[uf] = s(r[1]); muns.append((mc, uf, name, s(r[2]), s(r[3]), s(r[4]), s(r[5])))
src = source("municipios", len(muns), rej)
batch(f"INSERT INTO public.territorial_ufs (dtb_year, code, name, source_id) VALUES ", [f"({year},{q(k)},{q(v)},{src})" for k, v in sorted(ufs.items())])
batch("INSERT INTO public.territorial_municipalities (dtb_year, code, uf_code, name, intermediate_region_code, intermediate_region_name, immediate_region_code, immediate_region_name, source_id) VALUES ",
      [f"({year},{','.join(q(x) for x in t)},{src})" for t in muns])
munset = {t[0] for t in muns}

# Distritos
d = table("distritos"); dists, rej = [], 0
for r in d.itertuples(index=False):
    mc, dc, name = code(r[7], 7), code(r[10], 9), s(r[11])
    if not (mc and dc and name and dc.startswith(mc) and mc in munset): rej += 1; continue
    dists.append((dc, mc, name))
src = source("distritos", len(dists), rej)
batch("INSERT INTO public.territorial_districts (dtb_year, code, municipality_code, name, source_id) VALUES ", [f"({year},{q(a)},{q(b)},{q(c)},{src})" for a, b, c in dists])
distset = {t[0] for t in dists}

# Subdistritos
sd = table("subdistritos"); subs, rej = [], 0
for r in sd.itertuples(index=False):
    dc, sc, name = code(r[10], 9), code(r[13], 11), s(r[14])
    if not (dc and sc and name and sc.startswith(dc) and dc in distset): rej += 1; continue
    subs.append((sc, dc, name))
src = source("subdistritos", len(subs), rej)
batch("INSERT INTO public.territorial_subdistricts (dtb_year, code, district_code, name, source_id) VALUES ", [f"({year},{q(a)},{q(b)},{q(c)},{src})" for a, b, c in subs])

# Novos e extintos (geocódigo de 7 = município do distrito novo; 9 = distrito extinto)
c = pd.read_excel(f"{folder}/{FILES['distritos_novos_extintos']}", header=None, dtype=str, engine="odf")
changes, mode, rej = [], None, 0
for r in c.itertuples(index=False):
    a = s(r[0])
    if a and a.startswith("Novos"): mode = "novo"; continue
    if a and a.startswith("Distritos Extintos"): mode = "extinto"; continue
    if not mode or a in (None, "UF"): continue
    g, mun, dn = s(r[1]), s(r[2]), s(r[3])
    if mode == "novo" and code(g, 7) and mun and dn: changes.append(("novo", a, g, mun, None, dn))
    elif mode == "extinto" and code(g, 9) and mun and dn: changes.append(("extinto", a, g[:7], mun, g, dn))
    else: rej += 1
src = source("distritos_novos_extintos", len(changes), rej)
batch("INSERT INTO public.territorial_district_changes (dtb_year, change, uf_name, municipality_code, municipality_name, district_code, district_name, source_id) VALUES ",
      [f"({year},{','.join(q(x) for x in t)},{src})" for t in changes])

out.append("COMMIT;")
print("\n".join(out))
report["ufs"] = len(ufs)
print(json.dumps(report, ensure_ascii=False, indent=1), file=sys.stderr)
