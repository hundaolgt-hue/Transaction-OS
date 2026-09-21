'use client';

import { useEffect, useRef } from 'react';

/** Drifting network of nodes — a visual echo of the knowledge graph. Static when reduced motion is requested. */
export default function LoginArt() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, raf = 0;
    const mouse = { x: -999, y: -999 };
    const pts = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.0006, vy: (Math.random() - 0.5) * 0.0006, r: 1 + Math.random() * 2.2 }));
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        if (!reduced) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > 1) p.vx *= -1; if (p.y < 0 || p.y > 1) p.vy *= -1; }
      }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i]; const ax = a.x * w, ay = a.y * h;
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j]; const d = Math.hypot(ax - b.x * w, ay - b.y * h);
          if (d < 120) { ctx.strokeStyle = `rgba(112,137,255,${(1 - d / 120) * 0.38})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(b.x * w, b.y * h); ctx.stroke(); }
        }
        const near = Math.hypot(ax - mouse.x, ay - mouse.y) < 90;
        ctx.fillStyle = near ? '#E9D001' : i % 6 === 0 ? 'rgba(233,208,1,.85)' : 'rgba(150,170,255,.85)';
        ctx.beginPath(); ctx.arc(ax, ay, a.r + (near ? 1.5 : 0), 0, Math.PI * 2); ctx.fill();
      }
      if (!reduced) raf = requestAnimationFrame(draw);
    };
    const move = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; if (reduced) draw(); };
    resize(); draw();
    window.addEventListener('resize', resize);
    canvas.parentElement?.addEventListener('pointermove', move);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); canvas.parentElement?.removeEventListener('pointermove', move); };
  }, []);
  return <canvas ref={ref} aria-hidden />;
}
