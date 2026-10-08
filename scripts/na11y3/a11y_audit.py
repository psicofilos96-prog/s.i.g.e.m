# NA11Y.3 — axe-core (WCAG 2.1 A/AA) + zoom 200% + teclado/foco, por estação. Nunca imprime tokens.
import asyncio, json, os
from playwright.async_api import async_playwright
BASE="http://localhost:8080"; OUT="/mnt/documents/na11y3-screenshots"; os.makedirs(OUT, exist_ok=True)
AXE=open("node_modules/axe-core/axe.min.js").read()
FOCUS="""async()=>{const r=[];for(let i=0;i<12;i++){await new Promise(z=>setTimeout(z,30));
 document.activeElement&&0; r.push(1);} return r.length}"""
async def run(pg):
    await pg.add_script_tag(content=AXE)
    return await pg.evaluate("""async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});
      return r.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,n:v.nodes.length,targets:v.nodes.slice(0,4).map(x=>x.target.join(' '))}))}""")
async def main():
    plan=json.load(open("/tmp/browser/na11y3/plan.json")); res=[]
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True)
        for st in plan:
            m=json.load(open(st["file"]))
            for mode,vp in (("desk",{"width":1280,"height":900}),("zoom200",{"width":640,"height":450})):
                ctx=await b.new_context(viewport=vp); pg=await ctx.new_page()
                await pg.goto(BASE); await pg.evaluate("([k,v])=>localStorage.setItem(k,v)",[m["storage_key"],json.dumps(m["session"])])
                for path in st["paths"]:
                    try: await pg.goto(BASE+path, wait_until="load", timeout=30000)
                    except Exception: res.append({"station":st["kind"],"mode":mode,"path":path,"error":"timeout"}); continue
                    try: await pg.wait_for_selector("[data-sigem-shell-skeleton]", state="detached", timeout=15000)
                    except Exception: pass
                    await pg.wait_for_timeout(1500)
                    row={"station":st["kind"],"mode":mode,"path":path}
                    row["overflow"]=await pg.evaluate("document.documentElement.scrollWidth-window.innerWidth")
                    if mode=="desk":
                        row["axe"]=await run(pg)
                        row["landmarks"]=await pg.evaluate("({main:document.querySelectorAll('main').length,h1:document.querySelectorAll('h1').length,skip:!!document.querySelector('a[href=\"#conteudo\"],a[href^=\"#main\"],a[href=\"#sigem-main\"]')})")
                        nofocus=[]
                        await pg.mouse.click(5,5)
                        for i in range(15):
                            await pg.keyboard.press("Tab")
                            f=await pg.evaluate("""()=>{const e=document.activeElement;if(!e||e===document.body)return null;const s=getComputedStyle(e);
                              const vis=s.outlineStyle!=='none'&&parseFloat(s.outlineWidth)>0||s.boxShadow!=='none';return {tag:e.tagName,txt:(e.innerText||e.getAttribute('aria-label')||'').slice(0,40),vis}}""")
                            if f and not f["vis"]: nofocus.append(f)
                        row["focusInvisible"]=nofocus[:5]
                    await pg.screenshot(path=f"{OUT}/{st['kind']}_{mode}{path.replace('/','_')}.png")
                    res.append(row)
                await ctx.close()
        await b.close()
    os.makedirs("docs/na11y3",exist_ok=True); json.dump(res,open("docs/na11y3/achados.json","w"),ensure_ascii=False,indent=1)
asyncio.run(main())
