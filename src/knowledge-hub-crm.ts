// knowledge-hub-crm.ts — «معرفة المنتج»: one screen that answers «ما الذي يعرفه المساعد، وأين النقص؟»
//
// The founder's prototype gives product knowledge its own door: a readiness figure, a product picker,
// and the sections still missing. Massar had all of it — the eight weighted sections, the score, the
// draft/approve flow — but only inside one product's record, so nobody could see WHICH product is
// holding the assistant back without opening seven records one at a time.
//
// This screen ranks by what is missing. It writes nothing: «أكمل الأقسام» opens the product's own
// editor, which owns that write (and is itself gated on knowledge.edit).
//
// No backticks in this file (gate: check-crm-literals).

export const KB_HUB_CSS = `
.kh { display:flex; flex-direction:column; gap:var(--s4); }
.kh-top { display:flex; align-items:center; gap:var(--s5); flex-wrap:wrap; background:var(--paper);
  border:1px solid var(--line); border-radius:var(--r-lg); padding:var(--s4); }
.kh-ring { flex:none; display:flex; align-items:center; gap:var(--s3); }
.kh-ring svg { width:84px; height:84px; transform:rotate(-90deg); }
.kh-ring .track { fill:none; stroke:var(--surface-2); stroke-width:9; }
.kh-ring .arc { fill:none; stroke:var(--accent); stroke-width:9; stroke-linecap:round;
  transition:stroke-dashoffset 420ms cubic-bezier(0.23, 1, 0.32, 1); }
.kh-ring .cap { font-size:var(--t-xl); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; }
.kh-ring .cap span { display:block; font-size:var(--t-xs); font-weight:400; color:var(--muted); margin-block-start:2px; }
.kh-sum { flex:1; min-width:0; font-size:var(--t-sm); color:var(--ink-2); line-height:1.9; }
.kh-sum b { color:var(--ink); font-weight:600; }
.kh-sum .q { display:block; font-size:var(--t-xs); color:var(--muted); margin-block-start:4px; }

.kh-card { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg); overflow:hidden; }
.kh-r { display:grid; grid-template-columns:minmax(0,1.2fr) 108px minmax(0,1.6fr) auto; align-items:center;
  gap:var(--s3); padding:var(--s3) var(--s4); border-top:1px solid var(--line-soft); font-size:var(--t-sm); }
.kh-r:first-of-type { border-top:0; }
.kh-r.hdr { font-size:var(--t-xs); font-weight:600; color:var(--muted); background:var(--surface); border-top:0; }
.kh-r .nm { font-weight:600; color:var(--ink); overflow-wrap:anywhere; }
.kh-r .nm .sub { display:block; font-weight:400; font-size:var(--t-xs); color:var(--muted); margin-block-start:2px; }
.kh-meter { display:flex; align-items:center; gap:8px; }
.kh-meter .bar { flex:1; height:8px; border-radius:var(--r-pill); background:var(--surface-2); overflow:hidden; }
.kh-meter .bar i { display:block; height:100%; border-radius:var(--r-pill); background:var(--accent);
  transition:width 320ms cubic-bezier(0.23, 1, 0.32, 1); }
.kh-meter.ok .bar i { background:var(--s-ok-text, #12633F); }
.kh-meter.low .bar i { background:var(--s-attn-mark, #B37F00); }
.kh-meter .v { font-size:var(--t-xs); font-weight:600; font-variant-numeric:tabular-nums; color:var(--ink); }
.kh-miss { display:flex; flex-wrap:wrap; gap:4px; }
.kh-miss span { font-size:var(--t-xs); border-radius:var(--r-pill); padding:2px 9px;
  background:var(--s-attn-soft, #FBF2DC); color:var(--s-attn-text, #7A5600); }
.kh-miss span.done { background:var(--s-ok-soft, #E6F3EC); color:var(--s-ok-text, #12633F); }
/* «و9 أخرى» counts MORE missing sections — it must not wear the completed colour */
.kh-miss span.more { background:var(--surface-2); color:var(--muted); }
.kh-go { font-family:inherit; font-size:var(--t-xs); font-weight:500; color:var(--accent-deep); background:none;
  border:0; cursor:pointer; padding:6px 8px; border-radius:var(--r-sm); text-decoration:none; white-space:nowrap; }
@media (hover:hover) and (pointer:fine) { .kh-go:hover { background:var(--accent-bar-hover); } }
.kh-go:active { transform:scale(0.97); }
.kh-state { padding:var(--s5) var(--s4); text-align:center; font-size:var(--t-sm); color:var(--muted); line-height:1.9; }

@media (prefers-reduced-motion: reduce) { .kh-ring .arc, .kh-meter .bar i { transition:none; } }
@media (max-width: 880px) {
  .kh-r { grid-template-columns:minmax(0,1fr) auto; row-gap:6px; }
  .kh-r.hdr { display:none; }
  .kh-meter, .kh-miss { grid-column:1 / -1; }
}
@media (pointer: coarse) { .kh-go { min-height:44px; display:inline-flex; align-items:center; } }
`;

