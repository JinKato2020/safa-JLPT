// 情報検索(joho) 骨組みパラメータ(q_type/notice/scene/figure_pattern)の番人。設問・場面・図表のワンパターン化を機械で止める。
// 設計正本＝md/09_読解.md「★情報検索 骨組みパラメータ(4軸)」。付与/点検ツール＝tools/joho_skeleton_tag.py。
//
// 【段階運用】存在チェック＝常時有効。バランス強制(偏り上限・型数下限・正誤必須・場面分類)は
//   新規作問で薄い型を足し終えてから有効化する（＝ RUN_BALANCE を true に）。それまでは skip。
//   現状は作問前ゆえ偏っており、ここを最初から有効にすると全体ビルドが赤になるため。聴解 skeletonBalance と同じ思想。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../../content/problems/dokkai/', import.meta.url));
type Skeleton = { q_type?: string; notice?: string; scene?: string; figure_pattern?: string; medium?: string };
type Item = { id: string; skeleton?: Skeleton; body?: unknown; figure?: unknown };
const FILES = ['joho_N5', 'joho_N4', 'joho_N3'];
function load(name: string): Item[] {
  return JSON.parse(readFileSync(DIR + name + '.json', 'utf8')).items as Item[];
}
// 字数(実効＝body＋figureの全テキスト・ルビ除く)。公式目標と帯[0.8×,1.5×]。全item必ず守る。
const CHARS: Record<string, number> = { joho_N5: 250, joho_N4: 400, joho_N3: 600 };
const CHAR_LO = 0.8, CHAR_HI = 1.5;
function collectText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(collectText).join('');
  if (v && typeof v === 'object') return Object.values(v as Record<string, unknown>).map(collectText).join('');
  return '';
}
function effChars(it: Item): number {
  const txt = collectText(it.body) + collectText(it.figure);
  return txt.replace(/（[^）]*）/g, '').replace(/\s/g, '').length;
}
const AXES = ['q_type', 'notice', 'scene', 'figure_pattern', 'medium'] as const;

// 作問で薄い型を足し終えたら true にして恒久ガードを起こす（md/09_読解.md 参照）。
const RUN_BALANCE = true;
const MONO_MAX = 0.55;                 // q_type/figure_pattern の偏り上限
const MIN_KINDS: Record<string, number> = { q_type: 4, scene: 6, figure_pattern: 3, notice: 2, medium: 3 };
const REQ_SEIGO = 5;                   // 各レベルの「正誤」最低数
// 公式素材(材料型)の必須：N3=広告/パンフレット・N4/N5=案内/お知らせ を各レベル最低数
const REQ_MEDIUM: Record<string, string[]> = { joho_N5: ['案内', 'お知らせ'], joho_N4: ['案内', 'お知らせ'], joho_N3: ['広告', 'パンフレット'] };
const REQ_MEDIUM_MIN = 3;

function dist(items: Item[], field: keyof Skeleton): Map<string, number> {
  const c = new Map<string, number>();
  for (const it of items) { const v = String(it.skeleton?.[field] ?? '(未)'); c.set(v, (c.get(v) ?? 0) + 1); }
  return c;
}

test('骨組み4軸は全itemに付いている(タグ漏れ=作問がメタ抜けで増える穴)', () => {
  for (const name of FILES) {
    for (const field of AXES) {
      const miss = load(name).filter((it) => !it.skeleton?.[field]).map((it) => it.id);
      assert.equal(miss.length, 0, `${name}.${field} 未付与: ${miss.slice(0, 5).join(',')}（tools/joho_skeleton_tag.py backfill）`);
    }
  }
});

test('字数が公式帯[0.8×〜1.5×]内=激短/冗長を止める(常時有効・必ず守る)', () => {
  for (const name of FILES) {
    const tgt = CHARS[name], lo = Math.floor(tgt * CHAR_LO), hi = Math.floor(tgt * CHAR_HI);
    const bad = load(name).map((it) => [it.id, effChars(it)] as const).filter(([, c]) => c < lo || c > hi);
    assert.equal(bad.length, 0, `${name} 字数帯外[${lo}-${hi}]: ${bad.slice(0, 5).map(([i, c]) => `${i}=${c}`).join(', ')}`);
  }
});

test('q_type/figure_pattern が過半(>55%)に偏らない=ワンパターン化の最低線', { skip: RUN_BALANCE ? false : '作問完了後に有効化' }, () => {
  for (const name of FILES) {
    const items = load(name);
    for (const field of ['q_type', 'figure_pattern'] as const) {
      const [top, cnt] = [...dist(items, field).entries()].sort((a, b) => b[1] - a[1])[0];
      assert.ok(cnt / items.length <= MONO_MAX, `${name}.${field} 偏り『${top}』${Math.round((cnt / items.length) * 100)}%>${MONO_MAX * 100}%`);
    }
  }
});

test('各軸で型が満遍なく存在する(種類数の下限)', { skip: RUN_BALANCE ? false : '作問完了後に有効化' }, () => {
  for (const name of FILES) {
    const items = load(name);
    for (const field of AXES) {
      const kinds = [...dist(items, field).keys()].filter((k) => k !== '(未)' && k !== 'その他');
      assert.ok(kinds.length >= MIN_KINDS[field], `${name}.${field} 型が${kinds.length}種<${MIN_KINDS[field]}種`);
    }
  }
});

test('「正誤(正しい記述)」が各レベルに規定数ある(本番頻出・必須)＋場面の未分類ゼロ', { skip: RUN_BALANCE ? false : '作問完了後に有効化' }, () => {
  for (const name of FILES) {
    const items = load(name);
    const seigo = dist(items, 'q_type').get('正誤') ?? 0;
    assert.ok(seigo >= REQ_SEIGO, `${name} 正誤 ${seigo}<${REQ_SEIGO}`);
    const other = dist(items, 'scene').get('その他') ?? 0;
    assert.equal(other, 0, `${name} scene 未分類『その他』${other}件`);
    for (const med of REQ_MEDIUM[name] ?? []) {
      const c = dist(items, 'medium').get(med) ?? 0;
      assert.ok(c >= REQ_MEDIUM_MIN, `${name} 公式素材『${med}』${c}<${REQ_MEDIUM_MIN}`);
    }
  }
});
