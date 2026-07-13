// 電撃FXをネイティブGPUシェーダで描画(expo-gl / GLSL)。Skia(新アーキ起動クラッシュ)不使用。
// テクスチャ依存を廃し、フラグメントシェーダ内で稲妻をプロシージャル生成(ノイズ＋波打つ発光弧)。
// 時間 uTime で毎フレーム動く。加算合成(SRC_ALPHA,ONE)で発光グロー。
import { useEffect, useRef } from 'react';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

// 波打つ水平の発光弧を複数本＋明滅＋走査。数式のみ＝テクスチャ不要。
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec2 uRes;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), f.x),
             mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), f.x), f.y);
}
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.0; a*=0.5; } return v; }
void main(){
  vec2 uv = vUv;
  float t = uTime;
  float e = 0.0;
  for(int i=0;i<3;i++){
    float fi = float(i);
    float baseY = 0.28 + fi*0.22;
    // 横に流れる波打ち(fbmで有機的に)
    float wob = (fbm(vec2(uv.x*3.5 + t*1.2 + fi*7.0, t*0.6 + fi*3.0)) - 0.5) * 0.30;
    float d = abs(uv.y - (baseY + wob));
    // 芯＝細く強く、周囲＝ぼんやりグロー
    float core = 0.0016 / (d*d + 0.00025);
    float glow = 0.010 / (d + 0.02);
    // 弧に沿った電流の走り(明暗の粒)
    float run = 0.55 + 0.45 * sin(uv.x*22.0 - t*9.0 + fi*2.0);
    e += (core*0.9 + glow*0.5) * run;
  }
  // 全体の明滅(フリッカ)
  float fl = 0.6 + 0.4 * sin(t*17.0) * sin(t*7.3 + 1.0);
  e *= fl;
  e = clamp(e * 0.9, 0.0, 2.2);
  // 金→シアンの配色
  vec3 col = mix(vec3(1.0,0.85,0.42), vec3(0.6,0.95,1.0), clamp(uv.y,0.0,1.0));
  gl_FragColor = vec4(col * e, clamp(e,0.0,1.0));
}`;

function compile(gl: ExpoWebGLRenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  return sh;
}

export default function ElectricShader({ width, height }: { width: number; height: number }) {
  const raf = useRef(0);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const onCreate = (gl: ExpoWebGLRenderingContext) => {
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(prog, 'uTime');
    gl.uniform2f(gl.getUniformLocation(prog, 'uRes'), width, height);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE); // 加算合成
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    const t0 = Date.now();
    const loop = () => {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, (Date.now() - t0) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.endFrameEXP();
      raf.current = requestAnimationFrame(loop);
    };
    loop();
  };

  return <GLView style={{ width, height }} onContextCreate={onCreate} />;
}
