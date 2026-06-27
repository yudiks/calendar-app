# Calendar App — Google Calendar Redesign

## Todo

- [x] 1. Redesign `index.html` — two-panel layout: left sidebar + main grid area
- [x] 2. Redesign `style.css` — Google Calendar colors, typography, sidebar, grid, event pills
- [x] 3. Update `app.js` — week starts Monday, week-number column, mini-cal in sidebar, multi-color events

## Code Review

- [x] `app.js:8` — **Correctness**: `new Date()` called twice; year and month could differ across a midnight boundary. Store it once.
- [x] `app.js:154` — **Security**: `ev.color` from localStorage is passed directly to `dot.style.background` without validation. Inject a CSS value like `red; display:none` and it silently applies. Allowlist against the known color values.
- [x] `app.js:14-16` — **Security/Correctness**: `loadEvents()` applies no shape validation on parsed JSON. A corrupted or manually-set localStorage value (e.g. `null`, non-array, objects missing `date`) can cause silent rendering failures. Add a guard that filters to well-shaped entries.

## Future

- `index.html:16` — `#menuBtn` (hamburger) has no handler; dead UI element.
- `app.js:93,185` — `today` computed identically in both `renderGrid` and `renderMini`; could be extracted.
- No test suite; `buildCells`, `isoWeek`, `toDateStr` are pure functions well-suited to unit tests.

## Code Review — Summary

**Correctness** — Fixed `app.js:8`: `new Date()` was called twice; stored once in `_now` to prevent year/month mismatch at midnight.

**Security** — Fixed `app.js:154`: `ev.color` from localStorage was applied directly as inline CSS; now validated against `ALLOWED_COLORS` allowlist, defaulting to blue. Fixed `app.js:14-16`: `loadEvents()` now rejects non-array results and filters out entries missing required string fields, preventing corrupt localStorage data from propagating to the renderer.

**Quality / Tests** — No changes made; items noted under Future (dead `#menuBtn`, `today` duplication, missing unit tests).

---

## Review

All three redesign items completed and pushed to GitHub.

**Layout** — replaced single-column app with a two-panel flex layout: 256px sidebar + fluid main area, matching Google Calendar's structure.

**Sidebar** — added a floating "Create" pill button, a fully functional mini calendar (with its own prev/next navigation and today highlight), and a "My calendars" list with colored dots.

**Main grid** — switched week start to Monday (ISO), added a week-number column on the left, and changed the day-name header to show the column date (matching the first-row cell), with today's number in a blue circle.

**Event pills** — replaced solid-color badges with dot + label style; added a color selector (blue/green/red/yellow/purple) in the modal so each event can be categorized by calendar.

**Colors** — adopted Google's `#dadce0` border, `#f1f3f4` hover, `#4285f4` blue, and `#3c4043` text palette throughout.
