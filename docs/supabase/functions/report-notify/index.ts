// 新しい通報を、開発者(管理者=あなた自身)のスマホへプッシュ通知する(見逃し防止・24時間対処のため)。
// 通報したユーザーのアプリが friend_report 成功直後に呼ぶ:
//   supabase.functions.invoke('report-notify', { body: { reported, reason } })
//  ・通報者は JWT で特定(認証必須)。なりすまし不可。
//  ・管理者 = env ADMIN_USER_ID(あなた自身のSupabaseユーザーID)。その push_tokens へ Expo Push を送る。
//  ・本文に「通報者→被通報者：理由」を載せ、Supabaseの friend_reports を見て対処する導線にする。
//  ・実配信は EAS の APNs/FCM 資格情報が前提(cheer-notify と同じ経路)。
//
// デプロイ:
//   supabase functions deploy report-notify
//   supabase secrets set ADMIN_USER_ID=<あなたのユーザーID>
//     ↑ ユーザーIDは SQL Editor で: select id, email from auth.users where email='あなたのメール';
//   ※プッシュを受け取るには、あなたの端末でアプリの通知を許可し、push_tokens に自分のトークンがある状態にする。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const adminId = Deno.env.get('ADMIN_USER_ID') ?? '';

  // 通報者を JWT で特定(認証必須)。
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  if (!jwt) return json({ error: 'auth_required' }, 401);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'auth_required' }, 401);

  if (!adminId) return json({ ok: false, reason: 'no_admin_configured' }); // 未設定でも通報自体は成功済み

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const reported = typeof body.reported === 'string' ? body.reported : null;
  const reason = (typeof body.reason === 'string' && body.reason.trim()) ? body.reason.trim().slice(0, 120) : null;

  const admin = createClient(url, serviceRole);

  // 管理者(あなた)の端末トークン。無ければ何もしない。
  const { data: toks } = await admin.from('push_tokens').select('token').eq('user_id', adminId);
  if (!toks || toks.length === 0) return json({ ok: true, sent: 0 });

  // 通報者/被通報者のニックネームを引いて分かりやすく。
  const ids = [user.id, reported].filter(Boolean) as string[];
  const { data: profs } = await admin.from('friend_profiles').select('user_id, nickname').in('user_id', ids);
  const nickOf = (id: string | null) =>
    profs?.find((p: { user_id: string; nickname: string }) => p.user_id === id)?.nickname ?? '?';
  const bodyText = `${nickOf(user.id)} → ${nickOf(reported)}${reason ? '：' + reason : ''}`;

  const messages = toks.map((t: { token: string }) => ({
    to: t.token, title: '新しい通報', body: bodyText, sound: 'default', priority: 'high',
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (_e) {
    return json({ ok: false, reason: 'push_send_failed' });
  }
  return json({ ok: true, sent: toks.length });
});
