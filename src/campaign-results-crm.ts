// campaign-results-crm.ts — «سلسلة التحويل» on a campaign's «الأداء» tab and «مؤشرات الأداء» under التقارير
// (client A, BRD v1.0: BR-MON-004/005/006, §23 KPIs, slice S4).
//
// ONE NUMBER, ONE SOURCE. The top of the chain (أُرسلت · شوهدت · ردّوا · مهتمون) comes from campStats, the
// same contact-ledger reading the campaign's six cards and the campaigns list already print. The rest
// (مؤهلون · فرص · اجتماعات · عروض · مبيعات) comes from /admin/campaigns/:id/results and /admin/kpis, which
// attribute opportunity lines to campaigns (campaign-results-domain). Rates are funnelRates, the BRD's own
// definitions, and a rate over nothing is «—».
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const CAMPAIGN_RESULTS_CRM_CSS = `
.cr-card { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg); margin-top:var(--s3); overflow:hidden; }
.cr-card .hd { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; padding:var(--s3) var(--s4); border-bottom:1px solid var(--line-soft); }
.cr-card .hd h2 { margin:0; font-size:var(--t-md); font-weight:600; color:var(--ink); }
.cr-card .hd .s { font-size:var(--t-xs); color:var(--muted); line-height:1.6; flex-basis:100%; }
.cr-card .bd { padding:var(--s3) var(--s4); display:flex; flex-direction:column; gap:var(--s3); }
.cr-chain { display:grid; grid-template-columns:repeat(auto-fit, minmax(96px, 1fr)); gap:6px; }
.cr-step { position:relative; display:flex; flex-direction:column; gap:2px; padding:10px 10px 12px; border-radius:var(--r-md); background:var(--surface); min-width:0; }
.cr-step .l { font-size:var(--t-xs); color:var(--muted); font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.cr-step .v { font-size:var(--t-xl); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; line-height:1.1; }
.cr-step .r { font-size:var(--t-xs); color:var(--accent-deep); font-variant-numeric:tabular-nums; }
.cr-step .r.none { color:var(--muted); }
.cr-step .bar { position:absolute; inset-inline:10px; bottom:6px; height:3px; border-radius:var(--r-pill); background:var(--surface-2); overflow:hidden; }
.cr-step .bar i { display:block; height:100%; background:var(--accent); border-radius:inherit; }
.cr-step.won { background:var(--s-issued-soft); }
.cr-step.won .v, .cr-step.won .l { color:var(--s-issued-text); }
.cr-step.won .bar i { background:var(--s-issued); }
.cr-step.after { background:var(--accent-wash); }
.cr-rates { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:var(--s2); }
.cr-rate { display:flex; flex-direction:column; gap:2px; padding:8px 0; border-top:1px solid var(--line-soft); }
.cr-rate .k { font-size:var(--t-xs); color:var(--muted); }
.cr-rate .v { font-size:var(--t-lg); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; }
.cr-rate .d { font-size:var(--t-xs); color:var(--muted); line-height:1.5; }
.cr-lines { display:flex; flex-direction:column; }
.cr-line { display:grid; grid-template-columns:minmax(0,1.4fr) minmax(0,1fr) auto auto; gap:var(--s2); align-items:center; padding:8px 0; border-top:1px solid var(--line-soft); font-size:var(--t-sm); color:var(--ink); }
.cr-line a { color:var(--ink); text-decoration:none; font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cr-line a:hover { color:var(--accent-deep); text-decoration:underline; text-underline-offset:3px; }
.cr-line .p { color:var(--muted); font-size:var(--t-xs); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.cr-line .v { font-variant-numeric:tabular-nums; white-space:nowrap; }
.cr-stage { font-size:var(--t-xs); font-weight:600; border-radius:var(--r-pill); padding:2px 9px; background:var(--tn-soft, var(--surface-2)); color:var(--tn-text, var(--muted)); white-space:nowrap; }
.cr-note { font-size:var(--t-xs); color:var(--muted); line-height:1.7; }
.cr-state { font-size:var(--t-sm); color:var(--muted); display:flex; gap:var(--s2); align-items:center; flex-wrap:wrap; }
/* «مؤشرات الأداء» */
.kp { display:flex; flex-direction:column; gap:var(--s3); }
.kp-grp { background:var(--paper); border:1px solid var(--line); border-radius:var(--r-lg); overflow:hidden; }
.kp-grp > .hd { margin:0; padding:var(--s3) var(--s4); border-bottom:1px solid var(--line-soft); font-size:var(--t-md); font-weight:600; color:var(--ink); }
.kp-tbl caption { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; }
.kp-tbl:focus-visible { outline:2px solid var(--accent); outline-offset:-2px; }
.kp-tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); }
.kp-t { display:flex; flex-direction:column; gap:4px; padding:var(--s3) var(--s4); border-inline-start:1px solid var(--line-soft); border-top:1px solid var(--line-soft); margin-top:-1px; margin-inline-start:-1px; }
.kp-t .k { font-size:var(--t-xs); font-weight:600; color:var(--muted); display:flex; gap:6px; align-items:baseline; flex-wrap:wrap; }
.kp-t .k .en { font-weight:400; direction:ltr; unicode-bidi:isolate; }
.kp-t .v { font-size:var(--t-xl); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; line-height:1.15; }
.kp-t .v.none { color:var(--muted); }
.kp-t .n { font-size:var(--t-xs); color:var(--ink-2, #33373E); font-variant-numeric:tabular-nums; }
.kp-t .d { font-size:var(--t-xs); color:var(--muted); line-height:1.6; }
.kp-tbl { overflow-x:auto; }
.kp-tbl table { width:100%; border-collapse:collapse; font-size:var(--t-sm); min-width:760px; }
.kp-tbl th { text-align:start; font-size:var(--t-xs); font-weight:600; color:var(--muted); background:var(--surface); padding:8px var(--s3); white-space:nowrap; }
.kp-tbl td { padding:8px var(--s3); border-top:1px solid var(--line-soft); color:var(--ink); font-variant-numeric:tabular-nums; white-space:nowrap; }
.kp-tbl td a { color:var(--ink); text-decoration:none; font-weight:500; }
.kp-tbl td a:hover { color:var(--accent-deep); text-decoration:underline; text-underline-offset:3px; }
.kp .cr-card a:focus-visible, .kp-tbl a:focus-visible, .cr-line a:focus-visible { outline:2px solid var(--accent); outline-offset:2px; border-radius:var(--r-sm); }
@media (max-width: 560px) { .cr-line { grid-template-columns:minmax(0,1fr) auto; } .cr-line .p { grid-column:1 / -1; grid-row:2; } }
`;

