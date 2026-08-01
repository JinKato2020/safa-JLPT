// Phase4: 面(facet)→ 既存の出題を選ぶ。設計 §4.3。
// (itemId, facet) を questionForUnit が描ける unit へ逆写像し、既存の大問出題を流用する。
// 返す Question の itemId は unit なので、UI が quizAnswer(unit) すれば items＋面の両方へ自然に反映される。
import { questionForUnit } from '../data/daimon';
import { VOCAB, GRAMMAR, KNOWLEDGE_BANK } from '../data';
import type { Question, Rng } from '../quiz/quiz';
import type { Facet } from './facetMap';
import type { ReviewPick } from './selectReview';

const VOCAB_IDS = new Set(VOCAB.map((v) => v.id));
const GRAMMAR_IDS = new Set(GRAMMAR.map((g) => g.id));
// 知識バンクidの全集合(用法=usg… / 組み立て・文法形式=kb… など接頭辞が混在するため id 集合で判定)。
const BANK_IDS = new Set((KNOWLEDGE_BANK as { id: string }[]).map((b) => b.id));

/** (itemId, facet) → questionForUnit が描ける unit。描けない面(語聞き取り/漢字書き取り等・後続フェーズ)は null。 */
export function unitForPick(itemId: string, facet: Facet, rng: Rng): string | null {
  if (BANK_IDS.has(itemId)) return itemId; // 面が語/文法pointに解決できなかったバンク問題は固定問題をそのまま。
  if (VOCAB_IDS.has(itemId)) {
    if (facet === 'read') return `${itemId}#kanji_read`;
    if (facet === 'write') return `${itemId}#orthography`;
    if (facet === 'mean') return rng() < 0.5 ? `${itemId}#context` : `${itemId}#synonym`;
    return null; // listen(語レベル聞き取り)は音声出題=後続で連携
  }
  if (GRAMMAR_IDS.has(itemId)) {
    if (facet === 'grammar') return `${itemId}#grammar_form`;
    return null;
  }
  return null; // 漢字char(書き取り=Phase7)・passage設問等は当面スキップ
}

/** 復習1問を生成。描けない面は null(呼び出し側で読み飛ばし・別の pick で補う)。 */
export function reviewQuestion(pick: ReviewPick, rng: Rng): Question | null {
  const unit = unitForPick(pick.itemId, pick.facet, rng);
  if (!unit) return null;
  return questionForUnit(unit, rng);
}
