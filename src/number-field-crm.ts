// number-field-crm.ts — the one number field every numeric input on the dashboard is drawn with.
//
// WHY. The founder asked for the coss ui NumberField (coss.com/ui/particles?tags=input) on every
// numeric input (2026-09-17). Measured there, not recalled: a single control with a − button, the value
// centred in tabular figures, and a + button; ↑/↓ step by one, Shift or PageUp/PageDown by ten, Home/End
// jump to the bounds; the value is cleaned and clamped when committed; the input is type="text" with an
// inputmode, not type="number", so the browser's own spin arrows and its silent rejection of anything
// it cannot parse are gone. The variant chosen is the base one with a label and a range hint; the
// scrub-the-label variants were left out — dragging a label to change a price is a hidden gesture, and in
// a right-to-left layout nobody can guess which way is up.
//
// HOW IT STAYS COMPATIBLE. Twenty fields across eight builders already listen for input and change,
// some inline and some delegated. The buttons and keys therefore never call those handlers: they set the
// value and DISPATCH input (each step) and change (once, when the gesture ends), so every existing handler
// runs exactly as it did when a person typed. Commit rules run in the CAPTURE phase, before the target's
// own onchange reads the value, so a save always receives the cleaned number.
//
// DIRECTION. The control is left-to-right inside an Arabic page: − on the left, + on the right. The
// numbers on this dashboard are western and printed left-to-right, and a number line that grows to the
// left under digits that read to the right is a contradiction the reader has to resolve on every press.
//
// MOTION. Background colour on hover and press only, over --m-out. No scale on press: half of a joined
// control shrinking reads as the control breaking. Holding a button repeats — that is the gesture the
// reference supports and the reason nothing here animates per step.
//
// (No backticks anywhere below, including in comments: this is one template literal.)

