const SHARP = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const FLAT  = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
const FLAT_ROOTS = [1, 3, 5, 8, 10];
const SLOT_LABEL = SHARP.map((s, i) => FLAT[i] === s ? s : s + '/' + FLAT[i]);

// [semitone offset from X, edge label]
const OUT = [[-1, '⊖1'], [2, '⊕2'], [-7, '⊖7']];
const IN = [[7, '⊖7', 'sec. dom. of'], [6, '⊕6', 'sub. of'], [1, '⊖1', 'sub. of sec. dom. of']];

const CX = 400, CY = 230, R = 88, W = 180, H = 112;
const YS = [70, 230, 390];
const map = document.getElementById('map');
let root = 2, open = false;

// Key geometry from http://www.quadibloc.com/other/cnv05.htm (via sketch.js), emitting SVG instead of p5 calls
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
const po = new PianoOctave(0.4)

// two octaves from C; intervals above root r are highlighted, `alt` marks an optional (minor) third
const piano = (x, y, r, ivs, alt) => {
  const c = Array(24).fill('')
  ivs.forEach(iv => { c[r + iv] = iv ? 'on' : 'on root' })
  if (alt !== undefined) c[r + alt] = 'alt'
  return `<g transform="translate(${x - po.width} ${y})">${po.svg(c.slice(0, 12))}<g transform="translate(${po.width} 0)">${po.svg(c.slice(12))}</g></g>`
}
const DOM7 = [0, 4, 7, 10], TRIAD = [0, 4, 7]
const names = r => FLAT_ROOTS.includes(r) ? FLAT : SHARP;
const pc = n => ((n % 12) + 12) % 12;

function render() {
  const n = names(root);
  let s = `<defs>
    <marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z"/></marker>
    <marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10z"/></marker>
  </defs><g class="dim">`;

  const arrow = (x1, y1, x2, y2, lbl, m = 'a') => {
    s += `<path class="edge" d="M${x1} ${y1}L${x2} ${y2}" marker-end="url(#${m})"/>` +
         `<text dy=".35em" class="lbl" x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 12}">${lbl}</text>`;
  };
  // point on circle rim facing (x,y)
  const rim = (x, y) => { const d = Math.hypot(x - CX, y - CY); return [CX + (x - CX) * (R + 2) / d, CY + (y - CY) * (R + 2) / d]; };

  OUT.forEach(([off, lbl], i) => {
    const r = pc(root + off), t = n[r], x = 760 - W / 2, y = YS[i], top = y - H / 2;
    const [rx, ry] = rim(x - W / 2, y);
    s += `<g class="out"><g class="node"><rect class="node-box" x="${x - W / 2}" y="${top}" width="${W}" height="${H}" rx="10"/><text dy=".35em" x="${x}" y="${top + 20}">${t} / ${t}m</text></g>${piano(x, top + 44, r, TRIAD, 3)}`;
    arrow(rx, ry, x - W / 2 - 2, y, lbl);
    s += `</g>`;
  });

  IN.forEach(([off, lbl, role], i) => {
    const r = pc(root + off), t = n[r], x = 40 + W / 2, y = YS[i], top = y - H / 2;
    const [rx, ry] = rim(x + W / 2, y);
    s += `<g class="in btn" data-pc="${r}" tabindex="0" role="button" aria-label="Go to ${t}7"><g class="node"><rect class="node-box" x="${x - W / 2}" y="${top}" width="${W}" height="${H}" rx="10"/><text dy=".35em" x="${x}" y="${top + 20}">${t}7 <tspan style="font-size:10px">(${role} ${n[root]}7)</tspan></text></g>${piano(x, top + 46, r, DOM7)}`;
    arrow(x + W / 2 + 2, y, rx, ry, lbl, 'ar');
    s += `</g>`;
  });
  s += `</g>`;

  s += `<g class="center btn" id="c" tabindex="0" role="button" aria-expanded="${open}" aria-label="Choose chord"><g class="node"><circle cx="${CX}" cy="${CY}" r="${R}"/><text dy=".35em" x="${CX}" y="${CY - 38}">${n[root]}7</text></g>${piano(CX, CY - 10, root, DOM7)}</g>`;

  if (open) {
    SLOT_LABEL.forEach((lab, p) => {
      const a = (p * 30 - 90) * Math.PI / 180, x = CX + 135 * Math.cos(a), y = CY + 135 * Math.sin(a);
      s += `<g class="slot btn node${p === root ? ' sel' : ''}" data-pick="${p}" tabindex="0" role="button" aria-label="${lab}7"><circle cx="${x}" cy="${y}" r="29"/><text dy=".35em" x="${x}" y="${y}">${lab}</text></g>`;
    });
  }
  map.innerHTML = s;
  map.classList.toggle('open', open);
  history.replaceState(null, '', '#' + root);
}

function set(r) { root = pc(r); open = false; render(); }

map.addEventListener('click', e => {
  const pick = e.target.closest('[data-pick]'), go = e.target.closest('[data-pc]');
  if (pick) set(+pick.dataset.pick);
  else if (go) set(+go.dataset.pc);
  else if (e.target.closest('#c')) { open = !open; render(); map.querySelector('#c').focus(); }
  else if (open) { open = false; render(); }
});
map.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.target.dispatchEvent(new MouseEvent('click', { bubbles: true })); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && open) { open = false; render(); } });
window.addEventListener('hashchange', () => { const h = parseInt(location.hash.slice(1), 10); if (h >= 0 && h < 12 && h !== root) set(h); });

// self-check: derived chord names
const names7 = r => [...OUT.map(([o]) => names(r)[pc(r + o)]), ...IN.map(([o]) => names(r)[pc(r + o)] + '7')].join();
console.assert(names7(2) === 'C♯,E,G,A7,G♯7,D♯7', 'D map', names7(2));
console.assert(names7(10) === 'A,C,E♭,F7,E7,B7', 'Bb map', names7(10));

const tones = (r, iv) => iv.map(i => pc(r + i)).join();
console.assert(tones(2, DOM7) === '2,6,9,0', 'D7 tones');
console.assert(tones(10, DOM7) === '10,2,5,8', 'Bb7 tones');
console.assert(tones(1, TRIAD) === '1,5,8' && pc(1 + 3) === 4, 'C# triad + alt');

const h0 = parseInt(location.hash.slice(1), 10);
if (h0 >= 0 && h0 < 12) root = h0;
render();
