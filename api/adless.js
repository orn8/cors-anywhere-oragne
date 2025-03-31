const axios = require('axios');
const cheerio = require('cheerio');

let cachedUserAgent = null; // Cache for the most common user agent
const USER_AGENT_URL = 'https://jnrbsn.github.io/user-agents/user-agents.json';

async function getUserAgent() {
    if (cachedUserAgent) return cachedUserAgent; // Use cached value if available

    try {
        const { data } = await axios.get(USER_AGENT_URL, { timeout: 5000 });
        const desktopAgents = data.filter(ua =>
            ua.includes('Windows NT 10.0') || ua.includes('Macintosh') || ua.includes('X11; Linux')
        );

        // Pick the most common Chrome user agent
        const chromeAgents = desktopAgents.filter(ua => ua.includes('Chrome') && !ua.includes('Edg'));
        cachedUserAgent = chromeAgents.length ? chromeAgents[0] : desktopAgents[0]; // Fallback if no Chrome UA

    } catch (error) {
        cachedUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36';
    }

    return cachedUserAgent;
}

module.exports = async function handler(request, response) {
    // Allowed origins for CORS
    const allowedOrigins = ['https://vanishgames.oragne.dev'];

    // Get origin with fallbacks
    const origin = request.headers.origin || request.headers.referer || request.headers.host || 'Unknown';

    // Normalise the origin
    let normalisedOrigin;
    try {
        normalisedOrigin = new URL(origin).origin;
    } catch (error) {
        normalisedOrigin = origin.replace(/\/$/, '').toLowerCase();
    }

    // Check if the normalised origin is allowed
    if (!allowedOrigins.some(allowedOrigin => allowedOrigin.toLowerCase() === normalisedOrigin)) {
        return response.status(403).send('Forbidden: Access is denied.');
    }

    // Handle preflight OPTIONS request
    if (request.method === 'OPTIONS') {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', '*');
        return response.status(200).end();
    }

    // Set CORS headers for actual requests
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Headers', '*');

    // Validate and construct the target URL
    let url = request.query.url;
    if (!url) {
        return response.status(400).json({ error: 'Bad Request: URL parameter is required.' });
    }
    const params = new URLSearchParams(request.query);
    params.delete('url');
    if (params.toString()) {
        url += (url.includes('?') ? '&' : '?') + params.toString();
    }

    try {
        // Get the latest user agent
        const userAgent = await getUserAgent();

        // Parse the requested URL to get the base domain
        const parsedUrl = new URL(url);
        const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;

        // Fetch the content using Axios with a dynamic User-Agent
        const { status, data } = await axios.get(url, {
            timeout: 5000, // 5s timeout
            headers: { 'User-Agent': userAgent }
        });

        if (status !== 200) {
            return response.status(status).send(data);
        }

        // Load HTML content using Cheerio
        const $ = cheerio.load(data);

        // Add <base> tag if one does not already exist
        if ($('base').length === 0) {
            $('head').prepend(`<base href="${baseUrl}/">`);
        }

        // Remove ads
        $('iframe, script').each((i, el) => {
            const src = $(el).attr('src');
            if (src && /ads|doubleclick|tracking|banner/.test(src)) {
                $(el).remove();
            }
        });

        // Remove known ad classes or inline ads
        $('[class*="ad"], [id*="ad"], .sponsored, .promotion').each((i, el) => {
            $(el).remove();
        });

        // Fix inline CSS asset paths (images, fonts)
        $('style').each((i, el) => {
            let css = $(el).html();
            css = css.replace(/url\(['"]?(\/[^)'"]+)['"]?\)/g, `url(${baseUrl}$1)`);
            $(el).html(css);
        });

        // Set response headers and send the modified HTML back
        response.setHeader('Content-Type', 'text/html');
        response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        response.status(200).send($.html());

    } catch (error) {
        response.status(500).json({ error: 'Error fetching or processing content', details: error.message });
    }
};
