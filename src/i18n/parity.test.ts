// 【仕組み・番人／ユーザー厳命 2026-08-14→2026-09-07 全11言語へ拡張】新規UI文字列は ja だけでなく
// 全表示言語(en/ne/bn/id/ko/my/th/vi/zh/zh2)に必ず訳を用意する。ja にキーが有って或る言語に無いと
// 「その言語なのに日本語が出る」バグになる(相対位置カード・ポスター朗読で実際に発生)。
// この番人が「未訳キー」と「プレースホルダ({n}等)の欠落/余分」を検出してビルドを止める。
// 追加UIの手順: ja.json にキー追加 → en.json・ne.json に訳を書く → `python tools/trans_i18n.py --fill` で
//   他8言語(zh2=OpenCC)を自動翻訳(build.ps1が検証前に自動実行)。旧「他8言語はバックログ=対象外」は失効。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ja from './ja.json';
import en from './en.json';
import ne from './ne.json';
import bn from './bn.json';
import id from './id.json';
import ko from './ko.json';
import my from './my.json';
import th from './th.json';
import vi from './vi.json';
import zh from './zh.json';
import zh2 from './zh2.json';

const REQUIRED: Record<string, Record<string, string>> = {
  en: en as Record<string, string>,
  ne: ne as Record<string, string>,
  bn: bn as Record<string, string>,
  id: id as Record<string, string>,
  ko: ko as Record<string, string>,
  my: my as Record<string, string>,
  th: th as Record<string, string>,
  vi: vi as Record<string, string>,
  zh: zh as Record<string, string>,
  zh2: zh2 as Record<string, string>,
};
const JA = ja as Record<string, string>;

function placeholders(s: string): Set<string> {
  return new Set(s.match(/\{\w+\}/g) ?? []);
}

for (const [lang, dict] of Object.entries(REQUIRED)) {
  test(`i18n: ${lang} は ja の全キーを網羅(新規UIは英語・ネパール語を同時作成)`, () => {
    const missing = Object.keys(JA).filter((k) => !(k in dict));
    assert.deepEqual(
      missing,
      [],
      `${lang}.json に未訳キーがある(ja にあるのに ${lang} に無い)。新規UIは ja/en/ne を同時に用意すること。未訳: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' …' : ''}`,
    );
  });

  test(`i18n: ${lang} のプレースホルダが ja と一致({n}等の欠落・余分を防ぐ)`, () => {
    const bad: string[] = [];
    for (const k of Object.keys(JA)) {
      if (!(k in dict)) continue; // 未訳は上のテストで検出
      const a = placeholders(JA[k]);
      const b = placeholders(dict[k]);
      for (const p of a) if (!b.has(p)) bad.push(`${k}: ja の ${p} が ${lang} に無い`);
      for (const p of b) if (!a.has(p)) bad.push(`${k}: ${lang} に余分な ${p}`);
    }
    assert.deepEqual(bad, [], bad.join(' / '));
  });
}
