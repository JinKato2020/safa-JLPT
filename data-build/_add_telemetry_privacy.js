// profile.privacyBody(アプリ内プライバシー文)の末尾に「匿名の利用状況データ」段落を10言語で追記。
// 冪等: 既に "v1.1" を含む場合はスキップ(二重追記防止)。
const fs = require('fs'), path = require('path');
const dir = 'C:/Users/jwpsa/Documents/desktop/claude/JLPTアプリ/app/src/i18n';
const SEC = {
  ja: '\n\n匿名の利用状況データ（v1.1以降）：アプリ改善のため、匿名の学習進捗データ（到達度・覚えた数・模試結果・基本的な利用状況）を収集します。個人を特定する情報とは紐づかず、追跡には使いません（個人情報・IPは保存しません）。設定の「利用状況データの送信」でいつでもオフにできます。',
  en: '\n\nAnonymous usage data (v1.1+): To improve the app, we collect anonymous study-progress data (readiness, learned counts, mock results, basic activity). It is not linked to your identity and not used for tracking; no personal info or IP is stored. You can turn it off anytime in Settings → Share usage data.',
  ne: '\n\nअज्ञात प्रयोग डेटा (v1.1+): एप सुधार गर्नका लागि, हामी अज्ञात अध्ययन-प्रगति डेटा (तयारी स्तर, सिकेको संख्या, नक्कली परीक्षा परिणाम, आधारभूत गतिविधि) सङ्कलन गर्छौं। यो तपाईंको पहिचानसँग जोडिएको छैन र ट्र्याकिङका लागि प्रयोग गरिँदैन; कुनै व्यक्तिगत जानकारी वा IP सुरक्षित गरिँदैन। तपाईं यसलाई सेटिङ → प्रयोग डेटा पठाउनुहोस् मा गएर जुनसुकै बेला बन्द गर्न सक्नुहुन्छ।',
  vi: '\n\nDữ liệu sử dụng ẩn danh (v1.1+): Để cải thiện ứng dụng, chúng tôi thu thập dữ liệu tiến trình học tập ẩn danh (mức độ sẵn sàng, số từ đã học, kết quả thi thử, hoạt động cơ bản). Dữ liệu này không được liên kết với danh tính của bạn và không dùng để theo dõi; không có thông tin cá nhân hay địa chỉ IP nào được lưu trữ. Bạn có thể tắt tính năng này bất cứ lúc nào trong Cài đặt → Chia sẻ dữ liệu sử dụng.',
  my: '\n\nအမည်မသိ အသုံးပြုမှုဒေတာ (v1.1+)- အပ်ကို တိုးတက်ကောင်းမွန်စေရန်၊ ကျွန်ုပ်တို့သည် အမည်မသိ လေ့လာမှုတိုးတက်မှုဒေတာ (အသင့်အနေအထား၊ သင်ယူပြီးသောအရေအတွက်၊ စမ်းသပ်ဖြေဆိုမှုရလဒ်များ၊ အခြေခံလုပ်ဆောင်မှုများ) ကို စုဆောင်းပါသည်။ ယင်းသည် သင်၏ကိုယ်ရေးအချက်အလက်နှင့် ချိတ်ဆက်မထားဘဲ ခြေရာခံရန် အသုံးမပြုပါ၊ ကိုယ်ရေးကိုယ်တာအချက်အလက် သို့မဟုတ် IP လိပ်စာများ သိမ်းဆည်းမည်မဟုတ်ပါ။ ဆက်တင်များ → အသုံးပြုမှုဒေတာမျှဝေရန် တွင် မည်သည့်အချိန်မဆို ပိတ်နိုင်ပါသည်။',
  id: '\n\nData penggunaan anonim (v1.1+): Untuk meningkatkan aplikasi, kami mengumpulkan data kemajuan belajar anonim (tingkat kesiapan, jumlah yang dipelajari, hasil ujian simulasi, aktivitas dasar). Data ini tidak terhubung ke identitas Anda dan tidak digunakan untuk pelacakan; tidak ada informasi pribadi atau IP yang disimpan. Anda dapat menonaktifkannya kapan saja di Pengaturan → Kirim data penggunaan.',
  ko: '\n\n익명 사용 데이터 (v1.1+): 앱 개선을 위해 익명의 학습 진행 데이터(준비도, 학습한 단어 수, 모의시험 결과, 기본 활동 현황)를 수집합니다. 이 데이터는 개인 신원과 연결되지 않으며 추적 목적으로 사용되지 않습니다. 개인정보나 IP 주소는 저장되지 않습니다. 설정 → 사용 데이터 전송에서 언제든지 끌 수 있습니다.',
  zh: '\n\n匿名使用数据（v1.1+）：为改善应用体验，我们收集匿名的学习进度数据（准备度、已学数量、模拟考试结果、基本使用情况）。这些数据不与您的个人身份关联，不用于追踪；不存储任何个人信息或IP地址。您可随时在设置 → 发送使用数据中关闭此功能。',
  bn: '\n\nবেনামী ব্যবহারের তথ্য (v1.1+): অ্যাপটি উন্নত করতে আমরা বেনামী শিক্ষা-অগ্রগতির তথ্য (প্রস্তুতির মাত্রা, শেখা শব্দের সংখ্যা, মক পরীক্ষার ফলাফল, মৌলিক কার্যকলাপ) সংগ্রহ করি। এটি আপনার পরিচয়ের সাথে যুক্ত নয় এবং ট্র্যাকিংয়ের জন্য ব্যবহার করা হয় না; কোনো ব্যক্তিগত তথ্য বা আইপি সংরক্ষণ করা হয় না। আপনি যেকোনো সময় সেটিংস → ব্যবহারের তথ্য পাঠান থেকে এটি বন্ধ করতে পারবেন।',
  th: '\n\nข้อมูลการใช้งานนิรนาม (v1.1+): เพื่อปรับปรุงแอป เราเก็บรวบรวมข้อมูลความก้าวหน้าในการเรียนรู้แบบนิรนาม (ระดับความพร้อม จำนวนที่เรียนรู้แล้ว ผลการสอบจำลอง และกิจกรรมพื้นฐาน) ข้อมูลนี้ไม่ได้เชื่อมโยงกับตัวตนของคุณและไม่นำไปใช้ติดตาม ไม่มีการบันทึกข้อมูลส่วนบุคคลหรือ IP คุณสามารถปิดได้ตลอดเวลาในการตั้งค่า → ส่งข้อมูลการใช้งาน',
};
for (const [l, sec] of Object.entries(SEC)) {
  const p = path.join(dir, l + '.json');
  const o = JSON.parse(fs.readFileSync(p, 'utf8'));
  const cur = o['profile.privacyBody'];
  if (typeof cur !== 'string') { console.log(l, '✗ profile.privacyBody 無し'); continue; }
  if (cur.includes('v1.1')) { console.log(l, '= 既に追記済み(skip)'); continue; }
  o['profile.privacyBody'] = cur + sec;
  const s = {}; Object.keys(o).sort().forEach((k) => { s[k] = o[k]; });
  fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n', 'utf8');
  console.log(l, '+計測段落 (len ' + cur.length + '→' + o['profile.privacyBody'].length + ')');
}
