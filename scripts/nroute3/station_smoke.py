# NROUTE.3 — smoke headless por estação: status, h1 único, título, breadcrumb, sem textos crus, 404 coerente.
import asyncio, json, os
from playwright.async_api import async_playwright
BASE="http://localhost:8080"; OUT="/mnt/documents/nroute3-screenshots"; os.makedirs(OUT, exist_ok=True)
BAD=["undefined","[object Object]","NaN","Not Found"]
async def main():
    plan=json.load(open("/tmp/browser/nroute3/plan.json")); res=[]
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True)
        for st in plan:
            m=json.load(open(st["file"]))
            for vp,name in (({"width":1280,"height":1800},"desk"),({"width":390,"height":844},"mob")):
                ctx=await b.new_context(viewport=vp); pg=await ctx.new_page(); errs=[]
                pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
                await pg.goto(BASE); await pg.evaluate("([k,v])=>localStorage.setItem(k,v)",[m["storage_key"],json.dumps(m["session"])])
                for path in st["paths"]:
                    if name=="mob" and path!=st["paths"][0]: continue
                    try:
                        r=await pg.goto(BASE+path, wait_until="load", timeout=30000)
                    except Exception as e:
                        res.append({"station":st["kind"],"vp":name,"path":path,"error":"timeout"}); continue
                    await pg.wait_for_timeout(2500)
                    body=await pg.inner_text("body")
                    h1=await pg.locator("h1").all_inner_texts()
                    crumb=await pg.locator("nav[aria-label*='readcrumb' i], nav[aria-label*='trilha' i]").count()
                    sw=await pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1")
                    res.append({"station":st["kind"],"vp":name,"path":path,"status":r.status if r else None,"title":await pg.title(),
                      "h1":h1,"breadcrumb":crumb>0,"notFound":"Página não encontrada" in body,"bad":[w for w in BAD if w in body],
                      "hscroll":sw,"errors":list(errs)})
                    errs.clear()
                    await pg.screenshot(path=f"{OUT}/{st['kind']}_{name}{path.replace('/','_') or '_home'}.png")
                await ctx.close()
        await b.close()
    os.makedirs("docs/nroute3",exist_ok=True); json.dump(res,open("docs/nroute3/smoke-estacoes.json","w"),ensure_ascii=False,indent=1)
asyncio.run(main())
