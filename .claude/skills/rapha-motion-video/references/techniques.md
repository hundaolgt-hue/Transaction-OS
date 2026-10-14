# Scene recipes

Each recipe was used in a delivered video. They're snippets to adapt inside the template's
`scene(build, update)` pattern: build creates DOM once, update sets every property from `lt` (local time),
so any frame renders identically in any order. Never use CSS animations/transitions or `Date.now()`.

## Contents
1. Kinetic headline · 2. 3D card settle · 3. Count-ups · 4. Spreadsheet window recreation ·
5. Real screenshot with camera + highlight (tutorials) · 6. Line-art illustration that draws itself ·
7. Domino chain with contact physics · 8. Helix of 3D cards · 9. Charts (bars, S-curve, donut, Gantt) ·
10. Paper/receipt/phone props · 11. Ring of steps · 12. Typewriter · 13. Photo backgrounds · 14. CTA end card

## 1. Kinetic headline
`words()` + `reveal(wrap, lt, t0, {st:.12, d:1.0, dy:60, bl:20, sc:.04})`: words rise, unblur and settle with
expo-out. Accent words with `*`. Problem lines in white, the turn/answer in the gold gradient.
Sizes at 1080 px width: hook 110–150 px weight 900; section titles 70–90 px; captions 36–52 px.
Amharic runs wider than Latin (~0.95 em per glyph), so check that 2-line headlines fit in 936 px.

## 2. 3D card settle (premium "slow-mo" feel)
Wrap in `perspective:2200px`, then
`tf(card,{rx:L(26,0,p)+Math.sin(lt*.8)*.8, ry:L(-14,0,p), y:L(200,0,p), z:L(-400,0,p), o:...})` with
`p=E.oQ(P(lt,0,2.4))`. The long quint ease and the tiny sine drift give the expensive look. Add a soft-light
sheen sweeping across once (`shimmer()` with left animated by ioC).

## 3. Count-ups
`el.textContent = fmt(value*E.ioC(P(lt,t0,t0+1.4)))`; highlight in accent while counting
(`color = p>0&&p<1 ? '#FFD596' : '#fff'`), then a small scale pop and glow on landing.

## 4. Spreadsheet window recreation (when no screen recording exists)
`.win` = white rounded panel, navy header 92 px with sheet number + Amharic title (from cell B3), amber rule,
table rows with mono item codes and tabular numbers, cream input cell. Typing: caret blinks
`Math.floor(lt*2.5)%2`, value appears at time X, Enter = amber flash ring + clack sound. Then glowing SVG
connectors (`stroke-dasharray` pathLength 1 + a dot riding `getPointAtLength`) carry the change to
dependent panels, each lighting up, number rolling, ✓ popping. Say in your report that it's a recreation.

## 5. Real screenshots: camera + highlight (tutorials)
Extract with `pdfimages -j -p guide.pdf img/g` (keep the sRGB ones). Put the image inside a fixed viewport
(960×800) and transform an inner div: `s = 960/cropW*z; tx = 480-(cx-x0)*s; ty = hh/2-(cy-y0)*s`, clamped
so the image always covers the viewport. If the image is shorter than the viewport at z=1, raise z until
`cropH*s ≥ hh`, or you get white bands. Moves are a list `[t0,t1,cx,cy,z]` interpolated with ioC.
Highlight boxes live in image coordinates inside the same transformed div with
`box-shadow:0 0 0 4000px rgba(4,9,18,.42), 0 0 26px rgba(255,181,71,.9)` (a spotlight), border width
`3/s` so it stays 3 px on screen. Keep zoom ≤ ~1.8× native or the text goes soft.

## 6. Line-art illustration that draws itself
SVG paths with `pathLength=1 stroke-dasharray="1 1"`, `stroke-dashoffset = 1-E.ioC(P(lt,i*.06,1.2+i*.06))`.
Used for an empty site (mixer truck with a rotating striped drum clipped to an ellipse, crane with a
swinging hook, rebar columns), a half-built B+G+8 with ghost dashed upper floors, and a bank façade.
Faces and people look cheap in line art; use objects (calculator, hard hat, notebook) instead.

## 7. Domino chain with real contact
Dominoes W=110, H=420, pitch 168, rotating about the bottom-right corner (`transform-origin:100% 100%`).
Free fall `θ=π/2·a²`. Domino i rests on i+1 at `contact(φ)`, found by bisecting where its top-right corner
meets the next domino's left face. Each frame: `a[N-1]=free; a[i]=min(free_i, contact(a[i+1]))`.
Next start time = when free reaches `asin(gap/H)`, so the cascade timing is physical. Sync a wooden
`clack` to each contact time, compute the same times in Python for the score, and add a floor slam at the end.

## 8. Helix of 3D cards (e.g. "80 forms")
Cards `rotateY(i*30) translateZ(R) translateY((i-n/2)*16)` inside a `preserve-3d` ring rotating slowly.
Opacity from `cos(angle+rot)` so back cards fade; front-most cards get an amber border and glow.
Perspective 2600 and R 540 keep front cards readable; closer perspectives make them huge.

## 9. Charts
Bars: `scaleY(E.oB(...))` with `transform-origin` at the baseline, staggered 0.07 s. Curves: Catmull-Rom
sample → `partial(pts,u)` → rebuild the path each frame, with a glowing head dot and a value tag riding it.
Donut: one circle per segment, `pathLength=1`, dasharray `${v-gap} 1`, rotated to its start angle.
Gantt: bars `scaleX`, critical path as one SVG path drawn with dashoffset, data-date line sweeping.
Keep negative bars and line minima clear of tabs/labels below the chart.

## 10. Props: receipts, notebook, phone
Receipt = cream div with a zigzag `:after`, falling with `y = y0 + k²·170 + k·120`, sway and rotation.
Fade them out before they reach captions. Notebook lines "write" via `clip-path: inset(0 X% 0 0)`.
Phone chat bubbles pop with oB. Crumple a paper with `rz`, `sx` wobble and shrink, plus a `crumple` sound.

## 11. Ring of steps (monthly cycle)
Five nodes on a circle; an arc `stroke-dasharray` grows with ioS and a comet dot rides it; each node lights
amber as the arc passes and the center counter shows n/5. Place labels by hand (top, right-below,
bottom-right, bottom-left, left-below), not radially; radial labels collided with the nodes.

## 12. Typewriter
`[...text].slice(0,n)` with `n` from `P(lt,a,b)`, a blinking caret, and a keyclick every 0.1 s in the score.

## 13. Photo backgrounds (user posters)
Crop with ImageMagick above any baked-in text, buttons or cards
(`convert in.webp -crop WxH+X+Y +repage -filter Lanczos -resize 1080x -unsharp 0x0.8+0.6+0.02`). Place the
photo in a band and fade it into the background colour top and bottom with a gradient; put text in the
faded area. Slow Ken Burns: `scale 1+lt*.02`. Heavily blurred full poster = atmospheric backdrop.

## 14. CTA end card
Wordmark (or logo mark drawing itself), one tagline, gold pill button popping with oB plus a shimmer sweep
and an arrow nudging `10*max(0,sin((lt-x)*6))`, and a small platforms/languages line. Fade the whole stage
to black over the last 0.4 s.
