// 友だちの応援が届いたことを、受信者のスマホへプッシュ通知する。
// 送信者のアプリが cheerSend 成功直後に呼ぶ: supabase.functions.invoke('cheer-notify', { body: { to, key, text } })
//  ・送信者本人は JWT で特定。相互友だち(town_members に (owner=to, member=送信者))でなければ送らない=スパム防止。
//  ・受信者のプッシュトークンは push_tokens から service_role で引く(クライアントには出さない)。
//  ・Expo Push API(https://exp.host/--/api/v2/push/send)へ投げるだけ。実配信は EAS の APNs/FCM 資格情報が前提。
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  // 送信者を JWT で特定。
  const jwt = (req.headers.get('Authorization') ?? '').replace('Bearer ', '');
  if (!jwt) return json({ error: 'auth_required' }, 401);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: `Bearer ${jwt}` } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'auth_required' }, 401);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const to = typeof body.to === 'string' ? body.to : null;
  if (!to || to === user.id) return json({ error: 'bad_target' }, 400);

  const admin = createClient(url, serviceRole);

  // 相互友だちか確認(送信者が受信者の町の住人=相互登録済み)。違えば送らない。
  const { data: rel } = await admin.from('town_members')
    .select('owner').eq('owner', to).eq('member', user.id).limit(1);
  if (!rel || rel.length === 0) return json({ ok: false, reason: 'not_friend' });

  // 受信者の端末トークンを引く(複数端末可)。
  const { data: toks } = await admin.from('push_tokens').select('token').eq('user_id', to);
  if (!toks || toks.length === 0) return json({ ok: true, sent: 0 });

  const text = (typeof body.text === 'string' && body.text.trim()) ? body.text.trim().slice(0, 100) : null;
  const bodyText = text ?? '友だちが応援してくれました！';
  const messages = toks.map((t: { token: string }) => ({
    to: t.token, title: 'まいにちJLPT', body: bodyText, sound: 'default',
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
