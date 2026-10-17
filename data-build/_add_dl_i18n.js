// 聴解DLダイアログの i18n キー dl.* を JLPT i18n(フラット)全10言語に追加。
const fs = require('fs'), path = require('path');
const dir = 'C:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ/app/src/i18n';
const M = {
  ja: { 'dl.title': '聴解音声をダウンロード', 'dl.body': '聴解音声（約{size}）。一度ダウンロードすればオフラインで聴けます。', 'dl.now': '今すぐダウンロード', 'dl.later': 'あとで', 'dl.progress': 'ダウンロード中… {n}%', 'dl.fail': 'ダウンロードに失敗しました', 'dl.retry': '再試行' },
  en: { 'dl.title': 'Download listening audio', 'dl.body': 'Listening audio (about {size}). Download once to listen offline anytime.', 'dl.now': 'Download now', 'dl.later': 'Later', 'dl.progress': 'Downloading… {n}%', 'dl.fail': 'Download failed', 'dl.retry': 'Retry' },
  ne: { 'dl.title': 'सुनाइ अडियो डाउनलोड गर्नुहोस्', 'dl.body': 'सुनाइ अडियो (लगभग {size})। एकपटक डाउनलोड गरेपछि अफलाइनमा सुन्न सकिन्छ।', 'dl.now': 'अहिले नै डाउनलोड गर्नुहोस्', 'dl.later': 'पछि', 'dl.progress': 'डाउनलोड हुँदैछ… {n}%', 'dl.fail': 'डाउनलोड असफल भयो', 'dl.retry': 'पुनः प्रयास गर्नुहोस्' },
  vi: { 'dl.title': 'Tải xuống âm thanh nghe', 'dl.body': 'Âm thanh nghe (khoảng {size}). Tải xuống một lần, nghe offline mọi lúc.', 'dl.now': 'Tải xuống ngay', 'dl.later': 'Để sau', 'dl.progress': 'Đang tải xuống… {n}%', 'dl.fail': 'Tải xuống thất bại', 'dl.retry': 'Thử lại' },
  my: { 'dl.title': 'နားထောင်သံကို ဒေါင်းလုဒ်လုပ်ပါ', 'dl.body': 'နားထောင်သံ (ခန့်မှန်း {size})။ တစ်ကြိမ်ဒေါင်းလုဒ်လုပ်ထားလျှင် အော့ဖ်လိုင်းတွင် နားထောင်နိုင်သည်။', 'dl.now': 'ယခုပင် ဒေါင်းလုဒ်လုပ်ပါ', 'dl.later': 'နောက်မှ', 'dl.progress': 'ဒေါင်းလုဒ်လုပ်နေသည်… {n}%', 'dl.fail': 'ဒေါင်းလုဒ်မအောင်မြင်ပါ', 'dl.retry': 'ထပ်မံကြိုးစားပါ' },
  id: { 'dl.title': 'Unduh Audio Mendengarkan', 'dl.body': 'Audio mendengarkan (sekitar {size}). Unduh sekali, dengarkan offline kapan saja.', 'dl.now': 'Unduh Sekarang', 'dl.later': 'Nanti', 'dl.progress': 'Mengunduh… {n}%', 'dl.fail': 'Unduhan gagal', 'dl.retry': 'Coba Lagi' },
  ko: { 'dl.title': '듣기 음성 다운로드', 'dl.body': '듣기 음성 (약 {size}). 한 번 다운로드하면 오프라인으로 들을 수 있습니다.', 'dl.now': '지금 다운로드', 'dl.later': '나중에', 'dl.progress': '다운로드 중… {n}%', 'dl.fail': '다운로드에 실패했습니다', 'dl.retry': '다시 시도' },
  zh: { 'dl.title': '下载听力音频', 'dl.body': '听力音频（约 {size}）。下载一次，随时离线收听。', 'dl.now': '立即下载', 'dl.later': '稍后', 'dl.progress': '下载中… {n}%', 'dl.fail': '下载失败', 'dl.retry': '重试' },
  bn: { 'dl.title': 'শ্রবণ অডিও ডাউনলোড করুন', 'dl.body': 'শ্রবণ অডিও (প্রায় {size})। একবার ডাউনলোড করলে অফলাইনে শুনতে পারবেন।', 'dl.now': 'এখনই ডাউনলোড করুন', 'dl.later': 'পরে', 'dl.progress': 'ডাউনলোড হচ্ছে… {n}%', 'dl.fail': 'ডাউনলোড ব্যর্থ হয়েছে', 'dl.retry': 'আবার চেষ্টা করুন' },
  th: { 'dl.title': 'ดาวน์โหลดเสียงฟัง', 'dl.body': 'เสียงฟัง (ประมาณ {size}) ดาวน์โหลดครั้งเดียว ฟังออฟไลน์ได้ทุกเมื่อ', 'dl.now': 'ดาวน์โหลดเดี๋ยวนี้', 'dl.later': 'ภายหลัง', 'dl.progress': 'กำลังดาวน์โหลด… {n}%', 'dl.fail': 'ดาวน์โหลดล้มเหลว', 'dl.retry': 'ลองอีกครั้ง' },
};
for (const [lang, keys] of Object.entries(M)) {
  const p = path.join(dir, lang + '.json');
  const o = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const [k, v] of Object.entries(keys)) o[k] = v;
  const s = {}; Object.keys(o).sort().forEach((k) => { s[k] = o[k]; });
  fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n', 'utf8');
  console.log(lang, '+dl.* (計' + Object.keys(o).length + ')');
}
