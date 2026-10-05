# ProfitCheck — Amharic 20 s ad (1080×1920, 60 fps)

Copy from the four ProfitCheck ad copies (fear of loss → verdict → change one number → home estimate → CTA).
Brand rules: ProfitCheck wordmark only, no price, CTA "አሁኑኑ ያዉርዱ →". Figures are the sample values from the two posters;
the "−10% sale price" results in scene 4 are illustrative.

Serve this folder (`python3 -m http.server 8765`), render 4 × 300 frames with `PAGE=index_pf.html node render.js …`,
then mux with `score_pf.wav` from `python3 score_pf.py`.

## Bank-ready ad — Amharic 20 s ("ብድሩን እንዴት ይመልሳሉ?")

Angle from Copy 3, kept as "prepares you for the bank" (no claim that banks accept the model). `index_pb.html`,
soundtrack `score_pb.py` → `score_pb.wav`, render with `PAGE=index_pb.html`. The loan schedule is a worked sample
(ETB 150M, 15%, 2-year interest-only grace, 8-year annuity); statement figures are placeholders.
