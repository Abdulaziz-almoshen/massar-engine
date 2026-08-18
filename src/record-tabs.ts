// record-tabs.ts — Frappe's tabbed record shell, applied to #customer/<phone>.
//
// WHY A POST-RENDER ENHANCER RATHER THAN A REWRITE. vCustomer is 216 lines inside dashboard.ts's
// template literal, and ADR-0001 forbids range edits there — a deleted helper is invisible to tsc
// and ships a blank page. So instead of restructuring that function, this reads the DOM it already
// produced and re-parents the cards into tab panels. The markup, the copy, the provenance marks and
// every handler inside those cards are untouched; only their containers change.
//
// THE SHAPE, from Frappe's Lead.vue: a pinned side rail carrying the editable field panel, and a
// TABBED main pane for everything else. That is what keeps its record to one screen. Massar's was a
// 2077px single column: rail 1359px beside main 1113px, everything expanded at once.
//
// Which card goes where is decided by what it IS, not by its position: ملف العميل is the editable
// panel with provenance, so it stays pinned; the rest become tabs in DOM order.

export const RECORD_TABS_CSS = `
  .rtabs { display:flex; gap:22px; border-bottom:1px solid #EDEDED; margin-bottom:14px; flex-wrap:wrap; }
  .rtabs button { font-family:inherit; font-size:13px; font-weight:500; color:#7C7C7C; background:none;
    border:none; border-bottom:2px solid transparent; padding:0 0 10px; cursor:pointer; white-space:nowrap; }
  .rtabs button.on { color:#1F7A73; border-bottom-color:#1F7A73; }
  .rtabs button:focus-visible { outline:2px solid #1F7A73; outline-offset:2px; }
  /* the tabbed card drops its own frame — the tab bar already bounds it */
  .rpanel > .card { margin:0; border:0; padding:0; }
  .rpanel > .card > h3, .rpanel > .card > div > h3 { display:none; }
`;

export const RECORD_TABS_JS = `
/* ============================ record-tabs (client) ============================ */
var recTab = 0;   /* survives the 5s poll's re-render; reset when the record changes */
var recFor = "";

/* Runs after render() has written #body. Idempotent: it marks the container it has already
   processed, so a repaint does not nest tab bars inside tab bars. */
function recApplyTabs() {
  var crec = document.querySelector(".crec");
  if (!crec || crec.getAttribute("data-rtabs") === "1") return;
  var main = crec.querySelector(".crecmain");
  if (!main) return;

  var ph = (location.hash || "").split("/")[1] || "";
  var fresh = ph !== recFor;
  if (fresh) { recFor = ph; recTab = 0; }

  /* Cards that become tabs: everything in the main column, plus any card in the rail that is NOT
     the editable field panel. The field panel is identified by the prop editors it contains, never
     by index — a positional rule would silently re-parent the wrong card the moment vCustomer's
     order changes. */
  var pinned = null, panels = [];
  [].slice.call(crec.children).forEach(function (el) {
    if (el === main) return;
    if (!pinned && (el.querySelector("[data-prop]") || /ملف العميل/.test(el.textContent || ""))) pinned = el;
    else panels.push(el);
  });
  [].slice.call(main.children).forEach(function (el) { panels.push(el); });
  if (!panels.length) return;

  var title = function (el) {
    var h = el.querySelector("h3");
    var t = h ? (h.innerText || "").trim() : "";
    return t || "تفاصيل";
  };

  /* Default to the conversation: an operator opens a customer record to read what was said, not to
     read the account panel. Only on a FRESH record — a tab chosen by hand survives the 5s poll. */
  if (fresh) {
    for (var t = 0; t < panels.length; t++) {
      if (/سجل التفاعل|المحادثة/.test(title(panels[t]))) { recTab = t; break; }
    }
  }

  var bar = document.createElement("div");
  bar.className = "rtabs";
  panels.forEach(function (el, i) {
    var b = document.createElement("button");
    b.type = "button";
    b.textContent = title(el);
    b.setAttribute("role", "tab");
    b.setAttribute("aria-selected", String(i === recTab));
    if (i === recTab) b.className = "on";
    b.onclick = function () { recTab = i; recPaint(main, panels, bar); };
    bar.appendChild(b);
  });

  main.innerHTML = "";
  main.appendChild(bar);
  var host = document.createElement("div");
  host.className = "rpanel";
  main.appendChild(host);
  panels.forEach(function (el) { host.appendChild(el); });
  recPaint(main, panels, bar);
  crec.setAttribute("data-rtabs", "1");
}

function recPaint(main, panels, bar) {
  if (recTab >= panels.length) recTab = 0;
  panels.forEach(function (el, i) { el.style.display = i === recTab ? "" : "none"; });
  [].slice.call(bar.children).forEach(function (b, i) {
    b.className = i === recTab ? "on" : "";
    b.setAttribute("aria-selected", String(i === recTab));
  });
}
/* ========================= end record-tabs (client) ========================= */
`;
