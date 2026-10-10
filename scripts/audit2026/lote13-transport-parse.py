exec(open("/tmp/l13_gen.py").read().split("rows={}")[0])
tu=[]; c_s=c_n=0
for c,f,v,l in out:
    if f!="transporte-escolar": continue
    assert v in ("Sim","Não"), v
    inep,row=l.split("!")[-1].split(":r"); c_s+= v=="Sim"; c_n+= v=="Não"
    tu.append(f"({c},{1 if v=='Sim' else 0},{inep},{row})")
print(len(tu),"sim",c_s,"nao",c_n)
k=len(tu)//3+1
for i in range(3): open(f"/tmp/l13_t{i}.txt","w").write(",".join(tu[i*k:(i+1)*k]))
