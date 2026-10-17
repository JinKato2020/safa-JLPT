-- ============================================================================
-- 実ユーザー数(概算) — 町の架空アバターを自動でフェードアウトさせるために使う。
-- 出所 = friend_profiles の行数(ログイン済みで公開プロフィールを持つ実ユーザー)。
-- プライバシー: 個人は一切返さない。返すのは「総数(integer)」だけ。未ログインでも読める(anon)。
-- クライアント: supabase.rpc('app_user_count') → integer。端末に12hキャッシュ(src/plaza/appPopulation.ts)。
--   実ユーザーが 100(FADE_AT)を超えると架空アバターは 0 になり、実ユーザーだけの町へ自然に置き換わる。
-- Supabase の SQL Editor に貼って実行(CLI不要・何度でも再実行して安全)。
-- ============================================================================

create or replace function public.app_user_count()
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::int from public.friend_profiles;
$$;

-- 実行権限は関数だけに与える(テーブルは隠したまま)。未ログインでも呼べる=匿名の町もフェードできる。
revoke all on function public.app_user_count() from public;
grant execute on function public.app_user_count() to anon, authenticated;
