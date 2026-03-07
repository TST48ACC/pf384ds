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
    const fullUrl = req.url;

    // 1. HOME PAGE LOCK
    if (urlPath === "/" || urlPath === "/index.html") {
        try {
            const eduRes = await axios.get(ORIGIN_EDU + urlPath);
            let text = eduRes.data.toString().replaceAll("eduphoria.pages.dev", host);
            return res.type('html').send(text);
        } catch (e) { return res.status(500).send("Menu Error"); }
    }

    // 2. GET GAME NAME (Exactly like your Worker)
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

    if (gameName && urlPath !== "/play.html") {
        attempts.push(`${ORIGIN_SANTA}/${gameName}${urlPath}`.replace(/\/+/g, '/'));
    }
    attempts.push(ORIGIN_EDU + fullUrl);
    attempts.push(ORIGIN_SANTA + fullUrl);

    for (let target of attempts) {
        try {
            finalRes = await axios.get(target, {
                responseType: 'arraybuffer',
                headers: { 'Referer': ORIGIN_EDU + "/", 'User-Agent': req.get('User-Agent') },
                validateStatus: (status) => status === 200
            });
            if (finalRes) break;
        } catch (e) {}
    }

    if (!finalRes) return res.status(404).send("404");

    // 4. THE BRAINWASHING (Exact mirror of your Worker)
    let contentType = finalRes.headers['content-type'] || '';
    
    if (req.query.game) {
        res.cookie('active_game', req.query.game, { maxAge: 3600000, path: '/' });
    }

    res.set("Access-Control-Allow-Origin", "*");
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");

    if (contentType.includes("text/html") || urlPath.endsWith(".js") || contentType.includes("javascript")) {
        let text = finalRes.data.toString();
        
        // This is the specific line from your Worker that kills the redirect
        // I added 'gi' (Global + Ignore Case) to make it more powerful than the original
        let fixedText = text
            .replaceAll("eduphoria.pages.dev", host)
            .replaceAll("smartfoloosanta.pages.dev", host)
            .replace(/location\.href\s*=\s*['"][^'"]*helloskids[^'"]*['"]/gi, "console.log('Redirect Blocked')")
            .replace(/window\.location\.href\s*=\s*['"][^'"]*helloskids[^'"]*['"]/gi, "console.log('Redirect Blocked')");
            
        return res.type(contentType).send(fixedText);
    }

    res.type(contentType).send(finalRes.data);
});

app.listen(process.env.PORT || 3000);
