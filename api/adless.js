const axios = require('axios');
const cheerio = require('cheerio');

// Function to fetch and parse EasyList general blocking rules
async function fetchEasyList() {
  const response = await axios.get('https://raw.githubusercontent.com/easylist/easylist/refs/heads/master/easylist/easylist_general_block.txt');
  const data = response.data;
  return data.split('\n').filter(rule => rule && !rule.startsWith('!'));
}

// Function to check if a URL matches any EasyList pattern
function matchesEasyList(url, easyListRules) {
  return easyListRules.some(rule => {
    // Convert pattern to regex and test if URL matches
    const pattern = new RegExp(rule.replace(/\*/g, '.*').replace(/\$/g, '$'));
    return pattern.test(url);
  });
}

module.exports = async function handler(request, response) {
  // Allowed origins for CORS
  const allowedOrigins = ['https://vanishgames.oragne.dev'];

  // Get origin or referer or host
  const origin = request.headers.origin || request.headers.referer || request.headers.host || 'Unknown';

  // Normalize the origin by trimming any trailing slashes and converting to lowercase
  const normalisedOrigin = origin.replace(/\/$/, '').toLowerCase();

  // Check if the normalized origin is allowed
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
    // Fetch EasyList rules
    const easyListRules = await fetchEasyList();

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

    // Fix relative URLs (for images, scripts, styles, etc.)
    $('img, script, link, iframe').each((i, el) => {
      const attrName = $(el).attr('src') ? 'src' : 'href';
      const attrValue = $(el).attr(attrName);

      if (attrValue) {
        if (attrValue.startsWith('/')) {
          // Convert relative URL to absolute
          const newUrl = baseUrl + attrValue;
          $(el).attr(attrName, newUrl);
        } else if (attrValue.startsWith('//')) {
          // Handle protocol-relative URLs
          const newUrl = parsedUrl.protocol + attrValue; // Use the same protocol as the current page
          $(el).attr(attrName, newUrl);
        }

        // Check if the URL matches any EasyList rules and remove if it does
        if (matchesEasyList(attrValue, easyListRules)) {
          $(el).remove();
        }
      }
    });

    // Set response headers and send the modified HTML back
    response.setHeader('Content-Type', 'text/html');
    response.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    response.status(200).send($.html());

  } catch (error) {
    response.status(500).json({ error: 'Error fetching or processing content' });
  }
}
