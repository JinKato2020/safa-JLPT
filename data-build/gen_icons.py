# アプリのアイコン/スプラッシュ生成(プレースホルダ・後で差し替え可)。ブランド青＋白「日」。
# 出力: ../app/assets/{icon.png, adaptive-icon.png, splash-icon.png}
import os
from PIL import Image, ImageDraw, ImageFont

BLUE = (37, 99, 235)    # #2563eb
BLUE2 = (29, 78, 216)   # #1d4ed8
WHITE = (255, 255, 255)
ROOT = os.path.dirname(os.path.abspath(__file__))
AOUT = os.path.join(ROOT, "..", "app", "assets")
FONTS = [
    r"C:\Windows\Fonts\YuGothB.ttc", r"C:\Windows\Fonts\meiryob.ttc",
    r"C:\Windows\Fonts\YuGothM.ttc", r"C:\Windows\Fonts\meiryo.ttc",
    r"C:\Windows\Fonts\msgothic.ttc", r"C:\Windows\Fonts\YuGothR.ttc",
]


def font(sz):
    for p in FONTS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, sz, index=0)
            except Exception:
                pass
    return ImageFont.load_default()


def gradient(size):
    img = Image.new("RGB", (size, size), BLUE)
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / size
        c = tuple(int(BLUE[i] + (BLUE2[i] - BLUE[i]) * t) for i in range(3))
        d.line([(0, y), (size, y)], fill=c)
    return img


def put_char(img, ch, frac):
    size = img.size[0]
    d = ImageDraw.Draw(img)
    f = font(int(size * frac))
    d.text((size / 2, size / 2 * 0.97), ch, font=f, fill=WHITE, anchor="mm")
    return img


os.makedirs(AOUT, exist_ok=True)
# iOS/汎用アイコン(不透明)
icon = put_char(gradient(1024), "日", 0.62)
icon.save(os.path.join(AOUT, "icon.png"))
# Android adaptive 前景(透明・セーフゾーン内)
adp = put_char(Image.new("RGBA", (1024, 1024), (0, 0, 0, 0)), "日", 0.44)
adp.save(os.path.join(AOUT, "adaptive-icon.png"))
# スプラッシュ(透明「日」を背景色の上に contain 配置)
sp = put_char(Image.new("RGBA", (1024, 1024), (0, 0, 0, 0)), "日", 0.5)
sp.save(os.path.join(AOUT, "splash-icon.png"))
print("icons saved ->", os.path.abspath(AOUT))
