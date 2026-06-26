# Calendar App

A Google Calendar-style month view built with vanilla HTML/CSS/JS and an Express static server.

## Run

```bash
npm install
npm start        # http://localhost:3000
```

Set `PORT` to override the default:

```bash
PORT=8080 npm start
```

## Features

- Month grid (Monday-first) with ISO week numbers
- Add, edit, and delete events
- Color-coded events (blue, green, red, yellow, purple)
- Events persisted in `localStorage` — survive page refresh
- Sidebar mini calendar with independent navigation
- Responsive layout (sidebar hidden on mobile)

## Project structure

```
public/
  index.html   — shell, grid, modal markup
  style.css    — layout and theming
  app.js       — calendar logic, rendering, localStorage
server.js      — Express static file server
```
