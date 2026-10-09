# NSECTOR.4 — deep links e menu por estação: rota fora da estação deve mostrar o bloqueio; dentro, nunca.
# Coleta os links do menu na página inicial (conferidos depois por expectations.ts --menu).
# Uso: python3 -u scripts/nsector4/browser.py  (após node scripts/nsector4-isolation.mjs). Apaga as sessões ao final.
import asyncio, json, os, shutil
from urllib.parse import urlparse
from playwright.async_api import async_playwright
BASE = "http://localhost:8080"
async def main():
    plan = json.load(open("/tmp/browser/nsector4/plan.json")); res = []; fails = [0]
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True); sem = asyncio.Semaphore(5)
        async def run(st):
            async with sem:
                m = json.load(open(st["file"]))
                ctx = await b.new_context(viewport={"width": 1280, "height": 1800}); pg = await ctx.new_page()
                await pg.goto(BASE); await pg.evaluate("([k,v])=>localStorage.setItem(k,v)", [m["storage_key"], json.dumps(m["session"])])
                menu = set()
                for path, allowed in st["expect"].items():
                    try: await pg.goto(BASE + path, wait_until="domcontentloaded", timeout=30000)
                    except Exception: res.append({"k": st["k"], "path": path, "error": "timeout"}); fails[0] += 1; continue
                    try: await pg.wait_for_function("!document.querySelector('[data-sigem-shell-skeleton]') && !!document.querySelector('h1')", timeout=15000)
                    except Exception: pass
                    await pg.wait_for_timeout(500)
                    blocked = await pg.locator("[data-sigem-station-gate='blocked']").count() > 0
                    ok = blocked == (not allowed)
                    if not ok: fails[0] += 1
                    res.append({"k": st["k"], "station": st["station"], "path": path, "allowed": allowed, "blocked": blocked, "ok": ok})
                    print(("PASS" if ok else "FAIL"), st["k"], path, "permitido" if allowed else "bloqueado", flush=True)
                    if path == "/":
                        for h in await pg.locator("aside a[href], nav a[href]").evaluate_all("els=>els.map(e=>e.getAttribute('href'))"):
                            u = urlparse(h or "")
                            if not u.netloc and u.path.startswith("/"): menu.add(u.path)
                res.append({"k": st["k"], "station": st["station"], "menu": sorted(menu)})
                await ctx.close()
        await asyncio.gather(*(run(st) for st in plan))
        await b.close()
    shutil.rmtree("/tmp/browser/nsector4/sessions", ignore_errors=True)
    os.makedirs("docs/nsector4", exist_ok=True)
    json.dump(res, open("docs/nsector4/matriz-isolamento.json", "w"), ensure_ascii=False, indent=1)
    print(f"NSECTOR4 browser fails={fails[0]}", flush=True)
    if fails[0]: raise SystemExit(1)
asyncio.run(main())
