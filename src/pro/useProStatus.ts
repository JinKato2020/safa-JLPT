// Pro状態の“リアクティブ”版。proStatus（純関数）に加えて、端末ローカルの campaignFlag の
// 変化でも画面が再描画されるようにする。
// ★これが無いと「const isPro = proStatus(...)」の画面はフラグ変化に追従せず、
//   例: キャンペーンで実質Proなのに「Proにする」ボタン/模試🔒 が残る“表示の矛盾”が起きる。
import { useSyncExternalStore } from 'react';
import { useAppState } from '../store/store';
import { proStatus, type ProStatus } from './entitlement';
import { subscribeCampaign, isCampaignProActive } from './campaignFlag';
import { subscribeSchool, getSchoolLicenseUntil } from './schoolFlag';

/** 画面で Pro 判定を使う時はこれを使う（appState＋キャンペーン＋学校ライセンスの各変化で再描画）。 */
export function useProStatus(): ProStatus {
  const state = useAppState();
  useSyncExternalStore(subscribeCampaign, isCampaignProActive); // campaign フラグ変化で再描画させる
  useSyncExternalStore(subscribeSchool, getSchoolLicenseUntil); // 学校ライセンス変化（名簿から外れた等）で再描画
  return proStatus(state, Date.now());
}
