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
  python tools/i18n_backlog.py --drift         # 全言語で「訳は有るが日本語が後から変わった=陳腐化」キーを一覧
  python tools/i18n_backlog.py --drift --lang ne  # 指定言語だけ陳腐化を一覧(ja値つき=訳し直しの作業リスト)

陳腐化(--drift)の仕組み: git履歴で「その訳を最後に書いたコミット時点の日本語」と「今の日本語」を
  1キーずつ突き合わせ、変わっているものを検出する(未訳/幽霊とは別軸)。要 git 履歴。
"""
import io, os, sys, json, glob, argparse, subprocess

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
I18N = os.path.join(ROOT, "src", "i18n")


def load(lang):
    return json.load(io.open(os.path.join(I18N, "%s.json" % lang), encoding="utf-8"))


def langs():
    return sorted(os.path.splitext(os.path.basename(p))[0] for p in glob.glob(os.path.join(I18N, "*.json")))


# --- 陳腐化検出(git) ---------------------------------------------------------
_show_cache = {}


def _git_show_json(commit, rel):
    """<commit>:<rel> の JSON を辞書で返す(取得不可/不正は None)。コミット単位でキャッシュ。"""
    key = (commit, rel)
    if key not in _show_cache:
        r = subprocess.run(["git", "show", "%s:%s" % (commit, rel)], cwd=ROOT,
                           stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        try:
            _show_cache[key] = json.loads(r.stdout.decode("utf-8")) if r.stdout else None
        except Exception:
            _show_cache[key] = None
    return _show_cache[key]


def _commits_for(rel):
    """rel を変更したコミットを新しい順に。"""
    r = subprocess.run(["git", "log", "--format=%H", "--", rel], cwd=ROOT,
                       stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    return [h for h in r.stdout.decode("utf-8").split() if h]


def drift_keys(lang, ja_now):
    """その言語で「訳を書いた当時の ja」と現在の ja が食い違うキー(=訳し直し対象)を返す。"""
    rel_l, rel_ja = "src/i18n/%s.json" % lang, "src/i18n/ja.json"
    cur = load(lang)
    commits = _commits_for(rel_l)
    if not commits:
        return []
    out = []
    for k, v in cur.items():
        if k not in ja_now:
            continue  # 幽霊キーは --stale の担当
        set_commit = commits[0]
        for c in commits:  # 新しい→古い。現行値と一致する最も古いコミット=その訳を書いた時点
            snap = _git_show_json(c, rel_l) or {}
            if snap.get(k, object()) == v:
                set_commit = c
            else:
                break
        ja_then = _git_show_json(set_commit, rel_ja) or {}
        if k in ja_then and ja_then[k] != ja_now[k]:
            out.append(k)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", help="この言語の未訳キー(ja値つき)を一覧")
    ap.add_argument("--stale", action="store_true", help="jaに無い幽霊キーを一覧")
    ap.add_argument("--drift", action="store_true", help="訳は有るが日本語が後から変わった陳腐化キーを一覧(git履歴を使用)")
    a = ap.parse_args()

    ja = load("ja")
    ja_keys = set(ja)
    others = [l for l in langs() if l != "ja"]

    if a.drift:
        targets = [a.lang] if a.lang else others
        total = 0
        for l in targets:
            d = drift_keys(l, ja)
            total += len(d)
            if d:
                print("## %s 陳腐化(日本語が変わった既訳) %d 件%s:" % (l, len(d), "（ja値=訳し直しの元）" if a.lang else ""))
                for k in d:
                    if a.lang:
                        print("%s\t%s" % (k, json.dumps(ja[k], ensure_ascii=False)))
                    else:
                        print("  " + k)
        if total == 0:
            print("陳腐化なし＝既訳はすべて現在の日本語に一致。")
        else:
            print("\n※ 訳し直しは:  python tools/i18n_backlog.py --drift --lang <lang>  で ja値つき作業リストを出す。")
        return

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
    print("※ 既訳の陳腐化(日本語が後から変わった分)は:  python tools/i18n_backlog.py --drift  で検出。")


if __name__ == "__main__":
    main()
