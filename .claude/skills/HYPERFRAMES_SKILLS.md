# HyperFrames skills (vendored)

The 21 published skills from https://github.com/heygen-com/hyperframes (`skills/`), copied at commit
`4e6fcdb3a9f310a9c483622d6a4ca5354a63fb22` (2026-10-16). License: Apache-2.0, see HYPERFRAMES_LICENSE.txt.
They are copied into the repo so they survive cloud-container resets.

Start with `/hyperframes` (the router); it picks a workflow and loads the domain skills
(`hyperframes-core`, `-animation`, `-creative`, `-keyframes`, `-audio`, `-cli`, `-registry`, `-studio`, `media-use`).
They drive the `npx hyperframes` CLI (checked working here: v0.8.164, Node 22).

Rapha product videos: the brand rules and verified facts in `rapha-motion-video/references/brands.md` apply whichever
engine renders the video.

Update to the latest: re-copy `skills/*` from a fresh clone of the repo, or run `npx hyperframes skills update`
(that installs into the user-level skills folder, which a cloud container does not keep).
