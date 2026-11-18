"""Draft and independently review radical-course locales with Gemini. Public course text only."""
import argparse
import ast
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import os
from pathlib import Path
import re
import sys
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / 'docs' / 'previews'
LOCALES = {'ne':'Nepali', 'id':'Indonesian', 'vi':'Vietnamese', 'my':'Burmese',
           'ko':'Korean', 'zh':'Simplified Chinese', 'zh2':'Traditional Chinese (Taiwan)',
           'bn':'Bengali', 'th':'Thai', 'hi':'Hindi'}
MODEL = 'gemini-3.1-flash-lite'


def course_strings():
    """English strings identify translation units. Use Japanese as the source where available."""
    data = (PREVIEW / 'radicals-lessons.js').read_text(encoding='utf-8-sig')
    lessons = json.loads(data.split('const RADICAL_LESSONS =', 1)[1].strip().removesuffix(';'))
    strings = {}

    def add(en, ja=''):
        if en and (en not in strings or not strings[en]):
            strings[en] = ja

    for lesson in lessons:
        add(lesson['english'], lesson['name'])
        for key in ('radical', 'insight', 'transfer'):
            text = lesson[key]
            add(text['en'], text['ja'])
        for card in lesson['cards']:
            for key in ('meaning', 'story'):
                text = card[key]
                add(text['en'], text['ja'])
            for _, ja, en, _ in card['parts']:
                add(en, ja)
        for _, _, meaning in lesson['words']:
            add(meaning)
    ui = (PREVIEW / 'radicals-n5.js').read_text(encoding='utf-8-sig')
    quoted = r"'(?:[^'\\]|\\.)*'"
    for pattern in (
        rf"(?:\bL|\btextFor|sectionTitle)\((?:'\d+',)?\s*({quoted})\s*,\s*({quoted})\)",
        rf"\{{ja:({quoted}),en:({quoted})\}}",
    ):
        for ja, en in re.findall(pattern, ui):
            add(ast.literal_eval(en), ast.literal_eval(ja))
    add('SAKURA’S KANJI NOTEBOOK', '桜の漢字ノート')
    return strings


def write_file(path, content):
    temp = path.with_suffix(path.suffix + '.writing')
    temp.write_text(content, encoding='utf-8', newline='\n')
    temp.replace(path)


def generate(key, instruction, values):
    req = urllib.request.Request(
        f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent',
        data=json.dumps({
            'contents': [{'parts': [{'text': instruction + '\n' + json.dumps(values, ensure_ascii=False)}]}],
            'generationConfig': {
                'temperature': 0.15, 'thinkingConfig': {'thinkingLevel': 'MINIMAL'},
                'responseMimeType': 'application/json', 'maxOutputTokens': 12000,
            },
        }, ensure_ascii=False).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'x-goog-api-key': key},
    )
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=110) as response:
                obj = json.load(response)
            usage = obj.get('usageMetadata', {})
            response = json.loads(obj['candidates'][0]['content']['parts'][0]['text'])
            if not isinstance(response, dict):
                raise ValueError('expected JSON object')
            return response, usage
        except urllib.error.HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 3:
                raise RuntimeError(f'Gemini HTTP {error.code}') from None
        except (ValueError, KeyError, IndexError, TimeoutError, urllib.error.URLError) as error:
            if attempt == 3:
                raise RuntimeError(f'Gemini response: {type(error).__name__}') from None
        time.sleep(2 ** attempt + attempt)


RULES = (
    'This is a Japanese kanji education course. Preserve claims, hedges, the difference between '
    'historical origin and a mnemonic, and the difference between a meaning component and sound cue. '
    'Never invent historical details. Preserve example Japanese words, characters and kana readings exactly. '
    'Translate the surrounding ordinary text, including short labels and the meaning of single Japanese characters. '
    'Do not substitute the Japanese input as the output, even for short glosses. '
    'Use natural, clear learner language and consistent terminology. '
    'When Japanese is available it is the source and English is context; otherwise English is the source. '
    'Keep each item independent, concise, and in the requested language. Return JSON only.'
)

SCRIPTS = {'ne': r'[\u0900-\u097f]', 'hi': r'[\u0900-\u097f]', 'id': r'[A-Za-z]',
           'vi': r'[A-Za-z\u00c0-\u024f\u1e00-\u1eff]', 'my': r'[\u1000-\u109f]',
           'ko': r'[\uac00-\ud7af]', 'zh': r'[\u3400-\u9fff]', 'zh2': r'[\u3400-\u9fff]',
           'bn': r'[\u0980-\u09ff]', 'th': r'[\u0e00-\u0e7f]'}


