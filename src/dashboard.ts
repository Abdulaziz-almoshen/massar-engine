// مَسار — the platform portal, built to the ORIGINAL prototype design (مسار.dc.html).
// Shell: navy sidebar + grouped nav + topbar. Marketing module screens:
//   متابعة الحملات — LIVE command center (funnel, contact tracker, transcripts)
//   إنشاء حملة    — the prototype's 4-step wizard, wired to today's backend (launch gated)
//   معرفة الخدمة   — readiness view over the agent's real seed KB (editing = next phase)
//   شركاء المبيعات + non-marketing screens — the prototype's empty-state pattern.
// Single-file RTL SPA (hash router), 5s refresh from /admin/state (token → localStorage).
//
// The campaigns module's Frappe-CRM view layer (control bar, selection + bulk actions, group/kanban,
// the 3-tab record) lives in ./campaigns-crm.js and is interpolated below at two anchor points. It is
// a separate file because ADR-0001 forbids range edits in this one; it is INTERPOLATED rather than
// imported because the client script is a template literal, and landing it inside this same <script>
// scope is what lets it reuse campStats/campWin/atOrAfter/seenOf/repliedIn — one definition each.

import { CAMPAIGNS_CRM_CSS, CAMPAIGNS_CRM_JS } from "./campaigns-crm.js";
import { CUSTOMERS_CRM_CSS, CUSTOMERS_CRM_JS } from "./customers-crm.js";
import { ACTIVITY_CRM_CSS, ACTIVITY_CRM_JS } from "./activity-crm.js";
import { RECORD_TABS_CSS, RECORD_TABS_JS } from "./record-tabs.js";
import { TASKS_CRM_CSS, TASKS_CRM_JS } from "./tasks-crm.js";
import { TARGETS_CRM_CSS, TARGETS_CRM_JS } from "./targets-crm.js";

