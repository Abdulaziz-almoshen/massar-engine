// مَسار — the platform portal, built to the ORIGINAL prototype design (مسار.dc.html).
// Shell: navy sidebar + grouped nav + topbar. Marketing module screens:
//   متابعة الحملات — LIVE command center (funnel, contact tracker, transcripts)
//   إنشاء حملة    — the prototype's 4-step wizard, wired to today's backend (launch gated)
//   معرفة الخدمة   — readiness view over the agent's real seed KB (editing = next phase)
//   شركاء المبيعات + non-marketing screens — the prototype's empty-state pattern.
// Single-file RTL SPA (hash router), 5s refresh from /admin/state (token → localStorage).

export const DASHBOARD_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>مسار — نظام إدارة المبيعات</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; }
  body { font-family: 'Cairo', 'IBM Plex Sans Arabic', system-ui, 'Segoe UI', 'Geeza Pro', Tahoma, 'Noto Naskh Arabic', sans-serif; background: #F4F6FA; color: #101828; font-size: 14px; }
  ::selection { background: #3FB6B0; color: #fff; }
  .ms-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
  .ms-scroll::-webkit-scrollbar-thumb { background: #d5dae2; border-radius: 999px; }
  .app { display: flex; height: 100vh; width: 100%; overflow: hidden; }

  /* ===== sidebar (Massar identity) ===== */
  aside { width: 264px; flex: none; background: linear-gradient(180deg, #2F5F94 0%, #1F4470 100%); color: #cdd6e6; display: flex; flex-direction: column; border-left: 1px solid #163257; }
  .brand { padding: 24px 22px 20px; border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; gap: 12px; }
  .brand .logo { width: 42px; height: 42px; flex: none; border-radius: 12px; background: linear-gradient(135deg, #3FB6B0, #2E8F89); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 22px; color: #1F4470; }
  .brand .t1 { font-size: 21px; font-weight: 700; color: #fff; line-height: 1; }
  .brand .t2 { font-size: 11.5px; color: #8ea3c0; margin-top: 4px; }
  nav { flex: 1; min-height: 0; overflow-y: auto; padding: 14px 12px 22px; }
  .grp { font-size: 11px; letter-spacing: .6px; color: #a9c2e0; padding: 15px 12px 8px; margin-top: 7px; font-weight: 700; border-top: 1px solid rgba(255,255,255,0.1); }
  .grp:first-child { border-top: none; margin-top: 0; }
  .nv { display: flex; align-items: center; gap: 12px; width: 100%; font-family: inherit; font-size: 13.5px; font-weight: 500; color: #cdd6e6; background: transparent; border: none; border-radius: 10px; padding: 11px 12px; cursor: pointer; text-align: right; margin-bottom: 3px; }
  .nv:hover { background: rgba(255,255,255,0.06); }
  .nv.on { font-weight: 700; color: #fff; background: rgba(201,162,39,0.14); }
  .nv .gx { width: 20px; height: 20px; flex: none; display: flex; align-items: center; justify-content: center; }
  .nv .lbl { flex: 1; }
  .nv .dot { width: 6px; height: 6px; border-radius: 999px; background: #3FB6B0; flex: none; display: none; }
  .nv.on .dot { display: block; }
  .g-sq { width: 13px; height: 13px; border-radius: 3px; background: #7f95b4; }
  .g-ci { width: 13px; height: 13px; border-radius: 999px; background: #7f95b4; }
  .g-di { width: 11px; height: 11px; background: #7f95b4; transform: rotate(45deg); border-radius: 2px; }
  .g-tr { width: 0; height: 0; border-right: 7px solid transparent; border-left: 7px solid transparent; border-bottom: 12px solid #7f95b4; }
  .g-ba { width: 13px; height: 13px; border-right: 3px solid #7f95b4; border-left: 3px solid #7f95b4; border-radius: 1px; }
  .g-ri { width: 13px; height: 13px; border-radius: 999px; border: 3px solid #7f95b4; }
  .g-tb { width: 13px; height: 13px; border-top: 3px solid #7f95b4; border-bottom: 3px solid #7f95b4; }
  .g-tree { width: 13px; height: 13px; border: 2px solid #7f95b4; border-radius: 3px; }
  .nv.on .gx > * { background-color: #3FB6B0; border-color: #3FB6B0; }
  .nv.on .g-tr { background: none; border-bottom-color: #3FB6B0; }
  /* flex:none — without it the card is squeezed by the scrolling nav above and the last nav
     item reads as clipped behind it, on every screen. */
  .userbox { flex: none; padding: 14px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; gap: 11px; background: #1F4470; }
  .userbox .av { width: 38px; height: 38px; flex: none; border-radius: 999px; background: #1c3a5e; display: flex; align-items: center; justify-content: center; color: #cdd6e6; font-weight: 700; font-size: 14px; }
  .userbox .n { font-size: 13px; font-weight: 700; color: #fff; }
  .userbox .r { font-size: 11px; color: #8ea3c0; }

  /* ===== main ===== */
  main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
  header { flex: none; height: 76px; background: #fff; border-bottom: 1px solid #EAECF0; display: flex; align-items: center; gap: 18px; padding: 0 32px; }
  header .tt { flex: 1; min-width: 0; }
  header .t { font-size: 21px; font-weight: 700; color: #101828; letter-spacing: -.2px; }
  header .s { font-size: 12.5px; color: #667085; margin-top: 3px; }
  .livechip { display: inline-flex; align-items: center; gap: 7px; font-size: 11.5px; font-weight: 700; color: #2E7D77; background: #DCF1EF; border-radius: 999px; padding: 7px 14px; }
  .livechip .d { width: 7px; height: 7px; border-radius: 999px; background: #3FB6B0; }
  .body { flex: 1; overflow-y: auto; padding: 30px 32px 56px; }

  /* ===== components (reference-grade) ===== */
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(168px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .kpi { background: #fff; border: 1px solid #EAECF0; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
  .kpi .ico { width: 40px; height: 40px; border-radius: 999px; display: flex; align-items: center; justify-content: center; background: #E9F7F6; color: #1F7A73; }
  .kpi .k { font-size: 12.5px; color: #667085; font-weight: 600; }
  .kpi .v { font-size: 30px; font-weight: 700; color: #101828; line-height: 1.05; font-variant-numeric: tabular-nums; letter-spacing: -.5px; }
  .kpi .dl { font-size: 11.5px; font-weight: 700; }
  .kpi .v small { font-size: 12px; font-weight: 500; color: #98a2b3; }
  .card { background: #fff; border: 1px solid #EAECF0; border-radius: 16px; padding: 24px; margin-bottom: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
  .card h3 { margin: 0 0 16px; font-size: 14px; font-weight: 700; color: #475467; letter-spacing: .1px; }
  .chip { display: inline-flex; align-items: center; gap: 6px; font-size: 11.5px; font-weight: 700; border-radius: 999px; padding: 4px 12px; white-space: nowrap; border: 1px solid transparent; }
  .c-grey { background: #F2F4F7; color: #475467; border-color: #E4E7EC; } .c-blue { background: #EFF4FB; color: #2F5F94; border-color: #D6E2F1; }
  .c-teal { background: #E9F7F6; color: #2E7D77; border-color: #C4E8E5; } .c-ok { background: #ECFDF3; color: #027A48; border-color: #C7EED8; }
  .c-warn { background: #FFFAEB; color: #B54708; border-color: #F5E3B7; } .c-bad { background: #FEF3F2; color: #B42318; border-color: #F7D4D1; }
  /* An assistant reading is not a confirmed tag. Same hue so the level still reads at a
     glance, but hollow with a dashed edge so it can never be mistaken for a recorded fact. */
  .c-read { background: transparent; border-style: dashed; font-weight: 600; }
  .c-read .rd { font-weight: 700; opacity: .72; font-size: 10px; }
  .ptab { font-family: inherit; font-size: 13px; font-weight: 700; border: 1px solid #E4E7EC; background: #fff; color: #475467; border-radius: 999px; padding: 10px 20px; cursor: pointer; }
  .ptab.on { background: #101828; color: #fff; border-color: #101828; }
  .inp { font-family: inherit; font-size: 13px; color: #101828; border: 1px solid #E4E7EC; border-radius: 12px; padding: 11px 16px; background: #fff; outline: none; }
  .inp:focus { border-color: #3FB6B0; box-shadow: 0 0 0 3px rgba(63,182,176,.15); }
  .fun { margin-bottom: 13px; }
  .fun .r1 { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
  .fun .l { font-size: 12.5px; font-weight: 600; color: #101828; }
  .fun .m { font-size: 11.5px; color: #667085; font-variant-numeric: tabular-nums; }
  .fun .track { height: 9px; background: #F2F4F7; border-radius: 999px; overflow: hidden; }
  .fun .fill { height: 100%; border-radius: 999px; min-width: 3%; }
  .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 90px 20px; text-align: center; }
  .empty .ic { width: 64px; height: 64px; border-radius: 16px; background: #fff; box-shadow: 0 1px 3px rgba(16,24,40,.08); display: flex; align-items: center; justify-content: center; margin-bottom: 18px; }
  .empty .ic span { width: 26px; height: 26px; border: 2px dashed #D0D5DD; border-radius: 7px; }
  .empty .t { font-size: 17px; font-weight: 700; color: #101828; }
  .empty .s { font-size: 13px; color: #667085; margin-top: 6px; max-width: 380px; line-height: 1.8; }

  /* tables */
  .tblwrap { background: #fff; border: 1px solid #EAECF0; border-radius: 16px; overflow: hidden; margin-bottom: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
  .ttoolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 18px 22px; border-bottom: 1px solid #EAECF0; }
  .cntpill { font-size: 12px; font-weight: 700; color: #1F7A73; background: #E9F7F6; border-radius: 999px; padding: 4px 12px; }
  /* Sparse-state rule (portal-wide): a screen with few rows must read as DELIBERATE, not
     half-loaded. One line, directly under the controls, that says what is here and where the
     rest is. Real data is still thin on most screens, so this recurs — it lives once. */
  .sparse { display: flex; align-items: flex-start; gap: 10px; margin: -6px 0 16px; padding: 12px 16px; border: 1px solid #E4E7EC; border-inline-start: 3px solid #1F7A73; border-radius: 12px; background: #fff; font-size: 12.5px; line-height: 1.85; color: #475467; }
  .sparse b { color: #101828; font-weight: 700; }
  .sparse .lnk { color: #1F7A73; font-weight: 700; cursor: pointer; text-decoration: none; }
  .tfoot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 14px 22px; border-top: 1px solid #EAECF0; background: #F9FAFB; font-size: 11.5px; color: #667085; }
  .pgbtn { width: 34px; height: 34px; border-radius: 999px; border: 1px solid #EAECF0; background: #fff; color: #475467; font-family: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
  .pgbtn.on { background: #101828; color: #fff; border-color: #101828; }
  .kebab { width: 32px; height: 32px; border-radius: 8px; border: none; background: transparent; color: #98A2B3; font-size: 17px; cursor: pointer; line-height: 1; }
  .kebab:hover { background: #F2F4F7; color: #475467; }
  .swt { width: 38px; height: 22px; border-radius: 999px; background: #EAECF0; position: relative; flex: none; transition: background .18s ease; }
  .swt.on { background: #1F7A73; }
  .swt i { position: absolute; top: 3px; inset-inline-start: 3px; width: 16px; height: 16px; border-radius: 999px; background: #fff; transition: inset-inline-start .18s ease; box-shadow: 0 1px 2px rgba(16,24,40,.2); }
  .swt.on i { inset-inline-start: 19px; }
  .thead, .trow { display: grid; grid-template-columns: 1.6fr 1.6fr 1.5fr 1.4fr 0.7fr 0.8fr; gap: 12px; padding: 15px 22px; align-items: center; }
  .thead { background: #F9FAFB; border-bottom: 1px solid #EAECF0; font-size: 11.5px; font-weight: 700; color: #667085; }
  .trow { border-bottom: 1px solid #F2F4F7; cursor: pointer; min-height: 62px; }
  .trow:hover { background: #F9FAFB; }
  .trow:last-child { border-bottom: none; }
  .cust { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .cust .av { width: 40px; height: 40px; flex: none; border-radius: 999px; background: #EFF4FB; display: flex; align-items: center; justify-content: center; color: #2F5F94; font-weight: 700; font-size: 15px; }
  .cust .nm { font-size: 13.5px; font-weight: 700; color: #101828; }
  .cust .ph { font-size: 11px; color: #98a2b3; direction: ltr; text-align: right; }
  .lastm { font-size: 12px; color: #667085; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tm { font-size: 11px; color: #98a2b3; font-variant-numeric: tabular-nums; }
  .statgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 14px; margin-bottom: 18px; }
  .statc { background: #fff; border-radius: 14px; padding: 16px 18px; box-shadow: 0 1px 3px rgba(16,24,40,.06); }
  .statc .l { font-size: 11.5px; color: #667085; margin-bottom: 8px; font-weight: 600; }
  .statc .v { font-size: 24px; font-weight: 700; color: #101828; line-height: 1; font-variant-numeric: tabular-nums; }
  .statc .p { font-size: 10.5px; color: #2E7D77; font-weight: 700; margin-top: 6px; }
  .statc .mb { height: 4px; background: #F2F4F7; border-radius: 999px; overflow: hidden; margin-top: 9px; }
  .statc .mb i { display: block; height: 100%; border-radius: 999px; }
  .backdrop { position: fixed; inset: 0; background: rgba(16,24,40,.4); z-index: 69; }
  .convo { position: fixed; inset-block: 0; inset-inline-start: 0; width: min(430px, 94vw); background: #fff; z-index: 70; display: flex; flex-direction: column; box-shadow: 12px 0 32px rgba(16,24,40,.18); }
  .convo .hd { flex: none; display: flex; align-items: center; gap: 11px; padding: 14px 18px; border-bottom: 1px solid #EAECF0; }
  .convo .hd .av { width: 40px; height: 40px; flex: none; border-radius: 999px; background: #EFF4FB; color: #2F5F94; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; }
  .convo .msgs { flex: 1; overflow-y: auto; background: #E5DDD4; padding: 16px; }
  .convo .ft { flex: none; padding: 13px 18px; border-top: 1px solid #EAECF0; }
  @media (prefers-reduced-motion: no-preference) { .convo { animation: slideIn .18s ease; } @keyframes slideIn { from { transform: translateX(-30px); opacity: .6; } to { transform: none; opacity: 1; } } }
  .bub { max-width: 76%; border-radius: 12px; padding: 9px 13px; font-size: 12.5px; line-height: 1.9; margin-bottom: 9px; box-shadow: 0 1px 1px rgba(0,0,0,.06); white-space: pre-line; color: #101828; }
  .b-a { background: #DCF8C6; border-top-left-radius: 3px; margin-inline-start: auto; }
  .b-c { background: #fff; border-top-right-radius: 3px; margin-inline-end: auto; }
  .b-s { background: rgba(255,255,255,.65); font-size: 11px; color: #475467; max-width: 100%; text-align: center; }
  .bt { font-size: 9.5px; color: #7d8b6a; text-align: left; margin-top: 4px; direction: ltr; }

  /* wizard */
  .step { background: #fff; border-radius: 16px; padding: 26px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(16,24,40,.07), 0 1px 2px rgba(16,24,40,.04); }
  .step .hd { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
  .step .num { width: 32px; height: 32px; flex: none; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; background: #2E8F89; color: #fff; }
  .step .num.done { background: #E9F7F6; color: #2E7D77; }
  .step .ht { font-size: 15.5px; font-weight: 700; color: #101828; }
  .step .hs { font-size: 12.5px; color: #667085; margin-top: 4px; }
  .prods { display: grid; grid-template-columns: repeat(auto-fit, minmax(195px, 1fr)); gap: 14px; }
  .prod { text-align: right; font-family: inherit; background: #fff; border: 1.5px solid #EAECF0; border-radius: 16px; padding: 18px; cursor: pointer; }
  .prod.on { background: #F6FCFB; border-color: #3FB6B0; box-shadow: 0 0 0 3px rgba(63,182,176,.12); }
  .prod .pn { font-size: 13.5px; font-weight: 700; color: #101828; margin-bottom: 12px; }
  .prod .sc { font-size: 21px; font-weight: 700; }
  .prod .scl { font-size: 10.5px; color: #98a2b3; }
  .prod .bar { height: 6px; background: #F2F4F7; border-radius: 999px; overflow: hidden; margin: 10px 0; }
  .prod .bar i { display: block; height: 100%; border-radius: 999px; }
  .wa-prev { background: #E5DDD4; border-radius: 16px; padding: 18px; max-width: 480px; }
  .wa-prev .b { background: #DCF8C6; border-radius: 12px; border-top-left-radius: 3px; padding: 12px 14px; font-size: 12.5px; color: #101828; line-height: 2; white-space: pre-line; box-shadow: 0 1px 1px rgba(0,0,0,.08); }
  .wa-prev .t { font-size: 9.5px; color: #7d8b6a; text-align: left; margin-top: 6px; }
  .btn { font-family: inherit; font-size: 13.5px; font-weight: 700; border: none; border-radius: 12px; padding: 12px 20px; cursor: pointer; }
  .btn-teal { color: #fff; background: #1F7A73; box-shadow: 0 1px 2px rgba(16,24,40,.1); }
  .btn-dark { color: #fff; background: #101828; }
  .btn-ghost { color: #344054; background: #fff; border: 1px solid #D0D5DD; }
  .btn:hover { filter: brightness(1.04); }
  .btn-dis { color: #98a2b3; background: #F2F4F7; cursor: not-allowed; }
  .note { display: flex; align-items: center; gap: 9px; background: #FFFAEB; border: 1px solid #F5E3B7; border-radius: 12px; padding: 12px 16px; font-size: 12px; color: #B54708; font-weight: 600; margin-top: 14px; }

  /* kb */
  .kbrow { display: flex; align-items: center; gap: 14px; padding: 17px 22px; border-bottom: 1px solid #F2F4F7; }
  .kbrow:last-child { border-bottom: none; }
  .kbrow .dt { width: 9px; height: 9px; flex: none; border-radius: 999px; }
  .kbrow .ti { flex: 1; min-width: 0; }
  .kbrow .t1 { font-size: 13.5px; font-weight: 700; color: #101828; }
  .kbrow .t2 { font-size: 11.5px; color: #98a2b3; margin-top: 4px; }
  .kbrow .ct { font-size: 11.5px; color: #98A2B3; }
  .gate { max-width: 420px; margin: 80px auto; background: #fff; border-radius: 16px; padding: 30px; text-align: center; box-shadow: 0 1px 3px rgba(16,24,40,.08); }
  .gate input { font-family: inherit; width: 100%; font-size: 13px; border: 1px solid #E4E7EC; border-radius: 12px; padding: 12px 14px; margin: 14px 0; direction: ltr; }
  .ptitle { display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
  .ptitle h1 { margin: 0; font-size: 30px; font-weight: 700; color: #101828; letter-spacing: -.6px; line-height: 1.2; }
  .ptitle p { margin: 6px 0 0; font-size: 13.5px; color: #667085; }
  .ptitle .acts { margin-inline-start: auto; display: flex; gap: 10px; align-items: center; }
  .sec { font-size: 14px; font-weight: 700; color: #475467; margin: 4px 0 14px; }
  /* motion */
  @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  @media (prefers-reduced-motion: no-preference) {
    .rise { animation: rise .42s cubic-bezier(.22,.9,.32,1) both; }
    .card, .kpi, .statc, .step { transition: transform .18s ease, box-shadow .18s ease; }
    .kpi:hover, .statc:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(16,24,40,.08); }
    .trow { transition: background .15s ease; }
    .bar i, .fun .fill, .statc .mb i, .prog i { transition: width .7s cubic-bezier(.22,.9,.32,1); }
    .livechip .d { animation: pulse 2s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .55; transform: scale(.82); } }
  }
  .skel { background: linear-gradient(90deg, #F2F4F7 25%, #EAECF0 37%, #F2F4F7 63%); background-size: 200% 100%; animation: shimmer 1.4s linear infinite; border-radius: 8px; }
  .sec .meta { font-size: 11.5px; font-weight: 600; color: #98a2b3; margin-inline-start: 8px; }
  /* The launch bar is docked chrome; on a phone it must not eat the step it sits under. */
  @media (max-width: 430px) {
    .lbar { gap: 8px !important; padding: 12px 14px !important; }
    .lbar .lsub { display: none; }
    .lbar .btn { padding: 10px 16px !important; font-size: 12.5px !important; }
  }
  @media (max-width: 900px) { aside { display: none; } .thead, .trow:not(.km) { grid-template-columns: 1.5fr 1.4fr 1.1fr .5fr; } .thead div:nth-child(4), .trow:not(.km) > div:nth-child(4), .thead div:nth-child(5), .trow:not(.km) > div:nth-child(5) { display: none; } .trow > div:last-child { font-size: 14px !important; } .hidemob { display: none !important; } }
</style>
</head>
<body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
<symbol id="i-home" viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
<symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 20c.4-3.3 2.8-5.2 5.5-5.2S14.1 16.7 14.5 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M16 5.5a3 3 0 0 1 0 5.6M17.5 20c-.2-1.9-.9-3.4-2-4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
<symbol id="i-target" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" stroke-width="1.8"/></symbol>
<symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 20V9M10 20V4M16 20v-7M22 20H2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
<symbol id="i-send" viewBox="0 0 24 24"><path d="M21 3 3 10.2l7 2.6 2.6 7z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
<symbol id="i-book" viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></symbol>
<symbol id="i-spark" viewBox="0 0 24 24"><path d="m12 3 2.1 5.4L20 10l-5.9 1.6L12 17l-2.1-5.4L4 10l5.9-1.6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>
<symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-eye" viewBox="0 0 24 24"><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="2.8" fill="none" stroke="currentColor" stroke-width="1.8"/></symbol>
<symbol id="i-reply" viewBox="0 0 24 24"><path d="M9 7 4 12l5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 12h9a7 7 0 0 1 7 7v1" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
<symbol id="i-flame" viewBox="0 0 24 24"><path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-2 1-3.4 1-3.4s.4 1.6 1.6 2C10.6 8.4 12 6.4 12 3" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>
<symbol id="i-doc" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M14 3v4h4M9 12h6M9 16h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></symbol>
<symbol id="i-up" viewBox="0 0 24 24"><path d="M12 20V5M6 11l6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.4" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="m16 16 4.5 4.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>
</defs></svg>
<div class="app">
  <aside>
    <div class="brand">
      <div class="logo">م</div>
      <div><div class="t1">مسار</div><div class="t2">نظام إدارة المبيعات</div></div>
    </div>
    <nav class="ms-scroll" id="nav"></nav>
    <div class="userbox"><div class="av">ع</div><div><div class="n">عبدالعزيز المحسن</div><div class="r">المدير التنفيذي</div></div></div>
  </aside>
  <main>
    <header>
      <div class="tt"><div class="t" id="pt">مسار</div><div class="s" id="ps"></div></div>
      <span class="livechip" id="live" style="display:none"><span class="d"></span> مباشر · <span id="upd">—</span></span>
    </header>
    <div class="body ms-scroll" id="body"></div>
  </main>
</div>
<script>
const qs = new URLSearchParams(location.search);
if (qs.get("token")) { localStorage.setItem("massar_admin_token", qs.get("token")); history.replaceState({}, "", "/dashboard" + location.hash); }
let TOKEN = localStorage.getItem("massar_admin_token") || "";
const ic = (n, sz, col) => '<svg width="' + (sz || 20) + '" height="' + (sz || 20) + '" style="flex:none;color:' + (col || 'currentColor') + '"><use href="#i-' + n + '"/></svg>';
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
let cache = null; let selProd = 0;
// Behavioural segmentation. audMode «file» keeps the existing column-chip picker; «behaviour»
// builds a live segment over the ledger. The two are modes of ONE step, not separate screens:
// a behavioural audience is by definition outside WhatsApp's 24h window, so it can only be
// reached with an approved template — letting the audience be chosen away from the message is
// how WATI and AiSensy let you build a list you are not allowed to send to.
let audMode = "file"; let segDef = null; let segPreview = null; let segBusy = false; let segWindow = 5;
let entities = []; const entSel = new Set(); let entQ = ""; const entFilters = {}; let entImportSummary = "";
let manualRows = [{ name: "", phone: "", size: "", city: "" }];
let manualOpen = false; let manualStat = ""; let custQ = "";
const LIST_CAP = 60;   // never render huge audiences — filter/search narrows, «تحديد المطابقين» selects all matches
let kbDocs = []; let prodAssets = []; let launching = false; let campaigns = []; let campFilter = "all"; let campName = "";
let showTest = false;         // sandbox separation: test traffic hidden from real views by default
// Opens on «فعلية»: rehearsals and duplicate launches are one click away under «تجريبية»,
// not the first thing on the screen. Defaulting to «الكل» made the list read as clutter.
let campQ = ""; let campTab = "real"; let campSortKey = "new";   // campaigns list controls
let showTestDecided = false;
let profileData = null;       // العميل ٣٦٠ payload for the open #customer/<phone> route
let profilePhone = "";        // phone the loaded profile belongs to
let insCache = {};            // phone → cached فهم المساعد (list rows read this, no LLM)
let winloss = null;           // «لماذا نكسب ولماذا نخسر» aggregate (cached reads only)
let retargetCohort = null;    // {label, campaign, targets:[{phone,name}]} — set from a campaign's filtered cohort
let lastDetailCohort = null;  // captured at render time by vKmonDetail (current filter + search)
let campMsg = "في أغلب المنشآت الصحية، إصدار {product} يمر بخطوات ورقية متكررة بين النظام الداخلي والجهات الرسمية.\\n\\nما نقدمه في لِين هو ربط مباشر مع نظام HIS لديكم: الإجراء يُنفَّذ من داخل نظامكم بتوثيق رسمي معتمد، فيقل زمن الإصدار بنسبة تصل إلى ٧٠٪ ويختفي الإدخال المزدوج.\\n\\nأرفقنا ملفًا موجزًا يوضح آلية الربط والخطوات.\\n\\nسؤال واحد لنعرف ما يناسبكم: كم فرعًا لديكم تقريبًا؟";

const NAV = [
  { grp: "نظرة عامة" }, { id: "home", l: "الرئيسية", g: "g-sq" },
  { grp: "دورة البيع" }, { id: "customers", l: "العملاء", g: "g-ci" }, { id: "opps", l: "فرص البيع", g: "g-tr" }, { id: "pipeline", l: "لوحة المتابعة", g: "g-ba" },
  { grp: "التسويق" }, { id: "aimkt", l: "إنشاء حملة", g: "g-di" }, { id: "kmon", l: "متابعة الحملات", g: "g-ba" }, { id: "kb", l: "معرفة الخدمة", g: "g-ri" }, { id: "partners", l: "شركاء المبيعات", g: "g-ci" },
  { grp: "التخطيط وقياس الأداء" }, { id: "products", l: "المنتجات", g: "g-di" }, { id: "targets", l: "جهات الاستهداف", g: "g-ri" }, { id: "reports", l: "التقارير", g: "g-tb" },
  { grp: "المنشأة" }, { id: "org", l: "الهيكل التنظيمي", g: "g-tree" },
];
const TITLES = {
  home: ["الرئيسية", "نظرة عامة على نشاط مسار الفعلي"],
  kmon: ["الحملات", "متابعة أداء حملات مساعد المبيعات"],
  aimkt: ["إنشاء حملة", "أنشئ حملة موجهة للمنشآت الصحية"],
  kb: ["معرفة الخدمة لمساعد المبيعات", "المعرفة المعتمدة التي يستند إليها مساعد المبيعات في واتساب"],
  partners: ["لوحة متابعة شركاء المبيعات", "ضمن المرحلة القادمة"],
  customers: ["جهات الاستهداف", "استورد جهات الاستهداف وأدرها للحملات"],
  customer: ["ملف جهة الاستهداف", "بيانات الجهة، وقراءة المساعد، وسجل التفاعل"], opps: ["فرص البيع", "ضمن المرحلة القادمة"],
  pipeline: ["لوحة متابعة الفرص", "ضمن المرحلة القادمة"], products: ["المنتجات", "ضمن المرحلة القادمة"],
  targets: ["جهات الاستهداف", "ضمن المرحلة القادمة"], reports: ["التقارير", "ضمن المرحلة القادمة"], org: ["الهيكل التنظيمي", "ضمن المرحلة القادمة"],
};
// The agent's real catalog (mirrors src/agent.ts seed KB; the KB module feeds this later).
const PRODUCTS_FULL = [
  { n: "الإجازات المرضية", pitch: "مكّن منشأتكم من إصدار الإجازات المرضية وإدارتها إلكترونيًا، بتوثيق رسمي وتكامل مباشر مع HIS وERP، والتفعيل خلال 5 أيام عمل.", eff: ["زمن الإصدار ↓70%", "لا إدخال مزدوج", "توثيق فوري"], best: ["مجمعات طبية", "مراكز", "مستشفيات", "أسنان"], pricing: "القياسية 18,000 ر.س · المؤسسات 95,000 ر.س سنويًا" },
  { n: "فحص الموظفين", pitch: "مكّن منشأتكم من إدارة فحوصات اللياقة الطبية بقوالب معتمدة، وتقارير جماعية، وربط مباشر بملف الموظف.", eff: ["امتثال دون معاملات ورقية", "تقارير جاهزة"], best: ["مستشفيات", "مجمعات", "كثافة توظيف"], pricing: "سنوي لكل فحص — يحدده المختص" },
  { n: "التقارير الطبية", pitch: "أصدر تقارير طبية معتمدة إلكترونيًا، بتوقيع رقمي وأرشفة مركزية.", eff: ["دقائق بدل أيام", "أرشيف مركزي"], best: ["مراكز", "مختبرات", "عيادات"], pricing: "سنوي حسب الحجم — يحدده المختص" },
  { n: "خدمات التطعيمات", pitch: "مكّن منشأتكم من إدارة التطعيمات وتوثيقها عبر سجل موحّد وتنبيهات للجرعات.", eff: ["توثيق لحظي", "تنبيهات آلية"], best: ["مراكز صحية", "صيدليات"], pricing: "سنوي — يحدده المختص" },
  { n: "الشهادات الصحية", pitch: "مكّن منشأتكم من إصدار الشهادات الصحية فورًا، مع تحقق QR وسجل مركزي.", eff: ["إصدار فوري", "تحقق QR"], best: ["صيدليات", "مراكز"], pricing: "سنوي — يحدده المختص" },
  { n: "تكامل الأنظمة (HIS/ERP)", pitch: "مكّن منشأتكم من استخدام خدمات لِين داخل أنظمتها، عبر تكامل يُنفّذ خلال أسبوعين.", eff: ["لا إدخال مزدوج", "تنفيذ خلال أسبوعين"], best: ["مستشفيات", "مجمعات كبيرة"], pricing: "مشروع تكامل واشتراك سنوي — يحدده المختص" },
];
const PRODUCTS = [
  { n: "الإجازات المرضية", gaps: [] },
  { n: "فحص الموظفين", gaps: ["أسئلة شائعة", "مواد معتمدة"] },
  { n: "التقارير الطبية", gaps: ["مقارنة المنافسين"] },
  { n: "خدمات التطعيمات", gaps: ["أسئلة شائعة", "معالجة الاعتراضات"] },
  { n: "الشهادات الصحية", gaps: ["أسئلة شائعة", "معالجة الاعتراضات"] },
  { n: "تكامل الأنظمة (HIS/ERP)", gaps: ["التسعير التفصيلي"] },
];

function nav() {
  // #customer/<phone> is a detail view of العملاء — keep that item highlighted.
  const raw = (location.hash || "#kmon").slice(1).split("/")[0];
  const cur = raw === "customer" ? "customers" : raw;
  document.getElementById("nav").innerHTML = NAV.map((x) => x.grp
    ? '<div class="grp">' + x.grp + "</div>"
    : '<button class="nv' + (x.id === cur ? " on" : "") + '" onclick="location.hash=\\'' + x.id + '\\'">' +
      '<span class="gx"><span class="' + x.g + '"></span></span><span class="lbl">' + x.l + '</span><span class="dot"></span></button>'
  ).join("");
  const t = TITLES[cur] || TITLES.kmon;
  document.getElementById("pt").textContent = t[0];
  document.getElementById("ps").textContent = t[1];
  document.getElementById("live").style.display = (cur === "kmon" || cur === "home") ? "" : "none";
}

function chipRow(c) {
  if (!c) return "";
  const st = c.statusTimes || {};
  const out = [];
  if (st.failed && !st.delivered) out.push('<span class="chip c-bad">فشل الإرسال</span>');
  else if (st.replied) out.push('<span class="chip c-ok">ردّ</span>');
  else if (st.read) out.push('<span class="chip c-teal">شوهدت</span>');
  else if (st.delivered) out.push('<span class="chip c-blue">وصلت</span>');
  else if (st.sent || st.enqueued) out.push('<span class="chip c-grey">أُرسلت</span>');
  if (c.outcome === "handoff") out.push('<span class="chip c-warn">مع مختص المبيعات</span>');
  if (c.human) out.push('<span class="chip c-warn">بيد البشر</span>');
  if (c.optedOut) out.push('<span class="chip c-bad">أوقف التواصل</span>');
  if (!out.length) out.push('<span class="chip c-grey">جديد</span>');
  return out.join(" ");
}
const fmtT = (ts) => new Date(ts).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
const fills = ["#2F5F94", "#2F5F94", "#3FB6B0", "#3FB6B0", "#2E8F89", "#1f8a52"];

function funnelData(d) {
  const cs = d.contacts || []; const n = cs.length;
  const cnt = (f) => cs.filter(f).length;
  return [
    ["جهات الاستهداف", n], ["أُرسلت الرسائل", cnt((c) => (c.statusTimes || {}).sent || (c.transcript || []).some((t) => t.role === "agent"))],
    ["وصلت الرسائل", cnt((c) => (c.statusTimes || {}).delivered)], ["شوهدت الرسائل", cnt((c) => (c.statusTimes || {}).read || (c.statusTimes || {}).replied)],
    ["وردت الردود", cnt((c) => (c.statusTimes || {}).replied)], ["الجهات المهتمة", cnt((c) => c.outcome === "interested")],
  ];
}

function contactByPhone(phone) { return ((cache && cache.contacts) || []).find((c) => c.phone === phone); }
// EVERY campaign number is windowed to that campaign's launch. Without this a campaign inherits the
// contact's whole history: two contacts who had replied hours earlier made a campaign sent minutes
// ago report «ردّوا ٢ · شوهدت ٢ · مهتم» before the customers had even opened it. statusTimes holds
// ONE latest timestamp per status, and tags/outcome are lifetime — none of them are per-campaign,
// so reading them raw attributes every past success to the newest send.
function campWin(camp) {
  // created_at is BIGINT and node-pg returns int8 as a STRING of digits ("1786644640706").
  // Date.parse on that is NaN, which made the first version of this fix a NO-OP in production:
  // window 0, every comparison true, every past reply credited to the newest campaign again.
  // Verified against the live API before trusting either branch.
  const raw = camp && camp.created_at;
  if (raw === undefined || raw === null || raw === "") return Infinity;
  const asNum = Number(raw);
  if (Number.isFinite(asNum) && asNum > 0) return asNum;      // epoch millis, number or digit-string
  const parsed = Date.parse(String(raw));                      // ISO fallback
  // FAIL CLOSED. An unreadable launch time must show nothing, never everything — the whole defect
  // was a screen that reported success it could not substantiate.
  return Number.isFinite(parsed) ? parsed : Infinity;
}
// A MISSING timestamp is not "before the window" — it is no event at all. Number(undefined || 0)
// used to yield 0, which passed >= 0 and counted every contact as delivered while making failed
// permanently zero.
function atOrAfter(ts, win) {
  const n = Number(ts);
  return Number.isFinite(n) && n > 0 && n >= win;
}
function repliedIn(c, win) {
  return (c && (c.transcript || []).some((t) => t.role === "customer" && atOrAfter(t.ts, win))) || false;
}
function seenOf(c, win) {
  const st = (c && c.statusTimes) || {};
  return atOrAfter(st.read, win) || atOrAfter(st.replied, win) || repliedIn(c, win);
}
function interestedOf(c, win) {
  // Interest must have been expressed IN this campaign. outcome carries no timestamp, so it is
  // only credited when the contact actually spoke after the send — otherwise a lead marked
  // «interested» last week would make every future campaign look like it converted on arrival.
  if (!c) return false;
  const tagged = (c.tags || []).some((t) => (t.level === "hot" || t.level === "warm") && atOrAfter(t.ts, win));
  return tagged || (c.outcome === "interested" && repliedIn(c, win));
}
function campStats(camp) {
  const win = campWin(camp);
  const cs = camp.targets.map((t) => contactByPhone(t.phone)).filter(Boolean);
  return {
    targeted: camp.targets.length,
    sent: cs.filter((c) => atOrAfter((c.statusTimes || {}).sent, win) || (c.transcript || []).some((t) => t.role === "agent" && atOrAfter(t.ts, win))).length,
    delivered: cs.filter((c) => atOrAfter((c.statusTimes || {}).delivered, win)).length,
    seen: cs.filter((c) => seenOf(c, win)).length,
    replied: cs.filter((c) => repliedIn(c, win)).length,
    interested: cs.filter((c) => interestedOf(c, win)).length,
    failed: cs.filter((c) => atOrAfter((c.statusTimes || {}).failed, win) && !atOrAfter((c.statusTimes || {}).delivered, win)).length,
  };
}
function clip(s, n) { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
/** Arabic-Indic digits, matching every other number on these screens. */
function fmtN(n) { return Number(n || 0).toLocaleString("ar-SA"); }
function interestChips(c) {
  if (!c) return '<span style="color:#D0D5DD;">—</span>';
  const lv = { hot: ["c-ok", "نية مرتفعة"], warm: ["c-warn", "مهتم"], cold: ["c-grey", "فاتر"] };
  const latest = new Map();
  (c.tags || []).forEach((t) => latest.set(t.product, t));
  if (latest.size) {
    return [...latest.values()].map((t) => {
      const m2 = lv[t.level] || lv.warm;
      return '<span class="chip ' + m2[0] + '">' + esc(t.product) + " · " + m2[1] + "</span>";
    }).join(" ");
  }
  const ins = insCache[c.phone] || {};
  const pi = (ins.product_interest || []).filter((x) => x.product);
  if (pi.length) {
    return pi.slice(0, 2).map((x) => '<span class="chip c-read ' + (x.level === "high" ? "c-ok" : x.level === "medium" ? "c-warn" : "c-grey") + '" title="' + esc(x.product) + " — قراءة المساعد من نص المحادثة، لم تُسجَّل كوسم مؤكد" + '">' +
      '<span class="rd">قراءة</span>' + esc(clip(x.product, 24)) + " · " + (x.level === "high" ? "نية مرتفعة" : x.level === "medium" ? "مهتم" : "فاتر") + "</span>").join(" ");
  }
  if (ins.intent === "high") return '<span class="chip c-read c-ok" title="قراءة المساعد من نص المحادثة"><span class="rd">قراءة</span>نية مرتفعة</span>';
  if (ins.intent === "medium") return '<span class="chip c-read c-warn" title="قراءة المساعد من نص المحادثة"><span class="rd">قراءة</span>اهتمام مبدئي</span>';
  if (c.outcome === "handoff") return '<span class="chip c-warn">طلب تواصلًا</span>';
  if (c.outcome === "interested") return '<span class="chip c-ok">مهتم</span>';
  if (c.outcome === "not_interested") return '<span class="chip c-grey">غير مهتم</span>';
  return '<span style="color:#D0D5DD;">—</span>';
}
function fmtD(ts) { return new Date(Number(ts)).toLocaleDateString("ar-SA", { day: "numeric", month: "long" }); }
function contactRowsHtml(rows) {
  let h = "";
  rows.forEach((r) => {
    const c = r.contact || { phone: r.phone, waName: r.name, statusTimes: {}, tags: [], transcript: [] };
    const nm = c.waName || r.name || "غير معروف";
    const last = (c.transcript || [])[(c.transcript || []).length - 1];
    const ci = insCache[c.phone];
    h += '<div class="trow" onclick="location.hash=\\'customer/' + esc(c.phone) + '\\'">' +
      '<div class="cust"><div class="av">' + esc(String(nm).trim().charAt(0)) + '</div><div><div class="nm">' + esc(nm) + '</div><div class="ph">+' + esc(c.phone) + '</div></div></div>' +
      '<div style="display:flex;gap:5px;flex-wrap:wrap;">' + chipRow(c) + "</div>" +
      '<div style="display:flex;gap:5px;flex-wrap:wrap;">' + interestChips(c) + "</div>" +
      '<div class="lastm">' + (ci && ci.next_action ? '<span style="color:#2E7D77;font-weight:600;">← ' + esc(ci.next_action) + "</span>" : esc(last ? last.text : "—")) + "</div>" +
      '<div class="tm">' + (last ? fmtT(last.ts) : "") + "</div>" +
      '<div style="text-align:left;font-size:12px;color:#2F5F94;font-weight:700;" onclick="event.stopPropagation();openConvo(\\'' + esc(c.phone) + '\\')">المحادثة ←</div></div>';
  });
  return h;
}
window.setHuman = async (phone, val) => {
  try {
    const r = await fetch("/admin/contact/human", { method: "POST", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ phone, human: val }) });
    if (!r.ok) { alertBar("تعذّر تبديل حالة المساعد (" + r.status + ")", true); return; }
    alertBar(val ? "توقف المساعد، وأصبحت المحادثة بيدكم" : "استأنف المساعد المحادثة", false);
  } catch (e) { alertBar("تعذّر الاتصال بالخادم. أعد المحاولة.", true); return; }
  await refresh();
};
window.setTestFlag = async (phone, val) => {
  try {
    const r = await fetch("/admin/contact/test", { method: "POST", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ phone, test: val }) });
    if (!r.ok) { alertBar("تعذّر تحديث الوسم (" + r.status + ")", true); return; }
    alertBar(val ? "صُنّفت المحادثة كتجريبية، ولن تُحتسب ضمن البيانات الفعلية" : "أُعيدت المحادثة إلى البيانات الفعلية", false);
  } catch (e) { alertBar("تعذّر الاتصال بالخادم", true); return; }
  await refresh();
};
let convoPhone = null;
let convoSig = "";
window.openConvo = (p) => { convoPhone = p; renderConvo(); };
window.closeConvo = () => { convoPhone = null; renderConvo(); };
function renderConvo() {
  let el = document.getElementById("convoRoot");
  if (!el) { el = document.createElement("div"); el.id = "convoRoot"; document.body.appendChild(el); }
  if (!convoPhone || !cache) { el.innerHTML = ""; convoSig = ""; return; }
  const c = (cache.contacts || []).find((x) => x.phone === convoPhone);
  if (!c) { el.innerHTML = ""; convoPhone = null; convoSig = ""; return; }
  const sig = c.phone + "|" + (c.transcript || []).length + "|" + c.human + "|" + c.test + "|" + (c.outcome || "") +
    "|" + Object.keys(c.statusTimes || {}).join(",") + "|" + (c.tags || []).map((t) => t.product + ":" + t.level).join(",");
  if (sig === convoSig && el.innerHTML) return;   // nothing changed — don't rebuild (keeps scroll)
  const prevMsgs = document.getElementById("convoMsgs");
  const wasAtBottom = !prevMsgs || (prevMsgs.scrollHeight - prevMsgs.scrollTop - prevMsgs.clientHeight < 60);
  const prevScroll = prevMsgs ? prevMsgs.scrollTop : 0;
  convoSig = sig;
  const nm = c.waName || "غير معروف";
  el.innerHTML = '<div class="backdrop" onclick="closeConvo()"></div>' +
    '<aside class="convo" role="dialog" aria-label="المحادثة">' +
    '<div class="hd"><div class="av">' + esc(nm.trim().charAt(0)) + '</div>' +
    '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:#101828;">' + esc(nm) + '</div>' +
    '<div style="font-size:11px;color:#98A2B3;direction:ltr;text-align:right;">+' + esc(c.phone) + "</div></div>" +
    '<button onclick="closeConvo()" style="font-family:inherit;flex:none;font-size:18px;font-weight:700;color:#98A2B3;background:#F2F4F7;border:none;border-radius:9px;width:32px;height:32px;cursor:pointer;">×</button></div>' +
    '<div style="padding:9px 16px;border-bottom:1px solid #F2F4F7;display:flex;gap:5px;flex-wrap:wrap;">' + chipRow(c) + " " + interestChips(c) + "</div>" +
    '<div class="msgs" id="convoMsgs">' + (c.transcript || []).map((t) =>
      '<div class="bub ' + (t.role === "agent" ? "b-a" : t.role === "customer" ? "b-c" : "b-s") + '">' + esc(t.text) + '<div class="bt">' + fmtT(t.ts) + "</div></div>").join("") + "</div>" +
    '<div class="ft" style="display:flex;gap:8px;"><button class="btn" style="flex:1;font-size:12.5px;' +
    (c.human ? 'color:#fff;background:#2E8F89;' : 'color:#c43d3d;background:#fff;border:1px solid #f0d3d3;') +
    '" onclick="setHuman(\\'' + esc(c.phone) + '\\',' + (c.human ? "false" : "true") + ')">' +
    (c.human ? "استئناف المساعد" : "إيقاف المساعد") + "</button>" +
    '<button class="btn" title="فصل بيانات البيئة التجريبية عن البيانات الفعلية" style="flex:none;font-size:11.5px;' +
    (c.test ? 'color:#8a6d10;background:rgba(201,162,39,.14);border:1px solid rgba(201,162,39,.45);' : 'color:#667085;background:#fff;border:1px solid #D0D5DD;') +
    '" onclick="setTestFlag(\\'' + esc(c.phone) + '\\',' + (c.test ? "false" : "true") + ')">' +
    (c.test ? "تجريبي" : "تصنيف كتجريبي") + "</button></div></aside>";
  const m = document.getElementById("convoMsgs");
  if (m) m.scrollTop = wasAtBottom ? m.scrollHeight : prevScroll;
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && convoPhone) closeConvo(); });
window.setCampFilter = (f) => { campFilter = f; render(false); };
window.campSearchFn = (el) => { campQ = el.value; clearTimeout(window.__cq2); window.__cq2 = setTimeout(() => render(false), 250); };
window.setCampTab = (t) => { campTab = t; render(false); };
window.setCampSort = (el) => { campSortKey = el.value; render(false); };
window.toggleShowTest = () => { showTest = !showTest; showTestDecided = true; render(false); };
// A launch is a rehearsal because we say it is — not because of who it happened to reach.
// The old derived rule («every target is a sandbox contact») filed a real campaign aimed at
// seeded demo contacts as sandbox, while four genuine rehearsals aimed at real numbers sat in
// the live list. Contacts keep their own test flag for the KPIs; this classifies the launch.
// (No backticks in this file's comments — the client code lives inside a template literal.)
function campIsTest(cp) { return cp.test === true; }
function testToggleChip(nTest) {
  if (!nTest) return "";
  return '<button class="btn" style="padding:5px 12px;font-size:11px;border-radius:999px;' +
    (showTest ? 'color:#8a6d10;background:rgba(201,162,39,.14);border:1px solid rgba(201,162,39,.45);' : 'color:#98A2B3;background:#fff;border:1px dashed #d5dae2;') +
    '" onclick="toggleShowTest()">' + (showTest ? "إخفاء التجريبية" : "إظهار التجريبية (" + fmtN(nTest) + ")") + "</button>";
}

function vKmon(d) {
  const inCamp = new Set(); campaigns.forEach((c) => c.targets.forEach((t) => inCamp.add(t.phone)));
  const tabs = [["all", "الكل", campaigns.length],
    ["real", "فعلية", campaigns.filter((c) => !campIsTest(c)).length],
    ["test", "تجريبية", campaigns.filter((c) => campIsTest(c)).length]];
  const q = campQ.trim();
  let list = campaigns.filter((c) =>
    (campTab === "all" || (campTab === "test") === campIsTest(c)) &&
    (!q || c.name.includes(q) || (c.product || "").includes(q)));
  const withStAll = list.map((c) => ({ c, st: campStats(c) }));
  if (campSortKey === "replies") withStAll.sort((a, b) => b.st.replied - a.st.replied);
  else if (campSortKey === "seen") withStAll.sort((a, b) => b.st.seen - a.st.seen);
  else withStAll.sort((a, b) => Number(b.c.created_at) - Number(a.c.created_at));
  // Cap what we render, and declare the remainder in the footer rather than truncating silently.
  const withSt = withStAll.slice(0, LIST_CAP);
  const nOver = withStAll.length - withSt.length;
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

  let h = '<div class="ptitle rise"><div><h1>الحملات</h1><p>كل إطلاق، أرقامه الفعلية، ونتيجته. اضغط أي حملة لفتح لوحتها.</p></div>' +
    '<div class="acts"><button class="btn btn-ghost" onclick="exportCampaigns()">' + ic("doc", 17) + ' تصدير CSV</button>' +
    '<a href="#aimkt" class="btn btn-dark" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">' + ic("send", 17) + " إنشاء حملة</a></div></div>";
  h += '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-bottom:18px;" class="rise">' +
    tabs.map((t) => '<button class="ptab' + (campTab === t[0] ? " on" : "") + '" onclick="setCampTab(\\'' + t[0] + '\\')">' + t[1] + " (" + fmtN(t[2]) + ")</button>").join("") + "</div>";
  // Say why the list is short, so a true screen never reads as a failed load.
  const nReal = tabs[1][2], nTest = tabs[2][2];
  if (campTab === "real" && nReal >= 1 && nReal <= 2 && nTest) {
    h += '<div class="sparse rise">' + ic("eye", 16, "#1F7A73") +
      "<div>هذه القائمة تعرض <b>" + fmtN(nReal) + " حملة فعلية</b> فقط، وهي كل ما أُطلق حتى الآن. " +
      "<b>" + fmtN(nTest) + "</b> حملة تجريبية وبروفات محفوظة في تبويب " +
      '<span class="lnk" onclick="setCampTab(\\'test\\')">تجريبية</span>' +
      " ولا تدخل في أرقام الأداء.</div></div>";
  }
  if (!campaigns.length) {
    h += '<div class="empty" style="padding:60px 20px;"><div class="ic"><span></span></div><div class="t">لا حملات بعد</div><div class="s">أطلق أول حملة من <a href="#aimkt" style="color:#1F7A73;font-weight:700;">إنشاء حملة</a> — كل إطلاق يظهر هنا بلوحته وأرقامه الحية.</div></div>';
    return h;
  }
  h += '<div class="tblwrap rise">';
  h += '<div class="ttoolbar"><span style="position:relative;display:inline-flex;align-items:center;flex:1;min-width:220px;max-width:380px;">' +
    '<span style="position:absolute;inset-inline-start:14px;color:#98A2B3;display:flex;">' + ic("search", 18) + "</span>" +
    '<input id="campq" class="inp" value="' + esc(campQ) + '" oninput="campSearchFn(this)" placeholder="ابحث في الحملات…" style="width:100%;padding-inline-start:42px;height:46px;border-radius:999px;"></span>' +
    '<select onchange="setCampSort(this)" class="inp" style="height:46px;border-radius:999px;font-weight:600;color:#344054;">' +
    '<option value="new"' + (campSortKey === "new" ? " selected" : "") + '>الأحدث أولًا</option>' +
    '<option value="replies"' + (campSortKey === "replies" ? " selected" : "") + '>الأكثر ردودًا</option>' +
    '<option value="seen"' + (campSortKey === "seen" ? " selected" : "") + '>الأكثر مشاهدة</option></select>' +
    '<span style="flex:1"></span><span class="cntpill">' + fmtN(withStAll.length) + " حملة</span></div>";
  h += '<div style="overflow-x:auto;" class="ms-scroll"><div style="min-width:900px;">' +
    '<div style="display:grid;grid-template-columns:2fr 1.15fr .95fr .7fr .7fr .7fr 1.15fr 44px;gap:12px;padding:14px 22px;background:#F9FAFB;border-bottom:1px solid #EAECF0;font-size:11.5px;font-weight:700;color:#667085;">' +
    '<div>الحملة</div><div>الخدمة</div><div>الحالة</div><div style="text-align:center;">الجمهور</div><div style="text-align:center;">مشاهدة</div><div style="text-align:center;">ردود</div><div>التقدّم</div><div></div></div>';
  withSt.forEach(({ c, st }, i) => {
    const prog = pct(st.delivered, st.targeted);
    const isTest = campIsTest(c);
    const stChip = isTest
      ? '<span class="chip c-warn"><span style="width:6px;height:6px;border-radius:999px;background:#B54708;"></span>تجريبية</span>'
      : (st.replied ? '<span class="chip c-ok"><span style="width:6px;height:6px;border-radius:999px;background:#027A48;"></span>مكتملة</span>'
        : '<span class="chip c-blue"><span style="width:6px;height:6px;border-radius:999px;background:#2F5F94;"></span>جارية</span>');
    h += '<div class="trow km" onclick="location.hash=\\'kmon/' + c.id + '\\'" style="display:grid;grid-template-columns:2fr 1.15fr .95fr .7fr .7fr .7fr 1.15fr 44px;gap:12px;padding:16px 22px;align-items:center;">' +
      '<div style="display:flex;align-items:center;gap:12px;min-width:0;"><span role="img" aria-label="' + (isTest ? "حملة تجريبية" : "حملة فعلية") + '" title="' + (isTest ? "حملة تجريبية (بيئة الاختبار)" : "حملة فعلية") + '" style="width:9px;height:9px;border-radius:999px;flex:none;background:' + (isTest ? "#D0D5DD" : "#1F7A73") + ";box-shadow:0 0 0 3px " + (isTest ? "rgba(208,213,221,.28)" : "rgba(31,122,115,.16)") + ';"></span>' +
      '<div style="min-width:0;"><div style="font-size:13.5px;font-weight:700;color:#101828;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(c.name) + '</div>' +
      '<div style="font-size:11px;color:#98A2B3;margin-top:3px;">' + fmtD(c.created_at) + "</div></div></div>" +
      '<div style="font-size:12.5px;color:#475467;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(c.product || "—") + "</div>" +
      "<div>" + stChip + "</div>" +
      '<div style="text-align:center;font-size:13px;font-weight:700;color:#101828;font-variant-numeric:tabular-nums;">' + fmtN(st.targeted) + "</div>" +
      '<div style="text-align:center;font-size:13px;font-weight:700;color:#101828;font-variant-numeric:tabular-nums;">' + fmtN(pct(st.seen, st.targeted)) + "٪</div>" +
      '<div style="text-align:center;font-size:13px;font-weight:700;color:#101828;font-variant-numeric:tabular-nums;">' + fmtN(pct(st.replied, st.targeted)) + "٪</div>" +
      '<div style="display:flex;align-items:center;gap:9px;"><div class="prog" style="flex:1;height:6px;background:#EAECF0;border-radius:999px;overflow:hidden;"><i style="display:block;height:100%;width:' + prog + '%;background:#1F7A73;border-radius:999px;"></i></div><span style="font-size:11.5px;font-weight:700;color:#667085;flex:none;font-variant-numeric:tabular-nums;">' + fmtN(prog) + "٪</span></div>" +
      '<div style="text-align:center;"><button class="kebab" title="' + (isTest ? "إعادة الحملة إلى القائمة الفعلية" : "نقل الحملة إلى التجريبية") + '" aria-label="' + (isTest ? "إعادة الحملة إلى القائمة الفعلية" : "نقل الحملة إلى التجريبية") +
      '" onclick="event.stopPropagation();setCampClass(' + c.id + "," + (isTest ? "false" : "true") + ')">' + (isTest ? "↩" : "⇥") + "</button></div></div>";
  });
  if (!withSt.length) {
    // Say which of the two reasons this is: an empty class, or a search that matched nothing.
    // Rendering «لا نتائج مطابقة» beside a «تعرض ٠ حملة فعلية» explainer gave two answers at once.
    h += campQ.trim()
      ? '<div style="padding:44px;text-align:center;color:#667085;font-size:13px;line-height:1.9;">لا حملة تطابق «' + esc(campQ.trim()) + '».<br><span style="color:#98A2B3;">امسح البحث أو جرّب تبويبًا آخر.</span></div>'
      : (campTab === "real"
        ? '<div style="padding:44px;text-align:center;color:#667085;font-size:13px;line-height:1.9;">لم تُطلق أي حملة فعلية بعد.<br><span class="lnk" onclick="setCampTab(\\'test\\')" style="color:#1F7A73;font-weight:700;cursor:pointer;">' + fmtN(nTest) + ' حملة تجريبية محفوظة</span>' + (nTest ? "" : "") + '</div>'
        : '<div style="padding:44px;text-align:center;color:#98A2B3;font-size:13px;">لا حملات في هذا التبويب</div>');
  }
  h += "</div></div>";
  // The page control was hardcoded to «1», so one row sat under a pager implying more pages
  // existed. There is no pagination here — the list is capped and says so. A control that
  // cannot move is worse than no control; a silent truncation is worse still.
  h += '<div class="tfoot"><span>' + ic("clock", 14) + ' الأرقام تُحدَّث لحظيًا من حالات تسليم واتساب. لا تقديرات.</span>' +
    (nOver ? '<span style="color:#B54708;font-weight:700;">تُعرض أحدث ' + fmtN(LIST_CAP) + " حملة من " + fmtN(withSt.length + nOver) + ". ضيّق بالبحث لرؤية الباقي.</span>" : "") + "</div>";
  h += "</div>";
  return h;
}
// Reclassify a launch from the list itself. Until now this took an authenticated curl, which is
// why ten rehearsals sat in the founder's real reporting until someone noticed.
window.setCampClass = async (id, test) => {
  const cp = campaigns.find((c) => Number(c.id) === Number(id));
  if (!cp) return;
  try {
    const r = await fetch("/admin/campaign/test", {
      method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": TOKEN },
      body: JSON.stringify({ id: Number(id), test: Boolean(test) }),
    });
    if (!r.ok) { alertBar("تعذّر تغيير تصنيف الحملة (" + r.status + ")", true); return; }
    cp.test = Boolean(test);           // optimistic: the next poll confirms from the ledger
    render(false);
    alertBar(test ? "نُقلت «" + cp.name + "» إلى التجريبية، وخرجت من أرقام الأداء"
                  : "عادت «" + cp.name + "» إلى الحملات الفعلية", false);
  } catch (e) { alertBar("تعذّر الاتصال بالخادم. أعد المحاولة.", true); }
};
window.exportCampaigns = () => {
  const rows = [["الحملة", "الخدمة", "التاريخ", "الجمهور", "وصلت", "شوهدت", "ردّوا", "جهات مهتمة"]];
  campaigns.forEach((c) => { const st = campStats(c); rows.push([c.name, c.product || "", fmtD(c.created_at), st.targeted, st.delivered, st.seen, st.replied, st.interested]); });
  const safe = (x) => { let v = String(x); if (/^[=+\\-@\\t\\r]/.test(v)) v = "'" + v; return '"' + v.replace(/"/g, '""') + '"'; };
  const csv = "\\ufeff" + rows.map((r) => r.map(safe).join(",")).join("\\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  a.download = "massar-campaigns.csv"; a.click();
  alertBar("صُدّر ملف الحملات", false);
};

let rQ = "";
window.rSearch = (el) => { rQ = el.value; clearTimeout(window.__rq); window.__rq = setTimeout(() => render(false), 250); };
function vKmonDetail(id, d) {
  const camp = campaigns.find((x) => String(x.id) === String(id));
  if (!camp) return '<div class="empty"><div class="ic"><span></span></div><div class="t">حملة غير موجودة</div><div class="s"><a href="#kmon" style="color:#2E7D77;font-weight:700;">→ كل الحملات</a></div></div>';
  const st = campStats(camp);
  const cwin = campWin(camp);   // every number on this screen is scoped to THIS campaign
  const rows = camp.targets.map((t) => ({ phone: t.phone, name: t.name, contact: contactByPhone(t.phone) }));
  const base = Math.max(1, st.targeted);
  const pct = (v) => Math.round(v / base * 100);
  const rate = (a, b) => b ? Math.round(a / b * 100) : 0;
  const yieldPer100 = st.targeted ? Math.round(st.interested / st.targeted * 100) : 0;
  let h = '<a href="#kmon" style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#475467;text-decoration:none;margin-bottom:14px;">→ كل الحملات</a>' +
    '<div class="ptitle rise"><div><h1 style="font-size:26px;">' + esc(camp.name) + "</h1>" +
    '<p>' + (camp.product ? esc(camp.product) + " · " : "") + "واتساب · " + fmtD(camp.created_at) + "</p></div>" +
    '<div class="acts">' + (campIsTest(camp) ? '<span class="chip c-warn">حملة تجريبية</span>' : '<span class="chip c-ok">جارية</span>') + "</div></div>";
  h += '<div class="card rise" style="background:linear-gradient(135deg,#0F2E52,#1F4470);border:none;color:#fff;display:flex;gap:26px;flex-wrap:wrap;align-items:center;">' +
    '<div style="flex:1;min-width:240px;"><div style="font-size:11.5px;color:#9FC0E4;font-weight:700;">حكم الحملة</div>' +
    '<div style="font-size:17px;font-weight:700;margin-top:7px;line-height:1.7;">' +
    (st.replied ? "وصلت إلى " + fmtN(st.delivered) + " جهة، ردّ " + fmtN(st.replied) + " منهم" + (st.interested ? " وأبدى " + fmtN(st.interested) + " اهتمامًا مؤهلًا" : "") + "." : "أُرسلت، وبانتظار الرد الأول.") + "</div></div>" +
    '<div style="display:flex;gap:30px;flex-wrap:wrap;">' +
    [["نسبة المشاهدة", rate(st.seen, st.targeted)], ["نسبة الردود", rate(st.replied, st.targeted)], ["جهات مهتمة لكل ١٠٠", yieldPer100]]
      .map((x) => '<div><div style="font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;">' + fmtN(x[1]) + '<span style="font-size:14px;color:#9FC0E4;">٪</span></div><div style="font-size:11px;color:#9FC0E4;margin-top:3px;">' + x[0] + "</div></div>").join("") +
    "</div></div>";
  const cards = [
    ["جهات الاستهداف", st.targeted, "#2F5F94"], ["أُرسلت", st.sent, "#2F5F94"], ["وصلت", st.delivered, "#3FB6B0"],
    ["شوهدت", st.seen, "#3FB6B0"], ["ردّوا", st.replied, "#2E8F89"], ["جهات مهتمة", st.interested, "#1f8a52"],
  ];
  h += '<div class="statgrid">' + cards.map((c, i) =>
    '<div class="statc"><div class="l">' + c[0] + '</div><div class="v">' + fmtN(c[1]) + "</div>" +
    '<div class="p">' + (i === 0 ? "&nbsp;" : fmtN(pct(c[1])) + "٪ من جهات الاستهداف") + "</div>" +
    '<div class="mb"><i style="width:' + (i === 0 ? 100 : pct(c[1])) + "%;background:" + c[2] + ';"></i></div></div>').join("") + "</div>";
  // Deterministic next-move engine: what this campaign says to do next, computed from its own cohort.
  const seenSilent = rows.filter((r) => r.contact && atOrAfter((r.contact.statusTimes || {}).read, cwin) && !repliedIn(r.contact, cwin));
  const notDelivered = rows.filter((r) => r.contact && atOrAfter((r.contact.statusTimes || {}).failed, cwin) && !atOrAfter((r.contact.statusTimes || {}).delivered, cwin));
  const hotHere = rows.filter((r) => r.contact && ((r.contact.tags || []).some((t) => t.level === "hot") || (insCache[r.phone] || {}).intent === "high"));
  const lostHere = rows.map((r) => insCache[r.phone]).filter((i) => i && i.deal_state === "lost" && i.loss_cause);
  const causeTally = {};
  lostHere.forEach((i) => { causeTally[i.loss_cause] = (causeTally[i.loss_cause] || 0) + 1; });
  const topCause = Object.keys(causeTally).sort((a, b) => causeTally[b] - causeTally[a])[0];
  const moves = [];
  // Deliberately wider than the «جهات مهتمة» counter above: that one counts confirmed tags and
  // human outcomes, this one also trusts a high-intent reading with no tag yet. Two numbers that
  // legitimately differ must not share a word — the counter says «مهتمة», this says «تستحق المتابعة».
  if (hotHere.length) moves.push(["ابدأ التواصل مع " + fmtN(hotHere.length) + " جهة تستحق المتابعة", "وسوم اهتمام مؤكدة، أو نية مرتفعة قرأها المساعد من نص المحادثة ولم تُسجَّل وسمًا بعد", "#027A48", "#ECFDF3"]);
  if (seenSilent.length) moves.push(["أعد استهداف " + fmtN(seenSilent.length) + " جهة شاهدت دون ردّ", "الاهتمام قائم، وأثر الرسالة غير واضح" + (topCause ? " وعالج «" + topCause + "»" : ""), "#B54708", "#FFFAEB"]);
  if (notDelivered.length) moves.push([fmtN(notDelivered.length) + " لم تصلهم الرسالة", "تحقق من الأرقام، ثم أعد المحاولة لاحقًا", "#B42318", "#FEF3F2"]);
  if (topCause) moves.push(["أبرز أسباب عدم الإغلاق: " + topCause, "عالِج السبب في رسالة الحملة القادمة لهذه الخدمة", "#2F5F94", "#EFF4FB"]);
  if (moves.length) {
    h += '<div class="card rise"><div style="display:flex;align-items:center;gap:9px;"><h3 style="margin:0;display:flex;align-items:center;gap:8px;">' + ic("spark", 18, "#1F7A73") + "الخطوة التالية لهذه الحملة</h3>" +
      '<span class="cntpill">' + fmtN(moves.length) + " توصية</span></div>" +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin-top:14px;">' +
      moves.map((m) => '<div style="background:' + m[3] + ';border:1px solid #EAECF0;border-radius:13px;padding:14px 16px;">' +
        '<div style="font-size:13px;font-weight:700;color:' + m[2] + ';">' + esc(m[0]) + "</div>" +
        '<div style="font-size:11.5px;color:#475467;margin-top:5px;line-height:1.8;">' + esc(m[1]) + "</div></div>").join("") + "</div></div>";
  }
  const filters = [
    ["all", "الكل", rows.length, (r) => true],
    ["seen", "شوهدت", st.seen, (r) => seenOf(r.contact, cwin)],
    ["replied", "ردّوا", st.replied, (r) => repliedIn(r.contact, cwin)],
    ["interested", "جهات مهتمة", st.interested, (r) => interestedOf(r.contact, cwin)],
    ["silent", "شوهدت دون ردّ", seenSilent.length, (r) => r.contact && atOrAfter((r.contact.statusTimes || {}).read, cwin) && !repliedIn(r.contact, cwin)],
    ["failed", "فشل الإرسال", st.failed, (r) => r.contact && atOrAfter((r.contact.statusTimes || {}).failed, cwin) && !atOrAfter((r.contact.statusTimes || {}).delivered, cwin)],
  ];
  const active = filters.find((f) => f[0] === campFilter) || filters[0];
  const q = rQ.trim();
  const shown = rows.filter(active[3]).filter((r) => !q || (r.contact && (r.contact.waName || "").includes(q)) || (r.name || "").includes(q) || r.phone.includes(q));
  // Snapshot the visible cohort so «إعادة استهداف» carries exactly what the founder is looking at.
  lastDetailCohort = {
    label: active[1].replace(/[✓⭐]/g, "").trim(), campaign: camp.name,
    targets: shown.map((r) => ({ phone: r.phone, name: (r.contact && r.contact.waName) || r.name || "" })),
  };
  h += '<div class="tblwrap"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #EAECF0;background:#fff;">' +
    '<span style="font-size:13px;font-weight:700;color:#101828;flex:none;">جهات الاستهداف</span>' +
    '<span style="font-size:11px;color:#98A2B3;flex:none;">' + fmtN(shown.length) + " من " + fmtN(rows.length) + "</span>" +
    '<span style="flex:1;"></span>' +
    (shown.length ? '<button class="btn" style="padding:7px 14px;font-size:11.5px;border-radius:999px;color:#8a6d10;background:rgba(201,162,39,.14);border:1px solid rgba(201,162,39,.45);font-weight:700;" onclick="startRetarget()">⟲ إعادة استهداف هذه الفئة (' + fmtN(shown.length) + ")</button>" : "") +
    filters.map((f) => '<button class="btn" style="padding:6px 12px;font-size:11.5px;border-radius:999px;' +
      (campFilter === f[0] ? 'color:#2E7D77;background:#DCF1EF;border:1px solid #3FB6B0;' : 'color:#475467;background:#fff;border:1px solid #EAECF0;') +
      '" onclick="setCampFilter(\\'' + f[0] + '\\')">' + f[1] + " (" + fmtN(f[2]) + ")</button>").join("") +
    '<input id="rq" value="' + esc(rQ) + '" oninput="rSearch(this)" placeholder="بحث…" style="font-family:inherit;font-size:11.5px;border:1px solid #EAECF0;border-radius:999px;padding:7px 13px;background:#F9FAFB;width:130px;">' +
    "</div>" +
    '<div class="thead"><div>العميل</div><div>الحالة</div><div>الاهتمام والجدية</div><div>آخر رسالة</div><div>الوقت</div><div></div></div>' +
    (shown.length ? contactRowsHtml(shown) : '<div style="padding:30px;text-align:center;color:#98A2B3;font-size:12.5px;">لا نتائج</div>') + "</div>";
  return h;
}

function vHome(d) {
  const csAll = d.contacts || [];
  const cs = showTest ? csAll : csAll.filter((c) => !c.test);
  const nTest = csAll.filter((c) => c.test).length;
  const realCampaigns = campaigns.filter((cp) => !campIsTest(cp));
  // Home is deliberately contact-centric and lifetime-scoped: it answers "who is warm right now",
  // not "what did this campaign do". Window 0 keeps that meaning explicit rather than accidental.
  const interestedList = cs.filter((c) => interestedOf(c, 0) || c.outcome === "handoff");
  const delivered = cs.filter((c) => (c.statusTimes || {}).delivered || (c.statusTimes || {}).read).length;
  const replied = cs.filter((c) => (c.statusTimes || {}).replied).length;
  const hotOf = (c) => (c.tags || []).find((t) => t.level === "hot");
  const kpi = (icon, label, value, tint, delta) =>
    '<div class="kpi rise"><div class="ico" style="background:' + tint[0] + ';color:' + tint[1] + ';">' + ic(icon, 20) + "</div>" +
    '<div><div class="v">' + (typeof value === "number" ? fmtN(value) : value) + '</div><div class="k" style="margin-top:5px;">' + label + "</div>" +
    (delta ? '<div class="dl" style="color:' + (delta[0] ? "#027A48" : "#667085") + ';margin-top:6px;">' + esc(delta[1]) + "</div>" : "") + "</div></div>";
  let h = '<div class="ptitle rise"><div><h1>مركز القيادة</h1><p>ما الذي يحدث الآن في السوق — ومن يستحق اتصالك اليوم</p></div>' +
    '<div class="acts"><a href="#customers" class="btn btn-ghost" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">' + ic("up", 17) + " استيراد جهات الاستهداف</a>" +
    '<a href="#aimkt" class="btn btn-dark" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">' + ic("send", 17) + " إنشاء حملة</a></div></div>";
  h += '<div class="kpis">' +
    kpi("send", "الحملات الفعلية", fmtN(realCampaigns.length) + (campaigns.length > realCampaigns.length ? ' <small style="font-size:12px;color:#98A2B3;font-weight:600;">+' + fmtN(campaigns.length - realCampaigns.length) + " تجريبية</small>" : ""), ["#EFF4FB", "#2F5F94"]) +
    // Not «جهات الاستهداف» — the funnel below uses that label for the people a campaign actually
    // reached (4), while this counts the whole imported book (15). One label, two numbers, one
    // screen is exactly the contradiction the funnel fix just removed.
    kpi("users", "جهات في قوائمك", fmtN(entities.length), ["#EFF4FB", "#2F5F94"]) +
    kpi("check", "وصلت الرسائل إلى الجهات", delivered, ["#E9F7F6", "#1F7A73"]) +
    kpi("reply", "ردّوا", replied, ["#E9F7F6", "#1F7A73"]) +
    kpi("flame", "جهات مهتمة ومؤهلة", interestedList.length, ["#FEF3F2", "#B42318"]) + "</div>";
  h += vActionQueue(cs);
  h += vHomeCharts(cs);
  h += vWinLoss();
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;align-items:start;">';
  h += '<div class="card" style="margin:0;"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><h3 style="margin:0;">أفضل الفرص الآن</h3><span style="display:inline-flex;gap:6px;align-items:center;"><span class="chip ' + (interestedList.length ? "c-ok" : "c-grey") + '">' + fmtN(interestedList.length) + "</span>" + testToggleChip(nTest) + "</span></div>" +
    (interestedList.length
      ? '<div style="margin-top:10px;">' + interestedList.slice(0, 6).map((c) => {
          const tg = hotOf(c) || (c.tags || [])[0];
          const last = [...(c.transcript || [])].reverse().find((t) => t.role === "customer");
          const ci = insCache[c.phone];
          return '<div onclick="location.hash=\\'customer/' + esc(c.phone) + '\\'" style="display:flex;align-items:center;gap:11px;padding:10px 4px;border-bottom:1px solid #F2F4F7;cursor:pointer;">' +
            '<div class="avatar" style="width:34px;height:34px;flex:none;border-radius:9px;background:#101828;color:#3FB6B0;display:flex;align-items:center;justify-content:center;font-weight:700;">' + esc((c.waName || "؟").trim().charAt(0)) + "</div>" +
            '<div style="flex:1;min-width:0;"><div style="font-size:12.5px;font-weight:700;color:#101828;">' + esc(c.waName || "غير معروف") + " " +
            (tg ? '<span class="chip ' + (tg.level === "hot" ? "c-bad" : "c-warn") + '" style="font-weight:700;">' + esc(tg.product) + (tg.level === "hot" ? " · نية مرتفعة" : " · مهتم") + "</span>" : (c.outcome === "handoff" ? '<span class="chip c-warn">طلب تواصلًا</span>' : "")) + (c.test ? ' <span class="chip" style="color:#8a6d10;background:rgba(201,162,39,.14);">تجريبي</span>' : "") + "</div>" +
            (ci && ci.next_action ? '<div style="font-size:11px;color:#2E7D77;font-weight:600;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">← ' + esc(ci.next_action) + '</div>'
              : (last ? '<div style="font-size:11px;color:#667085;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">«' + esc(last.text.slice(0, 70)) + '»</div>' : "")) + "</div>" +
            '<span style="font-size:11.5px;font-weight:700;color:#2F5F94;flex:none;">الملف ←</span></div>';
        }).join("") + "</div>"
      : '<div style="font-size:12px;color:#98A2B3;margin-top:12px;line-height:1.9;">حين يرصد المساعد فرصة مؤهلة سيظهر هنا فورًا — ويصلك تنبيه واتساب مباشرة.</div>') +
    (d.notifyNumber ? '<div style="display:flex;align-items:center;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid #F2F4F7;font-size:11px;color:#667085;">🔔 تنبيهات «عميل جاد» و«طلب تدخّل» تصل واتساب مدير المنتج: <b style="color:#101828;direction:ltr;">+' + esc(d.notifyNumber) + "</b></div>" : "") + "</div>";
  h += '<div class="card" style="margin:0;"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><h3 style="margin:0;">أحدث الحملات</h3><a href="#kmon" style="font-size:11.5px;font-weight:700;color:#2E7D77;text-decoration:none;">الكل ←</a></div>' +
    (campaigns.length
      ? '<div style="margin-top:10px;">' + campaigns.slice(0, 5).map((cp) => {
          const st = campStats(cp);
          return '<a href="#kmon/' + cp.id + '" style="text-decoration:none;display:flex;align-items:center;gap:11px;padding:10px 4px;border-bottom:1px solid #F2F4F7;">' +
            '<div style="flex:1;min-width:0;"><div style="font-size:12.5px;font-weight:700;color:#101828;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(cp.name) + (campIsTest(cp) ? ' <span class="chip" style="color:#8a6d10;background:rgba(201,162,39,.14);">تجريبية</span>' : "") + "</div>" +
            '<div style="font-size:10.5px;color:#98A2B3;margin-top:3px;">' + (cp.product ? esc(cp.product) + " · " : "") + fmtD(cp.created_at) + "</div></div>" +
            '<span class="chip c-blue">' + fmtN(st.targeted) + ' مستهدف</span><span class="chip c-teal">شوهدت ' + fmtN(st.seen) + '</span><span class="chip ' + (st.replied ? "c-ok" : "c-grey") + '">ردّوا ' + fmtN(st.replied) + "</span></a>";
        }).join("") + "</div>"
      : '<div style="font-size:12px;color:#98A2B3;margin-top:12px;">لا حملات بعد — أطلق الأولى من «إنشاء حملة».</div>') + "</div>";
  h += "</div>";
  return h;
}

// Segment groups derive from whatever columns the imported file carried:
// one group per attribute key (by coverage, max 6), values ordered by count (max 12).
function segGroups() {
  const keyCount = new Map();
  entities.forEach((e) => Object.keys(e.attrs || {}).forEach((k) => keyCount.set(k, (keyCount.get(k) || 0) + 1)));
  return [...keyCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([key]) => {
    const valCount = new Map();
    entities.forEach((e) => { const v = (e.attrs || {})[key]; if (v) valCount.set(v, (valCount.get(v) || 0) + 1); });
    return { key, values: [...valCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12) };
  });
}
function entMatches() {
  const q = entQ.trim();
  return entities.filter((e) =>
    Object.keys(entFilters).every((k) => !entFilters[k] || ((e.attrs || {})[k] || "") === entFilters[k]) &&
    (!q || e.name.includes(q) || e.phone.includes(q)));
}
function attrChips(e, max) {
  const a = e.attrs || {}; const keys = Object.keys(a).slice(0, max);
  return keys.map((k) => {
    const v = a[k];
    const cls = v === "كبيرة" || v === "كبير" ? "c-blue" : v === "متوسطة" || v === "متوسط" ? "c-teal" : "c-grey";
    return '<span class="chip ' + cls + '" title="' + esc(k) + '">' + esc(v) + "</span>";
  }).join("");
}
function chipBtn(label, on, fn) {
  return '<button class="btn" style="padding:8px 14px;font-size:12px;border-radius:999px;' +
    (on ? 'color:#2E7D77;background:#DCF1EF;border:1px solid #3FB6B0;' : 'color:#475467;background:#fff;border:1px solid #EAECF0;') +
    '" onclick="' + fn + '">' + esc(label) + "</button>";
}
// Indexes only in onclick (Arabic keys/values stay out of attribute strings);
// both sides re-derive the same ordering from segGroups().
window.entSetAttr = (ki, vi) => {
  const g = segGroups()[ki]; if (!g) return;
  entFilters[g.key] = vi < 0 ? "" : (g.values[vi] ? g.values[vi][0] : "");
  render(false);
};
window.entSearch = (el) => { entQ = el.value; clearTimeout(window.__eq); window.__eq = setTimeout(() => render(false), 250); };
window.entTog = (id) => { entSel.has(id) ? entSel.delete(id) : entSel.add(id); render(false); };
window.entAllMatching = () => { const m = entMatches(); const all = m.every(e => entSel.has(e.id)); m.forEach(e => all ? entSel.delete(e.id) : entSel.add(e.id)); render(false); };
window.entClear = () => { entSel.clear(); render(false); };
// Templates are treated as approved (founder's call, 13 Aug), so an edited body needs no warning
// state. No re-render here either — that would move the caret mid-typing.
window.campMsgSet = (el) => { campMsg = el.value; };
window.composeMsg = async () => {
  const btn = document.getElementById("cmpbtn");
  const reg = wizProducts(); const prod = reg[selProd] ? reg[selProd].name : "";
  if (!prod) return;
  const groups = segGroups();
  const audience = Object.keys(entFilters).filter((k) => entFilters[k]).map((k) => k + ": " + entFilters[k]).join("، ");
  if (btn) { btn.disabled = true; btn.textContent = "جارٍ الكتابة…"; }
  try {
    const r = await fetch("/admin/compose", { method: "POST", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ product: prod, audience }) });
    const d = await r.json();
    if (!r.ok || !d.message) { alertBar("تعذّرت الكتابة: " + esc(d.error || r.status), true); return; }
    campMsg = d.message;
    render(false);
    alertBar("كُتبت الرسالة — راجعها وعدّلها قبل الإطلاق", false);
  } catch (e) { alertBar("تعذّر الاتصال بمحرك الكتابة", true); }
  finally { const b2 = document.getElementById("cmpbtn"); if (b2) { b2.disabled = false; } }
};
window.campNameSet = (el) => { campName = el.value; };
window.pick = (i) => { selProd = i; render(false); };
window.launchWithProduct = (name) => {
  const reg = wizProducts();
  const i = reg.findIndex((x) => x.name === name);
  if (i >= 0) selProd = i;
  retargetCohort = null;
  location.hash = "aimkt";
};
window.startRetarget = () => {
  if (!lastDetailCohort || !lastDetailCohort.targets.length) return;
  retargetCohort = lastDetailCohort;
  if (!campName.trim()) campName = "إعادة التواصل — " + retargetCohort.label + " — " + retargetCohort.campaign;
  location.hash = "aimkt";
};
window.clearRetarget = () => { retargetCohort = null; campName = ""; render(false); };
const SEG_SIGNALS = [["delivered","وصلت الرسالة"],["read","قُرئت الرسالة"],["replied","ردّ العميل"],
  ["failed","فشل الإرسال"],["interest","سُجّل اهتمام"],["meeting","حُجز موعد"]];
window.setAudMode = (m) => { audMode = m; if (m === "behaviour" && !segDef) segLoadPresets(); render(false); };
window.segSetWindow = (d) => { segWindow = d; if (segDef) { segDef.conditions.forEach((c) => { if (c.beforeDays) c.beforeDays = d; if (c.withinDays) c.withinDays = d; }); segRun(); } else render(false); };
window.segUsePreset = (id) => {
  const p = (segPresets || []).find((x) => x.id === id); if (!p) return;
  segDef = JSON.parse(JSON.stringify(p.def)); segRun();
};
window.segSetMatch = (m) => { if (!segDef) return; segDef.match = m; segRun(); };
window.segSetField = (i, field, val) => {
  if (!segDef || !segDef.conditions[i]) return;
  const c = segDef.conditions[i];
  if (field === "signal") c.signal = val;
  if (field === "comparator") {
    c.comparator = val;
    // Move the bound to the side that carries meaning for this comparator, instead of deleting it:
    // dropping beforeDays left the row unbounded and made the window chips a silent no-op on it.
    if (val === "never_happened") { delete c.beforeDays; c.withinDays = c.withinDays || segWindow; }
    else { delete c.withinDays; c.beforeDays = c.beforeDays || segWindow; }
  }
  segRun();
};
window.segAddCond = () => { if (!segDef) segDef = { match: "all", conditions: [] };
  if (segDef.conditions.length >= 8) return;
  segDef.conditions.push({ signal: "replied", comparator: "never_happened", withinDays: segWindow }); segRun(); };
window.segDelCond = (i) => { if (!segDef) return; segDef.conditions.splice(i, 1); if (!segDef.conditions.length) { segDef = null; segPreview = null; render(false); return; } segRun(); };
// ---- القوالب المعتمدة -------------------------------------------------------
// Fetched from /admin/templates rather than copied into this script: the wizard preview and the
// launch path must read one registry, or a template previews one way and sends another.
let tpls = [];            // [{id,label,hint,audience,body,buttons}]
let tplId = "";           // the chosen template; "" = a free message the operator wrote himself
// Only until /admin/templates answers; it ships the authoritative list. Kept in sync by the boot
// contract, which now sees this same array server-side.
let tplFallback = ["الملف التعريفي", "أرسلوا التفاصيل", "ليس الآن"];
const campMsgAtBoot = campMsg;   // the legacy default; used to tell "untouched" from "operator typed"
async function tplLoad() {
  try {
    const r = await fetch("/admin/templates", { headers: { "x-admin-token": TOKEN } });
    if (r.ok) { const d = await r.json(); tpls = (d && d.templates) || []; tplFallback = (d && d.fallbackButtons) || tplFallback; }
  } catch (e) { tpls = []; }
  // Open on an approved template rather than the legacy free-text default: the wizard's job is to
  // send a shape we stand behind, and an unselected picker above a different body reads as a bug.
  // Guarded on the body being untouched — this resolves asynchronously and must never overwrite
  // text the operator typed in the first few hundred milliseconds.
  if (!tplId && tpls.length && campMsg === campMsgAtBoot) { tplId = tpls[0].id; campMsg = tpls[0].body; }
  render(false);
}
window.tplPick = (i) => {
  const t = tpls[i];
  if (!t) return;
  // Re-picking the active template restores its original text — the escape hatch after an edit.
  tplId = t.id;
  campMsg = t.body;
  render(false);
};
// Arabic time agreement: 3-10 take the plural, 11+ the singular accusative.
function arAgo(h) {
  if (h < 1) return "أقل من ساعة";
  if (h === 1) return "ساعة"; if (h === 2) return "ساعتين";
  if (h < 11) return fmtN(h) + " ساعات";
  if (h < 48) return fmtN(h) + " ساعة";
  var d = Math.floor(h / 24);
  if (d === 1) return "يوم"; if (d === 2) return "يومين";
  return d < 11 ? fmtN(d) + " أيام" : fmtN(d) + " يومًا";
}
window.tplKey = (ev, i) => {
  if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); tplPick(i); }
};
// Editing the text keeps the template's BUTTONS — those are what the receiving code must recognise.
// (No backticks in this file: it is one big template literal and a backtick closes it.)
window.tplButtons = () => {
  const t = tpls.find((x) => x.id === tplId);
  return t ? t.buttons : tplFallback;
};
let segPresets = null;
async function segLoadPresets() {
  try {
    const r = await fetch("/admin/segments/presets?window=" + segWindow, { headers: { "x-admin-token": TOKEN } });
    if (r.ok) segPresets = await r.json();
  } catch (e) { segPresets = []; }
  render(false);
}
let segSeq = 0;
async function segRun() {
  if (!segDef || !segDef.conditions.length) return;
  // Sequence the previews: a slower earlier request must not overwrite a newer count. Without
  // this, a fast edit can leave a number on screen that belongs to a different segment.
  const mySeq = ++segSeq;
  segBusy = true; render(false);
  try {
    const r = await fetch("/admin/segments/preview", { method: "POST",
      headers: { "content-type": "application/json", "x-admin-token": TOKEN },
      body: JSON.stringify({ def: segDef, includeTest: showTest }) });
    const body = r.ok ? await r.json() : { error: (await r.json()).error || "تعذّر الحساب" };
    if (mySeq !== segSeq) return;                 // a newer request already answered
    segPreview = body;
  } catch (e) { if (mySeq === segSeq) segPreview = { error: "تعذّر الاتصال بالخادم" }; }
  if (mySeq !== segSeq) return;
  segBusy = false; render(false);
}
function vSegBuilder() {
  let h = "";
  // Presets FILL the rows rather than hiding behind a label — a segment the founder cannot read
  // is a segment he cannot trust, and every benchmarked tool that hides it gets distrusted.
  if (segPresets && segPresets.length) {
    h += '<div style="font-size:11.5px;color:#667085;margin-bottom:9px;">اختيار الفئة يملأ الشروط أدناه، ويمكنكم تعديلها.</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-bottom:18px;">' +
      segPresets.map((p) => {
        const extra = [];
        if (p.suppressed) extra.push(fmtN(p.suppressed) + " في التبريد");
        // Forecast rather than excuse: say WHEN the zero becomes a number.
        if (p.tooNew && p.entersInDays > 0) extra.push(fmtN(p.tooNew) + " جهة تدخل نطاق الفحص بعد " + fmtN(p.entersInDays) + (p.entersInDays >= 11 ? " يومًا" : " أيام"));
        else if (p.tooNew) extra.push(fmtN(p.tooNew) + " أحدث من النافذة");
        return '<button class="btn" style="display:block;text-align:start;padding:13px 15px;border:1px solid #EAECF0;background:#fff;border-radius:13px;height:auto;" onclick="segUsePreset(\\'' + p.id + '\\')">' +
          '<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:12.5px;font-weight:700;color:#101828;">' + esc(p.label) + '</span>' +
          '<span class="chip ' + (p.matched ? "c-ok" : "c-grey") + '">' + fmtN(p.matched) + "</span></div>" +
          '<div style="font-size:11px;color:#667085;margin-top:6px;line-height:1.8;">' + esc(p.hint) + "</div>" +
          (extra.length ? '<div style="font-size:10.5px;color:#B54708;margin-top:5px;">' + esc(extra.join(" · ")) + "</div>" : "") +
          "</button>";
      }).join("") + "</div>";
  }
  h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">' +
    '<span style="font-size:11.5px;font-weight:700;color:#667085;">المطابقة:</span>' +
    chipBtn("تنطبق كل الشروط", !segDef || segDef.match === "all", "segSetMatch(\\'all\\')") +
    chipBtn("ينطبق أي شرط", segDef && segDef.match === "any", "segSetMatch(\\'any\\')") +
    '<span style="flex:1"></span><span style="font-size:11.5px;font-weight:700;color:#667085;">النافذة:</span>' +
    [3, 5, 7, 14].map((d) => chipBtn(fmtN(d) + (d >= 11 ? " يومًا" : " أيام"), segWindow === d, "segSetWindow(" + d + ")")).join("") + "</div>";

  const conds = (segDef && segDef.conditions) || [];
  h += conds.map((c, i) =>
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:11px 13px;border:1px solid #EAECF0;border-radius:12px;background:#fff;margin-bottom:8px;">' +
    (i ? '<span class="chip c-grey" style="font-size:10.5px;">' + (segDef.match === "any" ? "أو" : "و") + "</span>" : "") +
    '<select class="inp" style="height:40px;flex:1;min-width:150px;" onchange="segSetField(' + i + ',\\'signal\\',this.value)">' +
      SEG_SIGNALS.map((sg) => '<option value="' + sg[0] + '"' + (c.signal === sg[0] ? " selected" : "") + ">" + sg[1] + "</option>").join("") + "</select>" +
    '<select class="inp" style="height:40px;min-width:110px;" onchange="segSetField(' + i + ',\\'comparator\\',this.value)">' +
      '<option value="happened"' + (c.comparator === "happened" ? " selected" : "") + ">حدث</option>" +
      '<option value="never_happened"' + (c.comparator === "never_happened" ? " selected" : "") + ">لم يحدث</option></select>" +
    '<span style="font-size:11px;color:#98A2B3;flex:1;min-width:120px;">' + (c.beforeDays ? "قبل أكثر من " + fmtN(c.beforeDays) + (c.beforeDays >= 11 ? " يومًا" : " أيام") : c.withinDays ? "خلال آخر " + fmtN(c.withinDays) + (c.withinDays >= 11 ? " يومًا" : " أيام") : "طوال الوقت") + "</span>" +
    '<button class="btn" style="height:36px;padding:0 12px;color:#B42318;background:#fff;border:1px solid #F7D4D1;" onclick="segDelCond(' + i + ')">حذف</button></div>').join("");
  h += '<button class="btn" style="font-size:12px;color:#1F7A73;background:#E9F7F6;border:1px solid #C4E8E5;margin-bottom:14px;" onclick="segAddCond()">+ أضف شرطًا</button>';

  // The result. Every zero explains itself — that distinction is the whole feature.
  if (segBusy) h += '<div style="font-size:12.5px;color:#667085;padding:10px 0;">جارٍ الحساب…</div>';
  else if (segPreview && segPreview.error) h += '<div class="sparse" style="border-inline-start-color:#B42318;">' + ic("eye", 16, "#B42318") + "<div>" + esc(segPreview.error) + "</div></div>";
  else if (segPreview) {
    const pv = segPreview;
    h += '<div style="background:#F4FBFA;border:1px solid #B9E4E0;border-radius:13px;padding:14px 16px;margin-bottom:12px;">' +
      '<div style="font-size:12.5px;color:#2E7D77;line-height:1.9;">' + esc(pv.describe) + "</div>" +
      '<div style="display:flex;align-items:baseline;gap:8px;margin-top:8px;"><span style="font-size:24px;font-weight:700;color:#2E7D77;">' + fmtN(pv.matched) + "</span>" +
      '<span style="font-size:12px;font-weight:600;color:#2E7D77;">جهة تطابق الآن</span>' +
      '<span style="font-size:11px;color:#7FA9A5;">العضوية تُحدَّث تلقائيًا</span></div>';
    const notes = [];
    if ((pv.suppressed || []).length) notes.push("مستبعد بالتبريد: " + fmtN(pv.suppressed.length) + " (رُوسلوا حديثًا)");
    if ((pv.tooNew || []).length) notes.push("أحدث من النافذة: " + fmtN(pv.tooNew.length));
    if (pv.scanTruncated) notes.push("فُحصت أحدث " + fmtN(pv.poolSize) + " جهة فقط");
    if (pv.overLaunchCap) notes.push("حد الدفعة الواحدة ٥٠ جهة — سترسل لأول " + fmtN(50) + " والباقي في دفعة تالية");
    if (notes.length) h += '<div style="font-size:11.5px;color:#B54708;margin-top:8px;line-height:1.9;">' + esc(notes.join(" · ")) + "</div>";
    h += "</div>";
    // The tenure state: a book younger than the window is a not-yet audience, not an empty one.
    if (!pv.matched && (pv.tooNew || []).length && pv.requiredDays > pv.oldestContactDays) {
      h += '<div class="sparse" style="border-inline-start-color:#B54708;">' + ic("clock", 16, "#B54708") +
        "<div><b>لا تطابق بعد — البيانات أحدث من النافذة.</b><br>أقدم جهة لديكم مضى عليها " + fmtN(pv.oldestContactDays) +
        " يومًا، والشرط يطلب " + fmtN(pv.requiredDays) + (pv.requiredDays >= 11 ? " يومًا" : " أيام") +
        ". أول تطابق متوقع بعد " + fmtN(Math.max(0, pv.requiredDays - pv.oldestContactDays)) + " أيام. " +
        '<span class="lnk" onclick="segSetWindow(3)">اضبط النافذة إلى ٣ أيام</span></div></div>';
    } else if (!pv.matched && !(pv.suppressed || []).length) {
      h += '<div class="sparse">' + ic("eye", 16, "#667085") + "<div>لا جهة تطابق هذه الشروط. راجعوا الحدث أو وسّعوا النافذة.</div></div>";
    }
  }
  // The constraint that makes this different from an email tool.
  h += '<div style="display:flex;gap:10px;align-items:flex-start;background:#FBF3DC;border:1px solid #F0DFB4;border-radius:12px;padding:12px 15px;font-size:12px;color:#8a6d10;line-height:1.9;">' +
    ic("clock", 16, "#8a6d10") +
    "<div><b>الإطلاق من هذه الشريحة غير متاح بعد.</b><br>" +
    "الجهة التي لم تردّ منذ أيام تقع خارج نافذة الـ٢٤ ساعة، ولا يصلها إلا قالب معتمد من Meta. " +
    "مسار الإطلاق الحالي يرسل رسائل جلسة، فلو أُتيح الزر هنا لرفضت واتساب الإرسال. " +
    "الشريحة جاهزة ومحسوبة، وينتظر ربطها بقوالب الرقم الإنتاجي.</div></div>";
  return h;
}

function launchTargets() {
  if (retargetCohort) return retargetCohort.targets;
  // In behavioural mode the audience IS the segment's matched set — suppressed and too-new
  // contacts are shown to the user but never silently included in a send.
  // Behaviour mode deliberately yields NO launch targets: the audience is outside the 24h window
  // by construction and the launch path sends session messages only. Returning targets here would
  // enable a button whose send WhatsApp refuses. The segment is still fully computed and shown.
  if (audMode === "behaviour") return [];
  return entities.filter(e => entSel.has(e.id)).map(e => ({ phone: e.phone, name: e.name }));
}
window.openLaunch = () => { if (!launchTargets().length || !campMsg.trim() || launching) return; document.getElementById("lmodal").style.display = "flex"; };
window.closeLaunch = () => { const m = document.getElementById("lmodal"); if (m) m.style.display = "none"; };
window.confirmLaunch = async () => {
  if (launching) return; launching = true;
  const btn = document.getElementById("lgo"); if (btn) { btn.textContent = "جارٍ الإرسال…"; }
  try {
    const targets = launchTargets();
    const reg = wizProducts();
    const prod = reg[selProd] ? reg[selProd].name : "";
    // Resolve the service variable in the founder's template before sending.
    const msgOut = campMsg.replaceAll("{product}", prod).replaceAll("{{1}}", prod);
    if (!targets.length) throw new Error("لم تُحدَّد أي جهة استهداف");
    if (!msgOut.trim()) throw new Error("نص الرسالة فارغ");
    const r = await fetch("/admin/campaign/launch", { method: "POST",
      headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ targets, message: msgOut, name: campName, product: prod, templateId: tplId }) });
    const d = await r.json().catch(() => ({}));
    closeLaunch();
    if (!r.ok) { alertBar("تعذّر الإطلاق: " + esc(d.error || r.status), true); render(false); return; }
    alertBar("أُرسلت " + fmtN(d.sent) + " من " + fmtN(d.requested) + ". فتحنا لك لوحة الحملة.", false);
    entSel.clear(); campName = ""; retargetCohort = null;
    setTimeout(() => { location.hash = d.campaignId ? "kmon/" + d.campaignId : "kmon"; refresh(); }, 1200);
  } catch (e) {
    closeLaunch();
    alertBar("تعذّر الإطلاق: " + esc(String(e && e.message ? e.message : e).slice(0, 90)), true);
  } finally {
    launching = false;
    const b2 = document.getElementById("lgo"); if (b2) b2.textContent = "تأكيد الإطلاق ✓";
  }
};
window.alertBar = (txt, bad) => {
  const el = document.createElement("div");
  el.style.cssText = "position:fixed;bottom:22px;right:290px;z-index:99;background:" + (bad ? "#FBE9E9" : "#E6F4EC") +
    ";color:" + (bad ? "#c43d3d" : "#1f8a52") + ";font-weight:700;font-size:13px;border-radius:11px;padding:13px 18px;box-shadow:0 8px 24px rgba(16,38,68,.14);";
  el.textContent = txt;
  document.body.appendChild(el); setTimeout(() => el.remove(), 3800);
};

function wizProducts() { return kbRegistry(); }
function vAimkt() {
  const reg = wizProducts();
  if (selProd >= reg.length) selProd = 0;
  const m = entMatches();
  const selN = launchTargets().length;
  const firstSel = retargetCohort ? retargetCohort.targets[0] : entities.find(e => entSel.has(e.id));
  const groups = segGroups();
  const allOn = m.length && m.every(e => entSel.has(e.id));
  const selName = reg[selProd] ? reg[selProd].name : "";
  const selAsset = prodAssets.find((a) => a.product === selName);

  let h = '<div class="step"><div class="hd"><span class="num done">١</span><div><div class="ht">أي خدمة يبيعها المساعد؟</div><div class="hs">القائمة تشمل خدمات Product Hub المرفوعة بملفاتها — لا تقتصر على الخدمات المدمجة.</div></div></div><div class="prods">' +
    reg.map((x, i) => {
      // Say which knowledge this service actually has. Removing the invented scores collapsed
      // every card onto the «Product Hub» branch, which claimed uploaded knowledge for six
      // services that have none — a new false claim in place of the old one.
      const inner = '<div style="height:6px;"></div>' + (x.hub
        ? '<span class="chip c-teal">معرفة من Product Hub ✓</span>'
        : '<span class="chip c-grey">معرفة مدمجة</span>');
      const pa = prodAssets.some((a) => a.product === x.name) ? ' <span class="chip c-grey">ملف تعريفي 📎</span>' : "";
      return '<button class="prod' + (i === selProd ? " on" : "") + '" onclick="pick(' + i + ')"><div class="pn">' + esc(x.name) + "</div>" + inner + pa + "</button>";
    }).join("") + "</div></div>";

  h += '<div class="step"><div class="hd"><span class="num' + (selN ? " done" : "") + '">٢</span><div><div class="ht">من يتواصل معهم؟</div><div class="hs">اختر شريحة كاملة أو حدّد جهات بعينها — العدد يُحدَّث فورًا.</div></div>' +
    '<span style="flex:1"></span><span style="display:inline-flex;align-items:baseline;gap:7px;background:#F4FBFA;border:1px solid #B9E4E0;border-radius:11px;padding:9px 16px;"><span style="font-size:20px;font-weight:700;color:#2E7D77;">' + fmtN(selN) + '</span><span style="font-size:11.5px;color:#2E7D77;font-weight:600;">' + (retargetCohort ? "فئة أُعيد التواصل معها" : "مختار من " + fmtN(entities.length)) + "</span></span></div>";
  if (!retargetCohort) {
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">' +
      chipBtn("حسب الملف", audMode === "file", "setAudMode(\\'file\\')") +
      chipBtn("حسب السلوك", audMode === "behaviour", "setAudMode(\\'behaviour\\')") +
      '<span style="flex:1"></span><span style="font-size:11.5px;color:#98A2B3;align-self:center;">السلوك يبني شريحة حيّة من سجل المحادثات</span></div>';
  }
  if (!retargetCohort && audMode === "behaviour") {
    h += vSegBuilder();
  } else
  if (retargetCohort) {
    h += '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;border:1px solid rgba(201,162,39,.45);background:rgba(201,162,39,.08);border-radius:14px;padding:16px 18px;">' +
      '<span style="font-size:22px;">⟲</span><div style="flex:1;min-width:220px;">' +
      '<div style="font-size:13.5px;font-weight:700;color:#101828;">إعادة استهداف: ' + esc(retargetCohort.label) + " — " + fmtN(retargetCohort.targets.length) + " جهة</div>" +
      '<div style="font-size:11.5px;color:#667085;margin-top:5px;">من حملة «' + esc(retargetCohort.campaign) + '» — القائمة مقفلة على هذه الفئة كما رأيتها في صفحة الحملة.</div></div>' +
      '<button class="btn" style="font-size:12px;color:#667085;background:#fff;border:1px solid #D0D5DD;" onclick="clearRetarget()">مسح والاختيار يدويًا</button></div>';
  } else if (!entities.length) {
    h += '<div style="border:1.5px dashed #D0D5DD;border-radius:12px;padding:26px;text-align:center;color:#667085;font-size:13px;line-height:2;">لا مستهدفين بعد — ارفع ملف Excel أو CSV في شاشة <a href="#customers" style="color:#2E7D77;font-weight:700;">جهات الاستهداف</a>، وستظهر شرائح أعمدته هنا تلقائيًا.</div>';
  } else {
    h += groups.map((g, ki) =>
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;">' +
      '<span style="font-size:11.5px;font-weight:700;color:#667085;min-width:52px;">' + esc(g.key) + ":</span>" +
      chipBtn("الكل", !entFilters[g.key], "entSetAttr(" + ki + ",-1)") +
      g.values.map(([v, n], vi) => chipBtn(v + " (" + fmtN(n) + ")", entFilters[g.key] === v, "entSetAttr(" + ki + "," + vi + ")")).join("") +
      "</div>").join("");
    h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
      '<input id="eq" value="' + esc(entQ) + '" oninput="entSearch(this)" placeholder="ابحث بالاسم أو الرقم…" style="font-family:inherit;flex:1;min-width:200px;font-size:12.5px;border:1px solid #EAECF0;border-radius:10px;padding:9px 13px;background:#F9FAFB;">' +
      '<button class="btn" style="font-size:12px;color:#1F4470;background:#E3ECF8;" onclick="entAllMatching()">' + (allOn ? "إلغاء تحديد المطابقين" : "تحديد المطابقين (" + fmtN(m.length) + ")") + '</button>' +
      (selN ? '<button class="btn" style="font-size:12px;color:#667085;background:#fff;border:1px solid #D0D5DD;" onclick="entClear()">مسح الاختيار</button>' : "") + "</div>";
    const shown = m.slice(0, LIST_CAP);
    if (m.length > LIST_CAP) {
      h += '<div style="display:flex;align-items:center;gap:12px;background:#F4FBFA;border:1px solid #B9E4E0;border-radius:12px;padding:12px 16px;margin-bottom:10px;">' +
        '<span style="font-size:19px;font-weight:700;color:#2E7D77;">' + fmtN(m.length) + '</span>' +
        '<span style="font-size:12px;color:#2E7D77;line-height:1.8;">جهة مطابقة للشرائح الحالية — القائمة أدناه معاينة لأول ' + fmtN(LIST_CAP) + '. «تحديد المطابقين» يختارهم <b>جميعًا</b> دون الحاجة لتصفحهم.</span></div>';
    }
    h += '<div style="border:1px solid #EAECF0;border-radius:12px;overflow:hidden;max-height:300px;overflow-y:auto;" class="ms-scroll">' +
      shown.map((e) => {
        const on = entSel.has(e.id);
        return '<div onclick="entTog(' + e.id + ')" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid #F2F4F7;cursor:pointer;' + (on ? "background:#F4FBFA;" : "") + '">' +
          '<span style="width:17px;height:17px;flex:none;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;' + (on ? "background:#2E8F89;" : "border:1.5px solid #D0D5DD;background:#fff;") + '">' + (on ? "✓" : "") + "</span>" +
          '<span style="flex:1;min-width:0;font-size:13px;font-weight:600;color:#101828;">' + esc(e.name) + "</span>" +
          attrChips(e, 3) +
          '<span style="font-size:11px;color:#98A2B3;direction:ltr;">+' + esc(e.phone) + "</span></div>";
      }).join("") +
      (m.length > LIST_CAP ? '<div style="padding:12px;text-align:center;color:#667085;font-size:12px;background:#fafbfc;">+ ' + fmtN(m.length - LIST_CAP) + ' آخرون مطابقون — ضيّق بالشرائح أو البحث لاستعراضهم</div>' : "") +
      (m.length ? "" : '<div style="padding:22px;text-align:center;color:#98A2B3;font-size:12.5px;">لا نتائج مطابقة</div>') + "</div>";
  }
  h += "</div>";

  h += '<div class="step"><div class="hd"><span class="num">٣</span><div><div class="ht">رسالة الافتتاح</div><div class="hs">اختر قالبًا معتمدًا، أو اكتب رسالتك. استخدم {name} لاسم الجهة و{{1}} لاسم الخدمة. بعد أول رد، يتولى المساعد البائع الحوار كاملًا.</div></div></div>' +
    // The template picker. Each card states WHO it is for, because the two templates open on
    // different premises — one on a pain we assume, one on usage we already observed. Sending the
    // «استخدام مرتفع» opener to a facility that has never used the service is a visible lie.
    (tpls.length ? '<div role="radiogroup" aria-label="القالب المعتمد" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-bottom:18px;">' +
      tpls.map((t, i) => {
        const on = tplId === t.id;
        return '<div role="radio" tabindex="0" aria-checked="' + (on ? "true" : "false") +
          '" onclick="tplPick(' + i + ')" onkeydown="tplKey(event,' + i + ')" style="cursor:pointer;border:1.5px solid ' + (on ? "#3FB6B0" : "#EAECF0") +
          ";background:" + (on ? "#F6FCFB" : "#fff") + ';border-radius:16px;padding:18px;transition:.18s ease;' + (on ? "box-shadow:0 0 0 3px rgba(63,182,176,.12);" : "") + '">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">' +
          '<span style="width:15px;height:15px;flex:none;border-radius:50%;border:1.5px solid ' + (on ? "#1F7A73" : "#D0D5DD") +
          ";background:" + (on ? "#1F7A73" : "#fff") + ';box-shadow:inset 0 0 0 2.5px #fff;"></span>' +
          '<span style="font-size:12.5px;font-weight:700;color:#101828;">' + esc(t.label) + "</span></div>" +
          '<div style="font-size:11.5px;color:#667085;line-height:1.75;">' + esc(t.hint) + "</div>" +
          '<div style="font-size:10.5px;color:#98A2B3;margin-top:6px;">لِمن: ' + esc(t.audience) + "</div>" +
          '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px;">' +
          t.buttons.map((b) => '<span style="font-size:11.5px;font-weight:700;color:#2F5F94;background:#E3ECF8;border-radius:999px;padding:4px 12px;">' + esc(b) + "</span>").join("") +
          "</div></div>";
      }).join("") + "</div>" : "") +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;align-items:start;">' +
    '<div><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;"><span style="font-size:11.5px;color:#667085;font-weight:600;">نص الرسالة</span>' +
    '<span style="flex:1"></span><button id="cmpbtn" class="btn btn-ghost" style="font-size:11.5px;padding:7px 13px;display:inline-flex;align-items:center;gap:6px;" onclick="composeMsg()">' + ic("spark", 15, "#1F7A73") + "اكتبها بالذكاء الاصطناعي</button></div>" +
    '<textarea oninput="campMsgSet(this)" rows="6" style="font-family:inherit;width:100%;font-size:12.5px;color:#101828;border:1.5px solid #EAECF0;border-radius:12px;padding:13px;line-height:2;resize:vertical;">' + esc(campMsg) + "</textarea>" +
    "</div>" +
    '<div><div style="font-size:11.5px;color:#667085;font-weight:600;margin-bottom:8px;">معاينة واتساب — رسالة واحدة بأزرار، والملف يُرسَل عند طلبه</div>' +
    '<div class="wa-prev">' +
    '<div class="b" style="padding:0;overflow:hidden;">' +
    // The opener no longer carries the file — it offers it, so no attachment is drawn here.
    '<div style="padding:12px 14px;white-space:pre-wrap;">' + esc(campMsg.replaceAll("{name}", (firstSel ? firstSel.name : "مجمع النور الطبي")).replaceAll("{product}", selName).replaceAll("{{1}}", selName)) + "</div></div>" +
    '<div style="font-size:10.5px;color:#5b6b52;padding:0 4px;margin-top:6px;">حلول تكامل للقطاع الصحي</div>' +
    '<div class="t">رسالة واحدة · الآن ✓✓</div>' +
    '<div style="display:flex;flex-direction:column;gap:5px;margin-top:9px;">' +
    // The preview draws the buttons that will actually be sent — resolved from the same registry
    // the launch route reads. It used to draw three hardcoded titles that no template used.
    tplButtons().map((b) => '<div style="text-align:center;background:#fff;border-radius:8px;padding:8px;font-size:11.5px;font-weight:700;color:#2F5F94;box-shadow:0 1px 1px rgba(16,38,68,.08);">' + esc(b) + "</div>").join("") +
    "</div></div>" +
    (selAsset ? "" : '<div style="font-size:10.5px;color:#b5810f;margin-top:8px;">لا ملف تعريفيًا لهذه الخدمة بعد — إن طلبه العميل فلن نجد ما نرسله. أضفه من معرفة الخدمة.</div>') +
    "</div></div></div>";

  const can = selN > 0 && campMsg.trim();
  h += '<div class="step" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;">' +
    '<label style="font-size:12.5px;font-weight:700;color:#101828;flex:none;">اسم الحملة</label>' +
    '<input value="' + esc(campName) + '" oninput="campNameSet(this)" placeholder="حملة ' + esc(selName) + ' — تُسمّى تلقائيًا إن تُركت فارغة" style="font-family:inherit;flex:1;min-width:220px;font-size:13px;font-weight:600;color:#101828;border:1.5px solid #EAECF0;border-radius:11px;padding:11px 14px;">' +
    "</div>";
  // Docked, not floating, and compact on a phone. He reviews on his own device and briefs by
  // screenshot: at 390px this bar was three lines tall, occupied about a quarter of the viewport,
  // and sat directly over the template cards — the feature he asked for, hidden by the chrome.
  // The lbar class (see the stylesheet) drops the padding and the secondary line under 430px.
  // NO BACKTICKS ANYWHERE IN THIS FILE — it is one template literal and a backtick closes it.
  h += '<div class="step lbar" style="position:sticky;bottom:0;margin-bottom:-56px;z-index:5;display:flex;align-items:center;gap:14px;flex-wrap:wrap;border-radius:16px 16px 0 0;box-shadow:0 -10px 30px rgba(15,37,64,.13);border:1px solid #e2e8f1;border-bottom:none;">' +
    // In behaviour mode there is nothing to launch and the reason is not «you picked nobody» —
    // it is that this audience needs an approved template the send path does not yet use. Saying
    // «٠ جهة استهداف» beside a live-looking button is a dead control, which is its own defect.
    (audMode === "behaviour" && !retargetCohort
      ? '<div style="flex:1;min-width:200px;"><div style="font-size:13px;font-weight:700;color:#8a6d10;">الشريحة محسوبة — الإطلاق ينتظر القوالب المعتمدة</div>' +
        '<div style="font-size:10.5px;color:#98A2B3;margin-top:4px;">استخدم «حسب الملف» للإطلاق الآن، أو انتقل إلى الرقم الإنتاجي لتفعيل الإرسال بالقوالب.</div></div>'
      : '<div style="flex:1;min-width:200px;"><div style="font-size:13px;font-weight:700;color:#101828;">' + fmtN(selN) + " جهة استهداف · " + esc(selName) +
    // This chip used to claim the file was attached to the opener. It is not — the opener OFFERS
    // it and the preview caption twenty pixels above said so, so the screen contradicted itself.
    // State what will actually be sent, next to the button that sends it.
    (selAsset ? " · الملف عند الطلب" : "") + "</div>" +
        '<div class="lsub" style="font-size:10.5px;color:#98A2B3;margin-top:4px;">ساندبوكس: يستلم فعليًا من انضم للرقم التجريبي — البقية تظهر «فشل الإرسال» بشفافية.</div></div>') +
    '<button class="btn ' + (can ? "btn-teal" : "btn-dis") + '"' + (can ? "" : ' disabled aria-disabled="true"') +
      ' style="font-size:14.5px;padding:14px 30px;" onclick="openLaunch()">إطلاق الحملة ←</button></div>';

  h += '<div id="lmodal" style="display:none;position:fixed;inset:0;background:rgba(15,37,64,.5);z-index:60;align-items:flex-start;justify-content:center;padding:60px 24px;">' +
    '<div style="width:100%;max-width:460px;background:#fff;border-radius:16px;border-top:4px solid #3FB6B0;box-shadow:0 24px 60px rgba(15,37,64,.3);padding:24px;">' +
    '<div style="font-size:17px;font-weight:700;color:#101828;margin-bottom:8px;">تأكيد إطلاق الحملة</div>' +
    '<div style="font-size:13px;color:#475467;line-height:2;margin-bottom:18px;">سيرسل المساعد رسالة الافتتاح إلى <b style="color:#2E7D77;">' + fmtN(selN) + ' مستهدف</b> عبر واتساب (ساندبوكس)، ثم يتابع كل ردّ ببيع كامل. هذه الخطوة هي موافقتك البشرية على الإرسال.</div>' +
    (selN > 50 ? '<div style="font-size:12px;color:#b5810f;background:#FBF3DC;border-radius:10px;padding:10px 14px;line-height:1.9;margin-bottom:14px;">حد الدفعة الواحدة حاليًا <b>٥٠</b> — قلّص الاختيار أو أطلق على دفعات. الإرسال الجماعي المجدول يأتي مع محرك الحملات القادم.</div>' : "") +
    '<div style="display:flex;gap:10px;"><button id="lgo" class="btn btn-teal" onclick="confirmLaunch()">تأكيد الإطلاق ✓</button>' +
    '<button class="btn" style="color:#475467;background:#F2F4F7;" onclick="closeLaunch()">إلغاء</button></div></div></div>';
  return h;
}

function mdRender(md) {
  return md.split("\\n").map((raw) => {
    const l = raw.trim();
    if (!l) return "";
    if (l.startsWith("# ")) return '<div style="font-size:15px;font-weight:700;color:#101828;margin:4px 0 10px;">' + esc(l.slice(2)) + "</div>";
    if (l.startsWith("## ")) return '<div style="font-size:12.5px;font-weight:700;color:#2E7D77;margin:14px 0 6px;">' + esc(l.slice(3)) + "</div>";
    if (l.startsWith("- ") || l.startsWith("* ")) return '<div style="display:flex;gap:8px;padding:2px 0;"><span style="width:5px;height:5px;flex:none;margin-top:9px;border-radius:999px;background:#3FB6B0;"></span><span style="font-size:12.5px;color:#475467;line-height:1.9;">' + esc(l.slice(2)) + "</span></div>";
    return '<div style="font-size:12.5px;color:#475467;line-height:1.9;">' + esc(l) + "</div>";
  }).join("");
}
window.kbPick = () => document.getElementById("kbfile").click();
window.paPick = () => document.getElementById("pafile").click();
window.paUpload = async (input) => {
  const f = input.files && input.files[0];
  if (!f) return;
  const st = document.getElementById("pastat");
  st.innerHTML = '<span class="chip c-warn">جارٍ رفع الملف…</span>';
  const fd = new FormData(); fd.append("product", input.dataset.product || ""); fd.append("file", f);
  try {
    const r = await fetch("/admin/product-asset/upload", { method: "POST", headers: { "x-admin-token": TOKEN }, body: fd });
    const d = await r.json();
    if (!r.ok) { st.innerHTML = '<span class="chip c-bad">تعذّر: ' + esc(d.error || r.status) + "</span>"; return; }
    st.innerHTML = '<span class="chip c-ok">أصبح المساعد يرسل هذا الملف ✓</span>';
    const ar = await fetch("/admin/product-assets", { headers: { "x-admin-token": TOKEN } });
    if (ar.ok) prodAssets = await ar.json();
    render(false);
  } catch (e) { st.innerHTML = '<span class="chip c-bad">خطأ في الرفع</span>'; }
  input.value = "";
};
window.kbUpload = async (input) => {
  const f = input.files && input.files[0];
  if (!f) return;
  const st = document.getElementById("kbstat");
  st.innerHTML = '<span class="chip c-warn">جارٍ التحليل والاستخراج… قد يستغرق دقيقة</span>';
  const scoped = input.dataset.product || "";
  const fd = new FormData();
  if (scoped) fd.append("product", scoped);   // field MUST precede the file in the multipart stream
  fd.append("file", f);
  try {
    const r = await fetch("/admin/kb/upload", { method: "POST", headers: { "x-admin-token": TOKEN }, body: fd });
    const d = await r.json();
    if (!r.ok) { st.innerHTML = '<span class="chip c-bad">تعذّر: ' + esc(d.error || r.status) + "</span>"; return; }
    st.innerHTML = '<span class="chip c-ok">تم — «' + esc(d.product) + '» أصبح ضمن معرفة المساعد ✓</span>';
    const kr = await fetch("/admin/kb", { headers: { "x-admin-token": TOKEN } });
    if (kr.ok) kbDocs = await kr.json();
    if (scoped) { render(false); } else { location.hash = "kb/" + encodeURIComponent(d.product); }
  } catch (e) { st.innerHTML = '<span class="chip c-bad">خطأ في الرفع</span>'; }
  input.value = "";
};

function kbRegistry() {
  const hubByName = new Map(kbDocs.map((d) => [d.product, d]));
  const reg = PRODUCTS.map((p) => ({ name: p.n, sc: null, hub: hubByName.get(p.n) || null, seed: true }));
  kbDocs.forEach((d) => { if (d.product !== "__skill__" && !reg.some((r) => r.name === d.product)) reg.push({ name: d.product, sc: null, hub: d, seed: false }); });
  return reg;
}
function uploadZone(scopedProduct) {
  return '<div onclick="kbPick()" style="border:1.5px dashed #D0D5DD;background:#F9FAFB;border-radius:14px;padding:26px 20px;text-align:center;cursor:pointer;">' +
    '<div style="width:44px;height:44px;margin:0 auto 12px;border-radius:12px;background:#E3ECF8;display:flex;align-items:center;justify-content:center;"><span style="width:15px;height:15px;border:2.5px solid #2F5F94;border-radius:4px;"></span></div>' +
    '<div style="font-size:13.5px;font-weight:700;color:#101828;">' + (scopedProduct ? "ارفع ملف الخدمة — PDF أو Word أو PowerPoint" : "أضف خدمة مع ملفها — PDF أو Word أو PowerPoint") + "</div>" +
    '<div style="font-size:11.5px;color:#667085;margin-top:7px;line-height:1.9;">الملفات الرسمية المعتمدة فقط · محرك التحليل: Firecrawl AnyDoc · يُحفظ Markdown في Product Hub' + (scopedProduct ? "<br>يُضاف تحت هذه الخدمة ويقرأه المساعد فورًا" : "<br>يُستخرج اسم الخدمة من الملف تلقائيًا") + "</div></div>" +
    '<input id="kbfile" type="file" accept=".pdf,.docx,.pptx,.xlsx,.rtf,.odt,.epub,.csv" style="display:none" data-product="' + esc(scopedProduct || "") + '" onchange="kbUpload(this)">' +
    '<div id="kbstat" style="margin-top:12px;"></div>';
}
function vKb() {
  let h0 = "";
  const reg = kbRegistry();
  const tone = (sc) => sc >= 80 ? "#1f8a52" : sc >= 60 ? "#b5810f" : "#c43d3d";
  const skill = prodAssets.find((a) => a.product === "__skill__");
  if (skill) {
    h0 = '<div class="card" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#F4FBFA;border-color:#B9E4E0;">' +
      '<div style="flex:1;min-width:220px;"><div style="font-size:13.5px;font-weight:700;color:#101828;">مهارة إنشاء العروض — lean-proposal-deck</div>' +
      '<div style="font-size:11.5px;color:#475467;margin-top:5px;line-height:1.8;">حمّلها وأنتج بها عروض الخدمات (PDF) ثم ارفعها هنا في صفحة كل خدمة. <span style="direction:ltr;color:#98A2B3;">' + esc(skill.filename) + '</span></div></div>' +
      '<a class="btn btn-teal" style="text-decoration:none;" href="/assets/' + esc(skill.public_id) + '" download>تحميل المهارة ⬇</a></div>';
  }
  let h = h0 + '<div class="sec">خدمات المساعد <span class="meta">' + fmtN(reg.length) + ' خدمة · اضغط خدمةً لعرض معرفته وإدارتها</span></div>';
  h += '<div class="prods" style="margin-bottom:20px;">' + reg.map((r) => {
    const inner =
      '<div class="pn">' + esc(r.name) + "</div>" +
      (r.sc !== null
        ? '<span class="sc" style="color:' + tone(r.sc) + '">' + fmtN(r.sc) + '٪</span> <span class="scl">درجة معرفة المساعد</span><div class="bar"><i style="width:' + r.sc + '%;background:' + tone(r.sc) + ';"></i></div>'
        : '<div style="height:6px;"></div>') +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' +
      (r.hub ? '<span class="chip c-ok">معرفة ✓</span>' : '<span class="chip c-grey">لا معرفة بعد</span>') +
      (prodAssets.some((a) => a.product === r.name) ? '<span class="chip c-teal">ملف تعريفي 📎</span>' : "") +
      '<span style="flex:1"></span><span style="font-size:12px;font-weight:700;color:#2F5F94;">افتح التفاصيل ←</span></div>';
    return '<a href="#kb/' + encodeURIComponent(r.name) + '" style="text-decoration:none;"><div class="prod" style="cursor:pointer;">' + inner + "</div></a>";
  }).join("") + "</div>";
  return h;
}
function vKbProduct(name) {
  const reg = kbRegistry();
  const r = reg.find((x) => x.name === name);
  if (!r) return '<div class="empty"><div class="ic"><span></span></div><div class="t">الخدمة غير موجودة</div><div class="s"><a href="#kb" style="color:#1F7A73;font-weight:700;">→ كل الخدمات</a></div></div>';
  const seedP = PRODUCTS_FULL.find((p) => p.n === name);
  const prodCamps = campaigns.filter((c) => (c.product || "") === name);
  const wlProd = ((winloss && winloss.by_product) || []).find((x) => x.product === name);
  const prodCauses = ((winloss && winloss.loss_causes) || []).filter((c) => (c.products || []).includes(name));
  const pa0 = prodAssets.find((a) => a.product === name);
  const ready = r.sc !== null ? r.sc : (r.hub ? 100 : 0);
  const readyTone = ready >= 80 ? "#027A48" : ready >= 60 ? "#B54708" : "#B42318";

  let h = '<a href="#kb" style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#475467;text-decoration:none;margin-bottom:14px;">→ كل الخدمات</a>';

  // ── Hero: identity, readiness ring, and the primary action together ──
  h += '<div class="card rise" style="display:flex;gap:22px;align-items:center;flex-wrap:wrap;padding:26px 24px;">' +
    '<div style="width:56px;height:56px;flex:none;border-radius:16px;background:linear-gradient(135deg,#1F4470,#2F5F94);display:flex;align-items:center;justify-content:center;color:#7FE3DC;font-weight:700;font-size:24px;">' + esc(name.trim().charAt(0)) + "</div>" +
    '<div style="flex:1;min-width:220px;">' +
    '<h1 style="margin:0;font-size:23px;font-weight:700;color:#101828;letter-spacing:-.3px;">' + esc(name) + "</h1>" +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:9px;align-items:center;">' +
    (r.hub ? '<span class="chip c-ok">جاهزة للبيع</span>' : '<span class="chip c-warn">بانتظار ملف المعرفة</span>') +
    (pa0 ? '<span class="chip c-teal">ملف تعريفي مرفق</span>' : '<span class="chip c-grey">دون ملف تعريفي</span>') +
    (r.hub && r.hub.source_filename ? '<span style="font-size:10.5px;color:#98A2B3;direction:ltr;">' + esc(r.hub.source_filename) + "</span>" : "") +
    "</div></div>" +
    '<div style="flex:none;display:flex;align-items:center;gap:12px;">' +
    '<div style="position:relative;width:64px;height:64px;flex:none;">' +
    '<svg viewBox="0 0 36 36" style="width:64px;height:64px;transform:rotate(-90deg);"><circle cx="18" cy="18" r="15.5" fill="none" stroke="#EAECF0" stroke-width="3.2"/>' +
    '<circle cx="18" cy="18" r="15.5" fill="none" stroke="' + readyTone + '" stroke-width="3.2" stroke-linecap="round" stroke-dasharray="' + (ready * 0.974) + ' 100"/></svg>' +
    '<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;"><span style="font-size:14px;font-weight:700;color:#101828;">' + fmtN(ready) + "٪</span></div></div>" +
    '<div style="font-size:11px;color:#667085;font-weight:600;line-height:1.6;max-width:78px;">جاهزية<br>معرفة المساعد</div></div>' +
    '<button class="btn btn-teal" style="flex:none;" data-prod="' + esc(name) + '" onclick="launchWithProduct(this.dataset.prod)">أطلق حملة بهذه الخدمة ←</button>' +
    "</div>";

  // ── Performance row: one scoreboard, not scattered chips ──
  const cells = [
    ["حملات الخدمة", prodCamps.length, "#101828"],
    ["صفقات مكتسبة", (wlProd && wlProd.won) || 0, "#027A48"],
    ["غير مكتسبة", (wlProd && wlProd.lost) || 0, "#B42318"],
    ["قيد التفاوض", (wlProd && wlProd.active) || 0, "#2F5F94"],
  ];
  h += '<div class="card rise" style="padding:0;overflow:hidden;">' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));">' +
    cells.map((c, i) => '<div style="padding:20px 22px;' + (i ? "border-inline-start:1px solid #EAECF0;" : "") + '">' +
      '<div style="font-size:11.5px;color:#667085;font-weight:600;">' + c[0] + "</div>" +
      '<div style="font-size:26px;font-weight:700;color:' + c[2] + ';margin-top:6px;font-variant-numeric:tabular-nums;">' + fmtN(c[1]) + "</div></div>").join("") +
    "</div>" +
    (prodCamps.length || prodCauses.length
      ? '<div style="border-top:1px solid #EAECF0;background:#F9FAFB;padding:14px 22px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">' +
        (prodCauses.length ? '<span style="font-size:11.5px;font-weight:700;color:#B42318;">أبرز سبب لعدم الإغلاق: ' + esc(prodCauses[0].cause) + '</span><span style="flex:1"></span>' : '<span style="flex:1"></span>') +
        prodCamps.slice(0, 3).map((c) => '<a href="#kmon/' + c.id + '" class="chip c-blue" title="' + esc(c.name) + '" style="text-decoration:none;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;">' + esc(c.name) + "</a>").join("") +
        "</div>"
      : "") +
    "</div>";
  const pa = prodAssets.find((a) => a.product === name);
  const fileRow = (title, sub, chip, btnLabel, onclick) =>
    '<div style="display:flex;align-items:center;gap:14px;padding:18px 22px;border-bottom:1px solid #F2F4F7;flex-wrap:wrap;">' +
    '<div style="width:40px;height:40px;flex:none;border-radius:11px;background:#F2F4F7;display:flex;align-items:center;justify-content:center;color:#475467;">' + ic("doc", 19) + "</div>" +
    '<div style="flex:1;min-width:200px;"><div style="font-size:13.5px;font-weight:700;color:#101828;">' + title + "</div>" +
    '<div style="font-size:11.5px;color:#667085;margin-top:4px;line-height:1.8;">' + sub + "</div></div>" +
    chip + '<button class="btn btn-ghost" style="font-size:12px;padding:9px 16px;" onclick="' + onclick + '">' + btnLabel + "</button></div>";
  h += '<div class="card" style="padding:0;overflow:hidden;"><div style="padding:18px 22px 0;"><h3 style="margin:0 0 4px;">ملفات الخدمة</h3>' +
    '<div style="font-size:11.5px;color:#98A2B3;margin-bottom:14px;">ما يرسله المساعد للعميل، وما يقرأه ليبيع</div></div>' +
    fileRow("الملف التعريفي", "يُرسل مع افتتاحية الحملة وعند طلب العميل للتفاصيل" + (pa ? ' · <span style="direction:ltr;">' + esc(pa.filename) + "</span>" : ""),
      (pa ? '<span class="chip c-ok">مرفق</span>' : '<span class="chip c-grey">غير مرفق</span>'),
      (pa ? "استبدال" : "رفع PDF"), "paPick()") +
    fileRow("ملف المعرفة", "يقرأه المساعد ليجيب عن الأسعار والاعتراضات" + (r.hub && r.hub.source_filename ? ' · <span style="direction:ltr;">' + esc(r.hub.source_filename) + "</span>" : ""),
      (r.hub ? '<span class="chip c-ok">محمّل</span>' : '<span class="chip c-warn">مطلوب</span>'),
      (r.hub ? "تحديث" : "رفع الملف"), "kbPick()") +
    '<input id="pafile" type="file" accept=".pdf" style="display:none" data-product="' + esc(name) + '" onchange="paUpload(this)">' +
    '<input id="kbfile" type="file" accept=".pdf,.docx,.pptx,.xlsx,.rtf,.odt,.epub,.csv" style="display:none" data-product="' + esc(name) + '" onchange="kbUpload(this)">' +
    '<div style="padding:12px 22px;"><span id="pastat"></span> <span id="kbstat"></span></div></div>';
  if (r.hub) {
    h += '<div class="card"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:8px;">' +
      '<h3 style="margin:0;">المعرفة المعتمدة (Product Hub)</h3><span class="chip c-ok">يقرأها المساعد في كل محادثة</span></div>' +
      '<div style="border-top:1px solid #F2F4F7;padding-top:12px;">' + mdRender(r.hub.md) + "</div></div>";
  }
  if (seedP) {
    h += '<div class="card"><h3>المعرفة الأساسية المدمجة</h3><div style="border:1px solid #EAECF0;border-radius:12px;overflow:hidden;">' +
      [["العرض", seedP.pitch], ["الكفاءة", seedP.eff.join(" · ")], ["ملائم لـ", seedP.best.join("، ")], ["التسعير المعتمد", seedP.pricing]]
        .map((x) => '<div class="kbrow"><span class="dt" style="background:#2e9e6b;"></span><div class="ti"><div class="t1">' + esc(x[0]) + '</div><div class="t2">' + esc(x[1]) + "</div></div></div>").join("") + "</div></div>";
  }
  {
    // Was a hardcoded block asserting «جاهزية الأقسام — 92%», invented pricing, «3 عناصر»,
    // «2 من 8» and «0 ملفات» — the last one rendered directly beneath the real attached file.
    // None of it came from data. A readiness figure the founder cannot trace to a source is
    // worse than no readiness figure, so this is computed from what we actually hold.
    const kbDoc = kbDocs.find((d) => d.product === name);
    const asset = prodAssets.find((a) => a.product === name);
    const camps = campaigns.filter((cp) => (cp.product || "") === name);
    const rows = [
      ["المعرفة المعتمدة", kbDoc ? "مستخرجة من ملف معتمد وجاهزة للمساعد" : "لم تُرفع بعد — المساعد يبيع من المعرفة المدمجة فقط", Boolean(kbDoc)],
      ["الملف التعريفي", asset ? esc(asset.filename) : "لا ملف مرفق — لن يرسل المساعد مرفقًا لهذه الخدمة", Boolean(asset)],
      ["الحملات المطلقة", camps.length ? fmtN(camps.length) + " حملة تستخدم هذه الخدمة" : "لم تُطلق حملة بهذه الخدمة بعد", camps.length > 0],
      ["حكم السوق", wlProd && (wlProd.won || wlProd.lost)
        ? fmtN(wlProd.won || 0) + " مكتسبة · " + fmtN(wlProd.lost || 0) + " غير مكتسبة"
        : "يتعلّم — لا صفقات محكومة بعد", Boolean(wlProd && (wlProd.won || wlProd.lost))],
    ];
    const done = rows.filter((r) => r[2]).length;
    h += '<div class="card"><h3>جاهزية الخدمة <span class="meta">' + fmtN(done) + " من " + fmtN(rows.length) + " مكتملة</span></h3>" +
      '<div style="border:1px solid #EAECF0;border-radius:12px;overflow:hidden;">' +
      rows.map((r) => '<div class="kbrow"><span class="dt" style="background:' + (r[2] ? "#2e9e6b" : "#D0D5DD") + ';"></span>' +
        '<div class="ti"><div class="t1">' + esc(r[0]) + '</div><div class="t2">' + r[1] + "</div></div>" +
        '<span class="chip ' + (r[2] ? "c-ok" : "c-grey") + '">' + (r[2] ? "جاهز" : "ناقص") + "</span></div>").join("") +
      "</div></div>";
  }
  return h;
}

window.entImport = async () => {
  const ta = document.getElementById("entpaste");
  if (!ta.value.trim()) return;
  const st = document.getElementById("entstat");
  st.innerHTML = '<span class="chip c-warn">جارٍ الاستيراد…</span>';
  try {
    const r = await fetch("/admin/entities", { method: "POST", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ text: ta.value }) });
    const d = await r.json();
    if (!r.ok) { st.innerHTML = '<span class="chip c-bad">' + esc(d.error || r.status) + "</span>"; return; }
    st.innerHTML = '<span class="chip c-ok">أُضيف ' + fmtN(d.added) + "</span> " + (d.updated ? '<span class="chip c-teal">حُدّث ' + fmtN(d.updated) + "</span> " : "") + (d.invalid ? '<span class="chip c-bad">غير صالح ' + fmtN(d.invalid) + "</span>" : "");
    ta.value = "";
    const er = await fetch("/admin/entities", { headers: { "x-admin-token": TOKEN } });
    if (er.ok) entities = await er.json();
    render(false);
  } catch (e) { st.innerHTML = '<span class="chip c-bad">خطأ</span>'; }
};
function manualRowsHtml() {
  const F = (i, k, ph, w) => '<input class="inp" data-i="' + i + '" data-k="' + k + '" value="' + esc(manualRows[i][k]) + '" oninput="entRowSet(this)" placeholder="' + ph + '" style="flex:' + w + ';min-width:0;font-size:12.5px;padding:10px 13px;">';
  return manualRows.map((r, i) =>
    '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">' +
    F(i, "name", "اسم الجهة", "2.2") + F(i, "phone", "الجوال", "1.5") +
    F(i, "size", "الحجم — اختياري", "1.1") + F(i, "city", "المدينة — اختيارية", "1.1") +
    (manualRows.length > 1
      ? '<button class="kebab" title="حذف الصف" data-i="' + i + '" onclick="entDelRow(this)" style="flex:none;">×</button>'
      : '<span style="width:32px;flex:none;"></span>') + "</div>").join("");
}
window.entRowSet = (el) => { manualRows[+el.dataset.i][el.dataset.k] = el.value; };
window.entManualOpened = () => { manualStat = ""; };
window.entAddRow = () => {
  manualStat = "";
  manualRows.push({ name: "", phone: "", size: "", city: "" });
  const box = document.getElementById("manualrows");
  if (box) { box.innerHTML = manualRowsHtml(); const ins = box.querySelectorAll("input"); if (ins.length >= 4) ins[ins.length - 4].focus(); }
};
window.entDelRow = (btn) => {
  manualRows.splice(+btn.dataset.i, 1);
  if (!manualRows.length) manualRows = [{ name: "", phone: "", size: "", city: "" }];
  const box = document.getElementById("manualrows");
  if (box) box.innerHTML = manualRowsHtml();
};
window.entTogglePaste = () => {
  const b = document.getElementById("pastebox");
  if (b) b.style.display = b.style.display === "none" ? "block" : "none";
};
window.entManualSave = async () => {
  const rows = manualRows.filter((r) => r.name.trim() || r.phone.trim());
  const st = document.getElementById("entstat");
  if (!rows.length) { if (st) st.innerHTML = '<span class="chip c-warn">أدخل جهة واحدة على الأقل</span>'; return; }
  const bad = rows.filter((r) => !r.name.trim() || r.phone.replace(/[^0-9٠-٩]/g, "").length < 9);
  if (bad.length) { if (st) st.innerHTML = '<span class="chip c-bad">تحقّق من الاسم والجوال في ' + fmtN(bad.length) + ' صف</span>'; return; }
  if (st) st.innerHTML = '<span class="chip c-teal">جارٍ الحفظ…</span>';
  const text = rows.map((r) => [r.name.trim(), r.phone.trim(), r.size.trim(), r.city.trim()].filter(Boolean).join("، ")).join("\\n");
  try {
    const res = await fetch("/admin/entities", { method: "POST", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
    const d = await res.json();
    if (!res.ok) { if (st) st.innerHTML = '<span class="chip c-bad">' + esc(d.error || res.status) + "</span>"; return; }
    manualStat = '<span class="chip c-ok">أُضيف ' + fmtN(d.added) + "</span> " + (d.updated ? '<span class="chip c-teal">حُدّث ' + fmtN(d.updated) + "</span>" : "");
    if (st) st.innerHTML = manualStat;
    manualOpen = true;
    manualRows = [{ name: "", phone: "", size: "", city: "" }];
    const er = await fetch("/admin/entities", { headers: { "x-admin-token": TOKEN } });
    if (er.ok) entities = await er.json();
    alertBar("أُضيفت الجهات إلى قائمة الاستهداف", false);
    render(false);
  } catch (e) { if (st) st.innerHTML = '<span class="chip c-bad">تعذّر الحفظ</span>'; }
};
window.entFilePick = () => document.getElementById("entfile").click();
window.entFileUpload = async (input) => {
  const f = input.files && input.files[0];
  if (!f) return;
  const st = document.getElementById("entfstat");
  st.innerHTML = '<span class="chip c-warn">جارٍ قراءة الملف واستيراد الصفوف…</span>';
  const fd = new FormData(); fd.append("file", f);
  try {
    const r = await fetch("/admin/entities/import", { method: "POST", headers: { "x-admin-token": TOKEN }, body: fd });
    const d = await r.json();
    if (!r.ok) { st.innerHTML = '<span class="chip c-bad">تعذّر: ' + esc(d.error || r.status) + "</span>"; return; }
    let msg = '<span class="chip c-ok">أُضيف ' + fmtN(d.added) + "</span> ";
    if (d.updated) msg += '<span class="chip c-teal">حُدّث ' + fmtN(d.updated) + "</span> ";
    if (d.skippedCount) msg += '<span class="chip c-bad">تُخطّي ' + fmtN(d.skippedCount) + "</span> ";
    msg += '<div style="font-size:11px;color:#667085;margin-top:8px;line-height:1.9;">الأعمدة المكتشفة — الاسم: <b>' + esc(d.columns.name) + '</b> · الجوال: <b>' + esc(d.columns.phone) + "</b>" +
      (d.columns.attrs.length ? " · شرائح: " + d.columns.attrs.map(esc).join("، ") : " · لا أعمدة شرائح إضافية") + "</div>";
    if (d.skippedRows && d.skippedRows.length) {
      msg += '<div style="font-size:11px;color:#c43d3d;margin-top:4px;line-height:1.9;">' +
        d.skippedRows.map((s) => "صف " + fmtN(s.row) + ": " + esc(s.reason)).join(" · ") + "</div>";
    }
    entImportSummary = msg;   // survives the re-render (the status div is rebuilt by vCustomers)
    const er = await fetch("/admin/entities", { headers: { "x-admin-token": TOKEN } });
    if (er.ok) entities = await er.json();
    render(false);
    alertBar("استُورد الملف — " + fmtN(d.added) + " جديد، " + fmtN(d.updated) + " محدّث", false);
  } catch (e) { st.innerHTML = '<span class="chip c-bad">خطأ في الاستيراد</span>'; }
  input.value = "";
};
window.entDel = async (id) => {
  await fetch("/admin/entities/delete", { method: "POST", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  entities = entities.filter((e) => e.id !== id); entSel.delete(id); render(false);
};
function vCustomers() {
  let h = '<div class="card">' +
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
    '<h3 style="margin:0;flex:1;min-width:180px;">جهات الاستهداف</h3>' +
    '<button class="btn btn-teal" style="font-size:12.5px;padding:11px 18px;" onclick="entFilePick()">⬆ رفع ملف Excel/CSV</button>' +
    '<a href="/assets/audience-template.xlsx" download class="btn" style="font-size:12px;color:#1F4470;background:#E3ECF8;text-decoration:none;">القالب الجاهز</a></div>' +
    '<div style="font-size:11px;color:#98A2B3;margin-top:9px;line-height:1.8;">قائمتك كما هي: عمود اسم + عمود جوال، وكل عمود إضافي (المدينة، الحجم…) يصبح <b style="color:#2E7D77;">شريحة استهداف</b> · التكرار يُحدَّث · أرقام 05 تتحول لـ966</div>' +
    '<input id="entfile" type="file" accept=".xlsx,.xls,.csv" style="display:none" onchange="entFileUpload(this)">' +
    '<div id="entfstat" style="margin-top:10px;">' + entImportSummary + "</div>" +
    '<details id="manualbox"' + (manualOpen ? " open" : "") + ' ontoggle="manualOpen=this.open" style="margin-top:10px;"><summary style="font-size:11.5px;color:#667085;cursor:pointer;font-weight:600;">إضافة جهة يدويًا</summary>' +
    '<div style="font-size:11.5px;color:#98A2B3;margin:10px 0 12px;line-height:1.9;">الاسم والجوال مطلوبان · الحجم والمدينة يصبحان شريحتَي استهداف</div>' +
    '<div id="manualrows">' + manualRowsHtml() + '</div>' +
    '<div style="display:flex;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap;">' +
    '<button class="btn btn-teal" style="font-size:12.5px;" onclick="entManualSave()">حفظ الجهات ←</button>' +
    '<button class="btn btn-ghost" style="font-size:12px;" onclick="entAddRow()">+ صف آخر</button>' +
    '<span id="entstat">' + manualStat + '</span><span style="flex:1"></span>' +
    '<button class="btn" style="font-size:11.5px;background:transparent;color:#667085;padding:8px 4px;" onclick="entTogglePaste()">أو الصق قائمة جاهزة</button></div>' +
    '<div id="pastebox" style="display:none;margin-top:12px;">' +
    '<div style="font-size:11.5px;color:#667085;margin-bottom:8px;line-height:1.9;">سطر لكل جهة: <b style="color:#101828;">الاسم، الجوال، الحجم، المدينة</b></div>' +
    '<textarea id="entpaste" rows="4" placeholder="مجمع النور الطبي، 966512345678، كبيرة، الرياض" class="inp" style="width:100%;font-size:12.5px;line-height:2;resize:vertical;"></textarea>' +
    '<button class="btn btn-ghost" style="font-size:12px;margin-top:10px;" onclick="entImport()">استيراد الملصق ←</button></div>' +
    '</details></div>';
  const groups = segGroups();
  const cq = custQ.trim();
  const cm = cq ? entities.filter((e) => e.name.includes(cq) || e.phone.includes(cq)) : entities;
  const cshown = cm.slice(0, LIST_CAP);
  h += '<div class="sec">جهات الاستهداف <span class="meta">' + fmtN(entities.length) + " جهة" +
    (groups.length ? " · شرائح: " + groups.map((g) => esc(g.key)).join("، ") : "") + "</span></div>";
  if (!entities.length) {
    h += '<div class="empty"><div class="ic"><span></span></div><div class="t">لا مستهدفين بعد</div><div class="s">ارفع ملفك أعلاه — ثم اخترهم بالشرائح أو فردًا في «إنشاء حملة».</div></div>';
  } else {
    h += '<div style="margin-bottom:10px;"><input id="cq" value="' + esc(custQ) + '" oninput="custSearch(this)" placeholder="ابحث بالاسم أو الرقم…" style="font-family:inherit;width:100%;font-size:12.5px;border:1px solid #EAECF0;border-radius:10px;padding:9px 13px;background:#fff;"></div>';
    h += '<div class="tblwrap">' + cshown.map((e) => {
      const hasConvo = Boolean(contactByPhone(e.phone));
      return '<div ' + (hasConvo ? 'onclick="location.hash=\\'customer/' + esc(e.phone) + '\\'" style="cursor:pointer;display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid #F2F4F7;"' : 'style="display:flex;align-items:center;gap:12px;padding:11px 16px;border-bottom:1px solid #F2F4F7;"') + '>' +
      '<div class="avatar" style="width:34px;height:34px;border-radius:9px;background:#101828;color:#3FB6B0;display:flex;align-items:center;justify-content:center;font-weight:700;">' + esc(e.name.trim().charAt(0)) + "</div>" +
      '<span style="flex:1;min-width:0;font-size:13px;font-weight:600;color:#101828;">' + esc(e.name) + (hasConvo ? ' <span style="font-size:10.5px;color:#2E7D77;font-weight:700;">ملف ←</span>' : "") + "</span>" +
      '<span class="hidemob" style="display:flex;gap:6px;align-items:center;">' + attrChips(e, 3) + "</span>" +
      '<span style="font-size:11.5px;color:#98A2B3;direction:ltr;">+' + esc(e.phone) + "</span>" +
      '<button onclick="event.stopPropagation();entDel(' + e.id + ')" style="font-family:inherit;font-size:15px;font-weight:700;color:#c43d3d;background:#fbe9e9;border:none;border-radius:8px;width:28px;height:28px;cursor:pointer;line-height:1;">×</button></div>';
    }).join("") +
    (cm.length > LIST_CAP ? '<div style="padding:12px;text-align:center;color:#667085;font-size:12px;background:#fafbfc;">+ ' + fmtN(cm.length - LIST_CAP) + ' آخرون — استخدم البحث للوصول إليهم</div>' : "") +
    (cm.length ? "" : '<div style="padding:22px;text-align:center;color:#98A2B3;font-size:12.5px;">لا نتائج مطابقة</div>') + "</div>";
  }
  return h;
}
window.custSearch = (el) => { custQ = el.value; clearTimeout(window.__cq); window.__cq = setTimeout(() => render(false), 250); };

function ratesStrip(agg) {
  const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
  const cards = [
    ["نسبة الوصول", pct(agg.delivered, agg.sent || agg.targeted), "#3FB6B0"],
    ["نسبة المشاهدة", pct(agg.seen, agg.delivered), "#2E8F89"],
    ["نسبة الردود", pct(agg.replied, agg.delivered), "#2F5F94"],
    ["نسبة الاهتمام", pct(agg.interested, agg.replied), "#1f8a52"],
  ];
  return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:18px;">' +
    cards.map((c) => '<div class="card rise" style="margin:0;padding:16px 18px;">' +
      '<div style="font-size:11.5px;color:#667085;font-weight:600;">' + c[0] + "</div>" +
      '<div style="font-size:26px;font-weight:700;color:#101828;margin-top:8px;font-variant-numeric:tabular-nums;letter-spacing:-.4px;">' + fmtN(c[1]) + '<span style="font-size:14px;color:#98A2B3;">٪</span></div>' +
      '<div style="height:5px;background:#F2F4F7;border-radius:999px;overflow:hidden;margin-top:10px;"><i style="display:block;height:100%;width:' + Math.min(100, c[1]) + "%;background:" + c[2] + ';border-radius:999px;"></i></div></div>').join("") + "</div>";
}
function stageBars(rows) {
  const mx = Math.max(1, rows[0] ? rows[0][1] : 1);
  return '<div style="margin-top:14px;display:flex;flex-direction:column;gap:11px;">' + rows.map((r, i) => {
    const w = Math.max(4, Math.round(r[1] / mx * 100));
    const prev = i > 0 ? rows[i - 1][1] : r[1];
    const drop = prev > 0 && i > 0 ? Math.round((1 - r[1] / prev) * 100) : 0;
    return '<div><div style="display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:5px;">' +
      '<span style="font-size:12.5px;font-weight:600;color:#344054;">' + esc(r[0]) + "</span>" +
      '<span style="font-size:12.5px;font-weight:700;color:#101828;font-variant-numeric:tabular-nums;">' + fmtN(r[1]) +
      (i > 0 && drop > 0 ? ' <span style="font-size:10.5px;font-weight:600;color:#B42318;">-' + fmtN(drop) + "٪</span>" : "") + "</span></div>" +
      '<div style="height:10px;background:#F2F4F7;border-radius:6px;overflow:hidden;"><i style="display:block;height:100%;width:' + w + "%;background:" + r[2] + ';border-radius:6px;"></i></div></div>';
  }).join("") + "</div>";
}
function funnelSvgUnused(rows) {
  const mx = Math.max(1, ...rows.map((r) => r[1]));
  const W = 300, segH = 40, gap = 5, H = rows.length * (segH + gap);
  let shapes = "";
  rows.forEach((r, i) => {
    const wTop = Math.max(0.16, (i === 0 ? rows[0][1] : rows[i - 1][1]) / mx) * (W - 20);
    const wBot = Math.max(0.16, r[1] / mx) * (W - 20);
    const y = i * (segH + gap);
    const x1t = (W - wTop) / 2, x2t = (W + wTop) / 2, x1b = (W - wBot) / 2, x2b = (W + wBot) / 2;
    shapes += '<polygon points="' + x1t + ',' + y + ' ' + x2t + ',' + y + ' ' + x2b + ',' + (y + segH) + ' ' + x1b + ',' + (y + segH) + '" fill="' + r[2] + '" opacity="0.92"/>' +
      '<text x="' + (W / 2) + '" y="' + (y + segH / 2 + 4) + '" text-anchor="middle" font-size="12.5" font-weight="700" fill="#fff">' + fmtN(r[1]) + "</text>";
  });
  return '<div style="display:flex;gap:14px;align-items:stretch;margin-top:12px;">' +
    '<div dir="ltr" style="flex:1;min-width:0;"><svg viewBox="0 0 ' + W + " " + H + '" style="width:100%;height:auto;display:block;" role="img" aria-label="مسار تحويل الحملات">' + shapes + "</svg></div>" +
    '<div style="flex:none;display:flex;flex-direction:column;gap:5px;justify-content:space-between;padding:2px 0;">' +
    rows.map((r) => '<div style="height:40px;display:flex;align-items:center;font-size:11.5px;font-weight:700;color:#344054;">' + esc(r[0]) + "</div>").join("") + "</div></div>";
}
function colChart(rows, color) {
  const mx = Math.max(1, ...rows.map((r) => r[1]));
  return '<div style="display:flex;align-items:flex-end;gap:12px;height:120px;margin-top:14px;">' +
    rows.map((r) => '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;min-width:0;">' +
      '<div style="font-size:11px;font-weight:700;color:#101828;">' + fmtN(r[1]) + "</div>" +
      '<div style="width:100%;max-width:44px;height:' + Math.max(6, Math.round(r[1] / mx * 78)) + 'px;background:' + color + ';border-radius:4px 4px 2px 2px;"></div>' +
      '<div style="font-size:10px;color:#667085;font-weight:600;text-align:center;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">' + esc(String(r[0])) + "</div></div>").join("") + "</div>";
}
function treemapTiles(rows) {
  const total = Math.max(1, rows.reduce((a, r) => a + r[1], 0));
  const tones = [["#1F4470", "#fff"], ["#2F5F94", "#fff"], ["#4E7EAE", "#fff"], ["#7FA3C8", "#101828"], ["#AFC6DE", "#101828"], ["#D6E2F1", "#101828"], ["#EFF4FB", "#101828"], ["#F9FAFB", "#101828"]];
  return '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:14px;">' +
    rows.map((r, i) => { const tn = tones[i % tones.length]; return '<div style="flex:' + Math.max(8, Math.round(r[1] / total * 100)) + ' 1 90px;min-height:78px;border-radius:12px;background:' + tn[0] + ';color:' + tn[1] + ';padding:12px 14px;display:flex;flex-direction:column;justify-content:space-between;">' +
      '<div style="font-size:11.5px;font-weight:700;opacity:.92;">' + esc(String(r[0])) + '</div><div style="font-size:17px;font-weight:700;font-variant-numeric:tabular-nums;">' + fmtN(r[1]) + "</div></div>"; }).join("") + "</div>";
}
function chartCard(title, sub, inner) {
  return '<div class="card" style="margin:0;"><div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;"><h3 style="margin:0;">' + title + '</h3><span style="font-size:10.5px;color:#98A2B3;">' + sub + "</span></div>" + inner + "</div>";
}
function hbarRows(rows, color) {
  const mx = Math.max(1, ...rows.map((r) => r[1]));
  return '<div style="margin-top:12px;display:flex;flex-direction:column;gap:9px;">' + rows.map((r) =>
    '<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span style="font-weight:600;color:#344054;">' + esc(String(r[0])) + '</span><span style="font-weight:700;color:#101828;">' + fmtN(r[1]) + "</span></div>" +
    '<div style="height:8px;background:#EAECF0;border-radius:999px;overflow:hidden;"><i style="display:block;height:100%;border-radius:999px;width:' + Math.round(r[1] / mx * 100) + "%;background:" + (r[2] || color) + ';"></i></div></div>').join("") + "</div>";
}
function dailyActivitySvg(cs) {
  const days = []; const now = new Date(); now.setHours(0, 0, 0, 0);
  for (let i = 0; i <= 13; i++) { const d = new Date(now.getTime() - i * 864e5); days.push({ t0: d.getTime(), t1: d.getTime() + 864e5, inN: 0, outN: 0, label: i === 0 ? "اليوم" : d.toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "numeric" }) }); }
  cs.forEach((c) => (c.transcript || []).forEach((t) => {
    const d = days.find((x) => t.ts >= x.t0 && t.ts < x.t1);
    if (d) { if (t.role === "customer") d.inN++; else if (t.role === "agent") d.outN++; }
  }));
  const mx = Math.max(1, ...days.map((d) => d.inN + d.outN));
  const W = 616, H = 132, bw = 30;
  let bars = "";
  days.forEach((d, i) => {
    const x = 8 + i * (bw + 14);
    const hOut = Math.round(d.outN / mx * 96), hIn = Math.round(d.inN / mx * 96);
    bars += '<rect x="' + x + '" y="' + (104 - hOut) + '" width="' + bw + '" height="' + hOut + '" rx="3" fill="#D0D5DD"/>' +
      '<rect x="' + x + '" y="' + (104 - hOut - hIn) + '" width="' + bw + '" height="' + hIn + '" rx="3" fill="#2E8F89"/>' +
      '<text x="' + (x + bw / 2) + '" y="122" text-anchor="middle" font-size="8.5" fill="#98A2B3">' + d.label + "</text>";
  });
  return '<div dir="ltr" style="overflow-x:auto;" class="ms-scroll"><svg viewBox="0 0 ' + W + " " + H + '" style="width:100%;min-width:520px;height:auto;display:block;margin-top:10px;" role="img" aria-label="نشاط الرسائل ١٤ يومًا">' +
    '<line x1="4" y1="104" x2="' + (W - 4) + '" y2="104" stroke="#EAECF0" stroke-width="1"/>' + bars + "</svg></div>" +
    '<div style="display:flex;gap:14px;margin-top:8px;font-size:10.5px;color:#667085;"><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:#2E8F89;margin-inline-end:5px;"></i>واردة من العملاء</span><span><i style="display:inline-block;width:9px;height:9px;border-radius:3px;background:#D0D5DD;margin-inline-end:5px;"></i>صادرة</span></div>';
}
function vHomeCharts(cs) {
  // The command centre is contact-centric: its KPI row, action queue and win/loss board all ask
  // «is this a real customer?». The funnel must ask the SAME question, or the two disagree on one
  // screen — «ردّوا ٤» above «ردّوا ٠» under «بيانات فعلية فقط». Campaign-level classification is
  // for the campaigns LIST; here a launch counts when it reached at least one real contact.
  const camps = showTest ? campaigns : campaigns.filter((cp) =>
    (cp.targets || []).some((t) => { const c = contactByPhone(t.phone); return c && !c.test; }));
  // Count PEOPLE, not target rows. One contact can sit in several launches (ياسمين is in three),
  // so summing per-campaign stats turned four people into six and put «ردّوا ٦» under a KPI card
  // reading «ردّوا ٤» on the same screen. The KPI row counts distinct contacts; so does this.
  const seenPhones = new Set();
  const reached = [];
  camps.forEach((cp) => (cp.targets || []).forEach((t) => {
    if (seenPhones.has(t.phone)) return;
    seenPhones.add(t.phone);
    const c = contactByPhone(t.phone);
    if (c && (showTest || !c.test)) reached.push(c);
  }));
  const agg = {
    targeted: reached.length,
    sent: reached.filter((c) => (c.statusTimes || {}).sent || (c.transcript || []).some((t) => t.role === "agent")).length,
    delivered: reached.filter((c) => (c.statusTimes || {}).delivered).length,
    seen: reached.filter(seenOf).length,
    replied: reached.filter((c) => (c.statusTimes || {}).replied).length,
    interested: reached.filter(interestedOf).length,
  };
  const funnel = [["جهات الاستهداف", agg.targeted, "#2F5F94"], ["أُرسلت", agg.sent, "#2F5F94"], ["وصلت", agg.delivered, "#3FB6B0"], ["شوهدت", agg.seen, "#3FB6B0"], ["ردّوا", agg.replied, "#2E8F89"], ["جهات مهتمة", agg.interested, "#1f8a52"]];
  const byProd = new Map();
  cs.forEach((c) => { const seen = new Set(); (c.tags || []).forEach((t) => { if (!seen.has(t.product)) { seen.add(t.product); byProd.set(t.product, (byProd.get(t.product) || 0) + 1); } }); });
  const prodRows = [...byProd.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => [k, v]);
  const byCity = new Map();
  entities.forEach((e) => { const city = (e.attrs || {})["المدينة"]; if (city) byCity.set(city, (byCity.get(city) || 0) + 1); });
  const cityRows = [...byCity.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => [k, v]);
  const bySize = new Map(); const bySec = new Map();
  entities.forEach((e) => {
    const sz = (e.attrs || {})["الحجم"]; if (sz) bySize.set(sz, (bySize.get(sz) || 0) + 1);
    const sec = (e.attrs || {})["القطاع"]; if (sec) bySec.set(sec, (bySec.get(sec) || 0) + 1);
  });
  const sizeRows = [...bySize.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const secRows = [...bySec.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  let h = '<div class="sec" style="margin-top:4px;">التحليلات <span class="meta">أرقام حية من الحملات والمحادثات' + (showTest ? " · تشمل بيانات البيئة التجريبية" : " · بيانات فعلية فقط") + "</span></div>";
  h += ratesStrip(agg);
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;align-items:start;margin-bottom:18px;">';
  h += chartCard("مسار التحويل التسويقي", fmtN(camps.length) + " حملة", agg.targeted ? stageBars(funnel) : '<div style="font-size:12px;color:#98A2B3;margin-top:14px;line-height:1.9;">لا حملات ' + (showTest ? "" : "فعلية ") + 'بعد — القمع يتعبأ مع أول إطلاق.</div>');
  h += chartCard("نشاط الرسائل", "آخر ١٤ يومًا", dailyActivitySvg(cs));
  h += chartCard("التوزيع حسب الحجم والقطاع", "من أعمدة ملفك", (sizeRows.length || secRows.length)
    ? '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">' +
      '<div><div style="font-size:10.5px;font-weight:700;color:#98A2B3;margin-top:10px;">الحجم</div>' + colChart(sizeRows, "#2F5F94") + "</div>" +
      '<div><div style="font-size:10.5px;font-weight:700;color:#98A2B3;margin-top:10px;">القطاع</div>' + colChart(secRows, "#3FB6B0") + "</div></div>"
    : '<div style="font-size:12px;color:#98A2B3;margin-top:14px;">تظهر بعد استيراد قائمة بأعمدة الحجم/القطاع.</div>');
  h += chartCard("الاهتمام حسب الخدمة", "من تصنيفات المساعد", prodRows.length ? hbarRows(prodRows, "#2E7D77") : '<div style="font-size:12px;color:#98A2B3;margin-top:14px;">تظهر عند أول وسم اهتمام.</div>');
  h += chartCard("جهات الاستهداف حسب المدينة", fmtN(entities.length) + " جهة", cityRows.length ? treemapTiles(cityRows) : '<div style="font-size:12px;color:#98A2B3;margin-top:14px;">تظهر بعد استيراد قائمة فيها عمود المدينة.</div>');
  h += "</div>";
  return h;
}
const DEAL_META = { won: ["صفقة مكتسبة", "#027A48", "#ECFDF3"], lost: ["غير مكتسبة", "#B42318", "#FEF3F2"], stalled: ["متوقفة", "#B54708", "#FFFAEB"], active: ["نشطة", "#2F5F94", "#EFF4FB"] };
function vActionQueue(cs) {
  const now = Date.now();
  const hotIdle = cs.filter((c) => {
    const ins = insCache[c.phone] || {};
    const hot = (c.tags || []).some((t) => t.level === "hot") || ins.intent === "high";
    return hot && (now - (c.lastEventAt || 0)) > 24 * 3600e3 && !c.optedOut;
  }).sort((a, b) => (a.lastEventAt || 0) - (b.lastEventAt || 0));
  const seenNoReply = [];
  // Windowed per campaign: this pairs a contact WITH a campaign, so it is a campaign claim and
  // reading lifetime state here would queue a retarget for someone who already replied to that very
  // send — or, worse, who replied to a different campaign entirely.
  campaigns.forEach((cp) => { const w = campWin(cp); cp.targets.forEach((t) => {
    const c = contactByPhone(t.phone);
    if (c && atOrAfter((c.statusTimes || {}).read, w) && !repliedIn(c, w) && !c.optedOut) seenNoReply.push({ c, cp });
  }); });
  const stalled = cs.filter((c) => (insCache[c.phone] || {}).deal_state === "stalled");
  const items = [];
  hotIdle.slice(0, 3).forEach((c) => {
    const ins = insCache[c.phone] || {};
    items.push(["call", "تواصل الآن مع الفرصة المؤهلة", (c.waName || c.phone) + " · " + fmtN(Math.round((now - (c.lastEventAt || 0)) / 3600e3)) + " ساعة بلا متابعة",
      ins.next_action || "تواصل مباشرة لاستكمال الاهتمام", "customer/" + c.phone, "#B42318", "#FEF3F2"]);
  });
  if (seenNoReply.length) {
    items.push(["retarget", "فرصة لإعادة التواصل", fmtN(seenNoReply.length) + " جهة شاهدت الرسالة دون ردّ",
      "أعد التواصل برسالة تبرز أثرًا تشغيليًا مختلفًا", "kmon", "#B54708", "#FFFAEB"]);
  }
  stalled.slice(0, 2).forEach((c) => {
    const ins = insCache[c.phone] || {};
    items.push(["revive", "صفقة متوقفة", (c.waName || c.phone) + (ins.loss_cause ? " · " + ins.loss_cause : ""),
      ins.fix_suggestion || "تابع بمعلومة جديدة", "customer/" + c.phone, "#2F5F94", "#EFF4FB"]);
  });
  if (!items.length) return "";
  return '<div class="card rise" style="margin-bottom:18px;"><div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">' +
    '<h3 style="margin:0;display:flex;align-items:center;gap:8px;">' + ic("clock", 18, "#B54708") + "ما يستحق المتابعة الآن</h3>" +
    '<span class="cntpill">' + fmtN(items.length) + " إجراء</span></div>" +
    '<div style="margin-top:14px;display:flex;flex-direction:column;gap:10px;">' +
    items.map((it) => '<div onclick="location.hash=\\'' + it[4] + '\\'" style="display:flex;align-items:center;gap:13px;padding:13px 15px;border:1px solid #EAECF0;border-radius:13px;cursor:pointer;background:' + it[6] + ';">' +
      '<span style="width:8px;height:8px;border-radius:999px;background:' + it[5] + ';flex:none;"></span>' +
      '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:700;color:#101828;">' + it[1] + ' <span style="font-weight:600;color:#667085;">— ' + esc(it[2]) + "</span></div>" +
      '<div style="font-size:11.5px;color:#475467;margin-top:4px;line-height:1.7;">' + esc(it[3]) + "</div></div>" +
      '<span style="font-size:12px;font-weight:700;color:' + it[5] + ';flex:none;">افتح التفاصيل ←</span></div>').join("") + "</div></div>";
}
function vWinLoss() {
  if (!winloss) return "";
  const t = winloss.totals || {};
  const judged = (t.won || 0) + (t.lost || 0) + (t.stalled || 0);
  let h = '<div class="card" style="margin-bottom:18px;">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">' +
    '<h3 style="margin:0;">لماذا نكسب — ولماذا نخسر</h3>' +
    '<div style="display:flex;gap:7px;flex-wrap:wrap;">' +
    ["won", "lost", "stalled", "active"].map((k) => '<span class="chip" style="background:' + DEAL_META[k][2] + ';color:' + DEAL_META[k][1] + ';">' + DEAL_META[k][0] + " " + fmtN(t[k] || 0) + "</span>").join("") + "</div></div>" +
    '<div style="font-size:11px;color:#98a2b3;margin-top:6px;">حكم المساعد على كل محادثة من نصها الحرفي — مع الدليل</div>';
  if (!judged && !(t.active || 0)) {
    h += '<div style="font-size:12.5px;color:#667085;margin-top:14px;line-height:1.9;">يتعبأ هذا اللوح مع أول محادثات محكومة — كل صفقة مكتسبة أو غير مكتسبة ستظهر هنا بسببها.</div></div>';
    return h;
  }
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;margin-top:16px;">';
  h += '<div><div style="font-size:11.5px;font-weight:700;color:#027A48;margin-bottom:9px;">✓ ما يكسب لنا الصفقات</div>' +
    ((winloss.win_drivers || []).length
      ? winloss.win_drivers.map((w) => '<div style="display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px solid #F2F4F7;"><span style="flex:1;font-size:12.5px;color:#101828;line-height:1.8;">' + esc(w.driver) + '</span><span class="chip c-ok">' + fmtN(w.count) + "</span></div>").join("")
      : '<div style="font-size:12px;color:#98a2b3;">تظهر مع أول صفقة تتقدم.</div>') + "</div>";
  h += '<div><div style="font-size:11.5px;font-weight:700;color:#B42318;margin-bottom:9px;">✕ ما يخسّرنا الصفقات</div>' +
    ((winloss.loss_causes || []).length
      ? winloss.loss_causes.map((c) => '<div style="padding:8px 0;border-bottom:1px solid #F2F4F7;"><div style="display:flex;align-items:center;gap:9px;"><span style="flex:1;font-size:12.5px;font-weight:700;color:#101828;">' + esc(c.cause) + '</span>' + (c.products || []).map((pd) => '<span class="chip c-grey">' + esc(pd) + "</span>").join("") + '<span class="chip c-bad">' + fmtN(c.count) + "</span></div>" +
        (c.example ? '<div style="font-size:11.5px;color:#667085;margin-top:4px;line-height:1.8;">« ' + esc(c.example) + ' »</div>' : "") + "</div>").join("")
      : '<div style="font-size:12px;color:#98a2b3;">لا خسائر محكومة بعد — وهذا خبر جيد.</div>') + "</div>";
  h += "</div>";
  if ((winloss.by_product || []).length) {
    h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid #F2F4F7;">' +
      winloss.by_product.slice(0, 4).map((pr) => '<span class="chip c-blue" title="' + esc(pr.product) + '">' + esc(clip(pr.product, 24)) + ": " + fmtN(pr.won) + " مكتسبة · " + fmtN(pr.lost) + " غير مكتسبة</span>").join("") + "</div>";
  }
  h += "</div>";
  return h;
}
const SALES_PATH = ["تعارف", "تشخيص الاحتياج", "عرض الحل", "معالجة الاعتراض", "تنسيق العرض التعريفي", "الإغلاق"];
function vSalesPath(ins) {
  const cur = Math.max(0, SALES_PATH.indexOf(ins.stage || "تعارف"));
  return '<div class="card rise" style="padding:22px 24px;">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:18px;">' +
    '<h3 style="margin:0;display:flex;align-items:center;gap:8px;">' + ic("target", 18, "#1F7A73") + "مسار البيع مع هذا العميل</h3>" +
    '<span class="chip c-teal">' + (ins.learning ? "المرحلة قيد التعلّم" : "المرحلة " + fmtN(cur + 1) + " من " + fmtN(SALES_PATH.length)) + "</span></div>" +
    '<div id="pathScroll" style="display:flex;align-items:flex-start;gap:0;overflow-x:auto;" class="ms-scroll">' +
    SALES_PATH.map((st, i) => {
      const done = i < cur, now = i === cur;
      const col = done ? "#1F7A73" : now ? "#101828" : "#D0D5DD";
      return '<div style="flex:1;min-width:110px;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative;">' +
        (i > 0 ? '<span style="position:absolute;top:13px;inset-inline-end:50%;width:100%;height:2px;background:' + (done || now ? "#1F7A73" : "#EAECF0") + ';"></span>' : "") +
        '<span style="position:relative;z-index:1;width:28px;height:28px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;' +
        (done ? "background:#1F7A73;color:#fff;" : now ? "background:#101828;color:#fff;box-shadow:0 0 0 4px rgba(16,24,40,.08);" : "background:#fff;color:#98A2B3;border:2px solid #EAECF0;") + '">' + (done ? "✓" : fmtN(i + 1)) + "</span>" +
        '<div' + (now ? ' id="pathNow"' : "") + ' style="font-size:11.5px;font-weight:' + (now ? "700" : "600") + ';color:' + col + ';margin-top:8px;line-height:1.5;">' + st + "</div></div>";
    }).join("") + "</div>" +
    (ins.stage_reason ? '<div style="font-size:12px;color:#475467;margin-top:16px;padding-top:14px;border-top:1px solid #F2F4F7;line-height:1.9;"><b style="color:#101828;">لماذا هذه المرحلة:</b> ' + esc(ins.stage_reason) + "</div>" : "") +
    "</div>";
}
const INTENT_META = { high: ["نية مرتفعة", "#1f8a52"], medium: ["نية متوسطة", "#b5810f"], low: ["نية منخفضة", "#667085"], none: ["لا إشارة بعد", "#98A2B3"] };
function toneBadge(label, color) {
  return '<span style="display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid #EAECF0;border-radius:999px;padding:4px 11px;font-size:11px;font-weight:700;color:#344054;">' +
    '<span style="width:8px;height:8px;border-radius:999px;background:' + color + ';"></span>' + esc(label) + "</span>";
}
function tlDot(kind) {
  return { in: "#2F5F94", out: "#3FB6B0", camp: "#2E8F89", file: "#b5810f", tag: "#C9A227", st: "#98A2B3", sys: "#D0D5DD" }[kind] || "#D0D5DD";
}
function vCustomer(ph) {
  if (!profileData || profilePhone !== ph) {
    return '<div class="empty"><div class="ic"><span></span></div><div class="t">جارٍ تجميع ملف العميل…</div><div class="s">السجل، قراءة المساعد، وقراءة الحوار.</div></div>';
  }
  if (profileData.missing) {
    return '<div class="empty"><div class="ic"><span></span></div><div class="t">لا محادثة لهذا الرقم بعد</div><div class="s">يظهر ملف العميل بعد أول رسالة واتساب. <a href="#customers" style="color:#2E7D77;font-weight:700;">→ جهات الاستهداف</a></div></div>';
  }
  const d = profileData; const c = d.contact; const ins = d.insights || {}; const ctx = d.context || { score: 0, parts: [] };
  const nm = c.waName || (d.entity && d.entity.name) || "غير معروف";
  const im = INTENT_META[ins.intent] || INTENT_META.none;
  const missing = (ctx.parts || []).filter((p) => !p.got).slice(0, 2);
  let h = '<a href="javascript:history.back()" style="display:inline-block;font-size:12.5px;font-weight:700;color:#101828;text-decoration:none;margin-bottom:14px;">→ رجوع</a>';
  h += '<div class="card" style="display:flex;gap:18px;align-items:stretch;flex-wrap:wrap;">' +
    '<div style="flex:1;min-width:260px;display:flex;gap:14px;align-items:flex-start;">' +
    '<div style="width:52px;height:52px;flex:none;border-radius:14px;background:#101828;color:#3FB6B0;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:22px;">' + esc(nm.trim().charAt(0)) + "</div>" +
    '<div style="flex:1;min-width:0;"><div style="font-size:18px;font-weight:700;color:#101828;">' + esc(nm) + (c.test ? ' <span class="chip" style="color:#8a6d10;background:rgba(201,162,39,.14);">تجريبي</span>' : "") + "</div>" +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">' +
    (d.entity ? attrChips(d.entity, 4) : '<span class="chip c-grey">غير مستورد في القوائم</span>') +
    '<span class="chip c-teal">واتساب ✓</span>' + (c.human ? '<span class="chip c-warn">بيد البشر</span>' : "") + "</div>" +
    '<div style="font-size:11.5px;color:#98A2B3;margin-top:8px;direction:ltr;text-align:right;">+' + esc(c.phone) + "</div>" +
    '<div style="font-size:11px;color:#98A2B3;margin-top:4px;">أول ظهور: ' + fmtD(c.firstSeenAt) + " · آخر نشاط: " + fmtT(c.lastEventAt) + "</div>" +
    ((d.campaigns || []).length ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">' + d.campaigns.map((cp) => '<a href="#kmon/' + cp.id + '" style="text-decoration:none;" class="chip c-blue">' + esc(cp.name.slice(0, 30)) + "</a>").join("") + "</div>" : "") +
    "</div></div>" +
    // THE CONVERSATION, not a checklist of fields. The old gauge scored what we hold on file —
    // a name, an import match, a file we sent — so it read full on a contact whose only real
    // sentence was «ماني مهتم لا تتصل علي». A percentage also implies a ceiling the conversation can
    // reach; there is none. This reports counts, whose turn it is, and the customer's own words.
    '<div class="convled" style="flex:none;width:210px;display:flex;flex-direction:column;gap:9px;border-inline-start:1px solid #F2F4F7;padding-inline-start:18px;">' +
    (function () {
      var it = d.interaction;
      if (!it) return '<div style="font-size:11px;color:#98A2B3;">لا قراءة للحوار بعد</div>';
      var total = Math.max(1, it.customerTurns + it.agentTurns);
      var cw = Math.round((it.customerTurns / total) * 100);
      var head = it.customerTurns ? fmtN(it.customerWords) : "—";
      return '<div style="font-size:10px;font-weight:700;color:#667085;">العميل ' + fmtN(it.customerTurns) +
        " · المساعد " + fmtN(it.agentTurns) + "</div>" +
        '<div style="height:8px;border-radius:999px;overflow:hidden;display:flex;background:#EAECF0;">' +
        '<i style="width:' + cw + '%;background:#3FB6B0;"></i>' +
        '<i style="flex:1;background:rgba(31,68,112,.22);"></i></div>' +
        '<div><span style="font-size:22px;font-weight:700;color:' + (it.customerTurns ? "#101828" : "#98A2B3") + ';">' + head +
        '</span> <span style="font-size:12px;color:#667085;">كلمة من العميل</span></div>' +
        '<div><span class="chip" style="background:' + (it.state === "reciprocal" ? "rgba(63,182,176,.14);color:#1F7A73" :
          it.state === "no_reply" ? "#F2F4F7;color:#667085" : "rgba(201,162,39,.16);color:#8a6d10") + ';">' + esc(it.stateLabel) + "</span></div>" +
        '<div style="font-size:11px;color:#667085;line-height:1.85;">' + esc(it.stateReason) + "</div>" +
        (it.voice
          ? '<div style="font-size:12px;color:#101828;line-height:1.9;background:#F6F8FB;border-radius:10px;border-inline-start:2px solid #3FB6B0;padding:9px 11px;">' +
            esc(clip(it.voice.text, 120)) + "</div>"
          : '<div style="font-size:11px;color:#98A2B3;line-height:1.85;">لم يكتب بكلماته بعد — لا نعرف احتياجه منه هو.</div>') +
        '<div style="font-size:10.5px;color:#98A2B3;">' +
        (it.lastSpeaker === "agent" ? "الدور على العميل" : it.lastSpeaker === "customer" ? "الدور على المساعد" : "لم يبدأ الحوار") +
        (it.hoursSinceCustomer !== null ? " · آخر كلام منه قبل " + esc(arAgo(it.hoursSinceCustomer)) : "") + "</div>";
    })() +
    "</div></div>";
  const hOut = [...(c.transcript || [])].reverse().find((t) => t.role === "system" && t.text.indexOf("نتيجة موثقة يدويًا") >= 0);
  h += '<div style="display:flex;gap:10px;flex-wrap:wrap;margin:2px 0 16px;align-items:center;">' +
    '<button class="btn btn-teal" data-ph="' + esc(c.phone) + '" onclick="openConvo(this.dataset.ph)">فتح المحادثة</button>' +
    '<button id="insbtn" class="btn btn-ghost" onclick="refreshInsights()">تحديث قراءة المساعد</button>' +
    '<span style="flex:1"></span>' +
    '<span style="font-size:11.5px;color:#667085;font-weight:600;">سجّل النتيجة الفعلية:</span>' +
    [["meeting_booked", "اجتماع محجوز", "#027A48"], ["quote_sent", "عرض مُرسَل", "#2F5F94"], ["postponed", "مؤجل", "#B54708"], ["not_a_fit", "غير مناسب", "#667085"]]
      .map((o) => '<button class="btn" data-ph="' + esc(c.phone) + '" data-out="' + o[0] + '" onclick="setOutcome(this)" style="font-size:12px;padding:9px 14px;color:' + o[2] + ';background:#fff;border:1px solid #EAECF0;' + (hOut && hOut.text.indexOf(o[0]) >= 0 ? "box-shadow:0 0 0 2px " + o[2] + "33;font-weight:700;" : "") + '">' + o[1] + "</button>").join("") + "</div>";
  if (!ins.learning) h += vSalesPath(ins);
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:16px;align-items:start;">';
  // فهم المساعد
  h += '<div class="card rise" style="margin:0;background:#F2F7FB;border-color:#DCE7F2;">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><h3 style="margin:0;color:#1F4470;display:flex;align-items:center;gap:8px;">' + ic("spark", 19, "#1F7A73") + "فهم المساعد</h3>" + toneBadge(im[0], im[1]) + "</div>";
  if (ins.learning) {
    h += '<div style="font-size:13px;color:#475467;line-height:2;margin-top:12px;">' + esc(ins.summary) + "</div>" +
      ((ins.product_interest || []).length ? '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">' + ins.product_interest.map((p) => toneBadge(p.product, p.level === "high" ? "#1f8a52" : p.level === "medium" ? "#b5810f" : "#667085")).join("") + "</div>" : "") +
      '<div style="font-size:11.5px;color:#667085;margin-top:12px;line-height:1.9;">كل رسالة جديدة تجعل القراءة أدق — كما في مرحلة «Learning…».</div>';
  } else {
    h += '<div style="background:#fff;border:1px solid #E3EBF3;border-radius:13px;padding:15px 16px;margin-top:14px;">' +
      '<div style="font-size:10.5px;font-weight:700;color:#1F7A73;margin-bottom:7px;">الخلاصة</div>' +
      '<div style="font-size:14px;font-weight:700;color:#101828;line-height:1.95;">' + esc(ins.summary || "") + "</div></div>";
    const dmx = DEAL_META[ins.deal_state || "active"] || DEAL_META.active;
    const mcards = [["نية الشراء", im[0], im[1]], ["حكم الصفقة", dmx[0], dmx[1]], ["القناة المفضّلة", "واتساب", "#1F7A73"], ["وقت التواصل", (ins.best_time || "—").slice(0, 30), "#2F5F94"]];
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px;">' +
      mcards.map((m) => '<div style="background:#fff;border:1px solid #E3EBF3;border-radius:13px;padding:13px 14px;">' +
        '<div style="font-size:10.5px;color:#667085;font-weight:600;">' + m[0] + "</div>" +
        '<div style="font-size:13px;font-weight:700;color:' + m[2] + ';margin-top:6px;line-height:1.6;">' + esc(m[1]) + "</div></div>").join("") + "</div>";
    if ((ins.product_interest || []).length) h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">' + ins.product_interest.map((p) => toneBadge(p.product + (p.level === "high" ? " · مرتفع" : p.level === "medium" ? " · متوسط" : " · منخفض"), p.level === "high" ? "#1f8a52" : p.level === "medium" ? "#b5810f" : "#667085")).join("") + "</div>";
    if ((ins.signals || []).length) h += '<div style="margin-top:12px;"><div style="font-size:11px;font-weight:700;color:#667085;margin-bottom:6px;">إشارات الشراء</div>' + ins.signals.map((sg) => '<div style="font-size:12px;color:#344054;line-height:1.9;">« ' + esc(sg) + ' »</div>').join("") + "</div>";
    if ((ins.objections || []).length) h += '<div style="margin-top:10px;"><div style="font-size:11px;font-weight:700;color:#667085;margin-bottom:6px;">اعتراضات</div>' + ins.objections.map((ob) => '<div style="font-size:12px;color:#8a5a2b;line-height:1.9;">· ' + esc(ob) + "</div>").join("") + "</div>";
    const dm = DEAL_META[ins.deal_state || "active"] || DEAL_META.active;
    h += '<div style="display:flex;align-items:center;gap:8px;margin-top:12px;">' +
      '<span class="chip" style="background:' + dm[2] + ';color:' + dm[1] + ';font-size:12px;padding:6px 14px;">حكم الصفقة: ' + dm[0] + "</span>" +
      (ins.loss_cause ? '<span class="chip c-bad">السبب: ' + esc(ins.loss_cause) + "</span>" : "") + "</div>" +
      (ins.evidence ? '<div style="font-size:11.5px;color:#667085;margin-top:7px;line-height:1.8;">الدليل: « ' + esc(ins.evidence) + ' »</div>' : "") +
      (ins.fix_suggestion && (ins.deal_state === "lost" || ins.deal_state === "stalled") ? '<div style="font-size:12px;color:#B54708;margin-top:6px;line-height:1.8;font-weight:600;">ما كان سيرجّح الكسب: ' + esc(ins.fix_suggestion) + "</div>" : "");
    h += '<div style="margin-top:14px;background:#fff;border:1px solid #B9E4E0;border-inline-start:3px solid #2E7D77;border-radius:11px;padding:13px 15px;">' +
      '<div style="font-size:11px;font-weight:700;color:#2E7D77;margin-bottom:5px;">الخطوة التالية</div>' +
      '<div style="font-size:13px;font-weight:700;color:#101828;line-height:1.9;">' + esc(ins.next_action || "") + "</div>" +
      (ins.why ? '<div style="font-size:11.5px;color:#475467;margin-top:5px;line-height:1.9;">' + esc(ins.why) + "</div>" : "") +
      (ins.best_time ? '<div style="font-size:11.5px;color:#2E7D77;font-weight:600;margin-top:7px;">وقت التواصل: ' + esc(ins.best_time) + "</div>" : "") + "</div>";
  }
  h += "</div>";
  // timeline
  h += '<div class="card" style="margin:0;"><h3 style="margin:0 0 4px;">سجل التفاعل</h3>' +
    '<div style="font-size:11px;color:#98A2B3;margin-bottom:10px;">كل نقاط التماس — رسائل، حالات تسليم، وسوم، ملفات — الأحدث أولًا</div>' +
    '<div class="ms-scroll" style="max-height:430px;overflow-y:auto;">' +
    ((d.timeline || []).length ? d.timeline.map((ev) =>
      '<div style="display:flex;gap:13px;padding:11px 2px;position:relative;">' +
      '<span style="position:absolute;inset-inline-start:5px;top:24px;bottom:-11px;width:2px;background:#EAECF0;"></span>' +
      '<span style="width:12px;height:12px;flex:none;margin-top:5px;border-radius:999px;background:#fff;border:2.5px solid ' + tlDot(ev.kind) + ';position:relative;z-index:1;"></span>' +
      '<div style="flex:1;min-width:0;"><div style="font-size:10.5px;font-weight:700;color:' + tlDot(ev.kind) + ';">' + esc(ev.meta || "") + " · " + fmtT(ev.ts) + " · " + fmtD(ev.ts) + "</div>" +
      '<div style="font-size:12.5px;color:#101828;line-height:1.8;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(ev.title) + "</div></div></div>").join("")
      : '<div style="padding:20px;text-align:center;color:#98A2B3;font-size:12px;">لا أحداث بعد</div>') + "</div></div>";
  h += "</div>";
  return h;
}

function vPlaceholder(cur) {
  const t = TITLES[cur] || ["", ""];
  return '<div class="empty"><div class="ic"><span></span></div><div class="t">' + t[0] + '</div><div class="s">هذه الوحدة ضمن المرحلة القادمة من «مسار» وفق خارطة الطريق — وحدة التسويق هي النشطة حاليًا.</div></div>';
}

function gate(msg) {
  document.getElementById("body").innerHTML = '<div class="gate"><div style="font-size:16px;font-weight:700;">الدخول إلى مسار</div>' +
    '<input id="tok" placeholder="admin token" dir="ltr"><button class="btn btn-teal" onclick="saveTok()">دخول</button>' +
    (msg ? '<div style="color:#c43d3d;font-size:12px;margin-top:10px;">' + esc(msg) + "</div>" : "") + "</div>";
}
window.saveTok = () => { TOKEN = document.getElementById("tok").value.trim(); localStorage.setItem("massar_admin_token", TOKEN); refresh(); };

let _viewSig = "";
function stamp() {
  const u = document.getElementById("upd");
  if (u) u.textContent = new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function dataSignature() {
  const cs = (cache && cache.contacts) || [];
  return [
    location.hash,
    cs.length,
    cs.reduce((a, c) => a + (c.transcript || []).length + (c.tags || []).length + Object.keys(c.statusTimes || {}).length + (c.human ? 1 : 0) + (c.test ? 2 : 0), 0),
    campaigns.length, entities.length, kbDocs.length, prodAssets.length,
    Object.keys(insCache).length,
    winloss ? JSON.stringify(winloss.totals) : "",
    showTest, campTab, campSortKey, campQ, entQ, custQ, campFilter, rQ, selProd,
    retargetCohort ? retargetCohort.targets.length : 0,
    profileData ? (profileData.contact ? profileData.contact.phone + "|" + (profileData.contact.transcript || []).length : "x") : "",
    JSON.stringify(entFilters), [...entSel].join(","),
  ].join("~");
}
function render(fetchNew) {
  // A poll that changes nothing must not repaint the screen — otherwise the page
  // visibly churns every 5 seconds while the operator is reading it.
  const sig = dataSignature();
  if (fetchNew && sig === _viewSig && document.getElementById("body").innerHTML) { stamp(); return; }
  _viewSig = sig;
  stamp();
  nav();
  const af = document.activeElement;
  const afId = af && af.tagName === "INPUT" ? af.id || af.getAttribute("data-fid") : null;
  const afPos = afId && af.selectionStart != null ? af.selectionStart : null;
  const cur = (location.hash || "#kmon").slice(1).split("/")[0];
  const b = document.getElementById("body");
  if (cur === "kmon" || cur === "home") {
    if (!TOKEN) return gate();
    if (!cache) return; // first fetch pending
    const campId = cur === "kmon" ? (location.hash || "").split("/")[1] || "" : "";
    b.innerHTML = cur === "kmon" ? (campId ? vKmonDetail(campId, cache) : vKmon(cache)) : vHome(cache);
  } else if (cur === "customer") {
    if (!TOKEN) return gate();
    const ph = (location.hash || "").split("/")[1] || "";
    b.innerHTML = vCustomer(ph);
  } else if (cur === "aimkt" || cur === "kb" || cur === "customers") {
    if (!TOKEN) return gate();
    const kbProd = cur === "kb" ? decodeURIComponent((location.hash || "").split("/").slice(1).join("/") || "") : "";
    b.innerHTML = cur === "aimkt" ? vAimkt() : cur === "kb" ? (kbProd ? vKbProduct(kbProd) : vKb()) : vCustomers();
  } else {
    b.innerHTML = vPlaceholder(cur);
  }
  // The current stage must be what you see first, even when the path overflows.
  // Deferred a frame: at innerHTML-assignment time the strip has no layout yet.
  requestAnimationFrame(() => {
    const pnow = document.getElementById("pathNow"), pscroll = document.getElementById("pathScroll");
    if (!pnow || !pscroll || pscroll.scrollWidth <= pscroll.clientWidth) return;
    // Let the engine do the RTL maths — hand-computed scrollLeft was wrong in every direction.
    pnow.scrollIntoView({ inline: "center", block: "nearest" });
  });
  if (afId) {
    const el2 = document.getElementById(afId);
    if (el2) { el2.focus(); if (afPos != null && el2.setSelectionRange) try { el2.setSelectionRange(afPos, afPos); } catch (e) {} }
  }
}
// The count-up animation was removed. It shipped a runtime TypeError (Math.roundfmtN), then sat
// dead for a day because the values became Arabic-Indic and its parseInt stripped ٠-٩ to NaN.
// The parse was fixed and it still could not be demonstrated running under a browser with motion
// enabled, so it is gone rather than carried as decoration nobody can verify. The .rise entrance
// transitions remain and are CSS-only.

async function refresh(force) {
  const cur = (location.hash || "#kmon").slice(1).split("/")[0];
  if (TOKEN) {
    try {
      const r = await fetch("/admin/state", { headers: { "x-admin-token": TOKEN } });
      if (r.status === 401) { if (cur === "kmon" || cur === "home") return gate("رمز غير صحيح"); }
      else { cache = await r.json(); }
      if (!showTestDecided && cache && (cache.contacts || []).length) {
        showTestDecided = true;
        showTest = !(cache.contacts || []).some((c) => !c.test);   // no real contacts → reveal sandbox
      }
      const [er, kr, cr, ir, wr] = await Promise.all([
        fetch("/admin/entities", { headers: { "x-admin-token": TOKEN } }),
        fetch("/admin/kb", { headers: { "x-admin-token": TOKEN } }),
        fetch("/admin/campaigns", { headers: { "x-admin-token": TOKEN } }),
        fetch("/admin/insights", { headers: { "x-admin-token": TOKEN } }),
        fetch("/admin/intel/winloss" + (showTest ? "?all=1" : ""), { headers: { "x-admin-token": TOKEN } }),
      ]);
      if (er.ok) entities = await er.json();
      if (kr.ok) kbDocs = await kr.json();
      if (cr.ok) campaigns = await cr.json();
      if (ir.ok) { const rows = await ir.json(); insCache = {}; rows.forEach((r) => { insCache[r.phone] = r.data; }); }
      if (wr.ok) winloss = await wr.json();
      try { const ar = await fetch("/admin/product-assets", { headers: { "x-admin-token": TOKEN } }); if (ar.ok) prodAssets = await ar.json(); } catch (e) {}
      const curR = (location.hash || "").slice(1).split("/")[0];
      if (curR === "customer") {
        const ph = (location.hash || "").split("/")[1] || "";
        if (ph) {
          const pr = await fetch("/admin/customer/" + ph, { headers: { "x-admin-token": TOKEN } });
          if (pr.ok) { profileData = await pr.json(); profilePhone = ph; }
          else if (pr.status === 404) { profileData = { missing: true }; profilePhone = ph; }
        }
      }
    } catch (e) { /* keep last view */ }
  }
  render(true);
  renderConvo();
}
window.setOutcome = async (btn) => {
  try {
    const r = await fetch("/admin/contact/outcome", { method: "POST", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: btn.dataset.ph, outcome: btn.dataset.out }) });
    if (!r.ok) { alertBar("تعذّر تسجيل النتيجة (" + r.status + ")", true); return; }
    alertBar("سُجّلت النتيجة، وستُحتسب ضمن قياس أثر الحملات", false);
    await refresh();
  } catch (e) { alertBar("تعذّر الاتصال بالخادم", true); }
};
window.refreshInsights = async () => {
  if (!profilePhone) return;
  const el = document.getElementById("insbtn");
  if (el) el.textContent = "جارٍ القراءة…";
  try {
    const pr = await fetch("/admin/customer/" + profilePhone + "?refresh=1", { headers: { "x-admin-token": TOKEN } });
    if (pr.ok) { profileData = await pr.json(); render(false); alertBar("حُدّثت قراءة المساعد لهذه الجهة", false); }
    else { if (el) el.textContent = "تحديث قراءة المساعد"; alertBar("تعذّر التحديث (" + pr.status + ") — أعد المحاولة", true); }
  } catch (e) { const el2 = document.getElementById("insbtn"); if (el2) el2.textContent = "تحديث قراءة المساعد"; alertBar("تعذّر تحديث القراءة", true); }
};
window.addEventListener("hashchange", () => {
  if (convoPhone) closeConvo(); rQ = "";
  const cur = (location.hash || "").slice(1).split("/")[0];
  if (cur === "customer") { profileData = null; render(false); refresh(); }
  else render(false);
});
if (!location.hash) location.hash = "kmon";
refresh();
tplLoad();
setInterval(async () => {
  const cur = (location.hash || "#kmon").slice(1).split("/")[0];
  if (cur === "kmon" || cur === "home") { refresh(); }
  else if (TOKEN) { try { const r = await fetch("/admin/state", { headers: { "x-admin-token": TOKEN } }); if (r.ok) cache = await r.json(); } catch (e) {} }
}, 5000);
</script>
</body>
</html>`;
