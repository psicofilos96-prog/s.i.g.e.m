"""Compara pré-visualização (HTML/SVG no Chromium) × PDF (jsPDF, rasterizado por pdftoppm) da Ficha de Matrícula.
Uso: python3 scripts/enrollment-form-visual-compare.py <pasta com .html e .pdf>
Reprova (exit 1) se dimensões, número de páginas ou diferença de pixels passarem da tolerância."""
import asyncio, glob, os, subprocess, sys
from PIL import Image, ImageChops, ImageFilter
from playwright.async_api import async_playwright

DPI = 100
W, H = round(210 / 25.4 * DPI), round(297 / 25.4 * DPI)
TOL_PIXELS = 0.02  # fração de pixels com diferença forte (após suavização de 1 px)

async def shots(html: str, prefix: str) -> list[str]:
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        pg = await b.new_page(viewport={"width": 900, "height": 1200}, device_scale_factor=DPI / 96)
        await pg.goto("file://" + html); await pg.wait_for_timeout(300)
        out = []
        for i, el in enumerate(await pg.query_selector_all(".sheet")):
            path = f"{prefix}-html-{i + 1}.png"; await el.screenshot(path=path); out.append(path)
        await b.close(); return out

def main(d: str) -> int:
    bad = 0
    for pdf in sorted(glob.glob(os.path.join(d, "*.pdf"))):
        base = pdf[:-4]; html = base + ".html"
        subprocess.run(["pdftoppm", "-r", str(DPI), "-png", pdf, base + "-pdf"], check=True)
        pdf_pages = sorted(glob.glob(base + "-pdf-*.png"))
        html_pages = asyncio.run(shots(html, base))
        name = os.path.basename(base)
        if len(pdf_pages) != len(html_pages):
            print(f"FALHA {name}: páginas PDF={len(pdf_pages)} prévia={len(html_pages)}"); bad += 1; continue
        for i, (a, b) in enumerate(zip(html_pages, pdf_pages), 1):
            ia, ib = Image.open(a).convert("L"), Image.open(b).convert("L")
            dims_ok = abs(ia.width - W) <= 2 and abs(ia.height - H) <= 2 and abs(ib.width - W) <= 2 and abs(ib.height - H) <= 2
            ib = ib.resize(ia.size)
            diff = ImageChops.difference(ia.filter(ImageFilter.GaussianBlur(1)), ib.filter(ImageFilter.GaussianBlur(1)))
            strong = sum(1 for v in diff.getdata() if v > 64) / (ia.width * ia.height)
            ok = dims_ok and strong <= TOL_PIXELS
            bad += 0 if ok else 1
            print(f"{'OK   ' if ok else 'FALHA'} {name} p{i}: {ia.width}x{ia.height} vs {ib.width}x{ib.height}, pixels divergentes {strong:.3%}")
    return 1 if bad else 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "/tmp/ficha-samples"))
