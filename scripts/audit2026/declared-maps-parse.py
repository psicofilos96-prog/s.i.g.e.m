import openpyxl, hashlib, json, os, re, sys, unicodedata, glob
U="/mnt/user-uploads/"
def n(s): return re.sub(r"[^A-Z0-9 ]"," ",unicodedata.normalize("NFD",str(s or "")).encode("ascii","ignore").decode().upper())
MONTHS={"JANEIRO":1,"FEVEREIRO":2,"MARCO":3,"ABRIL":4,"MAIO":5,"JUNHO":6,"JULHO":7,"AGOSTO":8,"SETEMBRO":9,"OUTUBRO":10,"NOVEMBRO":11,"DEZEMBRO":12}
# lista oficial de INEP
ref=[]
ws=openpyxl.load_workbook(U+"INEP_-_ESCOLAS_atualizado.xlsx",data_only=True).worksheets[0]
cat=None
for row in ws.iter_rows(values_only=True):
    for i,v in enumerate(row):
        if isinstance(v,str) and v.strip().upper() in("ESCOLAS URBANAS","ESCOLAS RURAIS","ESCOLAS CONVENIADAS"): pass
    vals=list(row)
    # pairs (name, inep) by position
    for i in range(len(vals)-1):
        if isinstance(vals[i],str) and isinstance(vals[i+1],(int,float)) and 33000000<vals[i+1]<34000000:
            ref.append((vals[i],str(int(vals[i+1])),i))
# categoria por coluna/posição
out=[]
STOP=set("E M C CEM EM ESCOLA MUNICIPAL CRECHE DE DA DO DOS DAS J I PROF PROFA MA BRIZOLAO CIEP MAPA ESTATISTICO NOVO XLSX II".split())
def toks(s): return {t for t in n(s).split() if t not in STOP and len(t)>1}
def num(v):
    if isinstance(v,(int,float)): return int(round(v))
    return None
