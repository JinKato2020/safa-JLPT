// バグ・不具合報告のクライアント境界(副作用)。SECURITY DEFINER 関数(submit_bug_report)経由で
// bug_reports へ1件記録する(docs/supabase/bug_reports.sql)。(B)送信はログイン必須・(C)連投20秒ガード。
// 版/OS/級/母語/問題ID/大問/画面/匿名ID を context に添える。結果は種類つきで返す(画面で出し分け)。
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

// 送信結果: ok=成功 / need_login=未ログイン(送信にはログインが必要) / too_soon=連投ガード(少し待つ) / error=その他失敗。
export type SubmitResult = 'ok' | 'need_login' | 'too_soon' | 'error';

/** 報告を送信。ログイン必須・連投20秒ガード。結果は種類つきで返す(画面でメッセージ出し分け)。 */
export async function submitBugReport(inp: BugReportInput): Promise<SubmitResult> {
  const msg = (inp.message ?? '').trim();
  if (!msg) return 'error';
  try {
    // (B) 送信はログイン必須。サーバーでも弾くが、無駄打ちを避けクライアントでも先に確認。
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 'need_login';
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
    if (!error) return 'ok';
    const m = String(error.message ?? '').toLowerCase();
    if (m.includes('too soon')) return 'too_soon';       // (C) 連投ガードにかかった
    if (m.includes('login required')) return 'need_login';
    return 'error';
  } catch {
    return 'error';
  }
}
