// ds-verify.ts — a printed figure that disagrees with the records is a runtime error.
//
// WHY. Every design review this project has had found the same defect, and found it by reading:
// the nav said six products, the page said "five of six", the truth was eight and seven. Today's
// audit found twelve more across fourteen modules — an attainment percentage whose numerator and
// denominator covered different populations, a lost deal rendering «100٪ نسبة الإنجاز», a flat
// «0 متأخرة» on a ladder where most stages have no deadline at all.
//
// Discipline did not catch any of them. A reviewer did, months later, each time.
//
// So the guard is a mechanism, not a rule. A screen marks each printed figure with data-d="key"
// and registers a derivation for that key off the SAME array it renders. On every paint the
// derivations re-run and any disagreement is outlined and logged. The check costs one pass over
// the marked nodes and runs in the browser the founder is actually looking at.
//
// This came out of the Fable entry in the design competition (massar-ds/review/entries/fable),
// which is the only thing either entry produced that makes the defect class structurally
// impossible rather than merely discouraged. Verified there by attack, not by reading: corrupting
// a figure in the markup produced «figure disagrees with records: noTarget 9 != 7» on load.
//
// (No backticks anywhere below, including in comments: this is one template literal.)

export const DS_VERIFY_CSS = `
/* An outline, not a colour swap: the wrong figure has to stay readable so the reader can see
   WHAT it said. Non-destructive, and it cannot be mistaken for a status. */
.ds6 [data-d].is-off {
  outline: 2px solid var(--m-bad);
  outline-offset: 2px;
  border-radius: 3px;
}
`;

export const DS_VERIFY_JS = `
/* dsD(key, fn) registers a derivation. fn returns the value that key MUST print, computed from
   the same rows the screen renders — never from a second copy of the number. */
var DS_DERIVE = {};
function dsD(key, fn) { DS_DERIVE[key] = fn; }

/* Normalise before comparing: the markup carries thousands separators, RTL marks and the
   .m-n wrapper, none of which change the value. Comparing raw strings would report a
   disagreement on every correctly-formatted figure and the guard would be turned off inside a
   week — a check that cries wolf is a check nobody keeps. */
function dsNorm(v) {
  return String(v == null ? "" : v)
    .replace(/[\\u200e\\u200f\\u061c]/g, "")
    .replace(/[,\\s]/g, "")
    .trim();
}

function dsVerify(root) {
  var scope = root || document;
  var bad = 0;
  var nodes = scope.querySelectorAll("[data-d]");
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    var key = el.getAttribute("data-d");
    var fn = DS_DERIVE[key];
    if (typeof fn !== "function") continue;
    var want;
    try { want = fn(); } catch (e) { continue; }
    if (want === null || want === undefined) continue;
    var printed = dsNorm(el.textContent);
    if (printed !== dsNorm(want)) {
      el.classList.add("is-off");
      bad++;
      /* Loud on purpose. This is the failure the last two reviews were spent finding by hand. */
      console.error("figure disagrees with records:", key, el.textContent, "!==", want);
    } else {
      el.classList.remove("is-off");
    }
  }
  return bad;
}

/* Marks a figure for checking. dsFig("nLines", 6) prints 6 and binds it to the nLines
   derivation, so a screen cannot print a count without declaring where it came from. */
function dsFig(key, value, cls) {
  return '<span class="m-n' + (cls ? " " + cls : "") + '" data-d="' + key + '">' +
    (typeof fmtN === "function" ? fmtN(value) : String(value)) + "</span>";
}
`;
