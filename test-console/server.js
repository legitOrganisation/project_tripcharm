const express = require('express');
const path = require('path');

const app = express();
const PORT = 808080;

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// Start server
app.listen(PORT, () => {
  console.log(`Website running at http://localhost:${PORT}`);
});
