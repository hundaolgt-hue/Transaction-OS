---
name: rapha-motion-video
description: Make premium, Apple-launch-style vertical (1080×1920, 60 fps) motion-graphics videos in Amharic or English, coded as an HTML/JS timeline, rendered frame by frame with headless Chromium + ffmpeg, with an original synthesized soundtrack. Built for Rapha's construction products (ProjectControl, SiteCalc Pro, ProfitCheck), driven by the real numbers in their Excel/PDF files and posters. Use it whenever the user asks for a product launch video, ad, reel, short, promo, explainer or tutorial video, gives a script with timings ("0–3 s …"), wants "another video with a different angle", or attaches an xlsx/pdf/poster and asks for a video, even if they don't say "motion graphics". Prefer it over AI video generation when the video must show exact numbers, sheets, Amharic text or brand rules.
---

# Rapha motion-graphics video

Turn a product (workbook, guide PDF, posters, a script) into a 20–60 s vertical video that looks like a
premium launch film: kinetic typography, 3D cards that settle in slow motion, real numbers counting up,
recreated sheets, and a soundtrack whose hits land on the cuts. Everything is code, so every frame is
exact, the Amharic renders correctly, and you can fix a single scene and re-render only that part.

The bundled pieces:
- `assets/template.html`: the engine (scene manager, easing, word reveals, 3D helpers, background,
  flashes, fade-out) plus a working 3-scene demo. Copy it and replace the SCENES block.
- `scripts/fetch_fonts.py`: Inter, Montserrat, Noto Sans Ethiopic 100–900 and JetBrains Mono, local.
- `scripts/preview.js`: still frames at chosen times for review.
- `scripts/render_video.sh`: server → parallel render → grain + audio → master, a <30 MB share copy, QA sheet.
- `scripts/score_lib.py`: synth instruments, music bed and transitions for the soundtrack.
- `references/brands.md`: per-product names, colours, CTAs, rules and verified facts. **Read it first**
  for any Rapha product, because the user has corrected names and claims before.
- `references/techniques.md`: recipes for every scene type used so far (domino physics, screenshot
  camera + spotlight, Gantt/S-curve/donut, line-art drawings, helix, typewriter, props, CTA).

## Workflow

### 1. Gather the truth before designing
Read every attachment. Numbers on screen should come from the files; invented ones need labelling.
- **xlsx:** `openpyxl` (pip install if missing). Formulas often have no cached values, and LibreOffice may
  refuse to open the file here, so read the inputs and compute what you need (e.g. BOQ total = Σ qty × rate,
  budget vs actual per item). Keep a note of which numbers you computed and how.
- **PDF:** `pdftotext -layout` for copy; `pdfimages -j -p` for real screenshots (drop Gray smasks) to use in
  tutorials. Prefer the document's own Amharic headings and the workbook's own Amharic sheet titles
  (cell B3) over your own translations.
- **Posters/images:** take the marketing angle, copy, numbers, palette and type style from them; crop photos
  above baked-in text if you reuse them.
- If the user gives a script with timings, follow it beat for beat and keep their exact wording.
  If they ask for "the script first", stop after writing it (Amharic + English gloss + on-screen action
  per beat) and wait for approval or corrections before building anything.

### 2. Storyboard (in your head or briefly in chat)
A proven 20 s shape: **hook (problem, 3 s) → tension (3–5 s) → product turn → proof with real numbers
(5–7 s) → CTA (3 s)**. Longer launch films add 1 scene per feature. Tutorials use chapters with a progress
rail. When asked for "a different angle", pick a story the previous videos didn't use (see brands.md
for which angles exist) and tell the user which one you chose.

### 3. Build the composition
```bash
P=<scratchpad>/video_<name>; mkdir -p $P && cp <skill>/assets/template.html $P/index.html
python3 <skill>/scripts/fetch_fonts.py $P          # writes $P/fonts/fonts.css
```
Edit brand tokens in `:root`, write scenes (see techniques.md), set `DURATION` and `CUTS`.
Principles that made the videos look premium:
- Long ease-outs (`E.oE`, `E.oQ`, 1–2.4 s) and a small continuous drift on everything, so nothing ever snaps
  or stands still. Use pops (`E.oB`) only for chips, badges and buttons.
- Scenes overlap ~0.3 s; the engine blurs and scales between them. Add a faint white flash on each cut.
- One idea per scene, big type, generous margins (72 px). Accent only the key words.
- Depth: perspective + rotateX/Y that settles to flat; soft glows; vignette; ffmpeg grain at the end.
- Show the product. Recreate sheets in the workbook's own style or use real screenshots with a camera
  move and spotlight; never fake a screenshot of something that doesn't exist without saying so.

