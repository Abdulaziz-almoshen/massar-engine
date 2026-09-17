// campaign-results-crm.ts — «سلسلة التحويل» on a campaign's «الأداء» tab and «مؤشرات الأداء» under التقارير
// (client A, BRD v1.0: BR-MON-004/005/006, §23 KPIs, slice S4).
//
// ONE NUMBER, ONE SOURCE. The top of the chain (أُرسلت · شوهدت · ردّوا · مهتمون) comes from campStats, the
// same contact-ledger reading the campaign's six cards and the campaigns list already print. The rest
// (مؤهلون · فرص · اجتماعات · عروض · مبيعات) comes from /admin/campaigns/:id/results and /admin/kpis, which
// attribute opportunity lines to campaigns (campaign-results-domain). Rates are funnelRates, the BRD's own
// definitions, and a rate over nothing is an absence, never a zero.
//
// PORTED to the new design system (docs/PORT-SPEC.md): both surfaces are wrapped in .ds6 and drawn in the
// m-* vocabulary — m-card for the two objects, a scoped cr-chain the vocabulary does not carry, m-table inside m-tablewrap
// for the per-campaign results. Every digit goes through .m-n and every missing rate is an absence with a
// KIND («لا أساس للنسبة» is a legitimate nothing; «لم تُقَس» is a measurement nobody made).
//
// THE TARGET TILE'S CAPTION IS LOAD-BEARING and is kept verbatim: the ratio covers only the products that
// carry a target, and the caption says how many that is and how much revenue sits outside it. A percentage
// over part of the catalogue reads as the whole one (PORT-SPEC 7).
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const CAMPAIGN_RESULTS_CRM_CSS = `
/* Only what the m-* vocabulary genuinely lacks: the chain's own grid, the rate row, the attributed
   lines, and the KPI tile grid. Everything else is m-card / m-table / m-chip / m-n. */
.ds6 .cr-chain { display:grid; grid-template-columns:repeat(auto-fit, minmax(96px, 1fr)); gap:var(--m-1); }
.ds6 .cr-step { position:relative; display:flex; flex-direction:column; gap:2px; padding:10px 10px 14px;
  border-radius:var(--m-r-ctl); background:var(--m-page); min-inline-size:0; }
.ds6 .cr-step .l { font-size:var(--m-t-cap); color:var(--m-mut); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ds6 .cr-step .v { font-size:var(--m-t-fig); font-weight:700; color:var(--m-ink); line-height:1.15; }
.ds6 .cr-step .r { font-size:var(--m-t-cap); color:var(--m-ac-deep); }
.ds6 .cr-step .bar { position:absolute; inset-inline:10px; inset-block-end:6px; block-size:3px;
  border-radius:var(--m-r-chip); background:var(--m-sunk); overflow:hidden; }
.ds6 .cr-step .bar i { display:block; block-size:100%; inline-size:var(--m-pct,0%); background:var(--m-ac); border-radius:inherit; }
.ds6 .cr-step.won { background:var(--m-ok-dim); }
.ds6 .cr-step.won .v, .ds6 .cr-step.won .l { color:var(--m-ok); }
.ds6 .cr-step.won .bar i { background:var(--m-ok); }
.ds6 .cr-step.after { background:var(--m-ac-dim); }
.ds6 .cr-rates { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:var(--m-2); }
.ds6 .cr-rate { display:flex; flex-direction:column; gap:2px; padding:var(--m-2) 0; border-block-start:1px solid var(--m-line); }
.ds6 .cr-lines { display:flex; flex-direction:column; }
.ds6 .cr-line { display:grid; grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) auto auto; gap:var(--m-2);
  align-items:center; padding:var(--m-2) 0; border-block-start:1px solid var(--m-line); font-size:var(--m-t-cap); }
.ds6 .cr-line .p { color:var(--m-mut); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ds6 .cr-bd { display:flex; flex-direction:column; gap:var(--m-4); }
.ds6 .cr-tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:var(--m-4); }
.ds6 .cr-t { display:flex; flex-direction:column; gap:var(--m-1); min-inline-size:0; }
.ds6 .cr-t .en { font-weight:400; direction:ltr; unicode-bidi:isolate; color:var(--m-faint); }
.ds6 .kp { display:flex; flex-direction:column; gap:var(--m-4); }
.ds6 .kp-tbl { min-inline-size:760px; }
.ds6 .kp-tbl caption { position:absolute; inline-size:1px; block-size:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
@media (max-width: 560px) { .ds6 .cr-line { grid-template-columns:minmax(0,1fr) auto; } .ds6 .cr-line .p { grid-column:1 / -1; grid-row:2; } }
`;

