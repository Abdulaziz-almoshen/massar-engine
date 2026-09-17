// search-field-crm.ts — the one search field every screen's search box is drawn with.
//
// WHY. The founder asked for the Command search from ui.halaska.com on the search inputs
// (2026-09-17). Measured there, not recalled: a pill (24px radius, 53px tall) on a near-white ground
// with a 1px hairline and a soft 16/48 shadow, a 14px magnifier leading, the field itself borderless
// inside it, and a small keyboard chip parked at the far end. Its list filters live and its empty state
// quotes what was typed.
//
// WHAT IS TAKEN AND WHAT IS NOT. The look, the leading magnifier, the chip and the live filtering are
// taken — every one of these boxes already filters its screen as you type, which is the same behaviour.
// The dropdown is NOT: these fields filter a table or a list that is already on the screen below them,
// so a floating result list would repeat what the page is already showing. The one place a palette
// belongs is ⌘K, and this app already has it (palette.ts, «الانتقال السريع»). The reference's chip is
// NOT drawn (founder, 2026-09-17: «remove the / sign in the search») — «/» still focuses the search on
// the screen you are on, it simply no longer advertises itself.
//
// RTL. The magnifier sits at the inline start (the right in Arabic) and the chip at the inline end,
// both with logical properties, so the pill mirrors without a second rule.
//
// (No backticks anywhere below, including in comments: this is one template literal.)

export const SEARCH_FIELD_JS = `
/* o: { id, value, placeholder, label (aria-label), attrs (the screen's own handler and data-*),
   wide (stretch to fill its toolbar cell) }. */
function mSearch(o) {
  var val = o.value === null || o.value === undefined ? "" : String(o.value);
  return '<div class="m-sf' + (o.wide ? " m-sf--wide" : "") + '">' +
    '<svg class="m-sf__i" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
      '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
    '<input class="m-input m-sf__in" id="' + esc(o.id) + '" type="search" value="' + esc(val) + '"' +
      ' placeholder="' + esc(o.placeholder || "") + '" aria-label="' + esc(o.label || o.placeholder || "بحث") + '"' +
      ' autocomplete="off" spellcheck="false"' + (o.attrs || "") + ">" +
    '<button type="button" class="m-sf__x" tabindex="-1" aria-label="امسح البحث" data-sf="clear"' +
      ' aria-controls="' + esc(o.id) + '"' + (val ? "" : " hidden") + ">" +
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 6 12 12M6 18 18 6"/></svg></button>' +
    "</div>";
}

if (!window.__mSf) {
  window.__mSf = 1;
  /* The chip and the clear button swap as the field fills, on every screen, without each screen having
     to re-render its toolbar to keep them right. */
  var mSfSync = function (input) {
    var g = input.closest ? input.closest(".m-sf") : null;
    if (!g) return;
    var has = !!input.value, x = g.querySelector(".m-sf__x");
    if (x) x.hidden = !has;
  };
  document.addEventListener("input", function (e) {
    var t = e.target;
    if (t && t.classList && t.classList.contains("m-sf__in")) mSfSync(t);
  }, true);

  /* Clearing is a search the screen has to run, so it goes out as an ordinary input event rather than
     by calling any screen's own handler. */
  document.addEventListener("click", function (e) {
    var bt = e.target && e.target.closest ? e.target.closest('[data-sf="clear"]') : null;
    if (!bt) return;
    var t = document.getElementById(bt.getAttribute("aria-controls"));
    if (!t) return;
    t.value = "";
    t.dispatchEvent(new Event("input", { bubbles: true }));
    var again = document.getElementById(bt.getAttribute("aria-controls"));
    if (again) { mSfSync(again); try { again.focus({ preventScroll: true }); } catch (x) {} }
  });

  document.addEventListener("keydown", function (e) {
    var t = e.target;
    var typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
    /* Escape empties the field before it does anything else with it; a second Escape leaves it. */
    if (e.key === "Escape" && t && t.classList && t.classList.contains("m-sf__in") && t.value) {
      e.preventDefault(); e.stopPropagation();
      t.value = "";
      t.dispatchEvent(new Event("input", { bubbles: true }));
      var back = document.getElementById(t.id) || t;
      mSfSync(back);
      try { back.focus({ preventScroll: true }); } catch (x) {}
      return;
    }
    /* «/» puts the caret in this screen's search, the way the chip says it will. Never while typing,
       never with a modifier held, and only for a field that is actually on screen. */
    if (e.key !== "/" || typing || e.metaKey || e.ctrlKey || e.altKey) return;
    var all = document.querySelectorAll(".m-sf__in");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.disabled || el.offsetParent === null) continue;
      e.preventDefault();
      try { el.focus({ preventScroll: false }); } catch (x) {}
      try { el.setSelectionRange(el.value.length, el.value.length); } catch (x) {}
      return;
    }
  });
}
`;
