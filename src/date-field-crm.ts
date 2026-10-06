// date-field-crm.ts — the date picker and the range picker.
//
// WHY. The founder asked for coss ui's p-date-picker-3 (a field that opens a calendar with DROPDOWN
// navigation) and p-date-picker-2 (a range) — 2026-09-17. Both specimens are React over date-fns,
// @daypicker and shadcn primitives; this app has none of those, so the pattern is ported: an outline
// trigger showing a calendar glyph and the formatted date (or a muted placeholder), opening a popover
// that holds a month grid, with the month and the year as the same combobox this app already uses
// (combobox-crm.ts) so paging a year is one gesture rather than twelve.
//
// WHAT IT REPLACES. Three <input type="date"> fields, whose native picker is a different control in
// every browser, renders its own Gregorian month names in the browser's locale rather than the page's,
// and on a phone takes over the screen. The VALUE is unchanged: «YYYY-MM-DD» in a hidden input carrying
// the screen's own handler, so no save path moves.
//
// RTL. The grid is a right-to-left seven-column grid — الأحد is the first column, which is the rightmost
// — and «previous month» points to the right. Day numbers are western, each in its own isolate.
//
// MOTION. None on open. This is a popover the user summons and dismisses many times while filling a
// form, and the emil framework's own rule is that a control seen tens of times a day should not perform.
//
// (No backticks anywhere below, including in comments: this is one template literal.)