def looks_localized(lang, source, text):
    if lang == 'en' or source['en'].strip() == 'Kanjipedia' or re.fullmatch(r'[A-ZĀĪŪĒŌ -]{1,6}', source['en']):
        return True  # Romanized Japanese readings and brand names may be kept as supplied.
    if not re.search(SCRIPTS[lang], text):
        return False
    clean = text.strip()
    if lang in ('zh', 'zh2') and clean == source['ja'] and re.search(r'[\u3041-\u30fa]{2}', clean):
        return False
    if lang in ('id', 'vi') and clean == source['en'].strip() and len(clean.split()) > 1:
        return False
    return True


def batches(strings):
    batch = {}
    size = 0
    for index, (en, ja) in enumerate(strings.items()):
        length = len(en) + len(ja)
        if batch and (size + length > 5200 or len(batch) >= 64):
            yield batch
            batch, size = {}, 0
        batch[str(index)] = {'ja': ja, 'en': en}
        size += length
    if batch:
        yield batch


GLOSSARY = {
    'space between': {
        'ne': 'बीचको खाली ठाउँ', 'id': 'ruang di antara', 'vi': 'khoảng trống ở giữa',
        'my': 'ကြားက လွတ်နေသော နေရာ', 'ko': '사이의 빈 공간', 'zh': '中间的空隙',
        'zh2': '中間的空隙', 'bn': 'মাঝের ফাঁকা জায়গা', 'th': 'ช่องว่างระหว่างสิ่งต่าง ๆ',
        'hi': 'बीच की खाली जगह',
    },
    ('買う: pay to get something. 費用: the money it costs. 資金: money available to fund something. '
     'Use 貝 to recognize the money family, then learn the exact meaning through each word.'): {
        'ne': ('買う भनेको पैसा तिरेर केही किन्नु हो। 費用 भनेको लाग्ने खर्च हो। 資金 भनेको कुनै कामका लागि जुटाइएको '
               'रकम हो। यी सबैमा भएको 貝 ले पैसासँग सम्बन्ध देखाउँछ। हरेक शब्दको ठ्याक्कै अर्थ छुट्टै सिक्नुहोस्।'),
        'hi': ('買う का अर्थ है पैसे देकर कुछ खरीदना। 費用 का अर्थ है किसी चीज़ पर होने वाला खर्च। 資金 किसी काम के '
               'लिए जुटाई गई रकम है। इन सबमें 貝 पैसे से संबंध का संकेत देता है। फिर हर शब्द का सही अर्थ अलग से सीखें।'),
        'bn': ('買う মানে টাকা দিয়ে কিছু কেনা। 費用 মানে কোনো কিছুর জন্য যে টাকা খরচ হয়। 資金 মানে কোনো কাজের জন্য '
               'জোগাড় করা টাকা। সবগুলিতেই 貝 দেখে টাকার সঙ্গে সম্পর্ক বুঝুন। তারপর প্রতিটি শব্দের সঠিক অর্থ আলাদা করে শিখুন।'),
    },
}


