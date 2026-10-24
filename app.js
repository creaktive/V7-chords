const SHARP = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const FLAT  = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
const FLAT_ROOTS = [1, 3, 5, 8, 10];
const SLOT_LABEL = SHARP.map((s, i) => FLAT[i] === s ? s : s + '/' + FLAT[i]);

// [semitone offset from X, edge label, role note]; the target a fifth below is the I the centre V7 resolves to
const OUT = [[-1, '⊖1'], [2, '⊕2'], [-7, '⊖7', 'I / i']];
const IN = [[7, '⊖7', 'sec. dom. of'], [6, '⊕6', 'sub. of'], [1, '⊖1', 'sub. of sec. dom. of']];

const R = 88;
const map = document.getElementById('map');
const narrow = matchMedia('(max-width: 599px)');
let root = 0, open = false, spell = '', whole = false;

// Key geometry from http://www.quadibloc.com/other/cnv05.htm, emitting SVG instead of p5 calls
class PianoOctave {
  constructor (scale = 1.0) {
    this.whiteHeight = 150 * scale
    this.blackHeight = 100 * scale
    this.whiteKeys = [23, 24, 23, 24, 23, 23, 24].map(x => x * scale)
    this.whiteTone = [1, 3, 5, 6, 8, 10, 12]
    this.blackKeys = [14, 14, 14, 14, 14, 13, 14, 13, 14, 13, 14, 13].map(x => x * scale)
    this.blackTone = [0, 2, 0, 4, 0, 0, 7, 0, 9, 0, 11, 0]
    this.width = this.whiteKeys.reduce((a, b) => a + b)
  }

  // keyClass[tone - 1] is an extra CSS class for that key
  svg (keyClass = []) {
    const key = (type, tone, x, w, h) =>
      `<rect class="${type} ${keyClass[tone - 1] || ''}" x="${x}" y="0" width="${w}" height="${h}"/>`
    let out = ''
    for (let i = 0, x = 0; i < 7; x += this.whiteKeys[i++]) {
      out += key('kw', this.whiteTone[i], x, this.whiteKeys[i], this.whiteHeight)
    }
    for (let i = 0, x = 0; i < 12; x += this.blackKeys[i++]) {
      if (this.blackTone[i]) out += key('kb', this.blackTone[i], x, this.blackKeys[i], this.blackHeight)
    }
    return out
  }
}
const po = new PianoOctave(0.4), poSmall = new PianoOctave(0.3)

// two octaves from C; intervals above root r are highlighted, `alt` marks an optional (minor) third
const piano = (p, x, y, r, ivs, alt) => {
  const c = Array(24).fill('')
  ivs.forEach(iv => { c[r + iv] = iv ? 'on' : 'on root' })
  if (alt !== undefined) c[r + alt] = 'alt'
  return `<g transform="translate(${x - p.width} ${y})">${p.svg(c.slice(0, 12))}<g transform="translate(${p.width} 0)">${p.svg(c.slice(12))}</g></g>`
}
const DOM7 = [0, 4, 7, 10], TRIAD = [0, 4, 7]
// `spell` forces SHARP or FLAT; '' picks by the centre
const names = (r, spell = '') => spell === '♯' ? SHARP : spell === '♭' ? FLAT : FLAT_ROOTS.includes(r) ? FLAT : SHARP;
const pc = n => ((n % 12) + 12) % 12;
// a semitone edge label in whole tones: '⊖7' becomes '⊖3½'
const wholeTones = l => l.replace(/\d+/, d => (d >> 1 || '') + (d & 1 ? '½' : ''));

// WIDE: nodes in two side columns (tablet and up). TALL: nodes in two rows, three across (phone in portrait).
// `to` points from a node towards the centre; `ty` and `py` are the title and keyboard offsets from the node top.
// TALL `w` must fit the widest role line, "sub. of sec. dom. of" (about 100 units at 11px); widen it if that text grows.
const YS = [70, 230, 390], XS = [66, 192, 318];
const WIDE = {
  vb: '0 0 800 460', cx: 400, cy: 230, lbl: -12, stack: false,
  in:  { w: 180, h: 112, at: i => [130, YS[i]], to: [1, 0], ty: 20, py: 46, pk: po },
  out: { w: 180, h: 112, at: i => [670, YS[i]], to: [-1, 0], ty: 20, py: 44, pk: po },
};
const TALL = {
  vb: '0 0 384 514', cx: 192, cy: 270, lbl: 0, stack: true,
  in:  { w: 120, h: 106, at: i => [XS[i], 59], to: [0, 1], ty: 17, py: 54, pk: poSmall },
  out: { w: 120, h: 80, at: i => [XS[i], 468], to: [0, -1], ty: 17, py: 28, pk: poSmall },
};

