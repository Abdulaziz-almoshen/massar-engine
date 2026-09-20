// reports-crm.ts — «التقارير»: the four reports the stage document names, on screen at last.
//
// They were computable for a while and «التقارير» stayed «قريبًا», which is the same gap as a table
// with a writer and no reader. Each report carries its own question and its own written empty
// state, both from reports-domain.ts, so the screen cannot describe a report differently from the
// query that answers it.
//
// PORTED to the new design system (docs/PORT-SPEC.md). vReportsCrm owns the single .ds6 wrapper for
// the whole #reports screen, so the three ported faces below return unwrapped markup and nest under
// one system rather than four. «مؤشرات الأداء» lives in campaign-results-crm.ts and has NOT been
// ported, so it is rendered outside that wrapper until it is.
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included.

export const REPORTS_CRM_CSS = `
/* PORTED to the m-* vocabulary (docs/PORT-SPEC.md). The tab rail is now .m-tabs / .m-tab with
   aria-selected, so the private .rp-tab strip and its hand-rolled sliding indicator are gone — the
   vocabulary draws the selected tab with a border, and one implementation beats two that slide
   differently. Tiles are .m-stat__*, the acceptance grid is a real .m-table, and the four report
   counts are bound with dsD/dsFig because each one is printed on its tab AND above its list.

   What stays: the acceptance table's own column widths, and the basis block's quoting rule. */
.ds6 .rp-tabs{margin-block-end:var(--m-5)}
.ds6 .rp-q{margin-block-end:var(--m-2)}
.ds6 .rp-tot{margin-block-end:var(--m-4)}
.ds6 .rp-days{font-weight:600}

/* قبول المنتجات — one row per product, worst first. The tone variable colours the pill and the
   tile's leading rule; it is a CLASSIFICATION, which is why it is allowed to be a colour at all. */
.ds6 .ac-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(196px,1fr));gap:var(--m-3);margin-block-end:var(--m-4)}
.ds6 .ac-tile{background:var(--m-paper);border:1px solid var(--m-line);border-radius:var(--m-r-card);
  padding-inline:var(--m-4);padding-block:var(--m-4);display:flex;flex-direction:column;gap:4px;
  border-inline-start:3px solid var(--tn,var(--m-line))}
.ds6 .ac-tbl .m-table{min-inline-size:860px}
.ds6 .ac-pill{display:inline-flex;align-items:center;gap:6px;font-size:var(--m-t-cap);font-weight:600;
  border-radius:var(--m-r-chip);padding-inline:10px;padding-block:3px;
  background:var(--tn-soft,var(--m-sunk));color:var(--tn-text,var(--m-ink-2))}
.ds6 .ac-why{overflow-wrap:anywhere}
.ds6 .ac-sub{display:block;font-weight:400;margin-block-start:2px}

/* the accounting basis, quoted rather than asserted */
.ds6 .rp-basis{margin-block-start:var(--m-5);padding-inline-start:9px;
  border-inline-start:2px solid var(--m-line-2);max-inline-size:66ch}
.ds6 .rp-sec{margin-block-start:var(--m-5)}
`;

