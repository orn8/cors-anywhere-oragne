const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

module.exports = async function handler(request, response) {
  // Allowed origins for CORS
  const allowedOrigins = [
    'https://vanishgames.oragne.dev'
  ];

  const origin = request.headers.origin;

  // Check if the origin is allowed
  if (!allowedOrigins.includes(origin)) {
    return response.status(403).send(origin);
  }

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Origin', origin)
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

    // Fetch the content from the external URL
    const { status, data } = await getRequest(url);

    if (status !== 200) {
      return response.status(status).send(data);
    }

    // Load HTML content using Cheerio
    const $ = cheerio.load(data);

    // Fix relative URLs (for images, scripts, styles, etc.)
    $('img, script, link, iframe').each((i, el) => {
      const attrName = $(el).attr('src') ? 'src' : 'href';
      const attrValue = $(el).attr(attrName);

      if (attrValue && attrValue.startsWith('/')) {
        // Convert relative URL to absolute
        const newUrl = baseUrl + attrValue;
        $(el).attr(attrName, newUrl);
      }
    });

    // Remove ads
    $('iframe, script').each((i, el) => {
      const src = $(el).attr('src');
      if (src && src.includes('ads')) {
        $(el).remove(); // Remove elements with 'ads' in the src
      }
    });

    $('.ad-class, .ads').each((i, el) => {
      $(el).remove(); // Remove elements with these ad classes
    });

    // Send back the modified HTML with corrected asset paths
    response.setHeader('Content-Type', 'text/html');
    response.status(200).send($.html());

  } catch (error) {
    response.status(500).json({ error: 'Error fetching or processing content' });
  }

  // Function to make the HTTPS request to fetch content
  function getRequest(url) {
    return new Promise(resolve => {
      const req = https.get(url, (resp) => {
        let data = '';
        resp.on('data', (chunk) => {
          data += chunk;
        });
        resp.on('end', () => {
          resolve({ status: resp.statusCode, data: data });
        });
      });

      req.on('error', (err) => {
        resolve({ status: 500, data: err.message });
      });
    });
  }
}
