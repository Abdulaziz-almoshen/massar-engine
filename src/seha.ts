// seha.ts — the COMPONENT language of the approved design system.
//
// The rebrand took the palette and left the furniture: 56 of 60 tokens adopted, 0 of 17 component
// classes. Every Massar screen still used the flush hairline row from the PREVIOUS design system
// while wearing this one's colours. That is a repaint, not a rebrand, and the founder caught it.
//
// This module is the missing half. The shapes come from the approved file — an elevated card that
// lifts, a tile with the figure at the inline-end, a stacked share bar, a unit grid where COUNT is
// drawn rather than written, and a flat drawn empty state — implemented here against DESIGN.md's
// tokens rather than lifted, so the radii, shadows, motion and RTL rules are Massar's own.
//
// «data-as-visual» is the file's own phrase for the idea, and the unit grid is where it bites: six
// open opportunities is six cells, and the reader counts by looking instead of by reading a number.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included.

export const SEHA_CSS = `
/* ---- tile: the number, with the figure at the inline-end rather than stacked under the label.
       Elevated on --paper, not a tinted strip: this system's surfaces are cards on a wash. ---- */
.sh-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--s3);margin-block-end:var(--s4)}
.sh-tile{background:var(--paper);border-radius:var(--r-md);box-shadow:var(--sh-1);
  padding:var(--s3) var(--s4);display:grid;grid-template-columns:1fr auto;gap:var(--s3);
  align-items:center;border:1px solid transparent;
  transition:box-shadow var(--base) var(--ease),transform var(--base) var(--ease),border-color var(--base) var(--ease)}
.sh-tile .k{font-size:var(--t-xs);color:var(--muted);font-weight:600}
.sh-tile .s{font-size:var(--t-xs);color:var(--muted);margin-block-start:2px}
.sh-tile .v{font-size:var(--t-2xl);font-weight:700;line-height:1;font-variant-numeric:tabular-nums;
  color:var(--ink);justify-self:end}
.sh-tile.lead{background:linear-gradient(180deg,var(--blue-tint),var(--paper))}
.sh-tile.lead .v{color:var(--blue);font-size:var(--t-3xl)}
/* A lift is a promise the thing is clickable. DESIGN.md 6.7 forbids it on anything that is not. */
.sh-tile.go{cursor:pointer}
.sh-tile.go:hover{box-shadow:var(--sh-3);transform:translateY(-2px);border-color:var(--blue-wash)}

/* ---- card: the row, promoted to an object. Replaces the flush hairline row on surfaces where a
       line IS a thing you act on, which is what the approved system does everywhere. ---- */
.sh-cards{display:grid;gap:var(--s2)}
.sh-card{background:var(--paper);border-radius:var(--r-md);box-shadow:var(--sh-1);
  padding:var(--s3) var(--s4);display:grid;grid-template-columns:1fr auto;gap:var(--s3);
  align-items:center;border:1px solid transparent;text-align:start;font:inherit;color:inherit;
  transition:box-shadow var(--base) var(--ease),transform var(--base) var(--ease),border-color var(--base) var(--ease)}
.sh-card.go{cursor:pointer}
.sh-card.go:hover{box-shadow:var(--sh-3);transform:translateY(-2px);border-color:var(--blue-wash)}
.sh-card .nm{font-size:var(--t-sm);font-weight:600;color:var(--ink)}
.sh-card .sub{font-size:var(--t-xs);color:var(--muted);margin-block-start:3px;line-height:1.6}
.sh-card .end{display:grid;gap:6px;justify-items:end;min-width:150px}
.sh-card .money{font-size:var(--t-sm);font-weight:600;font-variant-numeric:tabular-nums;color:var(--ink)}

/* ---- stack: ONE bar carrying every share, instead of one bar per row. The comparison the reader
       wants is between the parts, and separate bars make that comparison by memory. ---- */
.sh-stack{display:flex;height:10px;border-radius:var(--r-pill);overflow:hidden;
  background:var(--s-off-soft);margin-block:var(--s2)}
.sh-stack i{display:block;height:100%;transition:width var(--slow) var(--ease)}
.sh-legend{display:flex;gap:var(--s3);flex-wrap:wrap;font-size:var(--t-xs);color:var(--muted);font-weight:600}
.sh-legend span{display:inline-flex;align-items:center;gap:6px}
.sh-legend i{width:10px;height:10px;border-radius:3px;display:inline-block;flex:none}

/* ---- units: data-as-visual. One cell per thing. Six open deals is six cells, counted by looking.
       Cells scale in with a stagger, capped by the same rule as .mo-stagger. ---- */
@keyframes sh-unit{from{opacity:0;transform:scale(.4)}to{opacity:1;transform:none}}
.sh-units{display:grid;grid-template-columns:repeat(auto-fill,14px);gap:4px;direction:rtl;
  margin-block-start:var(--s2)}
.sh-units i{display:block;width:14px;height:14px;border-radius:3px;background:var(--s-off-soft);
  animation:sh-unit var(--base) var(--ease) both}
.sh-units i.on{background:var(--blue)}
.sh-units i.won{background:var(--s-issued)}
.sh-units i.lost{background:var(--s-fail)}

/* ---- empty: drawn, flat, in brand colour. Not a sentence in a grey box. ---- */
.sh-empty{display:grid;justify-items:center;gap:var(--s2);padding:var(--s5) var(--s3);
  background:var(--paper);border-radius:var(--r-md);box-shadow:var(--sh-1);text-align:center}
.sh-empty svg{width:88px;height:88px;display:block}
.sh-empty b{font-size:var(--t-md);color:var(--ink);font-weight:600}
.sh-empty p{font-size:var(--t-xs);color:var(--muted);margin:0;max-width:46ch;line-height:1.8}

.sh-sec{margin-block-end:var(--s5)}
.sh-h{font-size:var(--t-md);font-weight:600;color:var(--ink);margin-block-end:3px}
.sh-hs{font-size:var(--t-xs);color:var(--muted);margin-block-end:var(--s3);max-width:70ch;line-height:1.7}

@media (max-width:560px){
  .sh-tiles{grid-template-columns:repeat(2,1fr)}
  .sh-card,.sh-tile{grid-template-columns:1fr}
  .sh-card .end{justify-items:start;min-width:0}
}
`;

