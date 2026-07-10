// カバー率 = 受容済アイテム数 / 在庫総数(A案・設計書 §5)。両タブの正答が受容済へ到達させる。
import { FacetState } from './mastery';
import { isReceived } from './srs';

export function coverageRate(inventoryCount: number, states: FacetState[]): number {
  if (inventoryCount <= 0) return 0;
  let received = 0;
  for (const s of states) if (isReceived(s)) received += 1;
  return received / inventoryCount;
}