def checked_batch(key, lang, source, cache_file):
    manual = {i: GLOSSARY[text['en']][lang] for i, text in source.items()
              if lang in GLOSSARY.get(text['en'], {})}
    uncovered = {i: text for i, text in source.items() if i not in manual}
    cached = json.loads(cache_file.read_text(encoding='utf-8')) if cache_file.exists() else {}
    has_cache = cached.get('source') == source and cached.get('reviewed')
    if has_cache and all(looks_localized(lang, text, cached['text'][i]) for i, text in uncovered.items()):
        return {**cached['text'], **manual}, cached['usage']
    usage = list(cached['usage']) if has_cache else [0, 0]

    def call(prompt, items):
        result, tokens = generate(key, prompt, items)
        usage[0] += tokens.get('promptTokenCount', 0)
        usage[1] += tokens.get('candidatesTokenCount', 0) + tokens.get('thoughtsTokenCount', 0)
        return result

    def validated(prompt, items, partial=False):
        if not items:
            return {}
        if len(items) == 1:
            i, value = next(iter(items.items()))
            result = call(prompt + ' For this single input use the JSON key "text".', {'text': value})
            result = {i: result['text']} if 'text' in result else {i: result[i]} if i in result else {}
        else:
            try:
                result = call(prompt, items)
            except RuntimeError as error:
                if not str(error).startswith('Gemini response:'):
                    raise
                result = None
        if result is None:
            halves = list(items.items())
            middle = len(halves) // 2
            return {**validated(prompt, dict(halves[:middle]), partial), **validated(prompt, dict(halves[middle:]), partial)}
        if partial:
            result = {i: t for i, t in result.items() if t not in (None, '')}
        if partial and set(result).issubset(items) and all(isinstance(t, str) and t.strip() for t in result.values()):
            return result
        if not partial:
            usable = {i: result[i] for i in items if isinstance(result.get(i), str)
                      and result[i].strip() and looks_localized(lang, source[i], result[i])}
            missing = {i: text for i, text in items.items() if i not in usable}
            if not missing:
                return usable
            if len(missing) < len(items):
                return {**usable, **validated(prompt, missing)}
        if len(items) == 1:
            raise ValueError(f'{lang}: invalid translation or review for ID {next(iter(items))}')
        halves = list(items.items())
        middle = len(halves) // 2
        return {**validated(prompt, dict(halves[:middle]), partial), **validated(prompt, dict(halves[middle:]), partial)}

    if has_cache:
        draft = {**cached['text'], **manual}
        pending = {i: text for i, text in uncovered.items() if not looks_localized(lang, text, draft[i])}
        draft.update(validated(f'Translate these previously unlocalized strings into {LOCALES[lang]}. '
                               f'{RULES} Return each input ID with a translated string.', pending))
    elif lang == 'en':
        draft = {i: text['en'] for i, text in source.items()}
        pending = source
    else:
        pending = uncovered
        draft = {**validated(f'Translate into {LOCALES[lang]}. {RULES} Return an object mapping every input ID to its translation.', pending),
                 **manual}
    review_prompt = (
        f'Independently review every draft for accuracy and fluency in {LOCALES.get(lang, "English")}. '
        f'{RULES} Correct mistranslations, mixed-language leaks, missing details, and unnatural terminology. '
        'Return an object mapping IDs to corrected complete strings for errors only; return {} if none. '
        'For English review, leave draft alone if ja is empty.'
    )
    fixes = validated(review_prompt, {i: {**text, 'draft': draft[i]} for i, text in pending.items()}, partial=True)
    result = {i: (fixes[i] if i in fixes and looks_localized(lang, source[i], fixes[i]) else t).strip()
              for i, t in draft.items()}
    write_file(cache_file, json.dumps({'source': source, 'reviewed': True, 'text': result, 'usage': usage}, ensure_ascii=False))
    return result, usage


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, required=True)
    parser.add_argument('--workers', type=int, default=8)
    args = parser.parse_args()
    key = os.environ.get('GEMINI_API_KEY')
    if not key:
        raise SystemExit('GEMINI_API_KEY missing')
    strings = course_strings()
    all_batches = list(batches(strings))
    args.cache.mkdir(parents=True, exist_ok=True)
    languages = ['en', *LOCALES]
    drafts = {lang: {} for lang in languages}
    totals = [0, 0]
    print(f'{len(strings)} unique units; {len(all_batches)} batches per language', flush=True)
    jobs = [(lang, number, batch) for number, batch in enumerate(all_batches) for lang in languages]
    errors = []
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {executor.submit(checked_batch, key, lang, batch, args.cache / f'{lang}-{number}.json'): (lang, number)
                   for lang, number, batch in jobs}
        for n, future in enumerate(as_completed(futures), 1):
            lang, number = futures[future]
            try:
                translated, usage = future.result()
                drafts[lang].update(translated)
                totals = [a+b for a,b in zip(totals, usage)]
            except (RuntimeError, ValueError) as error:
                errors.append((lang, number))
                print(f'{lang}/{number}: {error}', file=sys.stderr, flush=True)
            if n % 20 == 0 or n == len(jobs):
                print(f'{n}/{len(jobs)} reviewed; input={totals[0]}, output={totals[1]}, failed={len(errors)}', flush=True)
    if errors:
        raise SystemExit('Review incomplete; rerun with the same cache to resume.')
    by_id = list(strings)
    output = {lang: {source: drafts[lang][str(i)] for i, source in enumerate(by_id)
                     if lang != 'en' or drafts[lang][str(i)] != source.strip()} for lang in languages}
    serialized = json.dumps(output, ensure_ascii=False, indent=2).replace('<', '\\u003c')
    write_file(PREVIEW / 'radicals-locales.js', 'const RADICAL_LOCALES = ' + serialized + ';\n')
    print(f'{MODEL}: input={totals[0]} output={totals[1]} estimated paid cost USD {sum(a*b for a,b in zip(totals,(0.25,1.50)))/1e6:.4f}', flush=True)


if __name__ == '__main__':
    main()
