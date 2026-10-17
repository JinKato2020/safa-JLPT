// Supabase認証エラーの message を i18n キーへ写像(純関数・依存なし)。
export function mapAuthError(message: string | undefined): string {
  const m = (message ?? '').toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already')) {
    return 'account.err_taken';
  }
  if (m.includes('email not confirmed') || m.includes('not confirmed')) return 'account.err_unconfirmed';
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'account.err_invalid';
  if (m.includes('password') && (m.includes('at least') || m.includes('should be') || m.includes('weak') || m.includes('6 characters') || m.includes('8 characters'))) {
    return 'account.err_weak_pw';
  }
  if (m.includes('network') || m.includes('fetch') || m.includes('timeout') || m.includes('failed to')) return 'account.err_network';
  return 'account.err_invalid';
}
