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

  /* conversation tab — the transcript inline, not in a slide-over */
  .rconv { display:flex; flex-direction:column; gap:10px; max-height:560px; overflow-y:auto; padding:2px; }
  .rconv .b { max-width:76%; padding:9px 12px; border-radius:10px; font-size:13px; line-height:1.85;
    white-space:pre-wrap; word-break:break-word; }
  .rconv .b.ag { align-self:flex-start; background:#F3F3F3; color:#171717; }
  .rconv .b.cu { align-self:flex-end; background:#DCF8C6; color:#171717; }
  .rconv .b.sy { align-self:center; background:#fff; border:1px solid #EDEDED; color:#7C7C7C; font-size:12px; }
  .rconv .t { font-size:11px; color:#999999; margin-top:4px; }

  /* Frappe's side panel sections collapse. The rail was 856px beside a 456px main. */
  .rsec > h3, .rsec > div > h3 { cursor:pointer; user-select:none; }
  .rsec.shut > *:not(h3):not(.rsechd) { display:none; }
  .rsechd { display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none;
    font-size:13px; font-weight:600; color:#171717; }
  .rsechd .cv { margin-inline-start:auto; color:#C7C7C7; font-size:12px; transition:transform .12s; }
  .rsec.shut .rsechd .cv { transform:rotate(-90deg); }
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

  /* المحادثة as a real TAB. It was only reachable as a slide-over, which is why the record read as
     a stack of panels with the actual conversation hidden behind a button. Built from the same
     transcript the ledger already holds — no new data, no new endpoint. */
  var conv = recConversationPanel();
  if (conv) panels.unshift(conv);
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
      if (/المحادثة|سجل التفاعل/.test(title(panels[t]))) { recTab = t; break; }
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
  recCollapsibleRail(pinned);
  crec.setAttribute("data-rtabs", "1");
}

/* Renders profileData's transcript as a panel. Returns null when there is nothing to show, so the
   tab simply does not appear rather than appearing empty. */
function recConversationPanel() {
  var c = (typeof profileData !== "undefined" && profileData && profileData.contact) ? profileData.contact : null;
  var tr = c && c.transcript ? c.transcript : [];
  if (!tr.length) return null;
  var wrap = document.createElement("div");
  wrap.className = "card";
  var h = document.createElement("h3");
  h.textContent = "المحادثة";
  wrap.appendChild(h);
  var box = document.createElement("div");
  box.className = "rconv";
  tr.forEach(function (t) {
    var d = document.createElement("div");
    d.className = "b " + (t.role === "agent" ? "ag" : t.role === "customer" ? "cu" : "sy");
    d.textContent = String(t.text || "");
    var tm = document.createElement("div");
    tm.className = "t";
    try { tm.textContent = fmtT(t.ts); } catch (e) { tm.textContent = ""; }
    d.appendChild(tm);
    box.appendChild(d);
  });
  wrap.appendChild(box);
  return wrap;
}

/* Makes each rail card's heading a collapse toggle, the way Frappe's side-panel sections work. */
function recCollapsibleRail(pinned) {
  if (!pinned || pinned.getAttribute("data-rsec") === "1") return;
  var h = pinned.querySelector("h3");
  if (!h) return;
  pinned.classList.add("rsec");
  var hd = document.createElement("div");
  hd.className = "rsechd";
  hd.setAttribute("role", "button");
  hd.setAttribute("tabindex", "0");
  hd.textContent = (h.innerText || "").trim();
  var cv = document.createElement("span");
  cv.className = "cv"; cv.textContent = "⌄";
  hd.appendChild(cv);
  h.style.display = "none";
  pinned.insertBefore(hd, pinned.firstChild);
  var toggle = function () { pinned.classList.toggle("shut"); };
  hd.onclick = toggle;
  hd.onkeydown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } };
  pinned.setAttribute("data-rsec", "1");
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
