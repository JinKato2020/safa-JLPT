import * as FS from 'expo-file-system/legacy';

const BASE = 'https://jlpt.safa-lang.com/radical-lessons/';
const DIR = FS.documentDirectory + 'radical-lessons/';
const INDEX = DIR + 'current.json';
const MARKER = '/*APP_LESSON_CONFIG*/ {}';
let syncing: Promise<void> | undefined;

type Course = { schema: 1; file: string; md5: string };
function parseCourse(value: unknown): Course | null {
  const c = value as Partial<Course> | null;
  return c?.schema === 1 && typeof c.md5 === 'string' && /^[a-f0-9]{32}$/.test(c.md5) &&
    c.file === `course-${c.md5}.html` ? c as Course : null;
}

async function readCourse(c: Course): Promise<string | null> {
  const info = await FS.getInfoAsync(DIR + c.file, { md5: true });
  if (!info.exists || info.isDirectory || info.md5 !== c.md5) return null;
  const html = await FS.readAsStringAsync(DIR + c.file);
  return html.includes(MARKER) ? html : null;
}

export async function cachedRadicalCourse(): Promise<string | null> {
  try {
    const c = parseCourse(JSON.parse(await FS.readAsStringAsync(INDEX)));
    return c ? await readCourse(c) : null;
  } catch { return null; }
}

async function fetchText(path: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(BASE + path, { signal: controller.signal });
    if (!response.ok) throw new Error('Course download failed');
    return await response.text();
  } finally { clearTimeout(timeout); }
}

async function sync(): Promise<void> {
  try {
    const c = parseCourse(JSON.parse(await fetchText('manifest.json')));
    if (!c) return;
    await FS.makeDirectoryAsync(DIR, { intermediates: true });
    if (!await readCourse(c)) {
      const html = await fetchText(c.file);
      if (!html.includes(MARKER)) return;
      await FS.writeAsStringAsync(DIR + c.file, html);
      if (!await readCourse(c)) return;
    }
    // Publish the pointer only after the complete HTML and embedded images are verified.
    await FS.writeAsStringAsync(INDEX, JSON.stringify(c));
  } catch { /* Keep the cached course or bundled course available offline. */ }
}

export function syncRadicalCourse(): Promise<void> {
  if (!syncing) syncing = sync().finally(() => { syncing = undefined; });
  return syncing;
}
