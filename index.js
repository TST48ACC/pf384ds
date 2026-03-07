const express = require('express');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const app = express();

app.use(cookieParser());

const ORIGIN_EDU = "https://eduphoria.pages.dev";
const ORIGIN_SANTA = "https://smartfoloosanta.pages.dev";

async function fetchAndClean(targetUrl, host) {
    try {
        const res = await axios.get(targetUrl, {
            responseType: 'arraybuffer',
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Referer': ORIGIN_EDU
            },
            timeout: 8000
        });

        let contentType = res.headers['content-type'] || '';
        let data = res.data;

        if (contentType.includes("text/html") || contentType.includes("javascript")) {
            let text = data.toString();
            
            // 1. THE HELLOSKIDS ANNIHILATOR (Base64 + Plaintext)
            // This catches "aHR0cHM6Ly9oZWxsb3NraWRz" which is "https://helloskids" in base64
            const b64scare = "aHR0cHM6Ly9oZWxsb3NraWRz"; 
            text = text.replaceAll(b64scare, "Y29uc29sZS5sb2coJ0Jsb2NrZWQnKQ=="); // Replaces with base64 of console.log
            text = text.replace(/helloskids/gi, "localhost"); // Total text overwrite
            
            // 2. DISABLE REDIRECT FUNCTIONS
            // We rewrite the browser's ability to redirect if the word 'helloskids' is involved
            const protectionScript = `
            <script>
            (function() {
                const oldLocation = window.location.replace;
                window.location.replace = function(url) {
                    if(url.includes('helloskids')) { console.log('Blocked Replace'); return; }
                    return oldLocation.apply(this, arguments);
                };
                window.onbeforeunload = function() { return "Blocked redirect attempt"; };
            })();
            </script>`;
            
            if(contentType.includes("html")) {
                text = text.replace("<head>", "<head>" + protectionScript);
            }

            // 3. KILL FRAME BREAKERS & DOMAIN LOCKS
            text = text.replace(/window\.top\s*!==\s*window\.self/g, "false");
            text = text.replace(/top\.location/g, "self.location");
            text = text.replaceAll("eduphoria.pages.dev", host);
            text = text.replaceAll("smartfoloosanta.pages.dev", host);

            return { data: Buffer.from(text), contentType };
        }
        return { data, contentType };
    } catch (e) { return null; }
}

app.all('*', async (req, res) => {
    const host = req.get('host');
    const urlPath = req.path;
    const gameName = req.query.game || req.cookies.active_game;

    if (req.query.game) {
        res.cookie('active_game', req.query.game, { maxAge: 3600000, path: '/' });
    }

    let targets = [];
    if (gameName && urlPath !== "/" && !urlPath.includes("index.html")) {
        targets.push(`${ORIGIN_SANTA}/${gameName}${urlPath}`);
    }
    targets.push(`${ORIGIN_EDU}${urlPath}${req.url.slice(req.path.length)}`);
    targets.push(`${ORIGIN_SANTA}${urlPath}${req.url.slice(req.path.length)}`);

    let result = null;
    for (let target of targets) {
        result = await fetchAndClean(target, host);
        if (result) break;
    }

    if (!result) return res.status(404).send("Not Found");

    res.set({
        "Access-Control-Allow-Origin": "*",
        "Content-Type": result.contentType,
        "X-Frame-Options": "ALLOWALL" // Explicitly allow framing
    });
    res.removeHeader("Content-Security-Policy");
    
    res.send(result.data);
});

app.listen(process.env.PORT || 3000);
