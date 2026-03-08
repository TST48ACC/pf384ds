const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const app = express();

app.use(cookieParser());

const ORIGIN_SANTA = "https://smartfoloosanta.pages.dev";
const ORIGIN_EDU = "https://eduphoria.pages.dev";
const ORIGIN_AUDIO = "https://geometrydash-lite.io/game/lite"; // The "Gold Mine" for music

app.all('*', async (req, res) => {
    const host = req.get('host');
    const urlPath = req.path;

    // 1. THE HARD BLOCK: Kill any request to the "Scare" paths instantly
    if (urlPath.toLowerCase().includes("helloskids") || urlPath.toLowerCase().includes("unblock")) {
        return res.status(200).send("/* Blocked by Firewall */");
    }

    // 2. THE MUSIC FORWARDER: Reroutes missing audio to the working lite.io source
    if (urlPath.includes("StreamingAssets/audios/")) {
        const musicRedirect = ORIGIN_AUDIO + urlPath;
        try {
            const audioRes = await axios.get(musicRedirect, {
                responseType: 'arraybuffer',
                headers: { 'Referer': 'https://geometrydash-lite.io/' },
                timeout: 10000
            });
            return res.type("audio/mpeg").send(audioRes.data);
        } catch (e) {
            console.log("Music redirect failed from lite.io source.");
        }
    }

    // 3. GET GAME NAME (Mirroring your Worker logic)
    let gameName = req.query.game || req.cookies.active_game;
    if (!gameName && req.get('Referer')?.includes('game=')) {
        try {
            const refUrl = new URL(req.get('Referer'));
            gameName = refUrl.searchParams.get('game');
        } catch(e) {}
    }

    // 4. THE SMART SEARCH
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
                validateStatus: (status) => status === 200,
                timeout: 8000
            });
            if (finalRes) break;
        } catch (e) {}
    }

    if (!finalRes) return res.status(404).send("404: Not Found");

    // 5. HEADER & SCRIPT MANIPULATION
    let contentType = finalRes.headers['content-type'] || '';
    
    if (req.query.game) {
        res.cookie('active_game', req.query.game, { maxAge: 3600000, path: '/', sameSite: 'Lax' });
    }

    res.set("Access-Control-Allow-Origin", "*");
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");

    if (contentType.includes("text/html") || urlPath.endsWith(".js") || contentType.includes("javascript")) {
        let text = finalRes.data.toString();
        
        // Redirect Shield (stops the site from forcing you to the helloskids page)
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
            .replace(/location\.href\s*=\s*['"][^'"]*helloskids[^'"]*['"]/gi, "console.log('Stop')")
            .replace("<head>", "<head>" + shieldScript);
            
        return res.type(contentType).send(fixedText);
    }

    res.type(contentType).send(finalRes.data);
});

app.listen(process.env.PORT || 3000);.
