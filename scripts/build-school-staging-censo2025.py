"""Staging de unidades municipais de Itaperuna a partir dos Microdados do Censo Escolar 2025 (INEP).
Uso: python3 scripts/build-school-staging-censo2025.py <Tabela_Escola_2025_V2.csv> <sha256-do-zip>
Não grava no banco. Saída: docs/data/staging/escolas-municipais-itaperuna-censo2025.{json,csv}."""
import csv, json, sys, unicodedata, re, hashlib, collections
CSV, ZIP_SHA = sys.argv[1], sys.argv[2]
MUN = "3302205"
SIT = {"1": "em-atividade", "2": "paralisada", "3": "extinta-no-ano", "4": "extinta-anos-anteriores"}
LOC = {"1": "urbana", "2": "rural"}
def norm(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode().upper()
    s = re.sub(r"[^A-Z0-9 ]", " ", s)
    for a, b in [(r"\bESCOLA MUNICIPAL\b", ""), (r"\bE M\b", ""), (r"\bE MZ\b", ""), (r"\bEM\b", ""), (r"\bCRECHE ESCOLA MUNICIPAL\b", ""),
                 (r"\bJ I M\b", ""), (r"\bJARDIM DE INFANCIA MUNICIPAL\b", ""), (r"\bPROF[A]?\b", ""), (r"\bPROFESSORA?\b", ""),
                 (r"\bSRA\b", "SENHORA"), (r"\bCEL\b", "CORONEL"), (r"\bVER\b", "VEREADOR"), (r"\bDR\b", "DOUTOR"), (r"\bFAZ\b", "FAZENDA"),
                 (r"\bBRIZOLAO\b", ""), (r"\bD\b", "D"), (r"\bDE\b|\bDA\b|\bDO\b|\bDAS\b|\bDOS\b", "")]:
        s = re.sub(a, b, s)
    return re.sub(r"\s+", " ", s).strip()
src = open(CSV, "rb").read()
r = csv.reader(src.decode("latin-1").splitlines(), delimiter=";"); h = next(r)
census = [dict(zip(h, x)) for x in r if x[h.index("CO_MUNICIPIO")] == MUN and x[h.index("TP_DEPENDENCIA")] == "3"]
hist = json.load(open("docs/data/escolas-itaperuna-censo2026.json"))
hist_mun = [e for e in hist["escolas"] if e["dependenciaNaFonte"] == "Municipal"]
by_inep = {e["inep"]: e for e in hist_mun}
by_name = collections.defaultdict(list)
for e in hist_mun: by_name[norm(e["nome"])].append(e)
ANEXO = {"33002169": "NEI Boa Ventura (Núcleo de Educação Inclusiva) é ANEXO desta unidade (Prefeitura de Itaperuna, 25/03/2025); não é escola independente — registrar só como vínculo institucional após revisão."}
rows, inactive = [], []
for c in sorted(census, key=lambda x: x["CO_ENTIDADE"]):
    inep = c["CO_ENTIDADE"]
    if c["TP_SITUACAO_FUNCIONAMENTO"] != "1":
        inactive.append({"inep": inep, "nome_censo_2025": c["NO_ENTIDADE"], "status_censo_2025": SIT.get(c["TP_SITUACAO_FUNCIONAMENTO"]),
                         "na_lista_historica": inep in by_inep}); continue
    issues, match = [], by_inep.get(inep)
    how = "inep" if match else None
    if not match:
        cand = by_name.get(norm(c["NO_ENTIDADE"]), [])
        if len(cand) == 1: match, how = cand[0], "nome-normalizado"; issues.append(f"INEP diverge da lista histórica ({cand[0]['inep']})")
        else: issues.append("ausente na lista histórica")
    loc = LOC.get(c["TP_LOCALIZACAO"])
    if match:
        hl = {"Urbanas": "urbana", "Rurais": "rural"}.get(match["aba"])
        if hl and hl != loc: issues.append(f"localização: Censo {loc} × lista {hl}")
        if norm(match["nome"]) != norm(c["NO_ENTIDADE"]): issues.append(f"nome: lista histórica '{match['nome']}'")
    if c["TP_LOCALIZACAO_DIFERENCIADA"] not in ("", "0"): issues.append(f"localização diferenciada código {c['TP_LOCALIZACAO_DIFERENCIADA']}")
    if inep in ANEXO: issues.append(ANEXO[inep])
    rows.append({
        "school_id_proposto": f"inep-{inep}", "inep": inep, "nome_oficial_censo_2025": c["NO_ENTIDADE"].strip(),
        "localizacao": loc, "distrito_censo": c["NO_DISTRITO"].strip() or None,
        "endereco": None, "numero_complemento": None, "bairro": None, "cep": None, "telefone": None, "email": None,
        "codigo_rede": None, "own_building": None, "hard_access": None, "classroom_count": None,
        "status_censo_2025": "em-atividade", "fonte": "INEP Microdados Censo Escolar 2025 v2 (Tabela_Escola_2025_V2.csv)", "ano_fonte": 2025,
        "lista_historica": {"inep": match["inep"], "nome": match["nome"], "aba": match["aba"], "linha": match["linha"], "match": how} if match else None,
        "divergencias": issues,
        "confidence": "alta" if how == "inep" and len(issues) == (1 if inep in ANEXO else 0) else ("media" if match else "baixa"),
        "needs_review": bool(issues),
    })
active_ineps = {x["inep"] for x in rows} | {x["inep"] for x in inactive}
matched_hist = {x["lista_historica"]["inep"] for x in rows if x["lista_historica"]}
missing = [{"inep": e["inep"], "nome": e["nome"], "aba": e["aba"], "linha": e["linha"],
            "situacao_censo_2025": next((i["status_censo_2025"] for i in inactive if i["inep"] == e["inep"]), "nao-encontrada-como-municipal-ativa")}
           for e in hist_mun if e["inep"] not in matched_hist]
dup_inep = [k for k, v in collections.Counter(x["inep"] for x in rows).items() if v > 1]
dup_name = [k for k, v in collections.Counter(norm(x["nome_oficial_censo_2025"]) for x in rows).items() if v > 1]
summary = {
    "municipais_ativas_2025": len(rows),
    "urbanas": sum(x["localizacao"] == "urbana" for x in rows), "rurais": sum(x["localizacao"] == "rural" for x in rows),
    "presentes_na_lista_historica": sum(1 for x in rows if x["lista_historica"]),
    "por_inep": sum(1 for x in rows if x["lista_historica"] and x["lista_historica"]["match"] == "inep"),
    "novas_no_censo_2025": sum(1 for x in rows if not x["lista_historica"]),
    "ausentes_do_censo_ativo": len(missing), "com_divergencia": sum(1 for x in rows if x["divergencias"]),
    "municipais_nao_ativas_2025": len(inactive), "inep_duplicado": dup_inep, "nome_normalizado_duplicado": dup_name,
}
out = {
    "artefato": "staging-escolas-municipais-itaperuna-censo2025", "versao": 1, "gravado_no_banco": False,
    "fonte_primaria": {"nome": "Microdados do Censo Escolar da Educação Básica 2025 (v2, jul/2026)", "orgao": "INEP/MEC",
        "url": "https://download.inep.gov.br/dados_abertos/microdados_censo_escolar_2025_.zip", "zip_sha256": ZIP_SHA,
        "csv_sha256": hashlib.sha256(src).hexdigest(), "filtro": "CO_MUNICIPIO=3302205, TP_DEPENDENCIA=3 (municipal), TP_SITUACAO_FUNCIONAMENTO=1"},
    "fonte_reconciliacao": {"nome": hist["fonte"], "sha256": hist["sha256"], "uso": "lista municipal histórica (abas Urbanas/Rurais); não comprova atividade"},
    "limitacoes": [
        "Os microdados públicos de 2025 NÃO trazem endereço, número, bairro, CEP, telefone nem e-mail (removidos por LGPD); esses campos ficam NULL até fonte real.",
        "PMAS seção 3.9.1 não foi localizado publicamente neste ambiente; a reconciliação usa a planilha municipal já fornecida (Matriz_Escolas_Itaperuna_Censo2026.xlsx).",
        "codigo_rede, own_building, hard_access e classroom_count ficam NULL: não há fonte atual; QT_SALAS_UTILIZADAS do Censo não é 'salas de aula' e não foi usado.",
        "school_id_proposto é sugestão; o writer aceita _school informado, mas a decisão do padrão é humana.",
    ],
    "resumo": summary, "unidades": rows, "municipais_nao_ativas_2025": inactive, "lista_historica_sem_correspondencia_ativa": missing,
}
import os; os.makedirs("docs/data/staging", exist_ok=True)
json.dump(out, open("docs/data/staging/escolas-municipais-itaperuna-censo2025.json", "w"), ensure_ascii=False, indent=1)
with open("docs/data/staging/escolas-municipais-itaperuna-censo2025.csv", "w", newline="") as f:
    cols = [k for k in rows[0] if k != "lista_historica"] + ["lista_inep", "lista_nome", "lista_aba"]
    w = csv.DictWriter(f, fieldnames=cols); w.writeheader()
    for x in rows:
        y = {k: v for k, v in x.items() if k != "lista_historica"}; y["divergencias"] = " | ".join(x["divergencias"])
        lh = x["lista_historica"] or {}; y.update(lista_inep=lh.get("inep"), lista_nome=lh.get("nome"), lista_aba=lh.get("aba")); w.writerow(y)
print(json.dumps(summary, ensure_ascii=False, indent=1))
for m in missing: print("AUSENTE", m)
for x in rows:
    if x["divergencias"]: print("DIV", x["inep"], x["nome_oficial_censo_2025"], x["divergencias"])
