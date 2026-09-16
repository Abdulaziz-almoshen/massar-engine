// knowledge-crm.ts — «جاهزية المعرفة» on the product record and the section editor (client A, BRD v1.0 §11
// BR-KB-001..003, slice S6).
//
// The record's knowledge section gains a score — the eight BRD sections, weighted — with each section's state
// and the gaps that cost the most listed first, each opening the editor on that section. The editor writes the
// document section by section and saves it as a DRAFT: the assistant still reads only what «اعتماد المعرفة»
// approved, so hand-written knowledge passes the same gate an uploaded deck does. The score in the editor is
// scoreKnowledge on the text being typed, the same function the server scores with.
//
// GRAMMAR. The account sheet (.ac-scrim/.ac-modal/.ac-box) for the editor; .px-* for the record. MOTION: the
// sheet's own 200ms/140ms scale-and-fade; the meter does not animate (it repaints on every keystroke).
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const KNOWLEDGE_CRM_CSS = `
.kb-score { display:flex; flex-direction:column; gap:var(--s2); border:1px solid var(--line); border-radius:var(--r-md); padding:var(--s3); background:var(--paper); }
.kb-top { display:flex; align-items:center; gap:var(--s3); flex-wrap:wrap; }
.kb-meter { display:flex; align-items:center; gap:var(--s2); min-width:220px; flex:1; }
.kb-meter .v { font-size:var(--t-xl); font-weight:600; color:var(--ink); font-variant-numeric:tabular-nums; min-width:56px; }
.kb-meter .track { flex:1; height:8px; border-radius:var(--r-pill); background:var(--surface-2); overflow:hidden; position:relative; }
.kb-meter .track i { display:block; height:100%; border-radius:inherit; background:var(--accent); }
.kb-meter .track b { position:absolute; top:-3px; bottom:-3px; width:2px; background:var(--ink-2, #33373E); opacity:.35; }
.kb-meter.low .track i { background:var(--s-attn-mark); }
.kb-meter.full .track i { background:var(--s-issued); }
.kb-top .lbl { font-size:var(--t-sm); font-weight:600; color:var(--ink); }
.kb-top .sub { font-size:var(--t-xs); color:var(--muted); line-height:1.6; }
.kb-top .btn { height:36px; display:inline-flex; align-items:center; gap:6px; }
.kb-secs { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:6px; }
.kb-sec { display:flex; align-items:center; gap:6px; font-family:inherit; font-size:var(--t-xs); color:var(--ink); background:var(--surface); border:none; border-radius:var(--r-sm);
  padding:7px 9px; cursor:pointer; text-align:start; min-width:0; }
button.kb-sec:hover { background:var(--surface-2); }
/* a role without knowledge.edit reads the same eight sections; they just do not open an editor */
span.kb-sec { cursor:default; }
.kb-sec i { width:8px; height:8px; border-radius:var(--r-pill); flex:none; background:var(--s-issued); }
.kb-sec.short i { background:var(--s-attn-mark); }
.kb-sec.missing i { background:transparent; box-shadow:inset 0 0 0 1.5px var(--s-off-mark); }
.kb-sec .n { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.kb-sec .w { color:var(--muted); font-variant-numeric:tabular-nums; }
.kb-gaps { display:flex; flex-direction:column; gap:2px; font-size:var(--t-xs); color:var(--muted); }
.kb-gaps b { color:var(--ink); font-weight:600; }
.kb-warn { font-size:var(--t-xs); color:var(--s-attn-text); background:var(--s-attn-soft); border-radius:var(--r-sm); padding:6px 10px; display:flex; gap:6px; align-items:center; }
.kb-ed .ac-box { max-width:760px; }
.kb-ed .kb-row { display:flex; flex-direction:column; gap:4px; }
.kb-ed .kb-row .hd { display:flex; align-items:center; gap:var(--s2); flex-wrap:wrap; }
.kb-ed .kb-row label { font-size:var(--t-sm); font-weight:600; color:var(--ink); }
.kb-ed .kb-row .w { font-size:var(--t-xs); color:var(--muted); font-variant-numeric:tabular-nums; }
.kb-ed .kb-row .sp { flex:1; }
.kb-ed .kb-row .st { font-size:var(--t-xs); font-weight:600; border-radius:var(--r-pill); padding:0 8px; }
.kb-ed .kb-row .st.done { background:var(--s-issued-soft); color:var(--s-issued-text); }
.kb-ed .kb-row .st.short { background:var(--s-attn-soft); color:var(--s-attn-text); }
.kb-ed .kb-row .st.missing { background:var(--surface-2); color:var(--muted); }
.kb-ed textarea { width:100%; min-height:88px; font-family:inherit; font-size:var(--t-sm); line-height:1.7; padding:var(--s2) var(--s3); border:none; border-radius:var(--r-sm);
  box-shadow:inset 0 0 0 1px var(--s-off-mark); background:var(--paper); color:var(--ink); resize:vertical; box-sizing:border-box; }
.kb-ed textarea:focus { outline:2px solid var(--accent); outline-offset:1px; }
.kb-ed textarea[aria-invalid="true"] { box-shadow:inset 0 0 0 2px var(--s-fail); }
.kb-ed .hint { font-size:var(--t-xs); color:var(--muted); }
/* Pinned over the sheet body's own top padding, so nothing scrolls visibly above it. */
.kb-live { position:sticky; top:calc(-1 * var(--s3)); margin-top:calc(-1 * var(--s3)); padding-block:var(--s3) var(--s2); background:var(--paper); border-bottom:1px solid var(--line-soft); }
.aq { display:flex; align-items:center; gap:4px; margin-top:4px; font-size:var(--t-xs); color:#656B76; }
.aq button { font-family:inherit; font-size:var(--t-xs); font-weight:600; min-height:24px; padding:0 8px; border-radius:var(--r-pill); border:none; cursor:pointer; background:rgba(255,255,255,.7); color:#33373E; box-shadow:inset 0 0 0 1px #D8DCE3; }
.aq button[aria-pressed="true"].ok { background:var(--s-issued-soft); color:var(--s-issued-text); box-shadow:none; }
.aq button[aria-pressed="true"].no { background:var(--s-fail-soft); color:var(--s-fail-text); box-shadow:none; }
.aq button:focus-visible { outline:2px solid var(--accent); outline-offset:1px; }
@media (pointer:coarse) { .aq button { min-height:36px; } }
.kb-score .btn:active, button.kb-sec:active { transform:scale(.97); }
.kb-score .btn, .kb-sec { transition:transform 140ms var(--ease), background var(--fast) var(--ease); }
.kb-sec:focus-visible, .kb-score .btn:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
@media (max-width: 720px) { .kb-secs { grid-template-columns:repeat(2, minmax(0,1fr)); } }
@media (prefers-reduced-motion: reduce) { .kb-score .btn, .kb-sec { transition:none; } .kb-score .btn:active, .kb-sec:active { transform:none; } }
`;

