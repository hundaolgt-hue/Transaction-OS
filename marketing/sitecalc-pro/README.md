# SiteCalc Pro — Amharic 20 s ad (1080×1920, 60 fps)

Marketing angle and copy from the two SiteCalc Pro posters; proof points (62 calculators, 191 verified tests,
EN/አማ, no macros, Excel · Google Sheets · LibreOffice) from the User Guide.

- `index_sc.html` — the five scenes; `window.renderAt(t)` draws any moment. Photos in `sc/` are cropped from the posters.
- `score_sc.py` — soundtrack (`score_sc.wav`), synced to the scenes.
- Render: serve this folder (`python3 -m http.server 8765`), then
  `for i in 0 1 2 3; do PAGE=index_sc.html node render.js $((i*300)) $(((i+1)*300)) seg/s$i.mp4 60 & done; wait`
  and mux the four segments with `score_sc.wav` (see ../launch-video/README.md for the ffmpeg line).
