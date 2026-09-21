/**
 * Canvas renderer and force simulation for the knowledge graph. Framework
 * free, so the React app and the single-file preview share it.
 * Interactions: drag nodes, pan, wheel/pinch zoom, hover, click to select
 * (neighbours highlight), filter by type, search.
 */
import { NODE_META, type Graph, type GNode, type NodeType } from './graph';

interface SimNode extends GNode { x: number; y: number; vx: number; vy: number; fx?: number | null; fy?: number | null; deg: number }

export interface GraphViewOptions {
  onSelect?: (n: GNode | null, neighbours: GNode[]) => void;
  dark?: () => boolean;
  reducedMotion?: boolean;
}

export class GraphView {
  private ctx: CanvasRenderingContext2D;
  private nodes: SimNode[] = [];
  private edges: { s: SimNode; t: SimNode; kind: string }[] = [];
  private byId = new Map<string, SimNode>();
  private adj = new Map<string, Set<string>>();
  private scale = 1; private tx = 0; private ty = 0;
  private hover: SimNode | null = null;
  private selected: SimNode | null = null;
  private hidden = new Set<NodeType>();
  private query = '';
  private alpha = 1;
  private raf = 0;
  private dragging: SimNode | null = null;
  private panning: { x: number; y: number; tx: number; ty: number } | null = null;
  private moved = false;
  private dpr = 1;
  private w = 0; private h = 0;
  private ro: ResizeObserver | null = null;
  private born = performance.now();

  constructor(private canvas: HTMLCanvasElement, graph: Graph, private opts: GraphViewOptions = {}) {
    this.ctx = canvas.getContext('2d')!;
    this.setGraph(graph);
    this.bind();
    this.resize();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.loop();
  }

  setGraph(g: Graph) {
    const prev = new Map(this.nodes.map((n) => [n.id, n]));
    this.nodes = g.nodes.map((n, i) => {
      const p = prev.get(n.id);
      const ang = i * 2.399963, rad = 30 + Math.sqrt(i) * 26;
      return { ...n, x: p?.x ?? Math.cos(ang) * rad, y: p?.y ?? Math.sin(ang) * rad, vx: 0, vy: 0, deg: 0 };
    });
    this.byId = new Map(this.nodes.map((n) => [n.id, n]));
    this.adj = new Map();
    this.edges = [];
    for (const e of g.edges) {
      const s = this.byId.get(e.source), t = this.byId.get(e.target);
      if (!s || !t) continue;
      this.edges.push({ s, t, kind: e.kind });
      s.deg++; t.deg++;
      (this.adj.get(s.id) ?? this.adj.set(s.id, new Set()).get(s.id)!).add(t.id);
      (this.adj.get(t.id) ?? this.adj.set(t.id, new Set()).get(t.id)!).add(s.id);
    }
    const firm = this.byId.get('firm');
    if (firm) { firm.fx = 0; firm.fy = 0; }
    this.alpha = 1;
    // Settle most of the layout before the first paint when motion is reduced.
    if (this.opts.reducedMotion) for (let i = 0; i < 280; i++) this.tick();
  }

  setHidden(types: NodeType[]) { this.hidden = new Set(types); this.alpha = Math.max(this.alpha, 0.3); }
  setQuery(q: string) {
    this.query = q.trim().toLowerCase();
    if (this.query) {
      const hit = this.nodes.find((n) => n.label.toLowerCase().includes(this.query) || n.sub.toLowerCase().includes(this.query));
      if (hit) this.focus(hit.id);
    }
  }
  focus(id: string) {
    const n = this.byId.get(id);
    if (!n) return;
    this.select(n);
    this.animateTo(-n.x * Math.max(this.scale, 1.4), -n.y * Math.max(this.scale, 1.4), Math.max(this.scale, 1.4));
  }
  reset() { this.select(null); this.fit(true); }
  destroy() { cancelAnimationFrame(this.raf); this.ro?.disconnect(); this.unbind(); }

