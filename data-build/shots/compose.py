# 生スクショ(raw/*.png 1320x2868)を iPhone枠+英語キャプション+ブランド背景で合成し
# 申請用 1320x2868 PNG(アルファ無し)を ../../申請スクショ/ に出力。
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1320, 2868
OUTDIR = os.path.join('..', '..', '申請スクショ')
os.makedirs(OUTDIR, exist_ok=True)

SHOTS = [
    ('01_home', 'Know exactly how ready you are to pass'),
    ('02_study', 'Practice a little every day'),
    ('03_test', 'Test yourself with mock exams'),
    ('04_dict', 'Built-in N5-N3 dictionary'),
    ('05_streak', 'Build a daily habit and watch it grow'),
]
FONT = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 76)


def gradient(top, bot):
    col = Image.new('RGB', (1, H))
    for y in range(H):
        t = y / H
        col.putpixel((0, y), tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    return col.resize((W, H))


def wrap(draw, text, font, maxw):
    words, lines, cur = text.split(' '), [], ''
    for w in words:
        test = (cur + ' ' + w).strip()
        if draw.textlength(test, font=font) <= maxw:
            cur = test
        else:
            lines.append(cur); cur = w
    if cur:
        lines.append(cur)
    return lines


def rounded_mask(size, r):
    m = Image.new('L', size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size[0] - 1, size[1] - 1], radius=r, fill=255)
    return m


for name, cap in SHOTS:
    canvas = gradient((47, 107, 240), (24, 64, 184))
    draw = ImageDraw.Draw(canvas)
    lines = wrap(draw, cap, FONT, W - 160)
    y = 140
    for ln in lines:
        tw = draw.textlength(ln, font=FONT)
        draw.text(((W - tw) / 2, y), ln, font=FONT, fill=(255, 255, 255))
        y += 96

    shot = Image.open(f'raw/{name}.png').convert('RGB')
    dw = 1000
    dh = int(shot.height * dw / shot.width)
    shot = shot.resize((dw, dh))
    bezel = 18
    bw, bh = dw + bezel * 2, dh + bezel * 2
    bx, by = (W - bw) // 2, 470

    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([bx, by + 16, bx + bw, by + bh + 16], radius=90, fill=(0, 0, 0, 95))
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    canvas.paste(shadow, (0, 0), shadow)

    bez = Image.new('RGBA', (bw, bh), (0, 0, 0, 0))
    ImageDraw.Draw(bez).rounded_rectangle([0, 0, bw - 1, bh - 1], radius=90, fill=(18, 18, 20, 255))
    canvas.paste(bez, (bx, by), bez)

    canvas.paste(shot, (bx + bezel, by + bezel), rounded_mask((dw, dh), 74))
    canvas.save(os.path.join(OUTDIR, f'{name}.png'))
    print('composed', name, canvas.size)

print('done ->', os.path.abspath(OUTDIR))
