// 電撃FXをネイティブGPUシェーダで描画(expo-gl / GLSL)。Skia(新アーキ起動クラッシュ)不使用。
// テクスチャ依存を廃し、フラグメントシェーダ内で稲妻をプロシージャル生成(ノイズ＋波打つ発光弧)。
// 時間 uTime で毎フレーム動く。加算合成(SRC_ALPHA,ONE)で発光グロー。
import { useEffect, useRef } from 'react';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

// 青白いギザギザの枝分かれ稲妻が、バーを横切って閃く(striking)。参考画像=ホームタブ2.png準拠。
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
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03; a*=0.5; } return v; }
// 水平の稲妻: fbmでギザギザに折れ曲がる芯＋発光。枝分かれ感は多オクターブで。
float bolt(vec2 uv, float cy, float seed, float t){
  float disp = fbm(vec2(uv.x*7.0 + seed, t*3.0 + seed)) - 0.5;
  disp += 0.5 * (fbm(vec2(uv.x*22.0 + seed*3.0, t*6.0)) - 0.5); // 細かい折れ=枝分かれ感
  float y = cy + disp*0.22;
  float d = abs(uv.y - y);
  float core = 0.0028 / (d + 0.0012);   // 細く鋭い芯
  float glow = 0.018 / (d + 0.05);      // 周囲の発光
  return core + glow*0.6;
}
void main(){
  vec2 uv = vUv; float t = uTime;
  float e = 0.0;
  // 4本の稲妻が別々のタイミングで閃く(striking)＋常に薄く走る
  for(int i=0;i<4;i++){
    float fi = float(i);
    float cy = 0.16 + fi*0.22;
    float ph = t*1.7 + fi*1.7;
    float strike = pow(max(0.0, sin(ph)), 6.0);   // 鋭い閃光
    strike = max(strike, 0.14);                    // 常時うっすら
    strike *= 0.7 + 0.3 * step(0.5, hash(vec2(floor(t*24.0), fi))); // 高速ちらつき
    e += bolt(uv, cy, fi*11.0 + floor(ph)*3.7, t) * strike;
  }
  e = clamp(e * 0.5, 0.0, 2.6);
  // 青白い稲妻(芯=白・周辺=青)
  vec3 col = mix(vec3(0.45,0.7,1.0), vec3(1.0,1.0,1.0), clamp(e*0.8, 0.0, 1.0));
  gl_FragColor = vec4(col * e, clamp(e, 0.0, 1.0));
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
