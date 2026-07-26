# -*- coding: utf-8 -*-
"""言い換え類義335問の一意性【再】監査の workflow スクリプトを組み立てる。

背景(2026-07-17):
- 335問は「生成→反証→修理→再反証」を通して確定したが、反証は【1回だけ】だった。
- その後の用法監査で、同じ問題を2回判定させると結果が約41%食い違い、
  1回だけでは約12%を取りこぼしていたことが【実測】された。
  ＝335問の「非一意8%」は過小評価。取りこぼしがそのまま残っている。

方針:
- 生成しない。既存の誤答から【正解になってしまうもの】を削除するだけ(用法と同じ)。
  追加しない＝新しい第2の正解が構造的に入らない(修理段は実際に4件の新バグを作った)。
- 独立2パスの【和集合】。パスBは固定シードでシャッフルしてバッチを切り直す＝同じ問題が
  別の隣人と一緒に判定される。同一バッチの再実行より判定が相関しにくい(取りこぼしを拾いやすい)。
  ※「逆順にする」では駄目だった: 件数がバッチ幅で割り切れると(N3=150/30)バッチの集合が
    同じままで隣人が一切変わらない。実測して気づいた(assert で恒久的に防ぐ)。
- 誤答が3未満に落ちる問題は報告のみ(ユーザーが手で作成 or 問題ごと落とす)。

★選択肢は【番号(i)】で同定する。N4の選択肢はふりがな括弧を含むためテキスト照合は
  表記ゆれで空振りする危険がある(削除したつもりが削除されない=最悪の失敗)。
"""
import argparse
import io
import json
import os
import random
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "app", "content", "problems", "moji_goi")

COMMON = """
各問について次を判定せよ:
(a) answerOk: 正解(answer)が正解として成立するか(true/false)。成立しないなら answerWhy に理由。
(b) valid: 誤答のうち【正解になってしまう】ものを全て挙げる(=第2の正解)。
    各要素 {i, certainty, why}:  i=その誤答の番号(入力の d[].i をそのまま使う)
      certainty='clear'      … 普通に正解として通る。
      certainty='borderline' … ずれはあるが「だいたい同じ」の範囲に入りうる。
    ★基準は緩めに(疑わしきは borderline で拾う)。取りこぼすより拾いすぎる方がよい。
    ただし意味が明確に違う(頻度が違う/方向が逆/程度が違いすぎる/分野が違う)＝正しい誤答は
    valid に入れない。

必ず入力と同じ id・同じ順で全問返すこと(省略禁止)。
入力: """

P4 = """あなたはJLPT N4「言い換え類義」の一意性検査官(反証役)。目的は【誤答のはずが正解になっている選択肢】を暴くこと。厳しく判定せよ。

N4公式形式=提示文(stem)と「だいたい同じ意味の文」を選択肢の【文】から選ぶ。
正解(answer)=stemとだいたい同じ意味の文。誤答=stemとは意味が違う文。
※文中の( )はふりがな。判定には影響しない(読みの補助にのみ使う)。

★実際に見逃されていた水準(必ずこの水準を拾え):
 stem「町(まち)は活気(かっき)にあふれていた。」/ 正解「町は活力(かつりょく)にあふれていた。」に対し
  誤答「町は熱気(ねっき)にあふれていた。」    → 意味が重なる = clear
  誤答「町はエネルギーにあふれていた。」      → 意味が重なる = clear
 正しい誤答の例(validに入れない):
  誤答「町は静(しず)けさに包(つつ)まれていた。」→ 意味が逆
  誤答「町は人(ひと)であふれていた。」          → 人数の話で「活気」の意味を持たない
""" + COMMON

P3 = """あなたはJLPT N3「言い換え類義」の一意性検査官(反証役)。目的は【誤答のはずが正解になっている選択肢】を暴くこと。厳しく判定せよ。

N3公式形式=文(sentence)中の下線語(underline)と意味がいちばん近い【語】を選ぶ。
正解(answer)=下線語と意味が最も近い語。誤答=下線語とは意味が違う語。
判定法: 各誤答を文の下線語の位置に【代入】し、下線語の意味が保たれるかを見る。
少しでも保たれてしまうなら valid(=第2の正解)。

★実際に見逃されていた水準(必ずこの水準を拾え):
 文「ポスターを百枚(ひゃくまい)刷(す)った。」下線語=刷る / 正解「印刷する」に対し
  誤答「コピーする」→「ポスターを百枚コピーした」は自然で意味が重なる = clear
 文「町は活気にあふれていた。」下線語=活気 / 正解「活力」に対し
  誤答「熱気」「エネルギー」→ どちらも成立して重なる = clear
 正しい誤答の例(validに入れない):
  下線語=作法 / 誤答「命令」「記録」→ 意味が全く異なり代入しても通らない
""" + COMMON


