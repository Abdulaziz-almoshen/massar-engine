// palette.ts — «الانتقال السريع», the ⌘K command palette.
//
// WHY THIS AND NOT PRETTIER ROWS. The rail holds fourteen destinations; the ledger behind it holds
// three thousand accounts, seventeen hundred conversations and two hundred campaigns. At that size
// the sidebar stops being the way you get anywhere — you do not scan a list for «مجمع النور الطبي»,
// you type it. So the navbar redesign is mostly this: one keystroke that searches every real thing
// in the product, and a rail quiet enough that you rarely need it.
//
// EVERYTHING IT SEARCHES IS ALREADY IN MEMORY — routes, contacts, entities, campaigns, tags. No
// request, no index to go stale, and it stays instant at the simulated scale because it is a linear
// scan over arrays the page already holds.
//
// A client result carries its PIPELINE STAGE, so the fastest way to ask «where is this account?» is
// to type its name — search doubles as a status lookup rather than being a second way to click.
//
// It renders into its own element appended to <body>, not into #body: render() replaces that node's
// innerHTML on every poll, and an overlay living inside it would be destroyed mid-keystroke.

export const PALETTE_CSS = `
  /* the rail's search affordance — advertises the shortcut rather than hiding it */
  .navsearch { display:flex; align-items:center; gap:9px; width:calc(100% - 16px); margin:8px;
    height:32px; padding-inline:10px; font-family:inherit; font-size:13px; color:#7C7C7C;
    background:#fff; border:1px solid #EDEDED; border-radius:6px; cursor:pointer; text-align:start;
    transition:border-color .14s ease, color .14s ease; }
  .navsearch:hover { border-color:#C7C7C7; color:#525252; }
  .navsearch .lbl { flex:1; min-width:0; }
  .navsearch kbd { font-family:inherit; font-size:11px; color:#999999; background:#F3F3F3;
    border-radius:4px; padding:2px 6px; flex:none; letter-spacing:.02em;
    direction:ltr; unicode-bidi:isolate; }
  aside.mini .navsearch .lbl, aside.mini .navsearch kbd { display:none; }
  aside.mini .navsearch { justify-content:center; padding-inline:0; }

  /* «قريبًا»: the four routes that open onto a placeholder do not get to sit at the same weight as
     the ten that work. A menu that offers a door onto «coming soon» is a menu that lies. */
  .nv.soon { color:#999999; }
  .nv.soon .lbl { opacity:.75; }
  .nv.soon::after { content:"قريبًا"; font-size:10.5px; color:#C7C7C7; flex:none; }
  aside.mini .nv.soon::after { display:none; }

  /* ===== the palette ===== */
  .palwrap { position:fixed; inset:0; z-index:200; display:none; }
  .palwrap.on { display:block; }
  .palwrap .scrim { position:absolute; inset:0; background:rgba(23,23,23,.34); }
  .palbox { position:relative; margin:14vh auto 0; width:min(560px, calc(100vw - 32px));
    background:#fff; border:1px solid #E2E2E2; border-radius:14px; overflow:hidden;
    box-shadow:0 24px 64px rgba(16,24,40,.26); display:flex; flex-direction:column; max-height:66vh; }
  @media (prefers-reduced-motion: no-preference) {
    .palwrap.on .palbox { animation: palin .16s ease-out; }
    @keyframes palin { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:none; } }
  }
  .palbox .top { display:flex; align-items:center; gap:10px; padding:14px 16px; border-bottom:1px solid #EDEDED; }
  .palbox input { flex:1; min-width:0; font-family:inherit; font-size:15.5px; color:#171717;
    border:none; outline:none; background:transparent; }
  .palbox input::placeholder { color:#C7C7C7; }
  .palbox .esc { font-size:11px; color:#999999; background:#F3F3F3; border-radius:4px; padding:3px 7px; flex:none; }
  .palbody { overflow-y:auto; padding:6px 0 4px; }
  .palgrp { display:flex; align-items:baseline; gap:7px; padding:9px 16px 4px; }
  .palgrp .g { font-size:11.5px; font-weight:500; color:#999999; }
  .palgrp .n { font-size:11px; color:#C7C7C7; font-variant-numeric:tabular-nums; }
  .palrow { display:flex; align-items:center; gap:11px; padding:8px 16px; cursor:pointer; }
  .palrow.on { background:#F3F3F3; }
  .palrow .ic { width:26px; height:26px; flex:none; border-radius:7px; background:#F3F3F3;
    display:flex; align-items:center; justify-content:center; color:#525252; font-size:12px; font-weight:500; }
  .palrow.on .ic { background:#fff; }
  .palrow .tx { flex:1; min-width:0; }
  .palrow .t1 { display:block; font-size:13.5px; color:#171717; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .palrow .t2 { display:block; font-size:12px; color:#999999; margin-top:2px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .palrow .st { display:flex; align-items:center; gap:6px; flex:none; font-size:12px; color:#7C7C7C; }
  .palrow .st .d { width:6px; height:6px; border-radius:999px; flex:none; }
  .palrow .ph { flex:none; font-size:12px; color:#C7C7C7; direction:ltr; font-variant-numeric:tabular-nums; }
  .palnone { padding:30px 16px; text-align:center; color:#999999; font-size:13px; line-height:1.9; }
  .palfoot { display:flex; align-items:center; gap:14px; padding:9px 16px; border-top:1px solid #EDEDED;
    background:#F8F8F8; font-size:11.5px; color:#999999; }
  .palfoot b { font-weight:450; color:#7C7C7C; background:#fff; border:1px solid #EDEDED;
    border-radius:4px; padding:1px 5px; margin-inline-end:4px; }
`;

