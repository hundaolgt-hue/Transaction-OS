#!/usr/bin/env bash
# Full pipeline: serve → render frames in parallel → concat → add grain + soundtrack → master MP4,
# a <30 MB share copy when needed, and a QA contact sheet pulled from the FINAL file.
#
# Usage: render_video.sh <project_dir> <page.html> <duration_s> <score.wav> <out_basename> [workers=4] [fps=60]
#   project_dir  folder holding the page, fonts/, images (served over HTTP; file:// breaks fonts)
#   out_basename e.g. /home/user/repo/marketing/foo/Foo_Amharic_20s  (writes .mp4, _share.mp4, _qa.jpg)
# Env: SEG_DIR=<dir>  keep segments there (default <project_dir>/seg) so a fix can re-render one part.
#      ONLY="3"        re-render only these segment indices (space-separated), reuse the rest, then re-mux.
set -euo pipefail
DIR=$(cd "$1" && pwd); PAGE=$2; DUR=$3; WAV=$4; OUT=$5; W=${6:-4}; FPS=${7:-60}
HERE=$(cd "$(dirname "$0")" && pwd)
export NODE_PATH=${NODE_PATH:-$(npm root -g)}
# Find (or start) a server that serves THIS folder. Another project may already hold 8765 with its own
# index.html, so identify the folder by a marker file instead of trusting a 200. The server also dies when
# the container restarts. Check over HTTP, never with `pgrep -f` (it matches its own shell).
echo "$DIR" > "$DIR/.serve_id"; PORT=""
for p in $(seq 8765 8785); do
  ID=$(curl -s --noproxy '*' --max-time 2 http://127.0.0.1:$p/.serve_id || true)
  if [ "$ID" = "$DIR" ]; then PORT=$p; break; fi
done
if [ -z "$PORT" ]; then
  for p in $(seq 8765 8785); do
    if ! curl -s --noproxy '*' --max-time 1 -o /dev/null http://127.0.0.1:$p/; then PORT=$p; break; fi
  done
  (cd "$DIR" && setsid nohup python3 -m http.server $PORT --bind 127.0.0.1 >/dev/null 2>&1 &)
  sleep 1
fi
export URL=http://127.0.0.1:$PORT/$PAGE; echo "serving $DIR on :$PORT"
TOTAL=$(python3 -c "print(round($DUR*$FPS))"); PER=$(( (TOTAL + W - 1) / W ))
SEG=${SEG_DIR:-$DIR/seg}; mkdir -p "$SEG"
echo "segments: $SEG ($W x $PER frames)"; mkdir -p "$(dirname "$OUT")"
PIDS=()
for i in $(seq 0 $((W-1))); do
  if [ -n "${ONLY:-}" ] && [[ " $ONLY " != *" $i "* ]]; then continue; fi
  S=$((i*PER)); E=$(( (i+1)*PER < TOTAL ? (i+1)*PER : TOTAL ))
  node "$HERE/render.js" $S $E "$SEG/s$i.mp4" $FPS > "$SEG/log$i.txt" 2>&1 &
  PIDS+=($!)
done
# wait only for the workers: a bare `wait` would also wait on the http.server started above and hang forever
for pid in "${PIDS[@]}"; do wait "$pid"; done
if grep -qi err "$SEG"/log*.txt 2>/dev/null; then echo "Page errors:"; grep -i err "$SEG"/log*.txt; fi
: > "$SEG/list.txt"; for i in $(seq 0 $((W-1))); do echo "file '$SEG/s$i.mp4'" >> "$SEG/list.txt"; done
N=0; for i in $(seq 0 $((W-1))); do N=$((N + $(ffprobe -v error -count_frames -select_streams v -show_entries stream=nb_read_frames -of csv=p=0 "$SEG/s$i.mp4"))); done
echo "frames rendered: $N / $TOTAL"
ffmpeg -loglevel error -y -f concat -safe 0 -i "$SEG/list.txt" -i "$WAV" \
  -filter_complex "[0:v]noise=alls=6:allf=t+u,format=yuv420p[v]" -map "[v]" -map 1:a \
  -c:v libx264 -preset medium -crf 17 -profile:v high -r $FPS -c:a aac -b:a 256k -movflags +faststart -shortest "$OUT.mp4"
SIZE=$(stat -c %s "$OUT.mp4"); echo "master: $OUT.mp4 ($((SIZE/1048576)) MB)"
# Chat uploads cap at 30 MB: make a two-pass copy at ~28 MB total when the master is bigger.
if [ "$SIZE" -gt 30000000 ]; then
  KB=$(python3 -c "print(int((28*8192)/$DUR - 256))")
  F="[0:v]noise=alls=4:allf=t,format=yuv420p[v]"
  ffmpeg -loglevel error -y -f concat -safe 0 -i "$SEG/list.txt" -filter_complex "$F" -map "[v]" -c:v libx264 -preset slow -b:v ${KB}k -maxrate $((KB*16/10))k -bufsize $((KB*2))k -pass 1 -passlogfile "$SEG/p" -an -f mp4 /dev/null
  ffmpeg -loglevel error -y -f concat -safe 0 -i "$SEG/list.txt" -i "$WAV" -filter_complex "$F" -map "[v]" -map 1:a -c:v libx264 -preset slow -b:v ${KB}k -maxrate $((KB*16/10))k -bufsize $((KB*2))k -pass 2 -passlogfile "$SEG/p" -c:a aac -b:a 192k -movflags +faststart -shortest "${OUT}_share.mp4"
  echo "share copy: ${OUT}_share.mp4 ($(( $(stat -c %s "${OUT}_share.mp4")/1048576 )) MB)"
fi
# QA contact sheet: 12 frames spread across the final file.
Q=$(mktemp -d "${TMPDIR:-/tmp}/qa.XXXX")
for k in $(seq 0 11); do T=$(python3 -c "print(round(($k+0.5)*$DUR/12,2))"); ffmpeg -loglevel error -y -ss $T -i "$OUT.mp4" -frames:v 1 -vf scale=300:-1 "$Q/$(printf %02d $k).png"; done
ffmpeg -loglevel error -y -pattern_type glob -i "$Q/*.png" -vf tile=6x2 "${OUT}_qa.jpg"
echo "qa sheet: ${OUT}_qa.jpg"
