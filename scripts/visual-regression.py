"""NVIS.1 — regressão visual headless. Uso: python3 scripts/visual-regression.py [base_url] [out_dir]
Sem sessão (camada pública/laboratório); com sessão só via harness-gate."""
import asyncio, json, sys
from pathlib import Path
from playwright.async_api import async_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/browser/nvis1"); OUT.mkdir(parents=True, exist_ok=True)
ROUTES = ["/", "/login", "/alunos", "/turmas", "/unidades", "/calendario-escolar", "/relatorios", "/horarios", "/diario", "/alimentacao-escolar", "/carteirinhas", "/autorizacoes-familia", "/acompanhamento-diarios", "/familia", "/inclusao", "/secretaria", "/mapa-estatistico", "/verificar/carteirinha/XXXX.1", "/rota-inexistente"]
VIEWS = {"1440x900": (1440, 900), "1366x768": (1366, 768), "tablet": (820, 1180), "390x844": (390, 844)}
PROBE = """() => {
 const de = document.documentElement, out = {hOverflow: de.scrollWidth - de.clientWidth, clipped: [], overlaps: 0, loading: [], text: document.body.innerText.length};
 for (const el of document.querySelectorAll('body *')) {
   const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
   const cs = getComputedStyle(el);
   if (r.right > de.clientWidth + 2 && cs.position !== 'fixed' && !el.closest('[data-scroll-x],.overflow-x-auto,.overflow-auto,table')) out.clipped.push((el.tagName + '.' + (el.className?.toString?.()||'')).slice(0,80));
 }
 for (const el of document.querySelectorAll('[aria-busy=true],[role=progressbar]')) out.loading.push(el.tagName);
 for (const t of ['Carregando', 'Verificando…', 'Loading']) if (document.body.innerText.includes(t)) out.loading.push(t);
 out.clipped = [...new Set(out.clipped)].slice(0, 5); return out; }"""
async def main():
  res = {}
  async with async_playwright() as p:
    b = await p.chromium.launch(headless=True)
    for vn, (w, h) in VIEWS.items():
      ctx = await b.new_context(viewport={"width": w, "height": h}); pg = await ctx.new_page()
      errs = []; pg.on("pageerror", lambda e: errs.append(str(e)[:120]))
      for r in ROUTES:
        await pg.goto(BASE + r, wait_until="networkidle"); await pg.wait_for_timeout(2500)
        m = await pg.evaluate(PROBE); m["errors"] = errs[:]; errs.clear()
        name = f"{vn}_{r.strip('/').replace('/', '_') or 'home'}"
        await pg.screenshot(path=str(OUT / f"{name}.png")); res[name] = m
      await ctx.close()
    await b.close()
  (OUT / "report.json").write_text(json.dumps(res, indent=1, ensure_ascii=False))
  bad = {k: v for k, v in res.items() if v["hOverflow"] > 2 or v["clipped"] or v["loading"] or v["errors"] or v["text"] < 40}
  print(json.dumps(bad, indent=1, ensure_ascii=False)); print(f"{len(res)} capturas, {len(bad)} com achado")
asyncio.run(main())