export const SEHA_JS = `
/* ============================ seha components (client) ============================ */

/* The drawn empty state. Flat, single-stroke, brand colour — the approved system's illustration
   idiom. Three scenes, because an empty screen should say WHICH kind of empty it is. */
function shEmpty(kind, title, body) {
  var art = {
    box:  '<path d="M8 16h48v34H8z"/><path d="M8 26h48"/><path d="M26 16l-4-8h20l-4 8"/>',
    chart:'<path d="M10 52V30"/><path d="M24 52V18"/><path d="M38 52V38"/><path d="M52 52V24"/><path d="M6 56h52"/>',
    clock:'<circle cx="32" cy="32" r="20"/><path d="M32 20v13l9 5"/>'
  }[kind] || '';
  return '<div class="sh-empty">' +
    '<svg viewBox="0 0 64 64" fill="none" stroke="var(--blue-light)" stroke-width="2.5" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + art + '</svg>' +
    '<b>' + esc(title) + '</b><p>' + esc(body) + '</p></div>';
}
window.shEmpty = shEmpty;

/* One stacked bar over many parts, plus its legend. Parts under 2% still draw a sliver so a small
   share is visible rather than rounded out of existence. */
function shStack(parts) {
  var total = parts.reduce(function (n, p) { return n + (p.v || 0); }, 0);
  if (!total) return "";
  var bar = '<div class="sh-stack">', leg = '<div class="sh-legend">';
  parts.forEach(function (p) {
    var pct = Math.max(2, Math.round(((p.v || 0) / total) * 100));
    bar += '<i style="width:' + pct + '%;background:' + p.c + '" title="' + esc(p.n) + '"></i>';
    leg += '<span><i style="background:' + p.c + '"></i>' + esc(p.n) + '</span>';
  });
  return bar + "</div>" + leg + "</div>";
}
window.shStack = shStack;

/* The unit grid. COUNT is drawn. Capped so a very long pipeline does not paint a thousand cells;
   the overflow is stated in words rather than silently dropped. */
function shUnits(items, cap) {
  var max = cap || 60, n = Math.min(items.length, max), out = '<div class="sh-units">';
  for (var i = 0; i < n; i++) {
    out += '<i class="' + (items[i] || "") + '" style="animation-delay:' + (i * 14) + 'ms"></i>';
  }
  out += "</div>";
  if (items.length > max) out += '<div class="sh-hs" style="margin:6px 0 0">+' + fmtN(items.length - max) + ' غيرها</div>';
  return out;
}
window.shUnits = shUnits;
`;
