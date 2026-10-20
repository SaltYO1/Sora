# Иконки PWA: python3 tools/icons.py (нужен Pillow и шрифт Noto Sans CJK)
# Знак 空 на закатном градиенте (#6f93cf → #a9b7e6 → #f2b8a2), как brand-mark в шапке.
import pathlib
from PIL import Image, ImageDraw, ImageFont
R = pathlib.Path(__file__).resolve().parent.parent / "icons"; R.mkdir(exist_ok=True)
FONT = "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc"
STOPS = [(0, (0x6f, 0x93, 0xcf)), (.55, (0xa9, 0xb7, 0xe6)), (1, (0xf2, 0xb8, 0xa2))]
def col(t):
    for (a, ca), (b, cb) in zip(STOPS, STOPS[1:]):
        if t <= b: k = (t - a) / (b - a); return tuple(round(x + (y - x) * k) for x, y in zip(ca, cb))
    return STOPS[-1][1]
def icon(size, pad=0.0, radius=0.22):
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    grad = Image.new("RGB", (S, S)); px = grad.load()
    for y in range(S):
        for x in range(S):
            px[x, y] = col(min(1, max(0, (y * .85 + x * .25) / (S * 1.1))))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius), fill=255)
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    f = ImageFont.truetype(FONT, int(S * (0.56 - pad)), index=0)
    d.text((S / 2, S / 2 + S * .02), "空", font=f, fill=(255, 255, 255, 255), anchor="mm")
    return img.resize((size, size), Image.LANCZOS)
icon(192).save(R / "icon-192.png")
icon(512).save(R / "icon-512.png")
a = icon(180, radius=0); bg = Image.new("RGB", a.size, (0x6f, 0x93, 0xcf)); bg.paste(a, (0, 0), a); bg.save(R / "apple-touch-icon.png")
m = icon(512, pad=.16, radius=0); bg = Image.new("RGB", m.size, (0x6f, 0x93, 0xcf)); bg.paste(m, (0, 0), m); bg.save(R / "icon-maskable-512.png")
print("ok")