export const CAMPAIGN_RESULTS_CRM_JS = `
/* ================= «سلسلة التحويل» and «مؤشرات الأداء» ================= */
var crRes = {};                      /* campaignId -> { data, failed, loading } */
var kpData = null, kpFailed = false, kpLoading = false;
/* Results are refetched after a minute on screen: the top of the chain refreshes with the campaign every few
   seconds, and the half below it must not sit frozen at the moment the tab was opened. */
var CR_FRESH_MS = 60000;

/* Every digit goes through .m-n, and a percent sign that belongs to a number goes INSIDE the span or
   bidi lands it on the wrong side (PORT-SPEC 3). */
function crN(v) { return '<span class="m-n">' + fmtN(v) + "</span>"; }
/* kind: owed · unset · none. A rate with no denominator is not zero and not a dash — it is a named
   absence saying WHICH of the three it is. */
function crNil(t, kind) { return '<span class="m-td-nil m-nil--' + (kind || "none") + '">' + esc(t) + "</span>"; }
function crPct(v) { return v === null || v === undefined ? crNil("لا أساس للنسبة", "none") : '<span class="m-n">' + fmtN(v) + "٪</span>"; }
function crMoney(v) { return typeof opMoney === "function" ? opMoney(v) : fmtN(Math.round(Number(v) || 0)) + " ر.س"; }
function crMoneyN(v) { return '<span class="m-n">' + crMoney(v) + "</span>"; }
function crLoad(id, force) {
  var w = crRes[id];
  if (w && (w.loading || (!force && ((w.data && Date.now() - w.at < CR_FRESH_MS) || w.failed)))) return;
  crRes[id] = { data: w ? w.data : null, at: w ? w.at : 0, failed: false, loading: true };
  if (force) setTimeout(function () { render(false); }, 0);
  pxGet("/admin/campaigns/" + id + "/results").then(function (j) { crRes[id] = { data: j, at: Date.now(), failed: false, loading: false }; })
    .catch(function () { crRes[id] = { data: w ? w.data : null, at: w ? w.at : 0, failed: true, loading: false }; })
    .then(function () { render(false); });
}
/* A step's rate is against the step before it, so each number says how much of the previous one carried on. */
function crStep(label, n, prev, cls, base) {
  /* Over nothing, or over a smaller count from another population, there is no rate to print. */
  var r = prev > 0 && n <= prev ? Math.round((n / prev) * 100) : null;
  return '<div class="cr-step' + (cls ? " " + cls : "") + '"><span class="l" title="' + esc(label) + '">' + esc(label) + '</span><span class="v">' + crN(n) + "</span>" +
    '<span class="r"' + (prev === undefined || r === null ? "" : ' title="' + fmtN(r) + "٪ من " + esc(base || "") + '"') + ">" +
    (prev === undefined ? "&nbsp;" : r === null ? crNil("لا أساس", "none") : '<span class="m-n">' + fmtN(r) + "٪</span>") + "</span>" +
    '<span class="bar" aria-hidden="true"><i style="--m-pct:' + (prev === undefined ? 100 : r === null ? 0 : r) + '%"></i></span></div>';
}
function crRate(label, v, def) {
  return '<div class="cr-rate"><span class="m-stat__k">' + esc(label) + '</span><span class="m-item__v">' + v + '</span><span class="m-meta">' + def + "</span></div>";
}
function crChainCard(camp, st) {
  if (!camp || camp.test) return "";
  crLoad(camp.id, false);
  var w = crRes[camp.id] || {};
  /* No .ds6 wrapper here: this card is emitted INSIDE the campaign record, which is already wrapped.
     Nesting the wrapper would paint the page ground inside a card. */
  var h = '<section class="m-card" aria-labelledby="crh"><header class="m-card__h"><div>' +
    '<h2 class="m-card__t" id="crh">سلسلة التحويل</h2>' +
    '<p class="m-meta">من الإرسال حتى البيع: ما حدث بعد «مهتم». تُنسب الفرصة إلى الحملة إن ذكرتها، أو إن فُتحت عبر واتساب لرقم استهدفته الحملة للمنتج نفسه خلال ' +
    crN(ATTRIBUTION_DAYS) + " يومًا من إطلاقها. النسبة تحت كل خطوة محسوبة على الخطوة التي تُقاس عليها: القراءة والردود على المُرسل، والاهتمام على الردود، والعروض والمبيعات على الفرص.</p></div></header><div class=\\"cr-bd\\">";
  if (!w.data) {
    return h + '<p class="m-body"' + (w.failed
      ? ' role="alert">تعذّر تحميل ما بعد الاهتمام. <button class="m-btn" onclick="crLoad(' + camp.id + ', true)">أعد المحاولة</button>'
      : ' role="status" aria-busy="true">جارٍ حساب السلسلة…') + "</p></div></section>";
  }
  var r = w.data.results;
  h += '<div class="cr-chain">' +
    crStep("أُرسلت", st.sent, undefined) + crStep("شوهدت", st.seen, st.sent, "", "المُرسل") + crStep("ردّوا", st.replied, st.sent, "", "المُرسل") + crStep("مهتمون", st.interested, st.replied, "", "الردود") +
    crStep("مؤهلون", r.qualified, st.interested, "after", "المهتمين") + crStep("فرص بيع", r.opportunities, r.qualified, "after", "المؤهلين") + crStep("اجتماعات", r.meetings, r.opportunities, "after", "الفرص") +
    crStep("عروض مُرسلة", r.quotes, r.opportunities, "after", "الفرص") + crStep("مبيعات", r.won, r.opportunities, "won", "الفرص") + "</div>";
  var rates = funnelRates({ sent: st.sent, read: st.seen, replied: st.replied, interested: st.interested, qualified: r.qualified, opportunities: r.opportunities, wonLines: r.wonLines, closedLines: r.closedLines });
  h += '<div class="cr-rates">' +
    crRate("نسبة القراءة", crPct(rates.readRate), "شوهدت ÷ أُرسلت") +
    crRate("نسبة الردود", crPct(rates.replyRate), "ردّوا ÷ أُرسلت") +
    crRate("نسبة الاهتمام", crPct(rates.interestRate), "مهتمون ÷ أُرسلت") +
    crRate("نسبة التأهيل", crPct(rates.qualificationRate), "مؤهلون ÷ مهتمون") +
    crRate("التحويل إلى فرص", crPct(rates.opportunityConversion), "فرص ÷ مؤهلون") +
    crRate("نسبة الفوز", crPct(rates.winRate), "بنود رابحة ÷ بنود مغلقة") +
    crRate("إيراد الحملة", r.revenue || r.wonLines ? crMoneyN(r.revenue) : crNil("لا بنود رابحة", "none"), "قيمة البنود الرابحة المنسوبة" + (r.openValue ? " · مفتوح: " + crMoneyN(r.openValue) : "")) + "</div>";
  if (st.interested < r.qualified) h += '<p class="m-meta">«مؤهلون» أكثر من «مهتمون»، فلا نسبة تأهيل: بعض العملاء بلغوا نية مرتفعة أو فُتحت لهم فرصة دون أن يُسجَّل «مهتم» على ردّهم للحملة.</p>';
  if (w.data.lines.length) {
    h += '<div><h3 class="m-label">البنود المنسوبة إلى هذه الحملة</h3><div class="cr-lines">' +
      w.data.lines.slice(0, 30).map(function (l) {
        var label = typeof opStage === "function" ? opStage(l.stage).label : l.stage;
        return '<div class="cr-line"><a class="m-link" href="#opps/' + l.id + '">' + esc(l.account) + '</a><span class="p">' + esc(l.product) + "</span>" +
          '<span class="m-chip m-chip--plain">' + esc(label) + '</span><span class="m-td-v">' + (l.value ? crMoneyN(l.value) : crNil("لم يُسعَّر", "owed")) + "</span></div>";
      }).join("") + "</div>" +
      (w.data.lines.length > 30 ? '<p class="m-meta">يُعرض ' + crN(30) + " من " + crN(w.data.lines.length) + ".</p>" : "") + "</div>";
  } else {
    h += '<p class="m-meta">لا فرص بيع منسوبة إلى هذه الحملة بعد. تُفتح تلقائيًا عند النية المرتفعة، أو يدويًا من «فرص البيع» مع اختيار الحملة مصدرًا.</p>';
  }
  return h + "</div></section>";
}

/* ---------------- «مؤشرات الأداء» ---------------- */
function kpLoad(force) {
  if (kpLoading || (kpData && !force && Date.now() - kpData.at < CR_FRESH_MS) || (kpFailed && !force)) return;
  kpLoading = true; kpFailed = false;
  if (force) setTimeout(function () { render(false); }, 0);
  pxGet("/admin/kpis").then(function (j) { j.at = Date.now(); kpData = j; kpFailed = false; }).catch(function () { kpFailed = true; })
    .then(function () { kpLoading = false; render(false); });
}
function kpTile(label, en, value, counts, def) {
  return '<div class="cr-t"><span class="m-stat__k">' + esc(label) + ' <span class="en">' + esc(en) + '</span></span>' +
    '<span class="m-stat__v">' + value + "</span>" +
    (counts ? '<span class="m-cap">' + counts + "</span>" : "") + '<span class="m-meta">' + def + "</span></div>";
}
function kpDuration(sec) {
  if (sec === null || sec === undefined) return crNil("لم تُقَس", "unset");
  if (sec < 60) return '<span class="m-n">' + fmtN(sec) + "</span> ث";
  var m = Math.round(sec / 60);
  return m < 60 ? '<span class="m-n">' + fmtN(m) + "</span> د"
                : '<span class="m-n">' + fmtN(Math.round((m / 60) * 10) / 10) + "</span> س";
}
function vReportsKpis() {
  kpLoad(false);
  if (!kpData) {
    return '<div class="ds6"><section class="m-card"><p class="m-body"' + (kpFailed
      ? ' role="alert">تعذّر تحميل المؤشرات. <button class="m-btn" onclick="kpFailed=false;kpLoad(true)">أعد المحاولة</button>'
      : ' role="status" aria-busy="true">جارٍ حساب المؤشرات…') + "</p></section></div>";
  }
  var d = kpData, t = d.totals;
  /* The top of the funnel, summed from the SAME per-campaign reading the campaign screens print. */
  var byId = {}; (campaigns || []).forEach(function (c) { byId[c.id] = c; });
  var top = { targeted: 0, sent: 0, seen: 0, replied: 0, interested: 0 };
  var rows = d.campaigns.map(function (c) {
    var camp = byId[c.id];
    var st = camp && camp.targets ? campStats(camp) : { targeted: c.targeted, sent: 0, seen: 0, replied: 0, interested: 0 };
    top.targeted += st.targeted; top.sent += st.sent; top.seen += st.seen; top.replied += st.replied; top.interested += st.interested;
    return { c: c, st: st };
  });
  var rates = funnelRates({ sent: top.sent, read: top.seen, replied: top.replied, interested: top.interested, qualified: t.qualified, opportunities: t.opportunities, wonLines: t.wonLines, closedLines: t.closedLines });
  var ratio = function (n, dd) { return crN(n) + " من " + crN(dd); };
  var grp = function (id, title, body) {
    return '<section class="m-card" aria-labelledby="' + id + '"><header class="m-card__h">' +
      '<h2 class="m-card__t" id="' + id + '">' + title + "</h2></header>" + body + "</section>";
  };
  var h = '<div class="ds6"><div class="kp">';
  h += grp("kph1", "الحملات", '<div class="cr-tiles">' +
    kpTile("نسبة القراءة", "Read Rate", crPct(rates.readRate), ratio(top.seen, top.sent), "المقروء ÷ المرسل") +
    kpTile("نسبة الردود", "Reply Rate", crPct(rates.replyRate), ratio(top.replied, top.sent), "الردود ÷ المرسل") +
    kpTile("نسبة الاهتمام", "Interest Rate", crPct(rates.interestRate), ratio(top.interested, top.sent), "المهتمون ÷ المرسل") + "</div>");
  h += grp("kph2", "التأهيل والفرص والمبيعات", '<div class="cr-tiles">' +
    kpTile("نسبة التأهيل", "Qualification Rate", crPct(rates.qualificationRate), ratio(t.qualified, top.interested), "المؤهلون ÷ المهتمين — المؤهل: قراءة نية مرتفعة منسوبة للحملة، أو فرصة بيع منسوبة لها") +
    kpTile("التحويل إلى فرص", "Opportunity Conversion", crPct(rates.opportunityConversion), ratio(t.opportunities, t.qualified), "الفرص الناتجة ÷ المؤهلين") +
    kpTile("نسبة الفوز", "Win Rate", crPct(rates.winRate), ratio(t.wonLines, t.closedLines), "الفرص الفائزة ÷ الفرص المغلقة (المنسوبة إلى حملات)") +
    kpTile("إيراد الحملات", "Campaign Revenue", t.revenue || t.wonLines ? crMoneyN(t.revenue) : crNil("لا مبيعات منسوبة", "none"), t.openValue ? "مفتوح: " + crMoneyN(t.openValue) : "", "قيمة المبيعات المنسوبة للحملات خلال " + crN(d.attributionDays) + " يومًا من الإطلاق") + "</div>");
  h += grp("kph3", "المؤشرات والتوصيات والمنتج", '<div class="cr-tiles">' +
    kpTile("عائد المؤشرات", "Indicator Opportunity Yield", crN(d.indicatorYield.opportunities), "فرص الاستهداف المقترحة الآن: " + crN(d.indicatorYield.suggestionsNow) + " · حملات من مؤشرات: " + crN(d.indicatorYield.campaigns),
      "فرص البيع المنسوبة لحملات بُنيت على مؤشرات الاستخدام") +
    kpTile("تبنّي التوصيات", "Recommendation Adoption", crPct(d.adoption.pct), ratio(d.adoption.launched, d.adoption.launched + d.adoption.dismissed) + (d.adoption.open ? " · مفتوحة الآن: " + crN(d.adoption.open) : ""), "التوصيات التي أُطلقت منها حملة ÷ التوصيات التي حُسم أمرها (أُطلقت أو تُجوهلت). لا يُسجَّل عرض التوصية، فلا تدخل المفتوحة في النسبة") +
    /* The ratio covers only the products that have a target; the caption says how many
       that is and how much revenue sits outside it, because a percentage over part of the
       catalogue reads as the whole one. DO NOT tidy this caption away. */
    kpTile("تحقيق المستهدف", "Target Achievement",
      (d.target && d.target.target) ? crPct(d.target.pct) : crNil("بلا مستهدف مسجّل", "owed"),
      d.target
        ? ((d.target.target
            ? crMoneyN(d.target.achieved) + " من " + crMoneyN(d.target.target)
            : "لا مستهدف مسجّل") +
           " · الربع " + crN(d.target.quarter) + " من " + '<span class="m-n">' + String(d.target.year) + "</span>" +
           (d.target.targetedCount != null && d.target.productCount != null &&
            d.target.targetedCount < d.target.productCount
             ? " · على " + crN(d.target.targetedCount) + " من " + crN(d.target.productCount) + " منتجًا" +
               (d.target.untargetedAchieved
                 ? "، و" + crMoneyN(d.target.untargetedAchieved) + " خارج النسبة" : "")
             : ""))
        : "",
      "المحقق ÷ المستهدف للربع الحالي، على المنتجات التي لها مستهدف مسجّل وحدها") + "</div>");
  var ho = d.assistant.handoff;
  h += grp("kph4", "المساعد الذكي", '<div class="cr-tiles">' +
    kpTile("الثقة في الإجابات", "Answer Confidence", crPct(d.assistant.answerConfidence ? d.assistant.answerConfidence.pct : null),
      d.assistant.answerConfidence ? ratio(d.assistant.answerConfidence.high + d.assistant.answerConfidence.medium, d.assistant.answerConfidence.high + d.assistant.answerConfidence.medium + d.assistant.answerConfidence.low) + " · حُوّل لموظف: " + crN(d.assistant.answerConfidence.handoffs) : "",
      "الإجابات التي قدّر المساعد ثقته فيها مرتفعة أو متوسطة ÷ الإجابات المسجّلة — تقدير المساعد نفسه، آخر 30 يومًا. المنخفضة تُحوَّل لموظف تلقائيًا") +
    kpTile("دقة الإجابات", "Answer Accuracy", crPct(d.assistant.answerAccuracy ? d.assistant.answerAccuracy.pct : null),
      d.assistant.answerAccuracy ? ratio(d.assistant.answerAccuracy.correct, d.assistant.answerAccuracy.correct + d.assistant.answerAccuracy.wrong) : "",
      "الردود التي حكم عليها مراجع بأنها صحيحة ÷ الردود التي راجعها — من «دقة الرد» في نافذة المحادثة، آخر 30 يومًا") +
    kpTile("التحويل لبشر", "Human Handoff Rate", crPct(ho.pct), ratio(ho.handedOff, ho.conversations), "المحادثات المحوّلة الآن لموظف ÷ المحادثات التي كتب فيها العميل — حالة اليوم، لا سجل التحويلات") +
    kpTile("زمن الرد", "Median reply time", kpDuration(d.assistant.medianReplySeconds), "آخر 30 يومًا", "الوسيط بين رسالة العميل وأول رسالة من مسار بعدها (خلال 15 دقيقة)") +
    kpTile("جاهزية المعرفة", "Knowledge readiness", d.assistant.knowledgeScore && d.assistant.knowledgeScore.avg !== null ? '<span class="m-n">' + fmtN(d.assistant.knowledgeScore.avg) + "٪</span>" : crNil("لم تُقَس", "unset"),
      "يبيعها المساعد: " + crN(d.assistant.productsReady.eligible) + " من " + crN(d.assistant.productsReady.total) + (d.assistant.knowledgeScore ? " · فوق حد الجاهزية: " + crN(d.assistant.knowledgeScore.ready) : ""),
      "متوسط درجة المعرفة بأقسامها الثمانية الموزونة للمنتجات التي يبيعها المساعد") + "</div>");
  h += grp("kph5", "الحملات واحدة واحدة",
    '<div class="m-tablewrap" tabindex="0" role="region" aria-labelledby="kph5"><table class="m-table kp-tbl"><caption>نتائج كل حملة فعلية</caption><thead><tr>' +
    '<th scope="col">الحملة</th><th scope="col">المستهدفون</th><th scope="col">أُرسلت</th><th scope="col">ردّوا</th><th scope="col">مهتمون</th><th scope="col">مؤهلون</th><th scope="col">فرص</th><th scope="col">مبيعات</th><th scope="col">الإيراد</th></tr></thead><tbody>' +
    (rows.length ? rows.map(function (x) {
      var r = x.c.results;
      return '<tr><td class="m-td-n"><a class="m-link" href="#kmon/' + x.c.id + '">' + esc(clip(x.c.name, 40)) + '</a></td><td class="m-td-v">' + crN(x.st.targeted) +
        '</td><td class="m-td-v">' + crN(x.st.sent) + '</td><td class="m-td-v">' + crN(x.st.replied) +
        '</td><td class="m-td-v">' + crN(x.st.interested) + '</td><td class="m-td-v">' + crN(r.qualified) +
        '</td><td class="m-td-v">' + crN(r.opportunities) + '</td><td class="m-td-v">' + crN(r.won) +
        '</td><td class="m-td-v">' + (r.revenue || r.wonLines ? crMoneyN(r.revenue) : crNil("لا مبيعات", "none")) + "</td></tr>";
    }).join("") : '<tr class="m-table__empty"><td colspan="9"><div class="m-empty"><p class="m-empty__t">لا حملات فعلية بعد</p>' +
      '<p class="m-empty__d">تظهر هنا كل حملة فعلية بنتائجها فور إطلاقها.</p></div></td></tr>') + "</tbody></table></div>");
  return h + "</div></div>";
}
/* ================= end «سلسلة التحويل» and «مؤشرات الأداء» ================= */
`;
