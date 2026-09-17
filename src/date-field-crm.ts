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
      (val ? '<span class="m-n">' + esc(formatArabicDate(val)) + "</span>" : esc(o.placeholder || "اختر التاريخ")) +
      "</span></button>" +
    '<div class="m-dp__p" id="' + esc(o.id) + '_p" role="dialog" aria-modal="false" aria-label="' +
      esc(o.label || "التقويم") + '" hidden></div></div>';
}

/* o: { id, from, to, min, max, label, placeholder, attrs (applied to BOTH hidden inputs), wide } */
function mDateRange(o) {
  var f = o.from ? String(o.from) : "", t = o.to ? String(o.to) : "";
  return '<div class="m-dp m-dp--range' + (o.wide ? " m-dp--wide" : "") + '" data-dp="' + esc(o.id) + '"' +
    ' data-dp-mode="range"' + (o.min ? ' data-dp-min="' + esc(o.min) + '"' : "") +
    (o.max ? ' data-dp-max="' + esc(o.max) + '"' : "") + ">" +
    '<input type="hidden" id="' + esc(o.id) + '" value="' + esc(f) + '"' + (o.attrs || "") + ">" +
    '<input type="hidden" id="' + esc(o.id) + '_to" value="' + esc(t) + '"' + (o.attrs || "") + ">" +
    '<button type="button" class="m-dp__t" id="' + esc(o.id) + '_t" aria-haspopup="dialog"' +
      ' aria-expanded="false" aria-label="' + esc(o.label || "اختر المدى") + '">' + DP_ICON +
      '<span class="m-dp__v' + (f ? "" : " is-ph") + '">' + dpRangeText(f, t, o.placeholder) + "</span></button>" +
    '<div class="m-dp__p" id="' + esc(o.id) + '_p" role="dialog" aria-modal="false" aria-label="' +
      esc(o.label || "التقويم") + '" hidden></div></div>';
}
function dpRangeText(f, t, ph) {
  if (!f) return esc(ph || "اختر المدى");
  if (!t) return '<span class="m-n">' + esc(formatArabicDate(f)) + "</span> — …";
  return '<span class="m-n">' + esc(formatArabicDate(f)) + '</span> — <span class="m-n">' +
    esc(formatArabicDate(t)) + "</span>";
}

if (!window.__mDp) {
  window.__mDp = 1;
  var dpOpen = null;        /* the open .m-dp */
  var dpView = { y: 0, m: 0 };
  var dpFocus = "";         /* the day the grid's roving tabindex sits on */

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
      lab.innerHTML = dpRangeText(v.from, v.to, lab.getAttribute("data-ph") || "اختر المدى");
      lab.classList.toggle("is-ph", !v.from);
    } else {
      lab.innerHTML = v.from ? '<span class="m-n">' + formatArabicDate(v.from) + "</span>"
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
    var h = '<div class="m-dp__h">' +
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
      h += '<button type="button" class="m-dp__d' + (c.inMonth ? "" : " is-out") +
        (on ? " is-on" : "") + (mid ? " is-mid" : "") + (c.iso === dpToday() ? " is-today" : "") +
        '" role="gridcell" data-dp-day="' + c.iso + '" tabindex="' + (c.iso === dpFocus ? "0" : "-1") + '"' +
        (allowed ? "" : " disabled") + ' aria-selected="' + (on ? "true" : "false") + '"' +
        ' aria-label="' + esc(formatArabicDate(c.iso)) + '"><span class="m-n">' + fmtN(c.day) + "</span></button>";
    });
    h += "</div>";
    h += '<div class="m-dp__f">' +
      '<button type="button" class="m-btn m-btn--quiet" data-dp-today="1">اليوم</button>' +
      ((range ? v.from || v.to : v.from)
        ? '<button type="button" class="m-btn m-btn--quiet" data-dp-clear="1">مسح</button>' : "") +
      "</div>";
    p.innerHTML = h;
  };

  var dpClose = function () {
    if (!dpOpen) return;
    var g = dpOpen, p = g.querySelector(".m-dp__p"), t = g.querySelector(".m-dp__t");
    p.hidden = true; p.innerHTML = "";
    t.setAttribute("aria-expanded", "false");
    dpOpen = null;
    if (t) { try { t.focus({ preventScroll: true }); } catch (e) {} }
  };
  var dpOpenIt = function (g) {
    if (dpOpen === g) return;
    dpClose();
    var v = dpVal(g), anchor = parseISODate(v.from) || parseISODate(dpToday());
    dpView = { y: anchor.getFullYear(), m: anchor.getMonth() };
    dpFocus = v.from || dpToday();
    dpOpen = g;
    var p = g.querySelector(".m-dp__p");
    p.hidden = false;
    g.querySelector(".m-dp__t").setAttribute("aria-expanded", "true");
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
    var r = pickRange(v.from, v.to, iso);
    dpSet(g, r.from, r.to);
    dpLabel(g);
    /* A range closes only once it HAS both ends; the first click leaves the calendar open for the
       second, which is how the reference behaves. */
    if (r.from && r.to) dpClose(); else { dpFocus = iso; dpPaint(g); }
  };

  document.addEventListener("click", function (e) {
    var t = e.target;
    var trig = t && t.closest ? t.closest(".m-dp__t") : null;
    if (trig) { var g0 = trig.closest(".m-dp"); if (dpOpen === g0) dpClose(); else dpOpenIt(g0); return; }
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
    if (t.closest("[data-dp-clear]")) { dpSet(dpOpen, "", ""); dpLabel(dpOpen); dpClose(); return; }
    /* A click inside the popover's own comboboxes is theirs, not a dismissal. */
    if (!t.closest(".m-dp")) dpClose();
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
      e.preventDefault(); dpOpenIt(trig.closest(".m-dp")); return;
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
  document.addEventListener("focusin", function () {
    if (dpOpen && !document.body.contains(dpOpen)) dpOpen = null;
  });
}
`;
