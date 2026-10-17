# -*- coding: utf-8 -*-
"""用法の一意性検査(Sub-Plan E)の workflow スクリプトを組み立てる。

方針(ユーザー確定 2026-07-17):
- 生成しない。既存の誤答6個から【正しい用法になってしまうもの】を削除するだけ。
  追加しない＝新しい第2の正解が構造的に入らない(言い換えの修理段は4件の新バグを作った)。
- 誤答が3未満になった問題は報告する(ユーザーが誤答を手で作成する)。
- 正解自体が用法として成立しない場合(bad_answer)も報告する(保険・追加コスト0)。
- 出題は build4Choices が生き残りから毎回3抽出(実装済・変更不要)。
"""
import argparse
import io
import json
import os
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "app", "content", "problems", "moji_goi")

PROMPT = """あなたはJLPT「用法」の一意性検査官(反証役)。目的は【誤答のはずが正しい用法になっている選択肢】を暴くこと。厳しく判定せよ。

用法の問題=「対象語(word)の使い方として最もよいものはどれか」を選ぶ。
正解=その語の正しい用法の文。誤答=【その語では言わない】文(他の語になら言える)。

各問について次を判定せよ:
(a) answerOk: 正解の文が、その語の用法として自然に成立するか(true/false)。
    自他の誤り(スープを冷めて)・格の誤り・明らかに不自然 なら false。
(b) valid: 誤答のうち【その語の用法として成立してしまう】文を全て挙げる(=第2の正解)。
    各要素 {text, certainty, why}:
      certainty='clear'      … その語で普通に言う。明確に正しい用法。
      certainty='borderline' … 言えなくはないが、別の語の方が自然。
    ★基準は緩めに(疑わしきは borderline として拾う)。取りこぼすより拾いすぎる方がよい。
    ただし「その語では言わない(他の語なら言える)」＝正しい誤答は valid に入れない。

★実際に見逃されていた例(必ずこの水準を拾え):
 対象語「探す」/ 正解「いなくなった犬を町じゅう探した」に対し
  誤答「川できれいな石を一つ探して、持ち帰った」→ 普通に言う = clear
  誤答「町じゅう歩いて、やっと安い店を探した」  → 普通に言う = clear
  誤答「知らないかんじの読み方をじしょで探した」→ 言えるが「調べた」が自然 = borderline
 正しい誤答の例:
  誤答「行き方をえきいんに探した」→「〜に探す」とは言わない(聞いた) = validに入れない
  誤答「教室に何人いるか、ひとりずつ探した」→ 数える意味では言わない = validに入れない

必ず入力と同じ id・同じ順で全問返すこと(省略禁止)。
入力: """


def load(level):
    p = os.path.join(SRC, f"usage_{level}.json")
    d = json.load(io.open(p, encoding="utf-8"))
    items = [x for x in (d if isinstance(d, list) else d["items"]) if isinstance(x, dict)]
    return [{"id": x["id"], "word": x["stem"], "answer": x["answer"],
             "distractors": [c for c in x["choices"] if c != x["answer"]]} for x in items]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--batch", type=int, default=30)
    ap.add_argument("-o", "--out", required=True)
    a = ap.parse_args()

    allitems = load("N4") + load("N3")
    batches = [allitems[i:i + a.batch] for i in range(0, len(allitems), a.batch)]
    print(f"用法: {len(allitems)}問 (N4=153/N3=150) / {len(batches)}バッチ = {len(batches)}体")

    js = f'''export const meta = {{
  name: 'usage-uniqueness-audit',
  description: '用法303問の一意性監査(Sub-Plan E): 正用になってしまう誤答を検出する(削除のみ・生成しない)',
  phases: [{{ title: 'Verify', detail: '{len(batches)}バッチ×Opus-high 反証' }}],
}}

const BATCHES = {json.dumps(batches, ensure_ascii=False)}

const S = {{ type:'object', additionalProperties:false, required:['results'], properties:{{ results:{{ type:'array', items:{{
  type:'object', additionalProperties:false, required:['id','answerOk','valid'],
  properties:{{
    id:{{type:'string'}},
    answerOk:{{type:'boolean'}},
    answerWhy:{{type:'string'}},
    valid:{{ type:'array', items:{{ type:'object', additionalProperties:false, required:['text','certainty','why'],
      properties:{{ text:{{type:'string'}}, certainty:{{type:'string'}}, why:{{type:'string'}} }} }} }}
  }} }} }} }} }}

const P = {json.dumps(PROMPT, ensure_ascii=False)}

phase('Verify')
const out = await pipeline(
  BATCHES,
  (b, _o, i) => agent(P + JSON.stringify(b),
    {{ label: `verify:usage#${{i}}`, phase: 'Verify', model: 'opus', effort: 'high', schema: S }}),
)
const results = out.filter(Boolean).flatMap((o) => (o && o.results) || [])
log(`用法監査 完了: ${{results.length}}問`)
return {{ results }}
'''
    io.open(a.out, "w", encoding="utf-8", newline="\n").write(js)
    with io.open(a.out, "rb") as f:
        assert b"\r" not in f.read(), "CRが混入している(Workflowが拒否する)"
    print(f"→ {os.path.abspath(a.out)} ({len(js)} chars, LF確認済)")


if __name__ == "__main__":
    main()
