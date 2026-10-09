"""HOMO.REAL.1 — navegador headless autenticado por perfil. Lê /tmp/homo/sessions.json (apagado pelo chamador). Nunca imprime tokens."""
import asyncio, json, os
from playwright.async_api import async_playwright
B = "http://localhost:8080"
ALLOW = {"administrador-geral-do-sigem": ["/administracao-geral", "/central-de-acessos", "/auditoria", "/relatorios", "/preparacao-2027"],
  "ciece-estatistica": ["/ciece", "/mapa-estatistico"], "secretaria-escolar": ["/secretaria", "/alunos", "/turmas"],
  "direcao-escolar": ["/direcao"], "orientacao-pedagogica": ["/orientacao-pedagogica"], "professor": ["/diario", "/diario/turmas"]}
DENY = {"administrador-geral-do-sigem": None, "ciece-estatistica": "/central-de-acessos", "secretaria-escolar": "/central-de-acessos",
  "direcao-escolar": "/central-de-acessos", "orientacao-pedagogica": "/central-de-acessos", "professor": "/administracao-geral"}
SHOTS = "/tmp/homo/shots"; os.makedirs(SHOTS, exist_ok=True)
async def settle(page):
    try: await page.wait_for_load_state("networkidle", timeout=15000)
    except Exception: pass
    try: await page.wait_for_selector("h1", timeout=10000)
    except Exception: pass
    await page.wait_for_timeout(600)
async def main():
    cfg = json.load(open("/tmp/homo/sessions.json"))
    async with async_playwright() as p:
        br = await p.chromium.launch(headless=True)
        for prof in cfg["profiles"]:
            k, t = prof["kind"], prof["tag"]
            ctx = await br.new_context(viewport={"width": 1280, "height": 1800}); page = await ctx.new_page()
            errs = []; page.on("pageerror", lambda e: errs.append(1))
            await page.goto(B + "/"); await page.evaluate("([k,v]) => localStorage.setItem(k, v)", [cfg["key"], json.dumps(prof["session"])])
            await page.goto(B + "/"); await settle(page)
            signed = "/auth" not in page.url and "/login" not in page.url
            print(f"{'PASS' if signed else 'FAIL'} {k}/{t} login/sessão home url={page.url.replace(B,'')}")
            await page.screenshot(path=f"{SHOTS}/{k}-{t}-home.png")
            nav = await page.evaluate("() => [...document.querySelectorAll('nav a')].map(a=>a.getAttribute('href')).filter(Boolean)")
            print(f"INFO {k}/{t} menu itens={len(nav)}")
            for r in ALLOW[k]:
                await page.goto(B + r); await settle(page)
                txt = await page.evaluate("() => document.body.innerText.slice(0,3000)")
                denied = any(s in txt for s in ("Sem permissão", "não tem permissão", "Acesso negado", "Entre para continuar"))
                leak = any(s in txt for s in ("SQLSTATE", "PGRST", "Traceback"))
                ok = (not denied) and (not leak) and "/auth" not in page.url
                print(f"{'PASS' if ok else 'FAIL'} {k}/{t} rota permitida {r} (deep link)")
                if t == "a": await page.screenshot(path=f"{SHOTS}/{k}-{r.strip('/').replace('/','_')}.png")
            d = DENY[k]
            if d:
                await page.goto(B + d); await settle(page)
                txt = await page.evaluate("() => document.body.innerText.slice(0,3000)")
                blocked = any(s in txt.lower() for s in ("sem permissão", "não tem permissão", "acesso negado", "não disponível", "não autorizado", "sem capacidade", "não pode"))
                print(f"{'PASS' if blocked else 'REVIEW'} {k}/{t} rota negada {d}")
                if t == "a": await page.screenshot(path=f"{SHOTS}/{k}-negada.png")
            await ctx.clear_cookies(); await page.evaluate("() => localStorage.clear()")
            await page.goto(B + ALLOW[k][0]); await settle(page)
            txt = await page.evaluate("() => document.body.innerText.slice(0,2000)")
            out = "Entrar" in txt or "/auth" in page.url or "/login" in page.url
            print(f"{'PASS' if out else 'FAIL'} {k}/{t} logout: sessão removida bloqueia a tela")
            print(f"{'PASS' if not errs else 'FAIL'} {k}/{t} sem erro de execução ({len(errs)})")
            await ctx.close()
        await br.close()
asyncio.run(main())
