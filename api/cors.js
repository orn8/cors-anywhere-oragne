const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async function handler(request, response) {
    // Allowed origins for CORS
    const allowedOrigins = ['https://sga.oragne.dev'];

    // Get origin with fallbacks
    const origin = request.headers.origin || request.headers.referer || request.headers.host || 'Unknown';

    // Normalise the origin (trim trailing slashes, convert to lowercase)
    let normalisedOrigin = origin.replace(/\/$/, '').toLowerCase();

    // Check if the normalised origin is allowed
    if (!allowedOrigins.some(allowedOrigin => allowedOrigin.toLowerCase() === normalisedOrigin)) {
        return response.status(403).send('Forbidden: Access is denied.');
    }

    // Set CORS headers
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Headers', '*');

    // Validate the URL parameter
    let url = request.query.url;
    if (!url) {
        return response.status(400).send('Bad Request: URL parameter is required.');
    }

    // Append other query parameters correctly
    const params = new URLSearchParams(request.query);
    params.delete('url');
    if (params.toString()) {
        url += (url.includes('?') ? '&' : '?') + params.toString();
    }

    try {
        // Parse the requested URL to get the base domain
        const parsedUrl = new URL(url);
        const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;

        // Fetch the content from the external URL using Axios
        const { status, data } = await axios.get(url, { timeout: 10000 });

        if (status !== 200) {
            return response.status(status).send(data);
        }

        // Load HTML content using Cheerio
        const $ = cheerio.load(data);

        // Add <base> tag only if one does not already exist
        if ($('base').length === 0) {
            $('head').prepend(`<base href="${baseUrl}/">`);
        }

        // Send back the modified HTML
        response.setHeader('Content-Type', 'text/html');
        response.status(200).send($.html());

    } catch (error) {
        response.status(500).json({ error: 'Error fetching or processing content', details: error.message });
    }
};