export const NUMBER_FIELD_JS = `
/* o: { id, value, min, max, step, mode ("decimal"|"numeric"), attrs (every other attribute of the input,
   verbatim: data-*, handlers, placeholder, aria-invalid, aria-describedby), label (for the buttons'
   names), disabled }. */
function mNum(o) {
  var b = { min: o.min === undefined ? null : o.min, max: o.max === undefined ? null : o.max, step: o.step || 1 };
  var val = o.value === null || o.value === undefined ? "" : String(o.value);
  var can = numberFieldCanStep(val, b);
  var nm = o.label ? " " + o.label : "";
  var btn = function (dir, ok) {
    return '<button type="button" class="m-nf__b" data-nf="' + dir + '" tabindex="-1" aria-controls="' + esc(o.id) + '"' +
      ' aria-label="' + (dir === "inc" ? "زيادة" : "إنقاص") + esc(nm) + '"' + (o.disabled || !ok ? " disabled" : "") + ">" +
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14' + (dir === "inc" ? "M12 5v14" : "") + '"/></svg></button>';
  };
  return '<div class="m-nf" dir="ltr"' +
    (b.min !== null ? ' data-nf-min="' + b.min + '"' : "") + (b.max !== null ? ' data-nf-max="' + b.max + '"' : "") +
    ' data-nf-step="' + b.step + '">' +
    btn("dec", can.dec) +
    '<input class="m-input m-nf__in" id="' + esc(o.id) + '" type="text" inputmode="' + (o.mode || "decimal") + '"' +
    ' autocomplete="off" spellcheck="false" value="' + esc(val) + '"' + (o.disabled ? " disabled" : "") + (o.attrs || "") + ">" +
    btn("inc", can.inc) + "</div>";
}
/* The range, said the way the reference's helper line says it, for fields that have both ends. */
function mNumRange(min, max) {
  return "من " + fmtN(min) + " إلى " + fmtN(max);
}

function mNfBounds(input) {
  var g = input && input.closest ? input.closest(".m-nf") : null;
  if (!g) return null;
  var n = function (k) { var v = g.getAttribute(k); return v === null || v === "" ? null : Number(v); };
  return { min: n("data-nf-min"), max: n("data-nf-max"), step: n("data-nf-step") || 1 };
}
function mNfSync(input) {
  var b = mNfBounds(input); if (!b) return;
  var can = numberFieldCanStep(input.value, b), g = input.closest(".m-nf");
  var dec = g.querySelector('[data-nf="dec"]'), inc = g.querySelector('[data-nf="inc"]');
  if (dec) dec.disabled = !!input.disabled || !can.dec;
  if (inc) inc.disabled = !!input.disabled || !can.inc;
}
function mNfFire(el, type) { el.dispatchEvent(new Event(type, { bubbles: true })); }
/* Set a value the way typing would, so every existing listener sees an ordinary input event. */
function mNfSet(input, v) {
  if (input.value === v) return false;
  input.value = v;
  mNfFire(input, "input");
  return true;
}

if (!window.__mNf) {
  window.__mNf = 1;
  var mNfHold = null;   /* { id, dir, t, moved } — by id, because a repaint can replace the element mid-hold */

  document.addEventListener("focusin", function (e) {
    var t = e.target;
    /* Only a READABLE value is remembered as the one to fall back to. A form that repaints on every
       keystroke re-focuses the new input mid-typing, and remembering «abc» there made «abc» its own
       fallback — measured: it survived Tab. */
    if (t && t.classList && t.classList.contains("m-nf__in") && !isNaN(parseNumberField(t.value))) t.setAttribute("data-nf-last", t.value);
  });

  /* Arabic digits become western as they are typed. Length-preserving, so the caret stays put. */
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains("m-nf__in")) return;
    var n = normalizeNumberDigits(t.value);
    if (n !== t.value) {
      var s = t.selectionStart, en = t.selectionEnd;
      t.value = n;
      try { t.setSelectionRange(s, en); } catch (x) {}
    }
    mNfSync(t);
  }, true);

  /* Commit before the field's own onchange reads it: empty stays empty, unreadable reverts, the rest is
     clamped and cleaned. */
  document.addEventListener("change", function (e) {
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains("m-nf__in")) return;
    var b = mNfBounds(t); if (!b) return;
    var last = t.getAttribute("data-nf-last");
    t.value = commitNumberField(t.value, last === null ? "" : last, b);
    t.setAttribute("data-nf-last", t.value);
    mNfSync(t);
  }, true);

  /* The same commit on leaving the field. A form that repaints on every keystroke replaces the input as
     it is typed into, and a replaced input is never "dirty", so the browser fires no change on blur —
     measured on the new-opportunity sheet, where «abc» and a 250٪ discount survived Tab. Here the value is
     corrected and the correction is announced as an ordinary input and change. A field whose change DID
     fire is already clean by now, so this does nothing to it. */
  document.addEventListener("focusout", function (e) {
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains("m-nf__in")) return;
    var b = mNfBounds(t); if (!b) return;
    var last = t.getAttribute("data-nf-last");
    var v = commitNumberField(t.value, last === null ? "" : last, b);
    if (v === t.value) return;
    t.value = v;
    t.setAttribute("data-nf-last", v);
    mNfFire(t, "input");
    var again = document.getElementById(t.id) || t;
    mNfFire(again, "change");
  }, true);

  document.addEventListener("keydown", function (e) {
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains("m-nf__in") || t.disabled || t.readOnly) return;
    var b = mNfBounds(t); if (!b) return;
    var k = e.key, v = null;
    if (k === "ArrowUp" || k === "ArrowDown") v = stepNumberField(t.value, k === "ArrowUp" ? 1 : -1, b, e.shiftKey ? 10 : 1);
    else if (k === "PageUp" || k === "PageDown") v = stepNumberField(t.value, k === "PageUp" ? 1 : -1, b, 10);
    else if (k === "Home" || k === "End") v = boundNumberField(t.value, k === "Home" ? "min" : "max", b);
    if (v === null) return;
    e.preventDefault();
    if (mNfSet(t, v)) t.setAttribute("data-nf-pending", "1");
  });
  /* One change when the key is released, not one per auto-repeat: a record field saves on change. */
  document.addEventListener("keyup", function (e) {
    var t = e.target;
    if (!t || !t.classList || !t.classList.contains("m-nf__in") || !t.hasAttribute("data-nf-pending")) return;
    if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"].indexOf(e.key) < 0) return;
    t.removeAttribute("data-nf-pending");
    mNfFire(t, "change");
  });

  var mNfStep = function (id, dir) {
    var t = document.getElementById(id); if (!t || t.disabled) return false;
    var b = mNfBounds(t); if (!b) return false;
    return mNfSet(t, stepNumberField(t.value, dir === "inc" ? 1 : -1, b, 1));
  };
  var mNfEnd = function () {
    if (!mNfHold) return;
    clearTimeout(mNfHold.t); clearInterval(mNfHold.i);
    var t = document.getElementById(mNfHold.id), moved = mNfHold.moved;
    mNfHold = null;
    if (t && moved) mNfFire(t, "change");
  };
  /* Press steps once; holding past 400ms repeats every 60ms until release. The input keeps focus, so the
     keyboard and the buttons can be mixed without the caret jumping to a button. */
  document.addEventListener("pointerdown", function (e) {
    var bt = e.target && e.target.closest ? e.target.closest(".m-nf__b") : null;
    if (!bt || bt.disabled || e.button !== 0 || !e.isPrimary) return;
    e.preventDefault();
    var id = bt.getAttribute("aria-controls"), dir = bt.getAttribute("data-nf");
    mNfEnd();
    var moved = mNfStep(id, dir);
    mNfHold = { id: id, dir: dir, moved: moved, i: 0, t: 0 };
    var h = mNfHold;
    h.t = setTimeout(function () {
      h.i = setInterval(function () {
        if (mNfHold !== h) return;
        if (mNfStep(h.id, h.dir)) h.moved = true;
        else mNfEnd();
      }, 60);
    }, 400);
    var inp = document.getElementById(id);
    if (inp && document.activeElement !== inp) { try { inp.focus({ preventScroll: true }); } catch (x) {} }
  });
  document.addEventListener("pointerup", mNfEnd);
  document.addEventListener("pointercancel", mNfEnd);
  window.addEventListener("blur", mNfEnd);
  /* A click that did not come from a pointer (assistive technology activating the button) steps once and
     commits at once; a pointer click was already handled on pointerdown. */
  document.addEventListener("click", function (e) {
    var bt = e.target && e.target.closest ? e.target.closest(".m-nf__b") : null;
    if (!bt || bt.disabled || e.detail !== 0) return;
    var id = bt.getAttribute("aria-controls");
    if (mNfStep(id, bt.getAttribute("data-nf"))) { var t = document.getElementById(id); if (t) mNfFire(t, "change"); }
  });
}
`;
