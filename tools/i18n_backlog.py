#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""i18n 翻訳バックログ追跡（ja=正本）。

方針（ユーザー厳命）:
  - 新規UI文字列は ja.json だけに入れる。他言語は t() が ja へ自動フォールバック。
  - 他言語への翻訳は「ユーザーの明示指示がある時だけ」まとめて実施する。
    仕様変更が頻繁なため、都度・先回りの翻訳は禁止（無駄になる）。
  - このスクリプトは「未訳キー＝あとで一括翻訳する対象」を可視化するだけ。翻訳はしない。

使い方:
  python tools/i18n_backlog.py                # 各言語の未訳/余剰キー数サマリ
  python tools/i18n_backlog.py --lang ne      # 指定言語の未訳キー(ja値つき)を一覧＝翻訳指示が来た時の作業リスト
  python tools/i18n_backlog.py --stale        # ja に無いのに他言語に残る「幽霊キー」を一覧
"""
import io, os, sys, json, glob, argparse

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
I18N = os.path.join(ROOT, "src", "i18n")


def load(lang):
    return json.load(io.open(os.path.join(I18N, "%s.json" % lang), encoding="utf-8"))


def langs():
    return sorted(os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(I18N, "*.json")))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", help="この言語の未訳キー(ja値つき)を一覧")
    ap.add_argument("--stale", action="store_true", help="jaに無い幽霊キーを一覧")
    a = ap.parse_args()

    ja = load("ja")
    ja_keys = set(ja)
    others = [l for l in langs() if l != "ja"]

    if a.lang:
        d = load(a.lang)
        missing = [k for k in ja if k not in d]
        print("# %s 未訳 %d 件（ja値。翻訳指示が来たら、この値を訳して %s.json へ）" % (a.lang, len(missing), a.lang))
        for k in missing:
            print("%s\t%s" % (k, json.dumps(ja[k], ensure_ascii=False)))
        return

    if a.stale:
        for l in others:
            d = load(l)
            stale = [k for k in d if k not in ja_keys]
            if stale:
                print("## %s に余剰(ja に無い) %d 件:" % (l, len(stale)))
                for k in stale:
                    print("  " + k)
        print("(幽霊キーは ja から消した時の掃除対象。翻訳とは別。)")
        return

    print("i18n バックログ（ja=%d キーが正本）" % len(ja_keys))
    print("lang  translated  missing  stale")
    for l in others:
        d = load(l)
        keys = set(d)
        missing = len(ja_keys - keys)
        stale = len(keys - ja_keys)
        done = len(ja_keys & keys)
        print("%-4s  %9d  %7d  %5d" % (l, done, missing, stale))
    print("\n※ missing は ja へ自動フォールバック中＝表示は壊れない。")
    print("※ 一括翻訳の指示が来たら:  python tools/i18n_backlog.py --lang <lang>  で作業リストを出す。")


if __name__ == "__main__":
    main()
