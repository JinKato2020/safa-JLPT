// 学校(団体ライセンス)Pro の「導出型」ライブ判定フラグ。
//  ・所属している間だけ member_status.license_until(メール導出)をここに保持する。
//  ・名簿から外れると次回同期で null が入り、その瞬間にPROが消える（pro_until に焼き付けない＝残骸ゼロ）。
//  ・端末ローカル（クラウドに同期しない）。campaignFlag と同じ外部ストア方式。
//  ・ネイティブ/supabase を import しない＝entitlement.ts から安全に読める（node --test でも落ちない）。
let licenseUntil: number | null = null;
const listeners = new Set<() => void>();

/** 同期やキャッシュから取得した学校ライセンス期限(ms)を反映。null=未所属/未有効化。 */
export function setSchoolLicenseUntil(v: number | null): void {
  if (v === licenseUntil) return;
  licenseUntil = v;
  listeners.forEach((l) => l());
}

/** いまの学校ライセンス期限(ms)。null=無し。proStatus はこれ>now でPro(source:'school')。 */
export function getSchoolLicenseUntil(): number | null {
  return licenseUntil;
}

export function subscribeSchool(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
