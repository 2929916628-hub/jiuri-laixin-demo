/* 旧日来信 · 全景渲染器
   一块全屏 quad，逐像素把视线方向换算成等距圆柱投影的 UV，从两张 360° 图里取色。
   两张图可以交叉淡入淡出 —— 用来做「拉灯绳」开灯 / 关灯。
   不依赖任何第三方库。 */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `
precision highp float;
varying vec2 vUv;

uniform vec2 uRes;
uniform float uYaw;
uniform float uPitch;
uniform float uFov;
uniform float uMix;
uniform float uExposure;
uniform float uTime;
uniform float uGrain;
uniform sampler2D uTexA;
uniform sampler2D uTexB;

const float PI  = 3.14159265359;
const float TAU = 6.28318530718;
// 这张全景图在 u=0.5 时对应的世界方位角（度 → 弧度），由场景相机反推得到
const float AZ0 = 1.4922565;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  p.x *= aspect;

  float t = tan(uFov * 0.5);
  vec3 fwd   = vec3(cos(uPitch) * cos(uYaw), cos(uPitch) * sin(uYaw), sin(uPitch));
  // 右手系 Z 向上：看向 +X 时，屏幕右边是 -Y。原版取成了 +Y，画面左右镜像（2026-10-24 修正）
  vec3 right = vec3(sin(uYaw), -cos(uYaw), 0.0);
  vec3 up    = cross(right, fwd);

  vec3 dir = normalize(fwd + right * (p.x * t) + up * (p.y * t));

  float az = atan(dir.y, dir.x);
  float u  = fract(0.5 + (AZ0 - az) / TAU);
  float v  = 0.5 - asin(clamp(dir.z, -1.0, 1.0)) / PI;
  vec2 uv  = vec2(u, v);

  vec3 colA = texture2D(uTexA, uv).rgb;
  vec3 colB = texture2D(uTexB, uv).rgb;
  vec3 col  = mix(colA, colB, uMix);

  col *= uExposure;

  // 夜里灯丝的细微抖动，让它不是一张死图
  col *= 1.0 + uMix * (0.006 * sin(uTime * 7.3) + 0.004 * sin(uTime * 2.1 + 1.7));

  // 一点点镜头暗角，把注意力压回画面中间
  float r = length(vec2(p.x / aspect, p.y));
  col *= 1.0 - 0.18 * smoothstep(0.55, 1.45, r);

  // 极轻的颗粒，抵消大色块的塑料感
  float g = hash(gl_FragCoord.xy + vec2(uTime * 7.0, uTime * 3.0));
  col += (g - 0.5) * uGrain;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const DEG = Math.PI / 180;

export class PanoViewer {
  constructor(canvas) {
    this.canvas = canvas;
    const opts = { antialias: false, alpha: false, premultipliedAlpha: false };
    this.gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!this.gl) throw new Error('这个浏览器没有 WebGL');

    const gl = this.gl;
    this.program = this._program(VERT, FRAG);
    gl.useProgram(this.program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.program, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.u = {};
    for (const name of ['uRes', 'uYaw', 'uPitch', 'uFov', 'uMix', 'uExposure', 'uTime', 'uGrain', 'uTexA', 'uTexB']) {
      this.u[name] = gl.getUniformLocation(this.program, name);
    }

    this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.texA = null;
    this.texB = null;

    this.state = {
      yaw: 98 * DEG,
      pitch: -6 * DEG,
      fov: 72 * DEG,
      mix: 0,
      exposure: 1.0,
      grain: 0.012,
    };
    this.time = 0;
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _program(vs, fs) {
    const gl = this.gl;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s) || 'shader compile failed');
      }
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) || 'link failed');
    }
    return p;
  }

  _resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.dpr = dpr;
  }

  /**
   * 载入一张 360° 全景。slot = 'A' | 'B'
   */
  load(slot, url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const gl = this.gl;
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);

        const pot = (img.width & (img.width - 1)) === 0 && (img.height & (img.height - 1)) === 0;
        if (pot) {
          gl.generateMipmap(gl.TEXTURE_2D);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        } else {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        }
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        if (this.aniso) {
          const max = gl.getParameter(this.aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
          gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, max));
        }
        if (slot === 'A') this.texA = tex;
        else this.texB = tex;
        resolve(img);
      };
      img.onerror = () => reject(new Error('全景图加载失败：' + url));
      img.src = url;
    });
  }

  set(state) {
    Object.assign(this.state, state);
  }

  render(dt) {
    const gl = this.gl;
    const s = this.state;
    this.time += dt;

    this._resize();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.program);

    gl.uniform2f(this.u.uRes, this.canvas.width, this.canvas.height);
    gl.uniform1f(this.u.uYaw, s.yaw);
    gl.uniform1f(this.u.uPitch, s.pitch);
    gl.uniform1f(this.u.uFov, s.fov);
    gl.uniform1f(this.u.uMix, s.mix);
    gl.uniform1f(this.u.uExposure, s.exposure);
    gl.uniform1f(this.u.uTime, this.time);
    gl.uniform1f(this.u.uGrain, s.grain);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texA);
    gl.uniform1i(this.u.uTexA, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.texB || this.texA);
    gl.uniform1i(this.u.uTexB, 1);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * 把「方位角 + 仰角」投到屏幕坐标（CSS 像素）
   */
  project(azDeg, elevDeg) {
    const s = this.state;
    const az = azDeg * DEG;
    const el = elevDeg * DEG;
    const dir = [Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el)];
    const fwd = [Math.cos(s.pitch) * Math.cos(s.yaw), Math.cos(s.pitch) * Math.sin(s.yaw), Math.sin(s.pitch)];
    // 与着色器保持一致：right = 屏幕右方向，up = right × fwd
    const right = [Math.sin(s.yaw), -Math.cos(s.yaw), 0];
    const up = [
      right[1] * fwd[2] - right[2] * fwd[1],
      right[2] * fwd[0] - right[0] * fwd[2],
      right[0] * fwd[1] - right[1] * fwd[0],
    ];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const z = dot(dir, fwd);
    const x = dot(dir, right);
    const y = dot(dir, up);
    const t = Math.tan(s.fov * 0.5);
    const aspect = this.canvas.clientWidth / Math.max(1, this.canvas.clientHeight);
    const ndcX = (x / Math.max(z, 1e-4)) / (t * aspect);
    const ndcY = (y / Math.max(z, 1e-4)) / t;
    return {
      x: (ndcX * 0.5 + 0.5) * this.canvas.clientWidth,
      y: (0.5 - ndcY * 0.5) * this.canvas.clientHeight,
      depth: z,
      angle: Math.acos(Math.max(-1, Math.min(1, z))) / DEG,
    };
  }
}

/** 等距圆柱图上的 uv → 方位角 / 仰角 */
export function uvToAngles(u, v) {
  const AZ0 = 85.5;
  const az = AZ0 - (u - 0.5) * 360;
  const elev = (0.5 - v) * 180;
  return { az, elev };
}

export const RAD = DEG;