def parse_sheet(ws):
    cells={}
    for row in ws.iter_rows():
        for c in row:
            if c.value not in (None,""): cells[(c.row,c.column)]=c.value
    rows={}
    for (r,c),v in cells.items(): rows.setdefault(r,{})[c]=v
    R=sorted(rows)
    lab=lambda r: n(rows[r].get(1,""))
    month=None; inep=None
    for r in R:
        for c,v in rows[r].items():
            if isinstance(v,str) and "MAPA ESTATISTICO" in n(v):
                for k,m in MONTHS.items():
                    if k in n(v): month=m
            if isinstance(v,str) and "CODIGO INEP" in n(v):
                for c2 in sorted(rows[r]):
                    if c2>c and num(rows[r][c2]) and num(rows[r][c2])>1000000: inep=str(num(rows[r][c2])); break
                    if c2>c and isinstance(rows[r][c2],str) and re.fullmatch(r"\d{8}",rows[r][c2].strip()): inep=rows[r][c2].strip(); break
    iii=next((r for r in R if lab(r).startswith("III ")),None); iv=next((r for r in R if lab(r).startswith("IV ")),None) or 10**6
    def last(r): 
        ns=[num(v) for c,v in sorted(rows[r].items()) if c>1 and num(v) is not None]; return ns[-1] if ns else None
    def find(p,lo=0,hi=10**6): return next((r for r in R if lo<=r<hi and lab(r).strip().startswith(p)),None)
    lim=iii or 10**6
    g=lambda p: (last(find(p,0,lim)) if find(p,0,lim) else None)
    d=dict(previous_month_enrollment=g("MATRICULA DO MES ANTERIOR"),transfers_in=g("TRANSFERENCIAS RECEBIDAS"),new_students=g("ALUNOS NOVOS"),
           transfers_out=g("TRANSFERENCIAS EXPEDIDAS"),dropouts=g("EVADIDOS"),withdrawn_cancelled=g("DESISTENTES"),total_ii=g("TOTAL"),declared_classes=g("N  DE TURMAS") if find("N  DE TURMAS",0,lim) else g("N DE TURMAS"))
    shifts={}
    sr=find("TOTAL DE ALUNOS NA ESCOLA",0,lim)
    if sr:
        hdr=max((r for r in R if r<sr and any("1 TURNO" in n(v) for v in rows[r].values())),default=None)
        if hdr:
            for c,v in rows[hdr].items():
                k={"1 TURNO":"turno1","2 TURNO":"turno2","3 TURNO":"turno3","PARCIAL":"parcial","INTEGRAL":"integral","TOTAL DE ALUNOS":"total"}.get(n(v).strip())
                if k: shifts[k]=num(rows[sr].get(c))
    classes=[];projects=[];total_iii=None
    if iii:
        mod=None;et=None;cols=None;tcol=None;inproj=False
        for r in [x for x in R if iii<x<iv]:
            row=rows[r]; a=n(row.get(1,"")).strip()
            if any(n(v).strip()=="1 TURNO" for v in row.values()):
                cols={n(v).strip():c for c,v in row.items() if n(v).strip() in("1 TURNO","2 TURNO","3 TURNO","INTEGRAL")}; continue
            if a=="MODALIDADE":
                tcol=next((c for c,v in row.items() if "NOME DA TURMA" in n(v)),None); continue
            if a.startswith("TOTAL DE ALUNOS NA ESCOLA") and cols:
                total_iii=sum(num(row.get(c)) or 0 for c in cols.values()); continue
            if a: mod=row.get(1).strip() if isinstance(row.get(1),str) else mod; inproj=a.startswith("PROJETOS")
            c3=row.get(3)
            if isinstance(c3,str) and ("SUBTOTAL" in n(c3) or "TOTAL DE ALUNOS" in n(c3)): continue
            if isinstance(c3,str) and c3.strip(): et=" ".join(c3.split())
            if not cols: continue
            per={k:num(row.get(c)) for k,c in cols.items() if num(row.get(c))}
            nm=row.get(tcol) if tcol else None
            nm=" ".join(str(nm).split()) if nm not in (None,"") and not num(nm) else None
            alunos=sum(per.values())
            if alunos==0 and not nm: continue
            item={"modalidade":(" ".join(mod.split()) if mod else None),"etapa":et,"turma":nm or et,"alunos":alunos}
            item.update({ {"1 TURNO":"turno1","2 TURNO":"turno2","3 TURNO":"turno3","INTEGRAL":"integral"}[k]:float(v) for k,v in per.items()})
            (projects if inproj else classes).append(item)
    empty=not classes and not any(d[k] for k in d)
    return month,inep,d,shifts,classes,projects,total_iii,empty
files=[f for f in sorted(os.listdir(U)) if f.endswith(".xlsx") and "MAPA" in f]
target=json.load(open("/tmp/l3/targets.json"))
recs=[];log=[]
for f in target:
    best=max(ref,key=lambda x: len(toks(x[0])&toks(f))/max(1,len(toks(x[0]))))
    score=len(toks(best[0])&toks(f))/max(1,len(toks(best[0])))
    raw=open(U+f,"rb").read(); sha=hashlib.sha256(raw).hexdigest()
    wb=openpyxl.load_workbook(U+f,data_only=True)
    for ws in wb.worksheets:
        m,inep,d,sh,cl,pr,t3,empty=parse_sheet(ws)
        mt=next((v for k,v in MONTHS.items() if k in n(ws.title)),None)
        hdr_m=m; m=mt or m
        if empty or not m: log.append((f,ws.title,"aba sem dados" if empty else "mês não identificado")); continue
        recs.append(dict(file=f,sheet=ws.title,sha=sha,ref_name=best[0],ref_inep=best[1],score=round(score,2),inep=inep,month=m,header_month=hdr_m,total_iii=t3,shifts=sh,classes=cl,projects=pr,**d))
json.dump(dict(recs=recs,log=log,ref=ref),open("/tmp/l3/parsed.json","w"),ensure_ascii=False)
print(len(recs),"abas com dados;",len(log),"abas vazias")
for f in target:
    rs=[r for r in recs if r["file"]==f]
    print(f[:60].ljust(60), rs[0]["ref_inep"] if rs else "-", rs[0]["score"] if rs else "", sorted({str(r["inep"]) for r in rs}), [r["month"] for r in rs])
