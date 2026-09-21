'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Page-level motion: scroll-reveal for any `.reveal`, and a press ripple on
 * buttons. Mounted once in each shell; re-scans on navigation.
 */
export default function Motion() {
  const pathname = usePathname();
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const show = (e: Element) => e.classList.add('in');
    if (reduced || !('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal:not(.in)').forEach(show);
      const mo = new MutationObserver(() => document.querySelectorAll('.reveal:not(.in)').forEach(show));
      mo.observe(document.body, { childList: true, subtree: true });
      return () => mo.disconnect();
    }
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { show(en.target); io.unobserve(en.target); }
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.05 });
    const watched = new WeakSet<Element>();
    const scan = () => {
      document.querySelectorAll('.reveal:not(.in)').forEach((e) => {
        if (watched.has(e)) return;
        watched.add(e);
        io.observe(e);
        setTimeout(() => show(e), 2500); // never strand content
      });
    };
    scan();
    // Client components mount panels after navigation or state changes — pick those up too.
    let queued = false;
    const mo = new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; scan(); }); } });
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { io.disconnect(); mo.disconnect(); };
  }, [pathname]);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onDown = (ev: PointerEvent) => {
      const btn = (ev.target as HTMLElement).closest<HTMLElement>('.btn');
      if (!btn || (btn as HTMLButtonElement).disabled) return;
      const r = btn.getBoundingClientRect();
      const d = Math.max(r.width, r.height);
      const s = document.createElement('span');
      s.className = 'ripple';
      s.style.width = s.style.height = `${d}px`;
      s.style.left = `${ev.clientX - r.left - d / 2}px`;
      s.style.top = `${ev.clientY - r.top - d / 2}px`;
      btn.appendChild(s);
      setTimeout(() => s.remove(), 600);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, []);
  return null;
}

/** Counts up to a number the first time it scrolls into view. */
export function CountUp({ value, prefix = '', suffix = '', decimals = 0, duration = 900 }: {
  value: number; prefix?: string; suffix?: string; decimals?: number; duration?: number;
}) {
  // Serializable props only — this is rendered from server components.
  const format = (v: number) => `${prefix}${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; }
    let raf = 0;
    const run = () => {
      const t0 = performance.now();
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / duration);
        setShown(value * (1 - Math.pow(1 - k, 3)));
        if (k < 1) raf = requestAnimationFrame(step);
      };
      setShown(0);
      raf = requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) { run(); io.disconnect(); } });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, duration]);
  return <span ref={ref}>{format(shown)}</span>;
}
