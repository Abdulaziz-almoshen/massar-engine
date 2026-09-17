// combobox-crm.ts — the pill combobox, after Select & Combobox at ui.halaska.com.
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
/* o: { id (the hidden input's id, and the handle for everything else), value, options (array of
   strings), placeholder, label, attrs (the screen's own handler and data-*), free (a value outside the
   list is allowed), wide }. */
function mCombo(o) {
  var val = o.value === null || o.value === undefined ? "" : String(o.value);
  var opts = o.options || [];
  return '<div class="m-cb' + (o.wide ? " m-cb--wide" : "") + '" data-cb-id="' + esc(o.id) + '"' +
    (o.free ? ' data-cb-free="1"' : "") + ">" +
    '<input type="hidden" id="' + esc(o.id) + '" value="' + esc(val) + '"' + (o.attrs || "") + ">" +
    '<button type="button" class="m-cb__t" id="' + esc(o.id) + '_t" aria-haspopup="listbox"' +
      ' aria-expanded="false" aria-controls="' + esc(o.id) + '_p"' +
      ' aria-label="' + esc(o.label || o.placeholder || "اختر") + '">' +
      '<span class="m-cb__v' + (val ? "" : " is-ph") + '">' + esc(val || o.placeholder || "اختر…") + "</span>" +
      '<svg class="m-cb__c" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6"/></svg>' +
    "</button>" +
    '<div class="m-cb__p" id="' + esc(o.id) + '_p" hidden>' +
      '<input class="m-input m-cb__f" type="text" autocomplete="off" spellcheck="false"' +
        ' placeholder="تصفية…" aria-label="تصفية الخيارات">' +
      '<ul class="m-cb__l" role="listbox" aria-label="' + esc(o.label || "الخيارات") + '">' +
      opts.map(function (t) {
        return '<li class="m-cb__o' + (t === val ? " is-on" : "") + '" role="option" tabindex="-1"' +
          ' aria-selected="' + (t === val) + '" data-v="' + esc(t) + '">' + esc(t) +
          '<svg class="m-cb__k" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m5 13 4 4L19 7"/></svg></li>';
      }).join("") +
      "</ul>" +
      '<div class="m-cb__e" hidden></div>' +
    "</div></div>";
}

