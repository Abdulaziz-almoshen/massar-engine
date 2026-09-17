// home-ds-crm.ts — «الرئيسية»: a hero band over three columns of graph cards.
//
// WHY THIS SHAPE. The founder rejected the previous layout twice ("layout not accepted", and
// "the grid should be 3 columns not flat full width this is a must") and supplied a fintech
// dashboard as the reference: one leading figure over a dense row of charts. GPT-Astra produced
// the entry at massar-ds/review/entries/astra-home2/, he opened it and approved it on 2026-09-17.
//
// WHY A NAIVE COPY OF THE REFERENCE WOULD BE A LIE. The reference is dense with history. This
// product has almost none: no deal has ever closed, ONE product-quarter carries a target, five of
// six open lines have no price. A revenue-over-time chart here is a flat line at zero, and an
// invented one is worse — a previous design divided the annual target by twelve to draw a monthly
// series, inventing a "required to date" for periods that never had a target. So the charts here
// are the ones the records actually support: how the open lines sit across the stage ladder, how
// long each has stood still, the campaign cohort followed through, and how much of the target book
// is even filled in. Coverage of RECORDING, never a fabricated rate of achievement.
//
// ABSENCE IS TYPED, NOT DASHED (PORT-SPEC §4). Three kinds, three treatments: a number someone
// owes (m-nil--owed), a classification nobody made (m-nil--unset), a legitimate nothing
// (m-nil--none). A page of identical em-dashes teaches the reader to stop seeing dashes.
//
// MOTION. This surface repaints on every route change and every app open. Per the animation
// decision framework that means NOTHING here animates on paint — no growing bars, no staggered
// cards. The only motion is press feedback on the two interactive elements, behind a fine-pointer
// query, and it is defined in massar.css, not here.
//
// SCOPED. The markup is wrapped in .ds6, the only place massar-ds-crm.ts can reach.
//
// (No backticks anywhere below, including in comments: this is one template literal.)

