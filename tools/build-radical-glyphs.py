"""Export the course's rare kanji components as font-independent SVG outlines.

Input: Jigmo2.ttf from the author's CC0 release (not shipped in the app).
https://kamichikoichi.github.io/jigmo/Jigmo-20250912.zip
"""
import argparse
import hashlib
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / 'docs' / 'previews'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('font', type=Path)
    args = parser.parse_args()
    source = (PREVIEW / 'radicals-lessons.js').read_text(encoding='utf-8')
    chars = sorted({c for c in source if 0x20000 <= ord(c) <= 0x323AF})
    font = TTFont(args.font)
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    missing = [c for c in chars if ord(c) not in cmap]
    if missing:
        raise ValueError(f'Font lacks course characters: {missing}')
    upem = font['head'].unitsPerEm
    ascent = font['hhea'].ascent
    output = {}
    for char in chars:
        pen = SVGPathPen(glyphs)
        glyphs[cmap[ord(char)]].draw(pen)
        output[char] = {'viewBox': f'0 0 {upem} {upem}',
                        'transform': f'translate(0 {ascent}) scale(1 -1)',
                        'path': pen.getCommands()}
    header = ('// Rare component outlines, derived from Jigmo2 (2025-09-12), CC0 1.0.\n'
              '// Author/source: https://kamichikoichi.github.io/jigmo/\n'
              '// License: https://creativecommons.org/publicdomain/zero/1.0/\n'
              '// Source font SHA256: ' + hashlib.sha256(args.font.read_bytes()).hexdigest() + '\n'
              '// Regenerate: python tools/build-radical-glyphs.py /path/to/Jigmo2.ttf\n')
    path = PREVIEW / 'radicals-glyphs.js'
    path.write_text(header + 'const RADICAL_GLYPHS = ' + json.dumps(output, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    print(f'Exported {len(output)} outlines, {path.stat().st_size:,} bytes; em={upem}, ascent={ascent}')


if __name__ == '__main__':
    main()