export const DASHBOARD_HTML = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>مسار — نظام إدارة المبيعات</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; height: 100%; }
  /* Cairo is the platform font (founder's call). It is a VARIABLE face on Google Fonts
     (wght 200..1000), so it holds 450 — the weight the Frappe translation is built on — natively;
     the earlier swap to IBM Plex existed only because static Cairo jumps 400→500. */
  body { font-family: 'Cairo', system-ui, 'Segoe UI', 'Geeza Pro', Tahoma, 'Noto Naskh Arabic', sans-serif; background: #FFFFFF; color: #171717; font-size: 14px; font-weight: 450; line-height: 1.45; letter-spacing: 0; }
  ::selection { background: #3FB6B0; color: #fff; }
  .ms-scroll::-webkit-scrollbar { height: 8px; width: 8px; }
  .ms-scroll::-webkit-scrollbar-thumb { background: #d5dae2; border-radius: 999px; }
  .app { display: flex; height: 100vh; width: 100%; overflow: hidden; }

  /* ===== sidebar (Massar identity) ===== */
  /* V2: the sidebar is light. Navy and gold are retired from the product — with no dark surface
     they have no legal home. border-inline-end, not border-left: logical properties only. */
  aside { width: 250px; flex: none; background: #F8F8F8; color: #525252; display: flex;
    flex-direction: column; border-inline-end: 1px solid #EDEDED; }
  .switcher { display:flex; align-items:center; gap:10px; width:100%; font-family:inherit;
    height:52px; padding:10px 12px; background:transparent; border:none;
    border-bottom:1px solid #EDEDED; cursor:pointer; text-align:start; }
  .switcher:hover { background:#F3F3F3; }
  .switcher .chev { color:#C7C7C7; font-size:12px; flex:none; }
  .switcher .logo { width:28px; height:28px; flex:none; border-radius:6px;
    background:linear-gradient(135deg,#3FB6B0,#1F7A73); display:flex; align-items:center;
    justify-content:center; font-weight:700; font-size:15px; color:#fff; }
  .switcher .t1 { font-size:13px;
    font-weight:700; color:#171717; line-height:1.3; }
  .switcher .t2 { font-size:11px; font-weight:450; color:#7C7C7C; margin-top:1px;
    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  nav { flex:1; min-height:0; overflow-y:auto; padding:8px; }
  .grp { font-size:11px; font-weight:500; color:#999999; padding:6px 10px; margin-block-start:12px; }
  .grp:first-child { margin-block-start:4px; }
  .nv { display:flex; align-items:center; gap:10px; width:100%; font-family:inherit; height:32px;
    font-size:13px; font-weight:450; color:#525252; background:transparent; border:none;
    border-radius:6px; padding-inline:10px; cursor:pointer; text-align:start; margin-bottom:1px; }
  .nv:hover { background:#F3F3F3; }
  .nv.on { font-weight:500; color:#171717; background:#EDEDED; }
  .nv .gx { width: 20px; height: 20px; flex: none; display: flex; align-items: center; justify-content: center; }
  .nv .lbl { flex: 1; }
  .nv .dot { display:none; }
  .g-sq { width: 13px; height: 13px; border-radius: 3px; background: #999999; }
  .g-ci { width: 13px; height: 13px; border-radius: 999px; background: #999999; }
  .g-di { width: 11px; height: 11px; background: #999999; transform: rotate(45deg); border-radius: 2px; }
  .g-tr { width: 0; height: 0; border-right: 7px solid transparent; border-left: 7px solid transparent; border-bottom: 12px solid #999999; }
  .g-ba { width: 13px; height: 13px; border-right: 3px solid #999999; border-left: 3px solid #999999; border-radius: 1px; }
  .g-ri { width: 13px; height: 13px; border-radius: 999px; border: 3px solid #999999; }
  .g-tb { width: 13px; height: 13px; border-top: 3px solid #999999; border-bottom: 3px solid #999999; }
  .g-tree { width: 13px; height: 13px; border: 2px solid #999999; border-radius: 3px; }
  .nv.on .gx > * { background-color:#525252; border-color:#525252; }
  .nv.on .g-tr { background:none; border-bottom-color:#525252; }
  /* flex:none — without it the card is squeezed by the scrolling nav above and the last nav
     item reads as clipped behind it, on every screen. */
  .collapse { display:flex; align-items:center; gap:10px; font-family:inherit; height:32px;
    margin:8px; width:calc(100% - 16px); padding-inline:10px; font-size:12px; color:#7C7C7C;
    background:transparent; border:none; border-radius:6px; cursor:pointer; text-align:start;
    flex:none; }
  .collapse:hover { background:#F3F3F3; }
  .collapse .cicon { color:#999999; font-size:14px; }
  .userbox .av { width: 38px; height: 38px; flex: none; border-radius: 999px; background: #1c3a5e; display: flex; align-items: center; justify-content: center; color: #cdd6e6; font-weight: 700; font-size: 14px; }
  .userbox .n { font-size: 13px; font-weight: 700; color: #fff; }
  .userbox .r { font-size: 11px; color: #8ea3c0; }

  /* ===== main ===== */
  main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
  /* EXACT-1: header is h-10.5 = 42px, padding-inline 20 (pl-5). */
  header.crumb { height:42px; flex:none; display:flex; align-items:center; gap:8px;
    padding-inline:20px; background:#fff; border-bottom:1px solid #EDEDED; }
  header.crumb .t { font-size:14px; font-weight:500; color:#171717; }
  header.crumb .sep { font-size:13px; color:#C7C7C7; }
  header.crumb .s { font-size:13px; font-weight:450; color:#525252; }
  header .t { font-size: 21px; font-weight: 700; color: #171717; letter-spacing: -.2px; }
  header .s { font-size: 12.5px; color: #7C7C7C; margin-top: 3px; }
  .livechip { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:#7C7C7C;
    background:transparent; padding:0; border-radius:0; }
  .livechip .d { width: 7px; height: 7px; border-radius: 999px; background: #3FB6B0; }
  .body { flex: 1; overflow-y: auto; padding: 30px 32px 56px; }

  /* ===== components (reference-grade) ===== */
  .kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(168px, 1fr)); gap: 16px; margin-bottom: 24px; }
  /* A number card carries a label and a number. The 40px pastel disc that used to sit here held a
     droplet for «مهتمة» and a checkmark for «وصلت» — decoration standing in for meaning, and the
     loudest colour on the page. Frappe's number cards have no icon; neither do these now. */
  .kpi { background: #fff; border: 1px solid #EDEDED; border-radius: 10px; padding: 15px 17px; display: flex; flex-direction: column; gap: 7px; }
  .kpi .k { font-size: 12px; color: #7C7C7C; font-weight: 450; }
  .kpi .v { font-size: 25px; font-weight: 600; color: #171717; line-height: 1.1; font-variant-numeric: tabular-nums; letter-spacing: -.4px; }
  .kpi .dl { font-size: 11.5px; font-weight: 450; color: #7C7C7C; }
  .kpi .v small { font-size: 12px; font-weight: 450; color: #999999; }

  /* ===== the hero band =====
     Five identical white boxes is a spreadsheet, not a command centre: every figure carries the
     same weight, so the eye has nowhere to land and the page opens with no point of view. One
     figure leads — the pipeline the operator is actually judged on — with its own seven-day
     movement and a fourteen-day shape behind it; everything else supports it at a smaller size. */
  .hero { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(230px, .65fr); gap: 0;
    background: #fff; border: 1px solid #EDEDED; border-radius: 12px; overflow: hidden; margin-bottom: 18px; }
  .hero .hmain { padding: 22px 24px 16px; min-width: 0; display: flex; flex-direction: column; }
  .hero .hlab { font-size: 12.5px; color: #7C7C7C; }
  .hero .hrow { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; margin-top: 6px; }
  .hero .hfig { font-size: 44px; line-height: 1; font-weight: 600; color: #171717;
    font-variant-numeric: tabular-nums; letter-spacing: -1.4px; }
  .hero .hd { font-size: 13px; font-weight: 500; color: #027A48; background: #ECFDF3;
    border-radius: 999px; padding: 4px 10px; white-space: nowrap; }
  .hero .hd.flat { color: #7C7C7C; background: #F3F3F3; }
  .hero .hnote { font-size: 12.5px; color: #7C7C7C; margin-top: 8px; line-height: 1.7; }
  .hero .hspark { margin-top: auto; padding-top: 14px; }
  .hero .haxis { display: flex; justify-content: space-between; font-size: 11px; color: #C7C7C7; margin-top: 4px; }
  .hero .hside { border-inline-start: 1px solid #EDEDED; background: #FCFCFC; display: flex; flex-direction: column; }
  .hero .hs { display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 12px 20px; border-top: 1px solid #EDEDED; }
  .hero .hs:first-child { border-top: 0; }
  .hero .hs .k { font-size: 12.5px; color: #7C7C7C; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .hero .hs .k em { font-style: normal; font-size: 11.5px; color: #999999; }
  .hero .hs .v { font-size: 19px; font-weight: 600; color: #171717; font-variant-numeric: tabular-nums; }

  @media (max-width: 900px) {
    .hero { grid-template-columns: 1fr; }
    .hero .hside { border-inline-start: 0; border-top: 1px solid #EDEDED; }
    .hero .hfig { font-size: 36px; }
  }

  /* The funnel is drawn as a funnel. Six equal-length bars encode the ONE thing a funnel exists to
     show — the narrowing — as nothing at all; when the stages are genuinely equal this draws a
     column, which is the honest picture of a campaign that lost nobody. */
  /* حسب الخدمة — a band, not another chip row, because its three fields come from a different
     place than the spreadsheet columns beneath them and must not read as more of the same. */
  .affin { background: #F8F8F8; border: 1px solid #EDEDED; border-radius: 12px; padding: 14px 16px; margin-bottom: 16px; }
  .affin .ah { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
  .affin .ah .t { font-size: 13px; font-weight: 500; color: #171717; }
  .affin .ah .s { font-size: 12px; color: #999999; }
  .affin .row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 11px; }
  .affin .fld { display: flex; align-items: center; gap: 7px; }
  .affin .fld > span { font-size: 12.5px; color: #7C7C7C; white-space: nowrap; }
  .affin select { font-family: inherit; height: 32px; border: 1px solid #E2E2E2; border-radius: 6px;
    background: #fff; color: #383838; font-size: 12.5px; padding: 0 10px; cursor: pointer; max-width: 210px; }
  .affin select.on { border-color: #1F7A73; color: #1F7A73; background: #E9F7F6; }
  .excl { font-family: inherit; font-size: 12.5px; font-weight: 500; border-radius: 999px; padding: 7px 14px;
    cursor: pointer; border: 1px solid #E2E2E2; background: #fff; color: #525252; white-space: nowrap;
    transition: background .14s ease, border-color .14s ease, color .14s ease; }
  .excl:hover { background: #F3F3F3; border-color: #C7C7C7; }
  .excl.on { background: #1F7A73; border-color: #1F7A73; color: #fff; }
  .affin .why { font-size: 12px; color: #B54708; margin-top: 10px; line-height: 1.7; }
  .fnl { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: center; margin-top: 14px; }
  @media (max-width: 900px) { .chgrid { grid-template-columns: 1fr !important; } }
  .fnl .lg { display: flex; flex-direction: column; gap: 6px; }
  .fnl .lgr { display: flex; align-items: baseline; gap: 8px; height: 44px; }
  .fnl .lgr .nm { font-size: 12.5px; color: #383838; white-space: nowrap; }
  .fnl .lgr .vl { font-size: 14px; font-weight: 600; color: #171717; font-variant-numeric: tabular-nums; }
  .fnl .lgr .dp { font-size: 11.5px; color: #B42318; white-space: nowrap; }
  /* ما يستحق المتابعة الآن. Flush rows on a hairline, not four pastel cards — four tinted fills
     read as four alarms and the eye cannot rank four alarms. Urgency is the dot. */
  .aq { display: flex; align-items: center; gap: 12px; padding: 12px 2px; border-top: 1px solid #EDEDED; cursor: pointer; transition: background .14s ease; }
  .aq:hover { background: #F8F8F8; }
  .aqd { width: 8px; height: 8px; border-radius: 999px; flex: none; }
  .aqav { width: 32px; height: 32px; flex: none; border-radius: 8px; background: #F3F3F3; color: #525252; display: flex; align-items: center; justify-content: center; font-weight: 500; font-size: 13px; }
  .aqic { background: #F8F8F8; }
  .aqt { flex: 0 0 min(42%, 360px); min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  .aqn { font-size: 13.5px; font-weight: 500; color: #171717; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .aqw { font-size: 12px; color: #7C7C7C; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .noact .aqa { display: none; }
  .noact .aqt { flex: 1 1 auto; }
  .aqa { flex: 1 1 auto; min-width: 0; font-size: 12.5px; color: #525252; line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .aqgo { flex: none; font-size: 12px; font-weight: 500; color: #525252; opacity: 0; transition: opacity .14s ease; }
  /* لوحة الفرز rows: the same flush-row grid as every other table here. Five tinted fills read as
     five alert levels; none of these is an alert, so the colour is the group's dot, once. */
  /* معرفة الخدمة rows. SIX cells, six tracks — the arity is stated in both directions here so a
     later column cannot be added on one side only. */
  .kbrow { display: grid; grid-template-columns: minmax(0,1.8fr) 1fr minmax(0,1.4fr) .55fr .7fr 52px;
    align-items: center; gap: 14px; padding: 12px 20px 12px 12px; border-top: 1px solid #EDEDED;
    text-decoration: none; transition: background .14s ease; }
  .kbrow:first-of-type { border-top: 0; }
  a.kbrow:hover { background: #F8F8F8; }
  .kbrow .nm { font-size: 13.5px; font-weight: 450; color: #171717; display: flex; align-items: center;
    gap: 7px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kbrow .st { display: flex; align-items: center; gap: 7px; font-size: 12.5px; color: #525252; min-width: 0; }
  .kbrow .st .d { width: 6px; height: 6px; border-radius: 999px; flex: none; }
  .kbrow .st .fn { direction: ltr; color: #7C7C7C; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .kbrow .fig { font-size: 13px; color: #171717; font-variant-numeric: tabular-nums; }
  .kbrow .go { font-size: 12px; font-weight: 500; color: #525252; opacity: 0; transition: opacity .14s ease; }
  a.kbrow:hover .go { opacity: 1; }
  @media (max-width: 860px) {
    .kbrow { grid-template-columns: minmax(0,1fr) auto; row-gap: 5px; }
    .kbrow .st, .kbrow .fig { grid-column: 1 / 3; }
  }
  .oprow { display: grid; grid-template-columns: 28px minmax(0,1.5fr) 1.05fr minmax(0,2fr) 52px;
    align-items: center; gap: 12px; padding: 11px 20px 11px 12px; border-top: 1px solid #EDEDED;
    cursor: pointer; transition: background .14s ease; }
  .oprow:first-of-type { border-top: 0; }
  .oprow:hover { background: #F8F8F8; }
  .oprow .av { width: 28px; height: 28px; border-radius: 7px; background: #F3F3F3; color: #525252;
    display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 500; }
  .oprow .nm { font-size: 13.5px; font-weight: 450; color: #171717; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .oprow .ph { font-size: 12.5px; color: #7C7C7C; direction: ltr; text-align: start; font-variant-numeric: tabular-nums; }
  .oprow .wh { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .oprow .go { font-size: 12px; font-weight: 500; color: #525252; opacity: 0; transition: opacity .14s ease; }
  .oprow:hover .go, .oprow:focus-within .go { opacity: 1; }
  @media (max-width: 860px) {
    .oprow { grid-template-columns: 28px minmax(0,1fr) auto; row-gap: 4px; }
    .oprow .ph { grid-row: 2; grid-column: 2 / 4; }
    .oprow .wh { grid-row: 3; grid-column: 2 / 4; white-space: normal; }
  }
  .aq:hover .aqgo, .aq:focus-within .aqgo { opacity: 1; }
  @media (max-width: 860px) { .aqa { display: none; } }
  .card { background:#fff; border:1px solid #EDEDED; border-radius:10px; padding:16px;
    margin-bottom:16px; }
  .card h3 { margin: 0 0 16px; font-size: 14px; font-weight: 700; color: #525252; letter-spacing: .1px; }
  .chip { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:450;
    border-radius:6px; padding:3px 8px; white-space:nowrap; background:#F8F8F8;
    border:1px solid #EDEDED; color:#525252; }
  /* Semantic classes now tint only the TEXT, never the fill. */
  .c-grey { color:#525252; } .c-blue { color:#2F5F94; }
  .c-teal { color:#1F7A73; } .c-ok { color:#027A48; }
  .c-warn { color:#B54708; } .c-bad { color:#B42318; }
  /* An assistant reading is not a confirmed tag. Same hue so the level still reads at a
     glance, but hollow with a dashed edge so it can never be mistaken for a recorded fact. */
  .c-read { background: transparent; border-style: dashed; font-weight: 600; }
  .c-read .rd { font-weight: 700; opacity: .72; font-size: 10px; }
  .ptab { font-family:inherit; font-size:12px; font-weight:450; border:1px solid #EDEDED;
    background:#fff; color:#525252; border-radius:6px; padding:6px 12px; cursor:pointer; }
  .ptab.on { background:#EDEDED; color:#171717; border-color:#EDEDED; }
  .inp { font-family: inherit; font-size: 13px; color: #171717; border: 1px solid #E4E7EC; border-radius: 12px; padding: 11px 16px; background: #fff; outline: none; }
  .inp:focus { border-color: #3FB6B0; box-shadow: 0 0 0 3px rgba(63,182,176,.15); }
  .fun { margin-bottom: 13px; }
  .fun .r1 { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
  .fun .l { font-size: 12.5px; font-weight: 600; color: #171717; }
  .fun .m { font-size: 11.5px; color: #7C7C7C; font-variant-numeric: tabular-nums; }
  .fun .track { height: 9px; background: #F3F3F3; border-radius: 999px; overflow: hidden; }
  .fun .fill { height: 100%; border-radius: 999px; min-width: 3%; }
  .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 90px 20px; text-align: center; }
  .empty .ic { width: 64px; height: 64px; border-radius: 16px; background: #fff; box-shadow: 0 1px 3px rgba(16,24,40,.08); display: flex; align-items: center; justify-content: center; margin-bottom: 18px; }
  .empty .ic span { width: 26px; height: 26px; border: 2px dashed #E2E2E2; border-radius: 7px; }
  .empty .t { font-size: 17px; font-weight: 700; color: #171717; }
  .empty .s { font-size: 13px; color: #7C7C7C; margin-top: 6px; max-width: 380px; line-height: 1.8; }

  /* tables */
  .tblwrap { background: #fff; border: 1px solid #EDEDED; border-radius: 16px; overflow: hidden; margin-bottom: 18px; box-shadow: 0 1px 2px rgba(16,24,40,.04); }
  .ttoolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 18px 22px; border-bottom: 1px solid #EDEDED; }
  .cntpill { font-size: 12px; font-weight: 700; color: #1F7A73; background: #E9F7F6; border-radius: 999px; padding: 4px 12px; }
  /* Sparse-state rule (portal-wide): a screen with few rows must read as DELIBERATE, not
     half-loaded. One line, directly under the controls, that says what is here and where the
     rest is. Real data is still thin on most screens, so this recurs — it lives once. */
  .sparse { display: flex; align-items: flex-start; gap: 10px; margin: -6px 0 16px; padding: 12px 16px; border: 1px solid #E4E7EC; border-inline-start: 3px solid #1F7A73; border-radius: 12px; background: #fff; font-size: 12.5px; line-height: 1.85; color: #525252; }
  .sparse b { color: #171717; font-weight: 700; }
  .sparse .lnk { color: #1F7A73; font-weight: 700; cursor: pointer; text-decoration: none; }
  .tfoot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 20px; border-top: 1px solid #EDEDED; background: #F8F8F8; font-size: 12px; color: #7C7C7C; }
  /* Pagination. Every list in this product used to stop at LIST_CAP and tell the reader to narrow
     the search — which at 3,000 rows means rows 61 and beyond are simply unreachable, whatever you
     type. Truncation is not pagination. */
  .pgnav { display: flex; align-items: center; gap: 6px; }
  .pgnav button, .pgsize { font-family: inherit; font-size: 12px; color: #525252; background: #fff;
    border: 1px solid #E2E2E2; border-radius: 6px; height: 28px; padding: 0 10px; cursor: pointer;
    transition: background .14s ease, border-color .14s ease; }
  .pgnav button:hover:not(:disabled), .pgsize:hover { background: #F3F3F3; border-color: #C7C7C7; }
  .pgnav button:disabled { color: #C7C7C7; cursor: default; background: #F8F8F8; }
  .pgnav .at { font-variant-numeric: tabular-nums; color: #383838; padding: 0 4px; white-space: nowrap; }
  .pgrange { font-variant-numeric: tabular-nums; color: #525252; }
  .pgrange b { color: #171717; font-weight: 500; }
  .pgbtn { width: 34px; height: 34px; border-radius: 999px; border: 1px solid #EDEDED; background: #fff; color: #525252; font-family: inherit; font-size: 12.5px; font-weight: 700; cursor: pointer; }
  .pgbtn.on { background: #171717; color: #fff; border-color: #171717; }
  .kebab { width: 32px; height: 32px; border-radius: 8px; border: none; background: transparent; color: #999999; font-size: 17px; cursor: pointer; line-height: 1; }
  .kebab:hover { background: #F3F3F3; color: #525252; }
  .swt { width: 38px; height: 22px; border-radius: 999px; background: #EDEDED; position: relative; flex: none; transition: background .18s ease; }
  .swt.on { background: #1F7A73; }
  .swt i { position: absolute; top: 3px; inset-inline-start: 3px; width: 16px; height: 16px; border-radius: 999px; background: #fff; transition: inset-inline-start .18s ease; box-shadow: 0 1px 2px rgba(16,24,40,.2); }
  .swt.on i { inset-inline-start: 19px; }
  .thead, .trow { display: grid; grid-template-columns: 1.6fr 1.6fr 1.5fr 1.4fr 0.7fr 0.8fr; gap: 12px; padding: 15px 22px; align-items: center; }
  .thead { background: #F8F8F8; border-bottom: 1px solid #EDEDED; font-size: 11.5px; font-weight: 700; color: #7C7C7C; }
  .trow { border-bottom: 1px solid #F3F3F3; cursor: pointer; min-height: 62px; }
  .trow:hover { background: #F8F8F8; }
  .trow:last-child { border-bottom: none; }
  .cust { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .cust .av { width: 40px; height: 40px; flex: none; border-radius: 999px; background: #F3F3F3; display: flex; align-items: center; justify-content: center; color: #525252; font-weight: 700; font-size: 15px; }
  .cust .nm { font-size: 13.5px; font-weight: 700; color: #171717; }
  .cust .ph { font-size: 11px; color: #999999; direction: ltr; text-align: right; }
  .lastm { font-size: 12px; color: #7C7C7C; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tm { font-size: 11px; color: #999999; font-variant-numeric: tabular-nums; }
  .statgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 14px; margin-bottom: 18px; }
  .statc { background:#fff; border:1px solid #EDEDED; border-radius:10px; padding:14px 16px; }
  .statc .l { font-size: 11.5px; color: #7C7C7C; margin-bottom: 8px; font-weight: 600; }
  .statc .v { font-size: 24px; font-weight: 700; color: #171717; line-height: 1; font-variant-numeric: tabular-nums; }
  .statc .p { font-size: 10.5px; color: #2E7D77; font-weight: 700; margin-top: 6px; }
  .statc .mb { height: 4px; background: #F3F3F3; border-radius: 999px; overflow: hidden; margin-top: 9px; }
  .statc .mb i { display: block; height: 100%; border-radius: 999px; }
  .backdrop { position: fixed; inset: 0; background: rgba(16,24,40,.4); z-index: 69; }
  .convo { position: fixed; inset-block: 0; inset-inline-start: 0; width: min(430px, 94vw); background: #fff; z-index: 70; display: flex; flex-direction: column; box-shadow: 12px 0 32px rgba(16,24,40,.18); }
  .convo .hd { flex: none; display: flex; align-items: center; gap: 11px; padding: 14px 18px; border-bottom: 1px solid #EDEDED; }
  .convo .hd .av { width: 40px; height: 40px; flex: none; border-radius: 999px; background: #F3F3F3; color: #525252; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; }
  .convo .msgs { flex: 1; overflow-y: auto; background: #E5DDD4; padding: 16px; }
  .convo .ft { flex: none; padding: 13px 18px; border-top: 1px solid #EDEDED; }
  @media (prefers-reduced-motion: no-preference) { .convo { animation: slideIn .18s ease; } @keyframes slideIn { from { transform: translateX(-30px); opacity: .6; } to { transform: none; opacity: 1; } } }
  .bub { max-width: 76%; border-radius: 12px; padding: 9px 13px; font-size: 12.5px; line-height: 1.9; margin-bottom: 9px; box-shadow: 0 1px 1px rgba(0,0,0,.06); white-space: pre-line; color: #171717; }
  .b-a { background: #DCF8C6; border-top-left-radius: 3px; margin-inline-start: auto; }
  .b-c { background: #fff; border-top-right-radius: 3px; margin-inline-end: auto; }
  .b-s { background: rgba(255,255,255,.65); font-size: 11px; color: #525252; max-width: 100%; text-align: center; }
  .bt { font-size: 9.5px; color: #7d8b6a; text-align: left; margin-top: 4px; direction: ltr; }

  /* wizard */
  .step { background: #fff; border-radius: 16px; padding: 26px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(16,24,40,.07), 0 1px 2px rgba(16,24,40,.04); }
  .step .hd { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
  .step .num { width: 32px; height: 32px; flex: none; border-radius: 999px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; background: #2E8F89; color: #fff; }
  .step .num.done { background: #E9F7F6; color: #2E7D77; }
  .step .ht { font-size: 15.5px; font-weight: 700; color: #171717; }
  .step .hs { font-size: 12.5px; color: #7C7C7C; margin-top: 4px; }
  .prods { display: grid; grid-template-columns: repeat(auto-fit, minmax(195px, 1fr)); gap: 14px; }
  .prod { text-align: right; font-family: inherit; background: #fff; border: 1.5px solid #EDEDED; border-radius: 16px; padding: 18px; cursor: pointer; }
  .prod.on { background: #F6FCFB; border-color: #3FB6B0; box-shadow: 0 0 0 3px rgba(63,182,176,.12); }
  .prod .pn { font-size: 13.5px; font-weight: 700; color: #171717; margin-bottom: 12px; }
  .prod .sc { font-size: 21px; font-weight: 700; }
  .prod .scl { font-size: 10.5px; color: #999999; }
  .prod .bar { height: 6px; background: #F3F3F3; border-radius: 999px; overflow: hidden; margin: 10px 0; }
  .prod .bar i { display: block; height: 100%; border-radius: 999px; }
  .wa-prev { background: #E5DDD4; border-radius: 16px; padding: 18px; max-width: 480px; }
  .wa-prev .b { background: #DCF8C6; border-radius: 12px; border-top-left-radius: 3px; padding: 12px 14px; font-size: 12.5px; color: #171717; line-height: 2; white-space: pre-line; box-shadow: 0 1px 1px rgba(0,0,0,.08); }
  .wa-prev .t { font-size: 9.5px; color: #7d8b6a; text-align: left; margin-top: 6px; }
  .btn { font-family:inherit; font-size:13px; font-weight:500; border:none; border-radius:6px;
    padding:0 12px; height:32px; display:inline-flex; align-items:center; gap:6px; cursor:pointer; }
  .btn-teal { color: #fff; background: #1F7A73; box-shadow: 0 1px 2px rgba(16,24,40,.1); }
  .btn-dark { color: #fff; background: #171717; }
  .btn-ghost { color: #383838; background: #fff; border: 1px solid #E2E2E2; }
  .btn:hover { filter: brightness(.97); }
  .btn-dis { color: #999999; background: #F3F3F3; cursor: not-allowed; }
  .note { display:flex; align-items:center; gap:9px; background:#fff; border:1px solid #EDEDED;
    border-inline-start:3px solid #B54708; border-radius:10px; padding:12px 16px; font-size:12px;
    color:#525252; font-weight:450; margin-top:14px; }

  /* kb */
  .kbrow { display: flex; align-items: center; gap: 14px; padding: 17px 22px; border-bottom: 1px solid #F3F3F3; }
  .kbrow:last-child { border-bottom: none; }
  .kbrow .dt { width: 9px; height: 9px; flex: none; border-radius: 999px; }
  .kbrow .ti { flex: 1; min-width: 0; }
  .kbrow .t1 { font-size: 13.5px; font-weight: 700; color: #171717; }
  .kbrow .t2 { font-size: 11.5px; color: #999999; margin-top: 4px; }
  .kbrow .ct { font-size: 11.5px; color: #999999; }
  .gate { max-width: 420px; margin: 80px auto; background: #fff; border-radius: 16px; padding: 30px; text-align: center; box-shadow: 0 1px 3px rgba(16,24,40,.08); }
  .gate input { font-family: inherit; width: 100%; font-size: 13px; border: 1px solid #E4E7EC; border-radius: 12px; padding: 12px 14px; margin: 14px 0; direction: ltr; }
  .ptitle { display: flex; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 22px; }
  .ptitle h1 { margin:0; font-size:18px; font-weight:600; color:#171717; letter-spacing:0;
    line-height:1.4; }
  .ptitle p { margin: 6px 0 0; font-size: 13.5px; color: #7C7C7C; }
  .ptitle .acts { margin-inline-start: auto; display: flex; gap: 10px; align-items: center; }
  .sec { font-size: 14px; font-weight: 700; color: #525252; margin: 4px 0 14px; }
  /* motion */
  @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
  @media (prefers-reduced-motion: no-preference) {
    /* Entrance only. render() rewrites #body on every keystroke, so an unconditional .rise
       re-ran this 420ms slide-up each time and the table visibly jumped while typing. */
    .rise { animation: rise .28s cubic-bezier(.22,.9,.32,1) both; }
    .norise .rise { animation: none; }
    .card, .statc, .step { transition: border-color .16s ease; }
    .trow { transition: background .15s ease; }
    .bar i, .fun .fill, .statc .mb i, .prog i { transition: width .7s cubic-bezier(.22,.9,.32,1); }
    .livechip .d { animation: pulse 2s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .55; transform: scale(.82); } }
  }
  .skel { background: linear-gradient(90deg, #F3F3F3 25%, #EDEDED 37%, #F3F3F3 63%); background-size: 200% 100%; animation: shimmer 1.4s linear infinite; border-radius: 8px; }
  .sec .meta { font-size: 11.5px; font-weight: 600; color: #999999; margin-inline-start: 8px; }
  /* The launch bar is docked chrome; on a phone it must not eat the step it sits under. */
  @media (max-width: 430px) {
    .lbar { gap: 8px !important; padding: 12px 14px !important; }
    .lbar .lsub { display: none; }
    .lbar .btn { padding: 10px 16px !important; font-size: 12.5px !important; }
  }
  /* The conversation ledger is a side column on desktop; below 900 it must become a block, not an
     orphaned 210px strip with a floating vertical hairline. */
  @media (max-width: 900px) {
    .convled { width: 100% !important; border-inline-start: 0 !important; padding-inline-start: 0 !important;
               border-top: 1px solid #F3F3F3; padding-top: 14px; }
  }
  /* ===== ملف العميل — the enrichable client record (cycle crm-record; DESIGN.md) =====
     The provenance mark is an 8px SHAPE in a fixed start-side column: shape carries the meaning,
     colour only reinforces it, and the mark never renders without its word. */
  /* Frappe's record is main + a narrower side rail. 372px was too wide for a rail and too narrow
     for a column, so the two panels fought for the same space and left a ragged edge. */
  /* EXACT-1: side panel default 352px, min 256, max 480. */
  .crec { display:grid; grid-template-columns: 352px minmax(0,1fr); gap:16px; align-items:start; }
  .crecmain { display:grid; grid-template-columns:1fr; gap:16px; align-items:start; }
  .pm { width: 8px; height: 8px; flex: none; margin-top: 7px; }
  .pm-h { background: #1F7A73; border-radius: 2px; }
  .pm-a { border: 1.5px dashed #B54708; border-radius: 999px; background: transparent; }
  .pm-i { background: #2F5F94; border-radius: 2px; opacity: .55; }
  .pm-m { border: 1px dashed #E2E2E2; border-radius: 2px; background: transparent; }
  /* EXACT-1: two columns, 35/65, not a stacked pair. min-w-20 = 80px floor on the label. */
  .frow { display:flex; gap:10px; padding:8px 0; border-bottom:1px solid #F3F3F3; position:relative; }
  .frow:last-child { border-bottom: none; }
  /* the only tinted rows in the panel, and lighter than any chip: a reading never outranks a fact */
  /* A reading is marked by its «قراءة» chip and its dashed provenance dot, not by a cream wash.
     #FFFDF7 was the last tinted surface in the panel and it made the AI's guess the loudest block
     on the record — the opposite of the intended hierarchy. */
  .frow.rdrow { background:#fff; margin:0 -8px; padding:8px; border-radius:8px;
    border-inline-start:2px solid #EDEDED; }
  /* EXACT-1: the field row is two columns, 35/65, with an 80px floor on the label — that split is
     what makes Frappe's panel scan as a form instead of a stack of caption-and-value pairs. */
  .fbody { flex:1; min-width:0; display:grid; grid-template-columns: minmax(80px,35%) minmax(0,65%);
    column-gap:10px; row-gap:2px; align-items:start; }
  /* the label owns column 1; every other child stacks down column 2. Doing this in CSS avoids
     restructuring propRow's markup, which emits value/sig/quote as siblings. */
  .fbody > .flab { grid-column:1; grid-row:1; }
  .fbody > :not(.flab) { grid-column:2; min-width:0; }
  /* Chips WRAP inside their column. Clipping produced «نية مرتفد» — a word cut in half, which is
     worse than two lines. The panel is 352px and these labels are long by nature. */
  .fbody .chip { max-width:100%; white-space:normal; line-height:1.6; align-items:flex-start; }
  .flab { font-size:13px; font-weight:450; color:#7C7C7C; letter-spacing:0; line-height:1.5; }
  .fval { font-size:14px; font-weight:450; color:#171717; line-height:1.5; min-height:28px;
    margin-top:0; }
  .fval-a { font-size:14px; font-weight:450; color:#525252; }
  .fval-m { font-size:14px; font-weight:450; color:#999999; margin-top:0; min-height:28px; }
  .sig { font-size:11px; color:#999999; margin-top:3px; font-weight:450; }
  .quote { font-size:12px; color:#7C7C7C; margin-top:4px; line-height:1.7; }
  .ferr { font-size: 11.5px; color: #B42318; font-weight: 700; margin-top: 6px; line-height: 1.7; }
  .pen { position: absolute; inset-inline-end: 0; top: 10px; border: none; background: transparent; color: #999999; cursor: pointer; font-size: 14px; width: 34px; height: 34px; border-radius: 8px; opacity: 0; font-family: inherit; }
  .frow:hover .pen, .frow:focus-within .pen { opacity: 1; }
  .pen[disabled] { cursor: not-allowed; color: #E2E2E2; }
  @media (hover: none) { .pen { opacity: 1; } }
  .cbar { display: flex; gap: 7px; margin-top: 9px; flex-wrap: wrap; }
  .mini { font-size: 11.5px; font-weight: 700; padding: 8px 15px; border-radius: 999px; min-height: 36px; }
  .add { font-size: 11.5px; font-weight: 700; color: #1F7A73; background: transparent; border: 1px dashed #C4E8E5; border-radius: 999px; padding: 6px 13px; cursor: pointer; margin-top: 6px; font-family: inherit; display: inline-block; text-decoration: none; }
  .plgnd { display: flex; gap: 14px; flex-wrap: wrap; font-size: 10.5px; color: #999999; font-weight: 600; margin: 8px 0 4px; padding-bottom: 10px; border-bottom: 1px solid #F3F3F3; }
  .plgnd .i { display: inline-flex; gap: 6px; align-items: center; }
  .crec :focus-visible { outline: 2px solid #2E7D77; outline-offset: 2px; }
  @media (prefers-reduced-motion: no-preference) {
    .fsaved { animation: fsaved .14s ease-out; }
    @keyframes fsaved { from { background: #ECFDF3; } to { background: transparent; } }
  }
  /* one column below 900: ملف العميل comes BEFORE فهم المساعد on purpose — properties beat the
     AI card, and the 372px track would otherwise become an orphaned strip. */
  @media (max-width: 900px) { .crec { grid-template-columns: 1fr; } }
  @media (max-width: 600px) {
    .pen { opacity: 1; width: 40px; height: 40px; top: 6px; }
    .cbar .mini { flex: 1 1 44%; min-height: 40px; }
  }
  @media (max-width: 900px) { aside { display: none; } .thead, .trow:not(.km) { grid-template-columns: 1.5fr 1.4fr 1.1fr .5fr; } .thead div:nth-child(4), .trow:not(.km) > div:nth-child(4), .thead div:nth-child(5), .trow:not(.km) > div:nth-child(5) { display: none; } .trow > div:last-child { font-size: 14px !important; } .hidemob { display: none !important; } }
${CAMPAIGNS_CRM_CSS}
${CUSTOMERS_CRM_CSS}
${ACTIVITY_CRM_CSS}
${RECORD_TABS_CSS}
${TASKS_CRM_CSS}
${TARGETS_CRM_CSS}
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
    <!-- Frappe's product switcher: app mark, workspace over operator, one chevron. Replaces the
         old .brand band AND the bottom .userbox — the operator's name belongs here, not twice. -->
    <button class="switcher" aria-label="مسار — عبدالعزيز المحسن">
      <div class="logo">م</div>
      <div style="min-width:0;flex:1;text-align:start;">
        <div class="t1">مسار</div>
        <div class="t2">عبدالعزيز المحسن</div>
      </div>
      <span class="chev">⌄</span>
    </button>
    <nav class="ms-scroll" id="nav"></nav>
    <button class="collapse" id="navcollapse" aria-label="طيّ القائمة">
      <span class="cicon">⇤</span><span class="clbl">طيّ القائمة</span>
    </button>
  </aside>
  <main>
    <!-- Frappe's breadcrumb bar: module / current view, and ONE primary action. Replaces the 76px
         header AND the .ptitle band beneath it. #pt/#ps/#live are kept as ids because nav() writes
         all three by id every route change — deleting them blanks every screen (ADR-0001). -->
    <header class="crumb">
      <span class="t" id="pt">مسار</span>
      <span class="sep">/</span>
      <span class="s" id="ps"></span>
      <span style="flex:1"></span>
      <span class="livechip" id="live" style="display:none"><span class="d"></span> مباشر · <span id="upd">—</span></span>
      <span id="crumbact"></span>
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
let manualOpen = false; let manualStat = ""; let oppTab = "scheduled"; let oppQ = "";
// Elapsed time in the unit a person would say it in. Below two days an hour count is what the
// operator acts on («٩ ساعات بلا متابعة»); above it, hours stop being information.
function fmtAgo(ms) {
  if (!ms || ms < 0) return "";
  const h = Math.round(ms / 3600e3);
  if (h < 1) return "أقل من ساعة";
  if (h < 48) return fmtN(h) + (h === 1 ? " ساعة" : h === 2 ? " ساعتين" : h <= 10 ? " ساعات" : " ساعة");
  const d = Math.round(h / 24);
  if (d < 60) return fmtN(d) + (d === 2 ? " يومين" : d <= 10 ? " أيام" : " يومًا");
  const mo = Math.round(d / 30);
  return fmtN(mo) + (mo === 2 ? " شهرين" : mo <= 10 ? " أشهر" : " شهرًا");
}
const LIST_CAP = 60;   // per-GROUP preview cap on grouped/kanban surfaces only; flat lists paginate
// ---------------------------------------------------------------------------
// PAGINATION — one implementation, every flat list.
//
// Until now every list sliced to LIST_CAP and printed «ضيّق بالبحث لرؤية الباقي». Simulated at the
// real target — 200 campaigns, 3,000 targets, 1,700 conversations — that sentence is false: row 61
// is unreachable no matter what you type, because search narrows the same list the same slice then
// truncates again. Ten sites did this.
//
// PAGE is keyed per list so paging the campaigns list does not move the customers list, and
// pageOf() CLAMPS instead of writing: a filter that shrinks 34 pages to 1 must not strand the
// reader on an empty page 34, and a render must not mutate the state its own repaint signature is
// computed from.
let PAGE = {};
let PAGE_SIZE = 50;
const PAGE_SIZES = [25, 50, 100, 200];
function pageOf(key, total) {
  const size = PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(1, PAGE[key] || 1), pages);
  return { p, pages, size, total, from: total ? (p - 1) * size + 1 : 0, to: Math.min(total, p * size) };
}
function pageSlice(key, rows) {
  const m = pageOf(key, rows.length);
  return rows.slice((m.p - 1) * m.size, m.p * m.size);
}
// The range and the total are ALWAYS stated, even on one page — «٦١–١٢٠ من ١٬٧٠٠» is the sentence
// that tells the reader the list continues, and its absence is what made truncation look complete.
function pageBar(key, total, unit) {
  const m = pageOf(key, total);
  let h = '<span class="pgrange">' + (total
    ? "<b>" + fmtN(m.from) + "–" + fmtN(m.to) + "</b> من " + fmtN(total) + " " + unit
    : "لا " + unit) + "</span>";
  if (total > PAGE_SIZES[0]) {
    h += '<span class="pgnav">' +
      '<select class="pgsize" onchange="pageSetSize(this.value)" aria-label="عدد الصفوف في الصفحة">' +
      PAGE_SIZES.map((n) => '<option value="' + n + '"' + (n === m.size ? " selected" : "") + ">" + fmtN(n) + " لكل صفحة</option>").join("") + "</select>";
    if (m.pages > 1) {
      h += '<button onclick="pageGo(&quot;' + key + '&quot;,' + (m.p - 1) + ')"' + (m.p <= 1 ? " disabled" : "") + ">السابق →</button>" +
        '<span class="at">' + fmtN(m.p) + " / " + fmtN(m.pages) + "</span>" +
        '<button onclick="pageGo(&quot;' + key + '&quot;,' + (m.p + 1) + ')"' + (m.p >= m.pages ? " disabled" : "") + ">← التالي</button>";
    }
    h += "</span>";
  }
  return h;
}
window.pageGo = (key, p) => { PAGE[key] = p; render(false); const b = document.getElementById("body"); if (b) b.scrollIntoView({ block: "start" }); };
window.pageSetSize = (n) => { PAGE_SIZE = Number(n); PAGE = {}; render(false); };
let kbDocs = []; let prodAssets = []; let launching = false; let campaigns = []; let campFilter = "all"; let campName = "";
let showTest = false;         // sandbox separation: test traffic hidden from real views by default
// Opens on «فعلية»: rehearsals and duplicate launches are one click away under «تجريبية»,
// not the first thing on the screen. Defaulting to «الكل» made the list read as clutter.
let campQ = ""; let campTab = "real"; let campSortKey = "new";   // campaigns list controls
let showTestDecided = false;
let profileData = null;       // العميل ٣٦٠ payload for the open #customer/<phone> route
let profilePhone = "";        // phone the loaded profile belongs to
let profileCampaign = "";     // campaign id the read is scoped to ("" = lifetime)
// ملف العميل — the ONE field open in the editor, never a whole-form mode: { key, val, err, sel }.
let propEdit = null;
let propFlash = "";           // key whose row just saved, for the 140ms confirmation tint
let insCache = {};            // phone → cached فهم المساعد (list rows read this, no LLM)
let winloss = null;           // «لماذا نكسب ولماذا نخسر» aggregate (cached reads only)
let retargetCohort = null;    // {label, campaign, targets:[{phone,name}]} — set from a campaign's filtered cohort
let lastDetailCohort = null;  // captured at render time by vKmonDetail (current filter + search)
let campMsg = "في أغلب المنشآت الصحية، إصدار {product} يمر بخطوات ورقية متكررة بين النظام الداخلي والجهات الرسمية.\\n\\nما نقدمه في لِين هو ربط مباشر مع نظام HIS لديكم: الإجراء يُنفَّذ من داخل نظامكم بتوثيق رسمي معتمد، فيقل زمن الإصدار بنسبة تصل إلى ٧٠٪ ويختفي الإدخال المزدوج.\\n\\nأرفقنا ملفًا موجزًا يوضح آلية الربط والخطوات.\\n\\nسؤال واحد لنعرف ما يناسبكم: كم فرعًا لديكم تقريبًا؟";

const NAV = [
  { grp: "نظرة عامة" }, { id: "home", l: "الرئيسية", i: "home" },
  { grp: "دورة البيع" }, { id: "customers", l: "العملاء", i: "users" }, { id: "opps", l: "فرص البيع", i: "target" }, { id: "pipeline", l: "لوحة المتابعة", i: "reply" }, { id: "tasks", l: "المهام", i: "check" }, { id: "notes", l: "الملاحظات", i: "doc" },
  { grp: "التسويق" }, { id: "aimkt", l: "إنشاء حملة", i: "send" }, { id: "kmon", l: "متابعة الحملات", i: "eye" }, { id: "kb", l: "معرفة الخدمة", i: "book" }, { id: "partners", l: "شركاء المبيعات", i: "spark" },
  { grp: "التخطيط وقياس الأداء" }, { id: "products", l: "المنتجات", i: "flame" }, { id: "targets", l: "جهات الاستهداف", i: "up" }, { id: "reports", l: "التقارير", i: "chart" },
  { grp: "المنشأة" }, { id: "org", l: "الهيكل التنظيمي", i: "users" },
];
const TITLES = {
  home: ["الرئيسية", "نظرة عامة على نشاط مسار الفعلي"],
  kmon: ["الحملات", "متابعة أداء حملات مساعد المبيعات"],
  aimkt: ["إنشاء حملة", "أنشئ حملة موجهة للمنشآت الصحية"],
  kb: ["معرفة الخدمة لمساعد المبيعات", "المعرفة المعتمدة التي يستند إليها مساعد المبيعات في واتساب"],
  partners: ["لوحة متابعة شركاء المبيعات", "ضمن المرحلة القادمة"],
  customers: ["العملاء", "كل جهة تحدّث معها المساعد، وحالتها"],
  customer: ["ملف جهة الاستهداف", "بيانات الجهة، وقراءة المساعد، وسجل التفاعل"], opps: ["فرص البيع", "من مهتم، ومن غير مهتم، ومتى موعد المهتمين"],
  pipeline: ["لوحة المتابعة", "كل إرسال وتسليم وردّ، بالترتيب الزمني"],
  tasks: ["المهام", "ما يجب فعله، ومتى يستحق"], notes: ["الملاحظات", "ما دوّنه الفريق عن العملاء"], products: ["المنتجات", "ضمن المرحلة القادمة"],
  targets: ["جهات الاستهداف", "استورد جهات الاستهداف وأدرها للحملات"], reports: ["التقارير", "ضمن المرحلة القادمة"], org: ["الهيكل التنظيمي", "ضمن المرحلة القادمة"],
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
  // Two badges, both counts of work OWED and both derived from data already in memory — no extra
  // request, and nothing that can be stale in a way the screen behind it is not.
  //   فرص البيع  — appointments confirmed for today: the calls you owe before the day ends.
  //   المهام     — tasks past due, only once the tasks route has actually loaded them; a badge
  //                that guesses «٠» before the fetch is a lie for the whole session.
  const badges = {};
  try {
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const t1 = t0.getTime() + 864e5;
    const due = ((cache && cache.contacts) || []).filter((c) => {
      if (c.optedOut || c.outcome === "stopped" || c.outcome === "not_interested") return false;
      const a = appt(c);
      return a && a.confirmed && a.at >= t0.getTime() && a.at < t1;
    }).length;
    if (due) badges.opps = [fmtN(due), "q", "مواعيد مؤكَّدة اليوم"];
    if (typeof tskRows !== "undefined" && tskRows) {
      const late = tskRows.filter((t) => t.status !== "done" && t.status !== "canceled" && t.due_at && t.due_at < Date.now()).length;
      if (late) badges.tasks = [fmtN(late), "", "مهام تجاوزت موعدها"];
    }
  } catch (e) { /* a badge is an ornament on top of the route; it must never stop nav() painting */ }
  document.getElementById("nav").innerHTML = NAV.map((x) => {
    if (x.grp) return '<div class="grp">' + x.grp + "</div>";
    const b = badges[x.id];
    return '<button class="nv' + (x.id === cur ? " on" : "") + '" onclick="location.hash=\\'' + x.id + '\\'">' +
      '<span class="gx">' + ic(x.i, 16, x.id === cur ? "#1F7A73" : "#999999") + '</span><span class="lbl">' + x.l + "</span>" +
      (b ? '<span class="bdg ' + b[1] + '">' + b[0] + "</span>" : "") + "</button>";
  }).join("");
  // TITLE reads raw, not cur. The alias above exists to keep the sidebar item highlighted on a
  // detail view; feeding the same variable to the heading printed «جهات الاستهداف · استورد جهات
  // الاستهداف وأدرها للحملات» — the import list's title — above every CLIENT RECORD, and made
  // TITLES.customer unreachable. One variable was doing two jobs with opposite answers.
  const t = TITLES[raw] || TITLES[cur] || TITLES.kmon;
  document.getElementById("pt").textContent = t[0];
  document.getElementById("ps").textContent = t[1];
  document.getElementById("live").style.display = (cur === "kmon" || cur === "home") ? "" : "none";
}

// win scopes the delivery chip to a campaign. On a campaign screen the row chip read «ردّ» from
// lifetime state while the counter beside it correctly read «ردّوا ٠» — the same screen
// contradicting itself, which is precisely what the founder catches. Default 0 keeps every
// contact-centric caller lifetime-scoped, explicitly.
function chipRow(c, win) {
  if (!c) return "";
  const w = Number(win) || 0;
  const at = (ts) => { const n = Number(ts); return Number.isFinite(n) && n > 0 && n >= w; };
  const st = c.statusTimes || {};
  const out = [];
  if (at(st.failed) && !at(st.delivered)) out.push('<span class="chip c-bad">فشل الإرسال</span>');
  else if (w ? repliedIn(c, w) : at(st.replied)) out.push('<span class="chip c-ok">ردّ</span>');
  else if (at(st.read)) out.push('<span class="chip c-teal">شوهدت</span>');
  else if (at(st.delivered)) out.push('<span class="chip c-blue">وصلت</span>');
  else if (at(st.sent) || at(st.enqueued)) out.push('<span class="chip c-grey">أُرسلت</span>');
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

// INDEXED, not scanned. This is the hottest function in the client: the campaigns list calls
// campStats() for every campaign on every paint, and campStats calls this once per target. At the
// simulated target — 200 launches averaging 87 targets over 1,700 contacts — a linear .find() is
// ~26 million string comparisons per repaint, measured at 110-123ms EVERY paint, which is a visible
// stutter on every keystroke in the campaigns search box and grows linearly with the book.
// Rebuilt when the identity of the contacts array changes, so it can never serve a stale row.
let _cbpSrc = null, _cbpMap = null;
function contactByPhone(phone) {
  const list = (cache && cache.contacts) || [];
  if (_cbpSrc !== list) { _cbpSrc = list; _cbpMap = new Map(); list.forEach((c) => _cbpMap.set(c.phone, c)); }
  return _cbpMap.get(phone);
}
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
  // Only an ISO-looking string may reach Date.parse. A bare "0" or "-1" parses as the year 2000,
  // which would open the window on every past event — the exact failure this function exists to
  // prevent, arriving through the fallback. Numbers that are not positive epoch millis fail closed.
  const str = String(raw).trim();
  // NOTE: this file is a TS template literal, so a single backslash is consumed before the browser
  // sees it — /^\d{4}/ shipped as /^d{4}/ and matched nothing. Escapes must be DOUBLED here.
  if (!/^\\d{4}-\\d{2}/.test(str) && !/\\d{2}:\\d{2}/.test(str)) return Infinity;
  const parsed = Date.parse(str);                              // ISO fallback
  // Shape is not sanity: "1970-01" parses to 0 and "0000-01" to a negative, both of which would
  // open the window on all history through the fallback meant to close it.
  if (!(parsed > 0)) return Infinity;
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
  if (!c) return '<span style="color:#E2E2E2;">—</span>';
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
  // same dedupe as the tags path above: a repeated reading is one interest, not two.
  const piMap = new Map();
  (ins.product_interest || []).filter((x) => x.product).forEach((x) => {
    const r = { high: 3, medium: 2, low: 1 };
    const cur = piMap.get(x.product);
    if (!cur || (r[x.level] || 0) > (r[cur.level] || 0)) piMap.set(x.product, x);
  });
  const pi = [...piMap.values()];
  if (pi.length) {
    return pi.slice(0, 2).map((x) => '<span class="chip c-read ' + (x.level === "high" ? "c-ok" : x.level === "medium" ? "c-warn" : "c-grey") + '" title="' + esc(x.product) + " — قراءة المساعد من نص المحادثة، لم تُسجَّل كوسم مؤكد" + '">' +
      '<span class="rd">قراءة</span>' + esc(clip(x.product, 24)) + " · " + (x.level === "high" ? "نية مرتفعة" : x.level === "medium" ? "مهتم" : "فاتر") + "</span>").join(" ");
  }
  if (ins.intent === "high") return '<span class="chip c-read c-ok" title="قراءة المساعد من نص المحادثة"><span class="rd">قراءة</span>نية مرتفعة</span>';
  if (ins.intent === "medium") return '<span class="chip c-read c-warn" title="قراءة المساعد من نص المحادثة"><span class="rd">قراءة</span>اهتمام مبدئي</span>';
  if (c.outcome === "handoff") return '<span class="chip c-warn">طلب تواصلًا</span>';
  if (c.outcome === "interested") return '<span class="chip c-ok">مهتم</span>';
  if (c.outcome === "not_interested") return '<span class="chip c-grey">غير مهتم</span>';
  return '<span style="color:#E2E2E2;">—</span>';
}
function fmtD(ts) { return new Date(Number(ts)).toLocaleDateString("ar-SA", { day: "numeric", month: "long" }); }
// --- THE APPOINTMENT — one moment, one reader ------------------------------
// M3. c.scheduledAt is the ONLY stored appointment moment: tracker.writeProp writes it whenever a
// human types a day into الخطوة التالية, and tracker.setSchedule never overwrites a day a human
// typed. props.nextStep carries the PROVENANCE of that same moment — so «مؤكَّد» is DERIVED, never
// a second store. Every surface that speaks about the appointment (قائمة الصباح · شريط الفرز ·
// ملف العميل) reads it here and nowhere else, so a fourth surface cannot invent a fourth opinion.
// A string that contains no letter or digit is not a quote — it is leftover punctuation from a
// scrub or a truncation. Surfaces that quote the assistant must refuse it rather than framing it.
function hasWords(x) {
  return /[\\p{L}\\p{N}]/u.test(String(x || ""));
}
function appt(c) {
  const at = c && c.scheduledAt ? Number(c.scheduledAt) : 0;
  if (!at) return null;
  const p = ((c || {}).props || {}).nextStep;
  // Equality is the safety catch. If the two ever drifted we report UNCONFIRMED: claiming a human
  // confirmed a moment he did not is the one error this panel exists to prevent.
  const human = Boolean(p && p.source === "human" && p.due !== undefined && Number(p.due) === at);
  return { at: at, confirmed: human, by: human ? String(p.by || "") : "" };
}
// The DAY a human typed, and ONLY the day. dayToMs stores 09:00 Riyadh because a day needs an hour
// to sort by; printing that hour back would be a time no human ever typed — a fabricated fact
// wearing a human signature, which is the exact class this cycle exists to kill.
function fmtDay(ts) { return new Date(Number(ts)).toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "long" }); }
// --- end appointment -------------------------------------------------------
function contactRowsHtml(rows, win) {
  let h = "";
  rows.forEach((r) => {
    const c = r.contact || { phone: r.phone, waName: r.name, statusTimes: {}, tags: [], transcript: [] };
    const nm = c.waName || r.name || "غير معروف";
    const last = (c.transcript || [])[(c.transcript || []).length - 1];
    const ci = insCache[c.phone];
    h += '<div class="trow" onclick="location.hash=\\'customer/' + esc(c.phone) + '\\'">' +
      '<div class="cust"><div class="av">' + esc(String(nm).trim().charAt(0)) + '</div><div><div class="nm">' + esc(nm) + '</div><div class="ph">+' + esc(c.phone) + '</div></div></div>' +
      '<div style="display:flex;gap:5px;flex-wrap:wrap;">' + chipRow(c, win) + "</div>" +
      '<div style="display:flex;gap:5px;flex-wrap:wrap;">' + interestChips(c) + "</div>" +
      '<div class="lastm">' + (ci && ci.next_action ? '<span style="color:#2E7D77;font-weight:600;">← ' + esc(ci.next_action) + "</span>" : esc(last ? last.text : "—")) + "</div>" +
      '<div class="tm">' + (last ? fmtT(last.ts) : "") + "</div>" +
      '<div style="text-align:left;font-size:12px;color:#1F7A73;font-weight:500;" onclick="event.stopPropagation();openConvo(\\'' + esc(c.phone) + '\\')">المحادثة ←</div></div>';
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
    '<div style="flex:1;min-width:0;"><div style="font-size:14px;font-weight:700;color:#171717;">' + esc(nm) + '</div>' +
    '<div style="font-size:11px;color:#999999;direction:ltr;text-align:right;">+' + esc(c.phone) + "</div></div>" +
    '<button onclick="closeConvo()" style="font-family:inherit;flex:none;font-size:18px;font-weight:700;color:#999999;background:#F3F3F3;border:none;border-radius:9px;width:32px;height:32px;cursor:pointer;">×</button></div>' +
    '<div style="padding:9px 16px;border-bottom:1px solid #F3F3F3;display:flex;gap:5px;flex-wrap:wrap;">' + chipRow(c) + " " + interestChips(c) + "</div>" +
    '<div class="msgs" id="convoMsgs">' + (c.transcript || []).map((t) =>
      // Sandbox plumbing is not conversation. The handshake «Proxy massar» and the replies the
      // model produced when it read that as a product name are shown as a muted note, not as the
      // customer's words or ours — the founder opens these transcripts in demos. Both tokens are
      // required so a genuine network-proxy question during an HIS integration still renders
      // normally. Suppressed at render, never deleted: the ledger keeps what was actually said.
      (/proxy|بروكسي/i.test(t.text) && /massar|مسار/i.test(t.text)
        ? '<div class="bub b-s" style="opacity:.55;font-size:11.5px;">تفعيل بيئة Gupshup التجريبية — ليست جزءًا من المحادثة<div class="bt">' + fmtT(t.ts) + "</div></div>"
        : '<div class="bub ' + (t.role === "agent" ? "b-a" : t.role === "customer" ? "b-c" : "b-s") + '">' + esc(t.text) + '<div class="bt">' + fmtT(t.ts) + "</div></div>")).join("") + "</div>" +
    '<div class="ft" style="display:flex;gap:8px;"><button class="btn" style="flex:1;font-size:12.5px;' +
    (c.human ? 'color:#fff;background:#2E8F89;' : 'color:#c43d3d;background:#fff;border:1px solid #f0d3d3;') +
    '" onclick="setHuman(\\'' + esc(c.phone) + '\\',' + (c.human ? "false" : "true") + ')">' +
    (c.human ? "استئناف المساعد" : "إيقاف المساعد") + "</button>" +
    '<button class="btn" title="فصل بيانات البيئة التجريبية عن البيانات الفعلية" style="flex:none;font-size:11.5px;' +
    (c.test ? 'color:#171717;background:#EDEDED;border:1px solid #EDEDED;' : 'color:#7C7C7C;background:#fff;border:1px solid #E2E2E2;') +
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
    (showTest ? 'color:#171717;background:#EDEDED;border:1px solid #EDEDED;' : 'color:#999999;background:#fff;border:1px dashed #d5dae2;') +
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
    '<span style="position:absolute;inset-inline-start:14px;color:#999999;display:flex;">' + ic("search", 18) + "</span>" +
    '<input id="campq" class="inp" value="' + esc(campQ) + '" oninput="campSearchFn(this)" placeholder="ابحث في الحملات…" style="width:100%;padding-inline-start:42px;height:46px;border-radius:999px;"></span>' +
    '<select onchange="setCampSort(this)" class="inp" style="height:46px;border-radius:999px;font-weight:600;color:#383838;">' +
    '<option value="new"' + (campSortKey === "new" ? " selected" : "") + '>الأحدث أولًا</option>' +
    '<option value="replies"' + (campSortKey === "replies" ? " selected" : "") + '>الأكثر ردودًا</option>' +
    '<option value="seen"' + (campSortKey === "seen" ? " selected" : "") + '>الأكثر مشاهدة</option></select>' +
    '<span style="flex:1"></span><span class="cntpill">' + fmtN(withStAll.length) + " حملة</span></div>";
  h += '<div style="overflow-x:auto;" class="ms-scroll"><div style="min-width:900px;">' +
    '<div style="display:grid;grid-template-columns:2fr 1.15fr .95fr .7fr .7fr .7fr 1.15fr 44px;gap:12px;padding:14px 22px;background:#F8F8F8;border-bottom:1px solid #EDEDED;font-size:11.5px;font-weight:700;color:#7C7C7C;">' +
    '<div>الحملة</div><div>الخدمة</div><div>الحالة</div><div style="text-align:center;">الجمهور</div><div style="text-align:center;">مشاهدة</div><div style="text-align:center;">ردود</div><div>التقدّم</div><div></div></div>';
  withSt.forEach(({ c, st }, i) => {
    const prog = pct(st.delivered, st.targeted);
    const isTest = campIsTest(c);
    const stChip = isTest
      ? '<span class="chip c-warn"><span style="width:6px;height:6px;border-radius:999px;background:#B54708;"></span>تجريبية</span>'
      // The old "completed" label claimed a lifecycle the campaigns table has no field for — a
      // reply is not a completed campaign. Both this fallback chip and the kanban column now read
      // the same three states, emitted by campPerfState() in campaigns-crm so they cannot drift.
      : (st.replied ? '<span class="chip c-ok"><span style="width:6px;height:6px;border-radius:999px;background:#027A48;"></span>فيها ردود</span>'
        : '<span class="chip c-blue"><span style="width:6px;height:6px;border-radius:999px;background:#2F5F94;"></span>بلا ردود بعد</span>');
    h += '<div class="trow km" onclick="location.hash=\\'kmon/' + c.id + '\\'" style="display:grid;grid-template-columns:2fr 1.15fr .95fr .7fr .7fr .7fr 1.15fr 44px;gap:12px;padding:16px 22px;align-items:center;">' +
      '<div style="display:flex;align-items:center;gap:12px;min-width:0;"><span role="img" aria-label="' + (isTest ? "حملة تجريبية" : "حملة فعلية") + '" title="' + (isTest ? "حملة تجريبية (بيئة الاختبار)" : "حملة فعلية") + '" style="width:9px;height:9px;border-radius:999px;flex:none;background:' + (isTest ? "#E2E2E2" : "#1F7A73") + ";box-shadow:0 0 0 3px " + (isTest ? "rgba(208,213,221,.28)" : "rgba(31,122,115,.16)") + ';"></span>' +
      '<div style="min-width:0;"><div style="font-size:13.5px;font-weight:700;color:#171717;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(c.name) + '</div>' +
      '<div style="font-size:11px;color:#999999;margin-top:3px;">' + fmtD(c.created_at) + "</div></div></div>" +
      '<div style="font-size:12.5px;color:#525252;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(c.product || "—") + "</div>" +
      "<div>" + stChip + "</div>" +
      '<div style="text-align:center;font-size:13px;font-weight:700;color:#171717;font-variant-numeric:tabular-nums;">' + fmtN(st.targeted) + "</div>" +
      '<div style="text-align:center;font-size:13px;font-weight:700;color:#171717;font-variant-numeric:tabular-nums;">' + fmtN(pct(st.seen, st.targeted)) + "٪</div>" +
      '<div style="text-align:center;font-size:13px;font-weight:700;color:#171717;font-variant-numeric:tabular-nums;">' + fmtN(pct(st.replied, st.targeted)) + "٪</div>" +
      '<div style="display:flex;align-items:center;gap:9px;"><div class="prog" style="flex:1;height:6px;background:#EDEDED;border-radius:999px;overflow:hidden;"><i style="display:block;height:100%;width:' + prog + '%;background:#1F7A73;border-radius:999px;"></i></div><span style="font-size:11.5px;font-weight:700;color:#7C7C7C;flex:none;font-variant-numeric:tabular-nums;">' + fmtN(prog) + "٪</span></div>" +
      '<div style="text-align:center;"><button class="kebab" title="' + (isTest ? "إعادة الحملة إلى القائمة الفعلية" : "نقل الحملة إلى التجريبية") + '" aria-label="' + (isTest ? "إعادة الحملة إلى القائمة الفعلية" : "نقل الحملة إلى التجريبية") +
      '" onclick="event.stopPropagation();setCampClass(' + c.id + "," + (isTest ? "false" : "true") + ')">' + (isTest ? "↩" : "⇥") + "</button></div></div>";
  });
  if (!withSt.length) {
    // Say which of the two reasons this is: an empty class, or a search that matched nothing.
    // Rendering «لا نتائج مطابقة» beside a «تعرض ٠ حملة فعلية» explainer gave two answers at once.
    h += campQ.trim()
      ? '<div style="padding:44px;text-align:center;color:#7C7C7C;font-size:13px;line-height:1.9;">لا حملة تطابق «' + esc(campQ.trim()) + '».<br><span style="color:#999999;">امسح البحث أو جرّب تبويبًا آخر.</span></div>'
      : (campTab === "real"
        ? '<div style="padding:44px;text-align:center;color:#7C7C7C;font-size:13px;line-height:1.9;">لم تُطلق أي حملة فعلية بعد.<br><span class="lnk" onclick="setCampTab(\\'test\\')" style="color:#1F7A73;font-weight:700;cursor:pointer;">' + fmtN(nTest) + ' حملة تجريبية محفوظة</span>' + (nTest ? "" : "") + '</div>'
        : '<div style="padding:44px;text-align:center;color:#999999;font-size:13px;">لا حملات في هذا التبويب</div>');
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
  // A rate with no denominator is unknown, not zero: Math.max(1, targeted) used to print a
  // confident ٠٪ on a campaign that never had an audience. null renders «—».
  const pct = (v) => st.targeted ? Math.round(v / st.targeted * 100) : null;
  const pctTxt = (v) => { const r = pct(v); return r === null ? "—" : fmtN(r) + "٪"; };
  const rate = (a, b) => b ? Math.round(a / b * 100) : 0;
  const yieldPer100 = st.targeted ? Math.round(st.interested / st.targeted * 100) : 0;
  let h = '<a href="#kmon" style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#525252;text-decoration:none;margin-bottom:14px;">→ كل الحملات</a>' +
    '<div class="ptitle rise"><div><h1 style="font-size:26px;">' + esc(camp.name) + "</h1>" +
    '<p>' + (camp.product ? esc(camp.product) + " · " : "") + "واتساب · " + fmtD(camp.created_at) + "</p></div>" +
    '<div class="acts">' + (campIsTest(camp) ? '<span class="chip c-warn">حملة تجريبية</span>' : '<span class="chip c-ok">جارية</span>') + "</div></div>";
  h += '<div class="card rise" style="display:flex;gap:26px;flex-wrap:wrap;align-items:center;">' +
    '<div style="flex:1;min-width:240px;"><div style="font-size:12px;color:#7C7C7C;font-weight:450;">حكم الحملة</div>' +
    '<div style="font-size:17px;font-weight:700;margin-top:7px;line-height:1.7;">' +
    (st.replied ? "وصلت إلى " + fmtN(st.delivered) + " جهة، ردّ " + fmtN(st.replied) + " منهم" + (st.interested ? " وأبدى " + fmtN(st.interested) + " اهتمامًا مؤهلًا" : "") + "." : "أُرسلت، وبانتظار الرد الأول.") + "</div></div>" +
    '<div style="display:flex;gap:30px;flex-wrap:wrap;">' +
    [["نسبة المشاهدة", rate(st.seen, st.targeted)], ["نسبة الردود", rate(st.replied, st.targeted)], ["جهات مهتمة لكل ١٠٠", yieldPer100]]
      .map((x) => '<div><div style="font-size:26px;font-weight:700;font-variant-numeric:tabular-nums;">' + fmtN(x[1]) + '<span style="font-size:14px;color:#7C7C7C;">٪</span></div><div style="font-size:11px;color:#7C7C7C;margin-top:3px;">' + x[0] + "</div></div>").join("") +
    "</div></div>";
  const cards = [
    ["جهات الاستهداف", st.targeted, "#2F5F94"], ["أُرسلت", st.sent, "#2F5F94"], ["وصلت", st.delivered, "#3FB6B0"],
    ["شوهدت", st.seen, "#3FB6B0"], ["ردّوا", st.replied, "#2E8F89"], ["جهات مهتمة", st.interested, "#1f8a52"],
  ];
  h += '<div class="statgrid">' + cards.map((c, i) =>
    '<div class="statc"><div class="l">' + c[0] + '</div><div class="v">' + fmtN(c[1]) + "</div>" +
    '<div class="p">' + (i === 0 ? "&nbsp;" : (pct(c[1]) === null ? "لا جهات استهداف" : pctTxt(c[1]) + " من جهات الاستهداف")) + "</div>" +
    '<div class="mb"><i style="width:' + (i === 0 ? 100 : (pct(c[1]) || 0)) + "%;background:" + c[2] + ';"></i></div></div>').join("") + "</div>";
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
      moves.map((m) => '<div style="background:' + m[3] + ';border:1px solid #EDEDED;border-radius:13px;padding:14px 16px;">' +
        '<div style="font-size:13px;font-weight:700;color:' + m[2] + ';">' + esc(m[0]) + "</div>" +
        '<div style="font-size:11.5px;color:#525252;margin-top:5px;line-height:1.8;">' + esc(m[1]) + "</div></div>").join("") + "</div></div>";
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
  h += '<div class="tblwrap"><div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid #EDEDED;background:#fff;">' +
    '<span style="font-size:13px;font-weight:700;color:#171717;flex:none;">جهات الاستهداف</span>' +
    '<span style="font-size:11px;color:#999999;flex:none;">' + fmtN(shown.length) + " من " + fmtN(rows.length) + "</span>" +
    '<span style="flex:1;"></span>' +
    (shown.length ? '<button class="btn" style="font-size:12.5px;border-radius:6px;color:#1F7A73;background:#fff;border:1px solid #1F7A73;font-weight:500;" onclick="startRetarget()">⟲ إعادة استهداف هذه الفئة (' + fmtN(shown.length) + ")</button>" : "") +
    filters.map((f) => '<button class="btn" style="padding:6px 12px;font-size:11.5px;border-radius:999px;' +
      (campFilter === f[0] ? 'color:#2E7D77;background:#DCF1EF;border:1px solid #3FB6B0;' : 'color:#525252;background:#fff;border:1px solid #EDEDED;') +
      '" onclick="setCampFilter(\\'' + f[0] + '\\')">' + f[1] + " (" + fmtN(f[2]) + ")</button>").join("") +
    '<input id="rq" value="' + esc(rQ) + '" oninput="rSearch(this)" placeholder="بحث…" style="font-family:inherit;font-size:11.5px;border:1px solid #EDEDED;border-radius:999px;padding:7px 13px;background:#F8F8F8;width:130px;">' +
    "</div>" +
    '<div class="thead"><div>العميل</div><div>الحالة</div><div>الاهتمام والجدية</div><div>آخر رسالة</div><div>الوقت</div><div></div></div>' +
    (shown.length ? contactRowsHtml(shown, cwin) : '<div style="padding:30px;text-align:center;color:#999999;font-size:12.5px;">لا نتائج</div>') + "</div>";
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
  // The hero. One figure leads with its own seven-day movement and a fourteen-day shape; the rest
  // support it. «+٢٤ خلال ٧ أيام» is a COUNT of contacts newly qualified inside that window — not a
  // percentage change against a period nobody chose, and not a projection.
  const WEEK = 7 * 864e5;
  const newQual = cs.filter((c) => interestedOf(c, Date.now() - WEEK)).length;
  const newReplied = cs.filter((c) => ((c.statusTimes || {}).replied || 0) >= Date.now() - WEEK).length;
  const series = qualSeries(cs, 14);
  const heroSide = [
    ["الحملات الفعلية", fmtN(realCampaigns.length),
      campaigns.length > realCampaigns.length ? "و" + fmtN(campaigns.length - realCampaigns.length) + " تجريبية" : ""],
    ["جهات في قوائمك", fmtN(entities.length), ""],
    ["وصلت الرسائل", fmtN(delivered), ""],
    ["ردّوا", fmtN(replied), newReplied ? "+" + fmtN(newReplied) + " هذا الأسبوع" : ""],
  ];
  let h = '<div class="ptitle rise"><div><h1>مركز القيادة</h1><p>ما الذي يحدث الآن في السوق — ومن يستحق اتصالك اليوم</p></div>' +
    '<div class="acts"><a href="#customers" class="btn btn-ghost" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">' + ic("up", 17) + " استيراد جهات الاستهداف</a>" +
    '<a href="#aimkt" class="btn btn-dark" style="text-decoration:none;display:inline-flex;align-items:center;gap:8px;">' + ic("send", 17) + " إنشاء حملة</a></div></div>";
  // «جهات في قوائمك» is deliberately NOT called «جهات الاستهداف»: the funnel below uses that label
  // for the people a campaign actually reached, while this counts the whole imported book. One
  // label over two different numbers on one screen is the contradiction that rule exists to stop.
  h += '<div class="hero rise"><div class="hmain">' +
    '<div class="hlab">جهات مهتمة ومؤهلة</div>' +
    '<div class="hrow"><span class="hfig">' + fmtN(interestedList.length) + "</span>" +
    '<span class="hd' + (newQual ? "" : " flat") + '">' +
      (newQual ? "+" + fmtN(newQual) + " خلال ٧ أيام" : "بلا جديد هذا الأسبوع") + "</span></div>" +
    '<div class="hnote">من ' + fmtN(cs.length) + " جهة تحدّث معها المساعد · " + fmtN(replied) + " ردّوا</div>" +
    '<div class="hspark"><div style="font-size:11.5px;color:#999999;margin-bottom:4px;">مؤهلون جدد يوميًا · آخر ١٤ يومًا</div>' +
    sparkArea(series, 320, 62) +
    '<div class="haxis"><span>قبل ١٤ يومًا</span><span>اليوم</span></div></div></div>' +
    '<div class="hside">' + heroSide.map((r) =>
      '<div class="hs"><span class="k">' + r[0] + (r[2] ? "<em>" + r[2] + "</em>" : "") + "</span>" +
      '<span class="v">' + r[1] + "</span></div>").join("") + "</div></div>";
  h += vActionQueue(cs, d.notifyNumber, nTest);
  h += vHomeCharts(cs);
  h += vWinLoss();
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px;align-items:start;">';
  h += '<div class="card" style="margin:0;"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><h3 style="margin:0;">أحدث الحملات</h3><a href="#kmon" style="font-size:11.5px;font-weight:700;color:#2E7D77;text-decoration:none;">الكل ←</a></div>' +
    (campaigns.length
      ? '<div style="margin-top:10px;">' + campaigns.slice(0, 5).map((cp) => {
          const st = campStats(cp);
          return '<a href="#kmon/' + cp.id + '" style="text-decoration:none;display:flex;align-items:center;gap:11px;padding:10px 4px;border-bottom:1px solid #F3F3F3;">' +
            '<div style="flex:1;min-width:0;"><div style="font-size:12.5px;font-weight:700;color:#171717;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(cp.name) + (campIsTest(cp) ? ' <span class="chip">تجريبية</span>' : "") + "</div>" +
            '<div style="font-size:10.5px;color:#999999;margin-top:3px;">' + (cp.product ? esc(cp.product) + " · " : "") + fmtD(cp.created_at) + "</div></div>" +
            '<span class="chip c-blue">' + fmtN(st.targeted) + ' مستهدف</span><span class="chip c-teal">شوهدت ' + fmtN(st.seen) + '</span><span class="chip ' + (st.replied ? "c-ok" : "c-grey") + '">ردّوا ' + fmtN(st.replied) + "</span></a>";
        }).join("") + "</div>"
      : '<div style="font-size:12px;color:#999999;margin-top:12px;">لا حملات بعد — أطلق الأولى من «إنشاء حملة».</div>') + "</div>";
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
// ---------------------------------------------------------------------------
// PRODUCT AFFINITY — three dimensions, three different provenances, never one tag.
//
// Founder: «not every client will use every single product… when I create a new campaign and see
// all the clients I have in the system, I need some filter.» The data to answer that has been in
// the ledger since the account-graph cycle; nothing on this screen read it, so every launch still
// started from the whole book.
//
// The market's own lesson, and the reason these stay three fields rather than one «product tag»:
// Mailchimp splits Groups (what the customer selects about themselves) from Tags (what your team applies)
// precisely because collapsing provenance makes the resulting segment untrustworthy. Here:
//
//   uses      ← entities.facts.currentProducts   HUMAN. Import or operator. The expansion BASE.
//   notUses   ← the same fact, negated           The filter an expansion campaign actually wants.
//   interest  ← contacts.tags[].product          MACHINE. The assistant's reading, with a level.
//
// A fact absent is «unknown», NOT «does not use it» — so notUses deliberately matches unknowns
// too, and the UI says so. Claiming to know who does not own a product, when the column was simply
// never imported, would be exactly the invented value this codebase spent three cycles removing.
let prodFilter = { uses: "", notUses: "", interest: "" };

/** Values are stored as one string; accounts.ts splits on both comma forms, so this must too. */
function factProducts(e) {
  const f = (e.facts || {}).currentProducts;
  if (!f || !f.value) return [];
  return String(f.value).split(/[،,]/).map((x) => x.trim()).filter(Boolean);
}
function entUses(e, product) {
  if (!product) return true;
  return factProducts(e).some((p) => p === product || p.includes(product) || product.includes(p));
}
function entInterested(e, product) {
  if (!product) return true;
  const c = contactByPhone(e.phone);
  return Boolean(c && (c.tags || []).some((t) => t.product === product));
}
/** Every product name the operator can filter by: the catalogue, plus anything the import wrote
 *  that is not in it — a service we sell but never seeded must still be filterable. */
function affinityProducts() {
  const seen = new Map();
  PRODUCTS.forEach((p) => seen.set(p.n, { uses: 0, interest: 0 }));
  entities.forEach((e) => factProducts(e).forEach((p) => {
    if (!seen.has(p)) seen.set(p, { uses: 0, interest: 0 });
    seen.get(p).uses++;
  }));
  ((cache && cache.contacts) || []).forEach((c) => (c.tags || []).forEach((t) => {
    if (!t.product) return;
    if (!seen.has(t.product)) seen.set(t.product, { uses: 0, interest: 0 });
    seen.get(t.product).interest++;
  }));
  return [...seen.entries()].map(([name, n]) => ({ name, uses: n.uses, interest: n.interest }));
}
function prodFilterOn() { return Boolean(prodFilter.uses || prodFilter.notUses || prodFilter.interest); }
function entMatchesProduct(e) {
  if (prodFilter.uses && !entUses(e, prodFilter.uses)) return false;
  if (prodFilter.notUses && entUses(e, prodFilter.notUses)) return false;
  if (prodFilter.interest && !entInterested(e, prodFilter.interest)) return false;
  return true;
}
function entMatches() {
  const q = entQ.trim();
  return entities.filter((e) =>
    Object.keys(entFilters).every((k) => !entFilters[k] || ((e.attrs || {})[k] || "") === entFilters[k]) &&
    entMatchesProduct(e) &&
    (!q || e.name.includes(q) || e.phone.includes(q)));
}
window.setProdFilter = (which, v) => { prodFilter[which] = v; entSel.clear(); render(false); };
/** The whole point of the feature in one control: the campaign's own service, excluded from its own
 *  audience. Step 1 already knows which service this launch sells; step 2 should not make the
 *  operator re-say it. */
window.excludeOwners = () => {
  const reg = wizProducts();
  const name = reg[selProd] ? reg[selProd].name : "";
  if (!name) return;
  prodFilter.notUses = prodFilter.notUses === name ? "" : name;
  entSel.clear();
  render(false);
};
function attrChips(e, max) {
  const a = e.attrs || {}; const keys = Object.keys(a).slice(0, max);
  return keys.map((k) => {
    const v = a[k];
    // Neutral, all of them. Colouring كبيرة teal and متوسطة amber built a traffic light out of a
    // facility's SIZE — amber reads as caution, and a mid-size clinic is not a warning. These are
    // imported column values, not states; the only thing they have to be is legible.
    return '<span class="chip" title="' + esc(k) + '">' + esc(clip(v, 20)) + "</span>";
  }).join("");
}
/** What this account already buys. Silent when unknown — «ناقص» on every row of a book nobody has
 *  enriched yet is noise, and the band above already reports how many rows have no record. */
function prodChips(e) {
  const ps = factProducts(e);
  if (!ps.length) return "";
  return '<span class="chip c-teal" title="الخدمات المستخدمة حاليًا · من ملف الحساب">' +
    esc(clip(ps[0], 18)) + (ps.length > 1 ? " +" + fmtN(ps.length - 1) : "") + "</span>";
}
function chipBtn(label, on, fn) {
  return '<button class="btn" style="padding:8px 14px;font-size:12px;border-radius:999px;' +
    (on ? 'color:#2E7D77;background:#DCF1EF;border:1px solid #3FB6B0;' : 'color:#525252;background:#fff;border:1px solid #EDEDED;') +
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
    h += '<div style="font-size:11.5px;color:#7C7C7C;margin-bottom:9px;">اختيار الفئة يملأ الشروط أدناه، ويمكنكم تعديلها.</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-bottom:18px;">' +
      segPresets.map((p) => {
        const extra = [];
        if (p.suppressed) extra.push(fmtN(p.suppressed) + " في التبريد");
        // Forecast rather than excuse: say WHEN the zero becomes a number.
        if (p.tooNew && p.entersInDays > 0) extra.push(fmtN(p.tooNew) + " جهة تدخل نطاق الفحص بعد " + fmtN(p.entersInDays) + (p.entersInDays >= 11 ? " يومًا" : " أيام"));
        else if (p.tooNew) extra.push(fmtN(p.tooNew) + " أحدث من النافذة");
        return '<button class="btn" style="display:block;text-align:start;padding:13px 15px;border:1px solid #EDEDED;background:#fff;border-radius:13px;height:auto;" onclick="segUsePreset(\\'' + p.id + '\\')">' +
          '<div style="display:flex;align-items:center;gap:8px;"><span style="font-size:12.5px;font-weight:700;color:#171717;">' + esc(p.label) + '</span>' +
          '<span class="chip ' + (p.matched ? "c-ok" : "c-grey") + '">' + fmtN(p.matched) + "</span></div>" +
          '<div style="font-size:11px;color:#7C7C7C;margin-top:6px;line-height:1.8;">' + esc(p.hint) + "</div>" +
          (extra.length ? '<div style="font-size:10.5px;color:#B54708;margin-top:5px;">' + esc(extra.join(" · ")) + "</div>" : "") +
          "</button>";
      }).join("") + "</div>";
  }
  h += '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px;">' +
    '<span style="font-size:11.5px;font-weight:700;color:#7C7C7C;">المطابقة:</span>' +
    chipBtn("تنطبق كل الشروط", !segDef || segDef.match === "all", "segSetMatch(\\'all\\')") +
    chipBtn("ينطبق أي شرط", segDef && segDef.match === "any", "segSetMatch(\\'any\\')") +
    '<span style="flex:1"></span><span style="font-size:11.5px;font-weight:700;color:#7C7C7C;">النافذة:</span>' +
    [3, 5, 7, 14].map((d) => chipBtn(fmtN(d) + (d >= 11 ? " يومًا" : " أيام"), segWindow === d, "segSetWindow(" + d + ")")).join("") + "</div>";

  const conds = (segDef && segDef.conditions) || [];
  h += conds.map((c, i) =>
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:11px 13px;border:1px solid #EDEDED;border-radius:12px;background:#fff;margin-bottom:8px;">' +
    (i ? '<span class="chip c-grey" style="font-size:10.5px;">' + (segDef.match === "any" ? "أو" : "و") + "</span>" : "") +
    '<select class="inp" style="height:40px;flex:1;min-width:150px;" onchange="segSetField(' + i + ',\\'signal\\',this.value)">' +
      SEG_SIGNALS.map((sg) => '<option value="' + sg[0] + '"' + (c.signal === sg[0] ? " selected" : "") + ">" + sg[1] + "</option>").join("") + "</select>" +
    '<select class="inp" style="height:40px;min-width:110px;" onchange="segSetField(' + i + ',\\'comparator\\',this.value)">' +
      '<option value="happened"' + (c.comparator === "happened" ? " selected" : "") + ">حدث</option>" +
      '<option value="never_happened"' + (c.comparator === "never_happened" ? " selected" : "") + ">لم يحدث</option></select>" +
    '<span style="font-size:11px;color:#999999;flex:1;min-width:120px;">' + (c.beforeDays ? "قبل أكثر من " + fmtN(c.beforeDays) + (c.beforeDays >= 11 ? " يومًا" : " أيام") : c.withinDays ? "خلال آخر " + fmtN(c.withinDays) + (c.withinDays >= 11 ? " يومًا" : " أيام") : "طوال الوقت") + "</span>" +
    '<button class="btn" style="height:36px;padding:0 12px;color:#B42318;background:#fff;border:1px solid #F7D4D1;" onclick="segDelCond(' + i + ')">حذف</button></div>').join("");
  h += '<button class="btn" style="font-size:12px;color:#1F7A73;background:#E9F7F6;border:1px solid #C4E8E5;margin-bottom:14px;" onclick="segAddCond()">+ أضف شرطًا</button>';

  // The result. Every zero explains itself — that distinction is the whole feature.
  if (segBusy) h += '<div style="font-size:12.5px;color:#7C7C7C;padding:10px 0;">جارٍ الحساب…</div>';
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
      h += '<div class="sparse">' + ic("eye", 16, "#7C7C7C") + "<div>لا جهة تطابق هذه الشروط. راجعوا الحدث أو وسّعوا النافذة.</div></div>";
    }
  }
  // The constraint that makes this different from an email tool.
  h += '<div style="display:flex;gap:10px;align-items:flex-start;background:#F8F8F8;border:1px solid #EDEDED;border-inline-start:3px solid #B54708;border-radius:10px;padding:12px 15px;font-size:12px;color:#525252;line-height:1.9;">' +
    ic("clock", 16, "#B54708") +
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

/** The service filter. Its three fields answer three different questions with three different
 *  sources, and the band says which is which — a filter whose provenance is invisible is a filter
 *  the operator cannot argue with. */
function vAffinityBand(selName, matched) {
  const prods = affinityProducts();
  const known = entities.filter((e) => factProducts(e).length).length;
  const sel = (which, label, hint, count) => {
    const on = prodFilter[which];
    return '<span class="fld"><span>' + label + "</span>" +
      '<select class="' + (on ? "on" : "") + '" onchange="setProdFilter(&quot;' + which + '&quot;, this.value)" title="' + hint + '">' +
      '<option value="">الكل</option>' +
      prods.filter((p) => count(p) > 0 || p.name === on).map((p) =>
        '<option value="' + esc(p.name) + '"' + (on === p.name ? " selected" : "") + ">" +
        esc(clip(p.name, 26)) + " (" + fmtN(count(p)) + ")</option>").join("") + "</select></span>";
  };
  let h = '<div class="affin"><div class="ah"><span class="t">حسب الخدمة</span>' +
    '<span class="s">«يستخدم» من ملف الحساب — بشري ومؤرَّخ · «أبدى اهتمامًا» من قراءة المساعد للمحادثة</span></div>';
  if (selName) {
    const owners = entities.filter((e) => entUses(e, selName)).length;
    h += '<div class="row"><button class="excl' + (prodFilter.notUses === selName ? " on" : "") +
      '" onclick="excludeOwners()">' +
      (prodFilter.notUses === selName ? "✓ مستبعَد من يستخدم «" : "استبعد من يستخدم «") + esc(clip(selName, 24)) + "» بالفعل" +
      (owners ? " (" + fmtN(owners) + ")" : "") + "</button>" +
      '<span style="font-size:12px;color:#7C7C7C;">الخدمة التي تبيعها هذه الحملة — لا داعي لإعادة اختيارها.</span></div>';
  }
  h += '<div class="row">' +
    sel("uses", "يستخدم:", "الخدمات المسجَّلة في ملف الحساب", (p) => p.uses) +
    sel("notUses", "لا يستخدم:", "من ليس لدينا سجل بأنه يستخدمها", (p) => p.uses) +
    sel("interest", "أبدى اهتمامًا بـ:", "من وسم المساعد اهتمامه بها في المحادثة", (p) => p.interest) +
    (prodFilterOn() ? '<button class="excl" onclick="clearProdFilter()">مسح فرز الخدمة</button>' : "") +
    "</div>";
  // The honest caveat, and only when it can actually mislead: «لا يستخدم» matches unknowns, and
  // with almost nothing imported that is nearly everybody.
  if (prodFilter.notUses && known < entities.length) {
    h += '<div class="why">«لا يستخدم» يشمل من لا نملك عنه سجل خدمات أصلًا — ' +
      fmtN(entities.length - known) + " من " + fmtN(entities.length) + " جهة. غياب السجل ليس دليلًا على عدم الاستخدام.</div>";
  }
  if (prodFilterOn()) {
    h += '<div style="font-size:12.5px;color:#1F7A73;margin-top:10px;">' + fmtN(matched) + " جهة تطابق الفرز الحالي.</div>";
  }
  return h + "</div>";
}
window.clearProdFilter = () => { prodFilter = { uses: "", notUses: "", interest: "" }; entSel.clear(); render(false); };
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
      '<span style="flex:1"></span><span style="font-size:11.5px;color:#999999;align-self:center;">السلوك يبني شريحة حيّة من سجل المحادثات</span></div>';
  }
  if (!retargetCohort && audMode === "behaviour") {
    h += vSegBuilder();
  } else
  if (retargetCohort) {
    h += '<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;border:1px solid #EDEDED;border-inline-start:3px solid #B54708;background:#fff;border-radius:10px;padding:16px 18px;">' +
      '<span style="font-size:22px;">⟲</span><div style="flex:1;min-width:220px;">' +
      '<div style="font-size:13.5px;font-weight:700;color:#171717;">إعادة استهداف: ' + esc(retargetCohort.label) + " — " + fmtN(retargetCohort.targets.length) + " جهة</div>" +
      '<div style="font-size:11.5px;color:#7C7C7C;margin-top:5px;">من حملة «' + esc(retargetCohort.campaign) + '» — القائمة مقفلة على هذه الفئة كما رأيتها في صفحة الحملة.</div></div>' +
      '<button class="btn" style="font-size:12px;color:#7C7C7C;background:#fff;border:1px solid #E2E2E2;" onclick="clearRetarget()">مسح والاختيار يدويًا</button></div>';
  } else if (!entities.length) {
    h += '<div style="border:1.5px dashed #E2E2E2;border-radius:12px;padding:26px;text-align:center;color:#7C7C7C;font-size:13px;line-height:2;">لا مستهدفين بعد — ارفع ملف Excel أو CSV في شاشة <a href="#customers" style="color:#2E7D77;font-weight:700;">جهات الاستهداف</a>، وستظهر شرائح أعمدته هنا تلقائيًا.</div>';
  } else {
    h += vAffinityBand(selName, m.length);
    h += groups.map((g, ki) =>
      '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;">' +
      '<span style="font-size:11.5px;font-weight:700;color:#7C7C7C;min-width:52px;">' + esc(g.key) + ":</span>" +
      chipBtn("الكل", !entFilters[g.key], "entSetAttr(" + ki + ",-1)") +
      g.values.map(([v, n], vi) => chipBtn(v + " (" + fmtN(n) + ")", entFilters[g.key] === v, "entSetAttr(" + ki + "," + vi + ")")).join("") +
      "</div>").join("");
    h += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;flex-wrap:wrap;">' +
      '<input id="eq" value="' + esc(entQ) + '" oninput="entSearch(this)" placeholder="ابحث بالاسم أو الرقم…" style="font-family:inherit;flex:1;min-width:200px;font-size:12.5px;border:1px solid #EDEDED;border-radius:10px;padding:9px 13px;background:#F8F8F8;">' +
      '<button class="btn" style="font-size:12px;color:#1F4470;background:#E3ECF8;" onclick="entAllMatching()">' + (allOn ? "إلغاء تحديد المطابقين" : "تحديد المطابقين (" + fmtN(m.length) + ")") + '</button>' +
      (selN ? '<button class="btn" style="font-size:12px;color:#7C7C7C;background:#fff;border:1px solid #E2E2E2;" onclick="entClear()">مسح الاختيار</button>' : "") + "</div>";
    const shown = pageSlice("aud", m);
    if (m.length > PAGE_SIZE) {
      h += '<div style="display:flex;align-items:center;gap:12px;background:#F8F8F8;border:1px solid #EDEDED;border-radius:10px;padding:12px 16px;margin-bottom:10px;">' +
        '<span style="font-size:18px;font-weight:600;color:#171717;font-variant-numeric:tabular-nums;">' + fmtN(m.length) + "</span>" +
        '<span style="font-size:12.5px;color:#525252;line-height:1.8;">جهة مطابقة للشرائح الحالية. «تحديد المطابقين» يختارهم <b style="font-weight:500;color:#171717;">جميعًا</b> — والقائمة أدناه تُستعرض صفحةً صفحة إن أردت مراجعتهم.</span></div>';
    }
    h += '<div style="border:1px solid #EDEDED;border-radius:12px 12px 0 0;overflow:hidden;max-height:420px;overflow-y:auto;" class="ms-scroll">' +
      shown.map((e) => {
        const on = entSel.has(e.id);
        return '<div onclick="entTog(' + e.id + ')" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid #F3F3F3;cursor:pointer;' + (on ? "background:#F4FBFA;" : "") + '">' +
          '<span style="width:17px;height:17px;flex:none;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff;' + (on ? "background:#2E8F89;" : "border:1.5px solid #E2E2E2;background:#fff;") + '">' + (on ? "✓" : "") + "</span>" +
          '<span style="flex:1;min-width:0;font-size:13px;font-weight:600;color:#171717;">' + esc(e.name) + "</span>" +
          prodChips(e) + attrChips(e, 2) +
          '<span style="font-size:11px;color:#999999;direction:ltr;">+' + esc(e.phone) + "</span></div>";
      }).join("") +
      (m.length ? "" : '<div style="padding:22px;text-align:center;color:#999999;font-size:12.5px;">لا نتائج مطابقة</div>') + "</div>" +
      (m.length ? '<div class="tfoot" style="border:1px solid #EDEDED;border-top:0;border-radius:0 0 12px 12px;">' + pageBar("aud", m.length, "جهة") + "</div>" : "");
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
          '" onclick="tplPick(' + i + ')" onkeydown="tplKey(event,' + i + ')" style="cursor:pointer;border:1.5px solid ' + (on ? "#3FB6B0" : "#EDEDED") +
          ";background:" + (on ? "#F6FCFB" : "#fff") + ';border-radius:16px;padding:18px;transition:.18s ease;' + (on ? "box-shadow:0 0 0 3px rgba(63,182,176,.12);" : "") + '">' +
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;">' +
          '<span style="width:15px;height:15px;flex:none;border-radius:50%;border:1.5px solid ' + (on ? "#1F7A73" : "#E2E2E2") +
          ";background:" + (on ? "#1F7A73" : "#fff") + ';box-shadow:inset 0 0 0 2.5px #fff;"></span>' +
          '<span style="font-size:12.5px;font-weight:700;color:#171717;">' + esc(t.label) + "</span></div>" +
          '<div style="font-size:11.5px;color:#7C7C7C;line-height:1.75;">' + esc(t.hint) + "</div>" +
          '<div style="font-size:10.5px;color:#999999;margin-top:6px;">لِمن: ' + esc(t.audience) + "</div>" +
          '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:8px;">' +
          t.buttons.map((b) => '<span style="font-size:11.5px;font-weight:700;color:#2F5F94;background:#E3ECF8;border-radius:999px;padding:4px 12px;">' + esc(b) + "</span>").join("") +
          "</div></div>";
      }).join("") + "</div>" : "") +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;align-items:start;">' +
    '<div><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;"><span style="font-size:11.5px;color:#7C7C7C;font-weight:600;">نص الرسالة</span>' +
    '<span style="flex:1"></span><button id="cmpbtn" class="btn btn-ghost" style="font-size:11.5px;padding:7px 13px;display:inline-flex;align-items:center;gap:6px;" onclick="composeMsg()">' + ic("spark", 15, "#1F7A73") + "اكتبها بالذكاء الاصطناعي</button></div>" +
    '<textarea oninput="campMsgSet(this)" rows="6" style="font-family:inherit;width:100%;font-size:12.5px;color:#171717;border:1.5px solid #EDEDED;border-radius:12px;padding:13px;line-height:2;resize:vertical;">' + esc(campMsg) + "</textarea>" +
    "</div>" +
    '<div><div style="font-size:11.5px;color:#7C7C7C;font-weight:600;margin-bottom:8px;">معاينة واتساب — رسالة واحدة بأزرار، والملف يُرسَل عند طلبه</div>' +
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
    '<label style="font-size:12.5px;font-weight:700;color:#171717;flex:none;">اسم الحملة</label>' +
    '<input value="' + esc(campName) + '" oninput="campNameSet(this)" placeholder="حملة ' + esc(selName) + ' — تُسمّى تلقائيًا إن تُركت فارغة" style="font-family:inherit;flex:1;min-width:220px;font-size:13px;font-weight:600;color:#171717;border:1.5px solid #EDEDED;border-radius:11px;padding:11px 14px;">' +
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
      ? '<div style="flex:1;min-width:200px;"><div style="font-size:13px;font-weight:500;color:#171717;">الشريحة محسوبة — الإطلاق ينتظر القوالب المعتمدة</div>' +
        '<div style="font-size:10.5px;color:#999999;margin-top:4px;">استخدم «حسب الملف» للإطلاق الآن، أو انتقل إلى الرقم الإنتاجي لتفعيل الإرسال بالقوالب.</div></div>'
      : '<div style="flex:1;min-width:200px;"><div style="font-size:13px;font-weight:700;color:#171717;">' + fmtN(selN) + " جهة استهداف · " + esc(selName) +
    // This chip used to claim the file was attached to the opener. It is not — the opener OFFERS
    // it and the preview caption twenty pixels above said so, so the screen contradicted itself.
    // State what will actually be sent, next to the button that sends it.
    (selAsset ? " · الملف عند الطلب" : "") + "</div>" +
        '<div class="lsub" style="font-size:10.5px;color:#999999;margin-top:4px;">ساندبوكس: يستلم فعليًا من انضم للرقم التجريبي — البقية تظهر «فشل الإرسال» بشفافية.</div></div>') +
    '<button class="btn ' + (can ? "btn-teal" : "btn-dis") + '"' + (can ? "" : ' disabled aria-disabled="true"') +
      ' style="font-size:14.5px;padding:14px 30px;" onclick="openLaunch()">إطلاق الحملة ←</button></div>';

  h += '<div id="lmodal" style="display:none;position:fixed;inset:0;background:rgba(15,37,64,.5);z-index:60;align-items:flex-start;justify-content:center;padding:60px 24px;">' +
    '<div style="width:100%;max-width:460px;background:#fff;border-radius:16px;border-top:4px solid #3FB6B0;box-shadow:0 24px 60px rgba(15,37,64,.3);padding:24px;">' +
    '<div style="font-size:17px;font-weight:700;color:#171717;margin-bottom:8px;">تأكيد إطلاق الحملة</div>' +
    '<div style="font-size:13px;color:#525252;line-height:2;margin-bottom:18px;">سيرسل المساعد رسالة الافتتاح إلى <b style="color:#2E7D77;">' + fmtN(selN) + ' مستهدف</b> عبر واتساب (ساندبوكس)، ثم يتابع كل ردّ ببيع كامل. هذه الخطوة هي موافقتك البشرية على الإرسال.</div>' +
    (selN > 50 ? '<div style="font-size:12px;color:#b5810f;background:#FBF3DC;border-radius:10px;padding:10px 14px;line-height:1.9;margin-bottom:14px;">حد الدفعة الواحدة حاليًا <b>٥٠</b> — قلّص الاختيار أو أطلق على دفعات. الإرسال الجماعي المجدول يأتي مع محرك الحملات القادم.</div>' : "") +
    '<div style="display:flex;gap:10px;"><button id="lgo" class="btn btn-teal" onclick="confirmLaunch()">تأكيد الإطلاق ✓</button>' +
    '<button class="btn" style="color:#525252;background:#F3F3F3;" onclick="closeLaunch()">إلغاء</button></div></div></div>';
  return h;
}

function mdRender(md) {
  return md.split("\\n").map((raw) => {
    const l = raw.trim();
    if (!l) return "";
    if (l.startsWith("# ")) return '<div style="font-size:15px;font-weight:700;color:#171717;margin:4px 0 10px;">' + esc(l.slice(2)) + "</div>";
    if (l.startsWith("## ")) return '<div style="font-size:12.5px;font-weight:700;color:#2E7D77;margin:14px 0 6px;">' + esc(l.slice(3)) + "</div>";
    if (l.startsWith("- ") || l.startsWith("* ")) return '<div style="display:flex;gap:8px;padding:2px 0;"><span style="width:5px;height:5px;flex:none;margin-top:9px;border-radius:999px;background:#3FB6B0;"></span><span style="font-size:12.5px;color:#525252;line-height:1.9;">' + esc(l.slice(2)) + "</span></div>";
    return '<div style="font-size:12.5px;color:#525252;line-height:1.9;">' + esc(l) + "</div>";
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
  return '<div onclick="kbPick()" style="border:1.5px dashed #E2E2E2;background:#F8F8F8;border-radius:14px;padding:26px 20px;text-align:center;cursor:pointer;">' +
    '<div style="width:44px;height:44px;margin:0 auto 12px;border-radius:12px;background:#E3ECF8;display:flex;align-items:center;justify-content:center;"><span style="width:15px;height:15px;border:2.5px solid #2F5F94;border-radius:4px;"></span></div>' +
    '<div style="font-size:13.5px;font-weight:700;color:#171717;">' + (scopedProduct ? "ارفع ملف الخدمة — PDF أو Word أو PowerPoint" : "أضف خدمة مع ملفها — PDF أو Word أو PowerPoint") + "</div>" +
    '<div style="font-size:11.5px;color:#7C7C7C;margin-top:7px;line-height:1.9;">الملفات الرسمية المعتمدة فقط · محرك التحليل: Firecrawl AnyDoc · يُحفظ Markdown في Product Hub' + (scopedProduct ? "<br>يُضاف تحت هذه الخدمة ويقرأه المساعد فورًا" : "<br>يُستخرج اسم الخدمة من الملف تلقائيًا") + "</div></div>" +
    '<input id="kbfile" type="file" accept=".pdf,.docx,.pptx,.xlsx,.rtf,.odt,.epub,.csv" style="display:none" data-product="' + esc(scopedProduct || "") + '" onchange="kbUpload(this)">' +
    '<div id="kbstat" style="margin-top:12px;"></div>';
}
// معرفة الخدمة. WAS eight cards, each ~180px tall, five of which said «لا معرفة بعد» and nothing
// else — a 5+3 grid that left a third of its own row empty and a thousand pixels of white below it.
// It is a list, because that is what eight comparable rows are, and it carries the four facts a
// service actually has in the ledger instead of a chip that reads the same on every card.
function vKb() {
  const reg = kbRegistry();
  const skill = prodAssets.find((a) => a.product === "__skill__");
  // A service's real signals, all read from the ledger, none derived: an approved knowledge doc,
  // an attached profile file, the campaigns that ran on it, and the contacts the assistant tagged
  // as interested in it. Nothing here is scored — the six authored «درجة معرفة» numbers were
  // scrubbed in round 22 and the score bar has rendered a null on every row since.
  const rows = reg.map((r) => {
    const asset = prodAssets.find((a) => a.product === r.name) || null;
    const camps = campaigns.filter((c) => (c.product || "") === r.name).length;
    let warm = 0;
    ((cache && cache.contacts) || []).forEach((c) => {
      if (c.test && !showTest) return;
      if ((c.tags || []).some((t) => t.product === r.name)) warm++;
    });
    return { r, asset, camps, warm };
  });
  let h = "";
  if (skill) {
    h += '<div class="crmbar rise"><span style="flex:1;min-width:220px;font-size:12.5px;color:#525252;line-height:1.8;">' +
      '<b style="color:#171717;font-weight:500;">مهارة إنشاء العروض</b> — أنتج بها عروض الخدمات (PDF) ثم ارفعها في صفحة كل خدمة.' +
      ' <span style="direction:ltr;color:#999999;font-size:12px;">' + esc(skill.filename) + "</span></span>" +
      '<a class="btn btn-ghost" style="text-decoration:none;" href="/assets/' + esc(skill.public_id) + '" download>تحميل المهارة</a></div>';
  }
  h += '<div class="tblwrap crmflat kbflat rise"><div style="overflow-x:auto;" class="ms-scroll"><div class="crmgrid">' +
    '<div class="kbrow thead-wide" style="padding:8px 20px 8px 12px;background:#fff;border-bottom:1px solid #EDEDED;font-size:12px;font-weight:500;color:#7C7C7C;cursor:default;">' +
    "<div>الخدمة</div><div>معرفة المساعد</div><div>الملف التعريفي</div><div>حملات</div><div>جهات مهتمة</div><div></div></div>" +
    '<div class="thead-narrow"><span>الخدمة</span><span style="flex:1"></span><span>الحالة</span></div>';
  h += rows.map((x) =>
    '<a class="kbrow" href="#kb/' + encodeURIComponent(x.r.name) + '">' +
    '<span class="nm">' + esc(x.r.name) + (x.r.seed ? "" : '<span class="chip">مضافة برفع ملف</span>') + "</span>" +
    '<span class="st"><span class="d" style="background:' + (x.r.hub ? "#027A48" : "#E2E2E2") + ';"></span>' +
      (x.r.hub ? "معتمدة" : "لا معرفة بعد") + "</span>" +
    '<span class="st">' + (x.asset
      ? '<span class="d" style="background:#1F7A73;"></span><span class="fn">' + esc(clip(x.asset.filename, 30)) + "</span>"
      : '<span style="color:#C7C7C7;">—</span>') + "</span>" +
    '<span class="fig">' + (x.camps ? fmtN(x.camps) : '<span style="color:#C7C7C7;">—</span>') + "</span>" +
    '<span class="fig">' + (x.warm ? fmtN(x.warm) : '<span style="color:#C7C7C7;">—</span>') + "</span>" +
    '<span class="go">افتح ←</span></a>').join("");
  h += '</div></div><div class="tfoot"><span>' + ic("book", 14) + " " + fmtN(rows.length) + " خدمة · " +
    fmtN(rows.filter((x) => x.r.hub).length) + " منها بمعرفة معتمدة</span></div></div>";
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
  // The readiness ring is DELETED. r.sc has been null on every row since round 22 scrubbed the six
  // authored knowledge scores, so the ring resolved to (r.hub ? 100 : 0) and drew a two-state
  // boolean as a percentage — «١٠٠٪ جاهزية معرفة المساعد» meaning nothing more than «a file was
  // uploaded». A percentage that can only ever be 0 or 100 is an invented number wearing a gauge.
  // The same two states are already stated in words by the chip beside the title.

  let h = '<a href="#kb" style="display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:700;color:#525252;text-decoration:none;margin-bottom:14px;">→ كل الخدمات</a>';

  // ── Hero: identity, readiness ring, and the primary action together ──
  h += '<div class="card rise" style="display:flex;gap:22px;align-items:center;flex-wrap:wrap;padding:26px 24px;">' +
    '<div style="width:44px;height:44px;flex:none;border-radius:10px;background:#F3F3F3;display:flex;align-items:center;justify-content:center;color:#525252;font-weight:500;font-size:18px;">' + esc(name.trim().charAt(0)) + "</div>" +
    '<div style="flex:1;min-width:220px;">' +
    '<h1 style="margin:0;font-size:19px;font-weight:600;color:#171717;letter-spacing:-.2px;">' + esc(name) + "</h1>" +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:9px;align-items:center;">' +
    (r.hub ? '<span class="chip c-ok">جاهزة للبيع</span>' : '<span class="chip c-warn">بانتظار ملف المعرفة</span>') +
    (pa0 ? '<span class="chip c-teal">ملف تعريفي مرفق</span>' : '<span class="chip c-grey">دون ملف تعريفي</span>') +
    (r.hub && r.hub.source_filename ? '<span style="font-size:10.5px;color:#999999;direction:ltr;">' + esc(r.hub.source_filename) + "</span>" : "") +
    "</div></div>" +
    '<button class="btn btn-dark" style="flex:none;" data-prod="' + esc(name) + '" onclick="launchWithProduct(this.dataset.prod)">أطلق حملة بهذه الخدمة ←</button>' +
    "</div>";

  // ── Performance row: one scoreboard, not scattered chips ──
  const cells = [
    ["حملات الخدمة", prodCamps.length, "#171717"],
    ["صفقات مكتسبة", (wlProd && wlProd.won) || 0, "#027A48"],
    ["غير مكتسبة", (wlProd && wlProd.lost) || 0, "#B42318"],
    ["قيد التفاوض", (wlProd && wlProd.active) || 0, "#2F5F94"],
  ];
  h += '<div class="card rise" style="padding:0;overflow:hidden;">' +
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));">' +
    cells.map((c, i) => '<div style="padding:20px 22px;' + (i ? "border-inline-start:1px solid #EDEDED;" : "") + '">' +
      '<div style="font-size:11.5px;color:#7C7C7C;font-weight:600;">' + c[0] + "</div>" +
      '<div style="font-size:26px;font-weight:700;color:' + c[2] + ';margin-top:6px;font-variant-numeric:tabular-nums;">' + fmtN(c[1]) + "</div></div>").join("") +
    "</div>" +
    (prodCamps.length || prodCauses.length
      ? '<div style="border-top:1px solid #EDEDED;background:#F8F8F8;padding:14px 22px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">' +
        (prodCauses.length ? '<span style="font-size:11.5px;font-weight:700;color:#B42318;">أبرز سبب لعدم الإغلاق: ' + esc(prodCauses[0].cause) + '</span><span style="flex:1"></span>' : '<span style="flex:1"></span>') +
        prodCamps.slice(0, 3).map((c) => '<a href="#kmon/' + c.id + '" class="chip c-blue" title="' + esc(c.name) + '" style="text-decoration:none;max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;">' + esc(c.name) + "</a>").join("") +
        "</div>"
      : "") +
    "</div>";
  const pa = prodAssets.find((a) => a.product === name);
  const fileRow = (title, sub, chip, btnLabel, onclick) =>
    '<div style="display:flex;align-items:center;gap:14px;padding:18px 22px;border-bottom:1px solid #F3F3F3;flex-wrap:wrap;">' +
    '<div style="width:40px;height:40px;flex:none;border-radius:11px;background:#F3F3F3;display:flex;align-items:center;justify-content:center;color:#525252;">' + ic("doc", 19) + "</div>" +
    '<div style="flex:1;min-width:200px;"><div style="font-size:13.5px;font-weight:700;color:#171717;">' + title + "</div>" +
    '<div style="font-size:11.5px;color:#7C7C7C;margin-top:4px;line-height:1.8;">' + sub + "</div></div>" +
    chip + '<button class="btn btn-ghost" style="font-size:12px;padding:9px 16px;" onclick="' + onclick + '">' + btnLabel + "</button></div>";
  h += '<div class="card" style="padding:0;overflow:hidden;"><div style="padding:18px 22px 0;"><h3 style="margin:0 0 4px;">ملفات الخدمة</h3>' +
    '<div style="font-size:11.5px;color:#999999;margin-bottom:14px;">ما يرسله المساعد للعميل، وما يقرأه ليبيع</div></div>' +
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
      '<div style="border-top:1px solid #F3F3F3;padding-top:12px;">' + mdRender(r.hub.md) + "</div></div>";
  }
  if (seedP) {
    h += '<div class="card"><h3>المعرفة الأساسية المدمجة</h3><div style="border:1px solid #EDEDED;border-radius:12px;overflow:hidden;">' +
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
      '<div style="border:1px solid #EDEDED;border-radius:12px;overflow:hidden;">' +
      rows.map((r) => '<div class="kbrow"><span class="dt" style="background:' + (r[2] ? "#2e9e6b" : "#E2E2E2") + ';"></span>' +
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
    msg += '<div style="font-size:11px;color:#7C7C7C;margin-top:8px;line-height:1.9;">الأعمدة المكتشفة — الاسم: <b>' + esc(d.columns.name) + '</b> · الجوال: <b>' + esc(d.columns.phone) + "</b>" +
      (d.columns.attrs.length ? " · شرائح: " + d.columns.attrs.map(esc).join("، ") : " · لا أعمدة شرائح إضافية") + "</div>";
    if (d.skippedRows && d.skippedRows.length) {
      msg += '<div style="font-size:11px;color:#c43d3d;margin-top:4px;line-height:1.9;">' +
        d.skippedRows.map((s) => "صف " + fmtN(s.row) + ": " + esc(s.reason)).join(" · ") + "</div>";
    }
    entImportSummary = msg;   // survives the re-render (the status div is rebuilt by vTargetsCrm)
    const er = await fetch("/admin/entities", { headers: { "x-admin-token": TOKEN } });
    if (er.ok) entities = await er.json();
    render(false);
    alertBar("استُورد الملف — " + fmtN(d.added) + " جديد، " + fmtN(d.updated) + " محدّث", false);
  } catch (e) { st.innerHTML = '<span class="chip c-bad">خطأ في الاستيراد</span>'; }
  input.value = "";
};
/**
 * THE OUTCOME BOARD — «لوحة الفرز». The founder's own definition of what he is buying: "we want to
 * know who are interested, who are not interested, and if interested, when are we going to
 * schedule them." Three questions, five groups, one screen.
 *
 * WHERE IT LIVES, and why it moved. This board used to sit on TOP of #targets, above the imported
 * book, which made #targets answer two unrelated questions at once — and made this the third
 * rendering of a ranked contact list, after #home's action queue and #customers' group-by-outcome
 * view. It has its own route now: «فرص البيع», which until this cycle was a «ضمن المرحلة القادمة»
 * placeholder. The pipeline IS the founder's three questions; there was never a second thing for
 * that route to be.
 *
 * An empty group STILL says so rather than hiding — an empty «موعد محدد» is the honest measure of
 * whether the agent is working, and it is the one number a board that only renders what exists can
 * never show. That is also why this is not merely #customers' تجميع view, which derives its groups
 * from the rows present.
 */
function vMorningList() {
  const cs = (cache && cache.contacts || []).filter((c) => showTest || !c.test);
  const GROUPS = [
    ["scheduled", "موعد محدد", "#027A48", "اتصل بهم اليوم"],
    ["handoff", "بانتظار المختص", "#B54708", "أجاب المساعد وينتظرون مكالمة"],
    ["interested", "مهتم بلا موعد", "#2F5F94", "أبدوا اهتمامًا ولم يُحدَّد وقت بعد"],
    ["later", "مؤجل", "#7C7C7C", "طلبوا التأجيل"],
    ["stopped", "لا يرغب في التواصل", "#B42318", "توقّف الإرسال إليهم"],
  ];
  // A confirmed day decides the bucket, not c.outcome. An interested clinic whose day the operator
  // typed was rendering «موعد مؤكَّد: الثلاثاء ٢٥ أغسطس» UNDER the heading «مهتم بلا موعد» — the
  // header denying the row beneath it, on the one screen whose job is «who do I call today».
  const of = (k) => cs.filter((c) => {
    // appt() returns NULL when there is no appointment — the common case on this list. The gate
    // asserted the SOURCE contained appt(c).confirmed and passed; only smoke, which executes the
    // page, caught the dereference. Assertions on text are not assertions on behaviour.
    const a = appt(c);
    const confirmed = Boolean(a && a.confirmed);
    if (k === "scheduled") return c.outcome === "scheduled" || (confirmed && c.outcome !== "stopped" && c.outcome !== "not_interested" && !c.optedOut);
    if (k === "interested") return c.outcome === "interested" && !confirmed;
    if (k === "stopped") return c.outcome === "stopped" || c.outcome === "not_interested" || c.optedOut;
    return c.outcome === k;
  });
  const unsorted = cs.filter((c) => !c.outcome && !c.optedOut);
  const counts = {};
  GROUPS.forEach(([k]) => { counts[k] = of(k).length; });
  // A group of 162 needs a way in. The tab counts stay whole-group on purpose — narrowing the view
  // must not change what the strip reports the book contains.
  const oq = oppQ.trim();
  const match = (c) => !oq || (c.waName || "").includes(oq) || c.phone.includes(oq);
  const active = GROUPS.some((g) => g[0] === oppTab) ? oppTab : GROUPS[0][0];
  let h = '<div class="crmbar rise">' + GROUPS.map(([k, label, ink]) =>
    '<button class="qpill' + (active === k ? " on" : "") + '" onclick="oppSetTab(&quot;' + k + '&quot;)">' +
    '<span style="display:inline-block;width:7px;height:7px;border-radius:999px;background:' + ink + ';margin-inline-end:7px;"></span>' +
    label + " (" + fmtN(counts[k]) + ")</button>").join("") +
    '<span style="flex:1"></span>' +
    '<span style="position:relative;display:inline-flex;align-items:center;min-width:190px;max-width:280px;">' +
    '<span style="position:absolute;inset-inline-start:13px;color:#999999;display:flex;">' + ic("search", 17) + "</span>" +
    '<input id="oq" class="inp" value="' + esc(oppQ) + '" oninput="oppSearch(this)" placeholder="ابحث بالاسم أو الرقم…" ' +
    'style="width:100%;padding-inline-start:40px;height:38px;border-radius:999px;font-size:12px;"></span>' +
    '<span style="font-size:12px;color:#7C7C7C;">' + fmtN(cs.length) + " جهة في السجل" +
    (unsorted.length ? " · " + fmtN(unsorted.length) + " لم تُفرز بعد" : "") + "</span></div>";
  for (const [key, label, ink, hint] of GROUPS) {
    if (key !== active) continue;
    // «موعد محدد» is a call list: the soonest appointment is the one you ring first, and ordering it
    // by the ledger's insertion order made the first row an accident. Every other group leads with
    // the most recent movement, which is the row most likely to still be warm.
    const rows = of(key).filter(match).sort(key === "scheduled"
      ? (a, b) => { const x = appt(a), y = appt(b); return ((x && x.at) || Infinity) - ((y && y.at) || Infinity); }
      : (a, b) => (b.lastEventAt || 0) - (a.lastEventAt || 0));
    // Group header on the same #F8F8F8 bar as #customers' group view — one grouped-list idiom in
    // the product, not one per screen. The five tinted row fills that used to be here are gone:
    // five pastels down one page read as five alert levels, and none of these is an alert.
    h += '<div class="tblwrap crmflat rise" style="margin-bottom:14px;">' +
      '<div style="display:flex;align-items:center;gap:9px;padding:9px 20px 9px 12px;border-bottom:1px solid #EDEDED;background:#F8F8F8;">' +
      '<span style="width:7px;height:7px;border-radius:999px;flex:none;background:' + ink + ';"></span>' +
      '<span style="font-size:13px;font-weight:500;color:#171717;">' + label + "</span>" +
      '<span class="cntpill">' + fmtN(rows.length) + "</span>" +
      '<span style="font-size:12px;color:#999999;">' + hint + "</span></div>";
    if (!rows.length) {
      h += '<div style="padding:16px 20px;font-size:12.5px;color:#999999;">' +
        (oq ? "لا أحد في هذه المجموعة يطابق «" + esc(oq) + "»." : "لا أحد في هذه المجموعة بعد.") + "</div></div>";
      continue;
    }
    const shown = pageSlice("op_" + key, rows);
    h += shown.map((c) => {
      const nm = c.waName || "غير معروف";
      // M3 — this function's own comment above quotes the founder's three questions, and this was
      // the one surface that never learned his answer to the third: it read c.scheduledAt alone, so
      // a day typed into ملف العميل changed nothing here. It reads the ONE appointment now, and
      // carries the same word every other surface uses — مؤكَّد for a day a human typed,
      // «لم تُؤكَّد بعد» for our reading of the customer's phrase. The DAY only: 09:00 is dayToMs's
      // sort key, not a time anybody stated.
      const ap = appt(c);
      const conf = ap && ap.confirmed
        ? esc(fmtDay(ap.at)) + (ap.by ? " · سجّله " + esc(ap.by) : "")
        : "";
      const when = key === "scheduled" && c.scheduledSaid
        ? '<span style="font-size:12.5px;font-weight:500;color:#171717;">«' + esc(c.scheduledSaid) + "»</span>" +
          (conf ? '<span style="font-size:12px;color:#027A48;"> · مؤكَّد ' + conf + "</span>"
            : ap ? '<span style="font-size:12px;color:#999999;"> · قراءتنا ' + esc(fmtT(ap.at)) + " · لم تُؤكَّد بعد</span>"
                 : '<span style="font-size:12px;color:#999999;"> · لم نقرأ تاريخًا</span>')
        // A confirmed day answers «متى؟» in EVERY group, not only in موعد محدد: an interested
        // clinic with a day the operator wrote down is exactly what his third question asks for.
        : conf
          ? '<span style="font-size:12px;color:#027A48;">موعد مؤكَّد: ' + conf + "</span>"
          : c.outcomeReason
            ? '<span style="font-size:12px;color:#7C7C7C;">«' + esc(String(c.outcomeReason).slice(0, 80)) + "»</span>"
            : '<span style="font-size:12px;color:#C7C7C7;">—</span>';
      return '<div class="oprow" onclick="location.hash=&quot;customer/' + esc(c.phone) + '&quot;">' +
        '<span class="av">' + esc(nm.trim().charAt(0)) + "</span>" +
        '<span class="nm">' + esc(nm) + "</span>" +
        '<span class="ph">+' + esc(c.phone) + "</span>" +
        '<span class="wh">' + when + "</span>" +
        '<span class="go">افتح ←</span></div>';
    }).join("") +
      (rows.length > PAGE_SIZES[0] ? '<div class="tfoot">' + pageBar("op_" + key, rows.length, "جهة") + "</div>" : "") +
      "</div>";
  }
  if (unsorted.length) {
    h += '<div style="font-size:12.5px;color:#999999;padding:4px 2px 8px;">' +
      fmtN(unsorted.length) + " جهة لم تُفرز بعد — لم تُسجَّل لها نتيجة.</div>";
  }
  return h;
}

window.oppSetTab = (k) => { oppTab = k; render(false); };
window.oppSearch = (el) => { oppQ = el.value; clearTimeout(window.__oq); window.__oq = setTimeout(() => render(false), 250); };
window.entDel = async (id) => {
  await fetch("/admin/entities/delete", { method: "POST", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
  entities = entities.filter((e) => e.id !== id); entSel.delete(id); render(false);
};

// Fourteen days of newly-qualified contacts. Every point is a COUNT OF PEOPLE whose first hot or
// warm reading landed that day — not a smoothed curve, not a projection, and zero days are drawn
// as zero rather than skipped, so a quiet week looks quiet.
function qualSeries(cs, days) {
  const d0 = new Date(); d0.setHours(0, 0, 0, 0);
  const start = d0.getTime() - (days - 1) * 864e5;
  const out = new Array(days).fill(0);
  cs.forEach((c) => {
    const first = (c.tags || []).filter((t) => (t.level === "hot" || t.level === "warm") && t.ts)
      .reduce((a, t) => (a === null || t.ts < a ? t.ts : a), null);
    if (first === null || first < start) return;
    const i = Math.floor((first - start) / 864e5);
    if (i >= 0 && i < days) out[i]++;
  });
  return out;
}
// TIME RUNS RIGHT TO LEFT, like the language. Drawn left-to-right, the newest point landed on the
// right while the axis label «اليوم» sat on the left — the curve and its own axis disagreeing about
// which end was today. x is mirrored rather than the array reversed, so the data stays in
// chronological order for anything else that reads it.
function sparkArea(vals, w, hgt) {
  const mx = Math.max(1, ...vals);
  const n = vals.length;
  const x = (i) => (n === 1 ? 0 : w - (i / (n - 1)) * w);
  const y = (v) => hgt - (v / mx) * (hgt - 6) - 2;
  const line = vals.map((v, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + y(v).toFixed(1)).join(" ");
  const area = line + " L0," + hgt + " L" + w + "," + hgt + " Z";
  const last = vals[n - 1];
  return '<svg dir="ltr" viewBox="0 0 ' + w + " " + hgt + '" preserveAspectRatio="none" ' +
    'style="width:100%;height:' + hgt + 'px;display:block;overflow:visible;" role="img" aria-label="جهات مؤهلة جديدة يوميًا">' +
    '<defs><linearGradient id="spg" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="#1F7A73" stop-opacity=".20"/>' +
    '<stop offset="100%" stop-color="#1F7A73" stop-opacity="0"/></linearGradient></defs>' +
    '<path d="' + area + '" fill="url(#spg)"/>' +
    '<path d="' + line + '" fill="none" stroke="#1F7A73" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<circle cx="' + x(n - 1).toFixed(1) + '" cy="' + y(last).toFixed(1) + '" r="3" fill="#1F7A73"/></svg>';
}
// A funnel, drawn as one. Each band's TOP edge is the stage above it and its BOTTOM edge is its own
// value, so the slope between two bands IS the drop between them — the single thing the six equal
// bars this replaces could not show. The teal ramp encodes depth, which is the stage order and
// nothing else; it is not a second meaning smuggled in as colour.
function funnelSvg(rows) {
  const mx = Math.max(1, rows[0] ? rows[0][1] : 1);
  const W = 300, segH = 44, gap = 6;
  const H = rows.length * (segH + gap) - gap;
  const ramp = ["#1F7A73", "#2A8B84", "#3B9C95", "#5AB0AA", "#84C7C2", "#B2DDD9"];
  let shapes = "";
  rows.forEach((r, i) => {
    const wT = Math.max(0.08, (i === 0 ? r[1] : rows[i - 1][1]) / mx) * W;
    const wB = Math.max(0.08, r[1] / mx) * W;
    const y = i * (segH + gap);
    shapes += '<path d="M' + ((W - wT) / 2).toFixed(1) + "," + y + " L" + ((W + wT) / 2).toFixed(1) + "," + y +
      " L" + ((W + wB) / 2).toFixed(1) + "," + (y + segH) + " L" + ((W - wB) / 2).toFixed(1) + "," + (y + segH) +
      ' Z" fill="' + ramp[i % ramp.length] + '"/>';
  });
  const legend = rows.map((r, i) => {
    const prev = i > 0 ? rows[i - 1][1] : r[1];
    const drop = i > 0 && prev > 0 ? Math.round((1 - r[1] / prev) * 100) : 0;
    return '<div class="lgr"><span class="vl">' + fmtN(r[1]) + "</span>" +
      '<span class="nm">' + esc(r[0]) + "</span>" +
      (drop > 0 ? '<span class="dp">−' + fmtN(drop) + "٪</span>" : "") + "</div>";
  }).join("");
  return '<div class="fnl"><div dir="ltr" style="min-width:0;"><svg viewBox="0 0 ' + W + " " + H +
    '" style="width:100%;height:auto;display:block;" role="img" aria-label="مسار التحويل التسويقي">' + shapes + "</svg></div>" +
    '<div class="lg">' + legend + "</div></div>";
}
function ratesStrip(agg) {
  // A rate whose denominator is zero is not «٠٪», it is unmeasured. Returning null here is what
  // stops «٠٪ من جهات الاستهداف» appearing under a hero that honestly reads «—».
  const pct = (a, b) => (b ? Math.round(a / b * 100) : null);
  const rows = [
    ["نسبة الوصول", pct(agg.delivered, agg.sent || agg.targeted), "من التي أُرسلت"],
    ["نسبة المشاهدة", pct(agg.seen, agg.delivered), "من التي وصلت"],
    ["نسبة الردود", pct(agg.replied, agg.delivered), "من التي وصلت"],
    ["نسبة الاهتمام", pct(agg.interested, agg.replied), "ممن ردّوا"],
  ];
  return '<div class="card rise" style="margin:0;padding-bottom:2px;">' +
    '<div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;padding-bottom:4px;">' +
    '<h3 style="margin:0;">معدلات الأداء</h3>' +
    '<span style="font-size:10.5px;color:#999999;">كل نسبة ومقامها معها</span></div>' +
    rows.map((r) => '<div style="display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid #EDEDED;">' +
      '<span style="flex:0 0 106px;font-size:12.5px;color:#383838;">' + r[0] + "</span>" +
      '<span style="flex:0 0 52px;font-size:16px;font-weight:600;color:' + (r[1] === null ? "#C7C7C7" : "#171717") +
        ';font-variant-numeric:tabular-nums;">' + (r[1] === null ? "—" : fmtN(r[1]) + '<span style="font-size:11px;color:#999999;font-weight:450;">٪</span>') + "</span>" +
      '<span style="flex:0 0 88px;font-size:12px;color:#999999;">' + r[2] + "</span>" +
      '<span style="flex:1;min-width:60px;height:6px;background:#F3F3F3;border-radius:999px;overflow:hidden;">' +
        (r[1] === null ? "" : '<i style="display:block;height:100%;width:' + Math.min(100, r[1]) + '%;background:#1F7A73;border-radius:999px;"></i>') + "</span></div>").join("") + "</div>";
}
function chartCard(title, sub, inner) {
  return '<div class="card" style="margin:0;"><div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px;"><h3 style="margin:0;">' + title + '</h3><span style="font-size:10.5px;color:#999999;">' + sub + "</span></div>" + inner + "</div>";
}
function hbarRows(rows, color) {
  const mx = Math.max(1, ...rows.map((r) => r[1]));
  return '<div style="margin-top:12px;display:flex;flex-direction:column;gap:9px;">' + rows.map((r) =>
    '<div><div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px;"><span style="font-weight:600;color:#383838;">' + esc(String(r[0])) + '</span><span style="font-weight:700;color:#171717;">' + fmtN(r[1]) + "</span></div>" +
    '<div style="height:8px;background:#EDEDED;border-radius:999px;overflow:hidden;"><i style="display:block;height:100%;border-radius:999px;width:' + Math.round(r[1] / mx * 100) + "%;background:" + (r[2] || color) + ';"></i></div></div>').join("") + "</div>";
}
// نشاط الرسائل — fourteen days, stacked areas. It was 28 grey-and-teal stubs 30px wide with a
// label under each; at one message a day the bars were 3px tall and the chart said nothing you
// could not have read from a sentence. An area shows the SHAPE of a fortnight, which is the only
// question this card is asked: is it picking up or dying down.
function dailyActivitySvg(cs) {
  const days = []; const now = new Date(); now.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 864e5);
    days.push({ t0: d.getTime(), t1: d.getTime() + 864e5, inN: 0, outN: 0,
      label: i === 0 ? "اليوم" : d.toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "numeric" }) });
  }
  cs.forEach((c) => (c.transcript || []).forEach((t) => {
    const d = days.find((x) => t.ts >= x.t0 && t.ts < x.t1);
    if (d) { if (t.role === "customer") d.inN++; else if (t.role === "agent") d.outN++; }
  }));
  const mx = Math.max(1, ...days.map((d) => d.inN + d.outN));
  const W = 320, H = 96, n = days.length;
  const x = (i) => W - (i / (n - 1)) * W;   /* mirrored: oldest at the start edge, today at the end */
  const y = (v) => H - (v / mx) * (H - 8) - 2;
  const path = (get) => days.map((d, i) => (i ? "L" : "M") + x(i).toFixed(1) + "," + y(get(d)).toFixed(1)).join(" ");
  const areaOf = (p) => p + " L0," + H + " L" + W + "," + H + " Z";
  const total = days.reduce((a, d) => a + d.inN + d.outN, 0);
  if (!total) return '<div style="font-size:12px;color:#999999;margin-top:14px;">لا رسائل خلال آخر ١٤ يومًا.</div>';
  const stack = path((d) => d.inN + d.outN), inner = path((d) => d.inN);
  return '<div dir="ltr" style="margin-top:12px;"><svg viewBox="0 0 ' + W + " " + H +
    '" preserveAspectRatio="none" style="width:100%;height:' + H + 'px;display:block;" role="img" aria-label="نشاط الرسائل خلال ١٤ يومًا">' +
    '<defs><linearGradient id="agr" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="#1F7A73" stop-opacity=".22"/><stop offset="100%" stop-color="#1F7A73" stop-opacity="0"/></linearGradient></defs>' +
    '<line x1="0" y1="' + (H - 2) + '" x2="' + W + '" y2="' + (H - 2) + '" stroke="#EDEDED" stroke-width="1"/>' +
    '<path d="' + areaOf(stack) + '" fill="#F3F3F3"/>' +
    '<path d="' + stack + '" fill="none" stroke="#C7C7C7" stroke-width="1.2" stroke-linejoin="round"/>' +
    '<path d="' + areaOf(inner) + '" fill="url(#agr)"/>' +
    '<path d="' + inner + '" fill="none" stroke="#1F7A73" stroke-width="1.6" stroke-linejoin="round"/></svg></div>' +
    '<div style="display:flex;justify-content:space-between;font-size:11px;color:#C7C7C7;margin-top:4px;">' +
    '<span>' + esc(days[0].label) + '</span><span>' + esc(days[days.length - 1].label) + "</span></div>" +
    '<div style="display:flex;gap:16px;margin-top:9px;font-size:12px;color:#7C7C7C;">' +
    '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#1F7A73;margin-inline-end:6px;"></i>واردة من العملاء</span>' +
    '<span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:#C7C7C7;margin-inline-end:6px;"></i>الإجمالي مع الصادرة</span></div>';
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
    // Explicit window 0 — these charts are deliberately lifetime. Passing the bare function handed
    // Array.filter's INDEX to win (0,1,2,3…), so every real timestamp passed and the numbers were
    // right only by accident. Fail-open by typo is the exact shape this whole series set out to kill.
    seen: reached.filter((c) => seenOf(c, 0)).length,
    replied: reached.filter((c) => (c.statusTimes || {}).replied).length,
    interested: reached.filter((c) => interestedOf(c, 0)).length,
  };
  const funnel = [["جهات الاستهداف", agg.targeted], ["أُرسلت", agg.sent], ["وصلت", agg.delivered], ["شوهدت", agg.seen], ["ردّوا", agg.replied], ["جهات مهتمة", agg.interested]].map((r) => [r[0], r[1], "#1F7A73"]);
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
  // ROW A — conversion. The funnel and the rates answer the same question at two resolutions, so
  // they belong side by side; splitting them left the rates as a full-width strip of thin bars.
  h += '<div style="display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,1fr);gap:16px;align-items:start;margin-bottom:16px;" class="chgrid">';
  h += chartCard("مسار التحويل التسويقي", fmtN(camps.length) + " حملة", agg.targeted ? funnelSvg(funnel) : '<div style="font-size:12px;color:#999999;margin-top:14px;line-height:1.9;">لا حملات ' + (showTest ? "" : "فعلية ") + 'بعد — القمع يتعبأ مع أول إطلاق.</div>');
  h += ratesStrip(agg);
  h += "</div>";
  // ROW B — what is moving, and in which service.
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:16px;align-items:start;margin-bottom:18px;">';
  h += chartCard("نشاط الرسائل", "آخر ١٤ يومًا", dailyActivitySvg(cs));
  // Four distributions, one idiom. They answer the same shape of question — «how does the book
  // split by X» — so drawing three of them as columns, tiles and bars taught a difference that
  // does not exist. Teal is the accent; the ramp behind it is neutral.
  h += chartCard("الاهتمام حسب الخدمة", "من تصنيفات المساعد", prodRows.length ? hbarRows(prodRows, "#1F7A73") : '<div style="font-size:12px;color:#999999;margin-top:14px;">تظهر عند أول وسم اهتمام.</div>');
  h += "</div>";
  const facets = [["المدينة", cityRows], ["الحجم", sizeRows], ["القطاع", secRows]].filter((f) => f[1].length);
  h += chartCard("تركيبة قائمتك", fmtN(entities.length) + " جهة · من أعمدة ملفك", facets.length
    ? '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:22px;margin-top:4px;">' +
      facets.map((f) => '<div><div style="font-size:11.5px;font-weight:500;color:#7C7C7C;padding-bottom:2px;">' + f[0] + "</div>" + hbarRows(f[1], "#1F7A73") + "</div>").join("") + "</div>"
    : '<div style="font-size:12px;color:#999999;margin-top:14px;">تظهر بعد استيراد قائمة فيها أعمدة المدينة أو الحجم أو القطاع.</div>');
  return h;
}
const DEAL_META = { won: ["صفقة مكتسبة", "#027A48", "#ECFDF3"], lost: ["غير مكتسبة", "#B42318", "#FEF3F2"], stalled: ["متوقفة", "#B54708", "#FFFAEB"], active: ["نشطة", "#2F5F94", "#EFF4FB"] };
// ---------------------------------------------------------------------------
// «ما يستحق المتابعة الآن» — the ONE morning list in the product.
//
// It used to be three lists. This card, «أفضل الفرص الآن» 900px below it on the same page, and
// «قائمة الصباح» on #targets all ranked the same four people from the same signals in three
// different visual languages. A list you meet three times is a list nobody trusts, because the
// three never quite agree. There is one now, and the other two surfaces link to it.
//
// FOUR reasons a row can appear, in descending urgency. Each states its own reason in words —
// no row appears without one, and no reason is inferred:
//   1. مؤهلة وصامتة  — tagged hot / high intent, then nothing for over a day.
//   2. فرصة جديدة    — tagged interested (or asked for a person) within the last day.
//   3. شاهدوا دون ردّ — a campaign-windowed claim: read the message, never replied to THAT send.
//   4. صفقة متوقفة   — the assistant judged the conversation stalled, and says why.
//
// The tinted row fills are gone. Four rows in four pastels read as four alerts; the eye cannot
// rank four alerts. Urgency is one 8px dot now, and the rows are white with a hairline between —
// the same list idiom as every other table in the product.
function vActionQueue(cs, notifyNumber, nTest) {
  const now = Date.now();
  const DAY = 24 * 3600e3;
  const isHot = (c) => (c.tags || []).some((t) => t.level === "hot") || (insCache[c.phone] || {}).intent === "high";
  const live = cs.filter((c) => !c.optedOut);
  const hotIdle = live.filter((c) => isHot(c) && now - (c.lastEventAt || 0) > DAY)
    .sort((a, b) => (a.lastEventAt || 0) - (b.lastEventAt || 0));
  // Fresh opportunities were only ever visible in the card this one absorbed. Dropping them would
  // have meant a contact the assistant qualified an hour ago appearing NOWHERE until it went cold.
  const fresh = live.filter((c) => (interestedOf(c, 0) || c.outcome === "handoff") &&
    now - (c.lastEventAt || 0) <= DAY && !hotIdle.includes(c))
    .sort((a, b) => (b.lastEventAt || 0) - (a.lastEventAt || 0));
  const seenNoReply = new Set();
  // Windowed per campaign: this pairs a contact WITH a campaign, so it is a campaign claim and
  // reading lifetime state here would queue a retarget for someone who already replied to that very
  // send — or, worse, who replied to a different campaign entirely.
  campaigns.forEach((cp) => { const w = campWin(cp); cp.targets.forEach((t) => {
    const c = contactByPhone(t.phone);
    if (c && atOrAfter((c.statusTimes || {}).read, w) && !repliedIn(c, w) && !c.optedOut) seenNoReply.add(c.phone);
  }); });
  const stalled = live.filter((c) => (insCache[c.phone] || {}).deal_state === "stalled");

  const hrs = (c) => fmtAgo(now - (c.lastEventAt || 0));
  const tagOf = (c) => (c.tags || []).find((t) => t.level === "hot") || (c.tags || [])[0];
  const items = [];
  hotIdle.slice(0, 4).forEach((c) => items.push({ c, dot: "#B42318", why: "مؤهلة وبلا متابعة منذ " + hrs(c),
    act: (insCache[c.phone] || {}).next_action || "", href: "customer/" + c.phone }));
  fresh.slice(0, 4).forEach((c) => items.push({ c, dot: "#027A48", why: "فرصة جديدة · تفاعل خلال آخر ٢٤ ساعة",
    act: (insCache[c.phone] || {}).next_action || "", href: "customer/" + c.phone }));
  if (seenNoReply.size) items.push({ c: null, icon: "eye", dot: "#B54708", name: "شاهدوا الرسالة دون ردّ",
    why: fmtN(seenNoReply.size) + " جهة", act: "أعد التواصل برسالة تبرز أثرًا تشغيليًا مختلفًا", href: "kmon" });
  stalled.slice(0, 2).forEach((c) => { const ins = insCache[c.phone] || {};
    items.push({ c, dot: "#2F5F94", why: "صفقة متوقفة" + (ins.loss_cause ? " · " + ins.loss_cause : ""),
      act: ins.fix_suggestion || "", href: "customer/" + c.phone }); });

  const anyAct = items.some((i) => i.act);
  let h = '<div class="card rise' + (anyAct ? "" : " noact") + '" style="margin-bottom:18px;padding-bottom:0;overflow:hidden;">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding-bottom:12px;">' +
    '<div><h3 style="margin:0;">ما يستحق المتابعة الآن</h3>' +
    '<div style="font-size:11.5px;color:#999999;margin-top:4px;">قائمة الصباح الوحيدة — مرتَّبة بالأكثر إلحاحًا، وكل سطر يذكر سببه.</div></div>' +
    '<span style="display:inline-flex;gap:6px;align-items:center;">' +
    (items.length ? '<span class="cntpill">' + fmtN(items.length) + " إجراء</span>" : "") + testToggleChip(nTest) + "</span></div>";
  // What the queue is a TOP-OF, stated. Four idle + four fresh + two stalled is a shortlist; the
  // page must not let a shortlist read as a total.
  const pool = hotIdle.length + fresh.length + stalled.length + (seenNoReply.size ? 1 : 0);
  if (!items.length) {
    h += '<div style="padding:26px 2px 30px;font-size:12.5px;color:#7C7C7C;line-height:1.9;border-top:1px solid #EDEDED;">' +
      "لا شيء يستحق التدخل الآن. حين يرصد المساعد فرصة مؤهلة أو محادثة تتوقف، يظهر السطر هنا فورًا — ويصلك تنبيه واتساب.</div>";
  } else {
    h += items.map(function (it) {
      const c = it.c;
      const nm = c ? (c.waName || c.phone) : it.name;
      const tg = c ? tagOf(c) : null;
      return '<div class="aq" onclick="location.hash=&quot;' + it.href + '&quot;">' +
        '<span class="aqd" style="background:' + it.dot + ';"></span>' +
        (c ? '<span class="aqav">' + esc((c.waName || "؟").trim().charAt(0)) + "</span>"
           : '<span class="aqav aqic">' + ic(it.icon, 16, "#7C7C7C") + "</span>") +
        '<span class="aqt"><span class="aqn">' + esc(nm) +
          (tg ? '<span class="chip ' + (tg.level === "hot" ? "c-bad" : "c-warn") + '">' + esc(clip(tg.product, 26)) +
            (tg.level === "hot" ? " · نية مرتفعة" : " · مهتم") + "</span>" : "") +
          (c && c.test ? '<span class="chip">تجريبي</span>' : "") + "</span>" +
        '<span class="aqw">' + esc(it.why) + "</span></span>" +
        '<span class="aqa">' + (it.act ? esc(clip(it.act, 150)) : "") + "</span>" +
        '<span class="aqgo">افتح ←</span></div>';
    }).join("");
  }
  if (pool > items.length) {
    h += '<div style="display:flex;align-items:center;gap:10px;padding:11px 2px;border-top:1px solid #EDEDED;font-size:12.5px;color:#7C7C7C;">' +
      '<span>أهمّ ' + fmtN(items.length) + " من " + fmtN(pool) + " تستحق المتابعة.</span>" +
      '<a href="#opps" style="color:#1F7A73;font-weight:500;text-decoration:none;">لوحة الفرز الكاملة ←</a></div>';
  }
  if (notifyNumber) {
    h += '<div style="display:flex;align-items:center;gap:8px;padding:11px 2px;border-top:1px solid #EDEDED;font-size:11.5px;color:#7C7C7C;">' +
      ic("send", 14, "#999999") + '<span>تنبيهات «عميل جاد» و«طلب تدخّل» تصل واتساب مدير المنتج</span>' +
      '<b style="color:#525252;font-weight:500;direction:ltr;">+' + esc(notifyNumber) + "</b></div>";
  }
  return h + "</div>";
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
    '<div style="font-size:11px;color:#999999;margin-top:6px;">حكم المساعد على كل محادثة من نصها الحرفي — مع الدليل</div>';
  if (!judged && !(t.active || 0)) {
    h += '<div style="font-size:12.5px;color:#7C7C7C;margin-top:14px;line-height:1.9;">يتعبأ هذا اللوح مع أول محادثات محكومة — كل صفقة مكتسبة أو غير مكتسبة ستظهر هنا بسببها.</div></div>';
    return h;
  }
  const nWin = (winloss.win_drivers || []).length, nLoss = (winloss.loss_causes || []).length;
  const cnt = (k) => (k > 1 ? '<span class="chip">×' + fmtN(k) + "</span>" : "");
  h += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;margin-top:16px;">';
  if (nWin) {
    h += '<div><div style="font-size:11.5px;font-weight:500;color:#027A48;margin-bottom:9px;">ما يكسب لنا الصفقات</div>' +
      winloss.win_drivers.map((w) => '<div style="display:flex;align-items:center;gap:9px;padding:9px 0;border-top:1px solid #EDEDED;"><span style="flex:1;font-size:12.5px;color:#171717;line-height:1.8;">' + esc(w.driver) + "</span>" + cnt(w.count) + "</div>").join("") + "</div>";
  }
  if (nLoss) {
    h += '<div><div style="font-size:11.5px;font-weight:500;color:#B42318;margin-bottom:9px;">ما يخسّرنا الصفقات</div>' +
      winloss.loss_causes.map((c) => '<div style="padding:9px 0;border-top:1px solid #EDEDED;"><div style="display:flex;align-items:center;gap:9px;"><span style="flex:1;font-size:12.5px;font-weight:500;color:#171717;">' + esc(c.cause) + "</span>" + (c.products || []).map((pd) => '<span class="chip">' + esc(clip(pd, 22)) + "</span>").join("") + cnt(c.count) + "</div>" +
        (c.example ? '<div style="font-size:11.5px;color:#7C7C7C;margin-top:4px;line-height:1.8;">« ' + esc(c.example) + ' »</div>' : "") + "</div>").join("") + "</div>";
  }
  h += "</div>";
  if (!nWin || !nLoss) {
    h += '<div style="font-size:12px;color:#999999;margin-top:' + (nWin || nLoss ? "14px;padding-top:12px;border-top:1px solid #EDEDED;" : "10px;") + '">' +
      (!nWin && !nLoss ? "لا محرّكات محكومة بعد على أي من الجانبين."
        : !nLoss ? "لا خسائر محكومة بعد — وهذا خبر جيد." : "لا مكاسب محكومة بعد.") + "</div>";
  }
  // a bordered block that renders nothing is still a border: decide from the filtered rows, not the raw list
  const judgedProducts = (winloss.by_product || []).filter((pr) => (pr.won || 0) + (pr.lost || 0) > 0).slice(0, 4);
  if (judgedProducts.length) {
    h += '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #EDEDED;">' +
      judgedProducts.map((pr) => '<div style="display:flex;align-items:center;gap:10px;padding:6px 0;font-size:12px;">' +
        '<span style="flex:1;min-width:0;color:#383838;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(pr.product) + "</span>" +
        '<span style="color:#027A48;">' + fmtN(pr.won) + ' مكتسبة</span><span style="color:#C7C7C7;">·</span>'  +
        '<span style="color:#B42318;">' + fmtN(pr.lost) + " غير مكتسبة</span></div>").join("") + "</div>";
  }
  h += "</div>";
  return h;
}
// vSalesPath + SALES_PATH are DELETED, not merely uncalled (design-plan.md section 5). Leaving the
// renderer defined kept 30 lines that paint five stages nobody reached and a ✓ nobody verified one
// call site away from returning, and check-outcomes.mjs can now ban the identifier outright instead
// of banning one exact spelling of one call. ADR-0001 forbids RANGE edits here; this was a single
// anchored replacement of the whole function text, with a definition-count audit either side.
// INTENT_META is deleted with its last reader (the «const im» line in vCustomer): the intent badge and the
// tone badge that read it are both gone from the record, and a table nothing reads is an invented
// vocabulary waiting to be re-rendered. Interest now has exactly one home per provenance —
// solid chips in ملف العميل (fact) and the status strip's «قراءة» chip (reading).
// toneBadge is DELETED with its last caller (the ins.learning branch of فهم المساعد). A renderer
// with no reader is an invented vocabulary waiting to be re-called, which is how the badge row
// survived §5's deletion in one state after being removed from the other.
function tlDot(kind) {
  return { in: "#2F5F94", out: "#3FB6B0", camp: "#2E8F89", file: "#b5810f", tag: "#C9A227", st: "#999999", sys: "#E2E2E2" }[kind] || "#E2E2E2";
}
// ---------------------------------------------------------------------------
// ملف العميل — the enrichable client record (cycle crm-record; design plan §3/§4).
// Six typed properties mirroring tracker.ts PROP_KEYS, each carrying WHO said it and WHEN.
// Three states per field: حقيقة (source human) · قراءة (source agent) · ناقص (key absent).
// The mark is a SHAPE first and a colour second, and it NEVER renders without its word — so a
// single field lifted out of this panel still says «سجّلها …» or «قراءة المساعد».
// These are siblings of vCustomer, not edits inside it: ADR-0001 forbids range edits in this file
// and vCustomer is 216 lines, so the panel is spliced in with one anchored concat instead.
// ---------------------------------------------------------------------------
const OPERATOR = "عبدالعزيز";
// NFR-1 bounds, mirrored from tracker.ts MAX_LEN so the over-limit message can state the real
// number instead of a plausible one. A wrong cap in a message IS an invented number.
const PROP_MAX = { decisionMaker: 120, orgProfile: 120, productInterest: 800, nextStep: 120, note: 2000, disqualifyReason: 200 };
// FR-6's closed vocabulary PAIRED with its Arabic label in ONE table. The value this panel WRITES
// («price: …») is the value it must READ BACK; a label that lives only on the write side is the
// defect class this repo keeps re-learning (emitted values must be readable).
const DQ_REASONS = [["price", "السعر"], ["no_need", "لا حاجة لدى العميل"], ["wrong_contact", "جهة اتصال خاطئة"],
  ["competitor", "لدى منافس"], ["no_response", "لا رد"], ["other", "سبب آخر"]];
const LV_META = { hot: ["c-ok", "نية مرتفعة"], warm: ["c-warn", "مهتم"], cold: ["c-grey", "فاتر"] };
// The five fields «ناقص N» counts. سبب الاستبعاد is SHOWN but never counted: an un-excluded
// customer is the normal case, and counting it would make every healthy record read as a gap.
const GAP_KEYS = ["decisionMaker", "orgProfile", "productInterest", "nextStep", "note"];

function pmSpan(kind, style) {
  return '<span class="pm pm-' + kind + '"' + (style ? ' style="' + style + '"' : "") + "></span>";
}
// ONE reading of a field's state, used by BOTH the «ناقص N» chip and the row it describes — so the
// header can never claim two gaps while three rows render the missing mark.
// Last tag per product, hottest first — the same reduction the status strip and the panel already
// do inline. Named once here so «أكّد» confirms EXACTLY the set the operator can see, rather than a
// second, subtly different reading of c.tags.
function interestLatest(tags) {
  const latest = new Map();
  (tags || []).forEach((tg) => latest.set(tg.product, tg));
  const order = { hot: 0, warm: 1, cold: 2 };
  return [...latest.values()].sort((a, b) => (order[a.level] ?? 3) - (order[b.level] ?? 3) || (b.ts || 0) - (a.ts || 0));
}
function propState(d, key) {
  const c = d.contact || {};
  const p = (c.props || {})[key];
  if (p && p.value) return { state: p.source === "human" ? (p.by === "import" ? "imported" : "fact") : "reading", prop: p };
  if (key === "orgProfile" && d.entity) return { state: "imported", prop: null };
  if (key === "productInterest" && (c.tags || []).length) return { state: "reading", prop: null };
  if (key === "nextStep" && c.scheduledSaid) return { state: "reading", prop: null };
  return { state: "missing", prop: null };
}
function propGapCount(d) {
  let n = 0;
  GAP_KEYS.forEach((k) => { if (propState(d, k).state === "missing") n++; });
  return n;
}
// The signature is the mark's word. «أكّدها» and «سجّلها» are different facts about the same
// value: prior holding the SAME value is what a confirmation is, and the operator can see it.
function propSig(p) {
  const when = p.ts ? " · " + fmtD(p.ts) : "";
  if (p.source !== "human") return "قراءة المساعد" + when;
  if (p.by === "import") return "من ملف الاستيراد" + when + " · يمكنك تصحيحه";
  const confirmed = p.prior && p.prior.value === p.value;
  return (confirmed ? "أكّدها " : "سجّلها ") + esc(p.by || "اللوحة") + when;
}
// ONE vocabulary, read in BOTH the shapes we emit. tracker.formatInterest writes the wire form
// «منتج:hot · منتج:warm»; propDraft() below hands the operator the same set as Arabic he can read,
// «منتج: نية مرتفعة، منتج: مهتم». This reads either back to the same pairs.
// It parsed only the wire form once — so a correction typed by a human returned [], the row fell
// back to the AGENT's tags, and rendered them SOLID under «سجّلها عبدالعزيز»: the machine's guess
// signed by a person who never wrote it. The round-trip is asserted in scripts/check-props.mjs.
// A label that lives only on the write side is the defect class this repo keeps re-learning.
const LV_BY_LABEL = {};
Object.keys(LV_META).forEach((k) => { LV_BY_LABEL[LV_META[k][1]] = k; });
function interestLevel(s) {
  const t = String(s || "").trim();
  return LV_META[t] ? t : (LV_BY_LABEL[t] || "");
}
// «،» separates pairs in the display form, « · » in the wire form: normalised to one, so a set
// typed in Arabic and a set written by the tool split identically. ONE splitter, because the count
// of what the operator typed and the count of what we understood must be taken the same way —
// otherwise the «was anything dropped?» question below answers about a different string.
function interestSegs(v) {
  return String(v || "").split("،").join(" · ").split(" · ").map((x) => x.trim()).filter((x) => x);
}
function interestPairs(v) {
  const out = [];
  interestSegs(v).forEach((t) => {
    const i = t.lastIndexOf(":");
    if (i <= 0) return;
    const lvl = interestLevel(t.slice(i + 1));
    const product = t.slice(0, i).trim();
    if (lvl && product) out.push({ product: product, level: lvl });
  });
  return out;
}
// The segments interestPairs could NOT read. A set that parses PARTLY is the dangerous case: it
// stored the half we understood, dropped the rest, and printed «حُفظ في ملف العميل» over the loss.
// propPost() refuses that save and names these segments back to the operator.
function interestUnread(v) {
  return interestSegs(v).filter((t) => {
    const i = t.lastIndexOf(":");
    if (i <= 0) return true;
    return !(interestLevel(t.slice(i + 1)) && t.slice(0, i).trim());
  });
}
// The canonical STORED shape, mirroring tracker.formatInterest, so حقيقة and قراءة stay comparable
// strings rather than two formats that always "differ".
function interestWire(pairs) {
  return pairs.map((t) => t.product + ":" + t.level).join(" · ");
}
function dqRead(v) {
  const s = String(v || "");
  const i = s.indexOf(":");
  const key = (i < 0 ? s : s.slice(0, i)).trim();
  const rest = i < 0 ? "" : s.slice(i + 1).trim();
  const hit = DQ_REASONS.filter((r) => r[0] === key)[0];
  return hit ? hit[1] + (rest ? " · " + rest : "") : s;
}
// What «صحّح» puts in the box: the reading as a HUMAN would write it, so a correction costs one
// keystroke and never asks the operator to retype a machine string like «أشعة الأسنان:hot».
// SYMMETRY IS THE CONTRACT: interestPairs(propDraft(p)) === interestPairs(p.value). The old draft
// joined product and level with « · » — the wire form's PAIR separator — so nothing the operator
// edited could be read back. Change one side of this pair only with the other in the same edit.
function propDraft(key, p) {
  if (!p) return "";
  if (key === "productInterest") {
    const pairs = interestPairs(p.value);
    if (pairs.length) return pairs.map((t) => t.product + ": " + LV_META[t.level][1]).join("، ");
  }
  if (key === "disqualifyReason") {
    const i = String(p.value || "").indexOf(":");
    return i < 0 ? "" : String(p.value).slice(i + 1).trim();
  }
  return String(p.value || "");
}
// epoch ms -> «YYYY-MM-DD» for an <input type="date">, in Riyadh, so a late-evening moment does not
// display as the previous day. Returns "" for anything unreadable rather than a wrong date.
function isoDay(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = new Date(n + 3 * 3600e3);
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0") + "-" + String(d.getUTCDate()).padStart(2, "0");
}
// «YYYY-MM-DD» -> epoch ms at 09:00 Riyadh. A date with no time is a DAY, and 09:00 is the working
// hour a human means by it; never midnight, which reads as the day before in some clients.
function dayToMs(iso) {
  const m = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(String(iso || "").trim());
  if (!m) return undefined;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 6, 0, 0, 0);
}
function propEditorHtml(key, val, err) {
  const cap = PROP_MAX[key] || 120;
  let h = "";
  if (key === "disqualifyReason") {
    const cur = String((((profileData || {}).contact || {}).props || {})[key] ? ((profileData.contact.props)[key]).value : "");
    const at = cur.indexOf(":");
    const sel = (at < 0 ? cur : cur.slice(0, at)).trim();
    // WHAT THIS FIELD ACTUALLY DOES, said where it is written. «استبعاد» reads like suppression,
    // but nothing about outcome gates sending: outbound.checkOutbound and segments.evaluate
    // suppress on optedOut alone. Promising a stop we do not perform is the same defect class as
    // an invented number.
    h += '<div class="quote" style="margin-top:6px;">حكمنا نحن على الحساب. لا يوقف إرسال الرسائل — الإيقاف حق العميل وحده حين يكتب «إيقاف».</div>';
    // A <select> with no neutral option is PRE-ANSWERED: the browser shows the first entry, so
    // opening this editor and pressing حفظ filed «السعر» — a rejection the customer never stated,
    // signed by the operator. The first option carries an empty value, is selected whenever
    // nothing is stored, and propSave() refuses it. Nothing is filed that a human did not pick.
    // With a value stored the same empty option is the way OUT of it, so the erase path
    // decideProp has always had is finally reachable from the panel.
    h += '<select id="propsel" class="inp" style="margin-top:6px;padding:9px 12px;width:100%;">' +
      '<option value=""' + (sel ? "" : " selected") + ">" + (sel ? "— أزل الاستبعاد —" : "اختر السبب…") + "</option>" +
      DQ_REASONS.map((r) => '<option value="' + r[0] + '"' + (r[0] === sel ? " selected" : "") + ">" + r[1] + "</option>").join("") + "</select>";
  }
  h += key === "note"
    ? '<textarea id="propinp" class="inp" rows="3" maxlength="' + cap + '" style="margin-top:6px;width:100%;" onkeydown="propKey(event)" placeholder="ما لا يظهر في المحادثة: من قابلته، ما وعدت به، ما يمنع الشراء.">' + esc(val) + "</textarea>"
    : '<input id="propinp" class="inp" maxlength="' + cap + '" style="margin-top:6px;width:100%;" value="' + esc(val) + '" onkeydown="propKey(event)">';
  // FR-4 promises «نص + تاريخ اختياري», and there was no date control at all — so the operator could
  // not record WHEN, which is the third thing this whole product exists to answer, and the bad_date
  // validation in tracker.decideProp was unreachable dead code. A date input renders LTR by nature;
  // label carries the meaning in Arabic beside it.
  if (key === "nextStep") {
    const cur = (((profileData || {}).contact || {}).props || {}).nextStep;
    const dv = propEdit && propEdit.due !== undefined ? propEdit.due : (cur && cur.due ? isoDay(cur.due) : "");
    h += '<div style="display:flex;gap:8px;align-items:center;margin-top:6px;flex-wrap:wrap;">' +
      '<label for="propdue" style="font-size:11.5px;color:#7C7C7C;font-weight:600;">التاريخ (اختياري)</label>' +
      '<input id="propdue" type="date" class="inp" style="padding:8px 10px;direction:ltr;" value="' + esc(dv) + '">' +
      (dv ? '<button class="btn btn-ghost mini" onclick="propClearDue()">امسح التاريخ</button>' : "") + "</div>";
  }
  h += '<div class="cbar"><button class="btn btn-teal mini" onclick="propSave()">حفظ</button>' +
    '<button class="btn btn-ghost mini" onclick="propCancel()">إلغاء</button></div>';
  // The save that did not reach the ledger keeps the editor OPEN with the typed text in it. A
  // closed editor plus a toast is how a fact silently becomes «ناقص» again.
  if (err) h += '<div class="ferr">' + esc(err) + "</div>";
  return h;
}
function propRow(o) {
  const st = o.state;
  const mark = st === "fact" ? "h" : st === "imported" ? "i" : st === "reading" ? "a" : "m";
  const open = propEdit && propEdit.key === o.key;
  const reading = st === "reading" && !open;
  let body = '<div class="flab">' + o.label +
    (o.suffix ? ' <span style="color:#999999;font-weight:450;">' + o.suffix + "</span>" : "") + "</div>";
  if (open) {
    body += propEditorHtml(o.key, propEdit.val, propEdit.err);
  } else if (st === "missing") {
    body += '<div class="fval-m">' + o.miss + "</div>" +
      (!o.writable ? "" : o.addHref
        ? '<a class="add" href="' + o.addHref + '">' + o.add + "</a>"
        : '<button class="add" data-k="' + o.key + '" onclick="propOpen(this)">' + o.add + "</button>");
  } else {
    body += o.html + (o.support || "") + (o.sig ? '<div class="sig">' + o.sig + "</div>" : "");
    // «أكّد» is one tap and no dialog; «صحّح» opens the same editor prefilled and selected.
    if (reading && o.writable) {
      body += '<div class="cbar"><button class="btn btn-teal mini" data-k="' + o.key + '" onclick="propConfirm(this)">أكّد</button>' +
        '<button class="btn btn-ghost mini" data-k="' + o.key + '" data-sel="1" onclick="propOpen(this)">صحّح</button></div>';
    }
    // A refused agent reading is a PASSIVE line, never a competing value: the fact keeps the row.
    if (o.contested) {
      body += '<div class="quote" style="color:#B54708;">قراءة مختلفة من المساعد: «' + esc(o.contested.value) + "»</div>" +
        (o.writable ? '<div class="cbar"><button class="btn btn-ghost mini" data-k="' + o.key + '" data-use="c" onclick="propConfirm(this)">اعتمدها</button>' +
          '<button class="btn btn-ghost mini" data-k="' + o.key + '" onclick="propConfirm(this)">تجاهل</button></div>' : "");
    }
  }
  const pen = open ? ""
    : '<button class="pen" data-k="' + o.key + '" onclick="propOpen(this)" aria-label="تعديل ' + o.label + '"' +
      (o.writable ? "" : ' disabled title="التعديل معطّل: قاعدة البيانات غير متصلة."') + ">&#9998;</button>";
  return '<div class="frow' + (reading ? " rdrow" : "") + (propFlash === o.key ? " fsaved" : "") + '">' +
    pmSpan(mark, "") + '<div class="fbody">' + body + "</div>" + pen + "</div>";
}
// ملف الحساب — the ACCOUNT graph (cycle account-graph, 2026-08-18).
//
// The founder: «does the agent know the potential client needs HIS or ERP? because it asks
// clients.» It did not, because nothing populated the account registry. Now imports, operators and
// the customer's own answers all write typed facts onto the entity — and this panel is the half
// that makes them visible: a fact the agent states to a customer that no human can see is the same
// defect as a value the system writes but cannot read back.
//
// Read-only in this increment, on purpose: the write door exists (POST /admin/entity/facts) and is
// exercised by the agent, but the inline editor is a separate slice. The panel says so rather than
// showing a pencil that does nothing.
var ACC_LABELS = {
  systemKind: "نوع النظام المستخدم", hisName: "نظام الـHIS", erpName: "نظام الـERP",
  branches: "عدد الفروع", hisArchitecture: "بنية النظام", integrationStatus: "حالة التكامل",
  currentProducts: "الخدمات المستخدمة حاليًا", transactionVolume: "حجم العمليات المقاس",
  usageLevel: "مستوى الاستخدام", manualUsage: "ما زال يدويًا", customerType: "نوع الجهة",
  technicalNotes: "ملاحظات تقنية", blocker: "ما الذي يمنع المضي", customerName: "اسم الجهة",
  pricing: "التسعير المعتمد لهذا الحساب", approvedDiscountRange: "هامش الخصم المعتمد",
  contractStatus: "حالة العقد",
};
// The discovery ladder, in ask-order — mirrored from facts.ts GAP_ORDER and asserted equal by
// scripts/check-facts.mjs, so the rows an operator sees are the questions the agent may still ask.
var ACC_LADDER = ["systemKind", "hisName", "branches", "hisArchitecture", "integrationStatus", "blocker"];
var ACC_EXTRA = ["erpName", "customerType", "currentProducts", "transactionVolume", "usageLevel",
  "manualUsage", "pricing", "contractStatus", "technicalNotes"];
function accSig(f) {
  var when = f.ts ? " · " + fmtD(f.ts) : "";
  if (f.source !== "human") return "من كلام العميل" + when + (f.said ? " · «" + esc(String(f.said).slice(0, 60)) + "»" : "");
  if (f.by === "import") return "من ملف الاستيراد" + when;
  return "سجّلها " + esc(f.by || "اللوحة") + when;
}
function vAccountPanel(d) {
  var e = d.entity || null;
  var f = (e && e.facts) || {};
  var known = ACC_LADDER.filter(function (k) { return f[k] && f[k].value; }).length;
  var rows = ACC_LADDER.concat(ACC_EXTRA.filter(function (k) { return f[k] && f[k].value; }));
  var h = '<div class="card" style="margin:14px 0 0;">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
    '<h3 style="margin:0;">ملف الحساب</h3>' +
    (known === ACC_LADDER.length
      ? '<span class="chip c-teal">نطاق التكامل مكتمل</span>'
      : '<span class="chip c-warn">يعرف ' + fmtN(known) + " من " + fmtN(ACC_LADDER.length) + " من نطاق التكامل</span>") +
    "</div>" +
    '<div style="font-size:11.5px;color:#7C7C7C;margin:6px 0 4px;line-height:1.8;">' +
    "ما يظهر هنا يعرفه المساعد ولا يسأل عنه. وما هو ناقص هو وحده ما يجوز أن يسأل عنه." + "</div>";
  if (!e) {
    return h + '<div class="fval-m">لا سجل جهة لهذا الرقم بعد، فلا يستطيع المساعد حفظ ما يقوله العميل عن نظامه. ' +
      '<a href="#customers" style="color:#2E7D77;font-weight:700;">→ جهات الاستهداف</a></div></div>';
  }
  h += '<div class="plgnd"><span class="i">' + pmSpan("h", "margin:0") + "بخط الفريق</span>" +
    '<span class="i">' + pmSpan("i", "margin:0") + "مستورد</span>" +
    '<span class="i">' + pmSpan("a", "margin:0") + "من كلام العميل</span>" +
    '<span class="i">' + pmSpan("m", "margin:0") + "ناقص</span></div>";
  rows.forEach(function (k) {
    var v = f[k];
    var mark = !v ? "m" : v.source !== "human" ? "a" : v.by === "import" ? "i" : "h";
    var body = '<div class="flab">' + ACC_LABELS[k] + "</div>";
    if (!v) body += '<div class="fval-m">لم يُعرف بعد — المساعد مصرّح له بالسؤال عنه.</div>';
    else body += '<div class="fval' + (v.source === "human" ? "" : " fval-a") + '">' + esc(v.value) + "</div>" +
      '<div class="sig">' + accSig(v) + "</div>" +
      (v.contested
        ? '<div class="quote" style="color:#B54708;">قراءة مختلفة من المساعد: «' + esc(v.contested.value) + "»</div>"
        : "");
    h += '<div class="frow">' + pmSpan(mark, "") + '<div class="fbody">' + body + "</div></div>";
  });
  return h + "</div>";
}
function vFactsPanel(d) {
  const c = d.contact || {};
  const ins = d.insights || {};
  // NFR-3 made visible: with no reachable ledger a save CANNOT persist, so the pencils are disabled
  // with the reason stated rather than offering a green save that will 503.
  const w = d.propsWritable !== false;
  const gaps = propGapCount(d);
  const S = (k) => propState(d, k);
  let h = '<div class="card" style="margin:0;">' +
    '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
    '<h3 style="margin:0;">ملف العميل</h3>' +
    // S2 — the chip read «ناقص ٥» above SIX visibly dashed rows, because سبب الاستبعاد is shown and
    // deliberately not counted. He checks a number against what he can see within seconds, so the
    // denominator is named here and the uncounted row says «· اختياري» below. The count and the
    // rows agree now without pretending an un-excluded customer is a gap.
    (gaps ? '<span class="chip c-warn">ناقص ' + fmtN(gaps) + " من " + fmtN(GAP_KEYS.length) + " حقول أساسية</span>"
          : '<span class="chip c-teal">الحقول الأساسية مكتملة</span>') + "</div>" +
    '<div style="font-size:11.5px;color:#7C7C7C;margin:6px 0 4px;line-height:1.8;">ما تكتبه هنا لا يستطيع المساعد تغييره.</div>' +
    '<div class="plgnd"><span class="i">' + pmSpan("h", "margin:0") + "بخط الفريق</span>" +
    '<span class="i">' + pmSpan("a", "margin:0") + "قراءة المساعد</span>" +
    '<span class="i">' + pmSpan("i", "margin:0") + "مستورد</span>" +
    '<span class="i">' + pmSpan("m", "margin:0") + "ناقص</span></div>" +
    (w ? "" : '<div class="ferr">التعديل معطّل: قاعدة البيانات غير متصلة.</div>');

  // 1 · صاحب القرار — human-only this increment (plan OQ-1): the agent may not infer a person.
  const s1 = S("decisionMaker"), p1 = s1.prop;
  h += propRow({ key: "decisionMaker", label: "صاحب القرار", state: s1.state, writable: w,
    html: '<div class="fval' + (s1.state === "fact" ? "" : " fval-a") + '">' + esc(p1 ? p1.value : "") + "</div>",
    sig: p1 ? propSig(p1) : "", contested: p1 && p1.contested ? p1.contested : null,
    miss: "لم يُسجَّل صاحب القرار بعد.", add: "أضِف الاسم والصفة" });

  // 2 · المنشأة — imported, and a human overwrite outranks the import file.
  const s2 = S("orgProfile"), p2 = s2.prop, ent = d.entity;
  const entTxt = ent ? [ent.name].concat(Object.keys(ent.attrs || {}).map((k) => ent.attrs[k])).filter((x) => x).join(" · ") : "";
  h += propRow({ key: "orgProfile", label: "المنشأة", state: s2.state, writable: w,
    html: '<div class="fval' + (s2.state === "fact" ? "" : " fval-a") + '">' + esc(p2 ? p2.value : entTxt) + "</div>",
    sig: p2 ? propSig(p2) : (ent ? "من ملف الاستيراد · يمكنك تصحيحه" : ""),
    contested: p2 && p2.contested ? p2.contested : null,
    miss: "غير مستورد في القوائم.", add: "→ استورد القائمة", addHref: "#customers" });

  // 3 · الاهتمام — one chip PER PRODUCT, never averaged: two hot products are two deals.
  const s3 = S("productInterest"), p3 = s3.prop;
  const pairs = p3 ? interestPairs(p3.value) : [];
  // When the property exists it IS this field. Falling back to c.tags BEHIND a stored value is how
  // the agent's tags ended up rendered under a human signature; the tags follow the typed set now
  // (propPost), so there is nothing left to fall back to.
  // Deduped by product, strongest level wins. c.tags holds one row PER READING EVENT, so a product
  // the agent read twice rendered as two identical chips — visible on a real record.
  const tagList = p3 ? pairs : (() => {
    const rank = { hot: 3, warm: 2, cold: 1 };
    const best = new Map();
    (c.tags || []).forEach((t) => {
      const cur = best.get(t.product);
      if (!cur || (rank[t.level] || 0) > (rank[cur.level] || 0)) best.set(t.product, { product: t.product, level: t.level });
    });
    return [...best.values()];
  })();
  // A human fact never lends its styling to chips it did not produce: solid requires BOTH that a
  // human wrote this field AND that these chips were parsed out of what he wrote.
  const solid = s3.state === "fact" && pairs.length > 0;
  let i3 = "";
  if (tagList.length) {
    i3 = '<div style="margin-top:5px;display:flex;gap:6px;flex-wrap:wrap;">' + tagList.map((t) => {
      const m = LV_META[t.level] || LV_META.warm;
      return '<span class="chip ' + (solid ? "" : "c-read ") + m[0] + '">' +
        (solid ? "" : '<span class="rd">قراءة</span>') + esc(t.product) + " · " + m[1] + "</span>";
    }).join(" ") + "</div>";
  } else if (p3) {
    // Free text the parser cannot read is still a human fact — it just is not a chip set, so it
    // reads from the state, not from solid.
    i3 = '<div class="fval' + (s3.state === "fact" ? "" : " fval-a") + '">' + esc(p3.value) + "</div>";
  }
  const sig3 = (ins.signals || [])[0];
  h += propRow({ key: "productInterest", label: "الاهتمام", state: s3.state, writable: w,
    html: i3, sig: p3 ? propSig(p3) : (tagList.length ? "قراءة المساعد" : ""),
    support: s3.state === "reading" ? (sig3 ? '<div class="quote">من قوله: «' + esc(sig3) + "»</div>"
      : '<div class="quote">بلا اقتباس يسندها بعد.</div>') : "",
    contested: p3 && p3.contested ? p3.contested : null,
    miss: "لم يُسجَّل اهتمام بعد.", add: "سجّل الاهتمام" });

  // 4 · الخطوة التالية — TWO marks on purpose: the customer's sentence is a fact, our parse of it
  // is not. That distinction is the whole reason this panel exists.
  const s4 = S("nextStep"), p4 = s4.prop;
  // M1/M3 — ONE appointment, read through the one reader. The date used to render ONLY when the row
  // was a machine READING, so the assistant's guess at the day was on screen and the day the
  // OPERATOR confirmed was on no screen at all — backwards from this panel's whole thesis.
  const ap4 = appt(c);
  const said = c.scheduledSaid
    ? '<div style="display:flex;gap:8px;align-items:flex-start;margin-top:5px;">' + pmSpan("h", "margin-top:5px") +
      '<div class="quote" style="margin:0;">قال العميل: «' + esc(c.scheduledSaid) + "»</div></div>" : "";
  // A confirmed day is a FACT and gets the fact's mark and the fact's signature — and the DAY only.
  // dayToMs stores 09:00 Riyadh so a bare date has an hour to sort by; printing that hour back
  // would put a time nobody typed under a human's name. The agent's reading keeps its own
  // «قراءتنا: … · لم تُؤكَّد بعد» treatment, unchanged, including the hour it actually parsed.
  const parsed = !ap4
    ? (s4.state === "reading" ? '<div class="quote" style="color:#B54708;">قراءتنا لم تُؤكَّد بعد.</div>' : "")
    : ap4.confirmed
      ? '<div style="display:flex;gap:8px;align-items:flex-start;margin-top:5px;">' + pmSpan("h", "margin-top:5px") +
        '<div style="margin:0;font-size:12.5px;font-weight:700;color:#171717;">الموعد: ' + esc(fmtDay(ap4.at)) +
        (ap4.by ? " · سجّله " + esc(ap4.by) : "") + "</div></div>"
      : '<div class="quote" style="color:#B54708;">قراءتنا: ' + fmtD(ap4.at) + " " + fmtT(ap4.at) + " · لم تُؤكَّد بعد</div>";
  h += propRow({ key: "nextStep", label: "الخطوة التالية", state: s4.state, writable: w,
    html: '<div class="fval' + (s4.state === "fact" ? "" : " fval-a") + '">' + esc(p4 ? p4.value : (c.scheduledSaid || "")) + "</div>",
    support: said + parsed, sig: p4 ? propSig(p4) : "",
    contested: p4 && p4.contested ? p4.contested : null,
    miss: "لا خطوة تالية محددة.", add: "حدّد الخطوة" });

  // 5 · ملاحظة — human-only by contract (FR-5); it never reaches the agent's context at all.
  const s5 = S("note"), p5 = s5.prop;
  h += propRow({ key: "note", label: "ملاحظة", suffix: "· بخط الفريق فقط", state: s5.state, writable: w,
    html: '<div class="fval" style="font-weight:600;">' + esc(p5 ? p5.value : "") + "</div>",
    sig: p5 ? propSig(p5) : "", contested: null,
    miss: "لا ملاحظات. اكتب ما لا يظهر في المحادثة.", add: "أضِف ملاحظة" });

  // 6 · سبب الاستبعاد — shown, never counted as a gap.
  const s6 = S("disqualifyReason"), p6 = s6.prop;
  h += propRow({ key: "disqualifyReason", label: "سبب الاستبعاد", suffix: "· اختياري", state: s6.state, writable: w,
    html: '<div class="fval' + (s6.state === "fact" ? "" : " fval-a") + '">' + esc(p6 ? dqRead(p6.value) : "") + "</div>",
    sig: p6 ? propSig(p6) : "", contested: p6 && p6.contested ? p6.contested : null,
    // «استبعد هذا العميل…» promised a stop. This records a judgement and moves the outcome; it
    // sends nothing and it stops nothing (outbound.ts §36, segments.ts §163 suppress on optedOut).
    miss: "لم يُسجَّل سبب استبعاد.", add: "سجّل سبب الاستبعاد…" });

  return h + "</div>";
}

function vCustomer(ph) {
  if (!profileData || profilePhone !== ph) {
    return '<div class="empty"><div class="ic"><span></span></div><div class="t">جارٍ تجميع ملف العميل…</div><div class="s">السجل، قراءة المساعد، وقراءة الحوار.</div></div>';
  }
  if (profileData.failed) {
    return '<div class="empty"><div class="ic"><span></span></div><div class="t">تعذّر فتح ملف العميل</div>' +
      '<div class="s">استجابة الخادم: ' + esc(String(profileData.status)) + '. ' +
      '<a href="javascript:void(0)" onclick="reloadProfile()" style="color:#2E7D77;font-weight:700;">إعادة المحاولة</a></div></div>';
  }
  if (profileData.missing) {
    return '<div class="empty"><div class="ic"><span></span></div><div class="t">لا محادثة لهذا الرقم بعد</div><div class="s">يظهر ملف العميل بعد أول رسالة واتساب. <a href="#customers" style="color:#2E7D77;font-weight:700;">→ جهات الاستهداف</a></div></div>';
  }
  // «d.context» is NOT read here any more (design plan §5): contextScore is a 0-100 invented
  // score over fields we happen to hold, and it read FULL on a contact whose only sentence was
  // «ماني مهتم». ملف العميل replaces it with a count of named gaps that an operator can close.
  const d = profileData; const c = d.contact; const ins = d.insights || {};
  const nm = c.waName || (d.entity && d.entity.name) || "غير معروف";
  let h = '<a href="javascript:history.back()" style="display:inline-block;font-size:12.5px;font-weight:700;color:#171717;text-decoration:none;margin-bottom:14px;">→ رجوع</a>';
  h += '<div class="card" style="display:flex;gap:18px;align-items:stretch;flex-wrap:wrap;">' +
    '<div style="flex:1;min-width:260px;display:flex;gap:14px;align-items:flex-start;">' +
    // Monogram deleted: a 52px tile showing one letter of a name printed beside it.
    /* STATUS BELONGS IN THE HEADER, beside the name — Frappe puts a status control there because it
       is the first thing anyone needs to know about a lead. Ours was buried in a band further down,
       which the conversation slide-over then covered entirely. */
    '<div style="flex:1;min-width:0;">' +
    '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">' +
    '<div style="font-size:18px;font-weight:600;color:#171717;">' + esc(nm) + "</div>" +
    (function () {
      const OM = { interested:["مهتم","#027A48"], scheduled:["موعد محدَّد","#1F7A73"],
        handoff:["تحويل لمندوب","#2F5F94"], later:["لاحقًا","#B54708"],
        not_interested:["غير مهتم","#7C7C7C"], closed:["مغلق","#7C7C7C"],
        stopped:["أوقف الرسائل","#B42318"], opted_out:["ألغى الاشتراك","#B42318"] };
      const o = c.optedOut ? OM.opted_out : (OM[c.outcome || ""] || ["جديد", "#C7C7C7"]);
      return '<span class="chip" style="font-size:12.5px;padding:4px 10px;">' +
        '<span style="width:7px;height:7px;border-radius:999px;flex:none;background:' + o[1] + ';"></span>' +
        o[0] + "</span>";
    })() +
    (c.test ? ' <span class="chip">تجريبي</span>' : "") +
    (c.human ? ' <span class="chip c-warn">بيد البشر</span>' : "") + "</div>" +
    '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">' +
    (d.entity ? attrChips(d.entity, 4) : '<span class="chip c-grey">غير مستورد في القوائم</span>') +
    // «واتساب ✓» deleted: every contact on this screen arrived by WhatsApp, so the chip carries no
    // information. Designer's call.
    "</div>" +
    '<div style="font-size:12px;color:#7C7C7C;margin-top:8px;direction:ltr;text-align:right;">+' + esc(c.phone) + "</div>" +
    // «أول ظهور» deleted — it never changed a decision. Last activity stays: it tells you whether
    // this person is warm right now.
    '<div style="font-size:11px;color:#999999;margin-top:4px;">آخر نشاط: ' + fmtT(c.lastEventAt) + "</div>" +
    // PROVENANCE, not analytics. These used to be a row of identical blue chips in arbitrary
    // order, so the founder could not say which campaign started the conversation in front of him.
    // The payload now arrives newest-first with launch times: the most recent is stated as a
    // sentence, and the rest are demoted to history rather than shown as peers. No percentages, no
    // scope selector — campaign PERFORMANCE lives one screen away at #kmon/<id>, and this line
    // exists so he can name the source out loud, not so he can compute anything here.
    ((d.campaigns || []).length ? (function () {
      const cps = d.campaigns;
      const real = cps.filter((x) => !x.test);
      const testN = cps.length - real.length;
      const scoped = profileCampaign ? cps.filter((x) => String(x.id) === String(profileCampaign))[0] : null;
      const first = scoped || real[0] || cps[0];
      if (!first) return "";
      const when = fmtD(campWin({ created_at: first.created_at }));
      const known = when && when !== "—";
      // ONE campaign is named. Everything else is a COUNT, so the line cannot grow — it read as a
      // comma-joined wall of 20+ names on any contact used for testing.
      const others = (scoped ? cps.length : real.length) - 1;
      return '<div style="margin-top:10px;font-size:12.5px;color:#525252;line-height:1.7;">' +
        (scoped ? "مقصور على حملة: " : "بدأت هذه المحادثة من: ") +
        '<a href="#customer/' + esc(c.phone) + "/" + first.id + '" style="color:#2E7D77;font-weight:700;text-decoration:none;">' +
        esc(String(first.name).slice(0, 40)) + "</a>" +
        (known ? ' <span style="color:#999999;">· ' + esc(when) + "</span>"
               : ' <span style="color:#999999;">· وقت الإطلاق غير مقروء، فلا تُنسب أرقام لهذه الحملة</span>') +
        (others > 0 ? ' <span style="color:#999999;">· وسبقتها ' + fmtN(others) + " حملة</span>" : "") +
        (testN > 0 && showTest ? ' <span style="color:#999999;">(+' + fmtN(testN) + " تجريبية)</span>" : "") +
        (scoped ? ' <a href="#customer/' + esc(c.phone) + '" style="color:#999999;text-decoration:underline;">عرض كل التاريخ</a>' : "") +
        (!real.length && cps.length ? '<div style="margin-top:5px;font-size:11.5px;color:#999999;">لا حملة فعلية بعد — الحملات التجريبية مخفية.</div>' : "") +
        "</div>";
    })() : "") +
    "</div></div>" +
    // THE CONVERSATION, not a checklist of fields. The old gauge scored what we hold on file —
    // a name, an import match, a file we sent — so it read full on a contact whose only real
    // sentence was «ماني مهتم لا تتصل علي». A percentage also implies a ceiling the conversation can
    // reach; there is none. This reports counts, whose turn it is, and the customer's own words.
    // The engagement column is DELETED. «كلمة من العميل» with a progress bar implied a ceiling
    // that does not exist, «العميل ٢٥ · المساعد ٣٣» is not a sales signal, and the voice field picked the
    // LONGEST customer message as their representative line — which is why «مافهمت خلاص كنسل», a
    // complaint, was being displayed as this customer's highlight. The outcome strip above shows a
    // quote sourced to the DECISION instead of to length. Whose turn it is survives, in one line.
    (function () {
      const it = d.interaction || {};
      const turn = it.lastSpeaker === "agent" ? "الدور على العميل" : it.lastSpeaker === "customer" ? "الدور على المساعد" : "";
      const idle = it.hoursSinceCustomer !== null && it.hoursSinceCustomer !== undefined
        ? " · آخر كلام منه قبل " + esc(arAgo(it.hoursSinceCustomer)) : "";
      return turn ? '<div style="font-size:11.5px;color:#999999;margin-top:6px;">' + turn + idle + "</div>" : "";
    })() +
    "</div></div>";
  // Was matching «نتيجة موثقة يدويًا» — a string NOTHING writes, so the current-state highlight
  // had never rendered once. The outcome now lives on the contact in one vocabulary, written by
  // both the agent and the portal buttons, so read it from there instead of parsing prose.
  // BUILT HERE, ABOVE the status-region marker comment below, and spliced into the record grid
  // further down. This comment must NOT repeat that marker string: check-outcomes.mjs locates the
  // region with indexOf, so a second copy of it here would move the window start and push the
  // twelve strings it pins past the 5200-char slice. Nothing may be inserted between that marker
  // and the end of the region either, for the same reason (plan R6). Measured, not assumed.
  const factsPanel = vFactsPanel(d);
  const OUT_TO_BTN = { scheduled: "meeting_booked", interested: "quote_sent", later: "postponed", stopped: "not_a_fit" };
  const activeBtn = OUT_TO_BTN[c.outcome] || "";
  // CRM STATUS REGION — outcome, then interest, then stage. Ranked deliberately: outcome is a
  // fact that decides whether he acts at all; interest names WHICH product and how hot, which
  // decides what he says; stage is an inference over the same transcript and changes neither.
  // Facts outrank readings.
  //
  // The bug this fixes: vCustomer never read the tags array at all. The customers TABLE he clicks FROM
  // renders the real tool-written tags via interestChips(), while the RECORD showed only the AI's
  // product_interest inference — the row carried more truth than the record it opened.
  h += (function () {
    const OUT = {
      scheduled: ["موعد محدد", "#027A48", "#ECFDF3"],
      interested: ["مهتم", "#2F5F94", "#EFF6FF"],
      later: ["مؤجل", "#B54708", "#FFFAEB"],
      stopped: ["لا يرغب في التواصل", "#B42318", "#FEF3F2"],
      not_interested: ["لا يرغب في التواصل", "#B42318", "#FEF3F2"],
      handoff: ["بانتظار المختص", "#B54708", "#FFFAEB"],
      opted_out: ["أوقف الرسائل", "#B42318", "#FEF3F2"],
      closed: ["مغلق", "#7C7C7C", "#F3F3F3"],
    };
    const o = OUT[c.outcome] || null;
    const ink = o ? o[1] : "#7C7C7C", bg = o ? o[2] : "#F8F8F8";
    const row = (label, body) =>
      '<div style="display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-top:9px;">' +
      '<span style="font-size:11px;font-weight:700;letter-spacing:.04em;color:#7C7C7C;min-width:92px;">' + label + "</span>" +
      '<span style="flex:1;min-width:180px;">' + body + "</span></div>";

    // 1 — OUTCOME
    let outBody = '<span style="font-size:13px;font-weight:700;color:' + ink + ';">' + (o ? o[0] : "لم يُفرز بعد") + "</span>";
    if (c.outcome === "scheduled" && c.scheduledSaid) {
      // M3 — this line appended «لم تُؤكَّد بعد» UNCONDITIONALLY, so an appointment a human had
      // confirmed 200px below read as unconfirmed forever. It reads the ONE appointment now, and
      // «مؤكَّد» is a state the sentence finally has a form for.
      const ap = appt(c);
      outBody += '<div style="font-size:13px;font-weight:700;color:#171717;margin-top:3px;">قال العميل: «' + esc(c.scheduledSaid) + "»</div>" +
        '<div style="font-size:11.5px;color:' + (ap && ap.confirmed ? "#027A48;font-weight:700;" : "#7C7C7C;") + '">' +
        (!ap ? "قراءتنا: لم نتمكن من قراءة تاريخ من هذه العبارة — أكّده مع العميل."
          : ap.confirmed ? "مؤكَّد: " + esc(fmtDay(ap.at)) + (ap.by ? " · سجّله " + esc(ap.by) : "")
          : "قراءتنا: " + esc(fmtT(ap.at)) + " · لم تُؤكَّد بعد") + "</div>";
    } else if (c.outcomeEvidence) {
      outBody += '<div style="font-size:12.5px;color:#525252;margin-top:3px;">لأنه قال: «' + esc(String(c.outcomeEvidence).slice(0, 130)) + "»</div>";
    }

    // 2 — INTEREST, one chip PER PRODUCT. Never averaged: two hot products are two deals, not a
    // hotter one. Falls back to the AI reading only when no tag exists, and says so.
    const lv = { hot: ["c-ok", "نية مرتفعة"], warm: ["c-warn", "مهتم"], cold: ["c-grey", "فاتر"] };
    const latest = new Map();
    (c.tags || []).forEach((tg) => latest.set(tg.product, tg));
    const order = { hot: 0, warm: 1, cold: 2 };
    const tagList = [...latest.values()].sort((a, b) => (order[a.level] ?? 3) - (order[b.level] ?? 3) || (b.ts || 0) - (a.ts || 0));
    let interestBody;
    if (tagList.length) {
      interestBody = tagList.map((tg) => {
        const m = lv[tg.level] || lv.warm;
        return '<span class="chip ' + m[0] + '">' + esc(tg.product) + " · " + m[1] + "</span>";
      }).join(" ");
    } else if (ins.intent && ins.intent !== "none") {
      const rd = ins.intent === "high" ? ["c-ok", "نية مرتفعة"] : ins.intent === "medium" ? ["c-warn", "اهتمام مبدئي"] : ["c-grey", "فاتر"];
      interestBody = '<span class="chip c-read ' + rd[0] + '"><span class="rd">قراءة</span>' + rd[1] + "</span>" +
        '<div style="font-size:11.5px;color:#999999;margin-top:3px;">لا وسم اهتمام مؤكد بعد — هذه قراءة المساعد من نص المحادثة.</div>';
    } else {
      interestBody = '<span style="color:#999999;font-size:12px;">لم يُسجَّل اهتمام بعد.</span>';
    }

    // 3 — STAGE, one chip. An unjustified reading renders visibly WEAKER than a justified one:
    // stage_reason is empty on live data because the scrub removed a claim the customer never made.
    // The STAGES list and its index are GONE with the ordinal: naming a position implies a rail,
    // and a rail paints stages nobody reached. The stage is a reading, shown once, unranked.
    let stageBody;
    if (ins.stage) {
      const justified = Boolean(ins.stage_reason);
      stageBody = '<span class="chip ' + (justified ? "c-teal" : "c-grey") + '">' + esc(ins.stage) +
        "</span>" +
        (justified
          ? '<div style="font-size:12.5px;color:#525252;margin-top:3px;line-height:1.9;">' + esc(ins.stage_reason) + "</div>"
          : '<div style="font-size:11.5px;color:#999999;margin-top:3px;">قراءة المساعد — بلا اقتباس يسندها بعد. ' +
            '<a href="javascript:void(0)" onclick="refreshInsights()" style="color:#2E7D77;font-weight:700;">حدّث القراءة</a></div>');
    } else {
      stageBody = '<span style="color:#999999;font-size:12px;">لم تتحدد المرحلة بعد.</span>';
    }

    /* neutral surface: the tint was the last coloured band on this record (DESIGN.md §2) */
    return '<div style="background:#fff;border:1px solid #EDEDED;border-inline-start:3px solid ' + ink +
      ';border-radius:10px;padding:13px 16px;margin:2px 0 14px;">' +
      row("الفرز", outBody) + row("درجة الاهتمام", interestBody) + row("مرحلة البيع", stageBody) + "</div>";
  })();
  /* The actions floated loose between sections with no container, which is most of why this page
     read as unorganised. They belong in one bounded toolbar, as Frappe's record header does. */
  /* Two groups with a real gap, not eight controls in one row. The outcome buttons are the
     operator's actual job here, so they get their own labelled cluster instead of being squeezed
     against «فتح المحادثة» with the label wedged between them. */
  h += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin:2px 0 16px;align-items:center;background:#fff;border:1px solid #EDEDED;border-radius:10px;padding:10px 14px;">' +
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
    /* «فتح المحادثة» is GONE: المحادثة is a tab on this record now, so the slide-over duplicated it
       and covered the status region while doing so. One action, one place. */
    '<button id="insbtn" class="btn btn-ghost" onclick="refreshInsights()">تحديث قراءة المساعد</button></div>' +
    '<span style="flex:1;min-width:8px;"></span>' +
    '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">' +
    '<span style="font-size:12px;color:#7C7C7C;white-space:nowrap;">سجّل النتيجة الفعلية</span>' +
    [["meeting_booked", "اجتماع محجوز", "#027A48"], ["quote_sent", "عرض مُرسَل", "#2F5F94"], ["postponed", "مؤجل", "#B54708"], ["not_a_fit", "غير مناسب", "#7C7C7C"]]
      .map((o) => '<button class="ptab' + (activeBtn === o[0] ? " on" : "") + '" data-ph="' + esc(c.phone) + '" data-out="' + o[0] + '" onclick="setOutcome(this)">' + o[1] + "</button>").join("") + "</div></div>";
  // The 6-node sales-path rail is DELETED from the record (design-plan.md section 5): it paints
  // five stages nobody reached and a check mark nobody verified. The stage now appears exactly
  // once, as a reading, inside the status region. The renderer itself is gone too, so no future
  // edit can re-call it; scripts/check-outcomes.mjs bans the identifier.
  // §1 region map. DOM order is panel THEN main, so the 372px track lands on the RIGHT — the
  // start side in RTL — and collapses at 900 with ملف العميل above فهم المساعد, deliberately:
  // what the team recorded outranks what the model inferred.
  h += '<div class="crec">' + factsPanel + vAccountPanel(d) + '<div class="crecmain">';
  // فهم المساعد
  h += '<div class="card rise" style="margin:0;">' +
    // The intent badge is DELETED here: interest already renders in the status strip and, with
    // provenance, in ملف العميل. The hollow .pm-a mark replaces it and says what this card is.
    '<div style="display:flex;align-items:center;gap:8px;">' + pmSpan("a", "margin:0") + '<h3 style="margin:0;color:#171717;font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px;">' + ic("spark", 19, "#1F7A73") + "فهم المساعد</h3></div>" +
    '<div style="font-size:11px;color:#7C7C7C;margin-top:6px;">كل ما في هذه البطاقة قراءة، لا حقيقة مسجّلة.</div>';
  if (ins.learning) {
    // S4 — the product_interest badge row is DELETED here too. §5 deleted it from the other branch
    // only, so the third, unsourced rendering of interest survived in the state a brand-new
    // conversation actually lands in. Enumerate STATES, not just screens.
    h += '<div style="font-size:13px;color:#525252;line-height:2;margin-top:12px;">' + esc(ins.summary) + "</div>" +
      '<div style="font-size:11.5px;color:#7C7C7C;margin-top:12px;line-height:1.9;">كل رسالة جديدة تجعل القراءة أدق — كما في مرحلة «Learning…».</div>';
  } else {
    h += '<div style="background:#fff;border:1px solid #E3EBF3;border-radius:13px;padding:15px 16px;margin-top:14px;">' +
      '<div style="font-size:10.5px;font-weight:700;color:#1F7A73;margin-bottom:7px;">الخلاصة</div>' +
      '<div style="font-size:14px;font-weight:700;color:#171717;line-height:1.95;">' + esc(ins.summary || "") + "</div></div>";
    // DELETED (design plan §5): the 2×2 mcards grid and the product_interest badge row.
    // «القناة المفضّلة: واتساب» is a constant on a WhatsApp-only platform, and «نية الشراء»,
    // «حكم الصفقة» and the interest badges each rendered a THIRD and FOURTH time on this one
    // page — the status strip and ملف العميل already carry them, and carry them with a source.
    if ((ins.signals || []).length) h += '<div style="margin-top:12px;"><div style="font-size:11px;font-weight:700;color:#7C7C7C;margin-bottom:6px;">إشارات الشراء</div>' + ins.signals.map((sg) => '<div style="font-size:12px;color:#383838;line-height:1.9;">« ' + esc(sg) + ' »</div>').join("") + "</div>";
    if ((ins.objections || []).length) h += '<div style="margin-top:10px;"><div style="font-size:11px;font-weight:700;color:#7C7C7C;margin-bottom:6px;">اعتراضات</div>' + ins.objections.map((ob) => '<div style="font-size:12px;color:#8a5a2b;line-height:1.9;">· ' + esc(ob) + "</div>").join("") + "</div>";
    const dm = DEAL_META[ins.deal_state || "active"] || DEAL_META.active;
    h += '<div style="display:flex;align-items:center;gap:8px;margin-top:12px;">' +
      '<span class="chip" style="background:' + dm[2] + ';color:' + dm[1] + ';font-size:12px;padding:6px 14px;">حكم الصفقة: ' + dm[0] + "</span>" +
      (ins.loss_cause ? '<span class="chip c-bad">السبب: ' + esc(ins.loss_cause) + "</span>" : "") + "</div>" +
      // Only when it differs from c.outcomeEvidence: the same sentence printed twice on one
      // screen reads as two independent pieces of evidence for the same claim.
      // …and only when it actually SAYS something. Live data carries evidence === "»" — a single
      // guillemet — which rendered as «الدليل: « » »: the assistant's proof of its own verdict was
      // one punctuation mark. A quote with no letters in it is not a quote; hasWords is the floor.
      (hasWords(ins.evidence) && String(ins.evidence).trim() !== String(c.outcomeEvidence || "").trim()
        ? '<div style="font-size:11.5px;color:#7C7C7C;margin-top:7px;line-height:1.8;">الدليل: « ' + esc(ins.evidence) + ' »</div>' : "") +
      (ins.fix_suggestion && (ins.deal_state === "lost" || ins.deal_state === "stalled") ? '<div style="font-size:12px;color:#B54708;margin-top:6px;line-height:1.8;font-weight:600;">ما كان سيرجّح الكسب: ' + esc(ins.fix_suggestion) + "</div>" : "");
    h += '<div style="margin-top:14px;background:#fff;border:1px solid #B9E4E0;border-inline-start:3px solid #2E7D77;border-radius:11px;padding:13px 15px;">' +
      // Renamed: two blocks called الخطوة التالية with different provenance — one a stored fact
      // in ملف العميل, one a model suggestion — is the exact confusion this cycle exists to kill.
      '<div style="font-size:11px;font-weight:700;color:#2E7D77;margin-bottom:5px;">اقتراح المساعد للخطوة التالية</div>' +
      '<div style="font-size:13px;font-weight:700;color:#171717;line-height:1.9;">' + esc(ins.next_action || "") + "</div>" +
      (ins.why ? '<div style="font-size:11.5px;color:#525252;margin-top:5px;line-height:1.9;">' + esc(ins.why) + "</div>" : "") +
      (ins.best_time ? '<div style="font-size:11.5px;color:#2E7D77;font-weight:600;margin-top:7px;">وقت التواصل: ' + esc(ins.best_time) + "</div>" : "") + "</div>";
  }
  h += "</div>";
  // timeline
  h += '<div class="card" style="margin:0;"><h3 style="margin:0 0 4px;">سجل التفاعل</h3>' +
    '<div style="font-size:11px;color:#999999;margin-bottom:10px;">كل نقاط التماس — رسائل، حالات تسليم، وسوم، ملفات — الأحدث أولًا</div>' +
    '<div class="ms-scroll" style="max-height:430px;overflow-y:auto;">' +
    ((d.timeline || []).length ? d.timeline.map((ev) =>
      '<div style="display:flex;gap:13px;padding:11px 2px;position:relative;">' +
      '<span style="position:absolute;inset-inline-start:5px;top:24px;bottom:-11px;width:2px;background:#EDEDED;"></span>' +
      '<span style="width:12px;height:12px;flex:none;margin-top:5px;border-radius:999px;background:#fff;border:2.5px solid ' + tlDot(ev.kind) + ';position:relative;z-index:1;"></span>' +
      '<div style="flex:1;min-width:0;"><div style="font-size:10.5px;font-weight:700;color:' + tlDot(ev.kind) + ';">' + esc(ev.meta || "") + " · " + fmtT(ev.ts) + " · " + fmtD(ev.ts) + "</div>" +
      '<div style="font-size:12.5px;color:#171717;line-height:1.8;margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + esc(ev.title) + "</div></div></div>").join("")
      : '<div style="padding:20px;text-align:center;color:#999999;font-size:12px;">لا أحداث بعد</div>') + "</div></div>";
  h += "</div></div>";
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
window.reloadProfile = () => { profileData = null; render(false); refresh(); };

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
    showTest, campTab, campSortKey, campQ, entQ, tgtQ, tgtArm, tgtProd, oppTab, oppQ, campFilter, rQ, selProd,
    retargetCohort ? retargetCohort.targets.length : 0,
    profileData ? (profileData.contact ? profileData.contact.phone + "|" + (profileData.contact.transcript || []).length : "x") : "",
    JSON.stringify(entFilters), JSON.stringify(tgtFilters), JSON.stringify(prodFilter), [...entSel].join(","),
    JSON.stringify(PAGE), PAGE_SIZE,
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
    // campaigns-crm owns the campaigns screens. It is called behind a guard on purpose: this file's
    // client script is inside a template literal that no static tool here can parse, so a fault in
    // the new views would blank the demo screen with tsc and node --check both green (ADR-0001).
    // On any throw we fall back to the original views, which stay live for exactly that reason.
    b.innerHTML = cur === "kmon" ? crmCampaignsHtml(campId) : vHome(cache);
  } else if (cur === "customer") {
    if (!TOKEN) return gate();
    const ph = (location.hash || "").split("/")[1] || "";
    b.innerHTML = vCustomer(ph);
    // Frappe's tabbed record shell, applied to the DOM vCustomer just produced. Post-render rather
    // than a rewrite: vCustomer is 216 lines inside this template literal and ADR-0001 forbids
    // range edits here.
    setTimeout(recApplyTabs, 0);
  } else if (cur === "aimkt" || cur === "kb" || cur === "customers" || cur === "targets" || cur === "pipeline" || cur === "tasks" || cur === "notes" || cur === "opps") {
    if (!TOKEN) return gate();
    const kbProd = cur === "kb" ? decodeURIComponent((location.hash || "").split("/").slice(1).join("/") || "") : "";
    // #customers is the العملاء LIST (customers-crm); the importer moved to #targets, whose title
    // was already «جهات الاستهداف». Until this split the sidebar said العملاء and the screen showed
    // the importer, and there was no list to click a customer FROM.
    b.innerHTML = cur === "aimkt" ? vAimkt()
      : cur === "kb" ? (kbProd ? vKbProduct(kbProd) : vKb())
      : cur === "targets" ? vTargetsCrm()
      : cur === "opps" ? vMorningList()
      : cur === "pipeline" ? vActivityCrm()
      : cur === "tasks" ? vTasksCrm()
      : cur === "notes" ? vNotesCrm()
      : vCustomersCrm();
  } else {
    b.innerHTML = vPlaceholder(cur);
  }
  // The #pathNow / #pathScroll scroll-into-view went with the stage rail that produced those two
  // ids. Nothing renders them any more, so it ran on every paint and could never fire.
  // After the first paint of a route the entrance animation is noise: every keystroke re-renders
  // #body, and replaying a 420ms slide-up on each one is the jump the designer measured.
  { const cur2 = (location.hash || "").slice(1);
    if (b.dataset.routePainted === cur2) b.classList.add("norise");
    else { b.classList.remove("norise"); b.dataset.routePainted = cur2; } }
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
      // Gate on EVERY route, not just kmon/home. A stale token on a #customer deep link used to
      // fall through here: the inner condition was false, nothing returned, every later fetch
      // 401'd, profileData stayed null, and the page sat on «جارٍ تجميع ملف العميل» forever with
      // no login prompt. Measured 2026-08-16 on #customer/966535106365.
      if (r.status === 401) return gate("رمز غير صحيح");
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
        // Read the scope here too: the very first refresh() runs before any hashchange fires, so a
        // deep link into a scoped profile would otherwise load lifetime and look like the bug.
        profileCampaign = (location.hash || "").split("/")[2] || "";
        const ph = (location.hash || "").split("/")[1] || "";
        if (ph) {
          // Scope the read to ONE campaign episode when the route names it (#customer/<phone>/<campId>).
          // Without it the profile reports a LIFETIME, so a contact opened from a campaign launched
          // minutes ago shows every reply they ever sent as that campaign's result — the founder
          // could not tell which campaign a number belonged to.
          const campQ = profileCampaign ? "?campaign=" + encodeURIComponent(profileCampaign) : "";
          const pr = await fetch("/admin/customer/" + ph + campQ, { headers: { "x-admin-token": TOKEN } });
          if (pr.ok) { profileData = await pr.json(); profilePhone = ph; }
          else if (pr.status === 404) { profileData = { missing: true }; profilePhone = ph; }
          // EVERY other outcome needs a state. Leaving profileData null made the spinner permanent,
          // because nothing retries it — the 5s poll skips refresh() on this route.
          else { profileData = { failed: true, status: pr.status }; profilePhone = ph; }
        }
      }
    } catch (e) { /* keep last view */ }
  }
  render(true);
  renderConvo();
}
// ---------------------------------------------------------------------------
// ملف العميل — the write path. PER FIELD, never a whole-form edit mode: pencil → input →
// حفظ/إلغاء, Enter saves, Esc cancels. Every call goes to /admin/contact/props, which is the only
// human door onto the six properties and reaches no sender (BR-4). Nothing here can send WhatsApp.
// The operator name rides the JSON BODY as «by» — Arabic cannot travel in an HTTP header.
// ---------------------------------------------------------------------------
// M2 — «أكّد» MUST NOT NARROW THE VALUE IT CONFIRMS.
// propPost used to read #propdue straight out of the document and key the read on «nextStep». A
// confirm opens no editor, so getElementById returned null, the due came out undefined, the request
// shipped a bare string, and decideProp built a fresh prop with NO date: tapping «أكّد» on a dated
// next step DELETED the date. The most valuable action in the product was lossy, and it lost
// exactly the datum the founder's third question asks for.
//
// The fix is at the source and it is generic, so a seventh property added next quarter cannot
// re-open the hole. Two rules:
//   1. DEFAULT IS PRESERVE. Everything a stored prop carries that is not provenance is a value the
//      operator owns, and it is carried forward untouched. The closed list below is what the
//      LEDGER writes (tracker.ts Prop) — naming provenance rather than naming values means a new
//      field is preserved the day it is added, with no edit to this file.
//   2. ONLY AN OPEN EDITOR MAY CHANGE A VALUE. A control that is not on screen changes nothing.
const PROP_AUDIT = ["value", "source", "by", "ts", "prior", "contested"];
// field -> [the control that owns it while the editor is open, how to read that control].
const PROP_CTRL = { nextStep: { due: ["propdue", "day"] } };
function propCarry(key) {
  const c = (profileData || {}).contact || {};
  const stored = (c.props || {})[key] || null;
  const out = {};
  if (stored) {
    Object.keys(stored).forEach((f) => {
      if (PROP_AUDIT.indexOf(f) < 0 && stored[f] !== undefined && stored[f] !== null) out[f] = stored[f];
    });
  }
  // Not our editor open (or none at all — which is what a confirm IS): the stored value stands.
  if (!propEdit || propEdit.key !== key) return out;
  const ctrl = PROP_CTRL[key] || {};
  Object.keys(ctrl).forEach((f) => {
    const el = document.getElementById(ctrl[f][0]);
    if (!el) return;                       // the control is not rendered: it cannot have an opinion
    const v = ctrl[f][1] === "day" ? dayToMs(el.value) : String(el.value || "");
    // An emptied control is the operator DELETING the value — propClearDue's whole purpose. That is
    // the only path that drops a stored field, and it takes a human clearing a visible box.
    if (v === undefined || v === "") delete out[f]; else out[f] = v;
  });
  return out;
}
async function propPost(key, value, keepOpen) {
  const ph = profilePhone;
  if (!ph) return false;
  const body = { phone: ph, props: {}, by: OPERATOR };
  // Everything this property carries BESIDES its text — today that is FR-4's optional date. Read
  // through propCarry so the default is PRESERVE and only an open editor can change a value; an
  // absent date still stays absent rather than becoming today, which would be an invented fact.
  const extra = propCarry(key);
  let val = value;
  // BR-2 + AC-7: the tag set and its provenance commit in ONE transaction, and the set that ships is
  // the one the OPERATOR just typed — parsed by interestPairs, the same reader that draws the chips.
  // It used to send the UNCHANGED c.tags, so deleting a tag the agent fabricated — the primary
  // reason FR-3 is editable at all — was a guaranteed no-op. An emptied field sends [] and clears
  // them, which is the delete.
  if (key === "productInterest") {
    const pairs = interestPairs(val);
    // A PARTIAL parse is data loss reported as success: «منتج أ: مهتم، منتج ب: مهتم جدا» stored one
    // pair, dropped the other, and printed «حُفظ في ملف العميل» over the loss. Refused, and the
    // refusal NAMES the segments that were not understood. A set that parses to nothing at all is a
    // different thing — a human sentence about the account — and is still stored verbatim.
    const unread = interestUnread(val);
    if (pairs.length && unread.length) {
      const perr = "لم يُفهم: «" + unread.join("» و«") + "». اكتب كل منتج هكذا: «اسم المنتج: نية مرتفعة».";
      if (keepOpen && propEdit) { propEdit.err = perr; render(false); } else alertBar(perr, true);
      return false;
    }
    // The same product typed twice made two chips and two interest_tags rows. tracker.addTag drops
    // the older entry for a product it re-tags; the human path does the same now, last wins.
    const uniq = [];
    pairs.forEach((t) => {
      const at = uniq.map((u) => u.product).indexOf(t.product);
      if (at < 0) uniq.push(t); else uniq[at] = t;
    });
    pairs.length = 0;
    uniq.forEach((t) => pairs.push(t));
    body.tags = pairs.map((t) => ({ product: t.product, level: t.level }));
    // Stored in the canonical wire shape so a human set and a machine set are comparable strings.
    // Text the parser cannot read is stored verbatim and renders as a sentence; the tag set it does
    // not name is cleared rather than left on screen contradicting it.
    if (pairs.length) val = interestWire(pairs);
  }
  // The route accepts either a bare string or {value, …}. Send the object form only when the
  // property actually carries something beyond its text, so a dateless field keeps the simpler
  // shape and stores no date at all.
  body.props[key] = Object.keys(extra).length ? Object.assign({ value: val }, extra) : val;
  try {
    const r = await fetch("/admin/contact/props", { method: "POST",
      headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify(body) });
    if (r.ok) {
      propEdit = null; propFlash = key;
      await refresh();
      // refresh() ends in render(true), which SKIPS a repaint when the data signature is unchanged
      // — and a property write moves no field that signature reads. Forced, or the value the
      // operator just typed would not appear until the next hash change.
      render(false);
      setTimeout(() => { propFlash = ""; }, 600);
      alertBar("حُفظ في ملف العميل", false);
      return true;
    }
    let j = null;
    try { j = await r.json(); } catch (e) {}
    const code = j ? (j.error || j.reason || "") : "";
    let err = "لم يُحفظ. أعد المحاولة.";
    if (code === "too_long") err = "النص أطول من المسموح (" + fmtN(PROP_MAX[key] || 120) + " حرفًا).";
    else if (code === "bad_date") err = "التاريخ خارج المدى المقبول. اكتب موعدًا قريبًا أو اترك التاريخ فارغًا.";
    else if (r.status === 503) err = "لم يُحفظ: قاعدة البيانات غير متصلة. أعد المحاولة.";
    else if (code === "unknown_reason") err = "اختر سببًا من القائمة.";
    else if (code === "unknown_phone") err = "لم يُحفظ: لا سجل لهذا الرقم.";
    if (keepOpen && propEdit) { propEdit.err = err; render(false); } else alertBar(err, true);
    return false;
  } catch (e) {
    if (keepOpen && propEdit) { propEdit.err = "لم يُحفظ. أعد المحاولة."; render(false); } else alertBar("تعذّر الاتصال بالخادم", true);
    return false;
  }
}
window.propOpen = (btn) => {
  const key = btn.dataset.k;
  const c = (profileData || {}).contact || {};
  const p = (c.props || {})[key] || null;
  propEdit = { key: key, val: propDraft(key, p), err: "", sel: btn.dataset.sel === "1" };
  render(false);
  const el = document.getElementById("propinp");
  if (!el) return;
  el.focus();
  // «صحّح» selects the reading, so correcting it costs one keystroke rather than a delete-all.
  if (propEdit.sel && el.select) el.select();
};
window.propCancel = () => { propEdit = null; render(false); };
window.propSave = async () => {
  if (!propEdit) return;
  const key = propEdit.key;
  const el = document.getElementById("propinp");
  let val = el ? String(el.value) : propEdit.val;
  // FR-6 is a closed vocabulary: the enum is chosen, never typed, and the free text rides after it
  // in the same shape the route validates and dqRead() reads back.
  if (key === "disqualifyReason") {
    const sel = document.getElementById("propsel");
    const reason = sel ? String(sel.value).trim() : "";
    const free = val.trim();
    const had = String((((profileData || {}).contact || {}).props || {})[key]
      ? ((profileData.contact.props)[key]).value : "");
    if (!reason) {
      // Nothing picked. The default used to be «price», so this save filed a price rejection
      // nobody stated under the operator's name; it now refuses, with the SAME sentence the route
      // returns for unknown_reason so the operator reads one message for one situation.
      if (!had) {
        propEdit.val = el ? String(el.value) : propEdit.val;
        propEdit.err = "اختر سببًا من القائمة.";
        render(false);
        return;
      }
      // «— أزل الاستبعاد —» over a stored reason IS an explicit human choice: erase. Empty from a
      // human is decideProp's remove path (tracker.ts §137) — unreachable from this panel until
      // now, because propDraft strips the enum and this line put it straight back.
      val = "";
    } else {
      val = free ? reason + ": " + free : reason;
    }
  }
  propEdit.val = el ? String(el.value) : propEdit.val;
  await propPost(key, val, true);
};
// أكّد — one tap, no dialog. It re-writes the SAME value as a human, which is exactly what a
// confirmation is: tracker.decideProp stamps «prior» with the reading it confirms, and that stamp
// is the only thing that makes a confirmation rate computable later.
// It carries the WHOLE prop forward, not just its text: propPost's propCarry defaults to preserving
// every stored field and lets only an OPEN editor change one, and a confirm opens no editor. A
// confirmation that narrowed what it confirmed would be the worst possible shape for this button.
// «اعتمدها» writes the contested reading instead; «تجاهل» re-writes the standing fact, which
// clears the stale «قراءة مختلفة» line without inventing a new value.
window.propConfirm = async (btn) => {
  const key = btn.dataset.k;
  const c = (profileData || {}).contact || {};
  const p = (c.props || {})[key];
  // A reading can be on screen with NO backing property — a hydrated contact whose interest lives
  // only in c.tags, or whose next step is only the customer's own sentence in c.scheduledSaid.
  // propState renders those as readings with «أكّد» beside them, and this used to open with a bare
  // early return — a button that was reachable and did nothing. «أكّد» can only mean one thing:
  // confirm the value the operator is LOOKING AT. So the fallback is the same source the row drew
  // itself from, never an invented value, and if there is genuinely nothing to confirm we say so
  // rather than failing mutely.
  const shown = p
    ? (btn.dataset.use === "c" && p.contested ? p.contested.value : p.value)
    : key === "productInterest" ? interestWire(interestLatest(c.tags))
    : key === "nextStep" ? String(c.scheduledSaid || "")
    : "";
  if (!shown) { alertBar("لا توجد قراءة لتأكيدها.", true); return; }
  // propCarry can only carry from a STORED prop. On this branch there is none — the reading came
  // straight off c.scheduledSaid — so the moment we already read from it has to be carried by hand,
  // or confirming prints «أكّدها عبدالعزيز» directly above «لم تُؤكَّد بعد» about the same
  // appointment. Confirming a reading must never narrow it, whichever branch produced it.
  // Through appt(), never c.scheduledAt directly: the gate holds the appointment to exactly ONE
  // reader in the shipped bundle, and that rule is what stops a fourth surface re-opening the
  // two-stores class. A new consumer joins the reader; it does not become one.
  const ap = !p && key === "nextStep" ? appt(c) : null;
  const carry = ap && ap.at ? { value: shown, due: ap.at } : shown;
  await propPost(key, carry, false);
};
// Clearing the date must be possible without clearing the step itself: an operator who learns the
// meeting slipped should be able to drop the date and keep «زيارة الفرع». Blanking the input and
// saving does exactly that, because an absent date is simply never sent.
window.propClearDue = () => {
  const el = document.getElementById("propdue");
  if (el) el.value = "";
  if (propEdit) propEdit.due = "";
  render(false);
};
window.propKey = (e) => {
  if (e.key === "Escape") { e.preventDefault(); propCancel(); }
  else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); propSave(); }
};
window.setOutcome = async (btn) => {
  try {
    const r = await fetch("/admin/contact/outcome", { method: "POST", headers: { "x-admin-token": TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ phone: btn.dataset.ph, outcome: btn.dataset.out }) });
    if (!r.ok) { alertBar("تعذّر تسجيل النتيجة (" + r.status + ")", true); return; }
    // NFR-3. «غير مناسب» ALSO writes a حقيقة on the record, and that write can fail while the
    // outcome itself — telemetry-grade, fire-and-forget — succeeds. The route reports it in
    // the disqualify field; a 200 alone is not evidence the fact reached the ledger, and «سُجّلت النتيجة»
    // on a fact that never landed is exactly the silent failure this cycle exists to stop.
    let j = null;
    try { j = await r.json(); } catch (e) {}
    const dq = j ? j.disqualify : null;
    if (dq && dq !== "saved") {
      alertBar(btn.dataset.out === "clear"
        ? "أُزيلت النتيجة، لكن سبب الاستبعاد ما زال مسجّلًا"
        : "سُجّلت النتيجة، لكن سبب الاستبعاد لم يُحفظ", true);
    } else alertBar("سُجّلت النتيجة، وستُحتسب ضمن قياس أثر الحملات", false);
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
  if (cur === "customer") {
    // #customer/<phone>/<campId> — the third segment is the scope. Without this assignment
    // profileCampaign stayed "" forever, ?campaign= was never sent, and the server-side window
    // was dead code: the scoping the profile claimed to support had never once run.
    profileCampaign = (location.hash || "").split("/")[2] || "";
    profileData = null; render(false); refresh();
  }
  else render(false);
});
${CAMPAIGNS_CRM_JS}
${CUSTOMERS_CRM_JS}
${ACTIVITY_CRM_JS}
${RECORD_TABS_JS}
${TASKS_CRM_JS}
${TARGETS_CRM_JS}
/* campaigns-crm must be initialised BEFORE the first refresh()/render(): its state vars are plain
   var declarations, so placing this block after the bootstrap would let the first paint read an
   undefined selection map. */
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