  // ------------------------------------------------------------ simulation
  private tick() {
    const ns = this.nodes, a = this.alpha;
    // Repulsion (O(n²) is fine for a few hundred nodes).
    for (let i = 0; i < ns.length; i++) {
      const p = ns[i];
      if (this.hidden.has(p.type)) continue;
      for (let j = i + 1; j < ns.length; j++) {
        const q = ns[j];
        if (this.hidden.has(q.type)) continue;
        let dx = q.x - p.x, dy = q.y - p.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 0.5; }
        if (d2 > 90000) continue;
        const f = (-(p.size + q.size) * 22 * a) / d2;
        const d = Math.sqrt(d2);
        const fx = (dx / d) * f, fy = (dy / d) * f;
        p.vx += fx; p.vy += fy; q.vx -= fx; q.vy -= fy;
      }
    }
    // Springs.
    for (const e of this.edges) {
      if (this.hidden.has(e.s.type) || this.hidden.has(e.t.type)) continue;
      const dx = e.t.x - e.s.x, dy = e.t.y - e.s.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const rest = 18 + (e.s.size + e.t.size) * 2.2;
      const k = (0.06 * a * (d - rest)) / d / Math.max(1, Math.min(e.s.deg, e.t.deg) * 0.35);
      e.s.vx += dx * k; e.s.vy += dy * k; e.t.vx -= dx * k; e.t.vy -= dy * k;
    }
    for (const n of ns) {
      n.vx -= n.x * 0.004 * a; n.vy -= n.y * 0.004 * a; // gentle gravity
      if (n.fx != null) { n.x = n.fx; n.vx = 0; } else { n.vx *= 0.58; n.x += n.vx; }
      if (n.fy != null) { n.y = n.fy; n.vy = 0; } else { n.vy *= 0.58; n.y += n.vy; }
    }
    this.alpha = Math.max(0.02, this.alpha * 0.985);
  }

  // ---------------------------------------------------------------- render
  private colors() {
    const dark = this.opts.dark ? this.opts.dark() : true;
    return dark
      ? { edge: 'rgba(160,175,170,0.16)', edgeHi: 'rgba(69,189,153,0.8)', text: '#e6ebea', faint: '#7b8582', ring: '#0e1011' }
      : { edge: 'rgba(40,60,52,0.13)', edgeHi: 'rgba(29,125,95,0.85)', text: '#16201c', faint: '#6b7377', ring: '#ffffff' };
  }

  private toneColor(n: SimNode): string {
    if (n.type === 'FINDING' || n.type === 'RISK' || n.type === 'ENGAGEMENT' || n.type === 'GAP' || n.type === 'DOCUMENT') {
      const t = n.tone;
      if (t === 'critical') return '#e05663';
      if (t === 'high') return '#e08a3c';
      if (t === 'medium') return '#cfae4a';
      if (t === 'good' && n.type !== 'ENGAGEMENT') return '#2bc23b';
      if (n.type === 'DOCUMENT') return NODE_META.DOCUMENT.color;
    }
    return NODE_META[n.type].color;
  }

  private draw() {
    const { ctx, w, h } = this;
    const c = this.colors();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w / 2 + this.tx, h / 2 + this.ty);
    ctx.scale(this.scale, this.scale);

    const focus = this.selected ?? this.hover;
    const near = focus ? this.adj.get(focus.id) ?? new Set<string>() : null;
    const matches = this.query ? new Set(this.nodes.filter((n) => n.label.toLowerCase().includes(this.query) || n.sub.toLowerCase().includes(this.query)).map((n) => n.id)) : null;
    const age = Math.min(1, (performance.now() - this.born) / 900);

    ctx.lineWidth = 1 / this.scale;
    for (const e of this.edges) {
      if (this.hidden.has(e.s.type) || this.hidden.has(e.t.type)) continue;
      const hi = focus && (e.s === focus || e.t === focus);
      ctx.strokeStyle = hi ? c.edgeHi : c.edge;
      ctx.globalAlpha = (focus && !hi ? 0.35 : 1) * age;
      ctx.lineWidth = (hi ? 1.8 : 1) / this.scale;
      ctx.beginPath(); ctx.moveTo(e.s.x, e.s.y); ctx.lineTo(e.t.x, e.t.y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const t = performance.now() / 1000;
    for (const n of this.nodes) {
      if (this.hidden.has(n.type)) continue;
      const dim = (focus && n !== focus && !near!.has(n.id)) || (matches && !matches.has(n.id));
      const r = n.size * (n === this.hover ? 1.25 : 1) * (0.4 + 0.6 * age);
      ctx.globalAlpha = dim ? 0.18 : 1;
      if (n.tone === 'critical' && !dim && !this.opts.reducedMotion) {
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 3 + Math.sin(t * 3) * 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(224,86,99,0.18)'; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = this.toneColor(n); ctx.fill();
      ctx.lineWidth = (n === this.selected ? 3 : 1.5) / this.scale;
      ctx.strokeStyle = n === this.selected ? c.edgeHi : c.ring; ctx.stroke();
      const showLabel = n.size >= 11 || n === focus || (near && near.has(n.id)) || (matches && matches.has(n.id)) || this.scale > 1.9;
      if (showLabel && !dim) {
        ctx.font = `${n.size >= 14 ? 600 : 500} ${Math.max(9, 11 / Math.sqrt(this.scale))}px ui-sans-serif, system-ui, sans-serif`;
        ctx.fillStyle = c.text; ctx.textAlign = 'center';
        const label = n.label.length > 34 ? `${n.label.slice(0, 32)}…` : n.label;
        ctx.fillText(label, n.x, n.y + r + 11 / Math.sqrt(this.scale) + 2);
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private loop = () => {
    if (this.alpha > 0.021 || this.dragging) this.tick();
    this.draw();
    this.raf = requestAnimationFrame(this.loop);
  };

  // ----------------------------------------------------------- interaction
  private resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    if (!this.fitted) { setTimeout(() => this.fit(false), this.opts.reducedMotion ? 0 : 1300); this.fitted = true; }
  }
  private fitted = false;

  fit(animate: boolean) {
    const vis = this.nodes.filter((n) => !this.hidden.has(n.type));
    if (!vis.length || !this.w) return;
    const xs = vis.map((n) => n.x), ys = vis.map((n) => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const s = Math.min(2.2, Math.max(0.25, Math.min(this.w / (maxX - minX + 80), this.h / (maxY - minY + 80))));
    const tx = -((minX + maxX) / 2) * s, ty = -((minY + maxY) / 2) * s;
    if (animate) this.animateTo(tx, ty, s); else { this.scale = s; this.tx = tx; this.ty = ty; }
  }

  private animateTo(tx: number, ty: number, s: number) {
    if (this.opts.reducedMotion) { this.tx = tx; this.ty = ty; this.scale = s; return; }
    const from = { tx: this.tx, ty: this.ty, s: this.scale }, t0 = performance.now(), dur = 520;
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      this.tx = from.tx + (tx - from.tx) * e; this.ty = from.ty + (ty - from.ty) * e; this.scale = from.s + (s - from.s) * e;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private world(ev: { clientX: number; clientY: number }) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left - this.w / 2 - this.tx) / this.scale, y: (ev.clientY - r.top - this.h / 2 - this.ty) / this.scale };
  }
  private pick(ev: { clientX: number; clientY: number }): SimNode | null {
    const p = this.world(ev);
    let best: SimNode | null = null, bd = Infinity;
    for (const n of this.nodes) {
      if (this.hidden.has(n.type)) continue;
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < Math.max(n.size + 4, 10 / this.scale) && d < bd) { best = n; bd = d; }
    }
    return best;
  }
  private select(n: SimNode | null) {
    this.selected = n;
    const nb = n ? [...(this.adj.get(n.id) ?? [])].map((id) => this.byId.get(id)!).filter(Boolean) : [];
    this.opts.onSelect?.(n, nb);
  }

  private onDown = (ev: PointerEvent) => {
    this.canvas.setPointerCapture(ev.pointerId);
    this.moved = false;
    const n = this.pick(ev);
    if (n) { this.dragging = n; const p = this.world(ev); n.fx = p.x; n.fy = p.y; this.alpha = Math.max(this.alpha, 0.25); }
    else this.panning = { x: ev.clientX, y: ev.clientY, tx: this.tx, ty: this.ty };
  };
  private onMove = (ev: PointerEvent) => {
    if (this.dragging) { const p = this.world(ev); this.dragging.fx = p.x; this.dragging.fy = p.y; this.moved = true; return; }
    if (this.panning) { this.tx = this.panning.tx + ev.clientX - this.panning.x; this.ty = this.panning.ty + ev.clientY - this.panning.y; this.moved = true; return; }
    const h = this.pick(ev);
    if (h !== this.hover) { this.hover = h; this.canvas.style.cursor = h ? 'pointer' : 'grab'; }
  };
  private onUp = (ev: PointerEvent) => {
    const n = this.dragging;
    if (n && n.id !== 'firm') { n.fx = null; n.fy = null; }
    if (!this.moved) this.select(this.pick(ev));
    this.dragging = null; this.panning = null;
  };
  private onWheel = (ev: WheelEvent) => {
    ev.preventDefault();
    const r = this.canvas.getBoundingClientRect();
    const mx = ev.clientX - r.left - this.w / 2, my = ev.clientY - r.top - this.h / 2;
    const k = Math.exp(-ev.deltaY * 0.0015);
    const s = Math.min(5, Math.max(0.2, this.scale * k));
    this.tx = mx - ((mx - this.tx) * s) / this.scale;
    this.ty = my - ((my - this.ty) * s) / this.scale;
    this.scale = s;
  };
  private onLeave = () => { this.hover = null; };
  private onKey = (ev: KeyboardEvent) => { if (ev.key === 'Escape') this.select(null); };

  private bind() {
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointerleave', this.onLeave);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
    this.canvas.addEventListener('keydown', this.onKey);
    this.canvas.style.touchAction = 'none';
    this.canvas.style.cursor = 'grab';
  }
  private unbind() {
    this.canvas.removeEventListener('pointerdown', this.onDown);
    this.canvas.removeEventListener('pointermove', this.onMove);
    this.canvas.removeEventListener('pointerup', this.onUp);
    this.canvas.removeEventListener('pointerleave', this.onLeave);
    this.canvas.removeEventListener('wheel', this.onWheel);
    this.canvas.removeEventListener('keydown', this.onKey);
  }
}
