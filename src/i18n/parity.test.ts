// 【仕組み・番人／ユーザー厳命 2026-08-14】新規UI文字列は ja だけでなく en・ne も必ず同時に用意する。
// en(英語)/ne(ネパール語)は母語として常時選択でき、UIをその言語で表示する。ja にキーが有って
// en/ne に無いと「その言語なのに日本語が出る」バグになる(相対位置カードで実際に発生)。
// この番人が「未訳キー」と「プレースホルダ({n}等)の欠落/余分」を検出してビルドを止める。
// ※ 他8言語(bn/id/ko/my/th/vi/zh)はバックログ運用(tools/i18n_backlog.py・指示時のみ一括翻訳)＝対象外。
// 追加UIの手順: ja.json にキー追加 → 同時に en.json・ne.json にも訳を追加(英語とネパール語を必ず作る)。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ja from './ja.json';
import en from './en.json';
import ne from './ne.json';

const REQUIRED: Record<string, Record<string, string>> = {
  en: en as Record<string, string>,
  ne: ne as Record<string, string>,
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