export const DATE_FIELD_JS = `
var DP_ICON = '<svg class="m-dp__i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
  '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4m8-4v4M3.5 10h17"/></svg>';

/* o: { id, value ("YYYY-MM-DD" or ""), min, max, label, placeholder, attrs, wide } */
function mDate(o) {
  var val = o.value ? String(o.value) : "";
  return '<div class="m-dp' + (o.wide ? " m-dp--wide" : "") + '" data-dp="' + esc(o.id) + '"' +
    ' data-dp-mode="single"' + (o.min ? ' data-dp-min="' + esc(o.min) + '"' : "") +
    (o.max ? ' data-dp-max="' + esc(o.max) + '"' : "") + ">" +
    '<input type="hidden" id="' + esc(o.id) + '" value="' + esc(val) + '"' + (o.attrs || "") + ">" +
    '<button type="button" class="m-dp__t" id="' + esc(o.id) + '_t" aria-haspopup="dialog"' +
      ' aria-expanded="false" aria-label="' + esc(o.label || "اختر التاريخ") + '">' + DP_ICON +
      '<span class="m-dp__v' + (val ? "" : " is-ph") + '">' +
      (val ? '<span class="m-n m-n--date">' + esc(formatArabicDate(val)) + "</span>" : esc(o.placeholder || "اختر التاريخ")) +
      "</span></button>" +
    '<div class="m-dp__p" id="' + esc(o.id) + '_p" role="dialog" aria-modal="false" aria-label="' +
      esc(o.label || "التقويم") + '" hidden></div></div>';
}

/* o: { id, from, to, min, max, label, attrs (applied to BOTH hidden inputs), wide,
        fromLabel, toLabel, toOptional, presets: [months…] }
   A range is TWO labelled halves, «البداية» → «النهاية», each its own button (founder, 2026-10-06: one
   «من — إلى» field whose second click silently meant the other end was confusing). The open calendar
   always says which end it is setting. The first half keeps the id «<id>_t», so a label's for= and
   any focus() written for the old single trigger still land on it. */
var DP_ARROW = '<svg class="m-dp__arr" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 12H5m6-6-6 6 6 6"/></svg>';
function mDateRange(o) {
  var f = o.from ? String(o.from) : "", t = o.to ? String(o.to) : "";
  var fl = o.fromLabel || "البداية", tl = o.toLabel || "النهاية";
  return '<div class="m-dp m-dp--range' + (o.wide ? " m-dp--wide" : "") + '" data-dp="' + esc(o.id) + '"' +
    ' data-dp-mode="range"' + (o.min ? ' data-dp-min="' + esc(o.min) + '"' : "") +
    (o.max ? ' data-dp-max="' + esc(o.max) + '"' : "") +
    (o.presets && o.presets.length ? ' data-dp-presets="' + esc(o.presets.join(",")) + '"' : "") +
    (o.toOptional ? ' data-dp-toopt="1"' : "") +
    ' data-dp-fl="' + esc(fl) + '" data-dp-tl="' + esc(tl) + '">' +
    '<input type="hidden" id="' + esc(o.id) + '" value="' + esc(f) + '"' + (o.attrs || "") + ">" +
    '<input type="hidden" id="' + esc(o.id) + '_to" value="' + esc(t) + '"' + (o.attrs || "") + ">" +
    '<div class="m-dp__rt" role="group" aria-label="' + esc(o.label || "المدى") + '">' + DP_ICON +
      dpSeg(o.id + "_t", "from", fl, f, "اختر") + DP_ARROW +
      dpSeg(o.id + "_t2", "to", tl, t, o.toOptional ? "اختياري" : "اختر") + "</div>" +
    '<div class="m-dp__p" id="' + esc(o.id) + '_p" role="dialog" aria-modal="false" aria-label="' +
      esc(o.label || "التقويم") + '" hidden></div></div>';
}
function dpSeg(id, end, label, val, ph) {
  return '<button type="button" class="m-dp__t m-dp__seg" id="' + esc(id) + '" data-dp-end="' + end + '"' +
    ' aria-haspopup="dialog" aria-expanded="false" aria-label="' + esc(label) + '">' +
    '<span class="m-dp__k">' + esc(label) + "</span>" + dpSegVal(val, ph) + "</button>";
}
function dpSegVal(val, ph) {
  return '<span class="m-dp__v' + (val ? "" : " is-ph") + '" data-ph="' + esc(ph) + '">' +
    (val ? '<span class="m-n m-n--date">' + esc(formatArabicDate(val)) + "</span>" : esc(ph)) + "</span>";
}

if (!window.__mDp) {
  window.__mDp = 1;
  var dpOpen = null;        /* the open .m-dp */
  var dpView = { y: 0, m: 0 };
  var dpFocus = "";         /* the day the grid's roving tabindex sits on */
  var dpEnd = "from";       /* in a range: the end the open calendar is setting */

  var dpToday = function () { return toISODate(new Date()); };
  var dpVal = function (g) {
    var id = g.getAttribute("data-dp");
    var a = document.getElementById(id), b = document.getElementById(id + "_to");
    return { from: a ? a.value : "", to: b ? b.value : "" };
  };
  var dpBounds = function (g) {
    return { min: g.getAttribute("data-dp-min") || null, max: g.getAttribute("data-dp-max") || null };
  };
  /* Writing the value: the screen's own handler is on the hidden input, so it is set and changed
     exactly as the type="date" input it replaces was. */
  var dpSet = function (g, from, to) {
    var id = g.getAttribute("data-dp"), range = g.getAttribute("data-dp-mode") === "range";
    var a = document.getElementById(id), b = document.getElementById(id + "_to");
    var moved = false;
    if (a && a.value !== from) { a.value = from; moved = true; }
    if (range && b && b.value !== to) { b.value = to; moved = true; }
    if (!moved) return;
    if (a) { a.dispatchEvent(new Event("input", { bubbles: true })); a.dispatchEvent(new Event("change", { bubbles: true })); }
    if (range && b) { b.dispatchEvent(new Event("input", { bubbles: true })); b.dispatchEvent(new Event("change", { bubbles: true })); }
  };
  var dpLabel = function (g) {
    var v = dpVal(g), lab = g.querySelector(".m-dp__v");
    if (!lab) return;
    if (g.getAttribute("data-dp-mode") === "range") {
      [["from", v.from], ["to", v.to]].forEach(function (x) {
        var seg = g.querySelector('[data-dp-end="' + x[0] + '"] .m-dp__v');
        if (seg) seg.outerHTML = dpSegVal(x[1], seg.getAttribute("data-ph") || "اختر");
      });
    } else {
      lab.innerHTML = v.from ? '<span class="m-n m-n--date">' + formatArabicDate(v.from) + "</span>"
        : (lab.getAttribute("data-ph") || "اختر التاريخ");
      lab.classList.toggle("is-ph", !v.from);
    }
  };

  var dpPaint = function (g) {
    var p = g.querySelector(".m-dp__p"), b = dpBounds(g), v = dpVal(g);
    var range = g.getAttribute("data-dp-mode") === "range";
    var cells = monthGrid(dpView.y, dpView.m);
    var years = yearRange(dpView.y, b.min, b.max);
    var id = g.getAttribute("data-dp");
    var h = "";
    if (range) {
      var toOpt = g.getAttribute("data-dp-toopt") === "1";
      var endName = dpEnd === "to" ? g.getAttribute("data-dp-tl") || "النهاية" : g.getAttribute("data-dp-fl") || "البداية";
      h += '<p class="m-dp__step" aria-live="polite">اختر تاريخ ' + esc(endName) +
        (dpEnd === "to" && toOpt ? " <small>(اختياري)</small>" : "") + "</p>";
      var pre = (g.getAttribute("data-dp-presets") || "").split(",").map(Number).filter(function (n) { return n > 0; });
      if (pre.length) {
        h += '<div class="m-dp__pre" role="group" aria-label="مدة جاهزة">' + pre.map(function (n) {
          var e = v.from ? termEndISO(v.from, n) : "";
          return '<button type="button" class="m-dp__chip' + (e && e === v.to ? " is-on" : "") + '" data-dp-term="' + n + '"' +
            (v.from && isDayAllowed(e, b.min, b.max) ? "" : " disabled") +
            (v.from ? "" : ' title="اختر تاريخ البداية أولًا"') + ">" + esc(monthsLabel(n)) + "</button>";
        }).join("") + "</div>";
      }
    }
    h += '<div class="m-dp__h">' +
      '<button type="button" class="m-dp__nav" data-dp-step="-1" aria-label="الشهر السابق">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>' +
      '<div class="m-dp__sel">' +
      mCombo({ id: id + "_mon", value: AR_MONTHS[dpView.m], options: AR_MONTHS, label: "الشهر", attrs: ' data-dp-mon="1"' }) +
      mCombo({ id: id + "_yr", value: String(dpView.y), options: years.map(String), label: "السنة", attrs: ' data-dp-yr="1"' }) +
      "</div>" +
      '<button type="button" class="m-dp__nav" data-dp-step="1" aria-label="الشهر التالي">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></button>' +
      "</div>";
    h += '<div class="m-dp__w" aria-hidden="true">' +
      AR_WEEKDAYS.map(function (d) { return "<span>" + esc(d) + "</span>"; }).join("") + "</div>";
    h += '<div class="m-dp__g" role="grid">';
    cells.forEach(function (c) {
      var allowed = isDayAllowed(c.iso, b.min, b.max);
      var on = range ? (c.iso === v.from || c.iso === v.to) : c.iso === v.from;
      var mid = range && v.from && v.to && isWithinISO(c.iso, v.from, v.to) && !on;
      var caps = range && v.from && v.to && v.from !== v.to
        ? (c.iso === v.from ? " is-start" : c.iso === v.to ? " is-end" : "") : "";
      h += '<button type="button" class="m-dp__d' + (c.inMonth ? "" : " is-out") +
        (on ? " is-on" : "") + caps + (mid ? " is-mid" : "") + (c.iso === dpToday() ? " is-today" : "") +
        '" role="gridcell" data-dp-day="' + c.iso + '" tabindex="' + (c.iso === dpFocus ? "0" : "-1") + '"' +
        (allowed ? "" : " disabled") + ' aria-selected="' + (on ? "true" : "false") + '"' +
        ' aria-label="' + esc(formatArabicDate(c.iso)) + '"><span class="m-n">' + fmtN(c.day) + "</span></button>";
    });
    h += "</div>";
    if (range) {
      var len = rangeLengthLabel(v.from, v.to);
      h += '<div class="m-dp__f"><span class="m-dp__sum">' +
        (len ? "المدة: <b>" + esc(len) + "</b>" : v.from ? (g.getAttribute("data-dp-toopt") === "1" ? "بلا نهاية محدّدة" : "اختر النهاية") : "") + "</span>" +
        (v.from || v.to ? '<button type="button" class="m-btn m-btn--quiet" data-dp-clear="1">مسح</button>' : "") +
        '<button type="button" class="m-btn" data-dp-done="1">تم</button></div>';
    } else {
      h += '<div class="m-dp__f">' +
        '<button type="button" class="m-btn m-btn--quiet" data-dp-today="1">اليوم</button>' +
        (v.from ? '<button type="button" class="m-btn m-btn--quiet" data-dp-clear="1">مسح</button>' : "") +
        "</div>";
    }
    p.innerHTML = h;
  };

  var dpClose = function () {
    if (!dpOpen) return;
    var g = dpOpen, p = g.querySelector(".m-dp__p"), t = dpTrig(g);
    p.hidden = true; p.innerHTML = "";
    g.querySelectorAll(".m-dp__t").forEach(function (x) { x.setAttribute("aria-expanded", "false"); x.classList.remove("is-act"); });
    dpOpen = null;
    if (t) { try { t.focus({ preventScroll: true }); } catch (e) {} }
  };
  /* The trigger that owns the open calendar: in a range, the half for the end being set. */
  var dpTrig = function (g) {
    return g.querySelector('[data-dp-end="' + dpEnd + '"]') || g.querySelector(".m-dp__t");
  };
  var dpMark = function (g) {
    g.querySelectorAll(".m-dp__t").forEach(function (x) {
      var on = !x.hasAttribute("data-dp-end") || x.getAttribute("data-dp-end") === dpEnd;
      x.setAttribute("aria-expanded", on ? "true" : "false");
      x.classList.toggle("is-act", on && x.hasAttribute("data-dp-end"));
    });
  };
  var dpOpenIt = function (g, end) {
    var range = g.getAttribute("data-dp-mode") === "range";
    var v = dpVal(g);
    var want = range ? (end === "to" && v.from ? "to" : end === "to" ? "from" : "from") : "from";
    if (dpOpen === g && dpEnd === want) return;
    if (dpOpen !== g) dpClose();
    dpEnd = want;
    var at = dpEnd === "to" ? (v.to || v.from) : v.from;
    var anchor = parseISODate(at) || parseISODate(dpToday());
    dpView = { y: anchor.getFullYear(), m: anchor.getMonth() };
    dpFocus = at || dpToday();
    dpOpen = g;
    var p = g.querySelector(".m-dp__p");
    p.hidden = false;
    dpMark(g);
    dpPaint(g);
    var f = p.querySelector('[data-dp-day="' + dpFocus + '"]') || p.querySelector(".m-dp__d:not([disabled])");
    if (f) { try { f.focus({ preventScroll: true }); } catch (e) {} }
  };
  var dpStep = function (n) {
    var s = shiftMonth(dpView.y, dpView.m, n);
    dpView = { y: s.year, m: s.month };
    dpPaint(dpOpen);
  };
  var dpMoveFocus = function (n) {
    var next = shiftISODay(dpFocus, n), b = dpBounds(dpOpen);
    if (!isDayAllowed(next, b.min, b.max)) return;
    dpFocus = next;
    var d = parseISODate(next);
    if (d.getFullYear() !== dpView.y || d.getMonth() !== dpView.m) dpView = { y: d.getFullYear(), m: d.getMonth() };
    dpPaint(dpOpen);
    var el = dpOpen.querySelector('[data-dp-day="' + dpFocus + '"]');
    if (el) { try { el.focus({ preventScroll: true }); } catch (e) {} }
  };
  var dpPick = function (g, iso) {
    var range = g.getAttribute("data-dp-mode") === "range", v = dpVal(g);
    if (!range) { dpSet(g, iso, ""); dpLabel(g); dpClose(); return; }
    var r = pickRangeEnd(v.from, v.to, iso, dpEnd);
    dpSet(g, r.from, r.to);
    dpLabel(g);
    /* Picking the start hands the calendar to the end and says so; picking the end finishes. */
    if (r.done) { dpClose(); return; }
    dpEnd = r.end; dpFocus = iso; dpMark(g); dpPaint(g);
    var fd = g.querySelector('[data-dp-day="' + dpFocus + '"]');
    if (fd) { try { fd.focus({ preventScroll: true }); } catch (e) {} }
  };

  document.addEventListener("click", function (e) {
    var t = e.target;
    var trig = t && t.closest ? t.closest(".m-dp__t") : null;
    if (trig) {
      var g0 = trig.closest(".m-dp"), e0 = trig.getAttribute("data-dp-end");
      if (dpOpen === g0 && (!e0 || e0 === dpEnd)) dpClose(); else dpOpenIt(g0, e0 || "from");
      return;
    }
    if (!dpOpen) {
      if (t && t.closest && t.closest(".m-dp")) return;
      return;
    }
    var nav = t.closest(".m-dp__nav");
    if (nav) { dpStep(Number(nav.getAttribute("data-dp-step"))); return; }
    var day = t.closest("[data-dp-day]");
    if (day && !day.disabled) { dpPick(dpOpen, day.getAttribute("data-dp-day")); return; }
    if (t.closest("[data-dp-today]")) {
      var b = dpBounds(dpOpen);
      if (isDayAllowed(dpToday(), b.min, b.max)) dpPick(dpOpen, dpToday());
      return;
    }
    if (t.closest("[data-dp-clear]")) {
      dpSet(dpOpen, "", ""); dpLabel(dpOpen);
      if (dpOpen.getAttribute("data-dp-mode") === "range") { dpEnd = "from"; dpMark(dpOpen); dpPaint(dpOpen); } else dpClose();
      return;
    }
    if (t.closest("[data-dp-done]")) { dpClose(); return; }
    var term = t.closest("[data-dp-term]");
    if (term && !term.disabled) {
      var tv = dpVal(dpOpen);
      dpSet(dpOpen, tv.from, termEndISO(tv.from, Number(term.getAttribute("data-dp-term"))));
      dpLabel(dpOpen); dpClose(); return;
    }
    /* A click inside the popover's own comboboxes is theirs, not a dismissal. */
    /* The combobox popup now lives in #m-cb-layer on <body> while open, so a click on a month row
       is outside .m-dp in the DOM but inside the picker in the user's eyes. */
    /* And a target a repaint already removed (picking a month repaints the grid under the click) is
       no longer anywhere — it is not a click outside. */
    if (!document.body.contains(t)) return;
    if (!t.closest(".m-dp") && !t.closest("#m-cb-layer")) dpClose();
  });

  /* The month and the year come back as a change on the combobox's hidden input. */
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (!dpOpen || !t || !t.getAttribute) return;
    if (t.getAttribute("data-dp-mon")) {
      var i = AR_MONTHS.indexOf(t.value);
      if (i >= 0) { dpView = { y: dpView.y, m: i }; dpPaint(dpOpen); }
      return;
    }
    if (t.getAttribute("data-dp-yr")) {
      var y = Number(t.value);
      if (y) { dpView = { y: y, m: dpView.m }; dpPaint(dpOpen); }
    }
  });

  document.addEventListener("keydown", function (e) {
    var t = e.target;
    var trig = t && t.closest ? t.closest(".m-dp__t") : null;
    if (trig && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault(); dpOpenIt(trig.closest(".m-dp"), trig.getAttribute("data-dp-end") || "from"); return;
    }
    if (!dpOpen || !t.closest || !t.closest(".m-dp__g")) return;
    if (e.key === "ArrowRight") { e.preventDefault(); dpMoveFocus(-1); return; }   /* RTL: right is back */
    if (e.key === "ArrowLeft") { e.preventDefault(); dpMoveFocus(1); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); dpMoveFocus(-7); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); dpMoveFocus(7); return; }
    if (e.key === "PageUp") { e.preventDefault(); dpStep(-1); return; }
    if (e.key === "PageDown") { e.preventDefault(); dpStep(1); return; }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      var b = dpBounds(dpOpen);
      if (isDayAllowed(dpFocus, b.min, b.max)) dpPick(dpOpen, dpFocus);
    }
  });
  /* Escape in capture, ahead of any drawer's own Escape listener (the combobox learned this the hard
     way: stopPropagation does not stop a second listener on the same node). */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !dpOpen) return;
    e.preventDefault(); e.stopImmediatePropagation();
    dpClose();
  }, true);
  /* While the end is being chosen, the band follows the pointer: the range is drawn before it is picked. */
  var dpPreview = function (iso) {
    if (!dpOpen || dpOpen.getAttribute("data-dp-mode") !== "range" || dpEnd !== "to") return;
    var v = dpVal(dpOpen);
    dpOpen.querySelectorAll(".m-dp__d").forEach(function (d) {
      var x = d.getAttribute("data-dp-day");
      var on = !!(iso && v.from && iso > v.from && iso !== v.to);
      d.classList.toggle("is-prev", on && x > v.from && x < iso);
      d.classList.toggle("is-prev-end", on && x === iso);
      if (x === v.from && !v.to) d.classList.toggle("is-start", on);
    });
  };
  document.addEventListener("mouseover", function (e) {
    if (!dpOpen) return;
    var d = e.target && e.target.closest ? e.target.closest("[data-dp-day]") : null;
    if (d && dpOpen.contains(d)) dpPreview(d.getAttribute("data-dp-day"));
    else if (e.target && e.target.closest && e.target.closest(".m-dp__g") === null) dpPreview("");
  });
  document.addEventListener("focusin", function () {
    if (dpOpen && !document.body.contains(dpOpen)) dpOpen = null;
  });
}
`;
