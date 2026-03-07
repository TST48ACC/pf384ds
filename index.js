const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const app = express();

app.use(cookieParser());

const ORIGIN_EDU = "https://eduphoria.pages.dev";
const ORIGIN_SANTA = "https://smartfoloosanta.pages.dev";

app.all('*', async (req, res) => {
    const urlPath = req.path;
    const gameName = req.query.game || req.cookies.active_game;

    // 1. HOME PAGE LOCK
    if (urlPath === "/" || urlPath === "/index.html") {
        try {
            const response = await axios.get(ORIGIN_EDU + urlPath);
            let text = response.data.toString().replaceAll("eduphoria.pages.dev", req.get('host'));
            return res.type('html').send(text);
        } catch (e) { return res.status(500).send("Error loading home"); }
    }

    // 2. THE SMART SEARCH (Try Santa Subfolder -> Eduphoria Root -> Santa Root)
    let finalRes = null;
    let targets = [];

    if (gameName && urlPath !== "/play.html") {
        targets.push(`${ORIGIN_SANTA}/${gameName}${urlPath}`);
    }
    targets.push(`${ORIGIN_EDU}${urlPath}${req.url.slice(req.path.length)}`);
    targets.push(`${ORIGIN_SANTA}${urlPath}${req.url.slice(req.path.length)}`);

    for (let target of targets) {
        try {
            finalRes = await axios.get(target, { 
                responseType: 'arraybuffer',
                headers: { 'User-Agent': req.get('User-Agent') },
                validateStatus: (status) => status === 200 
            });
            if (finalRes) break;
        } catch (e) { continue; }
    }

    if (!finalRes) return res.status(404).send("404: Not Found");

    // 3. BRAINWASHING (Fixing the IP Scare/Redirects)
    let contentType = finalRes.headers['content-type'] || '';
    
    // Set Cookie if game is in URL
    if (req.query.game) {
        res.cookie('active_game', req.query.game, { maxAge: 3600000, path: '/' });
    }

    // Security Header Bypass
    res.set("Access-Control-Allow-Origin", "*");
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");

    if (contentType.includes("text/html") || contentType.includes("javascript")) {
        let text = finalRes.data.toString()
            .replaceAll("eduphoria.pages.dev", req.get('host'))
            .replaceAll("smartfoloosanta.pages.dev", req.get('host'))
            // This kills the "helloskids" IP Scare redirect
            .replace(/location\.href\s*=\s*['"][^'"]*helloskids[^'"]*['"]/g, "console.log('Stop')");
        return res.type(contentType).send(text);
    }

    res.type(contentType).send(finalRes.data);
});

app.listen(process.env.PORT || 3000);
