# ferno.fun

A personal playground of shenanigans. Pixel-art inferno theme, live GPU fire that reacts to your cursor.

**Live:** https://jonferno.github.io/ferno.fun/
**Repo:** https://github.com/jonferno/ferno.fun

## What's here

```
index.html              landing + hub markup
music.html              the Suno track player page
css/style.css           the whole visual system
js/fire.js              WebGL2 fluid fire solver (the main event)
js/main.js              screen routing, embers, clock, toasts
js/music.js             the track list + shared audio player
js/tracks.js            the Suno catalogue (titles, durations, audio, covers)
assets/favicon.svg      pixel flame mark
server.mjs              local dev server (+ screenshot capture endpoint)
tools/verify.mjs        45-check interaction test suite
tools/fire-diag.mjs     fire coverage diagnostics across viewports
tools/scale-sweep.mjs   flame-height tuning sweep
tools/extract-suno.mjs  pulls the track catalogue from the Suno profile feed
tools/explode-capture.mjs  captures the click explosion frame by frame
tools/drag-capture.mjs  captures the held-drag behaviour frame by frame
```

## Pages

- **Landing** — the FERNO.fun wordmark and an ENTER button.
- **Hub** — X, Discord, GitHub, YouTube, plus Game Modding (planned) and
  Music Generation.
- **Music** — every Suno generation with a play button, cover art, genre,
  duration and a link to the track on Suno. Clicking a track plays it inline;
  playback continues to the next track when one ends.

## The music catalogue

`js/tracks.js` is generated from the public Suno profile feed for
`@jonferno` (10 tracks). `tools/extract-suno.mjs` re-pulls it.

One wrinkle worth knowing: the feed's `media_urls` point at an **encrypted**
`.m4a` (`content_type: "m4a-opus"`) that browsers refuse to decode — Chrome
reports `MEDIA_ERR_SRC_NOT_SUPPORTED`. Each song's `video_url` is a plain
MP4 with an AAC audio track, so that is what the player streams. The MP4 is
also what Suno itself uses for the shareable preview.

## Run it

```bash
npm install      # only needed for the test harness (puppeteer-core)
npm run dev      # http://localhost:4180
npm run verify   # interaction test suite
```

## The fire

`js/fire.js` is a GPU fluid solver in the style of the WebGL fluid demos: semi-Lagrangian
advection, Jacobi pressure projection for incompressibility, vorticity confinement to
keep the flame edges restless, and buoyancy driven by dye density.

Two things make it read as pixel art rather than a smooth WebGL demo:

1. **The simulation grid is decoupled from the screen.** Its height is fixed at 260 texels
   and the width follows the viewport aspect ratio, so a flame always covers the same
   fraction of the screen regardless of device. The grid is then upscaled with
   nearest-neighbour sampling.
2. **The density ramp is posterised into 7 bands**, with a cold blue bleed at the low-density
   edge so the flame has a blue-to-orange inferno gradient instead of a plain heat map.

`FLAME_SCALE` (override with `?scale=N`) controls how high the flames climb. The default
of `0.09` was picked by sweeping values across desktop, laptop, tablet and mobile viewports
with `tools/scale-sweep.mjs` and taking the value that held the fire to the bottom quarter
to third everywhere.

Mouse movement does **not** touch the simulation. The fire is click-driven:
a click detonates a burst of heat and upward velocity at that point, which
rises and dissipates over the next second or so. **Holding** the button and
dragging keeps feeding heat at the pointer and pushes the flow along with it,
so the flame follows your cursor and leaves a trail. Releasing stops it dead.

Tracking the pointer on hover made the flames appear to follow the mouse and
glitched when the pointer left the window mid-drag, so hover does nothing.

If WebGL2 or `EXT_color_buffer_float` is unavailable, the script falls back to a CPU
cell-based fire simulation that still responds to clicks.

## URL parameters

| Param | Effect |
|---|---|
| `?hub=1` | open straight into the destination list |
| `?static=1` | freeze entrance animations at their final state |
| `?pdb=1` | preserve the drawing buffer (needed for pixel readback) |
| `?scale=N` | override the flame height scale |
| `?view=dye` | show raw dye channels instead of the palette |
| `?debug=1` | log renderer info and capture frames to `captures/` |
| `?layout=1` / `?overflow=1` | dump layout / overflow diagnostics |

## Deploying

**GitHub Pages** — `.github/workflows/deploy.yml` publishes on every push to `main`.
The workflow stages only the site files, so the dev server and test harness stay
in the repo but never reach the live site. Set Settings → Pages → Source to
"GitHub Actions" if it is not already on.

**Cloudflare Pages** — build command: none. Output directory: `.` (or a directory
containing only the site files). `_headers` is picked up automatically.

For `ferno.fun` itself, point the domain's DNS at whichever host you use and add the
custom domain in that host's dashboard. On Cloudflare Pages, add `ferno.fun` under
Custom Domains; on GitHub Pages, add a `CNAME` file containing `ferno.fun` and
enable "Enforce HTTPS".

## Links

- X — https://x.com/Jonferno
- Discord — `Jonferno`
- GitHub — https://github.com/Jonferno
- YouTube — https://www.youtube.com/@Jonferno_0
- Suno — https://suno.com/@jonferno
