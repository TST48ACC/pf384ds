const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const app = express();

app.use(cookieParser());

const ORIGIN_SANTA = "https://smartfoloosanta.pages.dev";
const ORIGIN_EDU = "https://eduphoria.pages.dev";

app.all('*', async (req, res) => {
    const host = req.get('host');
    const urlPath = req.path;

    // 1. THE HARD BLOCK: Kill any request to the "Scare" paths instantly
    if (urlPath.toLowerCase().includes("helloskids") || urlPath.toLowerCase().includes("unblock")) {
        return res.status(200).send("/* Blocked by Firewall */");
    }

    // 2. GET GAME NAME (Mirroring your Worker logic)
    let gameName = req.query.game || req.cookies.active_game;
    if (!gameName && req.get('Referer')?.includes('game=')) {
        try {
            const refUrl = new URL(req.get('Referer'));
            gameName = refUrl.searchParams.get('game');
        } catch(e) {}
    }

    // 3. THE SMART SEARCH
    let finalRes = null;
    let attempts = [];

    // Priority A: Santa Subfolder (for game assets)
    if (gameName && urlPath !== "/play.html" && urlPath !== "/") {
        attempts.push(`${ORIGIN_SANTA}/${gameName}${urlPath}`.replace(/\/+/g, '/'));
    }
    // Priority B: Eduphoria Root
    attempts.push(ORIGIN_EDU + req.url);
    // Priority C: Santa Root
    attempts.push(ORIGIN_SANTA + req.url);

    for (let target of attempts) {
        try {
            finalRes = await axios.get(target, {
                responseType: 'arraybuffer',
                headers: { 
                    'Referer': ORIGIN_EDU + "/",
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
                },
                validateStatus: (status) => status === 200
            });
            if (finalRes) break;
        } catch (e) {}
    }

    if (!finalRes) return res.status(404).send("404: Not Found");

    // 4. BRAINWASHING (Header & Script Manipulation)
    let contentType = finalRes.headers['content-type'] || '';
    
    // Persistence for Incognito
    if (req.query.game) {
        res.cookie('active_game', req.query.game, { maxAge: 3600000, path: '/', sameSite: 'Lax' });
    }

    // Strip security headers so the game can load in our frame
    res.set("Access-Control-Allow-Origin", "*");
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");

    if (contentType.includes("text/html") || urlPath.endsWith(".js") || contentType.includes("javascript")) {
        let text = finalRes.data.toString();
        
        // This script runs in the browser to prevent the iframe from hijacking the top window
        const shieldScript = `
        <script>
        (function() {
            var proxiedReplace = window.location.replace;
            window.location.replace = function(url) {
                if (url.includes('helloskids')) return console.warn('Redirect blocked');
                proxiedReplace.apply(this, arguments);
            };
            // Stop frame-breaking attempts
            window.top = window.self;
        })();
        </script>`;

        let fixedText = text
            .replaceAll("eduphoria.pages.dev", host)
            .replaceAll("smartfoloosanta.pages.dev", host)
            // Kills the specific redirect line found in your _worker.js
            .replace(/location\.href\s*=\s*['"][^'"]*helloskids[^'"]*['"]/gi, "console.log('Stop')")
            .replace("<head>", "<head>" + shieldScript);
            
        return res.type(contentType).send(fixedText);
    }

    res.type(contentType).send(finalRes.data);
});

app.listen(process.env.PORT || 3000);
