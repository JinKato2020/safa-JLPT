// 団体ライセンスの「先生」向け: 教師専用サイト(teacher.html)への入口。
// 先生がアプリにログイン済みなら、今のログイン情報(セッション)をURLの#断片に載せて
// 教師サイトを開く → 先生はブラウザでログイン画面を一切見ずにそのまま入れる。
// セッションは #断片(サーバーには送られない)で渡し、teacher.html 側で即URLから消す。
import { supabase } from '../config/supabase';

// 公開先(GitHub Pages / Cloudflare R2 の両方に配信される同一ファイル)。
const PORTAL_URL = 'https://jlpt.safa-lang.com/teacher.html';

export type TeacherHome = {
  school_id: number;
  school_name: string;
  student_count: number;
  student_cap: number;
};

// このアカウントが「先生」なら学校情報を返す。先生でなければ null。
// school_teacher.sql の teacher_home() を呼ぶ(RLSを安全に迂回するSECURITY DEFINER)。
export async function getTeacherHome(): Promise<TeacherHome | null> {
  try {
    const { data, error } = await supabase.rpc('teacher_home');
    if (error || !data) return null;
    return data as TeacherHome;   // RPCは json を返す
  } catch {
    return null;
  }
}

export type StudentHome = { school_name: string };

// このアカウントが「生徒」として学校に所属していれば学校名を返す。未所属なら null。
export async function getStudentHome(): Promise<StudentHome | null> {
  try {
    const { data, error } = await supabase.rpc('student_home');
    if (error || !data) return null;
    return data as StudentHome;
  } catch {
    return null;
  }
}

// 団体コードを入力して、自分を先生の生徒として紐づける(20人上限はサーバーで判定)。
export async function joinSchoolByCode(
  code: string,
): Promise<{ ok: boolean; schoolName?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('join_school_by_code', { p_code: code });
    if (error) return { ok: false, error: error.message };
    const d = (data ?? null) as { school_name?: string } | null;
    return { ok: true, schoolName: d?.school_name };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// 今のセッションを載せた教師サイトURL。未ログインなら null。
export async function buildTeacherPortalUrl(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || !session?.refresh_token) return null;
    const at = encodeURIComponent(session.access_token);
    const rt = encodeURIComponent(session.refresh_token);
    return `${PORTAL_URL}#t_at=${at}&t_rt=${rt}`;
  } catch {
    return null;
  }
}
