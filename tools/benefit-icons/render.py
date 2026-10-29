import sys, asyncio, base64, io, time
from pathlib import Path
from playwright.async_api import async_playwright
from PIL import Image

HERE = Path(sys.argv[1])
OUT = Path(sys.argv[2]); OUT.mkdir(parents=True, exist_ok=True)
NAMES = ['delivery', 'fitting', 'return', 'payment', 'gift', 'quality', 'fabric', 'cash', 'pin', 'style', 'gem', 'spool', 'mail', 'chat', 'phone']
only = sys.argv[3].split(',') if len(sys.argv) > 3 else NAMES
SIZE = int(sys.argv[4]) if len(sys.argv) > 4 else 900
FINAL = 320  # 2x for a 160px icon


def fit(img):
    """Frame the object (opaque pixels) with even padding, feather the shadow at the edges, scale to FINAL."""
    a = img.getchannel('A').point(lambda v: 255 if v > 24 else 0)
    l, t, r, b = a.getbbox()
    cx, cy = (l + r) / 2, (t + b) / 2
    side = int(max(r - l, b - t) * 1.24)
    x0, y0 = int(cx - side / 2), int(cy - side / 2)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(img.crop((max(x0, 0), max(y0, 0), min(x0 + side, img.width), min(y0 + side, img.height))), (max(-x0, 0), max(-y0, 0)))
    fw = side * 0.13
    mask = Image.new('L', (side, side))
    px = mask.load()
    for y in range(side):
        for x in range(side):
            d = min(x, y, side - 1 - x, side - 1 - y)
            px[x, y] = int(255 * min(1.0, d / fw))
    alpha = Image.fromarray(__import__('numpy').minimum(__import__('numpy').array(sq.getchannel('A')), __import__('numpy').array(mask)))
    sq.putalpha(alpha)
    return sq.convert('RGBa').resize((FINAL, FINAL), Image.LANCZOS).convert('RGBA')


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        pg = await b.new_page()
        await pg.goto('file://' + str(HERE / 'render.html'))
        for i, n in enumerate(NAMES):
            if n not in only:
                continue
            t0 = time.time()
            url = await pg.evaluate(f'render({i}, {SIZE})')
            raw = Image.open(io.BytesIO(base64.b64decode(url.split(',')[1]))).convert('RGBA')
            raw.save(OUT / f'{n}-raw.png')
            fit(raw).save(OUT / f'{n}.png')
            print(n, f'{time.time() - t0:.1f}s', flush=True)
        await b.close()

asyncio.run(main())