export const KNOWLEDGE_CRM_JS = `
/* ================= «جاهزية المعرفة» and the section editor ================= */
var kbEd = null;   /* { product, sections, extra, baseMdHash, baseDraftHash, focus, err, field, busy, dirty, shown, confirm, from } */

function kbMeter(score, cls) {
  var c = score >= 100 ? " full" : score < KB_READY_MIN ? " low" : "";
  return '<span class="kb-meter' + c + (cls ? " " + cls : "") + '" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + score + '" aria-label="درجة جاهزية المعرفة">' +
    '<span class="v">' + fmtN(score) + '٪</span><span class="track"><i style="width:' + Math.max(0, Math.min(100, score)) + '%"></i><b style="inset-inline-start:' + KB_READY_MIN + '%" title="حد الجاهزية ' + KB_READY_MIN + '٪"></b></span></span>';
}
/* The block on the record. It scores what the assistant reads now (or the embedded entry when there is no
   document); a pending draft's score is shown on the draft itself. */
/* knowledge.edit — exec and sales read the readiness and write no knowledge (§22). */
function kbMayEdit() { return typeof meCan !== "function" || meCan("knowledge.edit"); }
function kbScoreBlock(p, kn) {
  if (!kn || !kn.score) return "";
  var s = kn.score, hasDoc = !!(kn.md && kn.md.trim());
  if (!hasDoc && !kn.embeddedBasis) {
    return '<div class="kb-score"><div class="kb-top"><span><span class="lbl">جاهزية المعرفة</span><br><span class="sub">' +
      (kn.draftMd ? "لا معرفة معتمدة بعد — المسودة أدناه بانتظار الاعتماد." : "لا معرفة مكتوبة لهذا المنتج. اكتبها قسمًا قسمًا، أو ارفع ملفًا يُستخلص منه.") + '</span></span><span class="sp" style="flex:1"></span>' +
      (kbMayEdit() ? '<button class="btn btn-teal" id="kbopen" data-kb="open"' + (p.archived ? " disabled" : "") + ">" + (kn.draftMd ? "تحرير المسودة" : "اكتب المعرفة") + "</button>" : "") + "</div></div>";
  }
  var basis = kn.state === "approved" ? "المعرفة المعتمدة" : kn.state === "legacy" ? "النص الحالي (غير معتمد)" : "المعرفة المدمجة في المساعد";
  var h = '<div class="kb-score"><div class="kb-top"><span><span class="lbl">جاهزية المعرفة</span><br><span class="sub">' + esc(basis) + " · ثمانية أقسام بأوزان · الحد " + fmtN(KB_READY_MIN) + "٪</span></span>" +
    kbMeter(s.score) + (kbMayEdit() ? '<button class="btn btn-ghost" id="kbopen" data-kb="open"' + (p.archived ? " disabled" : "") + ">" + (kn.draftMd ? "تحرير المسودة" : "تحرير الأقسام") + "</button>" : "") + "</div>";
  h += '<div class="kb-secs">' + s.sections.map(function (x) {
    var st = x.state === "done" ? "مكتمل" : x.state === "short" ? "قصير" : "ناقص";
    if (!kbMayEdit()) {
      return '<span class="kb-sec ' + x.state + '" title="' + esc(x.label) + ": " + st + '"><i aria-hidden="true"></i><span class="n">' + esc(x.label) + '</span><span class="w">' + fmtN(x.weight) + "٪</span></span>";
    }
    return '<button class="kb-sec ' + x.state + '" data-kb="open" data-s="' + x.key + '" id="kbsec_' + x.key + '" aria-label="' + esc(x.label) + ": " + st + " — وزنه " + fmtN(x.weight) + '٪"><i aria-hidden="true"></i><span class="n">' + esc(x.label) + '</span><span class="w">' + fmtN(x.weight) + "٪</span></button>";
  }).join("") + "</div>";
  if (s.missing.length) {
    var gaps = s.missing.slice(0, 3).map(function (m) { return "<b>" + esc(m.label) + "</b> " + (m.state === "short" ? "قصير (يُحتسب نصف وزنه)" : "غير مكتوب") + " · إكماله يرفع الدرجة " + kbPoints(m.state === "short" ? m.weight / 2 : m.weight); });
    h += '<div class="kb-gaps">' + gaps.map(function (g) { return "<span>" + g + "</span>"; }).join("") + (s.missing.length > 3 ? "<span>و" + pluralizeArabic(s.missing.length - 3, "قسم آخر", "قسمان آخران", "أقسام أخرى", "قسمًا آخر", fmtN) + " — انظر المربعات أعلاه.</span>" : "") + "</div>";
  }
  if (s.truncated) h += '<div class="kb-warn" role="note">عدد أحرف النص ' + fmtN(s.chars) + "، والمساعد يقرأ أول " + fmtN(KB_PROMPT_CHARS) + " منها فقط — اختصره حتى لا يُقطع آخره.</div>";
  if (!s.ready && kn.state !== "legacy") h += '<div class="kb-warn" role="note">الدرجة أقل من حد الجاهزية (' + fmtN(KB_READY_MIN) + "٪): أكمل الأقسام الناقصة — ما لم يُكتب لا يعرفه المساعد، وأسئلة العملاء عنه تُحال لموظف حين لا يجد لها مصدرًا.</div>";
  return h + "</div>";
}
/* Points carry the noun's agreement; a half weight prints without a decimal. */
function kbPoints(n) { var v = Math.round(n); return pluralizeArabic(v, "نقطة واحدة", "نقطتين", "نقاط", "نقطة", fmtN); }
function kbDraftLine(kn) {
  if (!kn || !kn.draftScore) return "";
  var before = kn.score ? kn.score.score : 0, after = kn.draftScore.score;
  return '<div class="px-note">درجة المسودة ' + fmtN(after) + "٪" + (kn.md ? " · المعتمد " + fmtN(before) + "٪" + (after > before ? " · ترتفع " + kbPoints(after - before) : after < before ? " · تنخفض " + kbPoints(before - after) : "") : "") + "</div>";
}

/* ---------------- the editor ---------------- */
function kbOpen(product, sectionKey, from) {
  var kn = pxKnow[product]; if (!kn) return;
  var src = kn.editable || { sections: {}, extra: "" };
  var secs = {}; KB_SECTIONS.forEach(function (d) { secs[d.key] = meaningfulText(src.sections[d.key] || "") ? String(src.sections[d.key] || "") : ""; });
  kbEd = { product: product, sections: secs, extra: src.extra || "", baseMdHash: kn.mdHash, baseDraftHash: kn.draftHash || null, embedded: !!kn.embeddedBasis || (typeof pxRow === "function" && pxRow(product) && pxRow(product).embedded),
    focus: "kbt_" + (sectionKey || (function () { var m = kn.score && kn.score.missing[0]; return m ? m.key : KB_SECTIONS[0].key; })()),
    err: "", field: "", busy: false, dirty: false, shown: false, confirm: false, from: from || "kbopen" };
  render(false);
}
function kbClose(force) {
  if (!kbEd) return;
  if (kbEd.dirty && !force) { kbEd.confirm = true; render(false); var k = document.getElementById("kbkeep"); if (k) k.focus(); return; }
  var from = kbEd.from;
  document.querySelectorAll(".ac-scrim, .ac-box").forEach(function (el) { el.classList.remove("in"); });
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(function () { kbEd = null; render(false); var t = document.getElementById(from) || document.getElementById("kbopen"); if (t) t.focus(); }, reduce ? 0 : 150);
}
function kbLiveHtml(live) {
  return '<div class="kb-top"><span class="lbl">درجة هذه المسودة</span>' + kbMeter(live.score) + '<span class="sub" role="status" id="kblivest">' + fmtN(live.score) + "٪</span></div>" +
    (live.truncated ? '<div class="kb-warn">عدد أحرف النص ' + fmtN(live.chars) + " — يقرأ المساعد أول " + fmtN(KB_PROMPT_CHARS) + " منها فقط.</div>" : "");
}
/* While typing, only the meter and the section badges change — the sheet is not rebuilt, so the textarea keeps
   its focus, caret and on-screen keyboard (a rebuild dismissed the keyboard on phones). */
function kbUpdateLive() {
  if (!kbEd) return;
  var live = kbLive(), box = document.getElementById("kblive");
  if (box) box.innerHTML = kbLiveHtml(live);
  live.sections.forEach(function (x) {
    var ta = document.getElementById("kbt_" + x.key); if (!ta) return;
    var st = ta.parentNode && ta.parentNode.querySelector(".st");
    if (st) { st.className = "st " + x.state; st.textContent = x.state === "done" ? "مكتمل" : x.state === "short" ? "قصير" : "ناقص"; }
  });
}
function kbLive() {
  var md = assembleKb(kbEd.product, kbEd.sections, kbEd.extra);
  return scoreKnowledge(md);
}
function kbEditor() {
  if (!kbEd) return "";
  var e = kbEd, cls = e.shown ? " in" : "", live = kbLive();
  var h = '<div class="kb-ed"><div class="ac-scrim' + cls + '" data-kb="close"></div><div class="ac-modal"><div class="ac-box' + cls + '" role="dialog" aria-modal="true" aria-labelledby="kbmt" aria-describedby="kbms">' +
    '<div class="mh"><div><h2 id="kbmt">معرفة «' + esc(e.product) + '»</h2><div class="s" id="kbms">تُحفظ مسودةً، ويقرؤها المساعد بعد «اعتماد المعرفة» فقط. اكتب ما يُسمح للمساعد بقوله حرفيًا — لا يضيف إليه شيئًا.</div></div>' +
    '<span class="sp"></span><button class="ac-x" data-kb="close" aria-label="إغلاق">' + (typeof pxIco === "function" ? pxIco("x") : "×") + "</button></div>";
  h += '<div class="mb"><div class="kb-live" id="kblive">' + kbLiveHtml(live) + "</div>";
  KB_SECTIONS.forEach(function (d) {
    var sec = live.sections.filter(function (x) { return x.key === d.key; })[0];
    var bad = e.field === "sections." + d.key;
    var st = sec.state === "done" ? "مكتمل" : sec.state === "short" ? "قصير" : "ناقص";
    h += '<div class="kb-row"><div class="hd"><label for="kbt_' + d.key + '">' + esc(d.label) + '</label><span class="w">وزنه ' + fmtN(d.weight) + '٪</span><span class="sp"></span><span class="st ' + sec.state + '">' + st + "</span></div>" +
      '<textarea id="kbt_' + d.key + '" data-kbsec="' + d.key + '" dir="auto" maxlength="' + KB_SECTION_MAX + '" aria-describedby="kbh_' + d.key + (bad ? " kberr_" + d.key : "") + '"' + (bad ? ' aria-invalid="true"' : "") + ">" + esc(e.sections[d.key]) + "</textarea>" +
      '<span class="hint" id="kbh_' + d.key + '">' + esc(d.hint) + (sec.state !== "done" ? " · يُعدّ مكتملًا من " + fmtN(d.min) + " من الأحرف" : "") +
        (d.key === "pricing" && kbEd.embedded ? " · تنبيه: السعر الذي يذكره المساعد أولًا لهذا المنتج مثبت في كتالوجه، ولا يغيّره هذا القسم." : "") + "</span>" +
      (bad ? '<span class="ferr cf-err" id="kberr_' + d.key + '" role="alert">' + esc(e.err) + "</span>" : "") + "</div>";
  });
  var badX = e.field === "extra";
  h += '<div class="kb-row"><div class="hd"><label for="kbt_extra">' + esc(KB_EXTRA_LABEL) + '</label><span class="w">لا وزن له</span></div><textarea id="kbt_extra" data-kbsec="__extra" dir="auto" maxlength="' + KB_SECTION_MAX + '"' + (badX ? ' aria-invalid="true"' : "") + ">" + esc(e.extra) + "</textarea>" +
    '<span class="hint">أرقام ومراجع وشهادات وتكاملات. للعناوين الفرعية استخدم ###.</span>' + (badX ? '<span class="ferr cf-err" role="alert">' + esc(e.err) + "</span>" : "") + "</div>";
  h += '</div><div class="mf">';
  if (e.confirm) {
    h += '<span class="cf-err msg" role="alert">لديك تغييرات لم تُحفظ.</span><button class="btn btn-ghost" id="kbkeep" data-kb="keep">متابعة التحرير</button><button class="btn btn-ghost" data-kb="discard" style="color:var(--s-fail-text)">تجاهل التغييرات</button>';
  } else {
    h += '<button class="btn btn-teal" id="kbsave" data-kb="save"' + (e.busy ? ' disabled aria-busy="true"' : "") + ">" + (e.busy ? "جارٍ الحفظ…" : "حفظ كمسودة") + "</button>" +
      '<button class="btn btn-ghost" data-kb="close">إلغاء</button>' + (e.err && e.field.indexOf("sections.") !== 0 && e.field !== "extra" ? '<span class="cf-err msg" role="alert">' + esc(e.err) + "</span>" : "");
  }
  return h + "</div></div></div></div>";
}
function kbSave() {
  var e = kbEd; if (!e || e.busy) return;
  var c = checkSectionDraft({ sections: e.sections, extra: e.extra });
  if (!c.ok) { e.err = c.reason; e.field = c.field; e.focus = c.field.indexOf("sections.") === 0 ? "kbt_" + c.field.split(".")[1] : c.field === "extra" ? "kbt_extra" : "kbt_" + KB_SECTIONS[0].key; render(false); return; }
  e.busy = true; e.err = ""; e.field = ""; render(false);
  pxJson("POST", "/admin/products/knowledge/draft", { product: e.product, sections: c.sections, extra: c.extra, baseMdHash: e.baseMdHash, baseDraftHash: e.baseDraftHash }).then(function (r) {
    if (kbEd !== e) return;
    if (!r.ok || r.j.ok === false) {
      e.busy = false;
      if (r.status === 409) {
        /* Rebase, not a dead end: what was typed stays, the version moves to what is stored now, and the next save
           replaces it knowingly. */
        pxGet("/admin/products/knowledge?product=" + encodeURIComponent(e.product)).then(function (j) {
          if (kbEd !== e) return;
          pxKnow[e.product] = j; e.baseMdHash = j.mdHash; e.baseDraftHash = j.draftHash || null;
          e.err = "غيّر شخص آخر هذه المعرفة أو مسودتها بعد أن فتحت المحرر. ما كتبته باقٍ هنا — احفظ مرة أخرى ليحلّ محل النسخة الأحدث."; e.field = ""; render(false);
        }).catch(function () { if (kbEd === e) { e.err = "تغيّرت المعرفة بعد أن فتحت المحرر، وتعذّر تحميل النسخة الأحدث — أعد المحاولة."; render(false); } });
        return;
      }
      e.err = r.j.detail || "تعذّر الحفظ (" + fmtN(r.status) + ")"; e.field = r.j.field || ""; e.focus = e.field.indexOf("sections.") === 0 ? "kbt_" + e.field.split(".")[1] : "";
      render(false); return;
    }
    e.dirty = false; var name = e.product;
    kbClose(true);
    delete pxKnow[name]; pxKnowLoad(name, true); pcLoad(true);
    pxToast("حُفظت المسودة (" + fmtN(r.j.score) + "٪) — اعتمدها ليقرأها المساعد", false);
  }).catch(function () { if (kbEd === e) { e.busy = false; e.err = "تعذّر الاتصال — لم يُحفظ شيء."; render(false); } });
}
function kbAfterPaint() {
  if (!kbEd) return;
  if (!kbEd.shown && document.querySelector(".kb-ed .ac-box")) {
    requestAnimationFrame(function () { if (!kbEd) return; document.querySelectorAll(".kb-ed .ac-scrim, .kb-ed .ac-box").forEach(function (el) { el.classList.add("in"); }); kbEd.shown = true; });
  }
  if (kbEd.focus) { var el = document.getElementById(kbEd.focus); kbEd.focus = ""; if (el) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (x) {} } }
}
window.addEventListener("hashchange", function () { kbEd = null; });
document.addEventListener("click", function (ev) {
  var t = ev.target && ev.target.closest ? ev.target.closest("[data-kb]") : null;
  if (!t) return;
  var a = t.getAttribute("data-kb");
  if (a === "open") {
    var r = typeof pxParseProductRoute === "function" ? pxParseProductRoute() : null;
    if (r && r.name && !t.disabled) kbOpen(r.name, t.getAttribute("data-s") || "", t.id || "kbopen");
    return;
  }
  if (!kbEd) return;
  if (a === "close") { kbClose(false); return; }
  if (a === "keep") { kbEd.confirm = false; render(false); var sv = document.getElementById("kbsave"); if (sv) sv.focus(); return; }
  if (a === "discard") { kbClose(true); return; }
  if (a === "save") { kbSave(); return; }
});
document.addEventListener("input", function (ev) {
  var t = ev.target; if (!kbEd || !t || !t.getAttribute) return;
  var k = t.getAttribute("data-kbsec"); if (!k) return;
  if (k === "__extra") kbEd.extra = t.value; else kbEd.sections[k] = t.value;
  kbEd.dirty = true;
  if (kbEd.err && (kbEd.field === "sections." + k || (k === "__extra" && kbEd.field === "extra") || kbEd.field === "sections")) { kbEd.err = ""; kbEd.field = ""; }
  if (t.getAttribute("aria-invalid")) { t.removeAttribute("aria-invalid"); var er = t.parentNode && t.parentNode.querySelector(".ferr"); if (er) er.remove(); }
  clearTimeout(window.__kbt);
  window.__kbt = setTimeout(kbUpdateLive, 250);
});
document.addEventListener("keydown", function (ev) {
  if (!kbEd || !document.querySelector(".kb-ed .ac-box")) return;
  if (ev.key === "Escape") { ev.preventDefault(); if (kbEd.confirm) { kbEd.confirm = false; render(false); var sv = document.getElementById("kbsave"); if (sv) sv.focus(); } else kbClose(false); return; }
  if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") { ev.preventDefault(); kbSave(); return; }
  if (ev.key !== "Tab") return;
  var box = document.querySelector(".kb-ed .ac-box");
  var items = Array.prototype.filter.call(box.querySelectorAll("button, textarea, input, a[href]"), function (el) { return !el.disabled && el.offsetParent !== null; });
  if (!items.length) return;
  var first = items[0], last = items[items.length - 1];
  if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
  else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  else if (!box.contains(document.activeElement)) { ev.preventDefault(); first.focus(); }
});
/* ---------------- «دقة الإجابات»: a reviewer's verdict on each reply (BR-MON-005, BR-AI-006) ---------------- */
var aqRev = {}, aqLoading = {}, aqFailed = {}, aqBusy = {};
function aqLoad(phone) {
  if (aqRev[phone] || aqLoading[phone] || (aqFailed[phone] && Date.now() - aqFailed[phone] < 30000)) return;
  aqLoading[phone] = true;
  pxGet("/admin/answer-reviews?phone=" + encodeURIComponent(phone)).then(function (j) {
    var m = {}; (j.reviews || []).forEach(function (r) { m[r.msgTs] = r.verdict; }); aqRev[phone] = m;
  }).catch(function () { aqFailed[phone] = Date.now(); }).then(function () { aqLoading[phone] = false; if (typeof renderConvo === "function") { convoSig = ""; renderConvo(); } });
}
function aqSig(phone) { var m = aqRev[phone]; return m ? Object.keys(m).map(function (k) { return k + m[k]; }).join(",") + "|" + Object.keys(aqBusy).length : "…"; }
function aqCtl(phone, ts) {
  aqLoad(phone);
  var m = aqRev[phone]; if (!m) return "";
  var v = m[ts] || "", busy = aqBusy[phone + "|" + ts];
  return '<div class="aq" role="group" aria-label="تقييم دقة الرد"><span>دقة الرد:</span>' +
    '<button class="ok" data-aq="correct" data-p="' + esc(phone) + '" data-t="' + ts + '" aria-pressed="' + (v === "correct") + '"' + (busy ? " disabled" : "") + ">صحيحة</button>" +
    '<button class="no" data-aq="wrong" data-p="' + esc(phone) + '" data-t="' + ts + '" aria-pressed="' + (v === "wrong") + '"' + (busy ? " disabled" : "") + ">خاطئة</button></div>";
}
document.addEventListener("click", function (ev) {
  var t = ev.target && ev.target.closest ? ev.target.closest("[data-aq]") : null;
  if (!t) return;
  var phone = t.getAttribute("data-p"), ts = Number(t.getAttribute("data-t")), want = t.getAttribute("data-aq");
  var m = aqRev[phone]; if (!m || !ts) return;
  var key = phone + "|" + ts, prev = m[ts] || null;
  /* Pressing the verdict already given takes it back. */
  var next = prev === want ? null : want;
  aqBusy[key] = true; if (next) m[ts] = next; else delete m[ts]; convoSig = ""; renderConvo();
  cfJson("POST", "/admin/answer-reviews", { phone: phone, msgTs: ts, verdict: next }).then(function (r) {
    delete aqBusy[key];
    if (!r.ok) { if (prev) m[ts] = prev; else delete m[ts]; if (typeof moToast === "function") moToast(r.j.detail || "تعذّر حفظ التقييم"); }
    convoSig = ""; renderConvo();
    var again = document.querySelector('[data-aq="' + want + '"][data-t="' + ts + '"]'); if (again) again.focus();
  }).catch(function () { delete aqBusy[key]; if (prev) m[ts] = prev; else delete m[ts]; convoSig = ""; renderConvo(); });
});
/* ================= end «جاهزية المعرفة» ================= */
`;
