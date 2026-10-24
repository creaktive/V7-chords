# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static page with no build and no dependencies: `index.html` (shell), `style.css`, and `app.js`, which holds all the logic. It draws an interactive map around one dominant 7th chord, with a two-octave piano keyboard on every chord. README.md covers what the page shows and how to use it; the live site is https://creaktive.github.io/V7-chords/.

The main use is on an iPhone. In portrait it gets the TALL layout, so check visual changes there (375 to 440px wide), not only on desktop.

## Commands

- Run: open `index.html` in a browser, or serve the folder with any static server. `#0` to `#11` in the URL picks the root (0 is C).
- There is no build, linter or test runner, and no way to run a single test. The only test is the self-check at the end of `app.js`. It runs on every page load and reports failures only as `Assertion failed` lines in the devtools console.
- Deploy: a push to `main` publishes to GitHub Pages through `.github/workflows/pages.yml`. It publishes the repo root (dot-directories excluded), so `reference/` and every other committed file is served.

### Verifying without a browser

No real browser would start in the sandbox this repo was developed in (Chromium crashed, Firefox could not spawn subprocesses), so verification used jsdom, installed in a scratch directory outside the repo. The repo has no `package.json`.

- Load `index.html` with `new JSDOM(html, { runScripts: 'outside-only', url: 'http://localhost/' })`. Stub `window.matchMedia` first: jsdom lacks it and `app.js` calls it at load. Replace `window.console.assert` to count failures, then run `app.js` with `new vm.Script(src).runInContext(dom.getInternalVMContext())`.
- Top-level `let` and `const` (`root`, `open`, `WIDE`, `TALL`) and `draw()` are reachable with `vm.runInContext('...', ctx)`.
- To prove a change leaves a layout untouched, compare `draw()` output with the previous commit's for all 12 roots, open and closed.
- To look at a layout, render `draw()` output with `rsvg-convert`. librsvg ignores CSS custom properties, so inline `style.css` with every `var(--x)` already substituted. Note that `.in` overrides `--hl` and `--hlroot`.

## Architecture

State is `root` (pitch class 0 to 11, C = 0), `open` (whether the 12-slot root picker is showing), `spell` (`''` for auto, `'♯'` or `'♭'` to force a spelling) and `whole` (edge labels in whole tones). The URL hash `#<root>` mirrors `root`. `spell` and `whole` are not saved, so a link always opens in auto spelling and semitones.

- `draw(root, open, layout, spell, whole)` is a pure function that returns the SVG markup for one state. The four state values are parameters that shadow the globals, so the self-check can draw any state. Keep it free of side effects.
- `render()` applies it: it sets the `viewBox`, `innerHTML` and the `open` class on `#map`, and moves focus to `#c` if focus was inside the map (re-rendering destroys every node).
- `set(r)` changes the root, closes the picker, renders, and is the only place that calls `history.replaceState`. `fromHash()` reads the hash at load and on `hashchange`; a missing or invalid hash keeps the current root and leaves the URL as typed.
- One delegated `click` handler on `#map` covers `[data-pick]` (ring slots), `[data-pc]` (red chords), `#c` (toggle the picker) and the background (close it). Enter and Space on a `role="button"` go through a `keydown` handler that dispatches a synthetic click and ignores `e.repeat`. Escape closes the picker.
- The `#spell` and `#unit` buttons in `index.html` cycle `spell` (auto, ♯, ♭) and toggle `whole`, then re-render. They are wired after the first `render()`: GitHub Pages lets browsers cache each file for 10 minutes, so right after a deploy an old `index.html` without the buttons can meet the new `app.js`, and that must not blank the map.

**Layouts are data.** `WIDE` (side columns) and `TALL` (rows of three, for phones in portrait) hold the viewBox, the centre, per-kind node size and position, the direction `to` the centre, title and keyboard offsets, and which piano scale to use. `render()` picks one with `matchMedia('(max-width: 599px)')` and re-renders on `change`. WIDE shows a red chord's role note inline in a 10px tspan. TALL has three nodes across, so the role note goes on its own `<text class="role">` lines. The ⊖7 target's `(I / i)` is an inline 10px tspan in both layouts: TALL target nodes have no room for another line. TALL's node width (`w`, 120) must fit the widest role line, "sub. of sec. dom. of" (about 100 units at 11px).

