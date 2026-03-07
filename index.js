const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const app = express();

app.use(cookieParser());

const ORIGIN_EDU = "https://eduphoria.pages.dev";
const ORIGIN_SANTA = "https://smartfoloosanta.pages.dev";

// Helper to fetch and "Clean" the code
async function fetchAndClean(targetUrl, host) {
    try {
        const res = await axios.get(targetUrl, {
            responseType: 'arraybuffer',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0' },
            timeout: 5000
        });

        let contentType = res.headers['content-type'] || '';
        let data = res.data;

        if (contentType.includes("text") || contentType.includes("javascript")) {
            let text = data.toString();
            
            // 1. Kill the specific "IP Scare" / Helloskids redirect
            // This looks for ANY mention of helloskids and stops it
            text = text.replace(/location\.href\s*=\s*.*?helloskids.*?/gi, "console.log('Redirect Blocked')");
            text = text.replace(/window\.location\.replace\(.*?helloskids.*?\)/gi, "console.log('Redirect Blocked')");
            
            // 2. Stop frame-breaking (common cause of redirects)
            text = text.replace(/if\s*\(top\s*!==\s*self\)/g, "if(false)");
            text = text.replace(/if\s*\(window\s*!==\s*top\)/g, "if(false)");

            // 3. Fix internal links
            text = text.replaceAll("eduphoria.pages.dev", host);
            text = text.replaceAll("smartfoloosanta.pages.dev", host);

            return { data: Buffer.from(text), contentType };
        }
        return { data, contentType };
    } catch (e) {
        return null;
    }
}

app.all('*', async (req, res) => {
    const host = req.get('host');
    const urlPath = req.path;
    const gameName = req.query.game || req.cookies.active_game;

    // Set cookie if game is detected
    if (req.query.game) {
        res.cookie('active_game', req.query.game, { maxAge: 3600000, path: '/' });
    }

    // Step 1: Logic for the "Smart Search"
    let targets = [];
    if (gameName && urlPath !== "/play.html" && urlPath !== "/") {
        targets.push(`${ORIGIN_SANTA}/${gameName}${urlPath}`);
    }
    targets.push(`${ORIGIN_EDU}${urlPath}${req.url.slice(req.path.length)}`);
    targets.push(`${ORIGIN_SANTA}${urlPath}${req.url.slice(req.path.length)}`);

    let result = null;
    for (let target of targets) {
        result = await fetchAndClean(target, host);
        if (result) break;
    }

    if (!result) return res.status(404).send("File Not Found");

    // Remove Security Headers that allow the "Scare" to trigger or block the frame
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", result.contentType);
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");
    
    res.send(result.data);
});

app.listen(process.env.PORT || 3000);
