// home-crm.ts — «الرئيسية» as the founder's prototype opens it: four figures, the health of the
// pipeline, and the partners' week. The bands below this one (sectors, products, quarters) are the
// exec band products-crm already ships; this file adds what the prototype has and Massar did not.
//
// The prototype's four health cards are static text. Here every one of them OPENS the deals it
// counted — the BR-RPT-004 rule: a figure a reader cannot follow is a claim, and this screen is read
// by the person who has to act on it.
//
// No backticks in this file (gate: check-crm-literals).

export const HOME_CRM_CSS = `
/* ===== THE HOME DASHBOARD SHELL =====
   الرئيسية was two dashboards stacked: the executive band on top of the older campaign home, each
   with its own page title, its own section-header style and its own KPI card. Three card designs,
   three header styles, two <h1>s, 2,554px of scroll — the reader had to learn the page twice.
   One grammar now. Every band is a .hd-sec with the same header, numbered so the page has a spine,
   and the tail is two columns instead of a ribbon of full-width cards. */
/* ===== THE DECK =====
   Founder's chosen direction A. A full-bleed dark band, continuous with the rail, carrying the
   leading figure and the whole pipeline. It escapes .body's padding with negative margins rather
   than by restructuring the shell — .body owns the page gutter and nothing else may assume it.
   Values and their measured ratios: DESIGN.md §2, "The deck". */
/* The escape is --s1, because .body's gutter is 4px — NOT the 30px/32px the base stylesheet
   declares, which revamp.ts §2 overrides. Escaping by 32 made the deck 56px wider than the
   content box and gave الرئيسية a horizontal scrollbar at every width. A child cannot read its
   parent's padding, so this value is matched to the measured one and stated here rather than
   guessed from the rule that no longer applies. */
  background:linear-gradient(135deg, var(--deck-1), var(--deck-2)); color:#fff;
  position:relative; overflow:hidden; }
/* one broad accent bloom, top inline-start. Decoration that carries no data gets no more than this. */
  background:radial-gradient(900px 300px at 85% -30%, rgba(37,99,235,.55), transparent 70%); }
  padding:6px 8px; border-radius:var(--r-sm); transition:background var(--fast) var(--ease), transform 140ms var(--ease); }

/* --t-3xl is 40px; the deck's figure is the one place the page goes bigger, and DESIGN.md's ladder
   tops out at --t-num (44). clamp() keeps it from crowding the stats on a laptop. */
  letter-spacing:-3px; font-variant-numeric:tabular-nums; }
  transition:stroke-dashoffset 420ms var(--ease-out); }
  font-size:var(--t-sm); font-weight:700; color:var(--deck-lnk); font-variant-numeric:tabular-nums; }

  line-height:1; font-variant-numeric:tabular-nums; }

/* THE PIPELINE IS ONE RAIL. Four cards made the reader compare four boxes; one rail shows the
   split at a glance and each key opens exactly the deals it counted. */
  background:rgba(255,255,255,.13); box-shadow:inset 0 1px 2px rgba(0,0,0,.25); }
  color:#B9CCE6; background:none; border:0; padding:6px 8px; border-radius:var(--r-sm); cursor:pointer;
  text-align:start; transition:background var(--fast) var(--ease), transform 140ms var(--ease); }

@media (max-width: 900px) {
  .hm-deck { padding:var(--s4) var(--s3) var(--s4); }
  .hm-stats { margin-inline-start:0; gap:var(--s4); }
  .hm-arc { width:88px; height:88px; }
}

.hd { display:grid; grid-template-columns:repeat(3,minmax(0,1fr));
  gap:var(--m-3); align-items:start; }
.hd > .hd-wide { grid-column:1 / -1; }
/* Below ~1100px a third of the page is narrower than the figures a band has to hold. */
@media (max-width:1100px){ .hd { grid-template-columns:minmax(0,1fr); } }
/* The band shell is m-card now (see hdBands). What is left here is the stacking and the one
   affordance the vocabulary has no name for: the band's trailing link. The ordinal .ix and the
   .hd-sec/.hd-h rules went with the numbering they served. */
.hd .go { font-family:inherit; font-size:var(--m-t-cap); font-weight:600; color:var(--m-ac-deep);
  background:none; border:0; cursor:pointer; padding:6px 8px; border-radius:var(--m-r-ctl);
  text-decoration:none; white-space:nowrap;
  transition:background var(--m-out) var(--m-ease), transform var(--m-press) var(--m-ease); }
@media (hover:hover) and (pointer:fine) { .hd .go:hover { background:var(--m-ac-dim); } }
.hd .go:active { transform:scale(0.97); }
@media (prefers-reduced-motion:reduce) {
  .hd .go { transition:none; } .hd .go:active { transform:none; } }
/* The tail: the wide chart keeps the room it needs, the lists sit beside it instead of under it. */
.hd-split { display:grid; grid-template-columns:minmax(0,1.7fr) minmax(0,1fr); gap:var(--s3); align-items:start; }
.hd-col { display:flex; flex-direction:column; gap:var(--s3); min-width:0; }
@media (max-width: 1100px) { .hd-split { grid-template-columns:minmax(0,1fr); } }

  border:0; cursor:pointer; padding:6px 8px; border-radius:var(--r-sm); text-decoration:none; }

/* ===== the four leading figures =====
   They used to be four identical white boxes, each holding one number in the middle of a lot of
   nothing: no point of view, no context, no way to tell at a glance whether the year is going well.
   DESIGN.md list rule 13 says a page must have a point of view — one figure leads at the size that
   says so. «نسبة الإنجاز» is that figure here, and it carries the bar it is a percentage OF. */
/* THE CARD GRAMMAR IS THE PROTOTYPE'S (founder, 2026-09-16). His card is: a small muted label on
   its own line, then a BASELINE ROW of a 28px/800 figure beside a 12px unit. Massar stacked a
   600-weight figure under a label and let the unit wrap to a third line, so the card read as a
   form field rather than as a number. Hierarchy here is carried by WEIGHT (500 label -> 800
   figure), which is why DESIGN.md now allows 800 on a leading figure and nowhere else. */
  padding:18px 18px 16px; display:flex; flex-direction:column; min-width:0; overflow:hidden;
  box-shadow:var(--specular), var(--sh-0); }
/* baseline, not center: the unit must sit on the figure's baseline or it floats mid-digit */
  font-size:var(--t-2xl); font-weight:800; color:var(--fig); font-variant-numeric:tabular-nums;
  line-height:1; letter-spacing:0; }
/* «مليون ر.س» is not part of the figure: it rides beside it at label weight, on its baseline */
/* the lead tile: the accent ground, the biggest figure, and the meter that gives the percentage a subject */
  border-color:var(--accent-mark); }
  box-shadow:inset 0 0 0 1px var(--accent-mark); overflow:hidden; margin-block-start:var(--s2); }
  transition:width var(--slow) var(--ease); }
/* a supporting tile carries a quiet rule in its own tone, so four tiles are not four identical boxes */

/* صحة خط البيع — one card per state, each one a door into its own deals */
  border-radius:var(--r-lg); padding:var(--s4); display:flex; flex-direction:column; gap:6px; min-width:0; cursor:pointer;
  overflow:hidden; color:inherit; box-shadow:inset 0 1px 0 rgba(255,255,255,.9), var(--sh-0);
  transition:box-shadow var(--base) var(--ease), transform var(--base) var(--ease), border-color var(--fast) var(--ease); }
/* The state's own colour washes the head of the card instead of sitting as a 3px stripe nobody
   reads. The wash runs to paper well before the text, so every label keeps its measured contrast. */
  background:linear-gradient(180deg, var(--tn-soft, var(--surface)), transparent); pointer-events:none; }
/* interior.dev: a hover lift is a promise the thing is clickable — and here it is, each card opens
   exactly the deals it counted. A disabled (zero-count) card makes no such promise. */
@media (hover:hover) and (pointer:fine) {
  .hm-st:not([disabled]):hover { box-shadow:var(--sh-3); transform:translateY(-2px); border-color:var(--tn, var(--line)); }
}
/* The prototype's own layout: the state's name and its dot at the inline-END of the first row, the
   COUNT big at the inline-start of that same row, then the definition, then the money in the state's
   own colour. Massar had the name on one line and a small count under it, so four cards read as four
   labels rather than as four quantities. */
/* .hm-hd, not .hd — .hd is the page shell above, and a nested .hd inherited its column flow, which
   put the state's name under its own count instead of beside it. */
  color:var(--tn-text, var(--ink)); margin-inline-start:auto; text-align:end; }
  font-variant-numeric:tabular-nums; margin-top:auto; }
/* the share of the whole pipeline — the figure above is a count, this says how big a slice it is */
  transition:width var(--slow) var(--ease); }

/* the partners' week */
  display:flex; align-items:center; gap:var(--s5); flex-wrap:wrap;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.9), var(--sh-0); }
/* The week's outcome as ONE bar, in the order a conversation goes: interested, not interested, no
   reply, then the untouched remainder of the target. Five columns separated by rules made the reader
   compare five numbers; a stacked bar shows the split without arithmetic. */
  background:var(--surface-2); margin-block-start:var(--s2); }
  transition:stroke-dashoffset 420ms cubic-bezier(0.23, 1, 0.32, 1); }
/* one fact per line: label, figure, share. Inline spans ran «تم التواصل» and «2» and «33.3٪» together. */

/* The entrance is gone. It staggered the bands up 6px on first paint, and the whole hmEntered
   gate existed to stop it replaying on every keystroke - machinery whose only job was to make a
   decoration tolerable. الرئيسية is opened dozens of times a day; at that frequency an entrance
   is not delight, it is latency the reader has to sit through before the number arrives. The
   figure should be there when the page is.
   What survives is the part that carries meaning: the bars still animate to their width, because
   a bar growing to its value shows the value being measured. */
@media (prefers-reduced-motion: reduce) {
  .hd .go { transition:none; }
}
}
@media (max-width: 560px) {
  .hm-kpis, .hm-health { grid-template-columns:minmax(0,1fr); }
  .hm-st, .hm-lnk { min-height:44px; }
}
`;

