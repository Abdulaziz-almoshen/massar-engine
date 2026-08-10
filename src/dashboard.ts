// مَسار — live ops dashboard (served at GET /dashboard).
// Single self-contained RTL page per .orbit/skills/massar-design-language.md:
// prototype tokens, chips (seen = read ∪ replied), WhatsApp-style transcript,
// 5s auto-refresh from /admin/state (token via ?token= → localStorage).

export const DASHBOARD_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>مَسار — مركز المتابعة الحي</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'IBM Plex Sans Arabic', sans-serif; background: #eef0f4; color: #13294b; }
  .band { background: linear-gradient(180deg, #2F5F94 0%, #1F4470 100%); color: #fff; padding: 20px 26px; display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .band .logo { width: 40px; height: 40px; border-radius: 11px; background: linear-gradient(135deg, #3FB6B0, #2E8F89); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 20px; color: #1F4470; }
  .band h1 { margin: 0; font-size: 18px; font-weight: 700; }
  .band .sub { font-size: 11.5px; color: #8ea3c0; margin-top: 2px; }
  .live { display: inline-flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 700; color: #3FB6B0; background: rgba(63,182,176,.14); border-radius: 999px; padding: 5px 12px; margin-inline-start: auto; }
  .live .dot { width: 7px; height: 7px; border-radius: 999px; background: #3FB6B0; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 22px 20px 60px; }
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin-bottom: 20px; }
  .kpi { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; padding: 16px; }
  .kpi .k { font-size: 12px; color: #7b8597; margin-bottom: 9px; }
  .kpi .v { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; }
  .sec { font-size: 14.5px; font-weight: 700; margin: 4px 2px 12px; display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .sec .meta { font-size: 11.5px; color: #9aa4b4; font-weight: 500; }
  .card { background: #fff; border: 1px solid #e3e7ee; border-radius: 14px; margin-bottom: 12px; overflow: hidden; }
  .row { display: flex; align-items: center; gap: 13px; padding: 14px 18px; cursor: pointer; flex-wrap: wrap; }
  .row:hover { background: #fafbfd; }
  .avatar { width: 38px; height: 38px; flex: none; border-radius: 10px; background: #13294b; color: #3FB6B0; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 15px; }
  .who { min-width: 140px; }
  .who .n { font-size: 13.5px; font-weight: 700; }
  .who .p { font-size: 11px; color: #9aa4b4; direction: ltr; text-align: right; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; flex: 1; }
  .chip { font-size: 10.5px; font-weight: 700; border-radius: 999px; padding: 3px 10px; white-space: nowrap; }
  .c-grey { background: #eef0f4; color: #6b7280; }
  .c-blue { background: #E3ECF8; color: #2F5F94; }
  .c-teal { background: #DCF1EF; color: #2E7D77; }
  .c-ok   { background: #E6F4EC; color: #1f8a52; }
  .c-warn { background: #FBF2DD; color: #b5810f; }
  .c-bad  { background: #FBE9E9; color: #c43d3d; }
  .last { font-size: 11.5px; color: #7b8597; max-width: 320px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .thread { display: none; background: #E5DDD4; padding: 16px 18px; }
  .card.open .thread { display: block; }
  .bubble { max-width: 78%; border-radius: 11px; padding: 9px 13px; font-size: 12.5px; line-height: 1.9; margin-bottom: 9px; box-shadow: 0 1px 1px rgba(0,0,0,.06); white-space: pre-line; }
  .b-agent { background: #DCF8C6; border-top-left-radius: 3px; margin-inline-start: auto; }
  .b-cust  { background: #fff; border-top-right-radius: 3px; margin-inline-end: auto; }
  .b-sys   { background: rgba(255,255,255,.65); font-size: 11px; color: #5b6678; max-width: 100%; text-align: center; }
  .bt { font-size: 9.5px; color: #7d8b6a; text-align: left; margin-top: 4px; direction: ltr; }
  .empty { border: 1.5px dashed #c9d2df; border-radius: 14px; background: #fff; padding: 44px 20px; text-align: center; color: #7b8597; font-size: 13px; line-height: 2; }
  .empty b { color: #13294b; }
  .gate { max-width: 420px; margin: 80px auto; background: #fff; border: 1px solid #e3e7ee; border-radius: 16px; padding: 28px; text-align: center; }
  .gate input { font-family: inherit; width: 100%; font-size: 13px; border: 1px solid #d8dee8; border-radius: 10px; padding: 11px 13px; margin: 14px 0; direction: ltr; }
  .gate button { font-family: inherit; font-size: 13.5px; font-weight: 700; color: #fff; background: #2E8F89; border: none; border-radius: 10px; padding: 11px 22px; cursor: pointer; }
  .err { color: #c43d3d; font-size: 12px; margin-top: 10px; }
</style>
</head>
<body>
<div class="band">
  <div class="logo">م</div>
  <div>
    <h1>مَسار — مركز المتابعة الحي</h1>
    <div class="sub">محادثات المساعد البائع · الحالة لحظة بلحظة</div>
  </div>
  <span class="live"><span class="dot"></span> مباشر · <span id="upd">—</span></span>
</div>
<div class="wrap" id="app"></div>
<script>
const qs = new URLSearchParams(location.search);
if (qs.get("token")) { localStorage.setItem("massar_admin_token", qs.get("token")); history.replaceState({}, "", "/dashboard"); }
let TOKEN = localStorage.getItem("massar_admin_token") || "";
const app = document.getElementById("app");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const openSet = new Set();

function gate(msg) {
  app.innerHTML = '<div class="gate"><div style="font-size:16px;font-weight:700;">دخول لوحة المتابعة</div>' +
    '<input id="tok" placeholder="admin token" dir="ltr">' +
    '<button onclick="saveTok()">دخول</button>' + (msg ? '<div class="err">' + esc(msg) + '</div>' : '') + '</div>';
}
window.saveTok = () => { TOKEN = document.getElementById("tok").value.trim(); localStorage.setItem("massar_admin_token", TOKEN); refresh(); };

function chip(cls, label) { return '<span class="chip ' + cls + '">' + esc(label) + '</span>'; }
function statusChips(c) {
  const st = c.statusTimes || {};
  const seen = st.read || st.replied;
  let h = "";
  if (st.sent || st.delivered || c.transcript?.some(t => t.role === "agent")) h += chip("c-grey", "أُرسلت");
  if (st.delivered) h += chip("c-blue", "وصلت");
  h += seen ? chip("c-teal", "شوهدت ✓") : "";
  if (st.replied) h += chip("c-teal", "ردّ");
  const oc = { interested: ["c-ok", "مهتم ⭐"], not_interested: ["c-bad", "غير مهتم"], later: ["c-warn", "لاحقًا"], handoff: ["c-blue", "محوّلة لمختص"], opted_out: ["c-bad", "أوقف الرسائل"], closed: ["c-grey", "مغلقة"] }[c.outcome];
  if (oc) h += chip(oc[0], oc[1]);
  (c.tags || []).forEach(t => h += chip(t.level === "hot" ? "c-ok" : "c-warn", "اهتمام: " + t.product));
  if (c.lastError) h += chip("c-bad", "خطأ إرسال");
  return h;
}
function fmtT(ts) { return new Date(ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }); }

function render(d) {
  const cs = d.contacts || [];
  const n = (k) => (d.counters || {})[k] || 0;
  const interested = cs.filter(c => c.outcome === "interested").length;
  let h = '<div class="kpis">' +
    '<div class="kpi"><div class="k">جهات التواصل</div><div class="v">' + cs.length + '</div></div>' +
    '<div class="kpi"><div class="k">رسائل واردة</div><div class="v">' + n("inbound") + '</div></div>' +
    '<div class="kpi"><div class="k">ردود المساعد</div><div class="v">' + n("agent_reply") + '</div></div>' +
    '<div class="kpi"><div class="k">مهتمون</div><div class="v" style="color:#1f8a52">' + interested + '</div></div>' +
    '</div>';
  h += '<div class="sec">المحادثات <span class="meta">اضغط محادثة لعرضها كاملة</span></div>';
  if (!cs.length) {
    h += '<div class="empty">لا محادثات بعد.<br>أرسل رسالة واتساب إلى رقم الساندبوكس <b dir="ltr">+91 78348 11114</b> وستظهر هنا مباشرة.</div>';
  }
  cs.sort((a, b) => (b.lastEventAt || 0) - (a.lastEventAt || 0)).forEach(c => {
    const last = (c.transcript || [])[c.transcript.length - 1];
    const open = openSet.has(c.phone) ? " open" : "";
    h += '<div class="card' + open + '"><div class="row" onclick="tog(\\'' + esc(c.phone) + '\\')">' +
      '<div class="avatar">' + esc((c.waName || "؟").trim().charAt(0)) + '</div>' +
      '<div class="who"><div class="n">' + esc(c.waName || "غير معروف") + '</div><div class="p">+' + esc(c.phone) + '</div></div>' +
      '<div class="chips">' + statusChips(c) + '</div>' +
      (last ? '<div class="last">' + esc(last.text) + '</div>' : "") +
      '</div><div class="thread">' +
      (c.transcript || []).map(t =>
        '<div class="bubble ' + (t.role === "agent" ? "b-agent" : t.role === "customer" ? "b-cust" : "b-sys") + '">' +
        esc(t.text) + '<div class="bt">' + fmtT(t.ts) + '</div></div>').join("") +
      '</div></div>';
  });
  app.innerHTML = h;
}
window.tog = (p) => { openSet.has(p) ? openSet.delete(p) : openSet.add(p); refresh(false); };

let cache = null;
async function refresh(fetchNew = true) {
  if (!TOKEN) return gate();
  try {
    if (fetchNew || !cache) {
      const r = await fetch("/admin/state", { headers: { "x-admin-token": TOKEN } });
      if (r.status === 401) return gate("رمز غير صحيح");
      cache = await r.json();
      document.getElementById("upd").textContent = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    }
    render(cache);
  } catch (e) { /* transient — keep last view */ }
}
refresh();
setInterval(refresh, 5000);
</script>
</body>
</html>`;
