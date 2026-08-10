# 合否証明書に「レベル(N5/N4/N3)」を焼き込んで6枚を生成する。
# なぜ画像に焼き込むか: アプリ側で文字レイヤを重ねると、端末(iOS/Android)のフォント差で
# レベル文字が数px上下左右にズレる。画像の一部にすれば全端末で完全に同一になる。
#
# 入力(テンプレ・レベル文字なし): assets/mock/mock_cert_pass.jpg / mock_cert_fail.jpg (738x1000)
# 出力: assets/mock/mock_cert_{pass,fail}_{n5,n4,n3}.jpg
# 配置はアプリの旧ライブ文字と同じ割合(証明書に対する比率)に一致させている:
#   中心x = 幅 * 0.5074 / 中心y = 高さ * 0.443 / 文字高 = 高さ * 0.075 / 色 = 濃紺(#1e1e3c) / Times New Roman Bold
# 使い方: python tools/bake_cert_levels.py  (リポジトリ直下で実行)
from PIL import Image, ImageDraw, ImageFont

SRC = {'pass': 'assets/mock/mock_cert_pass.jpg', 'fail': 'assets/mock/mock_cert_fail.jpg'}
FONT_PATH = 'C:/Windows/Fonts/timesbd.ttf'  # Times New Roman Bold (iOSのTimes New Romanと字形一致)
COLOR = (30, 30, 60)                          # #1e1e3c
CENTER_X_RATIO, CENTER_Y_RATIO, FONT_H_RATIO = 0.5074, 0.443, 0.075
OUT = 'assets/mock'

def main() -> None:
    made = 0
    for outcome, src in SRC.items():
        im = Image.open(src).convert('RGB')
        w, h = im.size
        font = ImageFont.truetype(FONT_PATH, int(round(h * FONT_H_RATIO)))
        cx, cy = w * CENTER_X_RATIO, h * CENTER_Y_RATIO
        for lv in ('N5', 'N4', 'N3'):
            c = im.copy()
            ImageDraw.Draw(c).text((cx, cy), lv, font=font, fill=COLOR, anchor='mm')
            c.save(f'{OUT}/mock_cert_{outcome}_{lv.lower()}.jpg', quality=92)
            made += 1
    print(f'baked {made} certificate images into {OUT}')

if __name__ == '__main__':
    main()
