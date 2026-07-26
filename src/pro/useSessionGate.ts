// 練習を始める前の共通ゲート。回数の消費をここ1か所に集約する(画面ごとに書かない)。
// 使い方は各練習画面の冒頭で begin() を1回だけ呼ぶ(Task 4 の定型ブロック)。
import { useState } from 'react';
import { useAppState, useAppActions } from '../store/store';
import { quotaFor, type Quota } from './dailyQuota';
import { GATING_ENABLED } from './gating';

export interface SessionGate {
  quota: Quota;         // 表示用(あと◯回)
  limited: boolean;     // 上限に当たって開始できなかった
  begin: () => boolean; // true=練習を始めてよい / false=上限
}

export function useSessionGate(): SessionGate {
  const state = useAppState();
  const { consumeSession } = useAppActions();
  const [limited, setLimited] = useState(false);
  const quota = quotaFor(state, Date.now());

  function begin(): boolean {
    if (GATING_ENABLED && !quotaFor(state, Date.now()).canPractice) {
      setLimited(true);
      return false;
    }
    consumeSession(); // OFFの間も回数だけは数えておく(Phase 1 でONにした時に挙動が変わらない)
    return true;
  }

  return { quota, limited, begin };
}
