# Rapha ProjectControl — launch video (vertical 1080×1920, 60 fps, 60 s)

Motion-graphics composition built from `Rapha_ProjectControl_Sample.xlsx` (real BOQ items, trade totals,
activities, IPC measurements, actual costs, tests and register counts).

- `index.html` — deterministic timeline; `window.renderAt(t)` draws any moment.
- `score.py` — original soundtrack synthesized with numpy, synced to on-screen events (`score.wav`).
- `render.js` — Playwright frame capture → ffmpeg. Serve this folder first: `python3 -m http.server 8765`.

```bash
for i in 0 1 2 3; do node render.js $((i*900)) $(((i+1)*900)) seg/s$i.mp4 60 & done; wait
python3 score.py
printf "file 'seg/s%d.mp4'\n" 0 1 2 3 > list.txt
ffmpeg -f concat -safe 0 -i list.txt -i score.wav -filter_complex "[0:v]noise=alls=7:allf=t+u,format=yuv420p[v]" \
  -map "[v]" -map 1:a -c:v libx264 -crf 17 -c:a aac -b:a 256k -movflags +faststart -shortest launch.mp4
```

## Amharic 20 s cut

`am_scenes.js` holds the seven Amharic scenes and `am_sheets.json` the Amharic sheet titles taken from the workbook.
`index_am.html` is assembled from the engine in `index.html` plus `am_scenes.js`; render with `PAGE=index_am.html`
(4 × 300 frames) and mux with `score_am.wav` from `python3 score_am.py`.

## 50 s tutorial

Built from `Rapha_ProjectControl_Tutorial.pdf`: its screenshots are in `tut/` and the step text follows the tutorial.
`index_tut.html` (engine + `tut_scenes.js`); render 4 × 750 frames with `PAGE=index_tut.html`, then mux with
`score_tut.wav` from `python3 score_tut.py`.

## Domino ad — Amharic 25 s ("ሲሚንቶ ሁለት ቀን ዘገየ። ከዚያስ?")

`index_pc.html` (fonts: `fonts_pc.css`), soundtrack `score_pc.py` → `score_pc.wav`. Render 4 × 375 frames with
`PAGE=index_pc.html`. The domino fall uses a contact solver, so each tile leans on the next exactly.

## Profit ad — Amharic 20 s ("ፕሮጀክቱ አለቀ። ትርፉ የት ገባ?")

`index_pr.html` (fonts: `fonts_pc.css`), soundtrack `score_pr.py` → `score_pr.wav`. Render 4 × 300 frames with
`PAGE=index_pr.html`. Cost Report figures: budget = approved measured qty × direct cost/unit (rate build-up, or rate ÷ 1.10 ÷ 1.08);
actual = sum of 17 Actual Costs per item, from the sample workbook.