export const KB_HUB_JS = `
function vKnowledgeHub() {
  if (typeof pcLoad === "function") pcLoad(false);
  var cat = (typeof pcCat !== "undefined" && pcCat) || null;
  var h = '<div class="kh">';
  if (!cat) {
    return h + '<div class="kh-card"><div class="kh-state"' +
      (typeof pcFailed !== "undefined" && pcFailed
        ? ' role="alert">تعذّر تحميل المنتجات.<button class="kh-go" onclick="pcLoad(true)">أعد المحاولة</button>'
        : ' aria-busy="true">جارٍ تحميل معرفة المنتجات…') + "</div></div></div>";
  }
  var rows = cat.filter(function (p) { return !p.archived; }).map(function (p) {
    var ks = p.knowledgeScore || null;
    return {
      product: p.product,
      owner: p.owner || "",
      score: ks && typeof ks.score === "number" ? ks.score : null,
      ready: !!(ks && ks.ready),
      missing: (ks && ks.missing) || [],
      approved: !!(p.kb && p.kb.state === "approved"),
      draft: !!p.draft
    };
  });
  if (!rows.length) {
    return h + '<div class="kh-card"><div class="kh-state">لا منتجات بعد — تُضاف من «المنتجات»، ثم تُكتب معرفتها هنا.</div></div></div>';
  }
  /* Least ready first: this screen exists to find the gap, not to celebrate the complete ones. */
  rows.sort(function (a, b) {
    var as = a.score === null ? -1 : a.score, bs = b.score === null ? -1 : b.score;
    if (as !== bs) return as - bs;
    return a.product < b.product ? -1 : 1;
  });

  var scored = rows.filter(function (r) { return r.score !== null; });
  var avg = scored.length ? Math.round(scored.reduce(function (n, r) { return n + r.score; }, 0) / scored.length) : null;
  var readyN = rows.filter(function (r) { return r.ready; }).length;
  var R = 36, C = 2 * Math.PI * R;
  var dash = avg === null ? 0 : Math.max(0, Math.min(100, avg)) / 100 * C;
  h += '<div class="kh-top"><div class="kh-ring">' +
    '<svg viewBox="0 0 84 84" role="img" aria-label="متوسط جاهزية المساعد ' + (avg === null ? "غير محسوب" : fmtN(avg) + "٪") + '">' +
    '<circle class="track" cx="42" cy="42" r="' + R + '"></circle>' +
    '<circle class="arc" cx="42" cy="42" r="' + R + '" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C - dash).toFixed(1) + '"></circle></svg>' +
    '<span class="cap">' + (avg === null ? "—" : fmtN(avg) + "٪") + "<span>متوسط الجاهزية</span></span></div>" +
    '<div class="kh-sum"><b>' + fmtN(readyN) + " من " + fmtN(rows.length) + "</b> منتجًا جاهزًا للبيع بمعرفته الحالية — الحد " + fmtN(KB_READY_MIN) + "٪." +
    '<span class="q">كل قسم تكمله يرفع دقّة ردود المساعد على العملاء. الأقسام الثمانية موزونة، وما ينقص منها معروض أمام كل منتج.</span></div></div>';

  h += '<div class="kh-card">' +
    '<div class="kh-r hdr"><span>المنتج</span><span>الجاهزية</span><span>الأقسام الناقصة</span><span></span></div>';
  rows.forEach(function (r) {
    var cls = r.score === null ? "" : r.ready ? " ok" : r.score >= 40 ? " low" : "";
    var miss = r.missing.filter(function (m) { return m.state !== "done"; });
    var body = miss.length
      ? '<span class="kh-miss">' + miss.slice(0, 4).map(function (m) { return "<span>" + esc(m.label) + "</span>"; }).join("") +
        (miss.length > 4 ? '<span class="more">و' + fmtN(miss.length - 4) + " أخرى</span>" : "") + "</span>"
      : '<span class="kh-miss"><span class="done">كل الأقسام مكتملة</span></span>';
    h += '<div class="kh-r"><span class="nm">' + esc(r.product) +
      '<span class="sub">' + [r.owner ? "مدير المنتج: " + esc(r.owner) : "", r.approved ? "معرفة معتمدة" : "معرفة مدمجة", r.draft ? "مسودة بانتظار الاعتماد" : ""].filter(Boolean).join(" · ") + "</span></span>" +
      '<span class="kh-meter' + cls + '"><span class="bar"><i style="width:' + (r.score === null ? 0 : Math.max(0, Math.min(100, r.score))) + '%"></i></span>' +
      '<span class="v">' + (r.score === null ? "—" : fmtN(r.score) + "٪") + "</span></span>" +
      body +
      '<a class="kh-go" href="#product/' + encodeURIComponent(r.product) + '/knowledge">' + (miss.length ? "أكمل الأقسام ←" : "افتح المعرفة ←") + "</a></div>";
  });
  h += "</div></div>";
  return h;
}
`;
