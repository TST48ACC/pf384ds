const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const app = express();

app.use(cookieParser());

const ORIGIN_SANTA = "https://smartfoloosanta.pages.dev";
const ORIGIN_EDU = "https://eduphoria.pages.dev";

app.all('*', async (req, res) => {
    const urlPath = req.path;
    const fullUrl = req.url;
    
    // 1. GET GAME NAME (Same logic as your _worker.js)
    let gameName = req.query.game || req.cookies.active_game;
    if (!gameName && req.get('Referer')?.includes('game=')) {
        const refUrl = new URL(req.get('Referer'));
        gameName = refUrl.searchParams.get('game');
    }

    // 2. THE SMART SEARCH (Mirroring your Worker's fetch priority)
    let responseData = null;
    let targetUrl = "";

    // Priority A: Santa Subfolder
    if (gameName && urlPath !== "/play.html" && urlPath !== "/") {
        targetUrl = `${ORIGIN_SANTA}/${gameName}${urlPath}`.replace(/\/+/g, '/');
        try {
            const temp = await axios.get(targetUrl, { responseType: 'arraybuffer', headers: { 'Referer': ORIGIN_EDU + "/" } });
            if (temp.status === 200) responseData = temp;
        } catch (e) {}
    }

    // Priority B: Eduphoria Root
    if (!responseData) {
        try {
            const temp = await axios.get(ORIGIN_EDU + fullUrl, { responseType: 'arraybuffer' });
            if (temp.status === 200) responseData = temp;
        } catch (e) {}
    }

    // Priority C: Santa Root
    if (!responseData) {
        try {
            const temp = await axios.get(ORIGIN_SANTA + fullUrl, { responseType: 'arraybuffer' });
            if (temp.status === 200) responseData = temp;
        } catch (e) {}
    }

    if (!responseData) return res.status(404).send("404: Not Found");

    // 3. BRAINWASHING (The code that kills the redirect)
    let contentType = responseData.headers['content-type'] || '';
    
    // Set cookie if game is detected
    if (req.query.game) {
        res.cookie('active_game', req.query.game, { maxAge: 3600000, path: '/', sameSite: 'lax' });
    }

    // Standard Header Fixes
    res.set("Access-Control-Allow-Origin", "*");
    res.removeHeader("Content-Security-Policy");
    res.removeHeader("X-Frame-Options");

    if (contentType.includes("text/html") || urlPath.endsWith(".js")) {
        let text = responseData.data.toString();
        
        // Exact replacement from your worker
        let fixedText = text
            .replaceAll("eduphoria.pages.dev", req.get('host'))
            .replaceAll("smartfoloosanta.pages.dev", req.get('host'))
            .replace(/location\.href\s*=\s*['"][^'"]*helloskids[^'"]*['"]/g, "console.log('Stop')");
            
        return res.type(contentType).send(fixedText);
    }

    res.type(contentType).send(responseData.data);
});

app.listen(process.env.PORT || 3000);
