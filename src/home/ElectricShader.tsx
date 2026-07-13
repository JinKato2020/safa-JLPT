// 電撃FXをネイティブGPUシェーダで描画(expo-gl / GLSL)。Skiaは新アーキ起動クラッシュのため不使用。
// 稲妻テクスチャを2オクターブUVスクロール＋加算合成(gl.blendFunc(SRC_ALPHA, ONE))で発光グロー。
import { useEffect, useRef } from 'react';
import { GLView, type ExpoWebGLRenderingContext } from 'expo-gl';
import { Asset } from 'expo-asset';

const ELEC = require('../../assets/tabs/electric_tex.png');

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform float uTime;
void main(){
  // 2オクターブのUVスクロール(速度・向き違い)
  vec2 uv1 = vec2(vUv.x - uTime * 0.05, vUv.y);
  vec2 uv2 = vec2(vUv.x * 1.7 + uTime * 0.085, vUv.y * 1.25 + 0.3);
  float e1 = texture2D(uTex, uv1).r;
  float e2 = texture2D(uTex, uv2).r;
  float e = e1 * 0.75 + e2 * 0.55;
  // 明滅(フリッカ)
  float fl = 0.5 + 0.5 * sin(uTime * 11.0 + vUv.x * 6.0);
  e *= (0.35 + 0.65 * fl) * 0.85;
  // 金→シアンのグロー配色。alpha=e で加算合成すると発光になる。
  vec3 col = mix(vec3(1.0, 0.82, 0.35), vec3(0.62, 0.95, 1.0), clamp(e2 * 1.3, 0.0, 1.0));
  gl_FragColor = vec4(col * e, e);
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

  const onCreate = async (gl: ExpoWebGLRenderingContext) => {
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

    const asset = Asset.fromModule(ELEC);
    await asset.downloadAsync();
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // expo-gl の texImage2D は Expo Asset を画素ソースとして受け付ける。
    // expo-gl の texImage2D は Expo Asset を画素ソースとして受け付ける(型定義に無いため any 経由)。
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, asset as any);
    gl.uniform1i(gl.getUniformLocation(prog, 'uTex'), 0);
    const uTime = gl.getUniformLocation(prog, 'uTime');

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
