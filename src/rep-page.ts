// rep-page.ts — «ما يستحق اتصالك اليوم», the rep's own surface.
//
// A SEPARATE PAGE, not a tab in the admin dashboard, and that is a security decision rather than a
// layout one. /dashboard bootstraps the admin token into origin-wide localStorage; a rep screen on
// that origin would inherit the same blast radius from any future XSS there — which is not
// hypothetical, one was found and fixed on this codebase today. This page talks only to /rep/*,
// stores only the rep's own token, and has no route that can send a WhatsApp message.
//
// Phone-first: one column, 44px targets, no hover affordances, no table. A rep uses this standing
// in a clinic corridor between calls.
//
// NOT a template literal with interpolation — it is one static string, so the backtick hazard that
// bit dashboard.ts and three *-crm.ts modules cannot apply here.

export const REP_PAGE_HTML: string = `<!doctype html>
<html lang="ar" dir="rtl"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>ما يستحق اتصالك اليوم</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@450;600;700&display=swap" rel="stylesheet">
<style>
  /* The rep page is a SEPARATE document, so it carries its own copy of the tokens. It had drifted
     to pre-rebrand names (--teal, --strip, --line2) pointing at post-rebrand values. Now it uses
     the DESIGN.md 2 names, with the three old names kept as aliases so existing var() calls in
     this file keep resolving. A second token vocabulary is how two surfaces of one product start
     looking like two products. */
  :root{ --paper:#FFFFFF; --canvas:#F7F6FC; --surface:#F0EEF9; --surface-2:#E9E6F4;
         --line:#D6D1E8; --line-soft:#EFEDF7;
         --ink:#16151F; --ink-2:#35333F; --muted:#6B6880;
         --accent:#6C5CE7; --accent-deep:#4B3FBF; --accent-press:#5A4BD6;
         --accent-mark:#7A6BEE; --accent-tint:#EDEAFD; --accent-wash:#F4F2FD;
         --grad:linear-gradient(270deg,#4B3FBF,#6C5CE7);
         --s-issued:#1E9E63; --s-issued-soft:#E4F5EC; --s-issued-text:#12633F;
         --s-attn-mark:#B37F00; --s-attn-soft:#FFF5D6; --s-attn-text:#7A5600;
         --s-fail:#D9534F; --s-fail-soft:#FBE7E6; --s-fail-text:#8E2A27;
         --s-off-mark:#7F8595; --s-off-soft:#EFEEF5; --s-off-text:#4A5560;
         --r-sm:10px; --r-md:14px; --r-lg:20px; --r-xl:26px; --r-pill:999px;
         --sh-0:0 1px 2px rgba(41,35,80,.05);
         --sh-1:0 2px 8px rgba(41,35,80,.06);
         --sh-2:0 8px 24px rgba(41,35,80,.08);
         --s1:4px; --s2:8px; --s3:16px; --s4:24px; --s5:32px;
         --z-base:0; --z-sticky:100; --z-dropdown:200; --z-overlay:300;
         --z-modal:310; --z-toast:400; --z-tooltip:500;
         --fast:150ms; --base:220ms; --slow:320ms; --ease:cubic-bezier(.2,.8,.2,1);
         /* aliases, pre-rebrand names still referenced in this file */
         --blue:#6C5CE7; --ink2:#35333F; --line2:#EFEDF7; --strip:#F7F6FC;
         --card:#FFFFFF; --teal:#6C5CE7; }
  *{box-sizing:border-box}
  /* SAFE AREA. viewport-fit=cover has been set since this page shipped and nothing consumed the
     insets, so on a notched iPhone the pending bar sat under the home indicator and the header
     under the status bar. env() with a 0px fallback costs nothing on a device without a notch. */
  body{margin:0;background:var(--canvas);color:var(--ink);
       font-family:Cairo,system-ui,-apple-system,"Segoe UI",sans-serif;font-weight:450;font-size:14px;
       -webkit-text-size-adjust:100%;
       padding-inline-start:env(safe-area-inset-left,0px);
       padding-inline-end:env(safe-area-inset-right,0px)}
  header{position:sticky;inset-block-start:0;background:var(--canvas);border-block-end:none;
         padding:calc(14px + env(safe-area-inset-top,0px)) 16px 12px;
         display:flex;align-items:center;gap:10px;z-index:var(--z-sticky)}
  header .t{font-size:18px;font-weight:700;letter-spacing:0}
  header .who{font-size:12px;color:var(--muted);margin-inline-start:auto;
              background:var(--paper);border-radius:var(--r-pill);padding:7px 13px;
              box-shadow:var(--sh-0);font-weight:600}

  /* The one gradient surface. On a phone the leading figure is not money, it is HOW MANY CALLS
     ARE OWED — that is the number the rep acts on, and the money supports it. */
  .lead{margin:0 16px 16px;background:var(--grad);color:var(--paper);
        border-radius:var(--r-lg);padding:18px 18px 16px;box-shadow:var(--sh-2)}
  .lead .k{font-size:12px;font-weight:600;opacity:.88}
  .lead .v{font-size:40px;font-weight:700;line-height:1.1;margin-block-start:4px;
           font-variant-numeric:tabular-nums;display:flex;align-items:baseline;gap:8px}
  .lead .v small{font-size:16px;font-weight:600;opacity:.85}
  .lead .s{font-size:14px;font-weight:500;opacity:.9;margin-block-start:4px}

  main{padding:0 16px calc(96px + env(safe-area-inset-bottom,0px))}
  /* A rep queue is short and every row is a thing you act on, so DESIGN.md 3.6 (amended) puts it
     under the 12-row ceiling where a row may be a card. At this width a table is not an option
     anyway. */
  .row{background:var(--paper);border-block-start:none;border-radius:var(--r-lg);
       box-shadow:var(--sh-0);padding:16px;margin-block-end:12px}
  .row:first-child{border-block-start:0}
  .acct{font-weight:700;font-size:16px;line-height:1.35}
  .meta{font-size:12px;color:var(--muted);margin-block-start:4px}
  /* colour + dot + word, never colour alone (DESIGN.md 3.0b) */
  .pill{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;
        border-radius:var(--r-pill);padding:4px 11px;font-size:12px;font-weight:700;
        margin-block-start:8px;background:var(--paper)}
  .pill i{width:7px;height:7px;border-radius:var(--r-pill);flex:none}
  .pill.cold{color:var(--s-fail-text);box-shadow:inset 0 0 0 1.5px var(--s-fail)}
  .pill.cold i{background:var(--s-fail)}
  .pill.warm{color:var(--s-attn-text);box-shadow:inset 0 0 0 1.5px var(--s-attn-mark)}
  .pill.warm i{background:var(--s-attn-mark)}
  .pill.fresh{color:var(--s-issued-text);box-shadow:inset 0 0 0 1.5px var(--s-issued)}
  .pill.fresh i{background:var(--s-issued)}
  .pill.none{color:var(--s-off-text);box-shadow:inset 0 0 0 1.5px var(--s-off-mark)}
  .pill.none i{background:var(--s-off-mark)}
  .lines{margin-block-start:12px;display:flex;flex-direction:column;gap:2px;
         background:var(--surface);border-radius:var(--r-md);padding:10px 12px}
  .line{display:flex;align-items:center;gap:8px;font-size:14px;color:var(--ink2);padding-block:4px}
  .dot{width:7px;height:7px;border-radius:999px;background:var(--accent-mark);flex:none}
  .val{margin-inline-start:auto;font-variant-numeric:tabular-nums;white-space:nowrap;
       color:var(--ink);font-weight:700}
  .val.none{color:var(--muted);font-weight:500;font-size:12px}
  .acts{margin-block-start:14px;display:flex;gap:10px;flex-wrap:wrap}
  .acts a{text-decoration:none;flex:1}
  .acts button{width:100%}
  button{font-family:inherit;font-weight:600;font-size:14px;border-radius:var(--r-pill);cursor:pointer;
         min-height:48px;padding-inline:18px;border:none;background:var(--surface);color:var(--ink);
         transition:background var(--fast) var(--ease)}
  button.primary{background:var(--accent);color:#fff;flex:1}
  button.primary:active{background:var(--accent-press)}
  /* A control whose ONLY signal of unavailability is being dimmed violates DESIGN.md 3.0b, so a
     disabled button here also loses its fill and says so through its ground. */
  button:disabled{background:var(--s-off-soft);color:var(--s-off-text);cursor:default;opacity:1}
  button:focus{outline:none}
  /* An accent ring on the accent button measures 1.00:1. It inverts, exactly as DESIGN.md 3.8
     requires, and this page had shipped the invisible version. */
  button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  button.primary:focus-visible{outline:2px solid var(--paper);outline-offset:2px;
                               box-shadow:0 0 0 4px rgba(108,92,231,.35)}
  .empty{padding:56px 22px;text-align:center;color:var(--muted);line-height:1.7;max-width:44ch;
         margin:16px auto;background:var(--paper);border-radius:var(--r-lg);box-shadow:var(--sh-0)}
  .empty b{display:block;color:var(--ink);font-size:18px;font-weight:700;margin-block-end:6px}

  .sheet{position:fixed;inset:0;background:rgba(22,21,31,.4);display:flex;align-items:flex-end;
         z-index:var(--z-overlay)}
  .sheet .in{background:var(--paper);width:100%;
             border-start-start-radius:var(--r-xl);border-start-end-radius:var(--r-xl);
             padding:10px 16px calc(26px + env(safe-area-inset-bottom,0px));
             max-height:82vh;overflow:auto;box-shadow:var(--sh-2)}
  /* The grabber says "this is a sheet you can dismiss" without a word of instruction. */
  .sheet .in::before{content:"";display:block;width:38px;height:4px;border-radius:var(--r-pill);
                     background:var(--surface-2);margin:0 auto 14px}
  .sheet h3{margin:0 0 4px;font-size:18px;font-weight:700}
  .sheet .sub{font-size:12px;color:var(--muted);margin-block-end:14px}
  .opt{width:100%;text-align:start;margin-block-end:10px;min-height:58px;display:block;
       border-radius:var(--r-md);padding:12px 14px;background:var(--surface)}
  .opt:active{background:var(--accent-tint)}
  .opt .k{font-weight:700;color:var(--ink);display:block}
  .opt .r{font-size:12px;color:var(--muted);margin-block-start:3px;display:block}

  /* Not black-bar chrome any more. It is a WAITING state, so it carries the attention channel and
     sits above the home indicator rather than under it. */
  .pending{position:fixed;inset-block-end:calc(12px + env(safe-area-inset-bottom,0px));
           inset-inline:16px;background:var(--s-attn-soft);color:var(--s-attn-text);
           border-radius:var(--r-pill);box-shadow:var(--sh-2);
           padding:13px 18px;font-size:12px;font-weight:700;display:none;text-align:center;
           z-index:var(--z-toast)}
  .pending.on{display:block}
</style></head><body>
<header><span class="t">ما يستحق اتصالك اليوم</span><span class="who" id="who"></span></header>
<main id="main"><div class="empty">…</div></main>
<div class="pending" id="pending"></div>
<script>
var TOKEN = "";
try {
  var qs = new URLSearchParams(location.search);
  if (qs.get("token")) { localStorage.setItem("massar_rep_token", qs.get("token")); history.replaceState({}, "", "/rep"); }
  TOKEN = localStorage.getItem("massar_rep_token") || "";
} catch (e) { TOKEN = ""; }

var AR = ["٠","١","٢","٣","٤","٥","٦","٧","٨","٩"];
// PARITY WITH THE DASHBOARD. This page's fmtN did the digit swap and stopped there, so money
// rendered «٦٠٠٠٠» while the same figure on /dashboard rendered «٦٠٬٠٠٠» — one product, two ways of
// writing a number. toLocaleString("ar-SA") is what dashboard.ts:1092 uses; the manual swap stays
// as the fallback for an engine without the ar-SA data. Nothing here prints a YEAR, which is the
// one case that must NOT be grouped (DESIGN.md 4: «٢٠٢٦» must never become «٢٬٠٢٦»).
function fmtN(n){
  var v = Math.round(Number(n) || 0);
  try {
    var out = v.toLocaleString("ar-SA");
    if (/[٠-٩]/.test(out)) return out;
  } catch (e) {}
  return String(v).replace(/[0-9]/g, function(d){ return AR[+d]; });
}
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
// Arabic counts are FOUR-WAY (مفرد / مثنى / جمع القلة / تمييز), never a numeral glued to a
// singular. Same rule as opps-domain.ts pluralizeArabic, restated here because this page is a
// separate document and cannot import it.
function repPl(n, one, two, few, many){
  n = Number(n) || 0;
  if (n === 1) return one;
  if (n === 2) return two;
  return fmtN(n) + " " + (n >= 3 && n <= 10 ? few : many);
}
function nDay(n){ return repPl(n, "يوم", "يومين", "أيام", "يومًا"); }
// The KPI split: the figure is drawn big and the noun beside it, so the noun must be the TAMYIZ
// form, not the full phrase. Two is the exception — «٢ جهتان» duplicates the count, so the dual
// carries itself and the numeral is dropped.
function nJihaNoun(n){
  n = Number(n) || 0;
  if (n >= 3 && n <= 10) return "جهات";
  return "جهة";
}
function api(path, opts){
  opts = opts || {};
  opts.headers = Object.assign({ "x-rep-token": TOKEN, "Content-Type": "application/json" }, opts.headers || {});
  return fetch(path, opts);
}

// OFFLINE-SAFE TAP. A rep in a clinic basement taps an outcome, the request never leaves, and an
// optimistic UI moves on — losing the call record, which is precisely what the pilot measures. So
// nothing is ever reported as saved until the server confirms it. Unsent taps are queued in
// localStorage with the SAME idempotency key they were created with, so a retry can never
// double-count: the server returns the original row and writes nothing.
var QKEY = "massar_rep_outbox";
function outbox(){ try { return JSON.parse(localStorage.getItem(QKEY) || "[]"); } catch(e){ return []; } }
function setOutbox(q){ try { localStorage.setItem(QKEY, JSON.stringify(q)); } catch(e){} paintPending(); }
function paintPending(){
  var q = outbox(), el = document.getElementById("pending");
  if (!q.length) { el.className = "pending"; el.textContent = ""; return; }
  el.className = "pending on";
  el.textContent = "بانتظار الإرسال: " + fmtN(q.length) + " — تُرسل تلقائيًا عند عودة الاتصال";
}
function newKey(){ return "r-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10); }

async function flush(){
  var q = outbox();
  if (!q.length) return;
  var still = [];
  for (var i = 0; i < q.length; i++) {
    var ok = false;
    try {
      var r = await api("/rep/engagements", { method: "POST", body: JSON.stringify(q[i]) });
      // A 4xx is the server refusing the CONTENT — retrying forever would never help, so it is
      // dropped from the outbox rather than wedging every later tap behind it.
      ok = r.ok || (r.status >= 400 && r.status < 500);
    } catch (e) { ok = false; }
    if (!ok) still.push(q[i]);
  }
  setOutbox(still);
  if (still.length === 0) load();
}
window.addEventListener("online", flush);
setInterval(flush, 20000);

var STATE = { rows: [], sheet: null };

async function load(){
  var main = document.getElementById("main");
  try {
    var r = await api("/rep/queue");
    if (r.status === 401) { main.innerHTML = '<div class="empty"><b>لا صلاحية</b>افتح الرابط الذي وصلك مرة أخرى.</div>'; return; }
    var d = await r.json();
    STATE.rows = d.rows || [];
    document.getElementById("who").textContent = d.rep || "";
    paint();
  } catch (e) {
    main.innerHTML = '<div class="empty"><b>تعذّر التحديث</b>لا اتصال الآن. ما سجّلته محفوظ وسيُرسل تلقائيًا.</div>';
  }
}

function paint(){
  var main = document.getElementById("main");
  if (!STATE.rows.length) {
    // The day-one state, and a real one: a rep whose queue is empty has finished, not broken it.
    main.innerHTML = '<div class="empty"><b>لا شيء ينتظرك الآن</b>' +
      'كل الجهات المفتوحة جرى التواصل معها. حين تُفتح فرصة جديدة أو يردّ عميل، ستظهر هنا.</div>';
    return;
  }
  // The leading figure on a phone is HOW MANY CALLS ARE OWED, not money — that is what the rep
  // acts on. Value supports it, and renders «—» when nothing on the queue is priced, because a
  // total of «٠ ر.س» over unpriced lines is a number nobody wrote (DESIGN.md 4, honest absence).
  var total = 0, priced = 0;
  for (var a = 0; a < STATE.rows.length; a++) {
    for (var b = 0; b < STATE.rows[a].lines.length; b++) {
      var v = Number(STATE.rows[a].lines[b].value) || 0;
      if (v > 0) { total += v; priced++; }
    }
  }
  var nRows = STATE.rows.length;
  var figure = nRows === 2
    ? '<div class="v">جهتان</div>'
    : '<div class="v">' + fmtN(nRows) + '<small>' + nJihaNoun(nRows) + '</small></div>';
  var h = '<div class="lead"><div class="k">تنتظر اتصالك</div>' + figure +
    '<div class="s">' + (priced ? fmtN(total) + " ر.س قيمة مفتوحة" : "لا قيمة مُسعّرة بعد") + '</div></div>';

  for (var i = 0; i < STATE.rows.length; i++) {
    var row = STATE.rows[i];
    var lines = "";
    for (var j = 0; j < row.lines.length; j++) {
      var l = row.lines[j];
      var lv = Number(l.value) || 0;
      lines += '<div class="line"><i class="dot"></i>' + esc(l.product) +
               (lv > 0
                 ? ' <span class="val">' + fmtN(lv) + ' ر.س</span>'
                 : ' <span class="val none">لم تُسعّر</span>') + '</div>';
    }
    // Silence, banded. The pill is colour PLUS a dot PLUS a word, so the state survives greyscale
    // and a colour deficiency (DESIGN.md 3.0b).
    var days = row.lastEngagementAt
      ? Math.floor((Date.now() - row.lastEngagementAt) / 86400000) : null;
    var cls, word, silent;
    if (days === null) { cls = "none"; word = "لم يُسجَّل تواصل"; silent = "لم يُسجَّل تواصل بعد"; }
    else if (days >= 8) { cls = "cold"; word = "صامت"; silent = "آخر تواصل قبل " + nDay(days); }
    else if (days >= 3) { cls = "warm"; word = "يفتر"; silent = "آخر تواصل قبل " + nDay(days); }
    else { cls = "fresh"; word = "تواصل حديث"; silent = "آخر تواصل قبل " + nDay(days); }
    h += '<div class="row"><div class="acct">' + esc(row.account || row.phone) + '</div>' +
         '<div class="meta">' + esc(silent) + (row.owner ? "" : " · غير مُسندة") + '</div>' +
         '<div class="pill ' + cls + '"><i></i>' + esc(word) + '</div>' +
         '<div class="lines">' + lines + '</div>' +
         '<div class="acts">' +
           '<button class="primary" data-open="' + i + '">سجّل النتيجة</button>' +
           '<a href="tel:' + esc(row.phone) + '"><button>اتصال</button></a>' +
         '</div></div>';
  }
  main.innerHTML = h;
}

document.addEventListener("click", async function(e){
  var openBtn = e.target.closest && e.target.closest("[data-open]");
  if (openBtn) { return openSheet(STATE.rows[Number(openBtn.getAttribute("data-open"))]); }
  var pick = e.target.closest && e.target.closest("[data-outcome]");
  if (pick) { return record(pick.getAttribute("data-outcome"), pick.getAttribute("data-opp")); }
  if (e.target.id === "sheetbg" || e.target.id === "sheetclose") { closeSheet(); }
});

async function openSheet(row){
  if (!row || !row.lines.length) return;
  var line = row.lines[0];
  var outcomes = [];
  try {
    var r = await api("/rep/outcomes?stage=" + encodeURIComponent(line.stage));
    outcomes = (await r.json()).outcomes || [];
  } catch (e) { outcomes = []; }
  var opts = "";
  for (var i = 0; i < outcomes.length; i++) {
    var o = outcomes[i];
    opts += '<button class="opt" data-outcome="' + esc(o.key) + '" data-opp="' + esc(line.id) + '">' +
            '<span class="k">' + esc(o.label) + '</span>' +
            '<span class="r">' + esc(o.reason) + (o.dept ? " · " + esc(o.dept) : "") + '</span></button>';
  }
  if (!opts) opts = '<div class="sub">لا نتائج معرّفة لهذه المرحلة.</div>';
  STATE.sheet = { phone: row.phone, oppId: line.id };
  var el = document.createElement("div");
  el.className = "sheet"; el.id = "sheetbg";
  el.innerHTML = '<div class="in"><h3>' + esc(row.account || row.phone) + '</h3>' +
    '<div class="sub">' + esc(line.product) + '</div>' + opts +
    '<button id="sheetclose" style="width:100%;margin-block-start:6px;">إلغاء</button></div>';
  document.body.appendChild(el);
}
function closeSheet(){
  var el = document.getElementById("sheetbg");
  if (el) el.remove();
  STATE.sheet = null;
}

async function record(outcomeKey, oppId){
  if (!STATE.sheet) return;
  var payload = {
    idemKey: newKey(),
    contactPhone: STATE.sheet.phone,
    oppId: Number(oppId),
    kind: "call",
    outcomeKey: outcomeKey,
    occurredAt: Date.now()
  };
  closeSheet();
  try {
    var r = await api("/rep/engagements", { method: "POST", body: JSON.stringify(payload) });
    if (r.ok) { load(); return; }
    if (r.status >= 400 && r.status < 500) {
      var d = await r.json();
      alertLine("لم تُقبل النتيجة: " + (d.error || "خطأ"));
      return;
    }
    throw new Error("server");
  } catch (e) {
    // NOT reported as saved. Queued with its original key and retried; the row stays in the list.
    var q = outbox(); q.push(payload); setOutbox(q);
    alertLine("لا اتصال — حُفظت وستُرسل تلقائيًا");
  }
}
function alertLine(msg){
  var el = document.getElementById("pending");
  el.className = "pending on"; el.textContent = msg;
  setTimeout(paintPending, 3200);
}

paintPending(); flush(); load();
</script></body></html>`;