export const REPORTS_CRM_JS = `
/* ============================ reports-crm (client) ============================ */
var rpList = null, rpPick = null, rpData = {}, rpLoading = false, rpRoll = null;

function rpLoad() {
  if (rpLoading || rpList) return;
  rpLoading = true;
  fetch("/admin/reports", { headers: { "x-admin-token": TOKEN } })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      rpList = j.reports || [];
      rpLoading = false;
      if (!rpPick && rpList.length) rpOpen(rpList[0].id);
      else render(false);
    })
    .catch(function () { rpList = []; rpLoading = false; render(false); });
}

function rpRollLoad() {
  if (rpRoll) return;
  rpRoll = "loading";
  fetch("/admin/reports/rollups", { headers: { "x-admin-token": TOKEN } })
    .then(function (r) { return r.json(); })
    .then(function (j) { rpRoll = j; render(false); })
    .catch(function () { rpRoll = { byDept: [], byReason: [], failed: true }; render(false); });
}

function rpOpen(id) {
  rpPick = id;
  if (rpData[id]) { render(false); return; }
  fetch("/admin/reports/" + encodeURIComponent(id), { headers: { "x-admin-token": TOKEN } })
    .then(function (r) { return r.json(); })
    .then(function (j) { rpData[id] = j; render(false); })
    .catch(function () { rpData[id] = { rows: [], count: 0, error: true }; render(false); });
}
window.rpOpen = rpOpen;

/* Days waiting is the only number on this screen that decides anything, so it carries the state
   dot. Thresholds are deliberately blunt — two weeks is stale, a month is stuck. */
/* The stage LABEL comes from SALES_STAGES, which sales-domain serialises into the browser — the
   same ladder the server validates against, so the screen cannot name a stage the engine does not
   have. An unknown key prints itself rather than an empty cell. */
function rpStage(k) {
  var s = (typeof SALES_STAGES !== "undefined" ? SALES_STAGES : []).filter(function (x) { return x.key === k; })[0];
  /* An unknown key prints itself rather than an empty cell; a MISSING key is a classification
     nobody made, which is the «unset» absence, and the caller draws it as one. */
  return s ? s.label : String(k || "");
}

/* Days waiting is the only figure on this screen that decides anything, so it carries the state
   colour. Thresholds are deliberately blunt — two weeks is stale, a month is stuck. */
function rpAge(d) {
  var n = Number(d) || 0;
  var cls = n >= 30 ? " m-chip--bad" : (n >= 14 ? " m-chip--warn" : "");
  return '<span class="m-chip' + cls + '"><span class="m-n rp-days">' + fmtN(n) + "</span> يومًا</span>";
}

/* A derivation key has to survive as an HTML attribute value; report ids come from the server. */
function rpKey(id) { return "rp_" + String(id).replace(/[^A-Za-z0-9_-]/g, ""); }

/* «التقارير» has two faces. «نظرة تنفيذية» answers the CPO's questions about the whole pipeline
   (pipeline-report-domain.ts); «تقارير التعثّر» is the original four — which deal is stuck, on whom. */
var rpMode = "exec";
window.rpSetMode = function (m) { rpMode = m === "stuck" || m === "kpis" || m === "accept" ? m : "exec"; render(false); };
/* The four faces of «التقارير», as a tab rail in the vocabulary's own idiom: .m-tabs with
   aria-selected, and the selected tab drawn by its border rather than by a strip that has to be
   measured after paint. moveInd and the private .rp-tab are gone with it.

   «مؤشرات الأداء» is NOT yet ported (it lives in campaign-results-crm.ts), so it is rendered
   OUTSIDE the .ds6 subtree rather than inside it. New tokens under old structure is not a
   half-finished redesign, it is a broken page — the same reason massar-ds-crm.ts is scoped at all. */
function vReportsCrm() {
  var tab = function (key, label) {
    return '<button type="button" class="m-tab" role="tab" aria-selected="' + (rpMode === key) + '"' +
      ' onclick="rpSetMode(&quot;' + key + '&quot;)">' + label + "</button>";
  };
  var rail = '<div class="m-tabs rp-tabs" role="tablist" aria-label="نوع التقرير">' +
    tab("exec", "نظرة تنفيذية") + tab("stuck", "تقارير التعثّر") +
    tab("accept", "قبول المنتجات") + tab("kpis", "مؤشرات الأداء") + "</div>";
  if (rpMode === "kpis" && typeof vReportsKpis === "function") {
    return '<div class="ds6">' + rail + "</div>" + vReportsKpis();
  }
  return '<div class="ds6">' + rail +
    (rpMode === "exec" ? vReportsExec()
      : rpMode === "accept" ? vReportsAccept()
      : vReportsStuck()) + "</div>";
}

function vReportsStuck() {
  rpLoad();
  if (!rpList) return moSkeleton(4, ["w40", "w80", "w60"]);
  if (!rpList.length) {
    return '<div class="m-card m-empty"><p class="m-empty__t">لا تقارير</p>' +
      '<p class="m-empty__d">لم يُعرَّف أي تقرير.</p></div>';
  }

  /* Each report's count is printed TWICE — on its tab and above its list — so both sites are bound
     to the rows the report actually returned (PORT-SPEC §6). */
  rpList.forEach(function (r) {
    dsD(rpKey(r.id), function () {
      var d = rpData[r.id];
      return d && d.rows ? d.rows.length : (d ? d.count : null);
    });
  });

  var h = '<div class="m-tabs rp-tabs" role="tablist" aria-label="التقارير">';
  rpList.forEach(function (r) {
    var d = rpData[r.id];
    h += '<button type="button" class="m-tab" role="tab" aria-selected="' + (r.id === rpPick) + '"' +
      ' onclick="rpOpen(\\'' + r.id + '\\')">' + esc(r.title) +
      (d ? "<b>" + dsFig(rpKey(r.id), d.count) + "</b>" : "") + "</button>";
  });
  h += "</div>";

  var cur = rpData[rpPick];
  if (!cur) return h + moSkeleton(4, ["w60", "w80", "w40"]);

  h += '<p class="rp-q m-meta">' + esc(cur.report.question) + "</p>";

  /* An empty result and a broken query look identical to the reader, so the report says which. */
  if (cur.empty) {
    h += '<div class="m-card m-empty"><p class="m-empty__t">' + esc(cur.empty.title) + "</p>" +
      '<p class="m-empty__d">' + esc(cur.empty.body) + "</p></div>";
    /* THE ROLLUPS ARE NOT PART OF THE SELECTED REPORT. «أين تتعثّر الصفقات» and «الخسائر حسب
       السبب» are page-level and answer their own questions; returning here hid both of them behind
       an unrelated empty state, and on a book with no stalled deal that is EVERY load - two whole
       report cards no reader could reach. */
    return h + vReportRollups();
  }

  h += '<p class="rp-tot m-meta">' + mPl(cur.count, "فرصة واحدة", "فرصتان", "فرص", "فرصة") +
    " · " + mMoney(cur.totalValue) + "</p>";
  h += '<section class="m-card">';
  /* BR-RPT-004: the row IS the deal — «#opps/<id>» is the record's own URL, so a blocked deal opens
     where it can be acted on, and the link is shareable. A row whose opportunity id never arrived
     stays inert rather than linking somewhere plausible. */
  cur.rows.forEach(function (r) {
    var stage = rpStage(r.stage);
    var inner = '<span class="m-item__b"><span class="m-item__n">' +
      (r.account ? esc(r.account) : mNil("بلا اسم مسجّل", "unset")) + "</span>" +
      '<span class="m-item__s">' + esc(r.product) + " · " +
        (stage ? esc(stage) : mNil("لم تُسجَّل مرحلة", "unset")) +
        (r.dept ? " · " + esc(r.dept) : "") + "</span></span>" +
      '<span class="m-item__v">' + mMoney(r.value) + "</span>" + rpAge(r.daysWaiting);
    h += r.oppId
      ? '<a class="m-item" href="#opps/' + fmtId(r.oppId) + '" title="افتح هذه الفرصة">' + inner +
        '<span class="rx-say">افتح فرصة ' + esc(r.account || r.product) + "</span></a>"
      : '<div class="m-item">' + inner + "</div>";
  });
  h += "</section>";

  h += vReportRollups();

  /* Same words as «المنتجات». The accounting basis is undecided and the screen says so rather than
     letting the reader assume one. */
  if (cur.valueBasis) {
    h += '<p class="rp-basis m-meta"><b>' + esc(cur.valueBasis.label) + "</b><br>" + esc(cur.valueBasis.note) + "</p>";
  }
  return h;
}

/* The mockup's other two report blocks. «أين تتعثّر الصفقات» answers a different question from the
   four named reports: not WHICH deals, but WHO is holding them. Ordered by the OLDEST blockage, not
   by count — a department sitting on one deal for forty days is a worse problem than one holding six
   for three, and sorting by count buries the row the block exists to surface. */
function vReportRollups() {
  rpRollLoad();
  if (!rpRoll || rpRoll === "loading") return '<div class="rp-sec">' + moSkeleton(3, ["w60", "w40"]) + "</div>";

  var h = '<section class="m-card rp-sec"><div class="m-card__h"><div>' +
    '<h3 class="m-card__t">أين تتعثّر الصفقات</h3>' +
    '<p class="m-meta">الإجراءات المفتوحة حسب الإدارة المسؤولة، مرتّبة بالأقدم توقّفًا لا بالأكثر عددًا.</p>' +
    "</div></div>";
  if (!rpRoll.byDept.length) {
    h += '<div class="m-empty"><p class="m-empty__t">' + esc(rpRoll.empty.dept.title) + "</p>" +
      '<p class="m-empty__d">' + esc(rpRoll.empty.dept.body) + "</p></div>";
  } else {
    rpRoll.byDept.forEach(function (d) {
      h += '<div class="m-item"><span class="m-item__b"><span class="m-item__n">' + esc(d.dept) + "</span>" +
        '<span class="m-item__s">' + mPl(d.openCount, "إجراء واحد مفتوح", "إجراءان مفتوحان", "إجراءات مفتوحة", "إجراءً مفتوحًا") + "</span></span>" +
        '<span class="m-item__v">' + mMoney(d.value) + "</span>" + rpAge(d.oldestDays) + "</div>";
    });
  }
  h += "</section>";

  h += '<section class="m-card rp-sec"><div class="m-card__h"><div>' +
    '<h3 class="m-card__t">الخسائر حسب السبب</h3>' +
    '<p class="m-meta">كل صفقة مغلقة خسارةً، حسب النتيجة التي أغلقتها. النتيجة تُقرأ من السجل ومن النشاط معًا: نتيجة تُسجَّل على صفقة خاسرة أصلًا لا تُنتج انتقال مرحلة، فلا تصل السجل.</p>' +
    "</div></div>";
  if (!rpRoll.byReason.length) {
    h += '<div class="m-empty"><p class="m-empty__t">' + esc(rpRoll.empty.reason.title) + "</p>" +
      '<p class="m-empty__d">' + esc(rpRoll.empty.reason.body) + "</p></div>";
  } else {
    /* One stacked bar over the reasons, then a row each — the same treatment the sector board
       gets, because the question is identical in shape: which part is biggest. */
    var COLR = ["#D9534F", "#B37F00", "#1E5FCC", "#767D89", "#5B8DEF"];
    h += shStack(rpRoll.byReason.map(function (r, i) {
      return { n: r.label, v: r.value || 0, c: COLR[i % COLR.length] }; }));
    /* THE SHARE AND THE RUNG, both in the reference and neither printed here. A count without its
       share does not answer «which reason dominates», and a reason without the stage it happened
       at does not say WHERE the deal was lost - «اعتراض سعري» at «عرض السعر» and at «التفاوض»
       are different failures. The rung is DERIVED from the outcome itself, because an outcome is
       only recordable on its own stage (outcomeForStage enforces that on the write), so no second
       source can disagree with it. A loss reason picked from the close dialog is not a stage
       outcome and has no rung - and says so rather than borrowing one. */
    var lossTotal = 0;
    rpRoll.byReason.forEach(function (r) { lossTotal += r.count; });
    rpRoll.byReason.forEach(function (r) {
      var share = lossTotal > 0 ? Math.round((r.count / lossTotal) * 100) : null;
      var at = null;
      if (typeof STAGE_OUTCOMES !== "undefined" && STAGE_OUTCOMES) {
        for (var si = 0; si < STAGE_OUTCOMES.length; si++) {
          if (STAGE_OUTCOMES[si].key === r.outcomeKey) { at = STAGE_OUTCOMES[si].stage; break; }
        }
      }
      var sub = mPl(r.count, "صفقة واحدة", "صفقتان", "صفقات", "صفقة") +
        (share === null ? "" : " · " + mPct(share)) +
        " · " + (at ? "عند " + esc(opStage(at).label) : mNil("المرحلة غير مسجّلة", "unset"));
      h += '<div class="m-item"><span class="m-item__b"><span class="m-item__n">' + esc(r.label) + "</span>" +
        '<span class="m-item__s">' + sub + "</span></span>" +
        '<span class="m-item__v">' + mMoney(r.value) + "</span></div>";
    });
  }
  h += "</section>";
  return h;
}

/* ============================ قبول المنتجات ============================
   The prototype's last report, and the one Massar could not produce: how the market RECEIVED each
   product. Every figure here is a count of real lines — the classification is acceptance-domain's,
   and the denominator is printed beside every rate, because «100٪» of one decided deal and of forty
   are different findings. */
var AC_TONE = {
  accepted: "--tn:#12633F;--tn-soft:#E6F3EC;--tn-text:#12633F",
  struggling: "--tn:#B37F00;--tn-soft:#FBF2DC;--tn-text:#7A5600",
  rejected: "--tn:#8E2A27;--tn-soft:#FBE9E8;--tn-text:#8E2A27",
  unsold: "--tn:#A2A9B4;--tn-soft:var(--surface-2);--tn-text:var(--muted)",
  thin: "--tn:#5B8DEF;--tn-soft:var(--accent-tint);--tn-text:var(--accent-deep)"
};
/* annualTarget is NOT an annual target: db.ts builds it from only the quarters that have a
   target row, and says how many in targetQuarters. achieved is the whole fiscal year. So a
   product targeted in Q1 alone for 100,000 that won 400,000 across the year printed «400٪».
   attainmentPct only returns null when the sum is 0, so the all-missing case was caught and the
   partial case — the common one here — was not. Both sibling screens already disclose this;
   this one dropped it. Returns the percentage AND its basis so the caller can qualify it. */
function acAttainOf(product) {
  var rows = (typeof pcQuarters !== "undefined" && pcQuarters && pcQuarters.byProduct) || [];
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].product === product) {
      var qs = Number(rows[i].targetQuarters) || 0;
      if (!qs) return null;
      var pc = typeof wholePct === "function" ? wholePct(attainmentPct(rows[i].achieved, rows[i].annualTarget)) : null;
      return pc === null ? null : { pct: pc, quarters: qs, partial: qs < 4 };
    }
  }
  return null;
}
function vReportsAccept() {
  if (typeof opLoad === "function") opLoad(false);
  if (typeof pcLoad === "function") pcLoad(false);
  var rows = (typeof oppRows !== "undefined" && oppRows) ? oppRows : null;
  var h = '<p class="rp-q m-meta">تقييم المنتجات من ناحية قبول العملاء — يصنّف كل منتج بنتائج صفقاته المحسومة: ما بيع جيدًا، وما تعثّر، وما جرّبه العملاء ورفضوه، وما لم يُحسم فيه شيء بعد.</p>';
  if (!rows) {
    return h + (typeof oppFailed !== "undefined" && oppFailed
      ? '<div class="m-alert" role="alert"><span class="m-alert__d">تعذّر تحميل الفرص.</span>' +
        '<button class="m-btn" onclick="opRetry()">أعد المحاولة</button></div>'
      : moSkeleton(4, ["w40", "w80", "w60"]));
  }
  var cat = ((typeof pcCat !== "undefined" && pcCat) || []).filter(function (p) { return !p.archived; }).map(function (p) { return p.product; });
  var list = productAcceptance(rows.map(function (l) {
    return { product: l.product, stage: l.stage, lostReason: l.lost_reason };
  }), cat, isWonStage, isLostStage, acAttainOf);
  if (!list.length) {
    return h + '<div class="m-card m-empty"><p class="m-empty__t">لا منتجات بعد</p>' +
      '<p class="m-empty__d">يظهر هذا التقرير حين يُسجَّل أول منتج في «المنتجات».</p></div>';
  }
  /* The classification tiles and the table below them count the SAME list, so each tile's figure is
     re-derived from that list on every paint rather than trusted (PORT-SPEC §6). */
  var totals = acceptanceTotals(list);
  totals.forEach(function (t) {
    dsD("ac_" + t.key, function () {
      return acceptanceTotals(list).filter(function (x) { return x.key === t.key; })[0].count;
    });
  });
  h += '<div class="ac-tiles">' + totals.filter(function (t) { return t.key !== "thin" || t.count; }).map(function (t) {
    return '<div class="ac-tile" style="' + (AC_TONE[t.key] || "") + '">' +
      '<span class="m-stat__v">' + dsFig("ac_" + t.key, t.count) + "</span>" +
      '<span class="m-stat__k">' + esc(t.label) + "</span>" +
      '<span class="m-stat__s">' + esc(ACCEPT_HINTS[t.key] || "") + "</span></div>";
  }).join("") + "</div>";
  h += '<div class="m-card m-card--pad0 ac-tbl"><div class="m-tablewrap"><table class="m-table">' +
    "<thead><tr><th>المنتج</th><th>حالة القبول</th>" +
    '<th class="num">مبيعة</th><th class="num">خاسرة</th><th class="num">مفتوحة</th>' +
    "<th>نسبة الإنجاز</th><th>أبرز سبب عدم القبول</th></tr></thead><tbody>";
  list.forEach(function (r) {
    /* Three different absences in one column, and they are not the same fact: a reason nobody
       recorded on a deal that WAS lost is data someone owes; no lost deal at all is a legitimate
       nothing. Drawing both as a dash is what PORT-SPEC §4 exists to stop. */
    var why = r.topReason
      ? esc((typeof LOSS_REASON_LABELS !== "undefined" && LOSS_REASON_LABELS[r.topReason]) || r.topReason) +
        (r.topReasonCount > 1 ? " (" + mN(r.topReasonCount) + ")" : "")
      : r.lost ? mNil("لم يُسجَّل سبب", "unset") : mNil("لا صفقة خاسرة", "none");
    h += '<tr><td class="m-td-n">' + esc(r.product) +
      '<span class="ac-sub m-meta">' + (r.decided
        ? "فوز " + mPct(r.winRatePct) + " · " + mN(r.won) + " من " + mN(r.decided) + " محسومة"
        : "لا صفقة محسومة") + "</span></td>" +
      '<td><span class="ac-pill" style="' + (AC_TONE[r.state] || "") + '">' + esc(ACCEPT_LABELS[r.state]) + "</span></td>" +
      '<td class="m-td-v">' + mN(r.won) + "</td>" +
      '<td class="m-td-v">' + mN(r.lost) + "</td>" +
      '<td class="m-td-v">' + mN(r.open) + "</td>" +
      /* A percentage measured against a partial year cannot be printed bare: it reads as the
         year's. Say what it was measured on, the way the two sibling screens already do. */
      "<td>" + (r.attainmentPct === null
        ? mNil("بلا مستهدف", "owed")
        : (mPct(r.attainmentPct.pct) +
           (r.attainmentPct.partial
             ? ' <span class="m-meta">· مستهدف ' + mN(r.attainmentPct.quarters) + " من أربعة أرباع</span>"
             : ' <span class="m-meta">من المستهدف</span>'))) + "</td>" +
      '<td class="ac-why">' + why + "</td></tr>";
  });
  h += "</tbody></table></div></div>";
  h += '<p class="rp-basis m-meta"><b>كيف صُنِّف كل منتج؟</b><br>' +
    "بنسبة الفوز بين الصفقات المحسومة وحدها: " + mPct(ACCEPT_GOOD_PCT) + " فأكثر «مقبولة»، ودون " + mPct(ACCEPT_BAD_PCT) + " «غير مقبولة»، وما بينهما «متعثّرة». " +
    "المنتج الذي لم تُحسم له صفقة «لم يُبع بعد» مهما كثرت فرصه المفتوحة — الفرصة المفتوحة سؤال لا إجابة. وصفقة محسومة واحدة لا تكفي لحكم.</p>";
  return h;
}
`;
