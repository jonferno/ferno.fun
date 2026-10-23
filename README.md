# ferno.fun

A personal playground of shenanigans. Pixel-art inferno theme, live GPU fire that reacts to your cursor.

**Live:** https://jonferno.github.io/ferno.fun/
**Repo:** https://github.com/jonferno/ferno.fun

## What's here

```
index.html              landing + hub markup
css/style.css           the whole visual system
js/fire.js              WebGL2 fluid fire solver (the main event)
js/main.js              screen routing, embers, clock, toasts
assets/favicon.svg      pixel flame mark
server.mjs              local dev server (+ screenshot capture endpoint)
tools/verify.mjs        24-check interaction test suite
tools/fire-diag.mjs     fire coverage diagnostics across viewports
tools/scale-sweep.mjs   flame-height tuning sweep
```

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

Mouse movement injects velocity and heat into the simulation, so dragging across the screen
fans the flames. Clicking drops a burst of embers.

If WebGL2 or `EXT_color_buffer_float` is unavailable, the script falls back to a CPU
cell-based fire simulation that still responds to the pointer.

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
