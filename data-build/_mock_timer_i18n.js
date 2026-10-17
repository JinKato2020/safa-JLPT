// 模試タイマー対応: mock.timeup(時間切れ注記) を全10言語に追加 ＋ フル模試の表示時間を15→20分に更新。
const fs = require('fs'), path = require('path');
const dir = 'C:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ/app/src/i18n';
const TIMEUP = {
  ja: '⏰ 時間切れ・自動採点しました',
  en: "⏰ Time's up — auto-graded",
  ne: '⏰ समय सकियो — स्वचालित मूल्याङ्कन भयो',
  vi: '⏰ Hết giờ — đã chấm điểm tự động',
  my: '⏰ အချိန်ကုန်သွားသည် — အလိုအလျောက် အမှတ်ပေးပြီး',
  id: '⏰ Waktu habis — sudah dinilai otomatis',
  ko: '⏰ 시간 종료 — 자동 채점되었습니다',
  zh: '⏰ 时间到 — 已自动评分',
  bn: '⏰ সময় শেষ — স্বয়ংক্রিয়ভাবে মূল্যায়ন হয়েছে',
  th: '⏰ หมดเวลา — ตรวจให้คะแนนอัตโนมัติแล้ว',
};
for (const l of Object.keys(TIMEUP)) {
  const p = path.join(dir, l + '.json');
  const o = JSON.parse(fs.readFileSync(p, 'utf8'));
  o['mock.timeup'] = TIMEUP[l];
  for (const k of ['test.full_time', 'touroverlay.test_full_time']) {
    if (typeof o[k] === 'string' && o[k].includes('15')) o[k] = o[k].replace('15', '20');
  }
  const s = {}; Object.keys(o).sort().forEach((k) => { s[k] = o[k]; });
  fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n', 'utf8');
  console.log(l, '| timeup✓ | test.full_time =', o['test.full_time']);
}
