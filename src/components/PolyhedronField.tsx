"use client";
import { useEffect, useRef } from "react";

/**
 * 登录页动态背景：粒子聚合成多面体。
 * 参考个人网站的做法：形状用多面体的棱线表示，粒子沿棱线均匀分布；
 * 切换形状时每个粒子先沿随机方向「炸开」再落到下一个形状上，按序号错开时间，形成流动感。
 * - 开场：从四散状态聚合成二十面体
 * - 之后每隔几秒在 二十面体 → 十二面体 → 八面体 → 球形网格 之间循环
 * - 缓慢自转，随鼠标轻微倾斜；系统开启「减少动态效果」时只显示静止的形状
 */
export function PolyhedronField({ className = "", anchor = 0.5 }: { className?: string; anchor?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const anchorRef = useRef(anchor);
  anchorRef.current = anchor;

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import("three");
      if (disposed || !ref.current) return;
      const canvas = ref.current;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      let renderer: import("three").WebGLRenderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      } catch {
        return; // 不支持 WebGL：保持纯色背景
      }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
      camera.position.set(0, 0, 8);

      // ---------- 形状：沿棱线均匀撒 N 个粒子 ----------
      const N = 1800;
      const sampleEdges = (g: import("three").BufferGeometry, threshold = 1): Float32Array => {
        const e = new THREE.EdgesGeometry(g, threshold).attributes.position.array as Float32Array;
        const segs: number[][] = [];
        let total = 0;
        for (let i = 0; i < e.length; i += 6) {
          const len = Math.hypot(e[i + 3] - e[i], e[i + 4] - e[i + 1], e[i + 5] - e[i + 2]);
          segs.push([i, len]);
          total += len;
        }
        const out = new Float32Array(N * 3);
        let k = 0;
        for (const [i, len] of segs) {
          const n = Math.max(1, Math.round((len / total) * N));
          for (let s = 0; s < n && k < N; s++, k++) {
            const t = (s + Math.random() * 0.6) / n;
            out[k * 3] = e[i] + (e[i + 3] - e[i]) * t;
            out[k * 3 + 1] = e[i + 1] + (e[i + 4] - e[i + 1]) * t;
            out[k * 3 + 2] = e[i + 2] + (e[i + 5] - e[i + 2]) * t;
          }
        }
        // 四舍五入差几个点：补到随机棱上
        for (; k < N; k++) {
          const [i] = segs[Math.floor(Math.random() * segs.length)];
          const t = Math.random();
          out[k * 3] = e[i] + (e[i + 3] - e[i]) * t;
          out[k * 3 + 1] = e[i + 1] + (e[i + 4] - e[i + 1]) * t;
          out[k * 3 + 2] = e[i + 2] + (e[i + 5] - e[i + 2]) * t;
        }
        // 打乱顺序，让切换时的错开延迟分布在整个形状上
        for (let i = N - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          for (let c = 0; c < 3; c++) [out[i * 3 + c], out[j * 3 + c]] = [out[j * 3 + c], out[i * 3 + c]];
        }
        return out;
      };
      const R = 1.7;
      const shapes = [
        sampleEdges(new THREE.IcosahedronGeometry(R, 1)),
        sampleEdges(new THREE.DodecahedronGeometry(R * 1.02, 0)),
        sampleEdges(new THREE.OctahedronGeometry(R * 1.12, 0)),
        sampleEdges(new THREE.IcosahedronGeometry(R * 0.98, 2), 0.5),
      ];
      // 开场的「四散」状态：大球壳里随机分布
      const scatter = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const v = new THREE.Vector3().randomDirection().multiplyScalar(3 + Math.random() * 5);
        scatter.set([v.x, v.y, v.z * 0.6], i * 3);
      }

      // 每个粒子：炸开方向、幅度、延迟
      const dir = new Float32Array(N * 3);
      const amp = new Float32Array(N);
      const del = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const v = new THREE.Vector3().randomDirection();
        dir.set([v.x, v.y, v.z], i * 3);
        amp[i] = 0.4 + Math.random() * 0.9;
        del[i] = (i / N) * 0.35 + Math.random() * 0.08;
      }

      // ---------- 粒子 ----------
      const pos = new Float32Array(reduce ? shapes[0] : scatter);
      const col = new Float32Array(N * 3);
      const ink = new THREE.Color("#e4ece8"),
        spark = new THREE.Color("#5cf2a0");
      for (let i = 0; i < N; i++) {
        const c = Math.random() < 0.22 ? spark : ink;
        const b = 0.55 + Math.random() * 0.45;
        col.set([c.r * b, c.g * b, c.b * b], i * 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
      // 圆形柔光贴图
      const sprite = (() => {
        const c = document.createElement("canvas");
        c.width = c.height = 64;
        const x = c.getContext("2d")!;
        const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.35, "rgba(255,255,255,0.55)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        x.fillStyle = g;
        x.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(c);
      })();
      const mat = new THREE.PointsMaterial({
        size: 0.07,
        map: sprite,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      });
      const points = new THREE.Points(geo, mat);
      const holder = new THREE.Group();
      holder.add(points);
      holder.rotation.set(0.35, 0.6, 0);
      scene.add(holder);

      // 背景里稀疏的星尘，增加纵深
      const dustN = 260;
      const dust = new Float32Array(dustN * 3);
      for (let i = 0; i < dustN; i++) dust.set([(Math.random() - 0.5) * 22, (Math.random() - 0.5) * 14, -4 - Math.random() * 10], i * 3);
      const dustGeo = new THREE.BufferGeometry();
      dustGeo.setAttribute("position", new THREE.BufferAttribute(dust, 3));
      const dustMat = new THREE.PointsMaterial({ size: 0.05, map: sprite, color: "#7d8c86", transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending });
      scene.add(new THREE.Points(dustGeo, dustMat));

      // ---------- 尺寸与位置 ----------
      const resize = () => {
        const w = canvas.clientWidth,
          h = canvas.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        // 宽屏时让多面体出现在 anchor 指定的水平位置（0=最左，1=最右），窄屏居中
        const visW = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect;
        const a = w >= 1024 ? anchorRef.current : 0.5;
        holder.position.x = (a - 0.5) * visW;
        const s = w >= 1024 ? Math.min(1.15, Math.max(0.85, w / 1300)) : Math.min(0.85, Math.max(0.6, w / 560));
        holder.scale.setScalar(s);
      };
      resize();
      const ro = new ResizeObserver(resize);
      ro.observe(canvas);

      // ---------- 鼠标倾斜 ----------
      const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
      const onMove = (e: PointerEvent) => {
        mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener("pointermove", onMove);

      // ---------- 动画 ----------
      const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      const ASSEMBLE = 2.6, // 开场聚合时长（秒）
        HOLD = 5.5, // 每个形状停留
        MORPH = 2.4; // 切换时长
      let from: Float32Array = scatter,
        to: Float32Array = shapes[0],
        shapeIdx = 0,
        phaseStart = performance.now() / 1000,
        phaseLen = ASSEMBLE,
        morphing = !reduce;
      let raf = 0,
        last = performance.now();

      const frame = (nowMs: number) => {
        raf = requestAnimationFrame(frame);
        if (document.hidden) return;
        const now = nowMs / 1000;
        const dt = Math.min(0.05, (nowMs - last) / 1000);
        last = nowMs;

        if (morphing) {
          const T = Math.min(1, (now - phaseStart) / phaseLen);
          const span = 1 - 0.43;
          const burstScale = from === scatter ? 0.35 : 1;
          for (let i = 0; i < N; i++) {
            let t = (T - del[i]) / span;
            t = t < 0 ? 0 : t > 1 ? 1 : t;
            const e = ease(t),
              b = Math.sin(Math.PI * t) * amp[i] * burstScale,
              j = i * 3;
            pos[j] = from[j] + (to[j] - from[j]) * e + dir[j] * b;
            pos[j + 1] = from[j + 1] + (to[j + 1] - from[j + 1]) * e + dir[j + 1] * b;
            pos[j + 2] = from[j + 2] + (to[j + 2] - from[j + 2]) * e + dir[j + 2] * b;
          }
          geo.attributes.position.needsUpdate = true;
          if (T >= 1) {
            morphing = false;
            phaseStart = now;
          }
        } else if (!reduce && now - phaseStart > HOLD) {
          // 开始下一次切换
          from = to;
          shapeIdx = (shapeIdx + 1) % shapes.length;
          to = shapes[shapeIdx];
          phaseStart = now;
          phaseLen = MORPH;
          morphing = true;
        }

        if (!reduce) {
          mouse.x += (mouse.tx - mouse.x) * 0.04;
          mouse.y += (mouse.ty - mouse.y) * 0.04;
          holder.rotation.y += dt * 0.12;
          holder.rotation.x = 0.35 + mouse.y * 0.18;
          holder.rotation.z = -mouse.x * 0.08;
          // 轻微呼吸
          const s = 1 + Math.sin(now * 0.8) * 0.015;
          points.scale.setScalar(s);
        }
        renderer.render(scene, camera);
      };
      raf = requestAnimationFrame(frame);

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener("pointermove", onMove);
        geo.dispose();
        dustGeo.dispose();
        mat.dispose();
        dustMat.dispose();
        sprite.dispose();
        renderer.dispose();
      };
    })();
    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={`pointer-events-none ${className}`} style={{ width: "100%", height: "100%", display: "block" }} />;
}
