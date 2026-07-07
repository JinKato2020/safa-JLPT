// WebView用の自己完結HTML。HanziWriter＋田/米グリッド(SVG)＋見本＋アニメを内包し、
// RNからは KW.* を injectJavaScript で呼ぶ。ネットには触れない(字形はRNが注入)。
import { HANZI_WRITER_JS } from './hanziWriterLib';

export function buildEngineHtml(): string {
  return `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>html,body{margin:0;padding:0;background:transparent;height:100%;overflow:hidden}
#wrap{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center}
#grid{position:absolute;pointer-events:none}#t{touch-action:none}</style>
</head><body>
<div id="wrap"><svg id="grid"></svg><div id="t"></div></div>
<script>${HANZI_WRITER_JS}</script>
<script>
var writer=null, curChar=null, curData=null, curStep=0, free=false;
var COLORS={stroke:'#2f7bf6',outline:'#cbd5e1',grid:'#94a3b8',highlight:'#22c55e'};
var SPEED={slow:0.5,normal:1,fast:2}, DELAY={slow:320,normal:180,fast:90}, speed='normal';
function post(o){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify(o));}
function size(){return Math.min(window.innerWidth,window.innerHeight);}
function drawGrid(kind){
  var S=size(), svg=document.getElementById('grid');
  svg.setAttribute('width',S);svg.setAttribute('height',S);
  svg.setAttribute('viewBox','0 0 '+S+' '+S);
  var g=COLORS.grid, o='<rect x="1" y="1" width="'+(S-2)+'" height="'+(S-2)+'" fill="none" stroke="'+g+'" stroke-width="1.5" opacity="0.5"/>';
  if(kind==='ta'||kind==='kome'){
    o+='<line x1="'+(S/2)+'" y1="0" x2="'+(S/2)+'" y2="'+S+'" stroke="'+g+'" stroke-width="1" opacity="0.4"/>';
    o+='<line x1="0" y1="'+(S/2)+'" x2="'+S+'" y2="'+(S/2)+'" stroke="'+g+'" stroke-width="1" opacity="0.4"/>';
  }
  if(kind==='kome'){
    o+='<line x1="0" y1="0" x2="'+S+'" y2="'+S+'" stroke="'+g+'" stroke-width="1" stroke-dasharray="4 5" opacity="0.28"/>';
    o+='<line x1="'+S+'" y1="0" x2="0" y2="'+S+'" stroke="'+g+'" stroke-width="1" stroke-dasharray="4 5" opacity="0.28"/>';
  }
  svg.innerHTML=o;
}
function KW(){}
KW.setColors=function(c){for(var k in c)COLORS[k]=c[k];};
KW.setGrid=function(kind){window._grid=kind;drawGrid(kind);};
KW.setSpeed=function(s){speed=s;};
KW.load=function(char,dataJson){curChar=char;curData=typeof dataJson==='string'?JSON.parse(dataJson):dataJson;post({type:'loaded',char:char});};
function make(opts){
  document.getElementById('t').innerHTML='';
  var S=size();
  return HanziWriter.create('t',curChar,Object.assign({
    width:S,height:S,padding:Math.round(S*0.04),
    strokeColor:COLORS.stroke,outlineColor:COLORS.outline,drawingColor:COLORS.stroke,highlightColor:COLORS.highlight,
    strokeAnimationSpeed:SPEED[speed],delayBetweenStrokes:DELAY[speed],
    charDataLoader:function(c,onComplete){onComplete(curData);}
  },opts));
}
KW.setStep=function(step){
  curStep=step;free=false;
  var showOutline=(step===0);
  var len=(step===2?1.0:(step===1?1.2:1.4));
  writer=make({showCharacter:false,showOutline:showOutline,leniency:len});
  if(step===0){writer.animateCharacter();}
  writer.quiz({
    showHintAfterMisses: step===0?1:(step===1?3:999),
    highlightOnComplete:true,
    onMistake:function(s){post({type:'mistake',stroke:s.strokeNum});},
    onComplete:function(s){post({type:'complete',mistakes:s.totalMistakes});}
  });
  post({type:'started',step:step});
};
KW.setFree=function(on){
  free=on;
  if(on){writer=make({showCharacter:false,showOutline:true,leniency:2.0});writer.quiz({showHintAfterMisses:1,highlightOnComplete:false});post({type:'started',step:-1});}
};
KW.animate=function(){if(writer)writer.animateCharacter();};
KW.hint=function(){if(writer&&writer.showHint)writer.showHint();};
KW.showAnswer=function(){if(!writer)return;writer.showOutline();writer.animateCharacter();};
KW.clear=function(){if(writer&&writer.cancelQuiz){writer.cancelQuiz();} if(free){KW.setFree(true);} else {KW.setStep(curStep);}};
window.KW=KW;
window.addEventListener('resize',function(){if(window._grid)drawGrid(window._grid);});
post({type:'ready'});
</script>
</body></html>`;
}
