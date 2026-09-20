// knowledge-crm.ts — «جاهزية المعرفة» on the product record and the section editor (client A, BRD v1.0 §11
// BR-KB-001..003, slice S6).
//
// The record's knowledge section gains a score — the eight BRD sections, weighted — with each section's state
// and the gaps that cost the most listed first, each opening the editor on that section. The editor writes the
// document section by section and saves it as a DRAFT: the assistant still reads only what «اعتماد المعرفة»
// approved, so hand-written knowledge passes the same gate an uploaded deck does. The score in the editor is
// scoreKnowledge on the text being typed, the same function the server scores with.
//
// GRAMMAR. PORTED to the new design system (docs/PORT-SPEC.md): the readiness block and the editor
// are drawn in the m-* vocabulary inside the record's .ds6 wrapper. The hand-rolled meter, the eight
// state dots and the sheet chrome this module used to define are vocabulary now (.m-meter, .m-chip,
// .m-dlg__*), so those rules are gone; what is left is the overlay geometry the vocabulary has no
// word for, and «دقة الإجابات», which renders in the conversation view and is NOT ported.
// MOTION: the sheet enters from scale(.97) over --m-in and leaves over --m-out; the meter does not
// animate (it repaints on every keystroke).
//
// NO BACKTICKS ANYWHERE IN THIS FILE, comments included: it is one template literal.

export const KNOWLEDGE_CRM_CSS = `
/* ---- the readiness block on the record ---- */
.ds6 .kb-score { display:flex; flex-direction:column; gap:var(--m-3); }
.ds6 .kb-top { display:flex; align-items:center; gap:var(--m-3); flex-wrap:wrap; }
.ds6 .kb-top > .kb-hd { flex:1 1 220px; min-inline-size:0; }
.ds6 .kb-meter { display:flex; align-items:center; gap:var(--m-2); min-inline-size:200px; flex:1 1 200px; }
.ds6 .kb-meter > .m-n { font-size:var(--m-t-h); font-weight:700; color:var(--m-ink); min-inline-size:56px; }
.ds6 .kb-meter > .m-meter { flex:1 1 auto; margin-block:0; }
.ds6 .kb-secs { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:var(--m-1); }
/* A section chip is a control: the vocabulary gives it its colour, this gives it a button's reset. */
.ds6 button.kb-sec { font:inherit; border:0; cursor:pointer; text-align:start; justify-content:flex-start;
  min-inline-size:0; transition:opacity var(--m-out) var(--m-ease), transform var(--m-press) var(--m-ease); }
.ds6 button.kb-sec:active { transform:scale(.97); }
.ds6 .kb-sec > .kb-n { flex:1 1 auto; min-inline-size:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ds6 .kb-gaps { display:flex; flex-direction:column; gap:2px; }
.ds6 .kb-gaps b { color:var(--m-ink); font-weight:600; }

/* ---- the editor sheet: the overlay geometry a .m-dlg panel needs without a <dialog> ---- */
.ds6 .kb-scrim { position:fixed; inset:0; z-index:var(--z-modal, 400); background:rgba(11,13,18,.44);
  opacity:0; transition:opacity var(--m-out) var(--m-ease); }
.ds6 .kb-scrim.in { opacity:1; }
.ds6 .kb-wrap { position:fixed; inset:0; z-index:var(--z-modal, 400); display:flex; align-items:flex-start;
  justify-content:center; padding:6vh var(--m-3) var(--m-3); pointer-events:none; }
.ds6 .kb-box { pointer-events:auto; inline-size:100%; max-inline-size:760px; display:flex; flex-direction:column;
  max-block-size:88vh; opacity:0; transform:scale(.97);
  transition:opacity var(--m-out) var(--m-ease), transform var(--m-out) var(--m-ease); }
.ds6 .kb-box.in { opacity:1; transform:none; transition-duration:var(--m-in); }
.ds6 .kb-ed .m-dlg__b { flex:1 1 auto; max-block-size:none; }
.ds6 .kb-ed textarea.m-input { min-block-size:88px; }
.ds6 .kb-row { display:flex; flex-direction:column; gap:var(--m-1); margin-block-end:var(--m-4); }
.ds6 .kb-row .kb-rh { display:flex; align-items:center; gap:var(--m-2); flex-wrap:wrap; }
.ds6 .kb-row .kb-sp { flex:1 1 auto; }
/* The live score is announced, not printed twice: the meter beside it already carries the figure. */
.ds6 .kb-sr { position:absolute; inline-size:1px; block-size:1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
/* Pinned over the sheet body's own top padding, so nothing scrolls visibly above it. */
.ds6 .kb-live { position:sticky; inset-block-start:calc(-1 * var(--m-5)); margin-block-start:calc(-1 * var(--m-5));
  padding-block:var(--m-4) var(--m-3); background:var(--m-paper); border-block-end:1px solid var(--m-line);
  margin-block-end:var(--m-4); }
@media (max-width:720px) { .ds6 .kb-secs { grid-template-columns:repeat(2, minmax(0,1fr)); } }
@media (prefers-reduced-motion: reduce) {
  .ds6 .kb-scrim, .ds6 .kb-box { transition:none; }
  .ds6 .kb-box { transform:none; }
  .ds6 button.kb-sec:active { transform:none; }
}

/* ---- «دقة الإجابات» renders inside the conversation view, which is NOT ported: its own rules stay ---- */
.aq { display:flex; align-items:center; gap:4px; margin-top:4px; font-size:var(--t-xs); color:#656B76; }
.aq button { font-family:inherit; font-size:var(--t-xs); font-weight:600; min-height:24px; padding:0 8px; border-radius:var(--r-pill); border:none; cursor:pointer; background:rgba(255,255,255,.7); color:#33373E; box-shadow:inset 0 0 0 1px #D8DCE3; }
.aq button[aria-pressed="true"].ok { background:var(--s-issued-soft); color:var(--s-issued-text); box-shadow:none; }
.aq button[aria-pressed="true"].no { background:var(--s-fail-soft); color:var(--s-fail-text); box-shadow:none; }
.aq button:focus-visible { outline:2px solid var(--accent); outline-offset:1px; }
@media (pointer:coarse) { .aq button { min-height:36px; } }
`;

