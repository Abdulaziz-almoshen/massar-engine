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
  /* EXACT-1: tab list min-height 45px, gap-7.5 = 30px, px-5 */
  .rtabs { display:flex; gap:30px; min-height:45px; align-items:center; padding-inline:20px;
    border-bottom:1px solid #EDEDED; margin-bottom:14px; flex-wrap:wrap; }
  .rtabs button { font-family:inherit; font-size:13px; font-weight:500; color:#7C7C7C; background:none;
    border:none; border-bottom:2px solid transparent; padding:0 0 10px; cursor:pointer; white-space:nowrap; }
  .rtabs button.on { color:#1F7A73; border-bottom-color:#1F7A73; }
  .rtabs button:focus-visible { outline:2px solid #1F7A73; outline-offset:2px; }
  /* the tabbed card drops its own frame — the tab bar already bounds it */
  .rpanel > .card { margin:0; border:0; padding:0; }
  .rpanel > .card > h3, .rpanel > .card > div > h3 { display:none; }

  /* conversation tab — the transcript inline, not in a slide-over.
     A chat is read in a NARROW column. The pane is ~1100px wide here, so an unconstrained bubble
     ran 800px per line — three times a comfortable measure and genuinely hard to read. The thread
     is capped at 640px and sits on a wallpaper, the way every messaging client does it. */
  .rconv { display:flex; flex-direction:column; gap:8px; max-height:560px; overflow-y:auto;
    padding:16px; background:#F8F8F8; border:1px solid #EDEDED; border-radius:10px; }
  .rconv .b { max-width:min(78%, 460px); padding:8px 11px; border-radius:10px; font-size:13.5px;
    line-height:1.75; white-space:pre-wrap; word-break:break-word; position:relative;
    box-shadow:0 1px 1px rgba(0,0,0,.04); }
  /* Arabic WhatsApp: OUR outgoing sits at the end (left) in green, THEIR incoming at the start
     (right) in white. Both were inverted before — the customer's words were green on the left. */
  .rconv .b.ag { align-self:flex-end;   background:#DCF8C6; color:#171717; border-end-end-radius:3px; }
  .rconv .b.cu { align-self:flex-start; background:#fff;    color:#171717; border:1px solid #EDEDED;
    border-end-start-radius:3px; }
  .rconv .b.sy { align-self:center; background:transparent; border:0; color:#7C7C7C; font-size:12px;
    box-shadow:none; text-align:center; max-width:80%; }
  /* no min-width: «نعم» should be a small bubble, not a 150px box with the word pushed to one edge */
  .rconv .t { font-size:10.5px; color:#8a8a8a; margin-top:3px; text-align:end; }
  .rconv .b.sy .t { display:none; }

  /* Frappe's side panel sections collapse. The rail was 856px beside a 456px main. */
  .rsec > h3, .rsec > div > h3 { cursor:pointer; user-select:none; }
  .rsec.shut > *:not(h3):not(.rsechd) { display:none; }
  .rsechd { display:flex; align-items:center; gap:8px; cursor:pointer; user-select:none;
    font-size:13px; font-weight:600; color:#171717; }
  .rsechd .cv { margin-inline-start:auto; color:#C7C7C7; font-size:12px; transition:transform .12s; }
  .rsec.shut .rsechd .cv { transform:rotate(-90deg); }

  /* tasks + notes */
  .rtask { display:flex; align-items:flex-start; gap:10px; padding:10px 0; border-top:1px solid #EDEDED; }
  .rtask:first-of-type { border-top:0; }
  .rtask .cb { width:16px; height:16px; accent-color:#1F7A73; margin-top:2px; flex:none; cursor:pointer; }
  .rtask .ti { font-size:14px; font-weight:450; color:#171717; }
  .rtask.done .ti { color:#999999; text-decoration:line-through; }
  .rtask .mt { font-size:12px; color:#7C7C7C; margin-top:3px; display:flex; gap:10px; flex-wrap:wrap; }
  .rnote { border:1px solid #EDEDED; border-radius:10px; padding:12px 14px; margin-bottom:10px; }
  .rnote .nt { font-size:14px; font-weight:500; color:#171717; }
  .rnote .nc { font-size:13px; color:#525252; line-height:1.8; margin-top:5px; white-space:pre-wrap; }
  .rnote .nm { font-size:12px; color:#999999; margin-top:6px; }
  .radd { display:flex; gap:8px; flex-wrap:wrap; align-items:center; margin-bottom:14px; }
  .radd input, .radd select { font-family:inherit; font-size:13px; height:32px; border:1px solid #EDEDED;
    border-radius:6px; padding:0 10px; background:#fff; color:#171717; }
  .radd input { flex:1; min-width:180px; }
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
  /* Tasks and Notes are real entities now (tasks/notes tables), so these tabs are backed by rows
     rather than decoration. They always appear — unlike المحادثة, an EMPTY task list is a
     meaningful state that the operator acts on by adding one. */
  panels.push(recEntityPanel("tasks"), recEntityPanel("notes"));
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

/* A tasks or notes tab: a heading, an add row, and a list that loads from the API. Rendered
   immediately with a loading line so the tab never appears blank while the fetch is in flight. */
function recEntityPanel(kind) {
  var wrap = document.createElement("div");
  wrap.className = "card";
  var h = document.createElement("h3");
  h.textContent = kind === "tasks" ? "المهام" : "الملاحظات";
  wrap.appendChild(h);

  var add = document.createElement("div");
  add.className = "radd";
  var inp = document.createElement("input");
  inp.placeholder = kind === "tasks" ? "مهمة جديدة…" : "ملاحظة جديدة…";
  add.appendChild(inp);
  var pri = null;
  if (kind === "tasks") {
    pri = document.createElement("select");
    [["", "الأولوية"], ["high", "عالية"], ["medium", "متوسطة"], ["low", "منخفضة"]].forEach(function (o) {
      var op = document.createElement("option"); op.value = o[0]; op.textContent = o[1]; pri.appendChild(op);
    });
    add.appendChild(pri);
  }
  var btn = document.createElement("button");
  btn.className = "btn";
  btn.style.cssText = "color:#fff;background:#1F7A73;";
  btn.textContent = "إضافة";
  add.appendChild(btn);
  wrap.appendChild(add);

  var list = document.createElement("div");
  list.setAttribute("aria-busy", "true");
  list.innerHTML = '<div class="skel-row"><i style="width:16px;"></i><i></i><i></i><i></i><i></i></div>' +
                   '<div class="skel-row"><i style="width:16px;"></i><i></i><i></i><i></i><i></i></div>';
  wrap.appendChild(list);

  var ph = (location.hash || "").split("/")[1] || "";
  var load = function () { recLoadEntities(kind, ph, list); };
  btn.onclick = function () {
    var v = inp.value.trim();
    if (!v) return;
    btn.disabled = true;
    var body = kind === "tasks"
      ? { title: v, priority: pri && pri.value ? pri.value : null, ref_kind: "contact", ref_id: ph }
      : { content: v, ref_kind: "contact", ref_id: ph };
    fetch("/admin/" + kind, { method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": TOKEN },
      body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) {
        btn.disabled = false;
        if (!res.ok) { alertBar("تعذّر الحفظ — " + (res.j && res.j.error ? res.j.error : "أعد المحاولة"), true); return; }
        inp.value = ""; load();
      })
      .catch(function () { btn.disabled = false; alertBar("تعذّر الاتصال بالخادم", true); });
  };
  inp.onkeydown = function (e) { if (e.key === "Enter") btn.click(); };
  setTimeout(load, 0);
  return wrap;
}

function recLoadEntities(kind, ph, list) {
  fetch("/admin/" + kind + "?kind=contact&id=" + encodeURIComponent(ph), { headers: { "x-admin-token": TOKEN } })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      var rows = (kind === "tasks" ? j.tasks : j.notes) || [];
      list.innerHTML = "";
      list.removeAttribute("aria-busy");
      if (!rows.length) {
        list.textContent = kind === "tasks" ? "لا مهام على هذا العميل." : "لا ملاحظات على هذا العميل.";
        list.style.color = "#7C7C7C";
        return;
      }
      list.style.color = "";
      rows.forEach(function (r) { list.appendChild(kind === "tasks" ? recTaskRow(r, ph, list) : recNoteRow(r)); });
    })
    .catch(function () { list.textContent = "تعذّر تحميل السجلات."; });
}

var REC_PRI = { high: "عالية", medium: "متوسطة", low: "منخفضة" };
var REC_ST = { backlog: "مؤجلة", todo: "للتنفيذ", in_progress: "قيد التنفيذ", done: "منجزة", canceled: "ملغاة" };

function recTaskRow(t, ph, list) {
  var d = document.createElement("div");
  d.className = "rtask" + (t.status === "done" ? " done" : "");
  var cb = document.createElement("input");
  cb.type = "checkbox"; cb.className = "cb"; cb.checked = t.status === "done";
  cb.setAttribute("aria-label", t.title);
  cb.onchange = function () {
    cb.disabled = true;
    fetch("/admin/tasks/" + t.id, { method: "PATCH",
      headers: { "content-type": "application/json", "x-admin-token": TOKEN },
      body: JSON.stringify({ status: cb.checked ? "done" : "todo" }) })
      .then(function () { recLoadEntities("tasks", ph, list); })
      .catch(function () { cb.disabled = false; alertBar("تعذّر التحديث", true); });
  };
  d.appendChild(cb);
  var body = document.createElement("div");
  body.style.cssText = "min-width:0;flex:1;";
  var ti = document.createElement("div");
  ti.className = "ti"; ti.textContent = t.title;
  body.appendChild(ti);
  var mt = document.createElement("div");
  mt.className = "mt";
  /* absent priority renders «—», never a defaulted "medium" */
  mt.appendChild(recChipEl(REC_ST[t.status] || t.status));
  mt.appendChild(recChipEl(t.priority ? REC_PRI[t.priority] : "—"));
  if (t.due_at) { try { mt.appendChild(recChipEl("تستحق " + fmtD(t.due_at))); } catch (e) {} }
  body.appendChild(mt);
  d.appendChild(body);
  return d;
}
function recChipEl(txt) { var s = document.createElement("span"); s.textContent = txt; return s; }

function recNoteRow(n) {
  var d = document.createElement("div");
  d.className = "rnote";
  if (n.title) { var t = document.createElement("div"); t.className = "nt"; t.textContent = n.title; d.appendChild(t); }
  var c = document.createElement("div"); c.className = "nc"; c.textContent = n.content; d.appendChild(c);
  var m = document.createElement("div"); m.className = "nm";
  try { m.textContent = fmtD(n.created_at); } catch (e) { m.textContent = ""; }
  d.appendChild(m);
  return d;
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
