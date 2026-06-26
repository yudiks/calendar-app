# Calendar App — Google Calendar Redesign

## Todo

- [x] 1. Redesign `index.html` — two-panel layout: left sidebar + main grid area
- [x] 2. Redesign `style.css` — Google Calendar colors, typography, sidebar, grid, event pills
- [x] 3. Update `app.js` — week starts Monday, week-number column, mini-cal in sidebar, multi-color events

## Review

All three redesign items completed and pushed to GitHub.

**Layout** — replaced single-column app with a two-panel flex layout: 256px sidebar + fluid main area, matching Google Calendar's structure.

**Sidebar** — added a floating "Create" pill button, a fully functional mini calendar (with its own prev/next navigation and today highlight), and a "My calendars" list with colored dots.

**Main grid** — switched week start to Monday (ISO), added a week-number column on the left, and changed the day-name header to show the column date (matching the first-row cell), with today's number in a blue circle.

**Event pills** — replaced solid-color badges with dot + label style; added a color selector (blue/green/red/yellow/purple) in the modal so each event can be categorized by calendar.

**Colors** — adopted Google's `#dadce0` border, `#f1f3f4` hover, `#4285f4` blue, and `#3c4043` text palette throughout.
