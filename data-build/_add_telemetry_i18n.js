// 計測オプトアウト・トグルの i18n キー(profile.telemetry / profile.telemetryHint)を全10言語に追加。
const fs = require('fs'), path = require('path');
const dir = 'C:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ/app/src/i18n';
const M = {
  ja: { 'profile.telemetry': '利用状況データの送信', 'profile.telemetryHint': '学習の進捗を匿名で送信し、アプリ改善に役立てます（個人情報なし・追跡なし・いつでもオフ可）。' },
  en: { 'profile.telemetry': 'Share usage data', 'profile.telemetryHint': 'Anonymously share your study progress to help improve the app (no personal info, no tracking, off anytime).' },
  ne: { 'profile.telemetry': 'प्रयोग डेटा पठाउनुहोस्', 'profile.telemetryHint': 'एप सुधार गर्न आफ्नो अध्ययन प्रगति गोप्य रूपमा पठाउनुहोस् (व्यक्तिगत जानकारी छैन • ट्र्याकिङ छैन • जुनसुकै बेला बन्द गर्न सकिन्छ)।' },
  vi: { 'profile.telemetry': 'Chia sẻ dữ liệu sử dụng', 'profile.telemetryHint': 'Chia sẻ tiến trình học tập ẩn danh để giúp cải thiện ứng dụng (không có thông tin cá nhân • không theo dõi • có thể tắt bất cứ lúc nào).' },
  my: { 'profile.telemetry': 'အသုံးပြုမှု ဒေတာ မျှဝေရန်', 'profile.telemetryHint': 'အက်ပ်ကို တိုးတက်အောင် ကူညီရန် သင်၏ လေ့လာမှုတိုးတက်မှုကို အမည်မဖော်ဘဲ မျှဝေပါ (ကိုယ်ရေးအချက်အလက် မပါ • ခြေရာခံမှု မရှိ • မည်သည့်အချိန်မဆို ပိတ်နိုင်သည်)။' },
  id: { 'profile.telemetry': 'Bagikan data penggunaan', 'profile.telemetryHint': 'Bagikan progres belajar Anda secara anonim untuk membantu meningkatkan aplikasi (tanpa info pribadi • tanpa pelacakan • bisa dimatikan kapan saja).' },
  ko: { 'profile.telemetry': '사용 데이터 공유', 'profile.telemetryHint': '학습 진행 상황을 익명으로 공유하여 앱 개선에 도움을 주세요 (개인 정보 없음 • 추적 없음 • 언제든지 끌 수 있음).' },
  zh: { 'profile.telemetry': '共享使用数据', 'profile.telemetryHint': '匿名共享您的学习进度，帮助改进应用（无个人信息 • 无跟踪 • 随时可关闭）。' },
  bn: { 'profile.telemetry': 'ব্যবহারের ডেটা শেয়ার করুন', 'profile.telemetryHint': 'অ্যাপ উন্নত করতে আপনার পড়াশোনার অগ্রগতি বেনামে শেয়ার করুন (কোনো ব্যক্তিগত তথ্য নেই • কোনো ট্র্যাকিং নেই • যেকোনো সময় বন্ধ করা যাবে)।' },
  th: { 'profile.telemetry': 'แชร์ข้อมูลการใช้งาน', 'profile.telemetryHint': 'แชร์ความก้าวหน้าการเรียนรู้แบบไม่ระบุตัวตนเพื่อช่วยพัฒนาแอป (ไม่มีข้อมูลส่วนตัว • ไม่มีการติดตาม • ปิดได้ทุกเมื่อ)' },
};
for (const [lang, keys] of Object.entries(M)) {
  const p = path.join(dir, lang + '.json');
  const o = JSON.parse(fs.readFileSync(p, 'utf8'));
  for (const [k, v] of Object.entries(keys)) o[k] = v;
  const s = {}; Object.keys(o).sort().forEach((k) => { s[k] = o[k]; });
  fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n', 'utf8');
  console.log(lang, '+telemetry (計' + Object.keys(o).length + ')');
}
