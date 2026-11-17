"""Package the scroll-based radical lessons and their existing artwork for offline use."""
import base64
import io
import json
import re
import hashlib
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / 'docs' / 'previews'
OUTPUT = ROOT / 'assets' / 'radical-lessons'


def read(name):
    return (PREVIEW / name).read_text(encoding='utf-8-sig')


def image_uri(name):
    encoded = io.BytesIO()
    with Image.open(PREVIEW / 'assets' / name) as image:
        image.thumbnail((650, 540), Image.Resampling.LANCZOS)
        image.convert('RGB').save(encoded, 'WEBP', quality=68, method=6)
    return 'data:image/webp;base64,' + base64.b64encode(encoded.getvalue()).decode('ascii')


def write_audio_index(lessons):
    # Match src/words/vocabIndex.ts: first exact word|reading match wins.
    index = {}
    for name in ['src/data/shared/vocab.json', 'src/data/dict/kanjiExampleAudio.json']:
        for entry in json.loads((ROOT / name).read_text(encoding='utf-8')):
            index.setdefault(entry['word'] + '|' + entry['reading'], entry['id'])
    # Same spelling alias used by RadicalLessonsScreen for the dictionary recording.
    if '終る|おわる' in index:
        index.setdefault('終わる|おわる', index['終る|おわる'])
    words = {word[0] + '|' + word[1] for lesson in lessons for word in lesson['words']}
    available = {key: index[key] for key in sorted(words) if key in index}
    source = 'const RADICAL_AUDIO_BASE="https://jlpt.safa-lang.com/assets/audio/vocab/";\nconst RADICAL_AUDIO_IDS=' + json.dumps(available, ensure_ascii=False, indent=2) + ';\n'
    (PREVIEW / 'radicals-audio.js').write_bytes(source.encode('utf-8'))


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    data = read('radicals-lessons.js')
    lessons = json.loads(data.split('const RADICAL_LESSONS =', 1)[1].strip().removesuffix(';'))
    levels = json.loads((ROOT / 'src/data/dict/kanjiJlptLevel.json').read_text(encoding='utf-8'))['items']
    for lesson in lessons:
        for card in lesson['cards']:
            if card.get('word') and (card['word'] not in lesson['words'] or card['char'] not in card['word'][0]):
                raise ValueError(f"{lesson['id']}: invalid card word for {card['char']}")
        targets = [card['char'] for card in lesson['cards']] + [word[0] for word in lesson['words']]
        for target in targets:
            for char in target:
                if '\u4e00' <= char <= '\u9fff':
                    rank = levels.get(char, '')
                    if rank not in ('N5', 'N4', 'N3') or int(rank[1]) < int(lesson['level'][1]):
                        raise ValueError(f"{lesson['id']}: out-of-level character {char}")
    names = {lesson['image'] for lesson in lessons}
    if not names:
        raise ValueError('No lesson illustrations found')
    for name in names:
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]*\.png', name):
            raise ValueError(f'Invalid lesson illustration filename: {name}')
    art = {name: image_uri(name) for name in sorted(names)}
    write_audio_index(lessons)
    bridge = '<script>window.APP_RADICAL_CONFIG = /*APP_LESSON_CONFIG*/ {};window.RADICAL_ART = ' + json.dumps(art) + ';</script>'
    template = re.sub(r'<!--.*?-->', '', read('radicals-n5.html'), flags=re.S)
    template = template.replace('<head>', '<head>' + bridge)
    template = template.replace('<link rel="stylesheet" href="radicals-n5.css">', '<style>' + read('radicals-n5.css') + '</style>')
    for name in ['radicals-lessons.js', 'radicals-audio.js', 'radicals-n5.js']:
        template = template.replace(f'<script src="{name}"></script>', '<script>' + read(name) + '</script>')
    if re.search(r'<script\s+src=|<link\s+rel="stylesheet"', template):
        raise ValueError('Unbundled JS or CSS remains')
    (OUTPUT / 'course.html').write_text(template, encoding='utf-8')
    payload = template.encode('utf-8')
    digest = hashlib.md5(payload).hexdigest()
    remote = ROOT / 'web' / 'radical-lessons'
    remote.mkdir(parents=True, exist_ok=True)
    for old in remote.glob('course-*.html'):
        old.unlink()
    name = f'course-{digest}.html'
    (remote / name).write_bytes(payload)
    (remote / 'manifest.json').write_text(json.dumps({'schema': 1, 'file': name, 'md5': digest}), encoding='utf-8')
    print(f'Bundled course: {len(payload):,} bytes; OTA {name}')


if __name__ == '__main__':
    main()
