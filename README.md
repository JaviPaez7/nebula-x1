# NEBULA X1

**Live: https://javipaez7.github.io/nebula-x1/**

A cinematic, scroll-driven product experience for a fictional next-generation
electric hyperbike. Scroll position is the timeline: it drives the camera, the
machine, the lighting desk, the particles and the interface, and scrolling
backwards runs the entire film backwards.

Best experienced full screen on a desktop with a discrete GPU. It works on a
phone, but the film was framed for a wide window.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle
npm run preview    # serve the built output
npm run deploy     # build, push, and publish to GitHub Pages
```

React 18 · TypeScript · Vite · three.js · react-three-fiber · Lenis

---

## 1. How it works

### One number drives everything

The whole experience is a pure function of a single value: normalised document
scroll progress, `0..1`.

```
scroll position ──► scrollStore.progress ──► evaluate() ──► every channel
```

`evaluate()` in `src/core/experience.ts` returns about forty named channels —
`reveal`, `explode`, `lightKey`, `airflow`, `speedSmear`, `cockpit` and so on —
each computed with `smoothstep` between absolute timecodes. Because nothing is
event-driven there is no "has this already played" bookkeeping, no trigger
system and no direction flag, which is exactly why reverse scrolling is correct
by construction rather than by testing.

`src/core/shots.ts` holds a real shot list: 40 framed camera setups, each with a
position, a point of interest, a focal length and a roll. Progress is the
timecode. The camera travels a Catmull-Rom spline through those positions,
**re-parameterised by arc length** so it moves at a constant speed between
shots instead of lurching, while the aim eases across on a second spline. There
are no cuts anywhere in the film.

### The composition

The document contains exactly one tall element — the scroll track, 1 560 `vh`.
Every frame of the film is drawn in fixed layers above it, and the specification
sheet follows as ordinary scrollable content. Progress `1.0` is defined as the
moment that sheet arrives, so the film finishes as the brochure begins.

Scroll length beyond the film is excluded from the timeline
(`ScrollStore.measure()`), which means the last chapter plays out at a sensible
rate instead of being stretched over the whole document.

### The DOM layer

Typography, the HUD and the exploded-view callouts are plain DOM, and they are
driven without React. The render loop publishes a small mutable signal object
(`src/core/domSignals.ts`); each component subscribes once and writes CSS
custom properties directly:

```ts
el.style.setProperty('--o', opacity)   // opacity of the block
el.style.setProperty('--t', travel)    // -1 before the beat, 0 at rest, +1 after
```

A `--t` of ±1 then drives translation, blur and scale entirely in CSS, so a
whole caption costs one style write per frame. React re-renders twice in the
entire film: once when the active chapter changes, once when the loader lifts.

---

## 2. The machine

There is no downloaded model. NEBULA X1 is generated at runtime from roughly
1 800 lines of geometry code, which means no asset licensing, no download stall
and full control over the surface language.

| Assembly | Construction |
| --- | --- |
| Wheels | Squashed-torus tyre, deep-drop rim, five-blade **Y-spoke forging** built by lofting a tapered cross-section along polar coordinates, floating discs with bobbins, ABS ring |
| Front end | Steering-axis local frame at a 25° rake; 48 mm fork legs, machined yokes, radial monobloc calipers, crown-following fender |
| Frame | Two extruded, smoothed spar profiles plus an inclined headstock, pivot plates and shock crossmember |
| Battery | Smoothed side plates, module cage, a 2 × 6 pouch stack with copper busbars, cooling plate and BMS — all inside a sealed structural enclosure |
| Drive unit | Cooling-fin can, 24-slot stator, 16-pole rotor with magnets, integrated inverter and the reduction housing |
| Bodywork | A crowned tank shell extruded along the machine's spine (so its end caps face fore and aft like a real moulded panel), knee panels, belly pan, winglets, hugger |
| Cockpit | Handlebar with grips, levers, mirrors and a bonded instrument binnacle |

Surfaces are procedural too: `src/three/textures.ts` draws a 2×2 twill carbon
weave, CNC tool marks, rubber grain, a cell faceplate and a studio floor into
offscreen canvases at boot.

### The reveal

Chapter 02's strip of light is not a fade. Every material carries a shared
`uReveal` uniform plus a per-mesh `aRevealOffset` attribute, and the shader
compares a **mesh-local** Z coordinate against the sweep position:

```glsl
float swept = 1.0 - smoothstep(vRevealAt - width, vRevealAt, vRevealWorld.z);
float band  = 1.0 - smoothstep(0.0, halfWidth, abs(vRevealWorld.z - vRevealAt));
```

Because it uses the pre-transform position, the sweep stays glued to the bike
however the rig rotates or explodes. One number moves a plane of light through
the machine and each component ignites as the plane reaches it.

### Materials and light

The metals are mirror-like, and a mirror with nothing to reflect renders black
no matter how many lights point at it. `StudioEnvironment.tsx` builds a small
room of emissive panels — an overhead softbox, two side scrims, a cool kicker,
a warm low fill — and convolves it into an environment map with the renderer's
own PMREM generator. That single addition is what makes the aluminium read as
machined metal.

---

## 3. Rendering

The scene is drawn into a render target and composited through **one** grade
pass that does the vignette, the lateral chromatic fringe, film grain and the
radial speed smear during the ride. One extra draw call for the whole look,
instead of a post-processing framework.

The target is half-float and marked `NoColorSpace`, because the renderer writes
linear pre-encode values into it. An 8-bit target quantises a deliberately dark
film into a handful of codes and crushes every shadow to black — a real failure
mode that cost an afternoon.

---

## 4. Fallbacks

| Condition | Behaviour |
| --- | --- |
| No WebGL | A static editorial presentation: the same identity, figures and full specification sheet. Tested with 3D APIs genuinely disabled. |
| `prefers-reduced-motion` | Inertial scrolling is not engaged, and chapter navigation cuts straight to the destination instead of animating — so the rail still works. |
| Phone | The same film at a lighter budget. Portrait windows get a wider lens rather than a distant camera, the leader lines become a compact parts list, and the desktop rail is replaced by the progress hairline. |

---

## 5. Performance

- **Zero React work per frame.** The director writes transforms straight onto
  the scene graph; the DOM layer writes CSS custom properties.
- **Bounded draw calls.** Same-material clusters are merged at build time;
  fins, spokes, bolts and bobbin rings are single geometries.
- **Adaptive quality.** Device tier is chosen from viewport width, core count
  and reported memory: DPR is capped, shadows and MSAA are dropped on lower
  tiers, and particle density scales with the budget.
- **Allocation-free loop.** Every vector, matrix and object reused per frame is
  hoisted to module scope.
- **Particles sized with a ceiling.** Without an explicit clamp a single mote
  passing near the lens becomes a screen-filling blob; the point sizes are
  perspective-correct *and* clamped.
- **Real loading progress.** The curtain advances only as genuine work
  completes — procedural textures, font metrics, material compilation, a
  `gl.compile()` warm-up pass and four rendered frames.

---

## 6. Verification

`tools/` holds the headless Chrome harnesses used throughout. They are
development-only and are not part of the shipped bundle.

| Tool | Purpose |
| --- | --- |
| `verify.mjs` | Acceptance run: forward and reverse scrubbing, chapter navigation, resize, mid-page reload, console, plus reduced-motion and mobile checks |
| `capture.mjs` | Frames at exact progress positions for visual review |
| `beauty.mjs` | The machine from fixed studio angles under reference lighting |
| `fallback.mjs` | Launches Chrome with 3D APIs disabled and asserts the static presentation |
| `probe.mjs` | Live renderer introspection: draw calls, triangles, programs, light intensities, target sizes |
| `deploy.mjs` | Builds with the Pages base path, publishes the output to `gh-pages`, enables Pages, and waits for the URL to serve the built entry point |

```bash
node tools/verify.mjs --w 1920 --h 1080 --label desktop
node tools/verify.mjs --w 390 --h 844 --label mobile --mobile
node tools/verify.mjs --w 1440 --h 900 --label reduced --reduced
node tools/fallback.mjs
TARGET_URL=https://javipaez7.github.io/nebula-x1/ node tools/verify.mjs --label live
```

**Results:** 12/12 desktop, 12/12 laptop, 16/16 mobile, 13/13 reduced motion,
12/12 against the production bundle, 12/12 against the deployed site, 9/9
no-WebGL — and a clean console in every configuration.

### Deployment

`npm run deploy` publishes `dist/` to the `gh-pages` branch from a throwaway
directory, so the source history stays clean and the published branch holds one
commit containing exactly what the browser needs. `base` is read from
`VITE_BASE`, which is why the same config works for the project page, a user
page and a custom domain without edits.

### A note on GSAP

The brief suggested GSAP ScrollTrigger. It was implemented and then removed:
keeping ~300 tweens across 12 chapters scrubbed in both directions was more
state to reason about than computing each channel directly from progress, and
the direct approach is exactly reversible by construction. Lenis is still used
for the inertial scrolling that makes the film feel premium. The dependency
list is five packages, none of which is a framework on top of a framework.

---

## 7. Layout

```
src/
  core/        scrollStore · experience (the signal model) · chapters ·
               timeline · domSignals · loadManager · math
  three/       Director (owns the frame) · Bike + bike/ (all geometry) ·
               shots · framing · materials · textures · Environment ·
               particles · post · StudioEnvironment
  ui/          Captions · Chrome · CockpitHud · Callouts · MobileParts ·
               Loader · SpecSheet · Fallback
  styles/      global.css — tokens, the rail, HUD, responsive
tools/         headless Chrome harnesses (dev only)
```

---

## 8. Honest limitations

- **Rendering quality was assessed on a software rasteriser.** Every frame in
  `shots/` was captured through SwiftShader, which has no texture filtering
  anisotropy to speak of and a conservative MSAA implementation. On real
  hardware the machine will look meaningfully better; the screenshots
  understate it.
- **The bike is stylised, not engineered.** Proportions, hard points and the
  exploded assembly are self-consistent, but nothing here has been near a CAD
  kernel or a load case.
- **No frame-time budget was measured on a GPU.** Draw calls, triangle counts
  and program counts were measured (`tools/probe.mjs`), but a real 60 fps
  figure needs real hardware.
- **WebGL1 is not supported.** three.js r169 requires WebGL2, so a WebGL1-only
  device falls through to the static presentation.
- **The 2027 production figures are fiction.** Obviously.

Nebula is a fictional marque. No vehicle is offered for sale.
