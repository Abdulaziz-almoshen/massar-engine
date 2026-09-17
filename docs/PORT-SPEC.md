# Porting a screen to the new design system

One vocabulary, fixed. Every ported screen uses these classes and no others; a screen that needs
something not here says so rather than inventing a private class. Twelve screens inventing twelve
private systems is how the last one reached 2,765 class definitions across 28 prefixes.

## The rule that decides the merge

Naming is **`m-*`** (from the Astra entry; it is what is already deployed and it collides with
nothing). The **verification mechanism** is from the Fable entry. Fable's own class names —
`.card`, `.btn`, `.n`, `.fig`, `.lead`, `.col` — collide with **187 existing definitions** in
`src/`, so they cannot coexist with the old system during a staged port and were not adopted.

## 1. Wrap the screen

The whole screen body goes inside one `.ds6` wrapper. That class is the only place
`massar-ds-crm.ts` can reach; nothing outside it changes.

```js
return '<div class="ds6">' + ...screen... + '</div>';
```

## 2. The vocabulary

| Need | Class | Notes |
| --- | --- | --- |
| Page title / section title | `.m-h1` `.m-h2` | 28px / 20px. One `m-h1` per screen. |
| Supporting line under a title | `.m-meta` | 13px, muted. |
| A card | `.m-card` | `.m-card--pad0` when it holds a flush table. |
| Card header | `.m-card__h` + `.m-card__t` | |
| Table | `.m-table` inside `.m-tablewrap` | The wrap is what scrolls, never the page. |
| Emphasised first cell | `.m-td-n` | |
| Numeric cell | `.m-td-v` | |
| Status word | `.m-chip` (+`--ok` `--warn` `--bad` `--ac`) | Colour means status, never decoration. |
| Button | `.m-btn` (+`--primary`) | |
| Link | `.m-link` | |
| Empty screen / empty table | `.m-empty` + `.m-empty__t` | |
| Segmented control | `.m-seg` with `aria-pressed` | |
| Tabs | `.m-tabs` + `.m-tab` with `aria-selected` | |
| Form field | `.m-field` + `.m-label` + `.m-input`/`.m-select` | |
| Dialog | `.m-dlg` + `.m-dlg__p` `__h` `__b` `__f` | Panel enters from `scale(.97)`, never `scale(0)`. |
| A number | `.m-n` | **Mandatory.** See §3. |
| An absence | `.m-td-nil` + a kind | See §4. |

## 3. Numbers

Every digit that renders goes through `.m-n`, which sets `direction: ltr`,
`unicode-bidi: isolate` and `tabular-nums`. A unit or percent sign that belongs to the number goes
**inside** the span, or it renders on the wrong side.

```js
'<span class="m-n">' + fmtN(v) + '</span>'          // right
fmtN(v)                                              // wrong: bidi will move it
'<span class="m-n">' + fmtN(p) + '٪</span>'          // right
'<span class="m-n">' + fmtN(p) + '</span>٪'          // wrong: the ٪ lands left of the digits
```

A **year is not a quantity**: print `String(year)`, never `fmtN(year)`, which renders «2,026».

## 4. The six absences — three kinds, three treatments

Wording alone does not separate them. At a glance a column of grey text reads as one state
repeated, and a reader who sees six dashes learns to ignore all six.

| Kind | Class | Means | Examples |
| --- | --- | --- | --- |
| `owed` | `.m-nil--owed` | a number someone owes | «لم يُسعَّر» «بلا مستهدف» |
| `unset` | `.m-nil--unset` | a classification nobody made | «لم يُصنَّف» «لم تُسجَّل» «لم يُحدّد» |
| `none` | `.m-nil--none` | a legitimate nothing | «لا بنود مفتوحة» «لا سعر منشور» |

```js
'<span class="m-td-nil m-nil--owed">لم يُسعَّر</span>'
```

**Never a bare `—`.** The one exception is a permissions matrix, where the dash IS the value,
read against a column of check marks.

## 5. Arabic counted nouns

Four-way, never `n + noun`. Use `opPl(n, one, two, few, many)`:

```js
opPl(6, "بند واحد", "بندان", "بنود", "بندًا")   // -> «6 بنود»
fmtN(6) + " بندًا"                              // wrong
```

## 6. Figures that also appear elsewhere

If a count is printed in more than one place — a KPI above a table, a nav badge, a heading — bind
it so it cannot drift:

```js
dsD("nLines", function () { return rows().length; });   // once, at screen setup
dsFig("nLines", rows().length)                          // at every print site
```

`dsVerify` re-runs every derivation on every paint and outlines a figure that disagrees. This is
not optional for a count that appears twice; it is the whole reason the mechanism exists.

## 7. What a ported screen may not contain

- A percentage whose numerator and denominator cover different populations. If some rows lack a
  target, ratio only the rows that have one **and say how many you left out**.
- A rate over a denominator too small to carry it, with no small-sample note.
- A forecast, probability or weighting that no stored field supports.
- A period label that does not match the data's period (one quarter under «السنة المالية»).
- A judgement — "on track", "healthy", "late" — where the field that would prove it is null.
- `left`/`right`/`padding-left`. Logical properties only.
- `transition: all`, an entry from `scale(0)`, or any UI motion over 300ms.
- A hover effect outside `@media (hover: hover) and (pointer: fine)`.

## 8. Motion

One curve, `var(--m-ease)`. Enter `var(--m-in)` (180ms), exit `var(--m-out)` (120ms), press
`var(--m-press)` (100ms) with `transform: scale(.97)`. `prefers-reduced-motion` drops transforms
and keeps opacity. Nothing animates on a keyboard-repeated action — sorting a column, switching a
tab, moving the rail.

## 9. Before you call a screen done

```
npm run build        # tsc
npm run check        # the gate, including check-design and check-numerals
npm run deploy       # check, fly deploy, then smoke — smoke must exit 0
```

Then open the route in a browser and confirm: no console error (a `figure disagrees with records`
line is a failure, not a warning), no horizontal scroll at 400px, and the rail still reads.
