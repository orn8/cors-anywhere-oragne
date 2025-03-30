const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async function handler(request, response) {
  // Allowed origins for CORS
  const allowedOrigins = [
    'https://vanishgames.oragne.dev'
  ];

  // Get origin or referer or host
  const origin = request.headers.origin || request.headers.referer || request.headers.host || 'Unknown';

  // Normalise the origin by trimming any trailing slashes and converting to lowercase
  const normalisedOrigin = origin.replace(/\/$/, '').toLowerCase();

  // Check if the normalised origin is allowed
  if (!allowedOrigins.some(allowedOrigin => allowedOrigin.toLowerCase() === normalisedOrigin)) {
    return response.status(403).send('Forbidden: Access is denied.');
  }

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', '*');
    return response.status(200).end(); // Respond with a 200 OK for OPTIONS request
  }

  // CORS headers for actual requests
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Headers', '*');

  // Get the URL from the query parameters
  let url = request.query.url;

  try {
    // Parse the requested URL to get the base domain
    const parsedUrl = new URL(url);
    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.hostname}`;

    // Fetch the content from the external URL using Axios
    const { status, data } = await axios.get(url, { timeout: 5000 }); // 5s timeout

    if (status !== 200) {
      return response.status(status).send(data);
    }

    // Load HTML content using Cheerio
    const $ = cheerio.load(data);

    // Add <base> tag only if one does not already exist
    if ($('base').length === 0) {
      $('head').prepend(`<base href="${baseUrl}/">`);
    }

    // Remove ads
    $('iframe, script').each((i, el) => {
      const src = $(el).attr('src');
      if (src && src.includes('ads')) {
        $(el).remove(); // Remove elements with 'ads' in the src
      }
    });

    // Remove known ad classes or inline ads
    $('.ad-class, .ads').each((i, el) => {
      $(el).remove(); // Remove elements with these ad classes
    });

    // Fix inline CSS for asset paths (like images, fonts)
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
    response.status(500).json({ error: 'Error fetching or processing content' });
  }
}
