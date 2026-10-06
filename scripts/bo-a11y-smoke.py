"""Frente BO — smoke autenticado objetivo (landmarks, h1, nomes acessíveis, overflow, touch, foco por teclado).
Lê sessões sintéticas de /tmp/bo/sessions.json (apagado pelo harness). Nunca imprime tokens."""
import asyncio, json, sys
from playwright.async_api import async_playwright

ROUTES = {"administrador-geral-do-sigem": ["/administracao-geral", "/central-de-acessos", "/auditoria", "/relatorios"],
          "professor": ["/diario", "/diario/turmas", "/avaliacoes-do-professor"],
          "secretaria-escolar": ["/alunos", "/enturmacoes", "/documentos-escolares"],
          "ciece-estatistica": ["/ciece"]}
VIEWS = {"desktop": (1280, 900), "tablet": (820, 1180), "mobile": (390, 844)}
CHECK = """() => {
 const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
 const named = e => (e.getAttribute('aria-label')||e.getAttribute('aria-labelledby')||e.textContent.trim()||e.getAttribute('title')||'').length>0;
 const btn = [...document.querySelectorAll('button,a[href],[role=button]')].filter(vis);
 const inputs = [...document.querySelectorAll('input:not([type=hidden]),select,textarea')].filter(vis)
   .filter(i => !(i.labels&&i.labels.length) && !i.getAttribute('aria-label') && !i.getAttribute('aria-labelledby'));
 return { main: document.querySelectorAll('main').length, h1: document.querySelectorAll('h1').length,
   unnamed: btn.filter(b=>!named(b)).length, unlabeled: inputs.length,
   overflow: document.documentElement.scrollWidth - window.innerWidth,
   small: btn.filter(b=>{const r=b.getBoundingClientRect(); return r.height<24||r.width<24;}).length,
   text: document.body.innerText.slice(0,4000) } }"""

async def main():
    cfg = json.load(open("/tmp/bo/sessions.json")); fails = 0
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        for prof in cfg["profiles"]:
            for vname, (w, h) in VIEWS.items():
                ctx = await b.new_context(viewport={"width": w, "height": h}); page = await ctx.new_page()
                errs = []; page.on("pageerror", lambda e: errs.append(str(e)[:120]))
                await page.goto("http://localhost:8080/")
                await page.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(prof["session"])])
                for r in ROUTES[prof["kind"]]:
                    await page.goto("http://localhost:8080" + r, wait_until="networkidle", timeout=60000)
                    await page.wait_for_timeout(800)
                    m = await page.evaluate(CHECK)
                    signed = "/auth" not in page.url and "Entrar" not in m["text"][:300]
                    await page.keyboard.press("Tab")
                    focus = await page.evaluate("() => { const e=document.activeElement; if(!e||e===document.body) return false; const s=getComputedStyle(e); return s.outlineStyle!=='none' || s.boxShadow!=='none'; }")
                    leak = any(x in m["text"] for x in ("Traceback", "SQLSTATE", "at Object.", "PGRST"))
                    bad = (not signed) or m["main"] != 1 or m["h1"] < 1 or m["unnamed"] or m["unlabeled"] or m["overflow"] > 2 or leak or errs or (vname == "mobile" and m["small"] > 0)
                    fails += bool(bad)
                    print(f"{'PASS' if not bad else 'FAIL'} a11y {prof['kind']} {vname} {r} signed={signed} main={m['main']} h1={m['h1']} unnamed={m['unnamed']} unlabeled={m['unlabeled']} overflow={m['overflow']} small={m['small']} focus={focus} leak={leak} errs={len(errs)}")
                await ctx.close()
        await b.close()
    print(f"A11Y_SMOKE fails={fails}")
    sys.exit(0)  # o harness registra execução; falhas objetivas são lidas linha a linha

asyncio.run(main())
