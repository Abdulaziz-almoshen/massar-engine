// login-page.ts — the first screen anyone sees.
//
// It replaces the browser's own Basic-Auth dialog, which cannot be in Arabic, cannot be laid out
// right-to-left, cannot carry the product's name, and cannot say what went wrong. For a platform
// whose argument is an Arabic-first enterprise surface, an untranslatable grey box is the wrong
// first impression and the wrong error message.
//
// SELF-CONTAINED ON PURPOSE. This page is served to a caller who has proved nothing. It links to no
// stylesheet, loads no script and makes no request — so nothing about the product, its design
// system or its screens is exposed before a login succeeds, and there is no surface to attack.
// Tokens are inlined rather than imported for the same reason.
//
// (No backticks below outside the single template literal that IS the page.)

/** What the form says went wrong. Deliberately ONE message for every failure: telling an
 *  unauthenticated caller whether the USERNAME was right is how an attacker enumerates accounts. */
export const LOGIN_ERROR = "بيانات الدخول غير صحيحة.";

export function loginPage(o: { error?: boolean; next?: string; user?: string } = {}): string {
  const err = o.error === true;
  const next = typeof o.next === "string" ? o.next : "/dashboard";
  const user = typeof o.user === "string" ? o.user : "";
  const esc = (s: string) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]);

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>مَسار — تسجيل الدخول</title>
<style>
  :root {
    --ink: #14161A; --ink-2: #33373E; --mut: #656B76; --faint: #8A909B;
    --paper: #FFFFFF; --page: #F6F7F9; --line: #E4E7EC; --line-2: #CDD2DA;
    --ac: #245BD6; --ac-deep: #1947AF; --ac-dim: #EEF3FF;
    --bad: #B42318; --bad-dim: #FEF0ED; --bad-line: #F1C5BE;
    --r-card: 14px; --r-ctl: 10px;
    --ease: cubic-bezier(.16, 1, .3, 1);
    color-scheme: light;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-block-size: 100dvh; display: grid; place-items: center;
    padding: 24px calc(16px + env(safe-area-inset-right, 0px)) 24px calc(16px + env(safe-area-inset-left, 0px));
    background: var(--page); color: var(--ink);
    font-family: "SF Arabic", "Noto Kufi Arabic", "Segoe UI", system-ui, -apple-system, sans-serif;
    font-size: 14px; line-height: 1.6;
  }
  .card {
    inline-size: 100%; max-inline-size: 380px; background: var(--paper);
    border: 1px solid var(--line); border-radius: var(--r-card);
    padding: 28px 24px; box-shadow: 0 1px 2px rgba(16,24,40,.04), 0 12px 32px rgba(16,24,40,.06);
  }
  .brand { display: flex; align-items: center; gap: 10px; margin-block-end: 22px; }
  .mark {
    inline-size: 34px; block-size: 34px; border-radius: 9px; flex: none;
    background: var(--ac); color: #fff; display: grid; place-items: center;
    font-weight: 800; font-size: 16px;
  }
  h1 { margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -.01em; }
  .sub { margin: 2px 0 0; font-size: 12px; color: var(--mut); }
  label { display: block; font-size: 12px; font-weight: 600; color: var(--ink-2); margin-block-end: 6px; }
  .field { margin-block-end: 14px; }
  input {
    inline-size: 100%; min-block-size: 44px; padding: 0 12px; font: inherit; color: var(--ink);
    background: var(--paper); border: 1px solid var(--line-2); border-radius: var(--r-ctl);
    transition: border-color 180ms var(--ease), box-shadow 180ms var(--ease);
  }
  input:focus { outline: none; border-color: var(--ac); box-shadow: 0 0 0 3px var(--ac-dim); }
  /* The username and password are Latin-keyed credentials; forcing LTR stops the caret and any
     punctuation rendering on the wrong side inside an RTL document. */
  input[name="user"], input[name="pass"] { direction: ltr; text-align: start; }
  button {
    inline-size: 100%; min-block-size: 44px; margin-block-start: 6px; font: inherit; font-weight: 700;
    color: #fff; background: var(--ac); border: 0; border-radius: var(--r-ctl); cursor: pointer;
    transition: background 180ms var(--ease), transform 100ms var(--ease);
  }
  button:active { transform: scale(.98); }
  @media (hover: hover) and (pointer: fine) { button:hover { background: var(--ac-deep); } }
  button:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ac-dim); }
  .err {
    display: flex; align-items: center; gap: 8px; margin-block-end: 16px; padding: 10px 12px;
    background: var(--bad-dim); border: 1px solid var(--bad-line); border-radius: var(--r-ctl);
    color: var(--bad); font-size: 13px;
  }
  .err svg { inline-size: 16px; block-size: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.8; }
  .foot { margin-block-start: 18px; font-size: 12px; color: var(--faint); text-align: center; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>
</head>
<body>
  <main class="card">
    <div class="brand">
      <span class="mark" aria-hidden="true">م</span>
      <div>
        <h1>مَسار</h1>
        <p class="sub">منصة إدارة المبيعات</p>
      </div>
    </div>

    ${err ? `<div class="err" role="alert">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5m0 3v.01"/></svg>
      <span>${LOGIN_ERROR}</span>
    </div>` : ""}

    <form method="POST" action="/login" autocomplete="on">
      <input type="hidden" name="next" value="${esc(next)}">
      <div class="field">
        <label for="user">اسم المستخدم</label>
        <input id="user" name="user" value="${esc(user)}" autocomplete="username"
               autocapitalize="off" autocorrect="off" spellcheck="false" required autofocus>
      </div>
      <div class="field">
        <label for="pass">كلمة المرور</label>
        <input id="pass" name="pass" type="password" autocomplete="current-password" required>
      </div>
      <button type="submit">تسجيل الدخول</button>
    </form>

    <p class="foot">الدخول مقصور على فريق Lean.</p>
  </main>
</body>
</html>`;
}