// markup for one state; root/open/spell/whole are arguments (shadowing the globals) so the self-check can draw any state
function draw(root, open, L = WIDE, spell = '', whole = false) {
  const n = names(root, spell), { cx, cy } = L;
  // mark a name that differs from the chord's own spelling (its name as the centre in auto),
  // borrowed from the centre's list in auto or from a forced one
  const borrowed = r => n[r] !== names(r)[r] ? ' class="borrowed"' : '';
  let s = `<defs>
    <marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z"/></marker>
    <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z"/></marker>
  </defs><g class="dim">`;

  const arrow = (x1, y1, x2, y2, lbl, m = 'a') => {
    if (whole) lbl = wholeTones(lbl);
    s += `<path class="edge" d="M${x1} ${y1}L${x2} ${y2}" marker-end="url(#${m})"/>` +
         `<text dy=".35em" class="lbl" x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 + L.lbl}">${lbl}</text>`;
  };
  // point on circle rim facing (x,y)
  const rim = (x, y) => { const d = Math.hypot(x - cx, y - cy); return [cx + (x - cx) * (R + 2) / d, cy + (y - cy) * (R + 2) / d]; };

  OUT.forEach(([off, lbl, role], i) => {
    const { w, h, at, to, ty, py, pk } = L.out, [x, y] = at(i), r = pc(root + off), t = n[r], top = y - h / 2;
    const [ex, ey] = [x + to[0] * w / 2, y + to[1] * h / 2]; // node edge facing the centre
    const [rx, ry] = rim(ex, ey);
    s += `<g class="out"><g class="node"><rect class="node-box" x="${x - w / 2}" y="${top}" width="${w}" height="${h}" rx="10"/><text dy=".35em" x="${x}" y="${top + ty}"><tspan${borrowed(r)}>${t} / ${t}m</tspan>${role ? ` <tspan style="font-size:10px">(${role})</tspan>` : ''}</text></g>${piano(pk, x, top + py, r, TRIAD, 3)}`;
    arrow(rx, ry, ex + to[0] * 2, ey + to[1] * 2, lbl);
    s += `</g>`;
  });

  IN.forEach(([off, lbl, role], i) => {
    const { w, h, at, to, ty, py, pk } = L.in, [x, y] = at(i), r = pc(root + off), t = n[r], top = y - h / 2;
    const [ex, ey] = [x + to[0] * w / 2, y + to[1] * h / 2];
    const [rx, ry] = rim(ex, ey);
    // wide: the role note shares the chord's line; tall: three nodes across leave no room, so it gets its own lines
    const head = L.stack
      ? `<text${borrowed(r)} dy=".35em" x="${x}" y="${top + ty}">${t}7</text><text class="role" dy=".35em" x="${x}" y="${top + ty + 16}">${role}</text><text class="role" dy=".35em" x="${x}" y="${top + ty + 29}">${n[root]}7</text>`
      : `<text dy=".35em" x="${x}" y="${top + ty}"><tspan${borrowed(r)}>${t}7</tspan> <tspan style="font-size:10px">(${role} ${n[root]}7)</tspan></text>`;
    s += `<g class="in btn" data-pc="${r}" tabindex="0" role="button" aria-label="Go to ${t}7 (${role} ${n[root]}7)"><g class="node"><rect class="node-box" x="${x - w / 2}" y="${top}" width="${w}" height="${h}" rx="10"/>${head}</g>${piano(pk, x, top + py, r, DOM7)}`;
    arrow(ex + to[0] * 2, ey + to[1] * 2, rx, ry, lbl, 'ar');
    s += `</g>`;
  });
  s += `</g>`;

  s += `<g class="center btn" id="c" tabindex="0" role="button" aria-expanded="${open}" aria-label="${n[root]}7, choose chord"><g class="node"><circle cx="${cx}" cy="${cy}" r="${R}"/><text${borrowed(root)} dy=".35em" x="${cx}" y="${cy - 38}">${n[root]}7</text></g>${piano(po, cx, cy - 10, root, DOM7)}</g>`;

  if (open) {
    (spell ? n : SLOT_LABEL).forEach((lab, p) => {
      const a = (p * 30 - 90) * Math.PI / 180, x = cx + 135 * Math.cos(a), y = cy + 135 * Math.sin(a);
      s += `<g class="slot btn node${p === root ? ' sel' : ''}" data-pick="${p}" tabindex="0" role="button" aria-label="${lab}7"><circle cx="${x}" cy="${y}" r="29"/><text dy=".35em" x="${x}" y="${y}">${lab}</text></g>`;
    });
  }
  return s;
}

function render() {
  const had = map.contains(document.activeElement), L = narrow.matches ? TALL : WIDE;
  map.setAttribute('viewBox', L.vb);
  map.innerHTML = draw(root, open, L, spell, whole);
  map.classList.toggle('open', open);
  // innerHTML drops the focused node; hand focus to the new centre
  if (had) map.querySelector('#c').focus();
}

function set(r) { root = pc(r); open = false; render(); history.replaceState(null, '', '#' + root); }

