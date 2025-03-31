const https = require('https');
const cheerio = require('cheerio');

module.exports = async function handler(request, response) {
  // Allowed origins for CORS
  const allowedOrigins = [
    'https://sga.oragne.dev'
  ];

  // Get origin or referer or host
  const origin = request.headers.origin || request.headers.referer || request.headers.host || 'Unknown';

  // Normalise the origin by trimming any trailing slashes and converting to lowercase
  const normalisedOrigin = origin.replace(/\/$/, '').toLowerCase();

  // Check if the normalized origin is allowed
  if (!allowedOrigins.some(allowedOrigin => allowedOrigin.toLowerCase() === normalisedOrigin)) {
    return response.status(403).send('Forbidden: Access is denied.');
  }

  // Set CORS headers
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Headers', '*');

  // Build the final URL with query parameters
  let query = Object.entries(request.query);
  query.shift();
  let url = request.query.url;
  query.forEach(entry => {
    url += '&' + entry[0] + '=' + entry[1];
  });

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

    // Add <base> tag only if one does not already exist
    if ($('base').length === 0) {
      $('head').prepend(`<base href="${baseUrl}/">`);
    }

    // Send back the modified HTML
    response.setHeader('Content-Type', 'text/html');
    response.status(200).send($.html());

  } catch (error) {
    response.status(500).json({ error: 'Error fetching or processing content' });
  }

  // Function to make an HTTPS request and return the data
  function getRequest(url) {
    return new Promise(resolve => {
      const req = https.get(url, (resp) => {
        let data = '';
        resp.on('data', chunk => { data += chunk; });
        resp.on('end', () => { resolve({ status: resp.statusCode, data }); });
      });
      req.on('error', (err) => { resolve({ status: 500, data: err.message }); });
    });
  }
};
