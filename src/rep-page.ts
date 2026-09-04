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
  :root{ --ink:#171717; --ink2:#525252; --muted:#7C7C7C; --line:#E2E2E2; --line2:#EDEDED;
         --strip:#F8F8F8; --card:#fff; --teal:#1F7A73; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--strip);color:var(--ink);
       font-family:Cairo,system-ui,-apple-system,"Segoe UI",sans-serif;font-weight:450;font-size:15px;
       -webkit-text-size-adjust:100%}
  header{position:sticky;inset-block-start:0;background:var(--card);border-block-end:1px solid var(--line);
         padding:14px 16px;display:flex;align-items:baseline;gap:10px;z-index:5}
  header .t{font-size:17px;font-weight:700}
  header .who{font-size:12.5px;color:var(--muted);margin-inline-start:auto}
  main{padding:0 0 90px}
  .row{background:var(--card);border-block-start:1px solid var(--line2);padding:13px 16px}
  .row:first-child{border-block-start:0}
  .acct{font-weight:600;font-size:15.5px}
  .meta{font-size:12.5px;color:var(--muted);margin-block-start:3px}
  .lines{margin-block-start:9px;display:flex;flex-direction:column;gap:5px}
  .line{display:flex;align-items:center;gap:8px;font-size:13px;color:var(--ink2)}
  .dot{width:7px;height:7px;border-radius:999px;background:var(--muted);flex:none}
  .val{margin-inline-start:auto;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--muted)}
  .acts{margin-block-start:11px;display:flex;gap:8px;flex-wrap:wrap}
  button{font-family:inherit;font-weight:600;font-size:13.5px;border-radius:6px;cursor:pointer;
         min-height:44px;padding-inline:14px;border:1px solid var(--line);background:var(--card);color:var(--ink2)}
  button.primary{background:var(--teal);border-color:var(--teal);color:#fff}
  button:disabled{opacity:.45;cursor:default}
  button:focus{outline:none}
  button:focus-visible{outline:2px solid var(--teal);outline-offset:1px}
  .empty{padding:56px 22px;text-align:center;color:var(--muted);line-height:1.7;max-width:44ch;margin:0 auto}
  .empty b{display:block;color:var(--ink);font-size:16px;margin-block-end:6px}
  .sheet{position:fixed;inset:0;background:rgba(0,0,0,.32);display:flex;align-items:flex-end;z-index:20}
  .sheet .in{background:var(--card);width:100%;border-start-start-radius:10px;border-start-end-radius:10px;
             padding:16px 16px 26px;max-height:82vh;overflow:auto}
  .sheet h3{margin:0 0 4px;font-size:16px}
  .sheet .sub{font-size:12.5px;color:var(--muted);margin-block-end:12px}
  .opt{width:100%;text-align:start;margin-block-end:8px;min-height:52px;display:block}
  .opt .k{font-weight:600;color:var(--ink)}
  .opt .r{font-size:12px;color:var(--muted);margin-block-start:2px}
  .pending{position:fixed;inset-block-end:0;inset-inline:0;background:var(--ink);color:#fff;
           padding:11px 16px;font-size:13px;display:none;z-index:30}
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
function fmtN(n){ return String(Math.round(Number(n)||0)).replace(/[0-9]/g, function(d){ return AR[+d]; }); }
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
  return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
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
  var h = "";
  for (var i = 0; i < STATE.rows.length; i++) {
    var row = STATE.rows[i];
    var lines = "";
    for (var j = 0; j < row.lines.length; j++) {
      var l = row.lines[j];
      lines += '<div class="line"><i class="dot"></i>' + esc(l.product) +
               ' <span class="val">' + fmtN(l.value) + ' ر.س</span></div>';
    }
    var silent = row.lastEngagementAt
      ? "آخر تواصل قبل " + fmtN(Math.floor((Date.now() - row.lastEngagementAt) / 86400000)) + " يومًا"
      : "لم يُسجَّل تواصل بعد";
    h += '<div class="row"><div class="acct">' + esc(row.account || row.phone) + '</div>' +
         '<div class="meta">' + esc(silent) + (row.owner ? "" : " · غير مُسندة") + '</div>' +
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
