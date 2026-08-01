// 面別マスタリー統合復習 — ユニットid/大問/書き取り → 面(facet) 写像。
// 設計: docs/superpowers/specs/2026-08-01-unified-facet-review-design.md §3。
// 苦手度は単語×面(read/write/mean/listen/grammar)に一本化する。ここは「どのキーがどの面か」の唯一の正本。
import { KNOWLEDGE_BANK, GRAMMAR, VOCAB, KANJI, passageGrammarSetsFor } from '../data';

export type Facet = 'read' | 'write' | 'mean' | 'listen' | 'grammar';
export const FACETS: Facet[] = ['read', 'write', 'mean', 'listen', 'grammar'];

/** 面への反映対象。weight<1 = 補強(産出/書き取り等)＝正解時のみ控えめに底上げ・失敗で認識面を下げない。 */
export interface FacetTarget {
  itemId: string;
  facet: Facet;
  weight: number; // 1=認識(大問由来・失敗で減点), <1=補強(成功のみ)
}

// 大問(daimon) → 面。用法(usage)は「意味/用法」＝mean、組み立て(order)/文法形式/文章の文法＝grammar(設計§3.1)。
const DAIMON_FACET: Record<string, Facet> = {
  kanji_read: 'read',
  orthography: 'write',
  context: 'mean',
  synonym: 'mean',
  usage: 'mean',
  grammar_form: 'grammar',
  order: 'grammar',
  passage_grammar: 'grammar',
};

/** 大問キー → 面ターゲット(認識・weight1)。未知の大問は空。純関数(データ非依存)。 */
export function facetsForDaimon(itemId: string, daimon: string): FacetTarget[] {
  const facet = DAIMON_FACET[daimon];
  return facet ? [{ itemId, facet, weight: 1 }] : [];
}

// ── データ索引(bare id の逆引き用・モジュール読込時に一度だけ) ──
// 知識バンク kb-NNNNNN → daimon(usage/order/grammar_form)。
const KB_DAIMON = new Map<string, string>((KNOWLEDGE_BANK as { id: string; daimon: string }[]).map((b) => [b.id, b.daimon]));
// 文章の文法(passageGrammar)の全設問id(全級)→ grammar。
const PASSAGE_Q_IDS = new Set<string>(
  (['N5', 'N4', 'N3'] as const).flatMap((lv) => passageGrammarSetsFor(lv).flatMap((s) => s.questions.map((q) => q.id))),
);
// 素id(語彙/漢字/文法の生id)判定用。bare id がこれらなら「一度触れた学習項目」＝聞き取り/私の単語帳由来。
const VOCAB_IDS = new Set<string>(VOCAB.map((v) => v.id));
const KANJI_IDS = new Set<string>(KANJI.map((k) => k.char));
const GRAMMAR_IDS = new Set<string>(GRAMMAR.map((g) => g.id));

/**
 * 状態キー(ユニットid) → 面ターゲット列。設計§9の移行と§3の日常記録の唯一の写像。
 * - `<id>#kanji_read/#orthography/#context/#synonym` → 認識面
 * - `<id>#produce/#gbuild/#gmeaning` → 補強面(weight<1)
 * - bare `kb-NNNNNN` → バンクの daimon から面(認識)
 * - bare passageGrammar設問id → grammar(認識)
 * - bare 素id(語彙/漢字/文法) → listen(聞き取り/私の単語帳の履歴・設計§9は素id→listen)
 * - それ以外(読解/聴解長文の設問id等・スコープ外) → []
 */
export function facetsForUnit(unit: string): FacetTarget[] {
  const hash = unit.lastIndexOf('#');
  if (hash >= 0) {
    const itemId = unit.slice(0, hash);
    const suffix = unit.slice(hash + 1);
    switch (suffix) {
      case 'produce':
        return [{ itemId, facet: 'mean', weight: 0.85 }, { itemId, facet: 'read', weight: 0.6 }];
      case 'gbuild':
      case 'gmeaning':
        return [{ itemId, facet: 'grammar', weight: 0.85 }];
      default:
        return facetsForDaimon(itemId, suffix);
    }
  }
  // bare id
  const kbDaimon = KB_DAIMON.get(unit);
  if (kbDaimon) return facetsForDaimon(unit, kbDaimon);
  if (PASSAGE_Q_IDS.has(unit)) return [{ itemId: unit, facet: 'grammar', weight: 1 }];
  if (VOCAB_IDS.has(unit) || KANJI_IDS.has(unit) || GRAMMAR_IDS.has(unit)) return [{ itemId: unit, facet: 'listen', weight: 1 }];
  return [];
}

/** 書き取り(漢字1字)の合否 → write(副 read) を底上げ(補強・成功のみ)。設計§3.3/§6。 */
export function facetsForKakitori(char: string): FacetTarget[] {
  return [{ itemId: char, facet: 'write', weight: 0.85 }, { itemId: char, facet: 'read', weight: 0.6 }];
}

/** 語レベルの聞き取り出題の記録 → listen(認識)。呼び出し側が listen 文脈と分かる時に使う(bare素idの曖昧回避)。 */
export function facetsForListen(itemId: string): FacetTarget[] {
  return [{ itemId, facet: 'listen', weight: 1 }];
}
