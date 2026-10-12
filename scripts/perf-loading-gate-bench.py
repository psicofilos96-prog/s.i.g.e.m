# PERF.LOADING.1 — benchmark reproduzível sem sessão (fora do bundle).
# Para cada rota estática: leituras de domínio ao banco (/rest/v1), respostas 401/403,
# tempo até a tela assentar e "Carregando" preso após 12 s. Nenhuma gravação; nenhum segredo lido.
# Uso: python3 scripts/perf-loading-gate-bench.py routes.txt saida.json [base_url]
import asyncio, json, sys, time
from playwright.async_api import async_playwright

ROUTES = [l.strip() for l in open(sys.argv[1]) if l.strip()]
OUT = sys.argv[2]
BASE = sys.argv[3] if len(sys.argv) > 3 else "http://localhost:8080"
STUCK_MS = 12000

async def one(ctx, path):
    page = await ctx.new_page()
    reads, denied = [], []
    page.on("request", lambda r: reads.append(r.url) if ("/rest/v1/" in r.url or "/_serverFn/" in r.url) else None)
    page.on("response", lambda r: denied.append(r.status) if ("/rest/v1/" in r.url or "/_serverFn/" in r.url) and r.status in (401, 403) else None)
    t0 = time.monotonic()
    try:
        await page.goto(BASE + path, wait_until="networkidle", timeout=30000)
    except Exception:
        pass
    settle = round((time.monotonic() - t0) * 1000)
    await page.wait_for_timeout(max(0, STUCK_MS - settle))
    body = await page.inner_text("body")
    stuck = "Carregando" in body
    await page.close()
    return {"route": path, "domainReads": len(reads), "denied": len(denied), "settleMs": settle, "stuckLoading": stuck}

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={"width": 1280, "height": 1800})
        sem = asyncio.Semaphore(6)
        async def run(r):
            async with sem:
                return await one(ctx, r)
        res = await asyncio.gather(*[run(r) for r in ROUTES])
        await b.close()
    json.dump(res, open(OUT, "w"), indent=1, ensure_ascii=False)
    bad = [r for r in res if r["denied"] or r["stuckLoading"]]
    print(f"rotas={len(res)} com_401={sum(1 for r in res if r['denied'])} presas={sum(1 for r in res if r['stuckLoading'])}")
    for r in bad: print(r)

asyncio.run(main())
