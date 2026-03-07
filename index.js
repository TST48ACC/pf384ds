const express = require('express');
const app = express();

app.get('*', (req, res) => {
    res.send(`
        <html>
            <body style="background: #111; color: #0f0; font-family: monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;">
                <h1>PF384DS ONLINE</h1>
                <p>Status: <span style="color: white;">LIVE AND UPDATED</span></p>
                <p>Update ID: <span style="color: yellow;">777-BINGO</span></p>
                <p>Current Path: ${req.path}</p>
                <hr style="width: 200px; border-color: #333;">
                <p style="font-size: 10px; color: #666;">If you see this, Render is successfully deploying your changes.</p>
            </body>
        </html>
    `);
});

app.listen(process.env.PORT || 3000);