export const PALETTE_JS = `
/* ============================== palette (client) ============================== */
var palOn = false, palQ = "", palSel = 0, palRows = [];

/** Match on any word boundary, not only the head: «النور» has to find «مجمع النور الطبي». */
function palHit(hay, q) { return String(hay || "").toLowerCase().indexOf(q) >= 0; }

/** Rank inside a group: a name that STARTS with what you typed is what you meant. */
function palRank(hay, q) { return String(hay || "").toLowerCase().indexOf(q) === 0 ? 0 : 1; }

function palBuild() {
  var q = palQ.trim().toLowerCase();
  var digits = q.replace(/[^0-9]/g, "");
  var groups = [];

  /* الشاشات — every live route. The unbuilt four are excluded here on purpose: a launcher that
     jumps you to «ضمن المرحلة القادمة» is a launcher that wastes a keystroke. */
  var routes = NAV.filter(function (x) { return x.id && !PAL_SOON[x.id]; }).map(function (x) {
    var t = TITLES[x.id] || [x.l, ""];
    var b = (typeof PAL_BADGES === "function" && PAL_BADGES()[x.id]) || null;
    return { kind: "route", id: x.id, label: x.l, sub: t[1] || "", icon: x.i, href: x.id,
             badge: b ? b[0] + " " + b[2] : "" };
  }).filter(function (r) { return !q || palHit(r.label, q) || palHit(r.sub, q); });
  routes.sort(function (a, b) { return palRank(a.label, q) - palRank(b.label, q); });
  if (routes.length) groups.push({ g: "الشاشات", rows: routes.slice(0, q ? 6 : 20) });

  if (q) {
    /* العملاء — name or number, each carrying its pipeline stage. */
    var cs = ((cache && cache.contacts) || []).filter(function (c) {
      return palHit(c.waName, q) || (digits && String(c.phone || "").indexOf(digits) >= 0);
    });
    cs.sort(function (a, b) { return palRank(a.waName, q) - palRank(b.waName, q) || (b.lastEventAt || 0) - (a.lastEventAt || 0); });
    var seen = {};
    var rows = cs.slice(0, 30).map(function (c) {
      seen[c.phone] = 1;
      var sg = stageOf(c);
      return { kind: "contact", label: c.waName || c.phone, phone: c.phone, stage: sg, href: "customer/" + c.phone };
    });
    /* Accounts with no conversation yet are still findable — they are the ones you are about to
       message, and leaving them out would make the palette answer «لا نتائج» for a name that is
       plainly in the book. */
    ((typeof entities !== "undefined" && entities) || []).forEach(function (e) {
      if (rows.length >= 8 || seen[e.phone]) return;
      if (!(palHit(e.name, q) || (digits && String(e.phone || "").indexOf(digits) >= 0))) return;
      rows.push({ kind: "contact", label: e.name, phone: e.phone, stage: stageOfEntity(e), href: "customer/" + e.phone });
    });
    if (rows.length) groups.push({ g: "العملاء", rows: rows.slice(0, 8) });

    var cps = (campaigns || []).filter(function (cp) { return palHit(cp.name, q) || palHit(cp.product, q); });
    cps.sort(function (a, b) { return (b.created_at || 0) - (a.created_at || 0); });
    if (cps.length) groups.push({ g: "الحملات", rows: cps.slice(0, 5).map(function (cp) {
      return { kind: "camp", label: cp.name, sub: (cp.product ? cp.product + " · " : "") + fmtD(cp.created_at), href: "kmon/" + cp.id };
    }) });

    var tg = tagList().filter(function (t) { return palHit(t.name, q); });
    if (tg.length) groups.push({ g: "الوسوم", rows: tg.slice(0, 5).map(function (t) {
      return { kind: "tag", label: t.name, sub: t.count ? fmtN(t.count) + " جهة" : "بلا جهات", tag: t.name, href: "targets" };
    }) });
  }
  return groups;
}

function palPaint() {
  var el = document.getElementById("palwrap");
  if (!el) return;
  el.className = "palwrap" + (palOn ? " on" : "");
  if (!palOn) { palRows = []; return; }
  var groups = palBuild();
  palRows = [];
  groups.forEach(function (g) { g.rows.forEach(function (r) { palRows.push(r); }); });
  if (palSel >= palRows.length) palSel = Math.max(0, palRows.length - 1);

  var i = -1;
  var body = groups.map(function (g) {
    return '<div class="palgrp"><span class="g">' + g.g + '</span><span class="n">' + fmtN(g.rows.length) + "</span></div>" +
      g.rows.map(function (r) {
        i++;
        var lead = '<span class="ic">' + (
          r.kind === "route" ? ic(r.icon, 15, "#525252")
          : r.kind === "camp" ? ic("send", 14, "#7C7C7C")
          : r.kind === "tag" ? "◆"
          : esc(String(r.label || "؟").trim().charAt(0))) + "</span>";
        var tail = "";
        if (r.kind === "contact") {
          tail = '<span class="st"><span class="d" style="background:' + r.stage.dot + ';"></span>' + r.stage.label + "</span>" +
            '<span class="ph">' + esc(r.phone) + "</span>";
        } else if (r.kind === "route") {
          /* The rail's live counts again, here — the launcher is where you look before you decide
             where to go, so «فرص البيع ٤» belongs in it as much as on the row itself. */
          tail = r.badge ? '<span class="st"><span class="d" style="background:#B54708;"></span>' + r.badge + "</span>" : "";
        } else if (r.sub) {
          tail = '<span class="ph">' + esc(clip(r.sub, 34)) + "</span>";
        }
        return '<div class="palrow' + (i === palSel ? " on" : "") + '" data-i="' + i + '" onclick="palPick(' + i + ')">' +
          lead + '<span class="tx"><span class="t1">' + esc(clip(r.label, 46)) + "</span>" +
          (r.kind === "route" && r.sub ? '<span class="t2">' + esc(clip(r.sub, 52)) + "</span>" : "") + "</span>" + tail + "</div>";
      }).join("");
  }).join("");

  if (!body) {
    body = '<div class="palnone">لا شيء يطابق «' + esc(palQ.trim()) + '».<br>' +
      'ابحث باسم جهة، أو رقم جوال، أو اسم حملة، أو وسم.</div>';
  }
  el.querySelector(".palbody").innerHTML = body;
  var on = el.querySelector(".palrow.on");
  if (on && on.scrollIntoView) on.scrollIntoView({ block: "nearest" });
}

window.palOpenBox = function () {
  palOn = true; palQ = ""; palSel = 0;
  palPaint();
  var inp = document.getElementById("palq");
  if (inp) { inp.value = ""; inp.focus(); }
};
window.palClose = function () { palOn = false; palPaint(); };
window.palInput = function (el) { palQ = el.value; palSel = 0; palPaint(); };
window.palPick = function (i) {
  var r = palRows[i];
  if (!r) return;
  /* A tag result lands you on جهات الاستهداف WITH that tag applied — jumping to the screen and
     leaving you to re-pick the tag you just typed would be a launcher that forgets its own query. */
  if (r.kind === "tag" && typeof tgtSetProd === "function") tgtProd = r.tag;
  palClose();
  location.hash = r.href;
};

/* One listener, installed once. ⌘K and Ctrl+K toggle; Esc closes; the arrows move a selection that
   is clamped to what is actually on screen, so a stale index can never open the wrong record. */
function palInstall() {
  if (window.__palReady) return;
  window.__palReady = true;
  /* Name the key the reader actually has. Printing ⌘ to someone on Windows is a shortcut that does
     not exist on their keyboard. */
  var mac = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || "");
  var hint = document.querySelector(".navsearch kbd");
  if (hint) hint.textContent = mac ? "⌘K" : "Ctrl K";
  var host = document.createElement("div");
  host.id = "palwrap";
  host.className = "palwrap";
  host.innerHTML =
    '<div class="scrim" onclick="palClose()"></div>' +
    '<div class="palbox" role="dialog" aria-label="الانتقال السريع" aria-modal="true">' +
    '<div class="top">' + ic("search", 18, "#999999") +
      '<input id="palq" autocomplete="off" spellcheck="false" placeholder="اذهب إلى… شاشة، عميل، رقم، حملة، وسم" oninput="palInput(this)">' +
      '<span class="esc">esc</span></div>' +
    '<div class="palbody"></div>' +
    '<div class="palfoot"><span><b>↑↓</b>تنقّل</span><span><b>↵</b>فتح</span>' +
      '<span style="flex:1"></span><span>الانتقال السريع</span></div></div>';
  document.body.appendChild(host);

  document.addEventListener("keydown", function (e) {
    var k = (e.key || "").toLowerCase();
    if ((e.metaKey || e.ctrlKey) && k === "k") { e.preventDefault(); palOn ? palClose() : palOpenBox(); return; }
    if (!palOn) return;
    if (k === "escape") { e.preventDefault(); palClose(); return; }
    if (k === "arrowdown") { e.preventDefault(); if (palRows.length) { palSel = (palSel + 1) % palRows.length; palPaint(); } return; }
    if (k === "arrowup") { e.preventDefault(); if (palRows.length) { palSel = (palSel - 1 + palRows.length) % palRows.length; palPaint(); } return; }
    if (k === "enter") { e.preventDefault(); palPick(palSel); return; }
  });
}
/* ============================ end palette (client) ============================ */
`;
