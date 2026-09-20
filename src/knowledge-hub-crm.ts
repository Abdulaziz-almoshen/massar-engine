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
// PORTED to the new design system (docs/PORT-SPEC.md): the body is wrapped in .ds6 and drawn in the
// m-* vocabulary — one card for the readiness figure, one table for the products. The ring, the
// hand-rolled meters and the chip colours this module used to define are all vocabulary now, so the
// rules that drew them are gone; what is left below is the handful of things the vocabulary has no
// word for.
//
// No backticks in this file (gate: check-crm-literals).

export const KB_HUB_CSS = `
/* The three gaps the vocabulary genuinely lacks. Everything else is m-*. */
.ds6 .kh-miss { display:flex; flex-wrap:wrap; gap:4px; }
/* .m-meter carries its own vertical rhythm for a card; inside a cell it sits under the figure. */
.ds6 .kh-meter { margin-block: 6px 0; max-inline-size: 140px; }
.ds6 .kh-go { white-space: nowrap; }
/* A name cell carries its owner and its knowledge state under it; .m-meta is a text scale, not a block. */
.ds6 .m-table .m-meta { display:block; font-weight:400; }
`;

export const KB_HUB_JS = `
/* ONE reading of the catalogue, so the summary and the table below it cannot disagree. Every count
   printed twice on this screen is bound to this function through dsD/dsFig. */
function khRows() {
  var cat = (typeof pcCat !== "undefined" && pcCat) || null;
  if (!cat) return [];
  return cat.filter(function (p) { return !p.archived; }).map(function (p) {
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
  }).sort(function (a, b) {
    /* Least ready first: this screen exists to find the gap, not to celebrate the complete ones. */
    var as = a.score === null ? -1 : a.score, bs = b.score === null ? -1 : b.score;
    if (as !== bs) return as - bs;
    return a.product < b.product ? -1 : 1;
  });
}
function khReadyN() { return khRows().filter(function (r) { return r.ready; }).length; }
function khAvg() {
  var scored = khRows().filter(function (r) { return r.score !== null; });
  if (!scored.length) return null;
  return Math.round(scored.reduce(function (n, r) { return n + r.score; }, 0) / scored.length);
}
function khBind() {
  dsD("khProducts", function () { return khRows().length; });
  dsD("khReady", function () { return khReadyN(); });
}
/* kind: "owed" a number someone owes, "unset" a classification nobody made, "none" a legitimate
   nothing. A score that was never computed is the second kind: nobody has written the knowledge. */
function khNil(t, kind) {
  return '<span class="m-td-nil m-nil--' + (kind || "none") + '">' + esc(t) + "</span>";
}
function khPl(n, one, two, few, many) {
  return (typeof opPl === "function") ? opPl(n, one, two, few, many) : (fmtN(n) + " " + many);
}
function khPct(v) { return '<span class="m-n">' + fmtN(v) + "٪</span>"; }

function khState(title, body, busy, act) {
  return '<div class="ds6"><section class="m-card"><div class="m-empty"' + (busy ? ' aria-busy="true"' : "") +
    '><p class="m-empty__t">' + title + '</p><p class="m-empty__d">' + body + "</p>" +
    (act ? '<div class="m-empty__a">' + act + "</div>" : "") + "</div></section></div>";
}

function vKnowledgeHub() {
  if (typeof pcLoad === "function") pcLoad(false);
  khBind();
  var cat = (typeof pcCat !== "undefined" && pcCat) || null;
  if (!cat) {
    return (typeof pcFailed !== "undefined" && pcFailed)
      ? khState("تعذّر تحميل المنتجات", "لم يُعرض شيء لأن الطلب فشل، لا لأن الكتالوج فارغ.", false,
          '<button type="button" class="m-btn" onclick="pcLoad(true)">أعد المحاولة</button>')
      : khState("جارٍ تحميل معرفة المنتجات…", "تُقرأ درجات الجاهزية من الكتالوج.", true, "");
  }
  var rows = khRows();
  if (!rows.length) {
    return khState("لا منتجات بعد", "تُضاف المنتجات من «المنتجات»، ثم تُكتب معرفتها هنا.", false,
      '<a class="m-btn m-btn--primary" href="#products">فتح المنتجات</a>');
  }

  var avg = khAvg(), readyN = khReadyN();
  var h = '<div class="ds6">';

  /* ---- the figure this screen exists for ---- */
  h += '<section class="m-card" aria-labelledby="khAvg">';
  h += '<p class="m-stat__k" id="khAvg">متوسط جاهزية المساعد</p>';
  h += '<p class="m-stat__v">' + (avg === null ? khNil("لم تُحتسب", "unset") : khPct(avg)) + "</p>";
  if (avg !== null) {
    h += '<div class="m-meter" style="--m-pct:' + Math.max(0, Math.min(100, avg)) + "%;--m-mark:" + KB_READY_MIN +
      '%" role="img" aria-label="متوسط الجاهزية ' + fmtN(avg) + "٪ · حد الجاهزية " + fmtN(KB_READY_MIN) + '٪"><i></i><b></b></div>';
  }
  h += '<p class="m-body">' + dsFig("khReady", readyN) + " من " + dsFig("khProducts", rows.length) +
    " " + (rows.length === 1 ? "منتج جاهز" : "منتجًا جاهزًا") + " للبيع بمعرفته الحالية — الحد " + khPct(KB_READY_MIN) + ".</p>";
  h += '<p class="m-meta">إكمال كل قسم يرفع دقّة ردود المساعد على العملاء؛ الأقسام الثمانية موزونة، والنواقص معروضة أمام كل منتج.</p>';
  h += "</section>";

  /* ---- the products, least ready first ---- */
  h += '<section class="m-card m-card--pad0" aria-labelledby="khList">';
  h += '<header class="m-section-head"><div class="m-section-head__t">' +
    '<h2 class="m-h2" id="khList">المنتجات حسب الجاهزية</h2>' +
    '<p class="m-meta">' + khPl(rows.length, "منتج واحد", "منتجان", "منتجات", "منتجًا") + " · الأقل جاهزية أولًا</p></div></header>";
  h += '<div class="m-tablewrap"><table class="m-table"><thead><tr>' +
    "<th>المنتج</th><th>الجاهزية</th><th>الحالة</th><th>الأقسام الناقصة</th><th></th>" +
    "</tr></thead><tbody>";
  rows.forEach(function (r) {
    var miss = r.missing.filter(function (m) { return m.state !== "done"; });
    var sub = [r.owner ? "مدير المنتج: " + esc(r.owner) : "",
               r.approved ? "معرفة معتمدة" : "معرفة مدمجة",
               r.draft ? "مسودة بانتظار الاعتماد" : ""].filter(Boolean).join(" · ");
    h += "<tr>";
    h += '<td class="m-td-n">' + esc(r.product) + '<span class="m-meta">' + sub + "</span></td>";
    h += '<td class="m-td-v">' + (r.score === null ? khNil("لم تُحتسب", "unset") : khPct(r.score)) +
      (r.score === null ? "" : '<div class="m-meter kh-meter" style="--m-pct:' +
        Math.max(0, Math.min(100, r.score)) + '%"><i></i></div>') + "</td>";
    h += "<td>" + (r.score === null
      ? khNil("لم تُكتب معرفة", "unset")
      : '<span class="m-chip ' + (r.ready ? "m-chip--ok" : "m-chip--warn") + '">' + (r.ready ? "جاهز" : "دون الحد") + "</span>") + "</td>";
    h += "<td>" + (miss.length
      ? '<span class="kh-miss">' + miss.slice(0, 4).map(function (m) {
          return '<span class="m-chip m-chip--warn">' + esc(m.label) + "</span>";
        }).join("") + (miss.length > 4
          ? '<span class="m-chip">و' + khPl(miss.length - 4, "قسم آخر", "قسمان آخران", "أقسام أخرى", "قسمًا آخر") + "</span>"
          : "") + "</span>"
      : '<span class="m-chip m-chip--ok">كل الأقسام مكتملة</span>') + "</td>";
    h += '<td class="m-td-v"><a class="m-link kh-go" href="#product/' + encodeURIComponent(r.product) + '/knowledge">' +
      (miss.length ? "أكمل الأقسام" : "افتح المعرفة") + " &#8592;</a></td>";
    h += "</tr>";
  });
  h += "</tbody></table></div></section>";
  return h + "</div>";
}
`;
