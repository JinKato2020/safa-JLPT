"""Package the approved radical lesson previews as offline Metro HTML assets."""
import base64
import io
import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PREVIEW = ROOT / "docs" / "previews"
OUTPUT = ROOT / "assets" / "radical-lessons"
BRIDGE = """<script>
const appLesson = /*APP_LESSON_CONFIG*/ {};
const sendToApp = (type, values = {}) => {
  window.ReactNativeWebView?.postMessage(JSON.stringify({ type, ...values }));
};
document.addEventListener('click', event => {
  const link = event.target.closest('[data-app-page]');
  if (!link || !window.ReactNativeWebView) return;
  event.preventDefault();
  sendToApp('page', { page: link.dataset.appPage, language });
});
</script>"""


def read(name):
    return (PREVIEW / name).read_text(encoding="utf-8")


def image_uri(name):
    encoded = io.BytesIO()
    with Image.open(PREVIEW / "assets" / name) as image:
        image.thumbnail((650, 540), Image.Resampling.LANCZOS)
        if name == "sakura-standing.png":
            image.save(encoded, "PNG", optimize=True)
            mime = "png"
        else:
            image.convert("RGB").save(encoded, "WEBP", quality=68, method=6)
            mime = "webp"
    return f"data:image/{mime};base64," + base64.b64encode(encoded.getvalue()).decode("ascii")


def replace_image_urls(source):
    return re.sub(r'assets/(sakura-[\w-]+\.png)', lambda match: image_uri(match[1]), source)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    upper = read("radicals-upper-lessons.js")
    course = read("radicals-n5.js")
    names = set(re.findall(r"image: '(sakura-[\w-]+\.png)'", course))
    names.update(f"sakura-radical-{id}.png" for id in re.findall(r"id: '([\w-]+)'", upper))
    art = "const lessonArt = " + json.dumps({name: image_uri(name) for name in sorted(names)}) + ";\n"
    course = course.replace("assets/${current.image}", "${lessonArt[current.image]}")
    course = course.replace("assets/${lesson.image}", "${lessonArt[lesson.image]}")
    course = course.replace("let language = 'ja';", "let language = appLesson.language || 'ja';")
    course = course.replace("let currentLevel = 'N5';", "let currentLevel = appLesson.level || 'N5';")
    course = course.replace("let completed = {};", "let completed = appLesson.completed || {};")
    course = course.replace("try { completed = JSON.parse", "if (!window.ReactNativeWebView) try { completed = JSON.parse")
    course = course.replace("function speak(word) {", "function speak(word) {\n  if (window.ReactNativeWebView) { sendToApp('speak', { word }); return; }")
    course = course.replace('href="radicals-n5-human.html"', 'href="#" data-app-page="human"')
    course = course.replace(
        "else if (lessons.some(lesson => lesson.id === id)) startLesson(id);",
        """else if (lessons.some(lesson => lesson.id === id)) {
    startLesson(id);
    sendToApp('view', { id, level: currentLevel });
  }""",
    )
    course = course.replace("completed[current.id] = true;", "completed[current.id] = true; sendToApp('complete', { id: current.id });")
    course = course.replace("window.addEventListener('hashchange', route);", """document.documentElement.lang = language;
el('language').textContent = language === 'ja' ? 'English' : '日本語';
window.addEventListener('hashchange', route);""")
    template = read("radicals-n5.html")
    template = re.sub(r'<!--.*?-->', '', template, flags=re.S)
    template = template.replace("<head>", "<head>" + BRIDGE)
    template = template.replace('<link rel="stylesheet" href="radicals-n5.css">', "<style>" + read("radicals-n5.css") + "</style>")
    template = template.replace('<script src="radicals-upper-lessons.js"></script>', "<script>" + upper + "</script>")
    template = template.replace('<script src="radicals-n5.js"></script>', "<script>" + art + replace_image_urls(course) + "</script>")
    (OUTPUT / "course.html").write_text(template, encoding="utf-8")

    human = read("radicals-n5-human.html").replace("<head>", "<head>" + BRIDGE)
    human = human.replace('href="radicals-n5.html"', 'href="#" data-app-page="course"')
    human = human.replace("let language='ja', step=0;", "let language=appLesson.language || 'ja', step=0;")
    human = human.replace("function speak(word){", "function speak(word){if(window.ReactNativeWebView){sendToApp('speak',{word});return;}")
    human = human.replace("}else step++;if('speechSynthesis'", "}else step++;if(step===7)sendToApp('complete',{id:'human'});if('speechSynthesis'")
    (OUTPUT / "human.html").write_text(replace_image_urls(human), encoding="utf-8")


if __name__ == "__main__":
    main()
