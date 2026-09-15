// バグ・不具合報告のクライアント境界(副作用)。SECURITY DEFINER 関数(submit_bug_report)経由で
// bug_reports へ1件記録する(docs/supabase/bug_reports.sql)。未ログインでも送れる(anon 実行可)。
// 版/OS/級/母語/問題ID/大問/画面/匿名ID を context に添える。通信失敗・空文は握って false を返す。
import { Platform } from 'react-native';
import * as Application from 'expo-application';
import { supabase } from '../config/supabase';
import { getDeviceRef } from '../referral/referralClient';

export type BugKind = 'bug' | 'content' | 'other';

export type BugReportInput = {
  message: string;
  kind: BugKind;
  level?: string;   // 目標級(N5/N4/N3)
  uiLang?: string;  // 母語(UI言語)
  itemId?: string;  // 報告対象の問題ID(問題画面から開いた時)
  daimon?: string;  // 大問名(問題画面のヘッダー)
  screen?: string;  // 発生画面名
};

/** 報告を送信。成功で true、失敗(空文・通信断・関数拒否)で false。 */
export async function submitBugReport(inp: BugReportInput): Promise<boolean> {
  const msg = (inp.message ?? '').trim();
  if (!msg) return false;
  try {
    const anon = await getDeviceRef().catch(() => '');
    const context = {
      app: Application.nativeApplicationVersion ?? '',
      build: Application.nativeBuildVersion ?? '',
      platform: `${Platform.OS} ${String(Platform.Version ?? '')}`.trim(),
      level: inp.level ?? '',
      uiLang: inp.uiLang ?? '',
      itemId: inp.itemId ?? '',
      daimon: inp.daimon ?? '',
      screen: inp.screen ?? '',
      anon,
    };
    const { error } = await supabase.rpc('submit_bug_report', {
      p_message: msg.slice(0, 4000),
      p_kind: inp.kind,
      p_context: context,
    });
    return !error;
  } catch {
    return false;
  }
}