def load(level):
    """verified の問題だけを監査対象にする(未検証の旧データは作り直し待ちで対象外)。"""
    p = os.path.join(SRC, f"synonym_{level}.json")
    d = json.load(io.open(p, encoding="utf-8"))
    items = [x for x in (d if isinstance(d, list) else d["items"]) if isinstance(x, dict)]
    out = []
    for x in items:
        if not x.get("verified"):
            continue
        # choices=誤答プール(answerを含まない)。保険で除外もしておく。
        d_ = [{"i": i, "t": c} for i, c in enumerate(x["choices"]) if c != x["answer"]]
        assert len(d_) == len(x["choices"]), f"{x['id']}: choices に answer が混入している"
        if level == "N4":
            out.append({"id": x["id"], "stem": x.get("stem") or x["sentence"], "answer": x["answer"], "d": d_})
        else:
            out.append({"id": x["id"], "sentence": x["sentence"], "underline": x["underline"],
                        "answer": x["answer"], "d": d_})
    return out


def chunk(xs, n):
    return [xs[i:i + n] for i in range(0, len(xs), n)]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch", type=int, default=30)
    ap.add_argument("-o", "--out", required=True)
    a = ap.parse_args()

    n4, n3 = load("N4"), load("N3")

    def shuffled(xs):
        """固定シード＝再現可能。パスBのバッチを切り直すために並びを崩す。"""
        ys = list(xs)
        random.Random(20260717).shuffle(ys)
        return ys

    jobs = []
    for tag, src4, src3 in (("A", n4, n3), ("B", shuffled(n4), shuffled(n3))):
        for b in chunk(src4, a.batch):
            jobs.append({"fmt": "N4", "pass": tag, "items": b})
        for b in chunk(src3, a.batch):
            jobs.append({"fmt": "N3", "pass": tag, "items": b})

    # ★パスBが本当に別文脈になっているかを実測して保証する。
    #   「逆順」で組んだ最初の版は、N3(150問)がバッチ幅30で割り切れるためバッチの集合が
    #   まったく変わらず、150問が同じ隣人のまま再判定される状態だった(=独立性が無い)。
    #   目視では気づけない。ここで落とす。
    def neighbours(tag):
        m = {}
        for j in jobs:
            if j["pass"] != tag:
                continue
            ids = [x["id"] for x in j["items"]]
            for i in ids:
                m[i] = frozenset(ids) - {i}
        return m
    na, nb = neighbours("A"), neighbours("B")
    same = [i for i in na if na[i] == nb.get(i)]
    assert not same, f"パスBの隣人が変わっていない問題が{len(same)}件ある(独立性が無い): {same[:3]}"

    print(f"言い換え: N4={len(n4)}問 / N3={len(n3)}問 = {len(n4) + len(n3)}問")
    print(f"独立2パス × {len(jobs) // 2}バッチ = {len(jobs)}体 (Opus high)")
    print(f"パスBで隣人が変わらない問題: 0件 (全{len(na)}問が別文脈で再判定される)")

    js = f'''export const meta = {{
  name: 'synonym-uniqueness-reaudit',
  description: '言い換え335問の一意性【再】監査: 独立2パスの和集合で第2の正解を暴く(削除のみ・生成しない)',
  phases: [{{ title: 'Verify', detail: '{len(jobs)}バッチ×Opus-high 反証(独立2パス)' }}],
}}

const JOBS = {json.dumps(jobs, ensure_ascii=False)}

const S = {{ type:'object', additionalProperties:false, required:['results'], properties:{{ results:{{ type:'array', items:{{
  type:'object', additionalProperties:false, required:['id','answerOk','valid'],
  properties:{{
    id:{{type:'string'}},
    answerOk:{{type:'boolean'}},
    answerWhy:{{type:'string'}},
    valid:{{ type:'array', items:{{ type:'object', additionalProperties:false, required:['i','certainty','why'],
      properties:{{ i:{{type:'integer'}}, certainty:{{type:'string'}}, why:{{type:'string'}} }} }} }}
  }} }} }} }} }}

const P = {{ N4: {json.dumps(P4, ensure_ascii=False)}, N3: {json.dumps(P3, ensure_ascii=False)} }}

phase('Verify')
const out = await pipeline(
  JOBS,
  (j, _o, i) => agent(P[j.fmt] + JSON.stringify(j.items),
    {{ label: `verify:${{j.fmt}}-${{j.pass}}#${{i}}`, phase: 'Verify', model: 'opus', effort: 'high', schema: S }}),
)
const results = out.filter(Boolean).flatMap((o) => (o && o.results) || [])
log(`言い換え再監査 完了: ${{results.length}}件の判定(335問×2パス=670が満点)`)
return {{ results }}
'''
    io.open(a.out, "w", encoding="utf-8", newline="\n").write(js)
    with io.open(a.out, "rb") as f:
        assert b"\r" not in f.read(), "CRが混入している(Workflowが拒否する)"
    print(f"→ {os.path.abspath(a.out)} ({len(js)} chars, LF確認済)")


if __name__ == "__main__":
    main()
