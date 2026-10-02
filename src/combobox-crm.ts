// combobox-crm.ts — Select and Combobox, the design system's one dropdown (massar-ds/massar.css).
//
// REBASED 2026-10-02 on coss ui (coss.com/ui), which is on the founder's reference list; the
// halaska pill below was not, and it looked like a second product beside .m-input. Measured values
// are in massar.css. Two modes of one component:
//   SELECT   — a short closed list (≤ 7 rows): a button opens the list; arrows, Enter, Escape.
//   COMBOBOX — a list worth searching (people, departments, anything free): as in coss, you type
//              IN THE FIELD — the value gives way to a caret and the list filters as you type.
// Options are strings, or { v (value), l (label), s (a muted second line), g (group heading) } so a
// field can store an id while it shows a name, and a long list can be grouped (departments under
// their sector).
//
// HISTORY (why the original existed):
//
// WHY. The founder pointed at «المسؤول» on the opportunity record and asked for that component
// (2026-09-17). It had been a plain text box with a datalist: the browser's own dropdown, which on a
// touch device shows nothing at all, has no keyboard behaviour worth the name, and gave no hint that a
// list of owners even existed. The field had «dfgdfgdfgf» in it on the live page.
//
// MEASURED ON THE REFERENCE, not recalled: a 38px pill trigger on a soft grey ground, 16px radius, the
// value (or a muted placeholder) at the start and a chevron at the end; on open the trigger turns white
// and takes a dark border, and a white popup drops below it carrying a «Filter…» box above the list,
// each row 13px, the chosen one on a grey ground with a check at its end.
//
// WHAT MASSAR ADDS. The owner of a deal is not a closed set — a name that is not on the list yet must
// still be enterable, and the old text box allowed it. So a query that matches nothing offers itself as
// a row («استخدام "فلان"») rather than trapping the user inside the list. The value lives in a hidden
// input that carries the screen's own handler, and choosing a row sets it and dispatches change, so the
// save path is the one that was already there.
//
// (No backticks anywhere below, including in comments: this is one template literal.)

