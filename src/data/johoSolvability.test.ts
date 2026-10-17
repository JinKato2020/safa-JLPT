// 情報検索(joho) の「走査性(全体を見渡す必要)」と「場面の多様性」の番人。
// 一発照合(表の1行/見出しだけ)で解けてしまうワンパターン化を機械で止める。設計正本＝md/09_読解.md。
// 相棒レポート＝tools/joho_solvability.py（同ロジック）。
//
// 【パラメータ】
//  多様性(diversity)：scene 種類≥6 かつ 最頻場面 ≤35%（全レベル・常時）。
//  走査S(情報源≥2)：表+注記/2表以上/カード(≥3)/プローズ(お知らせ行≥4)はOK。表のみは 行≥8 かつ 列≥4。
//     → 一発照合になりがちな単一・小さな図版を弾く。新方式レベル(N4/N3)のみハード（N5は公式どおり易しく=対象外）。
//  走査C(誘惑肢グラウンディング)：q_type=選ぶ は 4択のうち≥3が図版テキストに実在（でたらめ誤答＝走査不要を弾く）。N4/N3のみ。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../content/problems/dokkai/', import.meta.url));
const FILES = ['joho_N5', 'joho_N4', 'joho_N3'];
const SCAN_HARD = new Set(['joho_N4', 'joho_N3']);
const SCENE_MIN_KINDS = 6;
const SCENE_MAX_SHARE = 0.35;
const CHOICE_GROUND_TYPES = new Set(['選ぶ']);
const CHOICE_GROUND_MIN = 3;
const TABLE_ONLY_MIN_ROWS = 6, TABLE_ONLY_MIN_COLS = 4, PROSE_MIN_LINES = 4, CARD_MIN = 3;  // 表のみ行≥6=本番相当

type Block = { type: string; table?: { columns?: unknown[]; rows?: unknown[] }; lines?: unknown[] };
type Item = {
  id: string; body?: unknown;
  figure?: { blocks?: Block[] } & Record<string, unknown>;
  questions: { q: string; choices: string[] }[];
  skeleton?: { q_type?: string; scene?: string; figure_pattern?: string };
};
function load(name: string): Item[] {
  return JSON.parse(readFileSync(DIR + name + '.json', 'utf8')).items as Item[];
}
function collectText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(collectText).join('');
  if (v && typeof v === 'object') return Object.values(v as Record<string, unknown>).map(collectText).join('');
  return '';
}
const norm = (s: string) => s.replace(/（[^）]*）/g, '').replace(/\s/g, '');
const figText = (it: Item) => norm(collectText(it.figure ?? {}));

function sourcesOk(it: Item): string | null {
  const blocks = it.figure?.blocks ?? [];
  const tabs = blocks.filter((b) => b.type === 'table');
  const notes = blocks.filter((b) => b.type === 'notice');
  const cards = blocks.filter((b) => b.type === 'card');
  const fp = it.skeleton?.figure_pattern;
  if (fp === '表のみ') {
    const t = tabs[0]?.table ?? {};
    const rows = (t.rows ?? []).length, cols = (t.columns ?? []).length;
    if (tabs.length !== 1) return '表のみだが表数≠1';
    if (rows < TABLE_ONLY_MIN_ROWS || cols < TABLE_ONLY_MIN_COLS) return `表のみ 行${rows}/列${cols}`;
    return null;
  }
  if (fp === '表+注記') return (tabs.length >= 1 && notes.length >= 1) ? null : '表+注記の構成不足';
  if (fp === '2表以上') return tabs.length >= 2 ? null : '2表未満';
  if (fp === 'カード') return cards.length >= CARD_MIN ? null : `カード${cards.length}<${CARD_MIN}`;
  if (fp === 'プローズ') {
    const nlines = notes.reduce((s, b) => s + (b.lines ?? []).length, 0);
    return nlines >= PROSE_MIN_LINES ? null : `プローズ行${nlines}<${PROSE_MIN_LINES}`;
  }
  return `未知figure_pattern:${fp}`;
}
function choicesOk(it: Item): boolean {
  if (!CHOICE_GROUND_TYPES.has(it.skeleton?.q_type ?? '')) return true;
  const ft = figText(it);
  const hit = it.questions[0].choices.filter((c) => norm(c) && ft.includes(norm(c))).length;
  return hit >= CHOICE_GROUND_MIN;
}

test('場面(scene)が多様＝種類≥6 かつ 最頻≤35%（ワンパターン化を止める）', () => {
  for (const name of FILES) {
    const items = load(name);
    const c = new Map<string, number>();
    for (const it of items) { const v = it.skeleton?.scene ?? '(未)'; c.set(v, (c.get(v) ?? 0) + 1); }
    const kinds = [...c.keys()].filter((k) => k !== '(未)' && k !== 'その他').length;
    const [top, cnt] = [...c.entries()].sort((a, b) => b[1] - a[1])[0];
    assert.ok(kinds >= SCENE_MIN_KINDS, `${name} scene種類${kinds}<${SCENE_MIN_KINDS}`);
    assert.ok(cnt / items.length <= SCENE_MAX_SHARE, `${name} scene最頻『${top}』${Math.round((cnt / items.length) * 100)}%>${SCENE_MAX_SHARE * 100}%`);
  }
});

test('走査性S＝情報源が2つ以上（一発照合で解けない・N4/N3ハード）', () => {
  for (const name of FILES) {
    if (!SCAN_HARD.has(name)) continue;
    const bad = load(name).map((it) => [it.id, sourcesOk(it)] as const).filter(([, w]) => w);
    assert.equal(bad.length, 0, `${name} 情報源不足: ${bad.slice(0, 5).map(([i, w]) => `${i}(${w})`).join(', ')}`);
  }
});

test('走査性C＝「選ぶ」の誘惑肢が図版由来（4択中≥3が図版に実在・N4/N3ハード）', () => {
  for (const name of FILES) {
    if (!SCAN_HARD.has(name)) continue;
    const bad = load(name).filter((it) => !choicesOk(it)).map((it) => it.id);
    assert.equal(bad.length, 0, `${name} 誘惑肢が図版外: ${bad.slice(0, 5).join(', ')}`);
  }
});