map.addEventListener('click', e => {
  const pick = e.target.closest('[data-pick]'), go = e.target.closest('[data-pc]');
  if (pick) set(+pick.dataset.pick);
  else if (go) set(+go.dataset.pc);
  else if (e.target.closest('#c')) { open = !open; render(); map.querySelector('#c').focus(); }
  else if (open) { open = false; render(); }
});
map.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!e.repeat) e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) { open = false; render(); } });
narrow.addEventListener('change', render);
// root from the URL hash; the current root when the hash is missing or invalid
const fromHash = () => { const h = parseInt(location.hash.slice(1), 10); return h >= 0 && h < 12 ? h : root; };
window.addEventListener('hashchange', () => { const h = fromHash(); if (h !== root) set(h); });

root = fromHash();
render();

// wired after the first render, so a stale cached index.html without these buttons cannot blank the map
const spellBtn = document.getElementById('spell');
spellBtn.addEventListener('click', () => {
  spell = { '': '♯', '♯': '♭', '♭': '' }[spell];
  spellBtn.textContent = 'Spelling: ' + (spell || 'auto');
  render();
});
const unitBtn = document.getElementById('unit');
unitBtn.addEventListener('click', () => {
  whole = !whole;
  unitBtn.textContent = 'Steps: ' + (whole ? 'whole tones' : 'semitones');
  render();
});

// self-check, run last so a throw here cannot blank the page:
// draw every root, then read the names and lit keys back from the markup
const KEY_PC = [0, 2, 4, 5, 7, 9, 11, 1, 3, 6, 8, 10]; // nth key of an octave: 7 white, then 5 black
const lit = (g, cls) => [...g.querySelectorAll('.kw, .kb')]
  .flatMap((k, i) => k.classList.contains(cls) ? [KEY_PC[i % 12] + 12 * (i > 11)] : [])
  .sort((a, b) => a - b).join();
const nameOf = g => g.querySelector('.node text').textContent.split(' ')[0];
const KNOWN = { 2: 'C♯,E,G,A7,G♯7,D♯7', 10: 'A,C,E♭,F7,E7,B7' }; // D map, B♭ map
const probe = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
// the name each root gets as the centre in auto, e.g. own[1] is 'D♭'
const own = SHARP.map((_, k) => { probe.innerHTML = draw(k, false); return nameOf(probe.querySelector('.center')).replace('7', ''); });
for (const L of [WIDE, TALL]) for (let r = 0; r < 12; r++) {
  probe.innerHTML = draw(r, false, L);
  const shown = [...probe.querySelectorAll('.out, .in')].map(nameOf).join();
  console.assert(!KNOWN[r] || shown === KNOWN[r], 'names', r, shown);
  // exactly one target is marked I, a fifth below the centre
  const I = [...probe.querySelectorAll('.out')].filter(g => g.textContent.includes('(I / i)')).map(nameOf);
  console.assert(I.length === 1 && [SHARP, FLAT].some(l => l.indexOf(I[0]) === pc(r - 7)), 'tonic', r, I);
  probe.querySelectorAll('.out, .in, .center').forEach(g => {
    // each keyboard must light exactly the chord its own label names
    const name = nameOf(g), seventh = name.endsWith('7'), base = name.replace('7', '');
    const k = Math.max(SHARP.indexOf(base), FLAT.indexOf(base));
    console.assert(lit(g, 'on') === (seventh ? [0, 4, 7, 10] : [0, 4, 7]).map(v => k + v).join(), 'lit keys', r, name, lit(g, 'on'));
    console.assert(lit(g, 'root') === String(k), 'root key', r, name);
    console.assert(lit(g, 'alt') === (seventh ? '' : String(k + 3)), 'alt key', r, name);
    // underlined exactly when the name differs from this chord's own spelling
    console.assert(!!g.querySelector('.borrowed') === (own[k] !== base), 'borrowed', r, name);
  });
}
for (const [sp, bad] of [['♯', '♭'], ['♭', '♯']]) for (let r = 0; r < 12; r++) {
  probe.innerHTML = draw(r, false, WIDE, sp);
  probe.querySelectorAll('.out, .in, .center').forEach(g => {
    const base = nameOf(g).replace('7', ''), k = Math.max(SHARP.indexOf(base), FLAT.indexOf(base));
    console.assert(!base.includes(bad), 'forced spelling', sp, r, base);
    console.assert(!!g.querySelector('.borrowed') === (own[k] !== base), 'borrowed', sp, r, base);
  });
}
probe.innerHTML = draw(2, false, WIDE, '', true);
console.assert([...probe.querySelectorAll('.lbl')].map(l => l.textContent).join() === '⊖½,⊕1,⊖3½,⊖3½,⊕3,⊖½', 'whole tones', probe.querySelectorAll('.lbl').length);
probe.innerHTML = draw(2, true, WIDE, '♭');
console.assert([...probe.querySelectorAll('.slot')].map(g => g.textContent).join() === FLAT.join(), 'flat slots');
