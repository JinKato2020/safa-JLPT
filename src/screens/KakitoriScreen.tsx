// 漢字書き取り(サンプル10字)。採点/描画/書き順アニメは定番ライブラリ HanziWriter に委譲する
// (自作の幾何採点は廃止)。WebView内でHanziWriterを動かし、1画ずつ寛容に採点(位置/大小/傾き/筆致の崩れを吸収)。
// 3ステップ: なぞり(外形+ヒント+アニメ) → 見て書く(外形なし・ヒント少) → 見ないで書く(外形/ヒントなし)。
import { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { spacing, radius, type as ty, useColors, type ThemeColors } from '../theme';
import { useAppState, useAppActions } from '../store/store';
import { KAKITORI_CHARS } from '../kakitori/chars';
import { useT } from '../i18n';

const STEP_KEYS = ['kakitori.step_trace', 'kakitori.step_guided', 'kakitori.step_recall'];

// HanziWriter を CDN から読み、対象漢字を quiz(なぞって採点) する自己完結HTML。
// start(char, step) を注入して開始。完了/ミスは postMessage で RN に返す。
const HTML = `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>html,body{margin:0;padding:0;background:transparent;height:100%;overflow:hidden;display:flex;align-items:center;justify-content:center}#t{touch-action:none}</style>
</head><body>
<div id="t"></div>
<script src="https://cdn.jsdelivr.net/npm/hanzi-writer@3.7/dist/hanzi-writer.min.js"></script>
<script>
var writer=null;
function post(o){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(o));}
function size(){return Math.min(window.innerWidth,window.innerHeight);}
function start(char,step){
  document.getElementById('t').innerHTML='';
  var S=size();
  writer=HanziWriter.create('t',char,{
    width:S,height:S,padding:6,showCharacter:false,showOutline:step===0,
    strokeColor:'#2f7bf6',radicalColor:'#2f7bf6',outlineColor:'#cbd5e1',
    drawingColor:'#2f7bf6',highlightColor:'#22c55e',
    strokeAnimationSpeed:1,delayBetweenStrokes:180,
    leniency: step===2?1.0:1.4
  });
  if(step===0){writer.animateCharacter();}
  writer.quiz({
    showHintAfterMisses: step===0?1:(step===1?3:999),
    highlightOnComplete:true,
    onMistake:function(s){post({type:'mistake',stroke:s.strokeNum});},
    onComplete:function(s){post({type:'complete',mistakes:s.totalMistakes});}
  });
  post({type:'started',step:step});
}
function animate(){if(writer)writer.animateCharacter();}
post({type:'ready'});
</script>
</body></html>`;

export default function KakitoriScreen() {
  const nav = useNavigation();
  const state = useAppState();
  const { recordKakitori } = useAppActions();
  const c = useColors();
  const t = useT();
  const s = makeStyles(c);
  const webRef = useRef<WebView>(null);

  const [idx, setIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);

  const done = idx >= KAKITORI_CHARS.length;
  const char = done ? '' : KAKITORI_CHARS[idx];
  const stars = state.kakitori?.[char]?.stars ?? 0;

  const send = (obj: Record<string, unknown>) => {
    webRef.current?.injectJavaScript(`try{${obj.fn}}catch(e){}; true;`);
  };
  const startQuiz = (i: number, st: number) => {
    if (i >= KAKITORI_CHARS.length) return;
    send({ fn: `start(${JSON.stringify(KAKITORI_CHARS[i])}, ${st})` });
  };

  const onMessage = (e: WebViewMessageEvent) => {
    let m: { type?: string; mistakes?: number };
    try { m = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (m.type === 'ready') { setLoading(false); startQuiz(idx, step); return; }
    if (m.type === 'complete') {
      const score = m.mistakes === 0 ? 100 : Math.max(60, 100 - (m.mistakes ?? 0) * 8);
      recordKakitori(char, step + 1, score);
      setTimeout(() => {
        if (step < 2) { const ns = step + 1; setStep(ns); startQuiz(idx, ns); }
        else if (idx + 1 < KAKITORI_CHARS.length) { const ni = idx + 1; setIdx(ni); setStep(0); startQuiz(ni, 0); }
        else { setIdx(idx + 1); } // done
      }, 700);
    }
  };

  if (done) {
    return (
      <SafeAreaView style={s.c} edges={['top']}>
        <View style={s.center}>
          <Text style={s.doneEmoji}>🎉</Text>
          <Text style={s.doneTxt}>{t('kakitori.mastered')}</Text>
          <Pressable style={s.doneBtn} onPress={() => nav.goBack()}><Text style={s.doneBtnTxt}>{t('kakitori.clear')}</Text></Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.c} edges={['top']}>
      <View style={s.head}>
        <Text style={s.count}>{idx + 1} / {KAKITORI_CHARS.length}</Text>
        <Text style={s.stars}>{'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</Text>
        <Pressable onPress={() => nav.goBack()} hitSlop={12}><Text style={s.close}>×</Text></Pressable>
      </View>

      <Text style={s.char}>{char}</Text>
      <Text style={s.stepLabel}>{t(STEP_KEYS[step])}</Text>

      <View style={s.canvasWrap}>
        <View style={s.canvas}>
          <WebView
            ref={webRef}
            originWhitelist={['*']}
            source={{ html: HTML }}
            onMessage={onMessage}
            style={s.web}
            scrollEnabled={false}
            javaScriptEnabled
            domStorageEnabled
          />
          {loading && <View style={s.loader}><ActivityIndicator color={c.blue} /></View>}
        </View>
      </View>

      <Pressable style={({ pressed }) => [s.replay, pressed && s.pressed]} onPress={() => send({ fn: 'animate()' })}>
        <Text style={s.replayTxt}>↻ {t('kakitori.replay')}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const SIZE = 300;
const makeStyles = (c: ThemeColors) => StyleSheet.create({
  c: { flex: 1, backgroundColor: c.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  doneEmoji: { fontSize: 56 },
  doneTxt: { fontSize: ty.h2, fontWeight: '800', color: c.ink },
  doneBtn: { marginTop: spacing.md, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl, borderRadius: radius.md, backgroundColor: c.blue },
  doneBtnTxt: { color: '#fff', fontWeight: '800', fontSize: ty.body },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  count: { fontSize: ty.small, fontWeight: '700', color: c.mute },
  stars: { fontSize: ty.h2, color: c.amber, letterSpacing: 2 },
  close: { fontSize: 30, color: c.mute, fontWeight: '700' },
  char: { fontSize: 40, fontFamily: 'ShipporiMincho-Bold', color: c.ink, textAlign: 'center', marginTop: spacing.sm },
  stepLabel: { fontSize: ty.body, fontWeight: '700', color: c.blue, textAlign: 'center', marginTop: spacing.xs },
  canvasWrap: { alignItems: 'center', marginTop: spacing.md },
  canvas: { width: SIZE, height: SIZE, borderRadius: radius.lg, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: 'transparent' },
  loader: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  replay: { alignSelf: 'center', marginTop: spacing.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.md, backgroundColor: c.bgSoft, borderWidth: 1, borderColor: c.line },
  replayTxt: { fontSize: ty.body, fontWeight: '800', color: c.blue },
  pressed: { opacity: 0.85 },
});