export const HOME_CRM_JS = `
/* ---------- the shell ----------
   One header for every band on الرئيسية. Taking the list and numbering it HERE, rather than letting
   each band print its own index, is what keeps the spine contiguous when a band is missing: a role
   without partners.view drops that band and the numbering closes up instead of skipping a number. */
function hdBands(list) {
  /* The ordinal is gone. Numbering the bands 1..n implied a sequence the reader is meant to
     follow, and the numbering closed up when a role could not see a band — so two people with
     different permissions saw a different «3». A band is a section, not a step. */
  return '<div class="hd">' + list.filter(function (b) { return b && b[2]; }).map(function (b) {
    /* b[5] marks a band that needs the full row. The exec band is itself three columns and the
       revenue surface is the page's leading figure; squeezing either into a third would undo
       the reason they exist. Everything else reads three across. */
    return '<section class="m-card' + (b[5] ? " hd-wide" : "") + '"' +
      (b[4] ? ' id="' + b[4] + '"' : "") + '>' +
      '<div class="m-card__h"><div class="m-section-head__t">' +
      '<h2 class="m-card__t">' + b[0] + "</h2>" +
      (b[1] ? '<p class="m-meta">' + b[1] + "</p>" : "") + "</div>" +
      (b[3] || "") + "</div>" + b[2] + "</section>";
  }).join("") + "</div>";
}

/* ---------- what the bands read ---------- */
var hmEsc = null, hmEscLoading = false, hmEscFailed = false;
var hmPt = null, hmPtLoading = false, hmPtFailed = false, hmPtWeek = "";

function hmT() { return { headers: { "x-admin-token": TOKEN } }; }

/* Open escalations decide «بانتظار الدعم». One read for the whole board — the drawer's own per-deal
   read stays where it is, because it must reflect a change the moment someone records one. */
function hmEscLoad(force) {
  if (hmEscLoading || (hmEsc && !force) || (hmEscFailed && !force)) return;
  hmEscLoading = true;
  fetch("/admin/escalations", hmT())
    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(function (j) { hmEsc = (j && j.escalations) || []; hmEscFailed = false; })
    .catch(function () { hmEscFailed = true; })
    .then(function () { hmEscLoading = false; render(false); });
}
function hmPtLoad(force) {
  if (hmPtLoading || (hmPt && !force) || (hmPtFailed && !force)) return;
  hmPtLoading = true;
  fetch("/admin/partners", hmT())
    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(function (j) { hmPt = j; hmPtWeek = (j && j.week) || ""; hmPtFailed = false; })
    .catch(function () { hmPtFailed = true; })
    .then(function () { hmPtLoading = false; render(false); });
}
window.hmRetry = function () { hmEscFailed = false; hmPtFailed = false; hmEscLoad(true); hmPtLoad(true); render(false); };

/* ---------- the health of the pipeline ---------- */
function hmOpenEscIds() {
  var ids = {};
  (hmEsc || []).forEach(function (e) { if (!e.resolvedAt && e.oppId != null) ids[e.oppId] = 1; });
  return ids;
}
function hmHealth() {
  var rows = (typeof oppRows !== "undefined" && oppRows) ? oppRows : [];
  var esc = hmOpenEscIds();
  var now = Date.now();
  return pipelineHealth(rows.map(function (l) {
    return {
      id: l.id,
      value: opValue(l),
      lost: opIsLost(l),
      won: opIsWon(l),
      stalled: opStalled(l),
      /* an escalation that nobody closed, on a line that is still open */
      awaitingSupport: opIsOpen(l) && !!esc[l.id]
    };
  }));
}
/* Each state opens exactly the deals it counted. «بانتظار الدعم» has no board filter of its own — it is
   read from the escalations table — so it travels as ids, the same mechanism the reports use. */
window.hmOpenState = function (key) {
  if (typeof opStg === "undefined") { location.hash = "#opps"; return; }
  var rows = (typeof oppRows !== "undefined" && oppRows) ? oppRows : [];
  var esc = hmOpenEscIds();
  opQ = ""; opStat = "all"; opOwn = "all"; opProd = ""; opStg = "all"; opShort = "";
  if (typeof opSetIds === "function") opSetIds(null, "");
  if (key === "late") opShort = "stalled";
  else if (key === "on_track") {
    var ok = rows.filter(function (l) { return opIsOpen(l) && !opStalled(l) && !esc[l.id]; }).map(function (l) { return l.id; });
    if (typeof opSetIds === "function") opSetIds(ok, "على المسار");
  } else if (key === "support") {
    var sup = rows.filter(function (l) { return opIsOpen(l) && esc[l.id]; }).map(function (l) { return l.id; });
    if (typeof opSetIds === "function") opSetIds(sup, "بانتظار الدعم");
  } else if (key === "rejected") {
    var lost = rows.filter(opIsLost).map(function (l) { return l.id; });
    if (typeof opSetIds === "function") opSetIds(lost, "مرفوضة");
  }
  opSel = {}; if (typeof PAGE !== "undefined") PAGE.opps = 1;
  location.hash = "#opps";
};

/* Split a printed figure into the numeral and whatever trails it, so «6.3 مليون ر.س» draws as a
   28px/800 number with its unit riding on the baseline beside it — the prototype's own shape.
   Falls back to printing the whole string when there is no leading numeral to split on. */
/* hmMoney returns MARKUP (opMoneyShort wraps its figure in <bdi>). Anything that wants to measure,
   split or re-escape a printed figure has to see the text, not the tags. */
function hmPlain(html) { return String(html == null ? "" : html).replace(/<[^>]*>/g, ""); }
function hmFigure(text) {
  var s = hmPlain(text);
  var m = s.match(/^\\s*([0-9][0-9.,]*)\\s*([\\s\\S]*)$/);
  if (!m) return '<span class="n">' + esc(s) + "</span>";
  return '<span class="n">' + esc(m[1]) + (m[2] ? '<span class="uu">' + esc(m[2]) + "</span>" : "") + "</span>";
}
function hmIco(n) { return typeof opIco === "function" ? opIco(n) : ""; }
function hmMoney(v) { return typeof opMoneyShort === "function" ? opMoneyShort(v) : fmtN(Math.round(v || 0)) + " ر.س"; }
/* Mark, soft ground and text — the four-value status contract (DESIGN.md §2). The soft value is the
   card's wash; the text value is the only legal label on it. */
var HM_TONE = {
  on_track: "--tn:#1E9E63;--tn-soft:#E4F5EC;--tn-text:#12633F",
  late: "--tn:#B37F00;--tn-soft:#FFF5D6;--tn-text:#7A5600",
  support: "--tn:#2563EB;--tn-soft:#EAF1FE;--tn-text:#1A47BE",
  rejected: "--tn:#D9534F;--tn-soft:#FBE7E6;--tn-text:#8E2A27"
};

/* Body only — the shell owns the header (hdBands), so every band on الرئيسية wears one. */
function vHomeHealth() {
  if (typeof opLoad === "function") opLoad(false);
  hmEscLoad(false);
  var loading = (typeof oppLoading !== "undefined" && oppLoading) || hmEscLoading;
  var failed = (typeof oppFailed !== "undefined" && oppFailed) || hmEscFailed;
  if (!((typeof oppRows !== "undefined" && oppRows)) && loading) {
    return '<div class="m-empty" aria-busy="true"><div class="m-empty__t">تجري قراءة الفرص…</div></div>';
  }
  if (!((typeof oppRows !== "undefined" && oppRows)) && failed) {
    return '<div class="m-empty" role="alert"><div class="m-empty__t">تعذّر تحميل الفرص</div>' +
      '<div class="m-empty__a"><button class="m-btn" onclick="opRetry()">أعد المحاولة</button></div></div>';
  }
  var st = hmHealth();
  if (!st.total) {
    return '<div class="m-empty"><div class="m-empty__t">لا فرص مسجّلة بعد</div>' +
      '<div class="m-empty__d">تظهر الحالات هنا فور تسجيل أول فرصة في «فرص البيع».</div></div>';
  }

  /* Four states, each a row that opens exactly the deals it counted. As buttons in a grid these
     were four tiles competing for the same glance; as ruled rows they read in one pass and the
     share bar makes the comparison the tiles were trying to make. A state with no deals is
     printed, not hidden - «لا شيء هنا» is a finding, and a row that disappears takes its own
     absence with it. */
  var rows = st.buckets.map(function (bk) {
    var off = !bk.count;
    var share = st.total ? Math.round((bk.count / st.total) * 100) : 0;
    var tone = bk.key === "on_track" ? "ok" : (bk.key === "late" ? "mid" : (bk.key === "rejected" ? "low" : ""));
    var body =
      '<span class="m-seg-row__t">' + esc(bk.label) +
        '<span class="m-cap" style="display:block">' + esc(bk.hint) + "</span></span>" +
      '<span class="m-seg-row__b"><i class="' + tone + '" style="--m-pct:' + share + '%"></i></span>' +
      '<span class="m-seg-row__v">' +
        (off ? '<span class="m-td-nil m-nil--none">لا شيء</span>'
             : '<span class="m-n">' + fmtN(bk.count) + "</span>") + "</span>" +
      '<span class="m-cap">' + (off ? "" : hmMoney(bk.value)) + "</span>";
    return off
      ? '<div class="m-seg-row">' + body + "</div>"
      : '<button type="button" class="m-seg-row" style="width:100%;text-align:start;' +
        'font:inherit;background:none;border:0;cursor:pointer" ' +
        'onclick="hmOpenState(&quot;' + bk.key + '&quot;)" ' +
        'title="' + esc(bk.label) + ' — فتح الفرص">' + body + "</button>";
  }).join("");

  return '<div class="m-segs">' + rows + "</div>" +
    '<div class="m-cap" style="margin-block-start:var(--m-3)">' +
    opPl(st.total, "فرصة واحدة", "فرصتان", "فرص", "فرصة") + " مفتوحة، كل واحدة في حالة واحدة فقط" +
    (hmEscFailed ? " · تعذّر قراءة سجل التصعيد" : "") + "</div>";
}

/* ---------- the partners' week ---------- */
/* The partners' week, on the new system. The ring is gone: it encoded one number (attainment)
   in a shape that takes 80px square to read, next to five figures that each take a line. The
   five figures ARE the week, and «تم التواصل من المستهدف» is one of them, not a crown above
   them. A partner week with no target prints that it has none rather than a 0٪ ring. */
function vHomePartners() {
  if (typeof meCan === "function" && !meCan("partners.view")) return "";
  hmPtLoad(false);
  if (!hmPt && hmPtLoading) return '<div class="m-empty" aria-busy="true"><div class="m-empty__t">تجري قراءة أسبوع الشركاء…</div></div>';
  if (!hmPt) {
    return '<div class="m-empty" role="alert"><div class="m-empty__t">تعذّر تحميل أداء الشركاء</div>' +
      '<div class="m-empty__a"><button class="m-btn" onclick="hmRetry()">أعد المحاولة</button></div></div>';
  }
  var wk = summarizeWeek(hmPt.targets || [], hmPt.results || []);
  var b = partnerWeekBand(wk);
  if (!b.target && !b.contacted) {
    return '<div class="m-empty"><div class="m-empty__t">لا مستهدفات ولا نتائج في هذا الأسبوع</div>' +
      '<div class="m-empty__d">تُحدَّد من «شركاء المبيعات».</div></div>';
  }
  var pct = wholePct(attainmentPct(b.contacted, b.target));

  /* Share OF THE TARGET, so the untouched remainder stays visible as the gap the bar does not
     fill. A bar normalised to the contacted count would always look full. */
  var den = b.target || b.contacted || 0;
  var w = function (n) { return den ? Math.max(0, Math.min(100, (n / den) * 100)) : 0; };

  var row = function (label, n, tone, note) {
    return '<div class="m-seg-row"><span class="m-seg-row__t">' + label + "</span>" +
      '<span class="m-seg-row__b"><i class="' + tone + '" style="--m-pct:' + w(n).toFixed(1) + '%"></i></span>' +
      '<span class="m-seg-row__v"><span class="m-n">' + fmtN(n) + "</span></span>" +
      (note ? '<span class="m-cap">' + note + "</span>" : "") + "</div>";
  };

  var h = '<div class="m-row" style="justify-content:space-between;flex-wrap:wrap;gap:var(--m-3)">' +
    '<div><div class="m-card__k">تم التواصل من المستهدف الأسبوعي</div>' +
    '<div class="m-stat__v">' +
      (pct === null
        ? '<span class="m-td-nil m-nil--owed">بلا مستهدف أسبوعي</span>'
        : '<span class="m-n">' + fmtN(pct) + "٪</span>") + "</div></div>" +
    '<div class="m-cap">' + opPl(b.target, "منشأة واحدة", "منشأتان", "منشآت", "منشأة") +
      " مستهدفة · " + opPl(b.contacted, "تم التواصل مع واحدة", "تم التواصل مع اثنتين",
        "تم التواصل مع", "تم التواصل مع") + "</div></div>";

  h += '<div class="m-segs" style="margin-block-start:var(--m-4)">' +
    row("العملاء المهتمون", b.interested, "ok", "") +
    row("غير مهتمين", b.notInterested, "low", "") +
    row("لم يردوا", b.noReply, "mid", "") + "</div>";

  if (den && den > b.contacted) {
    h += '<div class="m-cap" style="margin-block-start:var(--m-3)">' +
      opPl(den - b.contacted, "منشأة واحدة لم يُتواصل بها بعد", "منشأتان لم يُتواصل بهما بعد",
           "منشآت لم يُتواصل بها بعد", "منشأة لم يُتواصل بها بعد") + "</div>";
  }
  return h;
}

/* The executive bands, as data for the shell rather than as finished HTML. vHome appends the
   campaign bands to this list, so the whole page is one numbered sequence with one header style
   instead of an executive dashboard with its own titles sitting on top of a second one with its
   own. Order is the order the questions are asked: where are we, what is stuck, why, who is
   working it.
   hmEntered gates the entrance to the FIRST paint: #body is rewritten on every data load, and an
   entrance that replays on each one is the jump DESIGN.md §8.6 forbids. */
/* The deck: one band that answers «أين نحن» and «ما الذي يحتاج تدخلًا» together. It is NOT a
   .hd-sec — it is full-bleed and carries its own header, because the whole point is that it reads
   as one dark object continuous with the rail rather than as a section of the page. */
/* «الأداء التجاري» and «صحة خط البيع» are no longer bands: the deck above carries both, and
   carrying them twice is the page-duplication defect this project has caught three times. What is
   left here is everything the deck does NOT answer. */
function vHomeExecBands() {
  return [
    ["شركاء المبيعات", (hmPtWeek ? "أسبوع " + esc(hmPtWeek) : "الأسبوع الحالي"), vHomePartners(), '<a class="go" href="#partners">عرض التفاصيل ←</a>']
  ];
}
`;
