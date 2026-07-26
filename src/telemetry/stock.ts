// 在庫(=その人にまだ一度も出していない問題の残り)を、大問単位で数える。
// 管理ダッシュボードの「レベル別 在庫」表用。[残り, 母数] の組で送る。
// 内訳: 文字語彙5大問＋文法3大問／読解4区分＋聴解5区分(＋それぞれの合計)／単語タブのドリル3種。
// 対象外: 書き取り・聞き取り・カード(1問ずつの習得記録を持たない＝残りが定義できない)。
import type { AppState } from '../store/state';
import type { Level } from '../engine/engine';
import { daimonUnitIds, MOJI_DAIMON, BUNPOU_DAIMON } from '../data/daimon';
import { readingIdsBySub, listeningIdsBySub } from '../data';
import { produceEligible, buildEligible, meaningEligible } from '../ladder/wordDrill';

/** [まだ触っていない数, 母数] */
function left(ids: string[], items: AppState['items']): [number, number] {
  let n = 0;
  for (const id of ids) if (!items[id]) n++;
  return [n, ids.length];
}

export function stockCounts(state: AppState, level: string): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  for (const d of [...MOJI_DAIMON, ...BUNPOU_DAIMON]) out[d] = left(daimonUnitIds(level as Level, d), state.items);
  // 読解/聴解は 大問(小区分)ごと。母数は学習＋模試の全設問=アプリが持つ問題数。
  // キー例: dokkai_naiyou_tan / choukai_kadai。合計は dokkai / choukai(旧 remaining と同じキー=SQL側で新しい方を優先)。
  const bySub = (prefix: string, map: Partial<Record<string, string[]>>) => {
    const all: string[] = [];
    for (const [sub, ids] of Object.entries(map)) {
      if (!ids?.length) continue;
      out[`${prefix}_${sub}`] = left(ids, state.items);
      all.push(...ids);
    }
    out[prefix] = left(all, state.items);
  };
  bySub('dokkai', readingIdsBySub(level as Level, true));
  bySub('choukai', listeningIdsBySub(level as Level, true));
  // 単語タブ(ドリル3種)。キーの接頭辞 w_ = 単語タブ。
  out.w_produce = left(produceEligible(level).map((v) => `${v.id}#produce`), state.items);
  out.w_gbuild = left(buildEligible(level).map((s) => `${s.g.id}#gbuild`), state.items);
  out.w_gmeaning = left(meaningEligible(level).map((g) => `${g.id}#gmeaning`), state.items);
  return out;
}