export const HOME_DS_JS = `
/* The year the performance read is keyed by. pcQuarters carries it; fall back to the calendar
   year rather than inventing a fiscal one. */
function hdsYear() {
  return (typeof pcQuarters !== "undefined" && pcQuarters && pcQuarters.year)
    ? Number(pcQuarters.year) : new Date().getFullYear();
}

/* Every count on this page comes from here, so a summary and the card under it cannot disagree.
   That was Astra's finding 5: the rail said six products, the page said "five of six", the truth
   was eight and seven. Three numbers, one fact, none of them derived from the others. */
function hdsFacts() {
  var year = hdsYear();
  var perf = (typeof pcPerf !== "undefined" && pcPerf && pcPerf[year]) ? pcPerf[year] : null;
  var rows = [];
  if (perf) { for (var k in perf) { if (Object.prototype.hasOwnProperty.call(perf, k)) rows.push(perf[k]); } }

  var withTarget = rows.filter(function (p) { return p.annualTarget !== null && p.annualTarget !== undefined; });
  var achieved = 0, openValue = 0, openLines = 0, unpriced = 0, recorded = 0;
  rows.forEach(function (p) {
    achieved += Number(p.achieved) || 0;
    openValue += Number(p.openValue) || 0;
    openLines += Number(p.openLines) || 0;
    unpriced += Number(p.unpricedOpenLines) || 0;
  });
  withTarget.forEach(function (p) { recorded += Number(p.annualTarget) || 0; });

  /* When exactly one product carries the only target, the target has a NAME and a SCOPE, and
     saying them is the difference between a company figure and a product figure. */
  var only = withTarget.length === 1 ? withTarget[0] : null;
  var scope = "";
  if (only) {
    var qs = (only.quarters || []).filter(function (q) { return q.target !== null && q.target !== undefined; });
    scope = qs.length === 1 ? ("الربع " + hdsQName(qs[0].quarter) + " فقط")
      : (qs.length && qs.length < 4 ? (fmtN(qs.length) + " أرباع من أربعة") : "السنة كاملة");
  }
  return {
    year: year, loaded: !!perf, products: rows.length, rows: rows,
    withTarget: withTarget.length, noTarget: rows.length - withTarget.length,
    recorded: recorded, achieved: achieved,
    openValue: openValue, openLines: openLines, unpriced: unpriced,
    onlyProduct: only ? only.product : "", onlyScope: scope
  };
}

/* The open lines, priced first, each with how long it has stood still. opDays is days in the
   CURRENT STAGE (stage_at, falling back to created_at) — the only movement signal the ledger
   actually stores. It is not the age of the deal, and the card says so. */
function hdsLines() {
  var rows = (typeof oppRows !== "undefined" && oppRows) ? oppRows : [];
  var open = rows.filter(function (l) { return opIsOpen(l); });
  return open.map(function (l) {
    return { id: l.id, account: l.account_name || "", product: l.product || "",
             stage: l.stage, source: l.source || "", value: opValue(l), days: opDays(l) };
  }).sort(function (a, b) {
    if (!a.value !== !b.value) return a.value ? -1 : 1;   /* priced first */
    return b.days - a.days;
  });
}

/* A year is a label, not a quantity. fmtN groups thousands and printed «2,026» on the live
   page the first time this shipped. */
function hdsYearTxt(y) { return String(y); }
function hdsQName(q) { return ["", "الأول", "الثاني", "الثالث", "الرابع"][Number(q)] || String(q); }

/* Arabic counts are four-way, never «n + noun». opPl carries the business tier's rule and
   returns PLAIN TEXT, so it is what goes inside an aria-label. */
function hdsPl(n, one, two, few, many) {
  return (typeof opPl === "function") ? opPl(n, one, two, few, many) : (fmtN(n) + " " + many);
}
/* The counted noun ALONE, for the places where the figure is already printed in its own slot
   beside the label. Arabic agreement is four-way and depends on the count even when the count
   is not repeated next to the word: «6 بنود» takes جمع القلة, «11 بندًا» takes التمييز. */
function hdsNoun(n, one, two, few, many) {
  n = Math.abs(Number(n) || 0) % 100;
  if (n === 1) return one;
  if (n === 2) return two;
  if (n >= 3 && n <= 10) return few;
  return many;
}
function hdsN(v) { return '<span class="m-n">' + fmtN(v) + "</span>"; }
/* Money and percent go INSIDE the isolate or they render on the wrong side of the digits. */
function hdsMoney(v) { return '<span class="m-n">' + fmtN(Math.round(v)) + " ر.س</span>"; }

/* kind: "owed" a number someone owes, "unset" a classification nobody made, "none" a
   legitimate nothing. Drawing all three the same is how a page of dashes teaches the reader
   to stop seeing dashes. */
function hdsNil(t, kind) {
  return '<span class="m-nil--' + (kind || "none") + '">' + esc(t) + "</span>";
}

/* Bind the counts this screen prints to the arrays it renders them from. A figure marked with
   dsFig is re-derived on every paint; if the markup and the records ever disagree, the number is
   outlined and the console names the key. Astra's finding 5 was three numbers for one fact — that
   is now a runtime error rather than something the next reviewer has to notice. */
function hdsBind() {
  dsD("products",  function () { return hdsFacts().products; });
  dsD("noTarget",  function () { return hdsFacts().noTarget; });
  dsD("withTarget",function () { return hdsFacts().withTarget; });
  dsD("nLines",    function () { return hdsLines().length; });
  dsD("unpriced",  function () { return hdsLines().filter(function (l) { return !l.value; }).length; });
  dsD("priced",    function () { return hdsLines().filter(function (l) { return l.value > 0; }).length; });
  dsD("maxDays",   function () {
    var ls = hdsLines(); if (!ls.length) return 0;
    return Math.max.apply(null, ls.map(function (l) { return l.days; }));
  });
  dsD("acN",       function () { return hdsAccounts().total; });
  dsD("acNoOwner", function () { return hdsAccounts().noOwner; });
}

/* ---------- icons ----------
   Inline paths rather than a <symbol> sprite: the shell owns <body>, this screen owns a fragment,
   and a sprite defined inside a fragment that gets replaced on every route change is a sprite
   whose <use> references break the moment another screen paints over it. */
var HDS_ICONS = {
  stages: '<path d="M20 5H7m13 7H4m16 7H10"/><circle cx="4" cy="5" r="1"/><circle cx="7" cy="19" r="1"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l-3 2"/>',
  campaign: '<path d="m4 9 13-5v16L4 15Zm0 0v6H2V9m6 8 1 4h4l-2-5m9-7 2-1m-2 8 2 1"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  wallet: '<path d="M20 8H5a2 2 0 0 1 0-4h13v4M4 8v12h16V8m0 5h-5v3h5"/>',
  people: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m1-15a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/>'
};
function hdsIcon(n) {
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + (HDS_ICONS[n] || "") + "</svg>";
}

/* ---------- the hero: two indicators, equal weight ----------
   The founder kept two and asked for them to be better (2026-09-17). Each is now the same shape —
   eyebrow, one figure at one size, a small graphic, and a row of supporting counts — so neither
   reads as the lesser one, and each graphic is drawn from the same population as its figure.

   REVENUE: won value for the fiscal year, with the year's won / lost / open line counts under it.
   Won and lost are this fiscal year's closes; open is every open line whatever its age, and the
   label says «مفتوحة الآن» so the three are not read as one period's split.

   TARGET: the recorded target, with a track of what has been won ON THE TARGETED PRODUCTS, IN THE
   TARGETED QUARTERS, against it. Not company revenue against it: untargeted revenue in that numerator is exactly the defect
   that let attainment pass 100٪ with targets unmet. */
function hdsTargetPeriod(f) {
  var only = null;
  f.rows.forEach(function (p) { if (p.annualTarget !== null && p.annualTarget !== undefined) only = only || p; });
  if (f.withTarget !== 1 || !only) return "";
  var qs = (only.quarters || []).filter(function (q) { return q.target !== null && q.target !== undefined; });
  if (qs.length !== 1) return "";
  var q = Number(qs[0].quarter);
  var cur = (typeof pcQuarters !== "undefined" && pcQuarters) ? Number(pcQuarters.currentQuarter) : null;
  if (!cur) return "";
  if (q < cur) return "انتهى";
  if (q > cur) return "لم يبدأ بعد";
  var end = (typeof pcSectors !== "undefined" && pcSectors && pcSectors.periodEnd) ? Date.parse(pcSectors.periodEnd) : NaN;
  if (isNaN(end)) return "جارٍ";
  var left = Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  return left
    ? ("باقٍ منه " + mPl(left, "يوم واحد", "يومان", "أيام", "يومًا"))
    : "ينتهي اليوم";
}
function hdsHeroStat(label, valueHtml) {
  return '<div class="hx-kpi"><span class="hx-kpi__k">' + label + '</span>' +
    '<span class="hx-kpi__v">' + valueHtml + "</span></div>";
}
function hdsHero(f, lines) {
  var won = 0, lost = 0, tAch = 0;
  f.rows.forEach(function (p) {
    won += Number(p.wonLines) || 0;
    lost += Number(p.lostLines) || 0;
    /* Only the QUARTERS that carry a target. A product targeted for Q3 alone, measured against its
       whole year's wins, would count a Q1 close against a Q3 target — the same numerator/denominator
       mismatch as untargeted revenue, one axis over. */
    (p.quarters || []).forEach(function (q) {
      if (q.target !== null && q.target !== undefined) tAch += Number(q.achieved) || 0;
    });
  });
  var closed = won + lost;

  var h = '<section class="hx-hero" aria-label="الإيراد المحقق والمستهدف المسجّل">';

  /* ---- revenue ---- */
  h += '<div class="hx-hero__c">';
  h += '<div class="hx-hero__h"><h2 class="hx-eyebrow">الإيراد المحقق</h2>' +
       '<span class="hx-tag">السنة المالية <span class="m-n">' + hdsYearTxt(f.year) + "</span></span></div>";
  h += '<p class="hx-big"><span class="m-n">' + fmtN(f.achieved) +
       ' <span class="hx-cur">ر.س</span></span></p>';
  h += '<p class="hx-sub">' + (f.achieved ? "من الصفقات الرابحة المسجّلة هذه السنة."
                                          : "لم تُغلق أي صفقة رابحة هذه السنة.") + "</p>";
  /* The close split as a bar: won against everything closed. With nothing closed there is no
     ratio to draw, so the track is empty and says so, rather than a zero-width fill that reads as
     «every close was lost». */
  h += '<div class="hx-split" role="img" aria-label="' + esc(closed
      ? ("من " + closed + " صفقات مغلقة: " + won + " رابحة و" + lost + " خاسرة")
      : "لا صفقات مغلقة هذه السنة") + '">';
  if (closed) {
    h += '<i class="is-won" style="--hx-v:' + Math.round((won / closed) * 1000) / 10 + '%"></i>' +
         '<i class="is-lost" style="--hx-v:' + Math.round((lost / closed) * 1000) / 10 + '%"></i>';
  }
  h += "</div>";
  h += '<div class="hx-kpis">' +
    hdsHeroStat('<i class="hx-sw is-won" aria-hidden="true"></i>رابحة', hdsN(won)) +
    hdsHeroStat('<i class="hx-sw is-lost" aria-hidden="true"></i>خاسرة', hdsN(lost)) +
    hdsHeroStat("مفتوحة الآن", dsFig("nLines", lines.length)) +
    "</div>";
  h += "</div>";

  /* ---- target ---- */
  h += '<div class="hx-hero__c">';
  if (f.withTarget) {
    var pct = f.recorded > 0 ? Math.round((tAch / f.recorded) * 100) : 0;
    var remain = Math.max(0, f.recorded - tAch);
    h += '<div class="hx-hero__h"><h2 class="hx-eyebrow">' +
         (f.withTarget === 1 ? "المستهدف الوحيد المسجّل" : "المستهدف المسجّل") + "</h2>" +
         '<span class="hx-tag">' + (f.withTarget === 1 ? esc(f.onlyProduct)
            : (dsFig("withTarget", f.withTarget) + " من " + dsFig("products", f.products) + " منتجات")) +
         "</span></div>";
    h += '<p class="hx-big"><span class="m-n">' + fmtN(f.recorded) +
         ' <span class="hx-cur">ر.س</span></span></p>';
    var period = hdsTargetPeriod(f);
    /* The scope names the quarter once and the period says only where that quarter stands:
       «الربع الثالث فقط · الربع الثالث جارٍ» named it twice on the live page. */
    h += '<p class="hx-sub">' + hdsIcon("target") +
         (f.onlyScope ? esc(f.onlyScope) : "على المنتجات ذات المستهدف") +
         (period ? ' <span aria-hidden="true">&#183;</span> ' + period : "") + "</p>";
    h += '<div class="hx-track" role="img" aria-label="' +
         esc("المحقق على المنتجات ذات المستهدف " + tAch + " من " + f.recorded + " ريال") + '">' +
         '<i style="--hx-v:' + Math.min(100, pct) + '%"></i></div>';
    h += '<div class="hx-kpis">' +
      hdsHeroStat("المحقق مقابله", hdsMoney(tAch)) +
      hdsHeroStat("المتبقي", hdsMoney(remain)) +
      hdsHeroStat("نسبة الإنجاز", '<span class="m-n">' + fmtN(pct) + "٪</span>") +
      "</div>";
  } else {
    h += '<div class="hx-hero__h"><h2 class="hx-eyebrow">المستهدف المسجّل</h2></div>';
    h += '<p class="hx-big">' + hdsNil("لا مستهدف مسجّل", "owed") + "</p>";
    h += '<p class="hx-sub">لم يُسجَّل مستهدف على أي منتج في ' + hdsYearTxt(f.year) + ".</p>";
    h += '<div class="hx-track" aria-hidden="true"></div>';
    h += '<div class="hx-kpis">' +
      hdsHeroStat("المنتجات", dsFig("products", f.products)) +
      hdsHeroStat("بلا مستهدف", dsFig("noTarget", f.noTarget)) +
      '<div class="hx-kpi"><a class="hx-link" href="#perf">حدِّد المستهدفات <span aria-hidden="true">&#8592;</span></a></div>' +
      "</div>";
  }
  h += "</div></section>";
  return h;
}

/* ---------- card chrome ---------- */
function hdsCard(icon, title, tag, body, footNote, href, linkTxt) {
  return '<section class="hx-card">' +
    '<div class="hx-card__h"><h3 class="hx-card__t">' + hdsIcon(icon) + title + "</h3>" +
      (tag ? '<span class="hx-tag">' + tag + "</span>" : "") + "</div>" +
    body +
    '<div class="hx-card__f"><span>' + footNote + "</span>" +
      '<a class="hx-link" href="' + href + '">' + esc(linkTxt) +
      ' <span aria-hidden="true">&#8592;</span></a></div></section>';
}
function hdsFig(v, label, note) {
  return '<div class="hx-fig"><span class="hx-fig__v">' + v + "</span>" +
    '<span class="hx-fig__l">' + label + "</span></div>" +
    (note ? '<p class="hx-note">' + note + "</p>" : "");
}

/* ---------- 1. where the open lines sit on the ladder ----------
   ONE SCALE across every rung: a bar whose length is relative to its own row says nothing about
   which stage holds the work. The empty rungs are DRAWN, by their real names — five stages with
   nothing in them is the finding on this card, and a chart listing only occupied stages hides it.
   Only OPEN rungs appear: a line on «إغلاق – ربح» is by definition not an open line, and putting
   the terminal rungs in a distribution of open work would double-count the ladder. */
function hdsStageCard(lines) {
  var stages = (typeof opOpenStages === "function") ? opOpenStages() : [];
  var counts = stages.map(function (s) {
    return { s: s, n: lines.filter(function (l) { return l.stage === s.key; }).length };
  });
  /* A line whose stage key is not on the ladder at all still has to be counted somewhere, or the
     bars silently sum to less than the figure above them. */
  var known = {}; stages.forEach(function (s) { known[s.key] = 1; });
  var offLadder = lines.filter(function (l) { return !known[l.stage]; });
  var occupied = counts.filter(function (c) { return c.n > 0; });
  var empty = counts.filter(function (c) { return c.n === 0; });
  var top = occupied.length ? Math.max.apply(null, occupied.map(function (c) { return c.n; })) : 1;

  /* «0 بنود مفتوحة» is a count of nothing dressed as a quantity. Zero open lines is a legitimate
     nothing, so it is typed as one — the figure slot carries the absence, not a numeral. */
  var body = lines.length
    ? hdsFig(dsFig("nLines", lines.length),
        hdsNoun(lines.length, "بند مفتوح", "بندان مفتوحان", "بنود مفتوحة", "بندًا مفتوحًا"),
        "أغلب البنود في " + esc(occupied[0].s.label) + ".")
    : hdsFig(hdsNil("لا بنود مفتوحة", "none"), "",
        "تظهر هنا فور تسجيل أول فرصة في «فرص البيع».");

  body += '<div class="hx-stage">';
  occupied.forEach(function (c) {
    body += '<div class="hx-stage__r">' +
      '<span class="hx-stage__l" title="' + esc(c.s.label) + '">' + esc(c.s.label) + "</span>" +
      '<span class="hx-stage__t" aria-hidden="true"><span class="hx-stage__f" style="--hx-v:' +
        Math.round((c.n / top) * 100) + '%"></span></span>' +
      '<span class="hx-stage__n m-n">' + fmtN(c.n) + "</span></div>";
  });
  if (empty.length) {
    body += '<div class="hx-rungs">' +
      '<div class="hx-rungs__c">' + hdsPl(empty.length, "مرحلة واحدة", "مرحلتان", "مراحل", "مرحلة") +
        "<br>" + hdsNil("لا بنود مفتوحة", "none") + "</div>" +
      '<div class="hx-rungs__g" style="--hx-c:' + empty.length + '" role="list" aria-label="' +
        esc(hdsPl(empty.length, "مرحلة واحدة", "مرحلتان", "مراحل", "مرحلة") + " بلا بنود مفتوحة") + '">' +
      empty.map(function (c) {
        return '<span class="hx-rung" role="listitem" title="' + esc(c.s.label) + '">' +
          '<span class="m-n">0</span></span>';
      }).join("") + "</div></div>";
  }
  if (offLadder.length) {
    body += '<p class="hx-note">' + hdsNil(hdsPl(offLadder.length, "بند واحد", "بندان", "بنود", "بندًا") +
      " على مرحلة خارج السلّم", "unset") + "</p>";
  }
  body += "</div>";

  return hdsCard("stages", "توزيع مراحل البيع",
    '<span class="m-n">' + fmtN(stages.length) + "</span> مراحل مفتوحة", body,
    "الفراغ في المراحل جزء من الصورة.", "#opps", "كل الفرص");
}

/* ---------- 2. how long each line has stood still ----------
   Six independent columns, NOT a time series. Sorted ascending from the right, which in RTL is
   the start of the reading order. The accent marks the observed maximum, not an invented overdue
   threshold — this ladder's SLA is nullable and only two rungs carry one, so a red "late" count
   here would be a rule the records do not hold. */
function hdsAgeCard(lines) {
  if (!lines.length) {
    return hdsCard("clock", "زمن بلا حركة", "تغيير المرحلة",
      hdsFig(hdsNil("لا بنود مفتوحة", "none"), "", "تظهر هنا فور تسجيل أول فرصة."),
      "أيام منذ آخر تغيير مرحلة.", "#board", "لوحة المتابعة");
  }
  var days = lines.map(function (l) { return l.days; }).sort(function (a, b) { return a - b; });
  var hi = days[days.length - 1];
  var atMax = days.filter(function (d) { return d === hi; }).length;
  var scale = hi > 0 ? hi : 1;

  var body = hdsFig(dsFig("maxDays", hi), "يومًا، أطول توقف",
    atMax > 1
      ? (esc(hdsPl(atMax, "بند واحد", "بندان", "بنود", "بندًا")) + " لم تتغير مرحلتها طوال هذه المدة.")
      : "بند واحد لم تتغير مرحلته طوال هذه المدة.");

  body += '<div class="hx-plot hx-plot--axis" role="img" aria-label="' +
    esc(hdsPl(days.length, "بند واحد", "بندان", "بنود", "بندًا") +
        " مستقلة، مرتبة من اليمين: " + days.join("، ") + " يومًا دون تغيير المرحلة") + '">' +
    '<span class="hx-axis hx-axis--hi" aria-hidden="true"><span class="m-n">' + fmtN(hi) + "</span></span>" +
    '<span class="hx-axis hx-axis--mid" aria-hidden="true"><span class="m-n">' +
      fmtN(Math.round(hi / 2)) + "</span></span>" +
    '<span class="hx-axis hx-axis--lo" aria-hidden="true"><span class="m-n">0</span></span>' +
    '<div class="hx-guides" aria-hidden="true"><i></i><i></i><i></i></div>' +
    '<div class="hx-cols" style="--hx-c:' + days.length + '" aria-hidden="true">' +
    days.map(function (d) {
      return '<div class="hx-col' + (d === hi ? " is-max" : "") +
        '" style="--hx-h:' + Math.round((d / scale) * 1000) / 10 + '%">' +
        '<i></i><b class="m-n">' + fmtN(d) + "</b></div>";
    }).join("") + "</div></div>";
  body += '<p class="hx-cap"><span>كل عمود بند مستقل؛ مرتبة حسب المدة.</span>' +
    '<span class="hx-legend"><i aria-hidden="true"></i>الأطول</span></p>';

  return hdsCard("clock", "زمن بلا حركة", "تغيير المرحلة", body,
    "أيام في المرحلة، لا عمر الصفقة.", "#board", "لوحة المتابعة");
}

/* ---------- 3. the campaign cohort, followed through ----------
   ONE cohort through its own steps, which is what makes this a legitimate funnel. No conversion
   rate is printed between steps: a rate needs its denominator beside it, and a rate BETWEEN two
   steps of a cohort invites reading it as a rate for the whole book. The last rung is the
   attributed opportunity count from the campaign results endpoint, not a guess from oppRows. */
function hdsCampaign() {
  var camps = (typeof campaigns !== "undefined" && campaigns) ? campaigns : [];
  var live = camps.filter(function (c) {
    return (typeof campIsTest !== "function") || !campIsTest(c);
  });
  if (!live.length || typeof campStats !== "function") {
    return hdsCard("campaign", "مسار الحملة", "",
      hdsFig(hdsNil("لا حملات بعد", "none"), "", "أطلق الأولى من «إنشاء حملة»."),
      "تتابع المجموعة نفسها.", "#kmon", "متابعة الحملات");
  }
  /* The most recent live campaign, named. An aggregate across campaigns is a different measure —
     several cohorts at different ages added together — and calling that "a funnel" is the kind of
     population mismatch the audit kept finding. Sorted HERE rather than trusting the array order:
     the server sends newest-first, and the first version of this card took the last element and
     rendered the oldest campaign on the live page. */
  var cp = live.slice().sort(function (a, b) {
    return String(b.created_at || "").localeCompare(String(a.created_at || ""));
  })[0];
  var st = campStats(cp);
  var opps = null;
  if (typeof crLoad === "function") {
    crLoad(cp.id, false);
    var r = (typeof crRes !== "undefined" && crRes && crRes[cp.id]) ? crRes[cp.id] : null;
    if (r && r.data && r.data.results) opps = Number(r.data.results.opportunities) || 0;
  }

  var steps = [
    { k: "أُرسلت", v: st.sent }, { k: "وصلت", v: st.delivered }, { k: "شوهدت", v: st.seen },
    { k: "ردّوا", v: st.replied }, { k: "اهتمّوا", v: st.interested }
  ];
  if (opps !== null) steps.push({ k: "فرص", v: opps });
  var top = Math.max.apply(null, steps.map(function (s) { return s.v; }).concat([1]));

  var body = hdsFig(
    opps === null ? hdsNil("جارٍ القراءة", "unset") : '<span class="m-n">' + fmtN(opps) + "</span>",
    "فرص نتجت عن الحملة",
    /* Counted, not «بـ1 رسالة»: one and two take their own forms and carry no numeral. */
    "بدأت بـ" + mPl(st.sent, "رسالة واحدة", "رسالتين", "رسائل", "رسالة") + "؛ " + (st.interested
      ? "وصلت إلى " + mPl(st.interested, "مهتم واحد", "مهتمَّين", "مهتمين", "مهتمًا") + "."
      : "لم يُبدِ أحد اهتمامًا بعد."));

  body += '<div class="hx-plot" role="img" aria-label="' +
    esc("تتابع الحملة من اليمين إلى اليسار: " +
        steps.map(function (s) { return s.k + " " + s.v; }).join("، ")) + '">' +
    '<div class="hx-guides" aria-hidden="true"><i></i><i></i><i></i></div>' +
    '<div class="hx-cols" style="--hx-c:' + steps.length + '" aria-hidden="true">' +
    steps.map(function (s) {
      return '<div class="hx-col' + (s.v === 0 ? " is-zero" : "") +
        '" style="--hx-h:' + Math.round((s.v / top) * 1000) / 10 + '%">' +
        '<i></i><b class="m-n">' + fmtN(s.v) + "</b></div>";
    }).join("") + "</div></div>";
  body += '<div class="hx-xlabels" style="--hx-c:' + steps.length + '" aria-hidden="true">' +
    steps.map(function (s) { return "<span>" + esc(s.k) + "</span>"; }).join("") + "</div>";
  body += '<p class="hx-cap hx-cap--plain">تتابع المجموعة نفسها ' +
    '<span aria-hidden="true">&#8592;</span> من الإرسال إلى الفرصة</p>';

  /* The card title stays «مسار الحملة» and the campaign's own name goes in the tag: a name in the
     title wrapped to two lines and pushed this card's figure below its row-mates'. */
  return hdsCard("campaign", "مسار الحملة",
    '<span title="' + esc(cp.name) + '">' + esc(clip(cp.name, 20)) + "</span>", body,
    opps === 0 ? "لا فرص من هذه الحملة بعد." : "بلا معدلات تحويل.",
    "#kmon/" + cp.id, "سجل الحملة");
}

/* ---------- 4. how much of the target book is filled in ----------
   A COMPLETENESS meter, not a performance one, and the card says so in its own foot. The quarters
   that carry no target are hatched, never drawn as zero: a target nobody set is not a target of
   zero, and that single confusion is what let attainment pass 100٪ with targets unmet. */
function hdsTargetCard(f) {
  /* No products at all is not «0/0» — a ratio with nothing on either side of the slash is a
     figure that looks computed and means nothing. */
  if (!f.products) {
    return hdsCard("target", "تغطية المستهدفات", "اكتمال التسجيل",
      hdsFig(hdsNil("لا منتجات مسجّلة", "none"), "",
        "تظهر التغطية فور تسجيل أول منتج."),
      "اكتمال المستهدفات، لا نسبة تحقيقها.", "#products", "المنتجات");
  }
  var body = hdsFig(
    '<span class="m-n">' + fmtN(f.withTarget) + " / " + fmtN(f.products) + "</span>",
    hdsNoun(f.withTarget, "منتج له مستهدف", "منتجان لهما مستهدف",
            "منتجات لها مستهدف", "منتجًا له مستهدف"),
    "");

  body += '<div class="hx-segs" style="--hx-c:' + Math.max(f.products, 1) + '" aria-hidden="true">' +
    f.rows.map(function (p) {
      var on = p.annualTarget !== null && p.annualTarget !== undefined;
      return '<i class="' + (on ? "is-on" : "is-off") + '" title="' + esc(p.product) + '"></i>';
    }).join("") + "</div>";
  body += '<p class="hx-cov"><span>' +
    (f.withTarget === 1 ? esc(f.onlyProduct) + " فقط" : hdsN(f.withTarget) + " من " + hdsN(f.products)) +
    "</span>" +
    (f.noTarget ? hdsNil(hdsPl(f.noTarget, "منتج واحد بلا مستهدف", "منتجان بلا مستهدف",
      "منتجات بلا مستهدف", "منتجًا بلا مستهدف"), "owed") : "") + "</p>";

  /* Quarters run الأول at the RIGHT: first child of an RTL grid is the right-hand cell, which is
     where the earliest period belongs. Reversing the array here would put Q1 on the left. */
  var qs = [1, 2, 3, 4].map(function (q) {
    var t = null;
    f.rows.forEach(function (p) {
      (p.quarters || []).forEach(function (x) {
        if (Number(x.quarter) === q && x.target !== null && x.target !== undefined) {
          t = (t || 0) + Number(x.target);
        }
      });
    });
    return { q: q, t: t };
  });
  var recorded = qs.filter(function (x) { return x.t !== null; }).length;
  body += '<div class="hx-qhead"><span>سجل الأرباع <span class="m-n">' + hdsYearTxt(f.year) +
    "</span></span><span>" + hdsPl(recorded, "ربع واحد", "ربعان", "أرباع", "ربعًا") +
    " من أربعة</span></div>";
  body += '<div class="hx-qs">' + qs.map(function (x) {
    return '<div class="hx-q' + (x.t !== null ? " is-on" : "") + '">' +
      '<p class="hx-q__n">' + hdsQName(x.q) + "</p>" +
      '<div class="hx-q__c">' + (x.t !== null ? hdsMoney(x.t) : hdsNil("بلا مستهدف", "owed")) +
      "</div></div>";
  }).join("") + "</div>";
  body += '<p class="hx-cap hx-cap--plain">التسجيل عبر الأرباع ' +
    '<span aria-hidden="true">&#8592;</span> المستهدف الغائب ليس صفرًا.</p>';

  return hdsCard("target", "تغطية المستهدفات", "اكتمال التسجيل", body,
    "اكتمال المستهدفات، لا نسبة تحقيقها.", "#perf", "المستهدفات والأداء");
}

/* ---------- 5. what the open pipeline is worth, and where it sits ----------
   The figure is the sum of the PRICED lines only, and it is labelled «مسجّلة» rather than
   «إجمالي»: the unpriced lines have an unknown value, not a value of zero, so no total exists
   until they are priced. Adding zeros for them would understate the book and print a number
   nobody recorded. */
function hdsValueCard(f, lines) {
  var priced = lines.filter(function (l) { return l.value > 0; });
  var pricedValue = 0; priced.forEach(function (l) { pricedValue += l.value; });
  var unpriced = lines.length - priced.length;

  var body = hdsFig(
    priced.length ? '<span class="m-n">' + fmtN(Math.round(pricedValue)) +
      ' <span class="hx-cur">ر.س</span></span>' : hdsNil("لا بند مسعَّر", "owed"),
    "مسجّلة",
    priced.length === 1 ? "قيمة بند واحد مُسعّر، وليست إيرادًا."
      : "قيمة البنود المسعّرة، وليست إيرادًا.");

  if (lines.length) {
    body += '<div class="hx-segs" style="--hx-c:' + lines.length + '" aria-hidden="true">' +
      lines.map(function (l) {
        return '<i class="' + (l.value > 0 ? "is-on" : "is-off") + '"></i>';
      }).join("") + "</div>";
    body += '<p class="hx-cov"><span>' + dsFig("priced", priced.length) + " من " +
      dsFig("nLines", lines.length) + "</span>" +
      (unpriced ? hdsNil(hdsPl(unpriced, "بند واحد لم يُسعَّر", "بندان لم يُسعَّرا",
        "بنود لم تُسعَّر", "بندًا لم يُسعَّر"), "owed") : "") + "</p>";
    if (unpriced) {
      body += '<p class="hx-note">إجمالي قيمة الفرص غير معروف حتى يكتمل التسعير.</p>';
    }
  }

  var secs = (typeof pcSectors !== "undefined" && pcSectors && pcSectors.sectors)
    ? pcSectors.sectors : [];
  if (secs.length) {
    body += '<dl class="hx-sectors">' + secs.map(function (sc) {
      return "<div><dt>" + esc(sc.sector) +
        (sc.target > 0 ? '<span role="img" aria-label="قطاع ذو مستهدف مسجّل">' +
          hdsIcon("target") + "</span>" : "") + "</dt><dd>" +
        (sc.openCount
          ? esc(hdsPl(sc.openCount, "بند واحد", "بندان", "بنود", "بندًا"))
          : hdsNil("لا بنود مفتوحة", "none")) + "</dd></div>";
    }).join("") + "</dl>";
  }

  return hdsCard("wallet", "قيمة الفرص وقطاعاتها", "بنود مفتوحة", body,
    "القيمة المسعّرة، لا الإيراد.", "#opps", "كل الفرص");
}

/* ---------- 6. can the people and the material carry it ----------
   Two facts about readiness rather than performance: whether every account has someone
   responsible for it, and whether the assistant has the material to answer for the products.
   An account with no owner is UNSET — nobody made the assignment — not a number owed. */
function hdsAccounts() {
  var rows = (typeof acRows !== "undefined" && acRows) ? acRows : null;
  if (!rows) return { loaded: false, total: 0, noOwner: 0, approved: 0 };
  var book = rows.filter(function (a) { return a.approval !== "rejected"; });
  return {
    loaded: true,
    total: book.length,
    approved: book.filter(function (a) { return a.approval !== "proposed"; }).length,
    noOwner: book.filter(function (a) { return !a.ownerId; }).length
  };
}
function hdsReadyCard() {
  var a = hdsAccounts();
  var body;
  if (!a.loaded) {
    body = hdsFig(hdsNil("جارٍ القراءة", "unset"), "الحسابات", "");
  } else {
    body = hdsFig(dsFig("acN", a.total), hdsNoun(a.total, "حساب", "حسابان", "حسابات", "حسابًا"),
      a.approved === a.total ? "جميعها معتمدة."
        : (hdsN(a.approved) + " معتمد، والباقي بانتظار الاعتماد."));
    if (a.total) {
      body += '<div class="hx-dots" style="--hx-c:' + Math.min(a.total, 24) + '" role="img" ' +
        'aria-label="' + esc(a.noOwner
          ? (hdsPl(a.noOwner, "حساب واحد", "حسابان", "حسابات", "حسابًا") + " بلا مسؤول من " + a.total)
          : "لكل حساب مسؤول") + '">' +
        (function () {
          var out = "", withOwner = a.total - a.noOwner, i;
          for (i = 0; i < Math.min(a.total, 24); i++) {
            out += '<i class="' + (i < withOwner ? "is-on" : "") + '"></i>';
          }
          return out;
        })() + "</div>";
      body += '<p class="hx-note">' + (a.noOwner === a.total
        ? hdsNil("لم يُسنَد مسؤول لأي حساب", "unset")
        : (a.noOwner
            ? (dsFig("acNoOwner", a.noOwner) + " بلا مسؤول؛ كل خانة حساب.")
            : "لكل حساب مسؤول.")) + "</p>";
    }
  }

  /* The knowledge figure is khAvg() — the mean over products that HAVE a score — and khReadyN()
     the count that clear the readiness line. Neither is derived from the other, and a product
     nobody has written for is excluded from the mean rather than entered as a zero. */
  var avg = (typeof khAvg === "function") ? khAvg() : null;
  var readyN = (typeof khReadyN === "function") ? khReadyN() : null;
  var prodN = (typeof pcCat !== "undefined" && pcCat) ? pcCat.length : 0;
  body += '<div class="hx-know">';
  if (avg === null) {
    body += '<div><h3>جاهزية المعرفة</h3><p>' + hdsNil("لم تُقَس", "unset") + "</p></div>";
  } else {
    body += '<div class="hx-ring" role="img" aria-label="' +
      esc("متوسط جاهزية المعرفة " + avg + " من 100") + '">' +
      '<svg viewBox="0 0 80 80" aria-hidden="true">' +
      '<circle class="hx-ring__t" cx="40" cy="40" r="34"/>' +
      '<circle class="hx-ring__v" cx="40" cy="40" r="34" pathLength="100" style="--hx-v:' +
        avg + '"/></svg>' +
      '<div class="hx-ring__l" aria-hidden="true"><span class="m-n">' + fmtN(avg) +
        '</span><small>من <span class="m-n">100</span></small></div></div>';
    body += "<div><h3>جاهزية المعرفة</h3><p>" +
      (readyN !== null && prodN
        ? (hdsN(readyN) + " من " + hdsN(prodN) + " منتجات جاهزة للمساعد.")
        : "متوسط المنتجات المقيسة.") + "</p>" +
      "<p>المتوسط لا يشمل منتجًا لم يُكتب له محتوى.</p></div>";
  }
  body += "</div>";

  return hdsCard("people", "جاهزية التنفيذ", "الحسابات والمعرفة", body,
    "من يتابع، وبأي محتوى.", "#accounts", "العملاء");
}

/* ---------- the surface ---------- */
function vHomeDs() {
  /* Every loader is idempotent, guards its own in-flight flag, and ends in render(false), so
     calling them here is safe and the screen repaints itself as each one lands. #home is off the
     5s tick (R14), so none of them inherits a poll. */
  if (typeof pcLoad === "function") pcLoad(false);
  if (typeof opLoad === "function") opLoad(false);
  if (typeof pcPerfLoad === "function") pcPerfLoad(hdsYear(), false);
  /* These three were missing and each one silently emptied a card: the stage ladder fell back to
     the compiled rungs (so an admin rename never showed), accounts read as none at all, and the
     campaign funnel had no attributed opportunity count. */
  if (typeof cfLoad === "function") cfLoad(false);
  if (typeof acLoad === "function") acLoad(false);

  hdsBind();
  var f = hdsFacts();
  var linesReady = (typeof oppRows !== "undefined" && oppRows);
  if (!f.loaded || !linesReady) {
    return '<div class="ds6"><section class="hx-hero"><div class="hx-hero__c">' +
      '<p class="hx-sub" aria-busy="true">جارٍ قراءة الأداء…</p></div></section></div>';
  }
  var lines = hdsLines();

  return '<div class="ds6">' +
    hdsHero(f, lines) +
    '<div class="hx-glabel"><h2>ما وراء الرقم</h2>' +
      '<p>من السجلات المتاحة <span aria-hidden="true">&#183;</span> بلا توقعات</p></div>' +
    '<div class="hx-grid">' +
      hdsStageCard(lines) +
      hdsAgeCard(lines) +
      hdsCampaign() +
      hdsTargetCard(f) +
      hdsValueCard(f, lines) +
      hdsReadyCard() +
    "</div>" +
    '<p class="hx-foot">المسجّل يظهر بقيمته. ما ينقص التسجيل يبقى ظاهرًا، وما يساوي صفرًا يبقى صفرًا.</p>' +
    "</div>";
}
`;
