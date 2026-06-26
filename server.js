// Serves the static calendar app from /public on PORT (default 3000).
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Calendar app running at http://localhost:${PORT}`);
});