**Harmony data.** `OUT` and `IN` hold semitone offsets from the centre root, with edge labels and role notes: every `IN` chord has one, and in `OUT` only the ⊖7 target, marked `I / i` as the tonic the centre V7 resolves to. Note names come from `names(root, spell)`. In auto they are flats when the centre is D♭, E♭, F, A♭ or B♭, sharps otherwise. `'♯'` or `'♭'` forces one list, and the ring then shows only that spelling. In auto the spelling depends only on the centre, so a link always opens in one view. A red chord can therefore be respelled when it becomes the centre (G♯7 becomes A♭7 from D). That is accepted, not a bug. Any chord name on the map that differs from the chord's own spelling (its name as the centre in auto) gets class `borrowed` (underlined), in every spelling mode. In auto only neighbours can be marked; a forced spelling can mark the centre too. Ring slots are never marked. On targets and WIDE red chords the class goes on a `<tspan>` around the names, so role notes stay plain. With `whole` set, `wholeTones()` rewrites each edge label in whole tones (⊖7 becomes ⊖3½).

**Piano.** `PianoOctave` draws one octave (geometry from quadibloc.com), and `piano(p, x, y, r, ivs, alt)` draws two octaves from C. Each octave emits 7 white keys, then 5 black keys, with classes `on` (chord tone), `root`, and `alt` (the optional minor third on the target triads). There are two scales: `po` (0.4) for the centre and the WIDE nodes, `poSmall` (0.3) for the TALL nodes.

**Markup names are shared.** `style.css` and the self-check read the classes and attributes that `draw()` emits: `.out`, `.in`, `.center`, `.node`, `.node-box`, `.role`, `.borrowed`, `.lbl`, `.edge`, `.dim`, `.btn`, `.slot`, `.kw`, `.kb`, `.on`, `.root`, `.alt`, `#c`, `data-pc`, `data-pick`, and the `open` class on `#map`. Rename one side and the other breaks without an error. `app.js` also looks up `#spell` and `#unit` in `index.html`. A missing one throws after the first render: the map still draws, but the button wiring and the self-check stop.

**Self-check.** It sits at the end of `app.js`, after the first `render()`, so a throw cannot blank the page. It draws all 12 roots in both layouts into a detached `<svg>` and reads names and lit keys back from the markup. The D map and B♭ map must match known strings, exactly one target must be marked `(I / i)` and sit a fifth below the centre, and every keyboard must light exactly the chord its own label names, including the root key and the alt key. Forced spellings must show only sharps or only flats for all 12 roots, forced flats must reach the ring, and the D map's whole-tone labels must match a known string. In every spelling mode, a name must be underlined exactly when it differs from the chord's own spelling (read from the centre that `draw(k)` emits, not from `names()`). It relies on the key order above (`KEY_PC`). Known gap: a typo in `SHARP` or `FLAT` outside the D and B♭ maps is not caught. Say so rather than claim full coverage.

## Conventions

- Role notes (the third field of `IN`) are English. The source notes are Portuguese, where `do` means "of": translate, never copy. `sub.` means tritone substitution; the user had not yet chosen between the literal "sub. of" and the term.
- On WIDE, keep the role note on the chord's line (10px tspan, no line break).
- Do not dim the centre keyboard when the picker opens. Clicking it toggles the picker, like the circle.
- Accessible names: the centre is `<root>7, choose chord`; red chords are `Go to <name>7 (<role> <root>7)`.
- `reference/` holds the original Mermaid sketch of the D7 map. The page does not load it, and the app no longer follows it: the sketch labels edges in whole tones and writes `do`, the app defaults to semitones and uses English.
- Browser floor is Safari and iOS 14 (the layout switch uses `MediaQueryList.addEventListener`).