### 4. Preview stills, look, fix (repeat)
```bash
cd $P && (setsid nohup python3 -m http.server 8790 --bind 127.0.0.1 >/dev/null 2>&1 &)   # any free port; one per project
NODE_PATH=$(npm root -g) URL=http://127.0.0.1:8790/index.html node <skill>/scripts/preview.js prev 1.5 4.2 7.0 ...
ffmpeg -loglevel error -y -i prev/f_1.50.png -i prev/f_4.20.png -filter_complex "[0][1]hstack=2,scale=1400:-1" prev/sheet.jpg
```
Then Read the sheet image, and view important frames at full size too. Look for: overlaps
(text vs charts, falling props vs captions), clipped or wrapping labels, white letterbox bands on
screenshots, invisible text (gradient clipping, same-colour text on a same-colour background), tofu boxes in Amharic, and
elements too small to read on a phone. Fix and re-preview before rendering.

### 5. Soundtrack
Write `score.py` next to the page:
```python
import sys; sys.path.insert(0, '<skill>/scripts'); from score_lib import Score, midi
sc = Score(20.0)
cuts = [3.0, 8.0, 15.0]                                # = scene starts after 0
sc.bed(starts=[0]+cuts, chords=[[38,50,53,57,60],[46,50,53,58,61],[41,48,53,57,60,67,69],[38,50,57,62,66,69,76]],
       bpm=108, beat_from=8.0, beat_to=19.4)            # minor while showing the problem, major once the product arrives
sc.transitions(cuts)                                   # whoosh into + impact on each cut
sc.add(1.2, sc.impact(0.8), 0.32, send=.4)             # headline landing
for i in range(6): sc.add(9.2+i*.32, sc.tick(2800+i*160, .8), 0.08)   # one tick per row/card landing
sc.finish('score.wav'); print(sc.report())
```
Put a sound on every visible event at its exact time (typing, counters, rows, stamps, domino contacts,
button pop) and keep the UI sounds quiet (gain 0.03–0.09). If the timing comes from a formula (like the
domino cascade), compute it the same way in Python. You can't listen here: check `report()` (about −15 dB
average, no second above −8 dB) and optionally a spectrogram
(`ffmpeg -i score.wav -lavfi showspectrumpic=s=1200x400 spec.png`). Harsh bright full-height columns mean
the whooshes or noise are too loud.

### 6. Render and QA the final file
```bash
bash <skill>/scripts/render_video.sh $P index.html 20 $P/score.wav <repo>/marketing/<product>/<Name>_Amharic_20s
```
That's ~0.15 s per frame per worker. A 20 s video at 60 fps takes ~5–8 min with 4 workers; launch longer
ones in the background. Then Read `<Name>_qa.jpg` (12 frames pulled from the *final* mp4). If one
scene needs a fix, re-render only the segment that contains it instead of everything: segments are kept in
`$P/seg` (the script prints how many frames each covers), so run the same command with `ONLY="3"` (segment
indices, space-separated) and it reuses the others and re-muxes.

### 7. Deliver
- Send the file with SendUserFile (`display: render`). Chat uploads cap at **30 MB**: send `_share.mp4`
  when it exists and keep the master path in the message.
- Commit the source (page, score.py, fonts, images, a README with render commands) under
  `marketing/<product>/` with `*.mp4` in .gitignore; push to the session branch.
- Report back in a scene-by-scene table: time | line | what's on screen. Then the honest list: which numbers
  are real (and where from), which you computed, which are illustrative; any recreated UI; the lines you
  wrote yourself that a native Amharic speaker should check; and that you couldn't listen to the audio.

## Amharic specifics
- Fonts: Noto Sans Ethiopic for all Ge'ez text (weights to 900 for headlines). Inter/Montserrat for Latin and
  numbers. Mono fonts have no Ethiopic glyphs, so labels in Amharic must not use the mono class.
- Never apply negative letter-spacing or uppercase tracking to Ethiopic. Line-height ≥1.22.
- Keep Western digits for numbers unless asked. Use ። and ፣ correctly. Mixed lines like "በProjectControl"
  render fine.
- In `words()`, a lone `/` is a line break. A slash that means "or" must touch a word: `አዋጭ/ በድንበር ላይ/ …`.
- Emoji don't render in this Chromium; use glyphs (▣ ✓ → ●) or SVG icons.

## Pitfalls that cost time before
- **file:// breaks web fonts.** Always serve over HTTP. In fonts.css, `url()` paths are relative to the CSS
  file. Load fonts explicitly before frame 0 (the scripts do), or the first frames use fallback faces.
- **The local server dies when the container restarts.** If preview says ERR_CONNECTION_REFUSED, restart it.
  Never wait on a process with `pgrep -f <name>` in a loop, because it matches its own shell and never exits.
- **PNG capture is ~1 s/frame; JPEG q96 is ~0.15 s.** Grain comes from ffmpeg `noise`, not a canvas.
- **Gradient-clipped text:** put the gradient class on each animated span, not the parent.
- **`overflow:hidden` on a 0-height container hides everything.** Give tables explicit heights.
- Charts inside cards: negative bars and line minima collide with tab rows below; leave room.
- Wide screenshots (Gantt, cash flow) need higher zoom to fill a vertical viewport (no white bands).
- Falling/flying elements must fade before reaching captions or headlines.
- Re-check product names and CTAs against brands.md before rendering; a misspelt CTA means a re-render.