export const COMBOBOX_JS = `
/* o: { id (the hidden input's id, and the handle for everything else), value, options (strings, or
   { v, l, s, g }), placeholder, label, attrs (the screen's own handler and data-*), free (a value
   outside the list is allowed; implies search), search (force the mode; default: more than 7 rows),
   empty (what an EMPTY list says), wide, disabled }. */
function mCbNorm(t) {
  if (t !== null && typeof t === "object") return { v: String(t.v == null ? "" : t.v), l: String(t.l == null ? t.v : t.l), s: t.s ? String(t.s) : "", g: t.g ? String(t.g) : "" };
  return { v: String(t), l: String(t), s: "", g: "" };
}
function mCombo(o) {
  var val = o.value === null || o.value === undefined ? "" : String(o.value);
  var opts = (o.options || []).map(mCbNorm);
  var search = o.search === undefined ? (o.free || opts.length > 7) : !!o.search;
  var chosen = opts.filter(function (x) { return x.v === val; })[0];
  var shown = chosen ? chosen.l : val;
  var lastG = null, rows = "";
  opts.forEach(function (x) {
    if (x.g && x.g !== lastG) { rows += '<li class="m-cb__g" role="presentation" data-g="' + esc(x.g) + '">' + esc(x.g) + "</li>"; lastG = x.g; }
    rows += '<li class="m-cb__o' + (x.v === val ? " is-on" : "") + (x.v === "" ? " m-cb__o--none" : "") + '" role="option" tabindex="-1"' +
      ' aria-selected="' + (x.v === val) + '" data-v="' + esc(x.v) + '" data-l="' + esc((x.l + " " + x.s + " " + x.g).toLowerCase()) + '"' +
      (x.g ? ' data-og="' + esc(x.g) + '"' : "") + ">" +
      '<span class="m-cb__ol">' + esc(x.l) + (x.s ? ' <span class="m-cb__s">' + esc(x.s) + "</span>" : "") + "</span>" +
      '<svg class="m-cb__k" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 13 4 4L19 7"/></svg></li>';
  });
  return '<div class="m-cbx' + (search ? " m-cbx--search" : "") + (o.wide ? " m-cbx--wide" : "") + '" data-cb-id="' + esc(o.id) + '"' +
    (o.free ? ' data-cb-free="1"' : "") +
    ' data-cb-empty="' + esc(o.empty || "لا خيارات مسجّلة بعد") + '">' +
    '<input type="hidden" id="' + esc(o.id) + '" value="' + esc(val) + '"' + (o.attrs || "") + ">" +
    '<button type="button" class="m-cb__t" id="' + esc(o.id) + '_t" aria-haspopup="listbox"' +
      (o.disabled ? " disabled" : "") +
      ' aria-expanded="false" aria-controls="' + esc(o.id) + '_p"' +
      ' aria-label="' + esc(o.label || o.placeholder || "اختر") + '">' +
      '<span class="m-cb__v' + (shown ? "" : " is-ph") + '">' + esc(shown || o.placeholder || "اختر…") + "</span>" +
      '<svg class="m-cb__c" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>' +
    "</button>" +
    (search ? '<input class="m-cb__f" type="text" hidden autocomplete="off" spellcheck="false" role="combobox"' +
      ' aria-controls="' + esc(o.id) + '_p" aria-expanded="true" placeholder="' + esc(shown || "ابحث…") + '"' +
      ' aria-label="ابحث في ' + esc(o.label || "الخيارات") + '">' : "") +
    '<div class="m-cb__p" id="' + esc(o.id) + '_p" hidden>' +
      '<ul class="m-cb__l" role="listbox" aria-label="' + esc(o.label || "الخيارات") + '">' + rows + "</ul>" +
      '<div class="m-cb__e" hidden></div>' +
    "</div></div>";
}

if (!window.__mCb) {
  window.__mCb = 1;
  var mCbOpen = null;   /* the open .m-cbx, or null */
  /* THE LAYER. While open, the popup lives in one top-level .ds6 layer on <body>: a popup left
     inside the record was drawn UNDER the record's sticky tab rail (the panel's transform makes a
     stacking context no z-index can leave), and clipped by every overflow on the way up. g.__p keeps
     the popup reachable wherever it currently sits. */
  var mCbLayer = function () {
    var l = document.getElementById("m-cb-layer");
    if (!l) { l = document.createElement("div"); l.id = "m-cb-layer"; l.className = "ds6"; l.setAttribute("dir", document.documentElement.dir || "rtl"); document.body.appendChild(l); }
    return l;
  };
  var mCbP = function (g) { return g.__p || (g.__p = g.querySelector(".m-cb__p")); };
  var mCbOwner = function (el) {
    var p = el && el.closest ? el.closest(".m-cb__p") : null;
    if (p && p.__g) return p.__g;
    return el && el.closest ? el.closest(".m-cbx") : null;
  };

  var mCbRows = function (g) {
    return Array.prototype.filter.call(mCbP(g).querySelectorAll(".m-cb__o"), function (li) { return !li.hidden; });
  };
  var mCbHi = function (g, li) {
    Array.prototype.forEach.call(mCbP(g).querySelectorAll(".m-cb__o"), function (x) { x.classList.remove("is-hi"); });
    var f = g.querySelector(".m-cb__f");
    if (!li) { if (f) f.removeAttribute("aria-activedescendant"); return; }
    li.classList.add("is-hi");
    if (li.scrollIntoView) li.scrollIntoView({ block: "nearest" });
  };
  var mCbClose = function (keepFocus) {
    if (!mCbOpen) return;
    var g = mCbOpen, p = mCbP(g), t = g.querySelector(".m-cb__t"), f = g.querySelector(".m-cb__f");
    p.hidden = true;
    p.removeAttribute("style");
    if (document.body.contains(g)) g.appendChild(p); else if (p.parentNode) p.parentNode.removeChild(p);
    t.setAttribute("aria-expanded", "false");
    if (f) { f.hidden = true; f.value = ""; }
    g.classList.remove("is-searching");
    mCbOpen = null;
    if (t && keepFocus !== false) { try { t.focus({ preventScroll: true }); } catch (e) {} }
  };
  var mCbFilter = function (g) {
    var f = g.querySelector(".m-cb__f");
    var q = f ? (f.value || "").trim() : "";
    var ql = q.toLowerCase();
    var free = g.getAttribute("data-cb-free") === "1";
    var n = 0, exact = false;
    var P = mCbP(g);
    Array.prototype.forEach.call(P.querySelectorAll(".m-cb__o"), function (li) {
      if (li.getAttribute("data-free") === "1") { li.remove(); return; }
      var hit = !ql || (li.getAttribute("data-l") || "").indexOf(ql) >= 0;
      li.hidden = !hit;
      if (hit) n++;
      if (li.getAttribute("data-v") === q) exact = true;
    });
    /* A group heading shows only while one of its rows does, and the first one VISIBLE draws no
       divider above it (the row above it may be filtered away). */
    var firstSeen = false;
    Array.prototype.forEach.call(P.querySelector(".m-cb__l").children, function (el) {
      if (el.classList.contains("m-cb__g")) {
        var name = el.getAttribute("data-g");
        el.hidden = !Array.prototype.some.call(P.querySelectorAll(".m-cb__o"), function (li) { return !li.hidden && li.getAttribute("data-og") === name; });
        el.classList.toggle("is-first", !el.hidden && !firstSeen);
      }
      if (!el.hidden) firstSeen = true;
    });
    /* A name nobody has used before is still a real answer in a free field, so the query itself
       becomes the last row rather than the field refusing it. */
    if (free && q && !exact) {
      var li2 = document.createElement("li");
      li2.className = "m-cb__o m-cb__o--free";
      li2.setAttribute("role", "option");
      li2.setAttribute("tabindex", "-1");
      li2.setAttribute("aria-selected", "false");
      li2.setAttribute("data-v", q);
      li2.setAttribute("data-free", "1");
      li2.textContent = 'استخدام "' + q + '"';
      P.querySelector(".m-cb__l").appendChild(li2);
      n++;
    }
    var empty = P.querySelector(".m-cb__e");
    empty.hidden = n > 0;
    if (n === 0) empty.textContent = q ? ("لا نتائج لـ " + '"' + q + '"') : (g.getAttribute("data-cb-empty") || "لا خيارات مسجّلة بعد");
    mCbHi(g, (q ? mCbRows(g)[0] : null) || P.querySelector(".m-cb__o.is-on:not([hidden])") || mCbRows(g)[0] || null);
  };
  /* THE POPUP ESCAPES ITS CONTAINER. Inside a table wrapper or a card (overflow hidden/auto) an
     absolute popup was cut at the card's edge — measured on «مدير الإدارة» in an editor row. It is
     placed against the viewport instead, under the field, and flips above it when there is no room
     below. It follows the field while the page scrolls. */
  var mCbPlace = function (g) {
    var p = mCbP(g), t = g.querySelector(".m-cb__t");
    if (!p || p.hidden) return;
    var r = t.getBoundingClientRect(), vh = window.innerHeight || 800;
    p.style.position = "fixed";
    p.style.insetInlineStart = "auto"; p.style.insetInlineEnd = "auto"; p.style.right = "auto";
    /* RTL: a popup wider than its field grows toward the inline END, so it stays aligned to the
       field's right edge. */
    var w = Math.max(r.width, 220), rtl = getComputedStyle(g).direction === "rtl";
    p.style.width = w + "px";
    /* fixed is NOT always the viewport: an ancestor with a transform (the record panel has one)
       becomes the containing block, and the popup landed ~350px off on the product record. Put it at
       0,0, read where that actually is, and offset from there. */
    p.style.left = "0px"; p.style.top = "0px";
    var o = p.getBoundingClientRect();
    var x = Math.max(8, Math.min((rtl ? r.right - w : r.left), (window.innerWidth || 1200) - w - 8));
    var h = p.offsetHeight, below = vh - r.bottom - 8, above = r.top - 8;
    var up = h > below && above > below;
    var y = up ? Math.max(8, r.top - 4 - Math.min(h, above)) : r.bottom + 4;
    p.style.left = (x - o.left) + "px";
    p.style.top = (y - o.top) + "px";
    p.style.bottom = "auto";
    var l = p.querySelector(".m-cb__l");
    if (l) l.style.maxHeight = Math.max(120, Math.min(280, (up ? above : below) - 16)) + "px";
  };
  window.addEventListener("scroll", function (e) {
    if (!mCbOpen) return;
    if (e.target && e.target.closest && e.target.closest(".m-cb__p")) return;
    if (!document.body.contains(mCbOpen)) { var po = mCbP(mCbOpen); if (po && po.parentNode) po.parentNode.removeChild(po); mCbOpen = null; return; }
    mCbPlace(mCbOpen);
  }, true);
  window.addEventListener("resize", function () { if (mCbOpen) mCbPlace(mCbOpen); });
  var mCbOpenIt = function (g) {
    if (mCbOpen === g) return;
    mCbClose(false);
    var p = mCbP(g), t = g.querySelector(".m-cb__t"), f = g.querySelector(".m-cb__f");
    if (t.disabled) return;
    p.__g = g;
    mCbLayer().appendChild(p);
    p.hidden = false;
    t.setAttribute("aria-expanded", "true");
    mCbOpen = g;
    if (f) { f.value = ""; f.hidden = false; g.classList.add("is-searching"); }
    mCbFilter(g);
    mCbPlace(g);
    try { (f || t).focus({ preventScroll: true }); } catch (e) {}
  };
  /* Choosing writes to the hidden input and dispatches change on it: the screen's own handler is the
     one that saves. The trigger shows the chosen row's LABEL; the input holds its VALUE. */
  var mCbPick = function (g, li) {
    var id = g.getAttribute("data-cb-id"), inp = document.getElementById(id);
    if (!inp || !li) return;
    var v = li.getAttribute("data-v");
    var lab = (li.querySelector(".m-cb__ol") ? li.querySelector(".m-cb__ol").firstChild.textContent : li.textContent).trim();
    if (li.getAttribute("data-free") === "1") lab = v;
    mCbClose();
    if (inp.value === v) return;
    inp.value = v;
    var vEl = g.querySelector(".m-cb__v");
    if (vEl) { vEl.textContent = lab || v; vEl.classList.toggle("is-ph", !v && !lab); }
    Array.prototype.forEach.call(mCbP(g).querySelectorAll(".m-cb__o"), function (x) {
      var on = x.getAttribute("data-v") === v; x.classList.toggle("is-on", on); x.setAttribute("aria-selected", String(on));
    });
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
  };

  /* A repaint while open (a save, a poll) removes the field; its popup must not linger in the layer. */
  var mCbReap = function () {
    if (mCbOpen && !document.body.contains(mCbOpen)) {
      var p = mCbP(mCbOpen); if (p && p.parentNode) p.parentNode.removeChild(p); mCbOpen = null;
    }
  };
  document.addEventListener("click", function (e) {
    mCbReap();
    var t = e.target;
    var trig = t && t.closest ? t.closest(".m-cb__t") : null;
    if (trig) {
      var g = trig.closest(".m-cbx");
      if (mCbOpen === g) mCbClose(); else mCbOpenIt(g);
      return;
    }
    var row = t && t.closest ? t.closest(".m-cb__o") : null;
    if (row) { mCbPick(mCbOwner(row), row); return; }
    if (mCbOpen && (!t.closest || (!t.closest(".m-cbx") && !t.closest(".m-cb__p")))) mCbClose(false);
  });

  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains("m-cb__f")) mCbFilter(t.closest(".m-cbx"));
  });

  document.addEventListener("keydown", function (e) {
    mCbReap();
    var t = e.target;
    var trig = t && t.closest ? t.closest(".m-cb__t") : null;
    if (trig && !mCbOpen && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault(); mCbOpenIt(trig.closest(".m-cbx")); return;
    }
    if (!mCbOpen) return;
    var g = mCbOpen, rows = mCbRows(g);
    var cur = g.querySelector(".m-cb__o.is-hi");
    var at = rows.indexOf(cur);
    if (e.key === "Escape") return;   /* handled in the capture listener below, before the drawer's */
    if (e.key === "ArrowDown") { e.preventDefault(); mCbHi(g, rows[Math.min(rows.length - 1, at + 1)] || rows[0]); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); mCbHi(g, rows[Math.max(0, at - 1)] || rows[0]); return; }
    /* In the search field Home/End move the caret; in a plain select they move the highlight. */
    if (!g.classList.contains("is-searching") && e.key === "Home") { e.preventDefault(); mCbHi(g, rows[0]); return; }
    if (!g.classList.contains("is-searching") && e.key === "End") { e.preventDefault(); mCbHi(g, rows[rows.length - 1]); return; }
    if (e.key === "Enter" || (e.key === " " && !g.classList.contains("is-searching"))) {
      e.preventDefault(); e.stopPropagation();
      if (cur) mCbPick(g, cur);
      return;
    }
    if (e.key === "Tab") { mCbClose(false); return; }
    /* TYPE-AHEAD in a plain Select (coss / Base UI): letters typed within 600ms jump to the first
       row that starts with them. A Combobox does not need it — the field itself filters. */
    if (!g.classList.contains("is-searching") && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      var now = Date.now();
      g.__ta = (now - (g.__taAt || 0) < 600 ? (g.__ta || "") : "") + e.key.toLowerCase();
      g.__taAt = now;
      var hit = rows.filter(function (li) { return (li.getAttribute("data-l") || "").indexOf(g.__ta) === 0; })[0];
      if (hit) mCbHi(g, hit);
    }
  });
  /* ESCAPE, IN CAPTURE, AND IMMEDIATE. The drawer has its own Escape handler on document, and
     stopPropagation does not stop a second listener on the SAME node — measured: Escape closed the
     popup and the whole record with it. Capture runs before the drawer's listener, and
     stopImmediatePropagation is what actually holds the key. Enter in capture too, for the same
     reason: an editor's «Enter saves» must not fire while a row is being chosen. */
  document.addEventListener("keydown", function (e) {
    if (!mCbOpen) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); mCbClose(); return; }
    if (e.key === "Enter") {
      var g = mCbOpen, cur = g.querySelector(".m-cb__o.is-hi");
      e.preventDefault(); e.stopImmediatePropagation();
      if (cur) mCbPick(g, cur);
    }
  }, true);

  /* A repaint (a save, a poll) removes the open popup from the page; nothing should stay "open". */
  document.addEventListener("focusin", function (e) {
    if (mCbOpen && !document.body.contains(mCbOpen)) {
      var p = mCbP(mCbOpen); if (p && p.parentNode) p.parentNode.removeChild(p); mCbOpen = null;
    }
  });
}
`;
