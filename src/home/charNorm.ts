// ホーム画面キャラの実寸差を吸収する正規化メタ(アルファbbox実測・tools不要で固定)。
// 各PNGはキャンバス寸法もキャラの占有領域も異なるため、そのまま contain すると見かけの大きさがバラバラになる。
// 桜=「hair_long のキャラ高さ」、柴=「柴1のキャラ面積」を基準に揃えるための係数。
//
// aspect  = canvasW / canvasH … 表示枠をPNGのキャンバス比に合わせ、contain のレターボックス(余白)を無くす
// hfrac   = charH   / canvasH … キャラ本体の高さがキャンバス高に占める割合(桜=高さ基準の正規化に使用)
// sizeFrac= sqrt(wfrac*hfrac) … キャラ本体の面積充填率の幾何平均(柴=面積基準の正規化に使用)
// 数値は assets の実測(charNorm 生成メモ参照)。PNGを差し替えたら測り直すこと。

export const HAIR_NORM: Record<string, { aspect: number; hfrac: number }> = {
  hair_long: { aspect: 0.6040, hfrac: 0.9620 }, // 基準
  hair_short: { aspect: 0.6667, hfrac: 0.9460 },
  hair_halfup: { aspect: 0.6667, hfrac: 1.0000 },
  hair_low_twintail: { aspect: 0.6667, hfrac: 0.9935 },
  hair_sidepony: { aspect: 0.6667, hfrac: 0.9844 },
  hair_hime: { aspect: 0.6667, hfrac: 0.9440 },
  hair_wave: { aspect: 0.6667, hfrac: 0.9355 },
  hair_braid_half: { aspect: 0.6667, hfrac: 0.9408 },
  hair_low_pony: { aspect: 0.6667, hfrac: 0.9668 },
  hair_side_braid: { aspect: 0.6667, hfrac: 0.9076 },
};

export const DOG_NORM: Record<string, { aspect: number; sizeFrac: number }> = {
  pet_shiba1: { aspect: 0.8679, sizeFrac: 0.9612 }, // 基準
  pet_shiba2: { aspect: 0.7427, sizeFrac: 0.9682 },
  pet_shiba3: { aspect: 0.7454, sizeFrac: 1.0000 },
  pet_shiba4: { aspect: 0.7918, sizeFrac: 1.0000 },
  pet_shiba5: { aspect: 0.8742, sizeFrac: 1.0000 },
  pet_shiba6: { aspect: 1.0308, sizeFrac: 1.0000 },
  pet_kuro1: { aspect: 0.8036, sizeFrac: 1.0000 },
  pet_kuro2: { aspect: 0.6988, sizeFrac: 1.0000 },
  pet_kuro3: { aspect: 0.7534, sizeFrac: 1.0000 },
  pet_kuro4: { aspect: 0.8345, sizeFrac: 1.0000 },
  pet_kuro5: { aspect: 0.9404, sizeFrac: 1.0000 },
  pet_kuro6: { aspect: 1.0547, sizeFrac: 1.0000 },
};

// 基準(この2値を変えると桜・柴の全体スケールが動く)。
// HAIR_REF_CHAR_H = 画面幅×係数 = hair_long の現行キャラ高さ(0.448×0.962)。全髪型をこの高さに合わせる。
export const HAIR_REF_CHAR_H = 0.431;
// DOG_BASE_SIZE = 画面幅×係数 = 柴1キャラの現行 sqrt(面積)。柴1=等倍の基準サイズ。
export const DOG_BASE_SIZE = 0.1788;
// 柴の成長基準 = 柴1の homeScale。growth = homeScale / DOG_BASE_SCALE(柴1=1.0・番号↑で拡大)。
export const DOG_BASE_SCALE = 0.5;