export const CAMPAIGN_RESULTS_CRM_JS = `
/* ================= «سلسلة التحويل» and «مؤشرات الأداء» ================= */
var crRes = {};                      /* campaignId -> { data, failed, loading } */
var kpData = null, kpFailed = false, kpLoading = false;
/* Results are refetched after a minute on screen: the top of the chain refreshes with the campaign every few
   seconds, and the half below it must not sit frozen at the moment the tab was opened. */
var CR_FRESH_MS = 60000;

function crPct(v) { return v === null || v === undefined ? "—" : fmtN(v) + "٪"; }
function crMoney(v) { return typeof opMoney === "function" ? opMoney(v) : fmtN(Math.round(Number(v) || 0)) + " ر.س"; }
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
  return '<div class="cr-step' + (cls ? " " + cls : "") + '"><span class="l" title="' + esc(label) + '">' + esc(label) + '</span><span class="v">' + fmtN(n) + "</span>" +
    '<span class="r' + (r === null ? " none" : "") + '"' + (prev === undefined || r === null ? "" : ' title="' + fmtN(r) + "٪ من " + esc(base || "") + '"') + ">" + (prev === undefined ? "&nbsp;" : r === null ? "—" : fmtN(r) + "٪") + "</span>" +
    '<span class="bar" aria-hidden="true"><i style="width:' + (prev === undefined ? 100 : r === null ? 0 : r) + '%"></i></span></div>';
}
function crRate(label, v, def) {
  return '<div class="cr-rate"><span class="k">' + esc(label) + '</span><span class="v">' + v + '</span><span class="d">' + def + "</span></div>";
}
function crChainCard(camp, st) {
  if (!camp || camp.test) return "";
  crLoad(camp.id, false);
  var w = crRes[camp.id] || {};
  var h = '<section class="cr-card" aria-labelledby="crh"><div class="hd"><h2 id="crh">سلسلة التحويل</h2>' +
    '<span class="s">من الإرسال حتى البيع: ما حدث بعد «مهتم». تُنسب الفرصة إلى الحملة إن ذكرتها، أو إن فُتحت عبر واتساب لرقم استهدفته الحملة للمنتج نفسه خلال ' +
    fmtN(ATTRIBUTION_DAYS) + " يومًا من إطلاقها. النسبة تحت كل خطوة محسوبة على الخطوة التي تُقاس عليها: القراءة والردود على المُرسل، والاهتمام على الردود، والعروض والمبيعات على الفرص.</span></div><div class=\\"bd\\">";
  if (!w.data) {
    return h + '<div class="cr-state"' + (w.failed ? ' role="alert">تعذّر تحميل ما بعد الاهتمام.<button class="btn btn-ghost" onclick="crLoad(' + camp.id + ', true)">أعد المحاولة</button>' : ' role="status">جارٍ حساب السلسلة…') + "</div></div></section>";
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
    crRate("إيراد الحملة", r.revenue || r.wonLines ? crMoney(r.revenue) : "—", "قيمة البنود الرابحة المنسوبة" + (r.openValue ? " · مفتوح: " + crMoney(r.openValue) : "")) + "</div>";
  if (st.interested < r.qualified) h += '<div class="cr-note">«مؤهلون» أكثر من «مهتمون»، فلا نسبة تأهيل: بعض العملاء بلغوا نية مرتفعة أو فُتحت لهم فرصة دون أن يُسجَّل «مهتم» على ردّهم للحملة.</div>';
  if (w.data.lines.length) {
    h += '<div><div class="cr-note" style="font-weight:600;color:var(--ink);margin-bottom:2px">البنود المنسوبة إلى هذه الحملة</div><div class="cr-lines">' +
      w.data.lines.slice(0, 30).map(function (l) {
        var label = typeof opStage === "function" ? opStage(l.stage).label : l.stage;
        var tone = typeof opToneVars === "function" ? ' style="' + opToneVars(l.stage) + '"' : "";
        return '<div class="cr-line"><a href="#opps/' + l.id + '">' + esc(l.account) + '</a><span class="p">' + esc(l.product) + "</span>" +
          '<span class="cr-stage"' + tone + ">" + esc(label) + '</span><span class="v">' + (l.value ? crMoney(l.value) : "—") + "</span></div>";
      }).join("") + "</div>" + (w.data.lines.length > 30 ? '<div class="cr-note">يُعرض 30 من ' + fmtN(w.data.lines.length) + ".</div>" : "") + "</div>";
  } else {
    h += '<div class="cr-note">لا فرص بيع منسوبة إلى هذه الحملة بعد. تُفتح تلقائيًا عند النية المرتفعة، أو يدويًا من «فرص البيع» مع اختيار الحملة مصدرًا.</div>';
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
  var none = value === "—";
  return '<div class="kp-t"><span class="k">' + esc(label) + ' <span class="en">' + esc(en) + '</span></span><span class="v' + (none ? " none" : "") + '">' + value + "</span>" +
    (counts ? '<span class="n">' + counts + "</span>" : "") + '<span class="d">' + def + "</span></div>";
}
function kpDuration(sec) {
  if (sec === null || sec === undefined) return "—";
  if (sec < 60) return fmtN(sec) + " ث";
  var m = Math.round(sec / 60);
  return m < 60 ? fmtN(m) + " د" : fmtN(Math.round((m / 60) * 10) / 10) + " س";
}
function vReportsKpis() {
  kpLoad(false);
  if (!kpData) {
    return '<div class="kp"><section class="kp-grp"><div class="cf-state"' + (kpFailed ? ' role="alert">تعذّر تحميل المؤشرات.<button class="btn btn-ghost" onclick="kpFailed=false;kpLoad(true)">أعد المحاولة</button>' : ' role="status">جارٍ حساب المؤشرات…') + "</div></section></div>";
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
  var ratio = function (n, dd) { return fmtN(n) + " من " + fmtN(dd); };
  var h = '<div class="kp">';
  h += '<section class="kp-grp" aria-labelledby="kph1"><h2 class="hd" id="kph1">الحملات</h2><div class="kp-tiles">' +
    kpTile("نسبة القراءة", "Read Rate", crPct(rates.readRate), ratio(top.seen, top.sent), "المقروء ÷ المرسل") +
    kpTile("نسبة الردود", "Reply Rate", crPct(rates.replyRate), ratio(top.replied, top.sent), "الردود ÷ المرسل") +
    kpTile("نسبة الاهتمام", "Interest Rate", crPct(rates.interestRate), ratio(top.interested, top.sent), "المهتمون ÷ المرسل") + "</div></section>";
  h += '<section class="kp-grp" aria-labelledby="kph2"><h2 class="hd" id="kph2">التأهيل والفرص والمبيعات</h2><div class="kp-tiles">' +
    kpTile("نسبة التأهيل", "Qualification Rate", crPct(rates.qualificationRate), ratio(t.qualified, top.interested), "المؤهلون ÷ المهتمين — المؤهل: قراءة نية مرتفعة منسوبة للحملة، أو فرصة بيع منسوبة لها") +
    kpTile("التحويل إلى فرص", "Opportunity Conversion", crPct(rates.opportunityConversion), ratio(t.opportunities, t.qualified), "الفرص الناتجة ÷ المؤهلين") +
    kpTile("نسبة الفوز", "Win Rate", crPct(rates.winRate), ratio(t.wonLines, t.closedLines), "الفرص الفائزة ÷ الفرص المغلقة (المنسوبة إلى حملات)") +
    kpTile("إيراد الحملات", "Campaign Revenue", t.revenue || t.wonLines ? crMoney(t.revenue) : "—", t.openValue ? "مفتوح: " + crMoney(t.openValue) : "", "قيمة المبيعات المنسوبة للحملات خلال " + fmtN(d.attributionDays) + " يومًا من الإطلاق") + "</div></section>";
  h += '<section class="kp-grp" aria-labelledby="kph3"><h2 class="hd" id="kph3">المؤشرات والتوصيات والمنتج</h2><div class="kp-tiles">' +
    kpTile("عائد المؤشرات", "Indicator Opportunity Yield", fmtN(d.indicatorYield.opportunities), "فرص الاستهداف المقترحة الآن: " + fmtN(d.indicatorYield.suggestionsNow) + " · حملات من مؤشرات: " + fmtN(d.indicatorYield.campaigns),
      "فرص البيع المنسوبة لحملات بُنيت على مؤشرات الاستخدام") +
    kpTile("تبنّي التوصيات", "Recommendation Adoption", crPct(d.adoption.pct), ratio(d.adoption.launched, d.adoption.launched + d.adoption.dismissed) + (d.adoption.open ? " · مفتوحة الآن: " + fmtN(d.adoption.open) : ""), "التوصيات التي أُطلقت منها حملة ÷ التوصيات التي حُسم أمرها (أُطلقت أو تُجوهلت). لا يُسجَّل عرض التوصية، فلا تدخل المفتوحة في النسبة") +
    kpTile("تحقيق المستهدف", "Target Achievement", d.target ? crPct(d.target.pct) : "—",
      d.target ? crMoney(d.target.achieved) + " من " + (d.target.target ? crMoney(d.target.target) : "لا مستهدف") + " · الربع " + d.target.quarter + " من " + d.target.year : "", "المحقق ÷ المستهدف للربع الحالي") + "</div></section>";
  var ho = d.assistant.handoff;
  h += '<section class="kp-grp" aria-labelledby="kph4"><h2 class="hd" id="kph4">المساعد الذكي</h2><div class="kp-tiles">' +
    kpTile("الثقة في الإجابات", "Answer Confidence", "—", "", "غير مُقاس: المساعد لا يُصدر درجة ثقة لإجاباته بعد، ولن يعرض مسار رقمًا لم يُقَس") +
    kpTile("التحويل لبشر", "Human Handoff Rate", crPct(ho.pct), ratio(ho.handedOff, ho.conversations), "المحادثات المحوّلة الآن لموظف ÷ المحادثات التي كتب فيها العميل — حالة اليوم، لا سجل التحويلات") +
    kpTile("زمن الرد", "Median reply time", kpDuration(d.assistant.medianReplySeconds), "آخر 30 يومًا", "الوسيط بين رسالة العميل وأول رسالة من مسار بعدها (خلال 15 دقيقة)") +
    kpTile("جاهزية المعرفة", "Knowledge readiness", fmtN(d.assistant.productsReady.eligible) + " من " + fmtN(d.assistant.productsReady.total), "", "منتجات يستطيع المساعد بيعها الآن: معرفة معتمدة، ملف، سعر، وقفل منتج") + "</div></section>";
  h += '<section class="kp-grp" aria-labelledby="kph5"><h2 class="hd" id="kph5">الحملات واحدة واحدة</h2><div class="kp-tbl" tabindex="0" role="region" aria-labelledby="kph5"><table><caption>نتائج كل حملة فعلية</caption><thead><tr>' +
    '<th scope="col">الحملة</th><th scope="col">المستهدفون</th><th scope="col">أُرسلت</th><th scope="col">ردّوا</th><th scope="col">مهتمون</th><th scope="col">مؤهلون</th><th scope="col">فرص</th><th scope="col">مبيعات</th><th scope="col">الإيراد</th></tr></thead><tbody>' +
    (rows.length ? rows.map(function (x) {
      var r = x.c.results;
      return '<tr><td><a href="#kmon/' + x.c.id + '">' + esc(clip(x.c.name, 40)) + "</a></td><td>" + fmtN(x.st.targeted) + "</td><td>" + fmtN(x.st.sent) + "</td><td>" + fmtN(x.st.replied) +
        "</td><td>" + fmtN(x.st.interested) + "</td><td>" + fmtN(r.qualified) + "</td><td>" + fmtN(r.opportunities) + "</td><td>" + fmtN(r.won) + "</td><td>" + (r.revenue || r.wonLines ? crMoney(r.revenue) : "—") + "</td></tr>";
    }).join("") : '<tr><td colspan="9">لا حملات فعلية بعد.</td></tr>') + "</tbody></table></div></section>";
  return h + "</div>";
}
/* ================= end «سلسلة التحويل» and «مؤشرات الأداء» ================= */
`;