export const KNOWLEDGE_CRM_JS = `
/* ================= «جاهزية المعرفة» and the section editor ================= */
var kbEd = null;   /* { product, sections, extra, baseMdHash, baseDraftHash, focus, err, field, busy, dirty, shown, confirm, from } */

/* The figure, then the bar, then the threshold mark on it. One .m-n for the digits so the percent
   sign cannot land on the wrong side of them. */
function kbMeter(score) {
  return '<span class="kb-meter" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + score + '" aria-label="درجة جاهزية المعرفة">' +
    '<span class="m-n">' + fmtN(score) + '٪</span>' +
    '<span class="m-meter" style="--m-pct:' + Math.max(0, Math.min(100, score)) + "%;--m-mark:" + KB_READY_MIN +
    '%" title="حد الجاهزية ' + fmtN(KB_READY_MIN) + '٪"><i></i><b></b></span></span>';
}
/* The eight sections, each one a chip whose colour IS its state: complete, short, or not written. */
function kbSecChip(x, may) {
  var st = x.state === "done" ? "مكتمل" : x.state === "short" ? "قصير" : "ناقص";
  var tone = x.state === "done" ? " m-chip--ok" : x.state === "short" ? " m-chip--warn" : "";
  var body = '<span class="kb-n">' + esc(x.label) + '</span><span class="m-n">' + fmtN(x.weight) + "٪</span>";
  if (!may) {
    return '<span class="m-chip kb-sec' + tone + '" title="' + esc(x.label) + ": " + st + '">' + body + "</span>";
  }
  return '<button type="button" class="m-chip kb-sec' + tone + '" data-kb="open" data-s="' + x.key + '" id="kbsec_' + x.key +
    '" aria-label="' + esc(x.label) + ": " + st + " — وزنه " + fmtN(x.weight) + '٪">' + body + "</button>";
}
/* The block on the record. It scores what the assistant reads now (or the embedded entry when there is no
   document); a pending draft's score is shown on the draft itself. */
/* knowledge.edit — exec and sales read the readiness and write no knowledge (§22). */
function kbMayEdit() { return typeof meCan !== "function" || meCan("knowledge.edit"); }
function kbScoreBlock(p, kn) {
  if (!kn || !kn.score) return "";
  var s = kn.score, hasDoc = !!(kn.md && kn.md.trim());
  if (!hasDoc && !kn.embeddedBasis) {
    return '<div class="kb-score"><div class="kb-top"><div class="kb-hd">' +
      '<p class="m-label">جاهزية المعرفة</p><p class="m-meta">' +
      (kn.draftMd ? "لا معرفة معتمدة بعد — المسودة أدناه بانتظار الاعتماد." : "لا معرفة مكتوبة لهذا المنتج. اكتبها قسمًا قسمًا، أو ارفع ملفًا يُستخلص منه.") + "</p></div>" +
      (kbMayEdit() ? '<button type="button" class="m-btn m-btn--primary" id="kbopen" data-kb="open"' + (p.archived ? " disabled" : "") + ">" + (kn.draftMd ? "تحرير المسودة" : "اكتب المعرفة") + "</button>" : "") + "</div></div>";
  }
  var basis = kn.state === "approved" ? "المعرفة المعتمدة" : kn.state === "legacy" ? "النص الحالي (غير معتمد)" : "المعرفة المدمجة في المساعد";
  var h = '<div class="kb-score"><div class="kb-top"><div class="kb-hd">' +
    '<p class="m-label">جاهزية المعرفة</p><p class="m-meta">' + esc(basis) +
    ' · ثمانية أقسام بأوزان · الحد <span class="m-n">' + fmtN(KB_READY_MIN) + "٪</span></p></div>" +
    kbMeter(s.score) + (kbMayEdit() ? '<button type="button" class="m-btn" id="kbopen" data-kb="open"' + (p.archived ? " disabled" : "") + ">" + (kn.draftMd ? "تحرير المسودة" : "تحرير الأقسام") + "</button>" : "") + "</div>";
  var may = kbMayEdit();
  h += '<div class="kb-secs">' + s.sections.map(function (x) { return kbSecChip(x, may); }).join("") + "</div>";
  if (s.missing.length) {
    var gaps = s.missing.slice(0, 3).map(function (m) { return "<b>" + esc(m.label) + "</b> " + (m.state === "short" ? "قصير (يُحتسب نصف وزنه)" : "غير مكتوب") + " · إكماله يرفع الدرجة " + kbPoints(m.state === "short" ? m.weight / 2 : m.weight); });
    h += '<div class="kb-gaps m-meta">' + gaps.map(function (g) { return "<span>" + g + "</span>"; }).join("") + (s.missing.length > 3 ? "<span>و" + mPl(s.missing.length - 3, "قسم آخر", "قسمان آخران", "أقسام أخرى", "قسمًا آخر") + " — انظر الأقسام أعلاه.</span>" : "") + "</div>";
  }
  if (s.truncated) h += '<p class="m-status m-status--warn" role="note">عدد أحرف النص <span class="m-n">' + fmtN(s.chars) + '</span>، والمساعد يقرأ أول <span class="m-n">' + fmtN(KB_PROMPT_CHARS) + "</span> منها فقط — اختصره حتى لا يُقطع آخره.</p>";
  if (!s.ready && kn.state !== "legacy") h += '<p class="m-status m-status--warn" role="note">الدرجة أقل من حد الجاهزية (<span class="m-n">' + fmtN(KB_READY_MIN) + "٪</span>): أكمل الأقسام الناقصة — ما لم يُكتب لا يعرفه المساعد، وأسئلة العملاء عنه تُحال لموظف حين لا يجد لها مصدرًا.</p>";
  return h + "</div>";
}
/* Points carry the noun's agreement; a half weight prints without a decimal. Every one of these
   renders as MARKUP, so the numeral goes through .m-n via mPl — PORT-SPEC 3 and 5 together. */
function kbPoints(n) { var v = Math.round(n); return mPl(v, "نقطة واحدة", "نقطتين", "نقاط", "نقطة"); }
function kbDraftLine(kn) {
  if (!kn || !kn.draftScore) return "";
  var before = kn.score ? kn.score.score : 0, after = kn.draftScore.score;
  return '<p class="m-meta">درجة المسودة <span class="m-n">' + fmtN(after) + "٪</span>" +
    (kn.md ? ' · المعتمد <span class="m-n">' + fmtN(before) + "٪</span>" + (after > before ? " · ترتفع " + kbPoints(after - before) : after < before ? " · تنخفض " + kbPoints(before - after) : "") : "") + "</p>";
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
  document.querySelectorAll(".kb-scrim, .kb-box").forEach(function (el) { el.classList.remove("in"); });
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  setTimeout(function () { kbEd = null; render(false); var t = document.getElementById(from) || document.getElementById("kbopen"); if (t) t.focus(); }, reduce ? 0 : 120);
}
function kbLiveHtml(live) {
  return '<div class="kb-top"><span class="m-label kb-hd">درجة هذه المسودة</span>' + kbMeter(live.score) +
    '<span class="kb-sr" role="status" id="kblivest"><span class="m-n">' + fmtN(live.score) + "٪</span></span></div>" +
    (live.truncated ? '<p class="m-status m-status--warn">عدد أحرف النص <span class="m-n">' + fmtN(live.chars) + '</span> — يقرأ المساعد أول <span class="m-n">' + fmtN(KB_PROMPT_CHARS) + "</span> منها فقط.</p>" : "");
}
/* While typing, only the meter and the section badges change — the sheet is not rebuilt, so the textarea keeps
   its focus, caret and on-screen keyboard (a rebuild dismissed the keyboard on phones). */
function kbUpdateLive() {
  if (!kbEd) return;
  var live = kbLive(), box = document.getElementById("kblive");
  if (box) box.innerHTML = kbLiveHtml(live);
  live.sections.forEach(function (x) {
    var ta = document.getElementById("kbt_" + x.key); if (!ta) return;
    var st = ta.parentNode && ta.parentNode.querySelector(".kb-st");
    if (st) {
      st.className = "m-chip kb-st" + (x.state === "done" ? " m-chip--ok" : x.state === "short" ? " m-chip--warn" : "");
      st.textContent = x.state === "done" ? "مكتمل" : x.state === "short" ? "قصير" : "ناقص";
    }
  });
}
function kbLive() {
  var md = assembleKb(kbEd.product, kbEd.sections, kbEd.extra);
  return scoreKnowledge(md);
}
function kbEditor() {
  if (!kbEd) return "";
  var e = kbEd, cls = e.shown ? " in" : "", live = kbLive();
  var chip = function (state) {
    return '<span class="m-chip kb-st' + (state === "done" ? " m-chip--ok" : state === "short" ? " m-chip--warn" : "") + '">' +
      (state === "done" ? "مكتمل" : state === "short" ? "قصير" : "ناقص") + "</span>";
  };
  /* The editor is APPENDED after the record's own .ds6 closes (vProductDrill), so it carries its
     own wrapper — every rule this sheet needs is scoped to .ds6, and an overlay that inherits none
     of them renders as unstyled markup over the page. */
  var h = '<div class="ds6"><div class="kb-ed"><div class="kb-scrim' + cls + '" data-kb="close"></div><div class="kb-wrap"><div class="m-dlg__p kb-box' + cls + '" role="dialog" aria-modal="true" aria-labelledby="kbmt" aria-describedby="kbms">' +
    '<div class="m-dlg__h"><div><h2 class="m-dlg__t" id="kbmt">معرفة «' + esc(e.product) + '»</h2><p class="m-meta" id="kbms">تُحفظ مسودةً ويقرؤها المساعد بعد «اعتماد المعرفة» فقط؛ محتواها ما يُسمح له بقوله حرفيًا بلا إضافة.</p></div>' +
    '<button type="button" class="m-x" data-kb="close" aria-label="إغلاق">' + (typeof pxIco === "function" ? pxIco("x") : "×") + "</button></div>";
  h += '<div class="m-dlg__b"><div class="kb-live" id="kblive">' + kbLiveHtml(live) + "</div>";
  KB_SECTIONS.forEach(function (d) {
    var sec = live.sections.filter(function (x) { return x.key === d.key; })[0];
    var bad = e.field === "sections." + d.key;
    h += '<div class="kb-row m-field"><div class="kb-rh"><label class="m-label" for="kbt_' + d.key + '">' + esc(d.label) +
      '</label><span class="m-meta">وزنه <span class="m-n">' + fmtN(d.weight) + '٪</span></span><span class="kb-sp"></span>' + chip(sec.state) + "</div>" +
      '<textarea class="m-input" id="kbt_' + d.key + '" data-kbsec="' + d.key + '" dir="auto" maxlength="' + KB_SECTION_MAX + '" aria-describedby="kbh_' + d.key + (bad ? " kberr_" + d.key : "") + '"' + (bad ? ' aria-invalid="true"' : "") + ">" + esc(e.sections[d.key]) + "</textarea>" +
      '<span class="m-hint" id="kbh_' + d.key + '">' + esc(d.hint) + (sec.state !== "done" ? ' · يُعدّ مكتملًا من <span class="m-n">' + fmtN(d.min) + "</span> من الأحرف" : "") +
        (d.key === "pricing" && kbEd.embedded ? " · تنبيه: السعر الذي يذكره المساعد أولًا لهذا المنتج مثبت في كتالوجه، ولا يغيّره هذا القسم." : "") + "</span>" +
      (bad ? '<span class="m-err" id="kberr_' + d.key + '" role="alert">' + esc(e.err) + "</span>" : "") + "</div>";
  });
  var badX = e.field === "extra";
  h += '<div class="kb-row m-field"><div class="kb-rh"><label class="m-label" for="kbt_extra">' + esc(KB_EXTRA_LABEL) + '</label><span class="m-meta">لا وزن له</span></div>' +
    '<textarea class="m-input" id="kbt_extra" data-kbsec="__extra" dir="auto" maxlength="' + KB_SECTION_MAX + '"' + (badX ? ' aria-invalid="true"' : "") + ">" + esc(e.extra) + "</textarea>" +
    '<span class="m-hint">أرقام ومراجع وشهادات وتكاملات، و### للعناوين الفرعية.</span>' + (badX ? '<span class="m-err" role="alert">' + esc(e.err) + "</span>" : "") + "</div>";
  h += '</div><div class="m-dlg__f">';
  if (e.confirm) {
    h += '<span class="m-err" role="alert">لديك تغييرات لم تُحفظ.</span><button type="button" class="m-btn" id="kbkeep" data-kb="keep">متابعة التحرير</button><button type="button" class="m-btn" data-kb="discard">تجاهل التغييرات</button>';
  } else {
    h += '<button type="button" class="m-btn m-btn--primary" id="kbsave" data-kb="save"' + (e.busy ? ' disabled aria-busy="true"' : "") + ">" + (e.busy ? "جارٍ الحفظ…" : "حفظ كمسودة") + "</button>" +
      '<button type="button" class="m-btn" data-kb="close">إلغاء</button>' + (e.err && e.field.indexOf("sections.") !== 0 && e.field !== "extra" ? '<span class="m-err" role="alert">' + esc(e.err) + "</span>" : "");
  }
  return h + "</div></div></div></div></div>";
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
  if (!kbEd.shown && document.querySelector(".kb-ed .kb-box")) {
    requestAnimationFrame(function () { if (!kbEd) return; document.querySelectorAll(".kb-ed .kb-scrim, .kb-ed .kb-box").forEach(function (el) { el.classList.add("in"); }); kbEd.shown = true; });
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
  if (!kbEd || !document.querySelector(".kb-ed .kb-box")) return;
  if (ev.key === "Escape") { ev.preventDefault(); if (kbEd.confirm) { kbEd.confirm = false; render(false); var sv = document.getElementById("kbsave"); if (sv) sv.focus(); } else kbClose(false); return; }
  if ((ev.metaKey || ev.ctrlKey) && ev.key === "Enter") { ev.preventDefault(); kbSave(); return; }
  if (ev.key !== "Tab") return;
  var box = document.querySelector(".kb-ed .kb-box");
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