if (!window.__mCb) {
  window.__mCb = 1;
  var mCbOpen = null;   /* the open .m-cb, or null */

  var mCbRows = function (g) {
    return Array.prototype.filter.call(g.querySelectorAll(".m-cb__o"), function (li) { return !li.hidden; });
  };
  var mCbHi = function (g, li) {
    Array.prototype.forEach.call(g.querySelectorAll(".m-cb__o"), function (x) { x.classList.remove("is-hi"); });
    if (!li) return;
    li.classList.add("is-hi");
    if (li.scrollIntoView) li.scrollIntoView({ block: "nearest" });
  };
  var mCbClose = function () {
    if (!mCbOpen) return;
    var g = mCbOpen, p = g.querySelector(".m-cb__p"), t = g.querySelector(".m-cb__t");
    p.hidden = true;
    t.setAttribute("aria-expanded", "false");
    mCbOpen = null;
    if (t) { try { t.focus({ preventScroll: true }); } catch (e) {} }
  };
  var mCbFilter = function (g) {
    var q = (g.querySelector(".m-cb__f").value || "").trim();
    var free = g.getAttribute("data-cb-free") === "1";
    var n = 0;
    Array.prototype.forEach.call(g.querySelectorAll(".m-cb__o"), function (li) {
      if (li.getAttribute("data-free") === "1") { li.remove(); return; }
      var hit = !q || li.getAttribute("data-v").toLowerCase().indexOf(q.toLowerCase()) >= 0;
      li.hidden = !hit;
      if (hit) n++;
    });
    var empty = g.querySelector(".m-cb__e"), list = g.querySelector(".m-cb__l");
    var exact = false;
    Array.prototype.forEach.call(g.querySelectorAll(".m-cb__o"), function (li) {
      if (li.getAttribute("data-v") === q) exact = true;
    });
    /* A name nobody has used before is still a real answer here, so the query itself becomes the last
       row rather than the field refusing it. */
    if (free && q && !exact) {
      var li2 = document.createElement("li");
      li2.className = "m-cb__o m-cb__o--free";
      li2.setAttribute("role", "option");
      li2.setAttribute("tabindex", "-1");
      li2.setAttribute("aria-selected", "false");
      li2.setAttribute("data-v", q);
      li2.setAttribute("data-free", "1");
      li2.textContent = 'استخدام "' + q + '"';
      list.appendChild(li2);
      n++;
    }
    empty.hidden = n > 0;
    if (n === 0) empty.textContent = "لا خيار يطابق " + '"' + q + '"';
    mCbHi(g, mCbRows(g)[0] || null);
  };
  var mCbOpenIt = function (g) {
    if (mCbOpen === g) return;
    mCbClose();
    var p = g.querySelector(".m-cb__p"), t = g.querySelector(".m-cb__t"), f = g.querySelector(".m-cb__f");
    p.hidden = false;
    t.setAttribute("aria-expanded", "true");
    mCbOpen = g;
    f.value = "";
    mCbFilter(g);
    var on = g.querySelector(".m-cb__o.is-on");
    if (on && !on.hidden) mCbHi(g, on);
    try { f.focus({ preventScroll: true }); } catch (e) {}
  };
  /* Choosing writes to the hidden input and dispatches change on it: the screen's own handler is the
     one that saves, exactly as it did when this was a text box. */
  var mCbPick = function (g, v) {
    var id = g.getAttribute("data-cb-id"), inp = document.getElementById(id);
    if (!inp) return;
    mCbClose();
    if (inp.value === v) return;
    inp.value = v;
    inp.dispatchEvent(new Event("input", { bubbles: true }));
    inp.dispatchEvent(new Event("change", { bubbles: true }));
  };

  document.addEventListener("click", function (e) {
    var t = e.target;
    var trig = t && t.closest ? t.closest(".m-cb__t") : null;
    if (trig) {
      var g = trig.closest(".m-cb");
      if (mCbOpen === g) mCbClose(); else mCbOpenIt(g);
      return;
    }
    var row = t && t.closest ? t.closest(".m-cb__o") : null;
    if (row) { mCbPick(row.closest(".m-cb"), row.getAttribute("data-v")); return; }
    if (mCbOpen && (!t.closest || !t.closest(".m-cb"))) mCbClose();
  });

  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains("m-cb__f")) mCbFilter(t.closest(".m-cb"));
  });

  document.addEventListener("keydown", function (e) {
    var t = e.target;
    var trig = t && t.closest ? t.closest(".m-cb__t") : null;
    if (trig && (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ")) {
      e.preventDefault(); mCbOpenIt(trig.closest(".m-cb")); return;
    }
    if (!mCbOpen) return;
    var g = mCbOpen, rows = mCbRows(g);
    var cur = g.querySelector(".m-cb__o.is-hi");
    var at = rows.indexOf(cur);
    if (e.key === "Escape") return;   /* handled in the capture listener below, before the drawer's */
    if (e.key === "ArrowDown") { e.preventDefault(); mCbHi(g, rows[Math.min(rows.length - 1, at + 1)] || rows[0]); return; }
    if (e.key === "ArrowUp") { e.preventDefault(); mCbHi(g, rows[Math.max(0, at - 1)] || rows[0]); return; }
    if (e.key === "Home") { e.preventDefault(); mCbHi(g, rows[0]); return; }
    if (e.key === "End") { e.preventDefault(); mCbHi(g, rows[rows.length - 1]); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      if (cur) mCbPick(g, cur.getAttribute("data-v"));
      return;
    }
    if (e.key === "Tab") mCbClose();
  });
  /* ESCAPE, IN CAPTURE, AND IMMEDIATE. The drawer has its own Escape handler on document, and
     stopPropagation does not stop a second listener on the SAME node — measured: Escape closed the
     popup and the whole record with it. Capture runs before the drawer's listener, and
     stopImmediatePropagation is what actually holds the key. */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape" || !mCbOpen) return;
    e.preventDefault(); e.stopImmediatePropagation();
    mCbClose();
  }, true);

  /* A repaint (a save, a poll) removes the open popup from the page; nothing should stay "open". */
  document.addEventListener("focusin", function (e) {
    if (mCbOpen && !document.body.contains(mCbOpen)) mCbOpen = null;
  });
}
`;
