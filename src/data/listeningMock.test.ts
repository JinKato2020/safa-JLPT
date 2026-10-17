// 聴解5大問(課題理解・ポイント理解・概要理解・発話表現・即時応答)の模試専用プール(pool='mock'・初見)を守る番人。
// 【このテストが守るもの】模試の聴解が「公式同等の構成」を保つこと＝
//  ・各級×小区分の本文数/設問数(公式出題数×10回) ・id一意 ・id帯 N{lv}-C-{K|P|G|H|S}-0[7-9]##(0701-1000模試帯)
//  ・内容系(kadai/point/gaiyou)=4択相異・answerIndex0[描画時シャッフル] ・音声選択系(hatsuwa/sokuji)=3択相異・answerIndex0..2[音声焼込み=シャッフル不可]
//  ・listeningMockItemsForSub がプールと一致。音声(mp3)は後日TTS(このテストは音声実体を要求しない)。
import test from 'node:test';
import assert from 'node:assert/strict';
import { LISTENING_MOCK, listeningMockItemsForSub, listeningSubtype, type ListeningSubtype } from './index.ts';

// (level,subtype)→[本文数,設問数]。公式出題数×10回(choukai-mock-inflight ▶公式出題数×10)。
const EXPECT: Record<ListeningSubtype, Record<string, [number, number]>> = {
  kadai: { N5: [70, 70], N4: [80, 80], N3: [60, 60] },
  point: { N5: [60, 60], N4: [70, 70], N3: [60, 60] },
  gaiyou: { N3: [30, 30] },
  hatsuwa: { N5: [50, 50], N4: [50, 50], N3: [40, 40] },
  sokuji: { N5: [60, 60], N4: [80, 80], N3: [90, 90] },
};
const SUBCHAR: Record<ListeningSubtype, string> = { kadai: 'K', point: 'P', gaiyou: 'G', hatsuwa: 'H', sokuji: 'S' };
// 選択肢方式(公式準拠): 課題/ポイント=テキスト4択(表示時シャッフル・正本answerIndex0)。
//   概要/発話/即時=選択肢を音声で読む=番号のみ・シャッフル不可・正解位置は音声に焼込み(answerIndexは0..nch-1で分散)。
//   概要=4択(番号1-4)/発話・即時=3択(番号1-3)。
const CFG: Record<ListeningSubtype, { ac: boolean; nch: number }> = {
  kadai: { ac: false, nch: 4 },
  point: { ac: false, nch: 4 },
  gaiyou: { ac: true, nch: 4 },
  hatsuwa: { ac: true, nch: 3 },
  sokuji: { ac: true, nch: 3 },
};

for (const sub of Object.keys(EXPECT) as ListeningSubtype[]) {
  for (const [lv, [nItems, nQ]] of Object.entries(EXPECT[sub])) {
    test(`聴解模試 ${sub} ${lv}: 本文${nItems}/設問${nQ}(公式×10回)`, () => {
      const pool = listeningMockItemsForSub(lv as never, sub);
      assert.equal(pool.length, nItems, `${sub} ${lv}: 本文数`);
      assert.equal(pool.reduce((s, p) => s + p.questions.length, 0), nQ, `${sub} ${lv}: 設問数`);
    });
  }
}

test('聴解模試: 合計800本文/800設問・id一意・choices/answerIndex/id帯/subtype/audio', () => {
  assert.equal(LISTENING_MOCK.length, 800, '総本文数');
  const ids = new Set<string>();
  const qids = new Set<string>();
  let totalQ = 0;
  for (const it of LISTENING_MOCK) {
    const sub = listeningSubtype(it);
    assert.ok(SUBCHAR[sub], `${it.id}: 未知subtype ${sub}`);
    // id帯: 模試は 0701-1000(listening-id-band-convention)。0[7-9]## で担保。
    assert.ok(new RegExp(`^${it.level}-C-${SUBCHAR[sub]}-0[7-9]\\d{2}$`).test(it.id), `${it.id}: id帯が不正(0701-1000模試帯)`);
    assert.ok(!ids.has(it.id), `${it.id}: 本文id重複`);
    ids.add(it.id);
    assert.ok(it.audio, `${it.id}: audio=trueでない(模試聴解は全問音声)`);
    const { ac, nch } = CFG[sub];
    assert.equal(!!it.audioChoices, ac, `${it.id}: audioChoicesは${ac ? '概要/発話/即時でtrue' : '課題/ポイントでfalse'}`);
    for (const q of it.questions) {
      totalQ++;
      assert.ok(!qids.has(q.id), `${q.id}: 設問id重複`);
      qids.add(q.id);
      assert.equal(q.choices.length, nch, `${q.id}: ${nch}択でない`);
      assert.equal(new Set(q.choices).size, nch, `${q.id}: 選択肢が重複`);
      if (ac) assert.ok(q.answerIndex >= 0 && q.answerIndex < nch, `${q.id}: 音声選択(番号のみ)のanswerIndex範囲外(0..${nch - 1})`);
      else assert.equal(q.answerIndex, 0, `${q.id}: テキスト4択の正解はchoices[0](描画時シャッフル)`);
    }
  }
  assert.equal(totalQ, 800, '総設問数');
});
