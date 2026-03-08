const http = require('http');

// This creates a basic server that Render needs to stay "Active"
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<html><body>.</body></html>'); // Just a dot
});

// Render automatically assigns a PORT, this ensures the app listens to it
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
